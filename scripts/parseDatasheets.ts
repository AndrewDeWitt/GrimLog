/**
 * LLM-Powered Datasheet Parser
 * 
 * Uses Gemini 3 Flash with structured outputs 
 * to parse Wahapedia HTML into normalized database records.
 * 
 * Features:
 * - Gemini 3 Flash model (fast, cheap, accurate)
 * - Parallel processing (3 concurrent requests with batching)
 * - Smart caching (skip already-parsed datasheets)
 * - Structured outputs with JSON schema validation
 * - Real-time progress bar with stats
 * - Command-line flags (--override-all, --retry-failed)
 * - Zod validation for double-checking
 * 
 * Performance:
 * - Fast parallel processing
 * - Near-instant for cached runs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

// Load environment variables from .env files
dotenv.config({ path: '.env.local' });
dotenv.config();

const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const PARSED_DIR = path.join(process.cwd(), 'data', 'parsed-datasheets');

// Zod schemas for validation
const WeaponSchema = z.object({
  name: z.string().describe('The name of the weapon'),
  range: z.string().describe('Weapon range (e.g., "24\\"", "Melee")'),
  type: z.string().describe('Weapon type (e.g., "Assault 2", "Heavy D6", "Melee")'),
  attacks: z.string().describe('Number of attacks (e.g., "2", "D6", "3")'),
  ballisticSkill: z.string().describe('Ballistic Skill for ranged weapons, or empty string for melee (e.g., "3+", "4+", "")'),
  weaponSkill: z.string().describe('Weapon Skill for melee weapons, or empty string for ranged (e.g., "3+", "4+", "")'),
  strength: z.string().describe('Strength value (e.g., "4", "8", "User")'),
  armorPenetration: z.string().describe('Armor Penetration (e.g., "0", "-1", "-3")'),
  damage: z.string().describe('Damage value (e.g., "1", "2", "D6")'),
  abilities: z.array(z.string()).describe('Array of weapon abilities in UPPERCASE'),
});

// Wargear stat effects for equipment that modifies characteristics (must be defined before AbilitySchema)
const WargearEffectSchema = z.object({
  wounds: z.number().nullable().describe('Modified wounds value (e.g., Relic Shield sets wounds to 6), or null if not modified'),
  toughness: z.number().nullable().describe('Modified toughness value, or null if not modified'),
  save: z.string().nullable().describe('Modified save characteristic, or null if not modified'),
  invulnerableSave: z.string().nullable().describe('Granted invulnerable save (e.g., Storm Shield grants "4+"), or null if not modified'),
  movement: z.string().nullable().describe('Modified movement characteristic, or null if not modified'),
});

const AbilitySchema = z.object({
  name: z.string().describe('The name of the ability'),
  type: z.enum(['core', 'faction', 'unit', 'leader', 'wargear']).describe('Type of ability'),
  description: z.string().describe('Full text description of the ability'),
  triggerPhase: z.array(z.string()).describe('Array of phases when ability can be used. Use phase names ["Command", "Movement", "Shooting", "Charge", "Fight"] for phase-specific abilities, ["Any"] for phase-relevant auras/effects, ["Deployment"] for deployment abilities (Deep Strike, Scout), ["Keyword"] for keyword abilities (Leader, Stealth), or ["General"] for general rules not tied to phases'),
  triggerSubphase: z.string().describe('Specific timing: "Start of Phase", "During Action", "End of Phase", or "" if not specified'),
  isReactive: z.boolean().describe('Can be used during opponent\'s turn (e.g., Overwatch, Counter-offensive)'),
  requiredKeywords: z.array(z.string()).describe('Array of required keywords for the ability to apply, or empty array if none'),
  effects: WargearEffectSchema.nullable().describe('For wargear abilities: structured stat modifications. For non-wargear abilities: null'),
});

const WargearOptionSchema = z.object({
  description: z.string().describe('Description of the wargear option'),
  pointsCost: z.number().describe('Additional points cost, use 0 if not specified'),
});

// Composition data for accurate wound tracking
const CompositionEntrySchema = z.object({
  name: z.string().describe('Model type name (e.g., "Ravener Prime", "Terminator", "Captain")'),
  role: z.enum(['leader', 'regular']).describe('Role: "leader" for characters/sergeants/primes/champions, "regular" for standard models/vehicles/monsters'),
  count: z.number().describe('Number of models of this type in the unit'),
  woundsPerModel: z.number().describe('Wounds characteristic for this model type'),
});

const DatasheetSchema = z.object({
  name: z.string().describe('Unit name'),
  faction: z.string().describe('Primary faction (e.g., "Space Marines", "Tyranids")'),
  subfaction: z.string().describe('Subfaction if applicable, or empty string (e.g., "Space Wolves", "Blood Angels", "")'),
  role: z.string().describe('Unit role (e.g., "Character", "Battleline", "Elites")'),
  keywords: z.array(z.string()).describe('Array of keywords in UPPERCASE'),
  stats: z.object({
    movement: z.string().describe('Movement characteristic with quotes (e.g., "6\\"")'),
    toughness: z.number().describe('Toughness value (1-12)'),
    save: z.string().describe('Save characteristic (e.g., "3+", "4+")'),
    invulnerableSave: z.string().describe('Invulnerable save if present, or empty string if none (e.g., "4+", "5+", "")'),
    wounds: z.number().describe('Wounds characteristic'),
    leadership: z.number().describe('Leadership value'),
    objectiveControl: z.number().describe('Objective Control value'),
  }),
  composition: z.string().describe('Unit composition (e.g., "1 Captain", "5-10 Intercessors")'),
  compositionData: z.array(CompositionEntrySchema).describe('Structured unit composition with wounds per model type for accurate wound tracking'),
  unitSize: z.string().describe('Unit size range, or empty string (e.g., "1", "5-10", "")'),
  leaderRules: z.string().describe('Leader attachment rules if applicable, or empty string'),
  leaderAbilities: z.string().describe('Abilities granted when leading, or empty string'),
  transportCapacity: z.string().describe('Transport capacity if applicable, or empty string'),
  weapons: z.array(WeaponSchema).describe('Array of weapons with full profiles'),
  abilities: z.array(AbilitySchema).describe('Array of abilities'),
  wargearOptions: z.array(WargearOptionSchema).describe('Array of wargear options, or empty array if none'),
  pointsCost: z.number().describe('Base points cost (minimum unit size)'),
  pointsTiers: z.array(z.object({
    models: z.number().describe('Number of models'),
    points: z.number().describe('Points cost for this model count'),
  })).optional().describe('Points tiers for variable-size units (e.g., 5 models = 170pts, 10 models = 340pts)'),
});

type ParsedDatasheet = z.infer<typeof DatasheetSchema>;

// Initialize Gemini client
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Model to use - Gemini 3 Flash Preview (fast and cheap)
const PARSER_MODEL = 'gemini-3-flash-preview';

// JSON Schema for OpenAI Responses API structured outputs
const datasheetJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Unit name' },
    faction: { type: 'string', description: 'Primary faction (e.g., "Space Marines", "Tyranids")' },
    subfaction: { type: 'string', description: 'Subfaction if applicable (e.g., "Space Wolves", "Blood Angels")' },
    role: { type: 'string', description: 'Unit role (e.g., "Character", "Battleline", "Elites")' },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of keywords in UPPERCASE'
    },
    stats: {
      type: 'object',
      properties: {
        movement: { type: 'string', description: 'Movement characteristic with quotes (e.g., "6\\"")' },
        toughness: { type: 'number', description: 'Toughness value (1-12)' },
        save: { type: 'string', description: 'Save characteristic (e.g., "3+", "4+")' },
        invulnerableSave: { type: 'string', description: 'Invulnerable save if present, or empty string if none (e.g., "4+", "5+", "")' },
        wounds: { type: 'number', description: 'Wounds characteristic' },
        leadership: { type: 'number', description: 'Leadership value' },
        objectiveControl: { type: 'number', description: 'Objective Control value' }
      },
      required: ['movement', 'toughness', 'save', 'invulnerableSave', 'wounds', 'leadership', 'objectiveControl'],
      additionalProperties: false
    },
    composition: { type: 'string', description: 'Unit composition (e.g., "1 Captain", "5-10 Intercessors")' },
    compositionData: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Model type name (e.g., "Ravener Prime", "Terminator", "Captain")' },
          role: { 
            type: 'string', 
            enum: ['leader', 'regular'],
            description: 'Role: "leader" for characters/sergeants/primes/champions, "regular" for standard models/vehicles/monsters'
          },
          count: { type: 'number', description: 'Number of models of this type in the unit' },
          woundsPerModel: { type: 'number', description: 'Wounds characteristic for this model type' }
        },
        required: ['name', 'role', 'count', 'woundsPerModel'],
        additionalProperties: false
      },
      description: 'Structured unit composition with wounds per model type for accurate wound tracking'
    },
    unitSize: { type: 'string', description: 'Unit size range (e.g., "1", "5-10")' },
    leaderRules: { type: 'string', description: 'Leader attachment rules if applicable' },
    leaderAbilities: { type: 'string', description: 'Abilities granted when leading' },
    transportCapacity: { type: 'string', description: 'Transport capacity if applicable' },
    weapons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The name of the weapon' },
          range: { type: 'string', description: 'Weapon range (e.g., "24\\"", "Melee")' },
          type: { type: 'string', description: 'Weapon type (e.g., "Assault 2", "Heavy D6", "Melee")' },
          attacks: { type: 'string', description: 'Number of attacks (e.g., "2", "D6", "3")' },
          ballisticSkill: { type: 'string', description: 'Ballistic Skill for ranged weapons, or empty string for melee (e.g., "3+", "4+", "")' },
          weaponSkill: { type: 'string', description: 'Weapon Skill for melee weapons, or empty string for ranged (e.g., "3+", "4+", "")' },
          strength: { type: 'string', description: 'Strength value (e.g., "4", "8", "User")' },
          armorPenetration: { type: 'string', description: 'Armor Penetration (e.g., "0", "-1", "-3")' },
          damage: { type: 'string', description: 'Damage value (e.g., "1", "2", "D6")' },
          abilities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of weapon abilities in UPPERCASE'
          }
        },
        required: ['name', 'range', 'type', 'attacks', 'ballisticSkill', 'weaponSkill', 'strength', 'armorPenetration', 'damage', 'abilities'],
        additionalProperties: false
      },
      description: 'Array of weapons with full profiles'
    },
    abilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The name of the ability' },
          type: {
            type: 'string',
            enum: ['core', 'faction', 'unit', 'leader', 'wargear'],
            description: 'Type of ability'
          },
          description: { type: 'string', description: 'Full text description of the ability' },
          triggerPhase: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of phases when ability can be used. Use phase names ["Command", "Movement", "Shooting", "Charge", "Fight"] for phase-specific abilities, ["Any"] for phase-relevant auras/effects, ["Deployment"] for deployment abilities (Deep Strike, Scout), ["Keyword"] for keyword abilities (Leader, Stealth), or ["General"] for general rules not tied to phases'
          },
          triggerSubphase: { type: 'string', description: 'Specific timing: "Start of Phase", "During Action", "End of Phase", or "" if not specified' },
          isReactive: { type: 'boolean', description: 'Can be used during opponent\'s turn (e.g., Overwatch, Counter-offensive)' },
          requiredKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of required keywords for the ability to apply, or empty array if none'
          },
          effects: {
            type: ['object', 'null'],
            properties: {
              wounds: { type: ['number', 'null'], description: 'Modified wounds value (e.g., Relic Shield sets wounds to 6), or null if not modified' },
              toughness: { type: ['number', 'null'], description: 'Modified toughness value, or null if not modified' },
              save: { type: ['string', 'null'], description: 'Modified save characteristic, or null if not modified' },
              invulnerableSave: { type: ['string', 'null'], description: 'Granted invulnerable save (e.g., Storm Shield grants "4+"), or null if not modified' },
              movement: { type: ['string', 'null'], description: 'Modified movement characteristic, or null if not modified' }
            },
            required: ['wounds', 'toughness', 'save', 'invulnerableSave', 'movement'],
            additionalProperties: false,
            description: 'For wargear abilities: structured stat modifications (use null for unmodified stats). For non-wargear abilities: use null'
          }
        },
        required: ['name', 'type', 'description', 'triggerPhase', 'triggerSubphase', 'isReactive', 'requiredKeywords', 'effects'],
        additionalProperties: false
      },
      description: 'Array of abilities'
    },
    wargearOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Description of the wargear option' },
          pointsCost: { type: 'number', description: 'Additional points cost, use 0 if not specified' }
        },
        required: ['description', 'pointsCost'],
        additionalProperties: false
      },
      description: 'Array of wargear options'
    },
    pointsCost: { type: 'number', description: 'Base points cost (minimum unit size)' },
    pointsTiers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          models: { type: 'number', description: 'Number of models' },
          points: { type: 'number', description: 'Points cost for this model count' }
        },
        required: ['models', 'points'],
        additionalProperties: false
      },
      description: 'Points tiers for variable-size units (e.g., 5 models = 170pts, 10 models = 340pts). Extract from the points table in the datasheet.'
    }
  },
  required: [
    'name', 'faction', 'subfaction', 'role', 'keywords', 'stats', 'composition', 
    'compositionData', 'unitSize', 'leaderRules', 'leaderAbilities', 'transportCapacity',
    'weapons', 'abilities', 'wargearOptions', 'pointsCost', 'pointsTiers'
  ],
  additionalProperties: false
} as const;

/**
 * Extract points tiers from HTML (for variable-size units)
 * E.g., "5 models = 170pts, 10 models = 340pts"
 */
function extractPointsTiersFromHtml(html: string): Array<{models: number; points: number}> {
  const $ = cheerio.load(html);
  const tiers: Array<{models: number; points: number}> = [];
  
  // Find all PriceTag elements in tables
  $('table').each((_, table) => {
    const $table = $(table);
    
    // Check if this table contains PriceTag elements
    const priceTags = $table.find('.PriceTag');
    if (priceTags.length === 0) return;
    
    // Parse each row
    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td');
      
      if (cells.length >= 2) {
        const modelText = $(cells[0]).text().trim();
        const priceTag = $(cells[1]).find('.PriceTag');
        
        if (priceTag.length > 0) {
          // Parse model count from text like "5 models" or "1 model"
          const modelMatch = modelText.match(/(\d+)\s*models?/i);
          if (modelMatch) {
            const models = parseInt(modelMatch[1], 10);
            const points = parseInt(priceTag.text().trim(), 10);
            
            if (!isNaN(models) && !isNaN(points)) {
              tiers.push({ models, points });
            }
          }
        }
      }
    });
  });
  
  // Sort by model count ascending
  tiers.sort((a, b) => a.models - b.models);
  
  return tiers;
}

/**
 * Extract only relevant datasheet content from HTML
 * Strips out scripts, styles, navigation, ads, etc.
 * Reduces 2-3 MB HTML files to ~5-20 KB of relevant content
 */
function extractDatasheetContent(html: string): { content: string; pointsTiers: Array<{models: number; points: number}> } {
  const $ = cheerio.load(html);
  
  // Extract points tiers before removing elements
  const pointsTiers = extractPointsTiersFromHtml(html);
  
  // Remove all unnecessary elements globally
  $('script, style, noscript').remove();
  $('.page_ads, .NavBtn, .NavColumns, .tooltip_templates').remove();
  $('nav, header, footer, .settings, .search').remove();
  
  // Get the main datasheet wrapper - this contains everything we need
  const $datasheet = $('.dsOuterFrame, .datasheet').first();
  
  if ($datasheet.length === 0) {
    console.warn('⚠️ Could not find datasheet wrapper, using full body');
    return { content: $('body').text().substring(0, 20000), pointsTiers };
  }
  
  // Get just the datasheet content as text (all tables, abilities, etc.)
  const datasheetText = $datasheet.text();
  
  // Extract keywords from both KEYWORDS and FACTION KEYWORDS sections
  // These are in dsLeftСolKW (unit keywords) and dsRightСolKW (faction keywords)
  const keywords: string[] = [];

  // First, extract from tooltip wrapper spans which contain full keyword phrases (e.g., "SPACE WOLVES" not "SPACE" + "WOLVES")
  $('[class*="tooltip"]').each((_, tooltip) => {
    const $tooltip = $(tooltip);
    // Only process tooltips that contain .kwb elements (keyword tooltips)
    if ($tooltip.find('.kwb, .kwbu').length > 0) {
      const kw = $tooltip.text().trim().toUpperCase();
      if (kw && kw.length > 0 && kw.length < 50 && !keywords.includes(kw)) {
        keywords.push(kw);
      }
    }
  });

  // Fallback: also check individual .kwb elements that might not be in tooltips
  $('.kwb, .kwbo, .kwbu').each((_, el) => {
    const kw = $(el).text().trim().toUpperCase();
    if (kw && kw.length > 0 && kw.length < 50 && !keywords.includes(kw)) {
      keywords.push(kw);
    }
  });
  
  // Build structured output with points tiers info for the LLM
  const pointsTiersText = pointsTiers.length > 0 
    ? `\n=== POINTS TIERS ===\n${pointsTiers.map(t => `${t.models} models = ${t.points} pts`).join('\n')}`
    : '';
  
  const output = [
    `=== DATASHEET ===`,
    datasheetText,
    `\n=== KEYWORDS ===`,
    keywords.join(', '),
    pointsTiersText,
  ].join('\n');
  
  // Limit to reasonable size for LLM (max 15k chars ≈ 4k tokens)
  const truncated = output.substring(0, 15000);
  
  return { content: truncated, pointsTiers };
}

/**
 * Create system prompt for datasheet parsing
 */
function createParsingPrompt(): string {
  return `You are an expert at parsing Warhammer 40,000 10th Edition datasheets from HTML.

Your task is to extract ALL information from the datasheet HTML and structure it into a precise JSON format.

CRITICAL RULES:
1. Extract ALL weapons with complete profiles (range, type, attacks, BS/WS, strength, AP, damage, abilities)
2. For ranged weapons, include ballisticSkill (e.g., "3+", "4+") and weaponSkill as empty string ""
3. For melee weapons, include weaponSkill (e.g., "3+", "4+") and ballisticSkill as empty string ""
4. Extract ALL abilities with full descriptions
5. Classify abilities as: "core" (universal), "faction" (army-wide), "unit" (specific to this unit), "leader" (granted by leaders), or "wargear" (from equipment)
6. Extract composition (e.g., "1 Captain", "5-10 Intercessors")
7. Extract leader rules if it's a Character (who they can attach to)
8. CRITICAL: Extract ALL keywords from BOTH the "KEYWORDS:" section AND the "FACTION KEYWORDS:" section into the keywords array. This includes faction identifiers like ADEPTUS ASTARTES, SPACE WOLVES, TYRANIDS, etc. Keywords should be in UPPERCASE.
9. Points cost should be the base cost listed
10. Invulnerable save only if explicitly stated (format: "4+", "5+", etc.)

WEAPON ABILITIES:
- Extract all weapon abilities (e.g., "RAPID FIRE 2", "ANTI-INFANTRY 4+", "MELTA 2")
- Keep ability names in UPPERCASE as they appear

ABILITY TYPES:
- core: Deep Strike, Leader, Deadly Demise, Stealth, etc.
- faction: Oath of Moment, Synapse, Shadow in the Warp, etc.
- unit: Specific abilities unique to this unit
- leader: Abilities granted when leading units
- wargear: Abilities from specific equipment

ABILITY PHASE METADATA (IMPORTANT):
For each ability, you MUST analyze the description and extract phase-aware metadata:

triggerPhase (REQUIRED - array of strings):
- Analyze when the ability can be used based on its description
- Use phase names: "Command", "Movement", "Shooting", "Charge", "Fight" for phase-specific abilities
- For abilities with multiple triggers: include all relevant phases (e.g., ["Shooting", "Fight"])

SPECIAL PHASE VALUES (for non-phase-relevant abilities):
- ["Deployment"] - Abilities used ONLY during deployment/setup phase:
  * Deep Strike, DEEP STRIKE → ["Deployment"]
  * Scout, SCOUT → ["Deployment"]
  * Infiltrators, INFILTRATORS → ["Deployment"]
  * Strategic Reserves → ["Deployment"]
  
- ["Keyword"] - Keyword abilities that are always-on but NOT actionable in specific phases:
  * Leader, LEADER → ["Keyword"] (keyword, not phase-actionable)
  * Stealth, STEALTH → ["Keyword"] (passive keyword, not phase-actionable)
  
- ["General"] - General rules not tied to specific phases:
  * "Embarking within transports" → ["General"]
  * Other general rules that don't trigger in specific phases → ["General"]

- ["Any"] - ONLY for phase-relevant auras/effects that affect gameplay in phases:
  * Faction auras (Oath of Moment, Synapse) → ["Any"] (affects all phases)
  * Reactive abilities (Overwatch, Counter-offensive) → ["Any"] (can trigger in multiple phases)
  * Auras that modify stats/abilities during phases → ["Any"]
  * DO NOT use ["Any"] for deployment, keywords, or general rules

Examples:
  * "At the start of your Movement phase" → ["Movement"]
  * "When this unit shoots" → ["Shooting"]
  * "When this unit declares a charge" → ["Charge"]
  * "While a friendly unit is within 6\"" (aura affecting phases) → ["Any"]
  * "Deep Strike" → ["Deployment"]
  * "Leader" → ["Keyword"]
  * "Embarking within transports" → ["General"]
  * "After this unit Advances or Falls Back" → ["Movement"]
  * "Before making a charge roll" → ["Charge"]
  * "Each time this unit fights" → ["Fight"]
  * "In your Command phase" → ["Command"]

triggerSubphase (REQUIRED - string):
- Specific timing within the phase: "Start of Phase", "During Action", "End of Phase"
- Use "" (empty string) if timing is not specifically mentioned
- Examples:
  * "At the start of your Movement phase" → "Start of Phase"
  * "At the end of your Shooting phase" → "End of Phase"
  * "When this unit shoots" → "During Action"
  * "While within 6\"" → "" (passive aura, no specific timing)

isReactive (REQUIRED - boolean):
- true if ability can be used during opponent's turn
- false for abilities only usable on your turn
- Examples:
  * Overwatch abilities → true
  * Counter-offensive abilities → true
  * "During opponent's Charge phase" → true
  * Most standard abilities → false

requiredKeywords (REQUIRED - array of strings):
- Extract keywords that units must have for the ability to apply
- Use UPPERCASE for keywords
- Use empty array [] if no specific keywords required
- Examples:
  * "While a friendly INFANTRY unit is within 6\"" → ["INFANTRY"]
  * "Friendly SPACE WOLVES units" → ["SPACE WOLVES"]
  * "Units in this unit" → [] (applies to self)
  * "All friendly units" → [] (no specific keywords required)

STATS:
- Movement: Include quotes (e.g., "6\\"", "12\\"")
- Toughness: Integer 1-12
- Save: Format as "3+", "4+", etc.
- Invulnerable Save: Format as "4+", "5+", etc. If unit has NO invulnerable save, use empty string ""
- Wounds: Integer
- Leadership: Integer
- Objective Control: Integer

OPTIONAL FIELDS:
- If a field is not applicable, use empty string "" (for string fields) or empty array [] (for array fields)
- subfaction: Use empty string "" if not applicable
- unitSize: Use empty string "" if not specified
- leaderRules: Use empty string "" if not a leader
- leaderAbilities: Use empty string "" if not a leader or no abilities
- transportCapacity: Use empty string "" if not a transport
- wargearOptions: Use empty array [] if no options

CRITICAL - ALL ABILITIES MUST HAVE:
- triggerPhase: Array of phase names or ["Any"] (NEVER leave empty)
- triggerSubphase: Specific timing or "" (ALWAYS provide a value, even if "")
- isReactive: true or false (NEVER leave undefined)
- requiredKeywords: Array of keywords or [] (NEVER leave undefined)

If you cannot determine phase information from the description, use sensible defaults:
- For deployment abilities (Deep Strike, Scout, Infiltrators): triggerPhase: ["Deployment"], triggerSubphase: "", isReactive: false
- For keyword abilities (Leader, Stealth): triggerPhase: ["Keyword"], triggerSubphase: "", isReactive: false
- For general rules (Embarking, etc.): triggerPhase: ["General"], triggerSubphase: "", isReactive: false
- For phase-relevant auras: triggerPhase: ["Any"], triggerSubphase: "", isReactive: false
- For stat modifications that affect phases: triggerPhase: ["Any"], triggerSubphase: "", isReactive: false

COMPOSITION DATA (CRITICAL FOR WOUND TRACKING):
Parse the unit composition into a structured compositionData array. For EVERY model type in the unit:

1. SINGLE MODEL UNITS (Monsters, Characters, Vehicles):
   - Count: 1
   - Role: "leader" for characters with LEADER keyword, "regular" for vehicles/monsters
   - Extract wounds from the stat profile
   - Examples:
     * Maleceptor with 14W → [{"name":"Maleceptor","role":"regular","count":1,"woundsPerModel":14}]
     * Captain with 5W → [{"name":"Captain","role":"leader","count":1,"woundsPerModel":5}]
     * Rhino with 10W → [{"name":"Rhino","role":"regular","count":1,"woundsPerModel":10}]

2. UNIFORM SQUADS (all models identical):
   - All models share the same wounds from stat profile
   - Role: "regular" unless they are characters
   - Examples:
     * 5 Terminators @ 3W each → [{"name":"Terminator","role":"regular","count":5,"woundsPerModel":3}]
     * 10 Intercessors @ 2W each → [{"name":"Intercessor","role":"regular","count":10,"woundsPerModel":2}]
     * 3 Zoanthropes @ 3W each → [{"name":"Zoanthrope","role":"regular","count":3,"woundsPerModel":3}]

3. MIXED LEADER UNITS (Prime/Sergeant with different wounds):
   - Leader/Prime/Sergeant has different wounds than regular squad members
   - Extract wounds from EACH stat profile shown on datasheet
   - Use "leader" role for the special model
   - Examples:
     * Hyperadapted Raveners (Prime 6W, Raveners 3W): 
       [{"name":"Ravener Prime","role":"leader","count":1,"woundsPerModel":6},
        {"name":"Ravener","role":"regular","count":4,"woundsPerModel":3}]
     * Tyranid Warriors with Prime (Prime 4W, Warriors 3W):
       [{"name":"Tyranid Prime","role":"leader","count":1,"woundsPerModel":4},
        {"name":"Tyranid Warrior","role":"regular","count":2,"woundsPerModel":3}]

4. BATTLELINE/VARIABLE SIZE SQUADS:
   - Use the DEFAULT or minimum composition
   - Parse from composition text (e.g., "5-10 Intercessors" → count: 5)
   - Example:
     * "5-10 Intercessors" @ 2W → [{"name":"Intercessor","role":"regular","count":5,"woundsPerModel":2}]

CRITICAL COMPOSITION RULES:
- Extract wounds from the STAT PROFILE for each model type
- If datasheet shows multiple stat lines (different model types), each gets a separate entry
- Use "leader" role for: Characters, Sergeants, Primes, Champions, Bosses, Nobs
- Use "regular" role for: standard squad members, vehicles, monsters without CHARACTER keyword
- The sum of all (count × woundsPerModel) should equal total unit wounds

WARGEAR STAT EFFECTS (CRITICAL):
When parsing wargear abilities (type: "wargear"), extract structured stat modifications into the "effects" field.
The effects object MUST always include all 5 properties, using null for stats that are NOT modified:

Pattern recognition:
- "The bearer has a Wounds characteristic of X" → wounds: X (others null)
- "The bearer has a X+ invulnerable save" → invulnerableSave: "X+" (others null)
- "Add X to the bearer's Toughness" → toughness: X (others null)
- "The bearer has a Save characteristic of X+" → save: "X+" (others null)

Examples:
- Relic Shield: effects: { wounds: 6, toughness: null, save: null, invulnerableSave: null, movement: null }
- Storm Shield: effects: { wounds: null, toughness: null, save: null, invulnerableSave: "4+", movement: null }
- Shield Dome: effects: { wounds: null, toughness: null, save: null, invulnerableSave: "5+", movement: null }

IMPORTANT: 
- For wargear abilities: effects = { wounds: X or null, toughness: X or null, save: "X+" or null, invulnerableSave: "X+" or null, movement: "X" or null }
- For non-wargear abilities (core, faction, unit, leader): effects = null

Return ONLY valid JSON matching the schema. Do not include markdown formatting or explanations.`;
}

/**
 * Delay execution for retry backoff
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse a single datasheet HTML using Gemini 3 Flash with structured outputs
 * Includes retry logic with exponential backoff for connection errors
 */
async function parseDatasheetWithLLM(
  html: string, 
  metadata: any, 
  retries = 3  // Allow 3 retries for complex datasheets
): Promise<ParsedDatasheet> {
  const unitName = metadata.name || 'Unknown';
  
  // Pre-process HTML to extract only relevant datasheet content and points tiers
  const { content: cleanedContent, pointsTiers } = extractDatasheetContent(html);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const requestStartTime = Date.now();
      
      // Build the user prompt
      const userPrompt = `Parse this datasheet:\n\nMetadata: ${JSON.stringify(metadata, null, 2)}\n\nDatasheet Content:\n${cleanedContent}`;
      
      // Call Gemini with structured JSON output
      const response = await gemini.models.generateContent({
        model: PARSER_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: createParsingPrompt(),
          temperature: 0.1, // Low temperature for consistent structured output
          responseMimeType: 'application/json',
          responseSchema: datasheetJsonSchema,
          maxOutputTokens: 65536, // Max output for complex datasheets with many weapons
          thinkingConfig: {
            thinkingLevel: 'medium', // Balanced thinking - enough for parsing but not excessive
          } as any, // Type cast needed - SDK types not updated for thinkingLevel yet
        }
      });
      
      const requestDuration = Date.now() - requestStartTime;
      
      // Get response text
      const outputText = response.text || '';
      
      if (!outputText || outputText.trim().length === 0) {
        console.error(`   ❌ [${unitName}] Empty response from Gemini`);
        throw new Error('Empty response from Gemini');
      }
      
      // Parse and validate JSON
      let parsed: any;
      try {
        parsed = JSON.parse(outputText);
      } catch (error) {
        console.error(`\n❌ [${unitName}] Failed to parse JSON (${outputText.length} chars)`);
        console.error(`   First 500 chars:`, outputText.substring(0, 500));
        throw error;
      }
      
      // Validate with Zod
      const validated = DatasheetSchema.parse(parsed);
      
      // Override pointsTiers with our cheerio-extracted data (more reliable than LLM extraction)
      if (pointsTiers.length > 0) {
        validated.pointsTiers = pointsTiers;
      } else if (!validated.pointsTiers) {
        // Create single tier from base pointsCost if no tiers found
        validated.pointsTiers = [{ models: 1, points: validated.pointsCost }];
      }
      
      return validated;
    } catch (error: any) {
      console.error(`\n❌ [${unitName}] Error (attempt ${attempt}/${retries}): ${error?.message}`);
      
      const isRetryableError = error?.message?.includes('fetch failed') ||
                               error?.message?.includes('ECONNRESET') ||
                               error?.message?.includes('timeout') ||
                               error?.message?.includes('429') ||
                               error?.message?.includes('503') ||
                               error?.message?.includes('500') ||
                               error?.message?.includes('Unterminated string') ||
                               error?.message?.includes('Unexpected end of JSON') ||
                               error?.message?.includes('JSON');
      
      // Retry on retryable errors (including truncated JSON)
      if (isRetryableError && attempt < retries) {
        const backoffMs = Math.min(3000 * Math.pow(2, attempt - 1), 15000);
        console.log(`   ⏳ JSON truncated or API error, retrying in ${backoffMs/1000}s...`);
        await delay(backoffMs);
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error(`Failed to parse ${unitName} after ${retries} attempts`);
}

/**
 * Check if a datasheet should be parsed based on caching rules
 */
async function shouldParse(
  file: string,
  faction: string,
  options: { overrideAll?: boolean; retryFailed?: boolean },
  failedFiles: string[]
): Promise<boolean> {
  // Always parse if override all is set
  if (options.overrideAll) {
    return true;
  }
  
  // Check if this file failed before
  const isFailedFile = failedFiles.includes(file);
  
  // If retry-failed flag is set, only parse failed files
  if (options.retryFailed) {
    return isFailedFile;
  }
  
  // Check if parsed JSON already exists
  const baseName = file.replace('.html', '');
  const outputPath = path.join(PARSED_DIR, faction, `${baseName}.json`);
  const exists = await fs.pathExists(outputPath);
  
  // Don't parse if it exists and is not a failed file
  return !exists;
}

/**
 * Parse all cached datasheets for a faction
 */
export async function parseFaction(
  faction: string,
  subfaction?: string,
  options: { overrideAll?: boolean; retryFailed?: boolean; startFrom?: number; unitFilter?: string } = {}
): Promise<void> {
  const factionDir = path.join(CACHE_DIR, faction);
  
  if (!await fs.pathExists(factionDir)) {
    throw new Error(`No cached data found for ${faction}. Run scraper first.`);
  }
  
  console.log(`\n🎯 Parsing datasheets for ${faction}${subfaction ? ` (${subfaction})` : ''}`);
  if (options.overrideAll) {
    console.log(`   Mode: Override all (re-parsing everything)`);
  } else if (options.retryFailed) {
    console.log(`   Mode: Retry failed (only re-parsing failures)`);
  } else {
    console.log(`   Mode: Smart cache (skip already parsed)`);
  }
  console.log();
  
  // Get all cached HTML files (exclude non-datasheet files)
  const files = await fs.readdir(factionDir);
  const excludedFiles = ['index.html', 'complete-scrape.html', 'scrape-summary.html'];
  const allHtmlFiles = files.filter(f => {
    if (!f.endsWith('.html')) return false;
    if (excludedFiles.includes(f)) return false;
    if (f.includes('scrape')) return false; // Exclude any scrape-related files
    if (f === `${faction}.html`) return false; // Exclude faction index files like "space-marines.html"
    // Only include files that have a corresponding JSON metadata file
    const jsonFile = f.replace('.html', '.json');
    return files.includes(jsonFile);
  });
  
  // Load previous parse summary to get failed files
  const summaryPath = path.join(PARSED_DIR, faction, 'parse-summary.json');
  let failedFiles: string[] = [];
  if (await fs.pathExists(summaryPath)) {
    const summary = await fs.readJson(summaryPath);
    failedFiles = summary.errors?.map((e: any) => e.file) || [];
  }
  
  // Filter files based on caching rules
  let filesToParse: string[] = [];
  for (const file of allHtmlFiles) {
    if (await shouldParse(file, faction, options, failedFiles)) {
      filesToParse.push(file);
    }
  }

  // Apply --unit filter (partial match, case-insensitive)
  // When using --unit, we filter from ALL files (ignoring cache) to allow re-parsing specific units
  if (options.unitFilter) {
    const filter = options.unitFilter.toLowerCase();
    filesToParse = allHtmlFiles.filter(file => {
      const baseName = file.replace('.html', '').replace(/_/g, ' ').toLowerCase();
      return baseName.includes(filter);
    });
    console.log(`🎯 Filtering for unit: "${options.unitFilter}" (found ${filesToParse.length} matches)`);
  }

  // Apply --start-from option (1-based index)
  const startFrom = options.startFrom || 1;
  const startIndex = Math.max(0, startFrom - 1); // Convert to 0-based
  
  if (startIndex > 0 && startIndex < filesToParse.length) {
    const skippedByStartFrom = filesToParse.slice(0, startIndex);
    filesToParse = filesToParse.slice(startIndex);
    console.log(`⏭️  Starting from index ${startFrom}, skipping ${skippedByStartFrom.length} files`);
  }
  
  const skippedCount = allHtmlFiles.length - filesToParse.length - startIndex;
  
  console.log(`📊 Total datasheets: ${allHtmlFiles.length}`);
  console.log(`   To parse: ${filesToParse.length}`);
  console.log(`   Skipped: ${skippedCount + startIndex}\n`);
  
  if (filesToParse.length === 0) {
    console.log(`✨ All datasheets already parsed! Use --override-all to re-parse.`);
    return;
  }
  
  // Initialize stats
  const stats = {
    success: 0,
    failed: 0,
    skipped: skippedCount + startIndex,
  };
  
  const errors: Array<{ file: string; error: string }> = [];
  
  // Simple progress tracking (avoiding cli-progress compatibility issues with Node 22)
  let processed = 0;
  const logProgress = () => {
    processed++;
    const pct = Math.round((processed / filesToParse.length) * 100);
    console.log(`   [${pct}%] ${processed}/${filesToParse.length} | ✅ ${stats.success} | ❌ ${stats.failed}`);
  };
  
  // Process in smaller batches with longer delays to avoid rate limiting
  const BATCH_SIZE = 3; // Reduced from 5 to 3
  const BATCH_DELAY_MS = 2000; // Increased from 100ms to 2 seconds
  const REQUEST_DELAY_MS = 2000; // Delay between individual requests in a batch (increased to 2s to avoid overwhelming API)
  
  console.log(`\n⚙️  Configuration:`);
  console.log(`   Model: ${PARSER_MODEL}`);
  console.log(`   Thinking: medium (balanced)`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Batch delay: ${BATCH_DELAY_MS}ms`);
  console.log(`   Request delay: ${REQUEST_DELAY_MS}ms`);
  console.log(`   Max retries per request: 3`);
  console.log(`   Max output tokens: 65536`);
  console.log(`   Google API key present: ${process.env.GOOGLE_API_KEY ? 'Yes' : 'No'}\n`);
  
  for (let i = 0; i < filesToParse.length; i += BATCH_SIZE) {
    const batchFiles = filesToParse.slice(i, i + BATCH_SIZE);
    
    // Load all files in batch
    const batch = await Promise.all(
      batchFiles.map(async (file) => {
        const baseName = file.replace('.html', '');
        const htmlPath = path.join(factionDir, file);
        const metadataPath = path.join(factionDir, `${baseName}.json`);
        
        const html = await fs.readFile(htmlPath, 'utf-8');
        const metadata = await fs.readJson(metadataPath);
        
        return { file, baseName, html, metadata };
      })
    );
    
    // Show which units are being processed
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(filesToParse.length / BATCH_SIZE);
    const unitNames = batch.map(b => b.metadata.name || b.baseName).join(', ');
    console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: ${unitNames}`);
    
    // Parse batch with staggered requests to avoid overwhelming the API
    try {
      // Process requests with small delays between them instead of all at once
      for (const item of batch) {
        await delay(REQUEST_DELAY_MS);
        
        try {
          const unitName = item.metadata.name || item.baseName;
          
          // Parse the datasheet
          const result = await parseDatasheetWithLLM(item.html, item.metadata);
          
          // Save parsed data
          const outputDir = path.join(PARSED_DIR, faction);
          await fs.ensureDir(outputDir);
          const outputPath = path.join(outputDir, `${item.baseName}.json`);
          await fs.writeJson(outputPath, result, { spaces: 2 });
          
          stats.success++;
          logProgress();
        } catch (error: any) {
          
          stats.failed++;
          errors.push({
            file: item.file,
            error: error instanceof Error ? error.message : String(error),
          });
          logProgress();
        }
      }
    } catch (error) {
      // Fallback error handling
      batch.forEach(item => {
        errors.push({
          file: item.file,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    
    // Delay between batches
    if (i + BATCH_SIZE < filesToParse.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
  
  console.log(''); // Empty line after progress
  
  // Save summary
  await fs.ensureDir(path.join(PARSED_DIR, faction));
  await fs.writeJson(summaryPath, {
    total: allHtmlFiles.length,
    success: stats.success,
    failed: stats.failed,
    skipped: stats.skipped,
    errors,
    faction,
    subfaction,
    completedAt: new Date().toISOString(),
  }, { spaces: 2 });
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Parse Summary for ${faction}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Success: ${stats.success}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`📝 Total: ${allHtmlFiles.length}`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(err => {
      console.log(`   - ${err.file}: ${err.error}`);
    });
  }
  
  console.log(`\n✨ Parsing complete! Data saved to: ${path.join(PARSED_DIR, faction)}`);
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/parseDatasheets.ts <faction> [subfaction] [flags]

Arguments:
  faction      Required. The faction to parse (e.g., "space-marines", "tyranids")
  subfaction   Optional. The subfaction to parse (e.g., "space-wolves")

Flags:
  --override-all       Re-parse all datasheets, ignoring cache
  --retry-failed       Only re-parse datasheets that previously failed
  --start-from=N       Start from index N (1-based), skip earlier files
  --unit=NAME          Parse only a specific unit (partial match, case-insensitive)
  --help, -h           Show this help message

Examples:
  # Normal run (skip already parsed)
  tsx scripts/parseDatasheets.ts "space-marines"

  # Re-parse everything
  tsx scripts/parseDatasheets.ts "space-marines" --override-all

  # Only retry failed ones
  tsx scripts/parseDatasheets.ts "space-marines" --retry-failed

  # Resume from index 43 (after a crash)
  tsx scripts/parseDatasheets.ts "space-marines" --override-all --start-from=43

  # Parse a specific unit
  tsx scripts/parseDatasheets.ts "space-marines" --unit="Logan Grimnar"
  tsx scripts/parseDatasheets.ts "space-marines" --unit=captain

  # With subfaction
  tsx scripts/parseDatasheets.ts "space-marines" "space-wolves"

Note: Run scrapeWahapedia.ts first to cache HTML data.
    `);
    process.exit(0);
  }
  
  // Parse positional arguments (exclude flags)
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  const faction = positionalArgs[0];
  const subfaction = positionalArgs[1];
  
  // Parse --start-from=N flag
  const startFromArg = args.find(arg => arg.startsWith('--start-from='));
  const startFrom = startFromArg ? parseInt(startFromArg.split('=')[1], 10) : 1;

  // Parse --unit=NAME flag
  const unitArg = args.find(arg => arg.startsWith('--unit='));
  const unitFilter = unitArg ? unitArg.split('=')[1].toLowerCase() : undefined;

  // Parse flags
  const options = {
    overrideAll: args.includes('--override-all'),
    retryFailed: args.includes('--retry-failed'),
    startFrom,
    unitFilter,
  };
  
  try {
    await parseFaction(faction, subfaction, options);
  } catch (error) {
    console.error(`\n💥 Fatal error:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

