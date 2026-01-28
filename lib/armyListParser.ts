/**
 * Army List Parser - Core Logic
 *
 * Extracts the core parsing functionality from the API route
 * so it can be called directly for background processing.
 *
 * Uses direct @google/genai SDK for Gemini calls to ensure proper
 * system instruction handling and implicit caching support.
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { ParsedArmyList } from '@/lib/types';
import { langfuse } from '@/lib/langfuse';
import { observeOpenAI } from 'langfuse';
import { getArmyParseProvider, getArmyParseModel, validateProviderConfig, isGeminiProvider } from '@/lib/aiProvider';
import { normalizeFactionName } from '@/lib/factionNormalization';
import { generateContent, formatCacheLog, type GeminiTokenUsage } from '@/lib/geminiDirect';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Sanitize JSON string by removing/replacing control characters
 * that can cause JSON.parse() to fail.
 * Control characters 0x00-0x1F (except allowed ones) are invalid in JSON strings.
 */
function sanitizeJsonString(text: string): string {
  // Replace common control characters with appropriate substitutes
  return text
    // Replace various dash-like control characters with proper em-dash
    .replace(/[\x13\x14\x15\x16\x17]/g, '–')
    // Replace other control characters (except tab, newline, carriage return) with space
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    // Clean up any double spaces created
    .replace(/  +/g, ' ');
}

const openai = observeOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

// Gemini provider is fetched dynamically based on provider setting (AI Studio or Vertex AI)

// Load known detachments from cached files
// Load known detachments from cached files (exported for reuse in briefGenerator)
export async function loadKnownDetachments(): Promise<string> {
  const dataDir = path.join(process.cwd(), 'data', 'parsed-rules');
  let context = 'KNOWN DETACHMENTS:\n';

  try {
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      if (file.startsWith('detachments-') && file.endsWith('.json')) {
        const content = await fs.readJson(path.join(dataDir, file));
        if (content.faction && Array.isArray(content.detachments)) {
          context += `- ${content.faction.toUpperCase()}: ${content.detachments.join(', ')}\n`;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load known detachments:', e);
  }
  return context;
}

// JSON Schema for Structured Outputs - FLAT structure to avoid nesting depth limits
// Stats are looked up from database after matching, not returned by AI
// Composition uses string format: "role:count:modelType:weapon1,weapon2" to avoid nested objects
const ARMY_LIST_SCHEMA = {
  type: "object",
  properties: {
    detectedFaction: { type: ["string", "null"], description: "Detected faction. For subfactions, return JUST the subfaction name." },
    detectedDetachment: { type: ["string", "null"], description: "Detected detachment name." },
    detectedPointsLimit: { type: ["number", "null"], description: "Detected points limit." },
    parsingConfidence: { type: "number", description: "Overall parsing confidence (0-1)." },
    units: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Unit name as it appears in the list." },
          datasheetId: { type: ["string", "null"], description: "ID of matched datasheet, or null if no match." },
          datasheetName: { type: "string", description: "Name of the matched datasheet." },
          datasheetConfidence: { type: "number", description: "Confidence in datasheet match (0-1)." },
          pointsCost: { type: "number", description: "Points cost for this unit." },
          modelCount: { type: "number", description: "Total models in the unit." },
          weapons: { type: "array", items: { type: "string" }, description: "All weapon names." },
          wargear: { type: "array", items: { type: "string" }, description: "Wargear/equipment names." },
          abilities: { type: "array", items: { type: "string" }, description: "Non-core ability names." },
          enhancements: { type: "array", items: { type: "string" }, description: "Enhancement names." },
          composition: { type: "array", items: { type: "string" }, description: "Model breakdown as strings: 'role:count:modelType:weapon1,weapon2'. Roles: sergeant, leader, heavy_weapon, special_weapon, regular." },
          needsReview: { type: "boolean", description: "True if uncertain about matching." }
        },
        required: ["name", "datasheetId", "datasheetName", "datasheetConfidence", "pointsCost", "modelCount", "weapons", "wargear", "abilities", "enhancements", "composition", "needsReview"]
      }
    }
  },
  required: ["detectedFaction", "detectedDetachment", "detectedPointsLimit", "parsingConfidence", "units"]
};

// Helper to parse keywords that might be JSON string or array
function parseKeywords(keywords: any): string[] {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === 'string') {
    try {
      const parsed = JSON.parse(keywords);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If it's a comma-separated string
      return keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    }
  }
  return [];
}

// Enrich simplified AI output with full database details
// Converts the simplified schema (names only) to full ParsedArmyList format
function enrichParsedListFromDatabase(simplifiedOutput: any, availableDatasheets: any[]): ParsedArmyList {
  // Build lookup maps
  const datasheetById = new Map<string, any>();
  const datasheetByName = new Map<string, any>();
  for (const ds of availableDatasheets) {
    datasheetById.set(ds.id, ds);
    datasheetByName.set(ds.name.toLowerCase(), ds);
  }

  const enrichedUnits = (simplifiedOutput.units || []).map((unit: any) => {
    // Find the datasheet
    const datasheet = unit.datasheetId 
      ? datasheetById.get(unit.datasheetId)
      : datasheetByName.get(unit.datasheetName?.toLowerCase());

    // Build full parsedDatasheet object
    const parsedDatasheet = datasheet ? {
      datasheetId: datasheet.id,
      name: datasheet.name,
      factionId: datasheet.factionId,
      faction: datasheet.faction?.name || null,
      subfaction: datasheet.subfaction || null,
      role: datasheet.role || null,
      keywords: parseKeywords(datasheet.keywords),
      movement: datasheet.movement || null,
      toughness: datasheet.toughness || null,
      save: datasheet.save || null,
      invulnerableSave: datasheet.invulnerableSave || null,
      wounds: datasheet.wounds || null,
      leadership: datasheet.leadership || null,
      objectiveControl: datasheet.objectiveControl || null,
      pointsCost: datasheet.pointsCost || null,
      leaderRules: datasheet.canLead || null,
      leaderAbilities: datasheet.leaderAbility || null,
      matchConfidence: unit.datasheetConfidence || 0.5,
      needsReview: !unit.datasheetId || unit.datasheetConfidence < 0.8
    } : {
      datasheetId: null,
      name: unit.datasheetName || unit.name,
      factionId: null,
      faction: null,
      subfaction: null,
      role: null,
      keywords: [],
      movement: null,
      toughness: null,
      save: null,
      invulnerableSave: null,
      wounds: null,
      leadership: null,
      objectiveControl: null,
      pointsCost: null,
      leaderRules: null,
      leaderAbilities: null,
      matchConfidence: 0,
      needsReview: true
    };

    // Build weapons array with database lookup
    const weapons = (unit.weapons || []).map((weaponName: string) => {
      // Try to find weapon in datasheet
      let matchedWeapon = null;
      if (datasheet?.weapons) {
        matchedWeapon = datasheet.weapons.find((dw: any) => 
          dw.weapon?.name?.toLowerCase() === weaponName.toLowerCase() ||
          dw.weapon?.name?.toLowerCase().includes(weaponName.toLowerCase()) ||
          weaponName.toLowerCase().includes(dw.weapon?.name?.toLowerCase() || '')
        )?.weapon;
      }

      return {
        weaponId: matchedWeapon?.id || null,
        name: weaponName,
        range: matchedWeapon?.range || null,
        type: matchedWeapon?.type || null,
        attacks: matchedWeapon?.attacks || null,
        ballisticSkill: matchedWeapon?.ballisticSkill || null,
        weaponSkill: matchedWeapon?.weaponSkill || null,
        strength: matchedWeapon?.strength || null,
        armorPenetration: matchedWeapon?.armorPenetration || null,
        damage: matchedWeapon?.damage || null,
        abilities: matchedWeapon?.abilities ? (typeof matchedWeapon.abilities === 'string' ? JSON.parse(matchedWeapon.abilities) : matchedWeapon.abilities) : [],
        matchConfidence: matchedWeapon ? 0.9 : 0.3,
        needsReview: !matchedWeapon
      };
    });

    // Build abilities array with database lookup
    const abilities = (unit.abilities || []).map((abilityName: string) => {
      let matchedAbility = null;
      if (datasheet?.abilities) {
        matchedAbility = datasheet.abilities.find((da: any) => 
          da.ability?.name?.toLowerCase() === abilityName.toLowerCase() ||
          da.ability?.name?.toLowerCase().includes(abilityName.toLowerCase())
        )?.ability;
      }

      return {
        abilityId: matchedAbility?.id || null,
        name: abilityName,
        type: matchedAbility?.type || null,
        description: matchedAbility?.description || null,
        phase: matchedAbility?.phase || null,
        matchConfidence: matchedAbility ? 0.9 : 0.3,
        needsReview: !matchedAbility
      };
    });

    // Build composition with wounds from datasheet
    // Parse string format: "role:count:modelType:weapon1,weapon2"
    const baseWounds = parsedDatasheet.wounds || 1;
    const composition = (unit.composition || []).map((compStr: string) => {
      // Handle both string format (new) and object format (legacy)
      if (typeof compStr === 'object') {
        const comp = compStr as any;
        return {
          modelType: comp.modelType || 'Model',
          role: comp.role || 'regular',
          count: comp.count || 1,
          weapons: comp.weapons || [],
          woundsPerModel: comp.woundsPerModel || baseWounds
        };
      }
      
      // Parse string format: "role:count:modelType:weapon1,weapon2"
      const parts = compStr.split(':');
      const role = parts[0] || 'regular';
      const count = parseInt(parts[1], 10) || 1;
      const modelType = parts[2] || 'Model';
      const weaponsPart = parts[3] || '';
      const weapons = weaponsPart ? weaponsPart.split(',').map(w => w.trim()) : [];
      
      return {
        modelType,
        role,
        count,
        weapons,
        woundsPerModel: baseWounds
      };
    });

    return {
      name: unit.name,
      datasheet: unit.datasheetName || unit.name,
      parsedDatasheet,
      weapons,
      abilities,
      keywords: parseKeywords(datasheet?.keywords),
      pointsCost: unit.pointsCost || 0,
      modelCount: unit.modelCount || 1,
      composition,
      wargear: unit.wargear || [],
      enhancements: unit.enhancements || [],
      needsReview: unit.needsReview || parsedDatasheet.needsReview
    };
  });

  return {
    detectedFaction: simplifiedOutput.detectedFaction,
    detectedDetachment: simplifiedOutput.detectedDetachment,
    detectedPointsLimit: simplifiedOutput.detectedPointsLimit,
    units: enrichedUnits,
    parsingConfidence: simplifiedOutput.parsingConfidence || 0.5
  } as ParsedArmyList;
}

// Post-process weapon matches
function postProcessWeaponMatches(parsedList: ParsedArmyList, availableDatasheets: any[]): ParsedArmyList {
  const datasheetWeapons = new Map<string, any[]>();

  for (const d of availableDatasheets) {
    if (d.weapons && Array.isArray(d.weapons)) {
      const weaponList = d.weapons.map((dw: any) => dw.weapon).filter(Boolean);
      if (weaponList.length > 0) {
        datasheetWeapons.set(d.id, weaponList);
      }
    }
  }

  let improvementCount = 0;

  for (const unit of parsedList.units) {
    if (!unit.weapons) continue;

    const datasheetId = unit.parsedDatasheet?.datasheetId;
    if (!datasheetId) continue;

    const validWeapons = datasheetWeapons.get(datasheetId);
    if (!validWeapons || validWeapons.length === 0) continue;

    for (const weapon of unit.weapons) {
      if (weapon.weaponId && weapon.matchConfidence >= 0.8) {
        if (validWeapons.some(w => w.id === weapon.weaponId)) {
          continue;
        }
      }

      const searchName = weapon.name
        .replace(/\s*[\[（(].*$/, '')
        .replace(/\s*[—–-]\s*(strike|sweep|frag|krak|standard|supercharge|dispersed|focused).*$/i, '')
        .trim()
        .toLowerCase();

      const match = validWeapons.find(w => {
        const weaponName = w.name.toLowerCase();
        const baseName = weaponName
          .replace(/\s*[\[（(].*$/, '')
          .replace(/\s*[—–-]\s*(strike|sweep|frag|krak|standard|supercharge|dispersed|focused).*$/i, '')
          .trim();

        return weaponName === searchName ||
               baseName === searchName ||
               weaponName.startsWith(searchName) ||
               searchName.startsWith(baseName);
      });

      if (match) {
        const wasUnmatched = !weapon.weaponId || weapon.matchConfidence < 0.5;
        weapon.weaponId = match.id;
        weapon.matchConfidence = 0.9;
        weapon.needsReview = false;
        weapon.range = match.range;
        weapon.type = match.type;
        weapon.attacks = match.attacks;
        weapon.strength = match.strength;
        weapon.armorPenetration = match.armorPenetration;
        weapon.damage = match.damage;

        try {
          const abilities = JSON.parse(match.abilities || '[]');
          weapon.abilities = abilities;
        } catch (e) {
          weapon.abilities = [];
        }

        if (wasUnmatched) {
          improvementCount++;
          console.log(`Post-process weapon: Matched "${weapon.name}" → "${match.name}" for ${unit.name}`);
        }
      }
    }

    const hasLowConfidenceWeapon = unit.weapons.some((w: any) => !w.weaponId || w.matchConfidence < 0.8);
    const hasLowConfidenceAbility = unit.abilities?.some((a: any) => !a.abilityId && a.matchConfidence < 0.8);

    if (!hasLowConfidenceWeapon && !hasLowConfidenceAbility && unit.parsedDatasheet?.matchConfidence >= 0.8) {
      unit.needsReview = false;
    }
  }

  if (improvementCount > 0) {
    console.log(`Post-processing improved ${improvementCount} weapon matches`);
  }

  return parsedList;
}

// Post-process wargear matches
function postProcessWargearMatches(parsedList: ParsedArmyList, availableDatasheets: any[]): ParsedArmyList {
  const datasheetWargear = new Map<string, any[]>();

  for (const d of availableDatasheets) {
    if (d.abilities && Array.isArray(d.abilities)) {
      const wargearList = d.abilities
        .filter((da: any) => da.ability?.type === 'wargear' && da.ability.id)
        .map((da: any) => da.ability);

      if (wargearList.length > 0) {
        datasheetWargear.set(d.id, wargearList);
      }
    }
  }

  let improvementCount = 0;

  for (const unit of parsedList.units) {
    if (!unit.abilities) continue;

    const datasheetId = unit.parsedDatasheet?.datasheetId;
    if (!datasheetId) continue;

    const validWargear = datasheetWargear.get(datasheetId);
    if (!validWargear || validWargear.length === 0) continue;

    for (const ability of unit.abilities) {
      if (ability.type !== 'wargear') continue;

      if (ability.abilityId && ability.matchConfidence >= 0.8) {
        if (validWargear.some(w => w.id === ability.abilityId)) {
          continue;
        }
      }

      const searchName = ability.name
        .toLowerCase()
        .replace(/^terminator\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      const match = validWargear.find(w => {
        const wargearName = w.name.toLowerCase().trim();
        const normalizedWargear = wargearName.replace(/^terminator\s+/i, '').trim();

        return wargearName === searchName ||
               normalizedWargear === searchName ||
               wargearName.includes(searchName) ||
               searchName.includes(normalizedWargear);
      });

      if (match) {
        const wasUnmatched = !ability.abilityId || ability.matchConfidence < 0.5;
        ability.abilityId = match.id;
        ability.matchConfidence = 0.95;
        ability.needsReview = false;

        if (match.description) {
          ability.description = match.description;
        }

        if (wasUnmatched) {
          improvementCount++;
          console.log(`Post-process wargear: Matched "${ability.name}" → "${match.name}" for ${unit.name}`);
        }
      }
    }

    const hasLowConfidenceWeapon = unit.weapons?.some((w: any) => !w.weaponId || w.matchConfidence < 0.8);
    const hasLowConfidenceAbility = unit.abilities?.some((a: any) => !a.abilityId && a.matchConfidence < 0.8);

    if (!hasLowConfidenceWeapon && !hasLowConfidenceAbility && unit.parsedDatasheet?.matchConfidence >= 0.8) {
      unit.needsReview = false;
    }
  }

  if (improvementCount > 0) {
    console.log(`Post-processing improved ${improvementCount} wargear matches`);
  }

  return parsedList;
}

// Post-process wargear wounds
function postProcessWargearWounds(parsedList: ParsedArmyList, availableDatasheets: any[]): ParsedArmyList {
  const datasheetWargearEffects = new Map<string, Map<string, number>>();

  for (const datasheet of availableDatasheets) {
    if (!datasheet.abilities || !Array.isArray(datasheet.abilities)) continue;

    const wargearEffects = new Map<string, number>();
    for (const da of datasheet.abilities) {
      if (da.ability?.type !== 'wargear') continue;

      const desc = da.ability.description || '';
      // eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifiers, controlled datasheet input
      const woundsMatch = desc.match(/wounds?\s{0,20}(?:characteristic\s{0,10}(?:of|is))?\s{0,10}(\d+)/i);
      if (woundsMatch) {
        wargearEffects.set(da.ability.name.toLowerCase(), parseInt(woundsMatch[1], 10));
      }
    }

    if (wargearEffects.size > 0) {
      datasheetWargearEffects.set(datasheet.id, wargearEffects);
    }
  }

  let modifiedCount = 0;

  for (const unit of parsedList.units) {
    const datasheetId = unit.parsedDatasheet?.datasheetId;
    if (!datasheetId) continue;

    const wargearEffects = datasheetWargearEffects.get(datasheetId);
    if (!wargearEffects || wargearEffects.size === 0) continue;

    const baseWounds = unit.parsedDatasheet?.wounds || 1;

    if (unit.composition && Array.isArray(unit.composition)) {
      for (const comp of unit.composition) {
        const weapons = comp.weapons || [];
        let modifiedWounds = baseWounds;

        for (const weaponName of weapons) {
          const normalizedName = weaponName.toLowerCase();
          for (const [wargearName, woundsValue] of wargearEffects) {
            if (normalizedName.includes(wargearName) || wargearName.includes(normalizedName)) {
              modifiedWounds = woundsValue;
              break;
            }
          }
        }

        if (unit.wargear && Array.isArray(unit.wargear)) {
          for (const wargearItem of unit.wargear) {
            const normalizedItem = wargearItem.toLowerCase();
            for (const [wargearName, woundsValue] of wargearEffects) {
              if (normalizedItem.includes(wargearName) || wargearName.includes(normalizedItem)) {
                if (weapons.some(w => w.toLowerCase().includes(wargearName) || wargearName.includes(w.toLowerCase()))) {
                  modifiedWounds = woundsValue;
                  break;
                }
              }
            }
          }
        }

        if (modifiedWounds !== comp.woundsPerModel) {
          console.log(`Adjusting ${unit.name} ${comp.role} wounds: ${comp.woundsPerModel} -> ${modifiedWounds}`);
          comp.woundsPerModel = modifiedWounds;
          modifiedCount++;
        }
      }
    }
  }

  if (modifiedCount > 0) {
    console.log(`Post-processing applied ${modifiedCount} wargear wound modifications`);
  }

  return parsedList;
}

// Post-process faction normalization
function postProcessFactionNormalization(parsedList: ParsedArmyList): ParsedArmyList {
  const originalFaction = parsedList.detectedFaction;

  if (originalFaction) {
    const normalizedFaction = normalizeFactionName(originalFaction);
    if (normalizedFaction && normalizedFaction !== originalFaction) {
      console.log(`Faction normalization: "${originalFaction}" → "${normalizedFaction}"`);
      parsedList.detectedFaction = normalizedFaction;
    }
  }

  return parsedList;
}

// Parser-specific instructions (appended to shared prefix or used standalone)
const PARSER_INSTRUCTIONS = `
## YOUR TASK: ARMY LIST PARSER
You are an expert at parsing Warhammer 40K 10th Edition army lists.
Your job is to extract structured unit data from army list documents and match them to available datasheets.

Each datasheet in the REFERENCE DATA section contains its specific WEAPONS and ABILITIES with their IDs.
When matching, use ONLY the weapons and abilities listed under the matched datasheet.

CRITICAL: EXACT NAME MATCHING - READ CAREFULLY
1. ALWAYS use EXACT name matching first - if input says "Logan Grimnar", find the datasheet named exactly "Logan Grimnar"
2. The datasheets are sorted ALPHABETICALLY - scroll through to find the exact name
3. Each datasheet line starts with [ID] - use THIS ID for datasheetId, not an ID from a different datasheet
4. Example: Input "Logan Grimnar" → Find "[0b24550b-...] DATASHEET: "Logan Grimnar"" → Use ID "0b24550b-..."
5. Do NOT match to similar-sounding names (e.g., "Ragnar Blackmane" is NOT "Logan Grimnar")
6. If you cannot find an exact match, ONLY then consider partial matches with lower confidence

CRITICAL: MATCHING RULES
1. First, match each unit in the army list to a DATASHEET by EXACT NAME
2. Then, match weapons and abilities using ONLY the IDs listed under that specific datasheet
3. Each datasheet shows: [ID] Name | stats for weapons, and [ID] Name (type) for abilities
4. Copy the exact ID in brackets when matching
5. The datasheetId MUST come from the datasheet with the matching name

CRITICAL: FACTION DETECTION
- For subfactions (Space Wolves, Blood Angels, Dark Angels, Black Templars, Deathwatch), return JUST the subfaction name
- If army list says "Space Marines (Space Wolves)" → detectedFaction should be "Space Wolves" (not the full composite)
- If army list says "Adeptus Astartes - Space Wolves" → detectedFaction should be "Space Wolves"
- The most specific faction identifier wins - if "Space Wolves" is mentioned, use that instead of "Space Marines"
- Do NOT include parentheses or dashes in the detectedFaction - return clean faction names only

CRITICAL: DETACHMENT DETECTION
- Look for lines like "Detachment: Gladius Task Force" or "Detachment Rule: Saga of the Beastslayer"
- The Detachment is NOT the battle size (Strike Force, Incursion, etc.) and NOT the faction name
- Use the KNOWN DETACHMENTS list in the REFERENCE DATA to validate your choice

CRITICAL: DUPLICATE UNITS ARE VALID
- Army lists frequently contain multiple instances of the same unit type
- Each instance is a SEPARATE unit - do NOT merge units with the same name
- Example: If "Blood Claws (135 Points)" appears twice → output TWO separate Blood Claws entries

CONFIDENCE SCORING:
- 1.0 = exact name match with ID from datasheet
- 0.9 = close match (minor spelling difference, variant profile)
- 0.5-0.8 = uncertain match
- 0.0 = no match found (set ID to null, needsReview: true)

For each unit, extract:
- Match to datasheet by name → use datasheet ID
- Match weapons using IDs from that datasheet's WEAPONS section
- Match abilities using IDs from that datasheet's ABILITIES section
- Build composition with correct modelType and woundsPerModel

IMPORTANT: Count each unit occurrence separately. Two "Blood Claws" entries = two objects in output.

Return structured data matching the exact schema provided.`;

// Core AI parsing function
async function parseArmyListWithAI(
  content: string,
  contentType: 'text' | 'image',
  availableDatasheets: any[],
  trace?: any, // Optional Langfuse trace for LLM cost tracking
  sharedSystemPrefix?: string // Pre-built shared context for cache optimization
): Promise<ParsedArmyList> {
  let systemPrompt: string;
  let datasheetCount: number;

  if (sharedSystemPrefix) {
    // Use shared prefix (for cache optimization) + parser instructions
    systemPrompt = `${sharedSystemPrefix}\n\n${PARSER_INSTRUCTIONS}`;
    datasheetCount = -1; // Unknown when using shared prefix
    console.log(`📋 Using shared system prefix (${sharedSystemPrefix.length} chars)`);
  } else {
    // Build local context (backwards compatibility / standalone use)
    const sortedDatasheets = [...availableDatasheets].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    datasheetCount = sortedDatasheets.length;

    const datasheetContext = buildLocalDatasheetContext(sortedDatasheets);
    const detachmentContext = await loadKnownDetachments();

    systemPrompt = `## REFERENCE DATA: FACTION DATASHEETS
Use these datasheets for matching units, weapons, and abilities.

${detachmentContext}

AVAILABLE DATASHEETS (sorted alphabetically):
${datasheetContext}

${PARSER_INSTRUCTIONS}`;
  }

  // Rest of function continues below...
  return await executeParseWithAI(content, contentType, systemPrompt, datasheetCount, availableDatasheets, trace);
}

// Build local datasheet context (used when no shared prefix provided)
function buildLocalDatasheetContext(sortedDatasheets: any[]): string {
  return sortedDatasheets.map(d => {
    const keywords = JSON.parse(d.keywords);

    let weaponsList = '';
    if (d.weapons && Array.isArray(d.weapons) && d.weapons.length > 0) {
      const weaponLines = d.weapons.map((dw: any) => {
        const w = dw.weapon;
        const abilities = w.abilities ? JSON.parse(w.abilities) : [];
        return `    [${w.id}] ${w.name} | ${w.range} | ${w.type} | S${w.strength} AP${w.armorPenetration} D${w.damage}${abilities.length > 0 ? ` | ${abilities.join(', ')}` : ''}`;
      });
      weaponsList = `\n  WEAPONS:\n${weaponLines.join('\n')}`;
    }

    let abilitiesList = '';
    if (d.abilities && Array.isArray(d.abilities) && d.abilities.length > 0) {
      const coreAbilities = d.abilities.filter((da: any) => da.ability?.type === 'core');
      const factionAbilities = d.abilities.filter((da: any) => da.ability?.type === 'faction');
      const unitAbilities = d.abilities.filter((da: any) => da.ability?.type === 'unit');
      const wargearAbilities = d.abilities.filter((da: any) => da.ability?.type === 'wargear');

      const lines: string[] = [];

      if (coreAbilities.length > 0) {
        lines.push(...coreAbilities.map((da: any) => `    [${da.ability.id}] ${da.ability.name} (core)`));
      }
      if (factionAbilities.length > 0) {
        lines.push(...factionAbilities.map((da: any) => `    [${da.ability.id}] ${da.ability.name} (faction)`));
      }
      if (unitAbilities.length > 0) {
        lines.push(...unitAbilities.map((da: any) => {
          const desc = da.ability.description || '';
          const shortDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
          return `    [${da.ability.id}] ${da.ability.name} (unit) - ${shortDesc}`;
        }));
      }
      if (wargearAbilities.length > 0) {
        lines.push(...wargearAbilities.map((da: any) => {
          const desc = da.ability.description || '';
          // eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifiers, controlled datasheet input
          const woundsMatch = desc.match(/wounds?\s{0,20}(?:characteristic\s{0,10}(?:of|is))?\s{0,10}(\d+)/i);
          const effect = woundsMatch ? `W=${woundsMatch[1]}` : desc.substring(0, 40);
          return `    [${da.ability.id}] ${da.ability.name} (wargear) - ${effect}`;
        }));
      }

      if (lines.length > 0) {
        abilitiesList = `\n  ABILITIES:\n${lines.join('\n')}`;
      }
    }

    let pointsInfo = `${d.pointsCost}pts`;
    if (d.pointsTiers) {
      try {
        const tiers = typeof d.pointsTiers === 'string' ? JSON.parse(d.pointsTiers) : d.pointsTiers;
        if (Array.isArray(tiers) && tiers.length > 1) {
          pointsInfo = tiers.map((t: { models: number; points: number }) => `${t.models}=${t.points}pts`).join(', ');
        }
      } catch {
        // Use base points if parsing fails
      }
    }

    let compositionInfo = '';
    if (d.compositionData) {
      try {
        const compData = typeof d.compositionData === 'string' ? JSON.parse(d.compositionData) : d.compositionData;
        if (Array.isArray(compData) && compData.length > 0) {
          const compParts = compData.map((c: any) => `${c.name} (${c.woundsPerModel}W)`);
          compositionInfo = `\n  COMPOSITION: ${compParts.join(', ')}`;
        }
      } catch {
        // Skip if parsing fails
      }
    }

    return `[${d.id}] DATASHEET: "${d.name}" (${pointsInfo})
  Faction: ${d.faction}${d.subfaction ? ` (${d.subfaction})` : ''} | Role: ${d.role}
  Stats: M:${d.movement} T:${d.toughness} SV:${d.save} W:${d.wounds} LD:${d.leadership} OC:${d.objectiveControl}
  Keywords: ${keywords.join(', ')}${compositionInfo}${weaponsList}${abilitiesList}`;
  }).join('\n\n');
}

// Execute the AI parsing with the built system prompt
async function executeParseWithAI(
  content: string,
  contentType: 'text' | 'image',
  systemPrompt: string,
  datasheetCount: number,
  availableDatasheets: any[],
  trace?: any
): Promise<ParsedArmyList> {
  const provider = getArmyParseProvider();
  const modelName = getArmyParseModel(provider);

  console.log(`🤖 Army Parse Provider: ${provider.toUpperCase()}`);
  console.log(`📊 Model: ${modelName}`);

  validateProviderConfig(provider);

  let parsed: any;

  if (isGeminiProvider(provider)) {
    // Build the user prompt based on content type
    let userPrompt: string;

    if (contentType === 'image') {
      // TODO: Image support with direct SDK requires different handling
      // For now, throw an error - images are not commonly used for army parsing
      throw new Error('Image parsing is not yet supported with direct Gemini SDK. Please use text input.');
    } else {
      userPrompt = `Parse this Warhammer 40K army list and extract all units with their datasheets, weapons, and abilities:\n\n${content}`;
    }

    // Create Langfuse generation for LLM cost tracking if trace provided
    const generation = trace?.generation({
      name: "gemini-army-parse",
      model: modelName,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentType === 'text' ? content : '[image content - base64 data]' }
      ],
      metadata: {
        provider: provider,
        contentType,
        datasheetCount: datasheetCount > 0 ? datasheetCount : 'shared-prefix',
        maxOutputTokens: 32768,
        systemPromptLength: systemPrompt.length,
        userContentLength: content.length,
        usingSharedPrefix: datasheetCount < 0,
      }
    });

    // Use direct @google/genai SDK for structured output
    // This ensures proper system instruction placement for implicit caching
    const result = await generateContent({
      model: modelName,
      systemInstruction: systemPrompt,
      contents: userPrompt,
      responseSchema: ARMY_LIST_SCHEMA,
      maxOutputTokens: 32768,
      thinkingBudget: 1024, // Low thinking budget for parsing
    });

    const parsedObject = result.object;
    const usage = result.usage;
    const finishReason = result.finishReason;

    // Log token usage with cache info
    console.log(`📊 Army parse token usage: ${usage.inputTokens} input, ${usage.outputTokens} output, ${usage.totalTokens} total`);
    console.log(formatCacheLog(usage));

    if (finishReason && finishReason !== 'STOP' && finishReason !== 'stop') {
      console.warn(`⚠️ Gemini response may be truncated. finishReason: ${finishReason}`);
    }

    // Update Langfuse generation with cache stats
    if (generation) {
      generation.update({
        output: JSON.stringify(parsedObject),
        metadata: {
          finishReason,
          cachedTokens: usage.cacheReadInputTokens,
          cacheWriteTokens: usage.cacheCreationInputTokens,
          cacheHitRate: usage.cacheHitRate
        }
      });
      generation.end({
        usage: usage.totalTokens > 0 ? {
          input: usage.inputTokens,
          output: usage.outputTokens,
          total: usage.totalTokens
        } : undefined
      });
    }

    parsed = parsedObject;

  } else {
    let input: any[];

    if (contentType === 'image') {
      input = [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Parse this Warhammer 40K army list image and extract all units with their datasheets, weapons, and abilities.' },
            { type: 'input_image', image_url: content, detail: 'high' },
          ],
        },
      ];
    } else {
      input = [
        { role: 'user', content: `Parse this Warhammer 40K army list and extract all units with their datasheets, weapons, and abilities:\n\n${content}` },
      ];
    }

    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: systemPrompt,
      input,
      reasoning: { effort: 'low' },
      text: {
        format: { type: 'json_schema', name: 'army_list_parse', schema: ARMY_LIST_SCHEMA, strict: true },
        verbosity: 'low'
      },
    });

    parsed = JSON.parse(response.output_text || '{}');
  }

  console.log('AI Parse Response units:', parsed.units?.length || 0);

  // Enrich simplified AI output with full database details
  const enrichedList = enrichParsedListFromDatabase(parsed, availableDatasheets);
  console.log('Enriched units with database details');

  return enrichedList;
}

export interface ParseArmyListOptions {
  text: string;
  factionId?: string;
  factionName?: string;
  trace?: any; // Optional Langfuse trace for observability
  sharedSystemPrefix?: string; // Pre-built shared context for cache optimization
}

export interface ParseArmyListResult {
  success: boolean;
  parsedArmy?: ParsedArmyList;
  error?: string;
}

/**
 * Parse an army list from text.
 * This is the main entry point for direct function calls (no HTTP).
 */
export async function parseArmyListFromText(options: ParseArmyListOptions): Promise<ParseArmyListResult> {
  const { text, factionId, factionName, trace } = options;

  try {
    // Resolve factionId if missing but name provided
    let targetFactionId = factionId;
    if (!targetFactionId && factionName) {
      const f = await prisma.faction.findFirst({
        where: { name: { equals: factionName, mode: 'insensitive' } }
      });
      if (f) targetFactionId = f.id;
    }

    // Build faction filter
    let factionFilter: any = {};
    let forbiddenKeywords: string[] = [];

    if (targetFactionId) {
      const faction = await prisma.faction.findUnique({
        where: { id: targetFactionId },
        include: { parentFaction: true }
      });

      if (faction) {
        const factionIds = [faction.id];
        if (faction.parentFactionId) {
          factionIds.push(faction.parentFactionId);
        }
        factionFilter = { factionId: { in: factionIds } };

        if (faction.metaData) {
          try {
            const meta = JSON.parse(faction.metaData);
            if (meta.forbiddenKeywords && Array.isArray(meta.forbiddenKeywords)) {
              forbiddenKeywords = meta.forbiddenKeywords;
            }
          } catch (e) {
            console.error('Error parsing faction metadata', e);
          }
        }
      }
    }

    // Fetch datasheets with their weapons and abilities
    const datasheets = await prisma.datasheet.findMany({
      where: factionFilter,
      select: {
        id: true,
        name: true,
        factionId: true,
        faction: true,
        subfaction: true,
        role: true,
        keywords: true,
        movement: true,
        toughness: true,
        save: true,
        invulnerableSave: true,
        wounds: true,
        leadership: true,
        objectiveControl: true,
        pointsCost: true,
        compositionData: true,
        leaderRules: true,
        leaderAbilities: true,
        weapons: {
          include: {
            weapon: {
              select: {
                id: true, name: true, range: true, type: true, attacks: true,
                strength: true, armorPenetration: true, damage: true, abilities: true,
              },
            },
          },
        },
        abilities: {
          include: {
            ability: {
              select: { id: true, name: true, type: true, description: true },
            },
          },
        },
      },
    });

    // Filter by forbidden keywords
    const validDatasheets = datasheets.filter(d => {
      if (forbiddenKeywords.length === 0) return true;
      try {
        const kws = JSON.parse(d.keywords);
        return !forbiddenKeywords.some(fk => kws.includes(fk));
      } catch (e) { return true; }
    });

    console.log(`Loaded ${validDatasheets.length} datasheets for parsing`);

    // Parse with AI (pass trace for Langfuse LLM cost tracking, and shared prefix for cache optimization)
    let parsedList = await parseArmyListWithAI(text, 'text', validDatasheets, trace, options.sharedSystemPrefix);

    // Post-processing pipeline
    parsedList = postProcessFactionNormalization(parsedList);
    parsedList = postProcessWeaponMatches(parsedList, validDatasheets);
    parsedList = postProcessWargearMatches(parsedList, validDatasheets);
    parsedList = postProcessWargearWounds(parsedList, validDatasheets);

    return {
      success: true,
      parsedArmy: parsedList,
    };

  } catch (error) {
    console.error('Error parsing army list:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing army list',
    };
  }
}
