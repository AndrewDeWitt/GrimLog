import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { ParsedArmyList } from '@/lib/types';
import { langfuse } from '@/lib/langfuse';
import { observeOpenAI } from 'langfuse';
import { getArmyParseProvider, getArmyParseModel, validateProviderConfig } from '@/lib/aiProvider';
import { normalizeFactionName } from '@/lib/factionNormalization';
import { requireAuth } from '@/lib/auth/apiAuth';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import * as fs from 'fs-extra';
import * as path from 'path';

const openai = observeOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

// Initialize Gemini client (lazy - only used if provider is google)
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Load known detachments from cached files
async function loadKnownDetachments(): Promise<string> {
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

// JSON Schema for Structured Outputs
const ARMY_LIST_SCHEMA = {
  type: "object",
  properties: {
    detectedFaction: {
      type: ["string", "null"],
      description: "The detected faction from the army list. For subfactions like Space Wolves, Blood Angels, Dark Angels, Black Templars, or Deathwatch, return JUST the subfaction name (e.g., 'Space Wolves' not 'Space Marines (Space Wolves)'). For parent factions, return the faction name (e.g., 'Space Marines', 'Tyranids')."
    },
    detectedDetachment: {
      type: ["string", "null"],
      description: "The detected detachment (e.g., 'Gladius Task Force', 'Invasion Fleet'). Look for 'Detachment:', 'Detachment Rule:', or headers."
    },
    detectedPointsLimit: {
      type: ["number", "null"],
      description: "The detected points limit from the army list"
    },
    units: {
      type: "array",
      description: "Array of parsed units from the army list",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The unit name as it appears in the list"
          },
          datasheet: {
            type: "string",
            description: "The datasheet name this unit should use"
          },
          parsedDatasheet: {
            type: "object",
            description: "Matched datasheet information",
            properties: {
              datasheetId: {
                type: ["string", "null"],
                description: "ID of the matched datasheet from the database, or null if no match"
              },
              name: {
                type: "string",
                description: "Name of the matched datasheet"
              },
              factionId: {
                type: ["string", "null"],
                description: "ID of the faction"
              },
              faction: {
                type: ["string", "null"],
                description: "Faction of the datasheet"
              },
              subfaction: {
                type: ["string", "null"],
                description: "Subfaction of the datasheet"
              },
              role: {
                type: ["string", "null"],
                description: "Role (e.g., Battleline, HQ, Elites)"
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "Array of keyword strings"
              },
              movement: {
                type: ["string", "null"],
                description: "Movement characteristic"
              },
              toughness: {
                type: ["number", "null"],
                description: "Toughness characteristic"
              },
              save: {
                type: ["string", "null"],
                description: "Save characteristic"
              },
              invulnerableSave: {
                type: ["string", "null"],
                description: "Invulnerable save characteristic"
              },
              wounds: {
                type: ["number", "null"],
                description: "Wounds characteristic"
              },
              leadership: {
                type: ["number", "null"],
                description: "Leadership characteristic"
              },
              objectiveControl: {
                type: ["number", "null"],
                description: "Objective Control characteristic"
              },
              pointsCost: {
                type: ["number", "null"],
                description: "Base points cost"
              },
              leaderRules: {
                type: ["string", "null"],
                description: "Which units this character can attach to (e.g., 'Blood Claws; Grey Hunters')"
              },
              leaderAbilities: {
                type: ["string", "null"],
                description: "Abilities granted when this character is leading a unit"
              },
              matchConfidence: {
                type: "number",
                description: "Confidence in the match (0-1)"
              },
              needsReview: {
                type: "boolean",
                description: "Whether this match needs manual review"
              }
            },
            required: [
              "datasheetId",
              "name",
              "factionId",
              "faction",
              "subfaction",
              "role",
              "keywords",
              "movement",
              "toughness",
              "save",
              "invulnerableSave",
              "wounds",
              "leadership",
              "objectiveControl",
              "pointsCost",
              "leaderRules",
              "leaderAbilities",
              "matchConfidence",
              "needsReview"
            ],
            additionalProperties: false
          },
          weapons: {
            type: "array",
            description: "Array of weapons this unit has",
            items: {
              type: "object",
              properties: {
                weaponId: {
                  type: ["string", "null"],
                  description: "ID of the matched weapon from database"
                },
                name: {
                  type: "string",
                  description: "Weapon name"
                },
                range: {
                  type: ["string", "null"],
                  description: "Weapon range"
                },
                type: {
                  type: ["string", "null"],
                  description: "Weapon type (e.g., Assault 2, Heavy D6)"
                },
                attacks: {
                  type: ["string", "null"],
                  description: "Number of attacks"
                },
                ballisticSkill: {
                  type: ["string", "null"],
                  description: "Ballistic Skill for ranged weapons"
                },
                weaponSkill: {
                  type: ["string", "null"],
                  description: "Weapon Skill for melee weapons"
                },
                strength: {
                  type: ["string", "null"],
                  description: "Strength characteristic"
                },
                armorPenetration: {
                  type: ["string", "null"],
                  description: "AP characteristic"
                },
                damage: {
                  type: ["string", "null"],
                  description: "Damage characteristic"
                },
                abilities: {
                  type: "array",
                  items: { type: "string" },
                  description: "Weapon abilities"
                },
                matchConfidence: {
                  type: "number",
                  description: "Confidence in weapon match (0-1)"
                },
                needsReview: {
                  type: "boolean",
                  description: "Whether this weapon needs review"
                }
              },
              required: [
                "weaponId",
                "name",
                "range",
                "type",
                "attacks",
                "ballisticSkill",
                "weaponSkill",
                "strength",
                "armorPenetration",
                "damage",
                "abilities",
                "matchConfidence",
                "needsReview"
              ],
              additionalProperties: false
            }
          },
          abilities: {
            type: "array",
            description: "Array of unit abilities",
            items: {
              type: "object",
              properties: {
                abilityId: {
                  type: ["string", "null"],
                  description: "ID of the matched ability from database"
                },
                name: {
                  type: "string",
                  description: "Ability name"
                },
                type: {
                  type: ["string", "null"],
                  description: "Ability type (core, faction, unit, leader, wargear)"
                },
                description: {
                  type: ["string", "null"],
                  description: "Ability description"
                },
                phase: {
                  type: ["string", "null"],
                  description: "Phase when ability is used"
                },
                matchConfidence: {
                  type: "number",
                  description: "Confidence in ability match (0-1)"
                },
                needsReview: {
                  type: "boolean",
                  description: "Whether this ability needs review"
                }
              },
              required: [
                "abilityId",
                "name",
                "type",
                "description",
                "phase",
                "matchConfidence",
                "needsReview"
              ],
              additionalProperties: false
            }
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Unit keywords"
          },
          pointsCost: {
            type: "number",
            description: "Points cost for this unit. Use the points shown in the army list. For variable-size units, use the correct tier based on model count (e.g., 5 models=170pts, 10 models=340pts)"
          },
          modelCount: {
            type: "number",
            description: "Number of models in the unit. Extract from the army list."
          },
          composition: {
            type: "array",
            description: "Per-model composition breakdown with model types, roles and loadouts. For units with multiple model types (e.g., Headtakers + Hunting Wolves), create separate entries for each model type.",
            items: {
              type: "object",
              properties: {
                modelType: {
                  type: "string",
                  description: "Model type name from the datasheet's compositionData (e.g., 'Wolf Guard Headtaker', 'Hunting Wolf', 'Terminator'). Use the exact name from the matched datasheet."
                },
                role: {
                  type: "string",
                  enum: ["sergeant", "leader", "heavy_weapon", "special_weapon", "regular"],
                  description: "Model role within the unit"
                },
                count: {
                  type: "number",
                  description: "Number of models with this model type",
                  minimum: 1
                },
                weapons: {
                  type: "array",
                  items: { type: "string" },
                  description: "Weapons carried by models of this type"
                },
                woundsPerModel: {
                  type: "number",
                  description: "Wounds characteristic per model (from datasheet compositionData)",
                  minimum: 1
                }
              },
              required: ["modelType", "role", "count", "weapons", "woundsPerModel"],
              additionalProperties: false
            }
          },
          wargear: {
            type: "array",
            items: { type: "string" },
            description: "List of wargear/equipment (legacy)"
          },
          enhancements: {
            type: "array",
            items: { type: "string" },
            description: "List of enhancements/upgrades"
          },
          needsReview: {
            type: "boolean",
            description: "Whether this unit needs manual review overall"
          }
        },
        required: [
          "name",
          "datasheet",
          "parsedDatasheet",
          "weapons",
          "abilities",
          "keywords",
          "pointsCost",
          "modelCount",
          "composition",
          "wargear",
          "enhancements",
          "needsReview"
        ],
        additionalProperties: false
      }
    },
    parsingConfidence: {
      type: "number",
      description: "Overall confidence in the parsing (0-1)"
    }
  },
  required: ["detectedFaction", "detectedDetachment", "detectedPointsLimit", "units", "parsingConfidence"],
  additionalProperties: false
};

// Helper to extract text from PDF using OpenAI Responses API
async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  const base64 = fileBuffer.toString('base64');
  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Extract all text from this PDF document. Return only the text content, preserving structure.',
          },
          {
            type: 'input_image',
            image_url: `data:application/pdf;base64,${base64}`,
            detail: 'auto',
          },
        ],
      },
    ],
  });

  return response.output_text || '';
}

// Post-process weapon matches - match against the unit's specific datasheet weapons only
function postProcessWeaponMatches(
  parsedList: ParsedArmyList,
  availableDatasheets: any[]
): ParsedArmyList {
  // Build a map of datasheet ID -> weapons for quick lookup
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
    
    // Only process if we have a matched datasheet
    const datasheetId = unit.parsedDatasheet?.datasheetId;
    if (!datasheetId) continue;
    
    // Get weapons for this specific datasheet
    const validWeapons = datasheetWeapons.get(datasheetId);
    if (!validWeapons || validWeapons.length === 0) continue;
    
    for (const weapon of unit.weapons) {
      // Skip weapons that already have a valid match to this datasheet's weapons
      if (weapon.weaponId && weapon.matchConfidence >= 0.8) {
        if (validWeapons.some(w => w.id === weapon.weaponId)) {
          continue;
        }
      }
      
      // Try to find a match by name against this datasheet's weapons
      const searchName = weapon.name
        .replace(/\s*[\[（(].*$/, '')  // Remove [ability] suffixes
        .replace(/\s*[—–-]\s*(strike|sweep|frag|krak|standard|supercharge|dispersed|focused).*$/i, '')
        .trim()
        .toLowerCase();
      
      // Find matching weapon from this datasheet
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
        // Update the weapon with the match
        const wasUnmatched = !weapon.weaponId || weapon.matchConfidence < 0.5;
        weapon.weaponId = match.id;
        weapon.matchConfidence = 0.9;
        weapon.needsReview = false;
        
        // Copy stats from matched weapon
        weapon.range = match.range;
        weapon.type = match.type;
        weapon.attacks = match.attacks;
        weapon.strength = match.strength;
        weapon.armorPenetration = match.armorPenetration;
        weapon.damage = match.damage;
        
        // Parse and set abilities
        try {
          const abilities = JSON.parse(match.abilities || '[]');
          weapon.abilities = abilities;
        } catch (e) {
          weapon.abilities = [];
        }
        
        if (wasUnmatched) {
          improvementCount++;
          console.log(`Post-process weapon: Matched "${weapon.name}" → "${match.name}" (${match.id}) for ${unit.name}`);
        }
      }
    }
    
    // Recalculate unit needsReview based on updated weapons
    const hasLowConfidenceWeapon = unit.weapons.some((w: any) => 
      !w.weaponId || w.matchConfidence < 0.8
    );
    const hasLowConfidenceAbility = unit.abilities?.some((a: any) => 
      !a.abilityId && a.matchConfidence < 0.8
    );
    
    if (!hasLowConfidenceWeapon && !hasLowConfidenceAbility && unit.parsedDatasheet?.matchConfidence >= 0.8) {
      unit.needsReview = false;
    }
  }

  if (improvementCount > 0) {
    console.log(`Post-processing improved ${improvementCount} weapon matches`);
  }

  return parsedList;
}

// Post-process wargear matches - match against the unit's specific datasheet wargear only
function postProcessWargearMatches(
  parsedList: ParsedArmyList,
  availableDatasheets: any[]
): ParsedArmyList {
  // Build a map of datasheet ID -> wargear abilities for quick lookup
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
    
    // Only process if we have a matched datasheet
    const datasheetId = unit.parsedDatasheet?.datasheetId;
    if (!datasheetId) continue;
    
    // Get wargear options for this specific datasheet
    const validWargear = datasheetWargear.get(datasheetId);
    if (!validWargear || validWargear.length === 0) continue;
    
    for (const ability of unit.abilities) {
      // Only process wargear type abilities
      if (ability.type !== 'wargear') continue;
      
      // Skip if already has a valid match to this datasheet's wargear
      if (ability.abilityId && ability.matchConfidence >= 0.8) {
        if (validWargear.some(w => w.id === ability.abilityId)) {
          continue;
        }
      }
      
      // Try to find a match by name against this datasheet's wargear
      const searchName = ability.name
        .toLowerCase()
        .replace(/^terminator\s+/i, '') // Normalize "Terminator Storm Shield" → "storm shield"
        .replace(/\s+/g, ' ')
        .trim();
      
      // Find matching wargear from this datasheet
      const match = validWargear.find(w => {
        const wargearName = w.name.toLowerCase().trim();
        const normalizedWargear = wargearName.replace(/^terminator\s+/i, '').trim();
        
        return wargearName === searchName || 
               normalizedWargear === searchName ||
               wargearName.includes(searchName) ||
               searchName.includes(normalizedWargear);
      });
      
      if (match) {
        // Update the ability with the match
        const wasUnmatched = !ability.abilityId || ability.matchConfidence < 0.5;
        ability.abilityId = match.id;
        ability.matchConfidence = 0.95;
        ability.needsReview = false;
        
        // Copy description if available
        if (match.description) {
          ability.description = match.description;
        }
        
        if (wasUnmatched) {
          improvementCount++;
          console.log(`Post-process wargear: Matched "${ability.name}" → "${match.name}" (${match.id}) for ${unit.name}`);
        }
      }
    }
    
    // Recalculate unit needsReview
    const hasLowConfidenceWeapon = unit.weapons?.some((w: any) => 
      !w.weaponId || w.matchConfidence < 0.8
    );
    const hasLowConfidenceAbility = unit.abilities?.some((a: any) => 
      !a.abilityId && a.matchConfidence < 0.8
    );
    
    if (!hasLowConfidenceWeapon && !hasLowConfidenceAbility && unit.parsedDatasheet?.matchConfidence >= 0.8) {
      unit.needsReview = false;
    }
  }

  if (improvementCount > 0) {
    console.log(`Post-processing improved ${improvementCount} wargear matches`);
  }

  return parsedList;
}

// Post-process composition to apply wargear wound effects from datasheet abilities
function postProcessWargearWounds(
  parsedList: ParsedArmyList,
  availableDatasheets: any[]
): ParsedArmyList {
  // Build a map of datasheet ID -> wargear wound effects
  const datasheetWargearEffects = new Map<string, Map<string, number>>();
  
  for (const datasheet of availableDatasheets) {
    if (!datasheet.abilities || !Array.isArray(datasheet.abilities)) continue;
    
    const wargearEffects = new Map<string, number>();
    for (const da of datasheet.abilities) {
      if (da.ability?.type !== 'wargear') continue;
      
      const desc = da.ability.description || '';
      // Match patterns like "Wounds characteristic of 4" or "has a Wounds characteristic of 4"
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
    
    // Find base wounds from datasheet
    const baseWounds = unit.parsedDatasheet?.wounds || 1;
    
    // Check if composition exists and update woundsPerModel based on wargear
    if (unit.composition && Array.isArray(unit.composition)) {
      for (const comp of unit.composition) {
        // Check if this composition entry has wargear that modifies wounds
        const weapons = comp.weapons || [];
        let modifiedWounds = baseWounds;
        
        for (const weaponName of weapons) {
          const normalizedName = weaponName.toLowerCase();
          // Check if any wargear effect matches
          for (const [wargearName, woundsValue] of wargearEffects) {
            if (normalizedName.includes(wargearName) || wargearName.includes(normalizedName)) {
              modifiedWounds = woundsValue;
              break;
            }
          }
        }
        
        // Also check unit-level wargear array
        if (unit.wargear && Array.isArray(unit.wargear)) {
          for (const wargearItem of unit.wargear) {
            const normalizedItem = wargearItem.toLowerCase();
            for (const [wargearName, woundsValue] of wargearEffects) {
              if (normalizedItem.includes(wargearName) || wargearName.includes(normalizedItem)) {
                // Check if this wargear is in this composition's weapons list
                if (weapons.some(w => w.toLowerCase().includes(wargearName) || wargearName.includes(w.toLowerCase()))) {
                  modifiedWounds = woundsValue;
                  break;
                }
              }
            }
          }
        }
        
        // Update woundsPerModel if we found a modification and it differs from current
        if (modifiedWounds !== comp.woundsPerModel) {
          console.log(`Adjusting ${unit.name} ${comp.role} wounds: ${comp.woundsPerModel} -> ${modifiedWounds} (wargear effect)`);
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

// Post-process to normalize faction and detachment names
function postProcessFactionNormalization(
  parsedList: ParsedArmyList
): ParsedArmyList {
  const originalFaction = parsedList.detectedFaction;
  
  // Normalize the detected faction name
  if (originalFaction) {
    const normalizedFaction = normalizeFactionName(originalFaction);
    if (normalizedFaction && normalizedFaction !== originalFaction) {
      console.log(`Faction normalization: "${originalFaction}" → "${normalizedFaction}"`);
      parsedList.detectedFaction = normalizedFaction;
    }
  }
  
  return parsedList;
}

// Helper to parse army list with OpenAI Responses API and Structured Outputs
async function parseArmyListWithAI(
  content: string,
  contentType: 'text' | 'image',
  availableDatasheets: any[],
  trace?: any // Optional Langfuse trace for LLM cost tracking
): Promise<ParsedArmyList> {
  // Sort datasheets alphabetically to help AI find exact matches more easily
  const sortedDatasheets = [...availableDatasheets].sort((a, b) => 
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  // Build structured context for each datasheet with weapons and abilities
  const datasheetContext = sortedDatasheets.map(d => {
    const keywords = JSON.parse(d.keywords);
    
    // Build weapons list with IDs
    let weaponsList = '';
    if (d.weapons && Array.isArray(d.weapons) && d.weapons.length > 0) {
      const weaponLines = d.weapons.map((dw: any) => {
        const w = dw.weapon;
        const abilities = w.abilities ? JSON.parse(w.abilities) : [];
        return `    [${w.id}] ${w.name} | ${w.range} | ${w.type} | S${w.strength} AP${w.armorPenetration} D${w.damage}${abilities.length > 0 ? ` | ${abilities.join(', ')}` : ''}`;
      });
      weaponsList = `\n  WEAPONS:\n${weaponLines.join('\n')}`;
    }
    
    // Build abilities list with IDs (separated by type)
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
          // Check if it modifies wounds
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
    
    // Include points tiers if available
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
    
    // Build composition data info for multi-model-type units
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
    
    // Include ID directly in the name line to make matching unambiguous
    return `[${d.id}] DATASHEET: "${d.name}" (${pointsInfo})
  Faction: ${d.faction}${d.subfaction ? ` (${d.subfaction})` : ''} | Role: ${d.role}
  Stats: M:${d.movement} T:${d.toughness} SV:${d.save} W:${d.wounds} LD:${d.leadership} OC:${d.objectiveControl}
  Keywords: ${keywords.join(', ')}${compositionInfo}${weaponsList}${abilitiesList}`;
  }).join('\n\n');

  // Load detachment context
  const detachmentContext = await loadKnownDetachments();

  const systemPrompt = `You are an expert at parsing Warhammer 40K 10th Edition army lists. 
Your job is to extract structured unit data from army list documents and match them to available datasheets.

Each datasheet below contains its specific WEAPONS and ABILITIES with their IDs. 
When matching, use ONLY the weapons and abilities listed under the matched datasheet.

${detachmentContext}

AVAILABLE DATASHEETS (sorted alphabetically):
${datasheetContext}

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
- Use the KNOWN DETACHMENTS list above to validate your choice
- Space Wolves-specific detachments include: Saga of the Great Wolf, Saga of the Hunter, Saga of the Beastslayer, Champions of Fenris

CRITICAL: DUPLICATE UNITS ARE VALID
- Army lists frequently contain multiple instances of the same unit type
- Each instance is a SEPARATE unit - do NOT merge units with the same name
- Example: If "Blood Claws (135 Points)" appears twice → output TWO separate Blood Claws entries

CRITICAL: WARGEAR VS WEAPONS
- WEAPONS have attack profiles (Range, Attacks, Strength, AP, Damage) - listed under WEAPONS:
- WARGEAR provides passive bonuses (invulnerable saves, wound modifiers) - listed under ABILITIES: with (wargear) type
- Check the datasheet's ABILITIES section for wargear like "Storm Shield (wargear)"
- Put wargear in the abilities array with type: "wargear", NOT in weapons array

CRITICAL: WEAPON MATCHING
- Match weapons from the army list to the WEAPONS listed under the matched datasheet
- Use the exact ID shown in brackets: [abc123-...] Storm bolter → weaponId: "abc123-..."
- If army list says "Storm bolter" and datasheet has "[abc123] Storm bolter | 24" | ..." → use that ID
- For weapons with variants (Axe Morkai), prefer "strike" or "standard" profiles

CONFIDENCE SCORING:
- 1.0 = exact name match with ID from datasheet
- 0.9 = close match (minor spelling difference, variant profile)
- 0.5-0.8 = uncertain match
- 0.0 = no match found (set ID to null, needsReview: true)

WARGEAR WOUND MODIFIERS:
- Check ABILITIES section for wargear with "W=N" notation (e.g., "Storm Shield (wargear) - W=4")
- This means models with that wargear have modified wounds
- Example: Wolf Guard Terminators base 3W, but Storm Shield gives W=4
- Apply modified wounds in composition for models carrying that wargear

CRITICAL: COMPOSITION WITH MODEL TYPES
- Check the COMPOSITION line for each datasheet - it shows model types and wounds
- For units with multiple model types, create SEPARATE composition entries for each type
- Use the exact model type name from COMPOSITION for the "modelType" field
- Example: Wolf Guard Headtakers has "Wolf Guard Headtaker (3W), Hunting Wolf (1W)"
  If army list shows 6 Headtakers + 6 Wolves, output:
  composition: [
    { "modelType": "Wolf Guard Headtaker", "role": "regular", "count": 6, "weapons": [...], "woundsPerModel": 3 },
    { "modelType": "Hunting Wolf", "role": "regular", "count": 6, "weapons": ["Teeth and claws"], "woundsPerModel": 1 }
  ]
- For simple units with one model type, use the unit name (e.g., "Intercessor", "Terminator")
- Count models of each type separately from the army list

For each unit, extract:
- Match to datasheet by name → use datasheet ID
- Match weapons using IDs from that datasheet's WEAPONS section
- Match abilities using IDs from that datasheet's ABILITIES section  
- Build composition with correct modelType and woundsPerModel (use COMPOSITION data from datasheet)

IMPORTANT: Count each unit occurrence separately. Two "Blood Claws" entries = two objects in output.

Return structured data matching the exact schema provided.`;

  // Get configured provider
  const provider = getArmyParseProvider();
  const modelName = getArmyParseModel(provider);
  
  console.log(`🤖 Army Parse Provider: ${provider.toUpperCase()}`);
  console.log(`📊 Model: ${modelName}`);
  
  // Validate provider config
  validateProviderConfig(provider);

  let parsed: any;

  if (provider === 'google') {
    // ============================================
    // GEMINI 3 FLASH PATHWAY
    // ============================================
    
    // Build content for Gemini
    let geminiContent: any;
    
    if (contentType === 'image') {
      // Extract base64 data from data URL
      const base64Match = content.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid image data URL format');
      }
      const mimeType = base64Match[1];
      const base64Data = base64Match[2];
      
      geminiContent = [
        {
          text: 'Parse this Warhammer 40K army list image and extract all units with their datasheets, weapons, and abilities.',
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ];
    } else {
      geminiContent = `Parse this Warhammer 40K army list and extract all units with their datasheets, weapons, and abilities:\n\n${content}`;
    }

    // Create Langfuse generation for LLM cost tracking if trace provided
    const generation = trace?.generation({
      name: "gemini-army-parse",
      model: 'gemini-3-flash-preview',
      input: [
        { role: 'system', content: systemPrompt.substring(0, 500) + '...(truncated)' },
        { role: 'user', content: contentType === 'text' ? content.substring(0, 500) + '...' : '[image content]' }
      ],
      metadata: {
        provider: 'google',
        contentType,
        datasheetCount: sortedDatasheets.length,
        thinkingLevel: 'low',
        maxOutputTokens: 32768,
      }
    });

    // Gemini 3 Flash: use low thinking for structured JSON extraction
    const geminiResponse = await gemini.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: geminiContent,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingLevel: 'low' } as any, // Low thinking for extraction tasks
        maxOutputTokens: 32768, // 32K tokens - army lists with full datasheet data need more space
        responseMimeType: 'application/json',
        responseSchema: ARMY_LIST_SCHEMA,
      },
    });

    // Extract text from Gemini response, filtering out thinking parts
    // Gemini 3 returns parts with thought=true for thinking content - we only want the actual response
    // Parts with thoughtSignature but no text should be skipped
    // See: https://ai.google.dev/gemini-api/docs/thinking & https://ai.google.dev/gemini-api/docs/thought-signatures
    let responseText = '';
    const candidates = (geminiResponse as any).candidates;

    // Check for truncation - finishReason should be 'STOP', not 'MAX_TOKENS'
    const finishReason = candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`⚠️ Gemini response may be truncated. finishReason: ${finishReason}`);
    }

    if (candidates?.[0]?.content?.parts) {
      // Debug: log part structure to understand what we're getting
      const partTypes = candidates[0].content.parts.map((p: any) => ({
        hasText: !!p.text,
        textLength: p.text?.length || 0,
        hasThought: p.thought === true,
        hasThoughtSignature: !!p.thoughtSignature,
      }));
      console.log('📝 Response parts:', JSON.stringify(partTypes));

      // Filter out thinking parts (part.thought === true) and extract only model response
      for (const part of candidates[0].content.parts) {
        // Skip thinking parts - only include actual response content
        if (part.thought === true) {
          continue;
        }
        // Also skip parts that only have thoughtSignature but no text
        if (part.thoughtSignature && !part.text) {
          continue;
        }
        if (part.text) {
          responseText += part.text;
        }
      }
    }

    // Fallback to .text if no candidates found (shouldn't happen but be safe)
    if (!responseText) {
      console.warn('⚠️ No responseText extracted from parts, falling back to .text');
      responseText = geminiResponse.text || '{}';
    }

    console.log(`📊 Extracted response length: ${responseText.length} chars`);

    // Extract token usage for Langfuse cost tracking
    const geminiUsage = {
      input: (geminiResponse as any).usageMetadata?.promptTokenCount || 0,
      output: (geminiResponse as any).usageMetadata?.candidatesTokenCount || 0,
      total: (geminiResponse as any).usageMetadata?.totalTokenCount || 0
    };
    console.log(`📊 Army parse token usage: ${geminiUsage.input} input, ${geminiUsage.output} output, ${geminiUsage.total} total`);

    // Update Langfuse generation with output and usage
    if (generation) {
      generation.update({
        output: responseText.substring(0, 1000) + (responseText.length > 1000 ? '...(truncated)' : ''),
        metadata: {
          responseLength: responseText.length,
          finishReason,
        }
      });
      // End generation with token usage for cost calculation
      generation.end({
        usage: geminiUsage.total > 0 ? {
          input: geminiUsage.input,
          output: geminiUsage.output,
          total: geminiUsage.total
        } : undefined
      });
    }

    // Parse the JSON response
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // If parse fails, log diagnostic info
      console.error('❌ Failed to parse Gemini response as JSON');
      console.error('   finishReason:', finishReason);
      console.error('   responseText length:', responseText.length);
      console.error('   First 500 chars:', responseText.substring(0, 500));
      console.error('   Last 500 chars:', responseText.substring(responseText.length - 500));
      // End generation with error if it exists
      if (generation) {
        generation.end({ level: "ERROR", statusMessage: "JSON parse error" });
      }
      throw parseError;
    }
    
  } else {
    // ============================================
    // OPENAI PATHWAY (default)
    // ============================================
    
    let input: any[];

    if (contentType === 'image') {
      input = [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Parse this Warhammer 40K army list image and extract all units with their datasheets, weapons, and abilities.',
            },
            {
              type: 'input_image',
              image_url: content, // base64 data URL
              detail: 'high',
            },
          ],
        },
      ];
    } else {
      input = [
        {
          role: 'user',
          content: `Parse this Warhammer 40K army list and extract all units with their datasheets, weapons, and abilities:\n\n${content}`,
        },
      ];
    }

    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: systemPrompt,
      input,
      reasoning: {
        effort: 'low' // Good balance for structured parsing
      },
      text: {
        format: {
          type: 'json_schema',
          name: 'army_list_parse',
          schema: ARMY_LIST_SCHEMA,
          strict: true,
        },
        verbosity: 'low' // Concise output
      },
    });

    parsed = JSON.parse(response.output_text || '{}');
  }
  
  console.log('AI Parse Response:', JSON.stringify(parsed, null, 2));
  
  return parsed as ParsedArmyList;
}

export async function POST(request: NextRequest) {
  // Declare trace outside try block for error handling access
  let trace: any = null;

  try {
    // Require authentication
    const user = await requireAuth();

    // Rate limiting
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.parseArmy);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many army parsing requests. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.parseArmy.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }
    
    // Create Langfuse trace for this parse request
    trace = langfuse.trace({
      name: "parse-army-list",
      userId: user.id,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const factionIdParam = formData.get('factionId') as string | null;
    const factionName = formData.get('factionName') as string | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Resolve factionId if missing but name provided
    let targetFactionId = factionIdParam;
    if (!targetFactionId && factionName) {
       const f = await prisma.faction.findFirst({
         where: { name: { equals: factionName, mode: 'insensitive' } }
       });
       if (f) targetFactionId = f.id;
    }

    trace.update({
      metadata: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        factionId: targetFactionId,
        factionName,
      },
      tags: ['army-parse', file.type, factionName || 'unknown-faction']
    });

    // Get file type and content
    const fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content: string;
    let contentType: 'text' | 'image' = 'text';

    // Handle different file types
    if (fileType.startsWith('image/')) {
      // Convert image to base64 data URL
      const base64 = buffer.toString('base64');
      content = `data:${fileType};base64,${base64}`;
      contentType = 'image';
    } else if (fileType === 'application/pdf') {
      // Extract text from PDF
      const pdfSpan = trace.span({
        name: "extract-pdf-text",
      });
      content = await extractTextFromPDF(buffer);
      pdfSpan.end();
    } else if (fileType === 'text/plain') {
      // Plain text
      content = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Fetch all available datasheets, weapons, and abilities from database
    const dbSpan = trace.span({
      name: "fetch-game-data",
    });
    
    // Build faction filter - include parent faction for subfactions (like Space Wolves + Space Marines)
    let factionFilter: any = {};
    let forbiddenKeywords: string[] = [];

    if (targetFactionId) {
      // Get faction and check for parent
      const faction = await prisma.faction.findUnique({
        where: { id: targetFactionId },
        include: { parentFaction: true }
      });
      
      if (faction) {
        // Include this faction and parent faction (if exists)
        const factionIds = [faction.id];
        if (faction.parentFactionId) {
          factionIds.push(faction.parentFactionId);
        }
        factionFilter = { factionId: { in: factionIds } };

        // Get forbidden keywords
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
        leaderRules: true,      // Who this character can attach to
        leaderAbilities: true,  // Abilities granted when leading
        weapons: {
          include: {
            weapon: {
              select: {
                id: true,
                name: true,
                range: true,
                type: true,
                attacks: true,
                strength: true,
                armorPenetration: true,
                damage: true,
                abilities: true,
              },
            },
          },
        },
        abilities: {
          include: {
            ability: {
              select: {
                id: true,
                name: true,
                type: true,
                description: true,
              },
            },
          },
        },
      },
    });

    // Filter datasheets by forbidden keywords
    const validDatasheets = datasheets.filter(d => {
       if (forbiddenKeywords.length === 0) return true;
       try {
         const kws = JSON.parse(d.keywords);
         return !forbiddenKeywords.some(fk => kws.includes(fk));
       } catch (e) { return true; }
    });

    // Count total weapons and abilities across all datasheets
    const totalWeapons = validDatasheets.reduce((sum, d) => sum + (d.weapons?.length || 0), 0);
    const totalAbilities = validDatasheets.reduce((sum, d) => sum + (d.abilities?.length || 0), 0);

    dbSpan.end({
      output: {
        datasheetCount: validDatasheets.length,
        weaponCount: totalWeapons,
        abilityCount: totalAbilities,
        forbiddenKeywordsCount: forbiddenKeywords.length
      }
    });

    console.log(`Loaded ${validDatasheets.length} datasheets (filtered from ${datasheets.length}) with ${totalWeapons} weapons and ${totalAbilities} abilities`);

    // Parse the army list with AI
    const parseSpan = trace.span({
      name: "ai-parse-army-list",
      input: {
        contentType,
        // Full content for text, indicator for images
        content: contentType === 'text' ? content : '[image - base64]',
        // Full list of available datasheets sent to AI
        availableDatasheets: validDatasheets.map(d => ({
          id: d.id,
          name: d.name,
          faction: d.faction,
          subfaction: d.subfaction,
          role: d.role,
          pointsCost: d.pointsCost,
          weaponCount: d.weapons?.length || 0,
          abilityCount: d.abilities?.length || 0,
        })),
        datasheetCount: validDatasheets.length,
        weaponCount: totalWeapons,
        abilityCount: totalAbilities,
      }
    });

    let parsedList = await parseArmyListWithAI(
      content,
      contentType,
      validDatasheets,
      trace // Pass trace for Langfuse LLM cost tracking
    );

    // Post-process to normalize faction names (e.g., "Space Marines (Space Wolves)" → "Space Wolves")
    const factionNormSpan = trace.span({
      name: "post-process-faction-normalization",
      input: { originalFaction: parsedList.detectedFaction }
    });
    parsedList = postProcessFactionNormalization(parsedList);
    factionNormSpan.end({
      output: { normalizedFaction: parsedList.detectedFaction }
    });

    // Capture pre-post-process state for comparison
    const prePostProcessWeapons = parsedList.units.map(u => ({
      unit: u.name,
      weapons: u.weapons?.map((w: any) => ({ name: w.name, id: w.weaponId, confidence: w.matchConfidence })) || []
    }));

    // Post-process to improve weapon matching
    const postProcessSpan = trace.span({
      name: "post-process-weapons",
      input: { preState: prePostProcessWeapons }
    });
    parsedList = postProcessWeaponMatches(parsedList, validDatasheets);
    const postPostProcessWeapons = parsedList.units.map(u => ({
      unit: u.name,
      weapons: u.weapons?.map((w: any) => ({ name: w.name, id: w.weaponId, confidence: w.matchConfidence })) || []
    }));
    postProcessSpan.end({
      output: { 
        postState: postPostProcessWeapons,
        changesDetected: JSON.stringify(prePostProcessWeapons) !== JSON.stringify(postPostProcessWeapons)
      }
    });

    // Capture pre-wargear-match state
    const preWargearMatch = parsedList.units.map(u => ({
      unit: u.name,
      abilities: u.abilities?.map((a: any) => ({ name: a.name, id: a.abilityId, type: a.type, confidence: a.matchConfidence })) || []
    }));

    // Post-process to improve wargear matching
    const wargearMatchSpan = trace.span({
      name: "post-process-wargear-matches",
      input: { preState: preWargearMatch }
    });
    parsedList = postProcessWargearMatches(parsedList, validDatasheets);
    const postWargearMatch = parsedList.units.map(u => ({
      unit: u.name,
      abilities: u.abilities?.map((a: any) => ({ name: a.name, id: a.abilityId, type: a.type, confidence: a.matchConfidence })) || []
    }));
    wargearMatchSpan.end({
      output: { 
        postState: postWargearMatch,
        changesDetected: JSON.stringify(preWargearMatch) !== JSON.stringify(postWargearMatch)
      }
    });

    // Capture pre-wargear-wounds state
    const preWargearWounds = parsedList.units.map(u => ({
      unit: u.name,
      composition: u.composition
    }));

    // Post-process to apply wargear wound effects
    const wargearSpan = trace.span({
      name: "post-process-wargear-wounds",
      input: { preState: preWargearWounds }
    });
    parsedList = postProcessWargearWounds(parsedList, validDatasheets);
    const postWargearWounds = parsedList.units.map(u => ({
      unit: u.name,
      composition: u.composition
    }));
    wargearSpan.end({
      output: { 
        postState: postWargearWounds,
        changesDetected: JSON.stringify(preWargearWounds) !== JSON.stringify(postWargearWounds)
      }
    });

    // Build detailed unit match info for logging
    const unitMatchDetails = parsedList.units.map(u => ({
      inputName: u.name,
      matchedDatasheet: u.parsedDatasheet?.name || null,
      matchedDatasheetId: u.parsedDatasheet?.datasheetId || null,
      matchConfidence: u.parsedDatasheet?.matchConfidence || 0,
      needsReview: u.needsReview,
      weaponCount: u.weapons?.length || 0,
      unmatchedWeapons: u.weapons?.filter((w: any) => !w.weaponId).map((w: any) => w.name) || [],
      abilityCount: u.abilities?.length || 0,
      unmatchedAbilities: u.abilities?.filter((a: any) => !a.abilityId).map((a: any) => a.name) || [],
    }));

    // Identify problem matches for quick reference
    const problemMatches = unitMatchDetails.filter(u => 
      u.matchConfidence < 1.0 || 
      u.unmatchedWeapons.length > 0 || 
      u.unmatchedAbilities.length > 0
    );

    parseSpan.end({
      output: {
        faction: parsedList.detectedFaction,
        detachment: parsedList.detectedDetachment,
        points: parsedList.detectedPointsLimit,
        unitCount: parsedList.units.length,
        confidence: parsedList.parsingConfidence,
        unitsWithMatches: parsedList.units.filter(u => u.parsedDatasheet.datasheetId).length,
        unitsNeedingReview: parsedList.units.filter(u => u.needsReview).length,
        // Full unit match details
        unitMatches: unitMatchDetails,
        // Quick reference to problems
        problemMatches,
      }
    });

    trace.update({
      output: {
        faction: parsedList.detectedFaction,
        detachment: parsedList.detectedDetachment,
        totalUnits: parsedList.units.length,
        matchedUnits: parsedList.units.filter(u => u.parsedDatasheet.datasheetId).length,
        needsReview: parsedList.units.filter(u => u.needsReview).length,
        // Include full parsed result for debugging
        parsedUnits: parsedList.units,
        problemMatches,
      }
    });

    // Return the parsed structure
    return NextResponse.json(parsedList);
  } catch (error) {
    console.error('Error parsing army list:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Log error to trace if it was created
    if (trace) {
      trace.update({
        output: {
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          status: 'ERROR'
        }
      });
    }

    return NextResponse.json(
      { error: 'Failed to parse army list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
