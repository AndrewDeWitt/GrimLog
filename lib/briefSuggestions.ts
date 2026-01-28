/**
 * Brief Suggestions Utility
 *
 * Functions to fetch faction datasheets and format prompts for
 * the list modification suggestions LLM call.
 */

import { prisma } from './prisma';
import { BriefContext, BriefStrategicAnalysis, ListSuggestion } from './briefAnalysis';

// ============================================
// TYPES
// ============================================

/** Enhancement data passed to suggestion prompt builder */
export interface DetachmentEnhancement {
  name: string;
  pointsCost: number;
  description: string;
  restrictions: string | null;
}

export interface DatasheetWithWeaponsAndAbilities {
  id: string;
  name: string;
  faction: string;
  subfaction: string | null;
  role: string;
  keywords: string;
  movement: string;
  toughness: number;
  save: string;
  invulnerableSave: string | null;
  wounds: number;
  leadership: number;
  objectiveControl: number;
  composition: string;
  unitSize: string | null;
  pointsCost: number;
  pointsTiers: string | null;
  leaderRules: string | null;
  leaderAbilities: string | null;
  // Competitive context
  competitiveTier: string | null;
  tierReasoning: string | null;
  synergies: string | null;
  counters: string | null;
  playstyleNotes: string | null;
  deploymentTips: string | null;
  // Relations
  weapons: Array<{
    weapon: {
      name: string;
      range: string;
      type: string;
      attacks: string;
      ballisticSkill: string | null;
      weaponSkill: string | null;
      strength: string;
      armorPenetration: string;
      damage: string;
      abilities: string;
    };
    isDefault: boolean;
    quantity: string | null;
  }>;
  abilities: Array<{
    ability: {
      name: string;
      type: string;
      description: string;
    };
    source: string;
  }>;
}

// ============================================
// FETCH FACTION DATASHEETS
// ============================================

/**
 * Fetch ALL datasheets the faction has access to, including parent faction units.
 * e.g., Space Wolves gets: Space Wolves units + Space Marines units
 * 
 * @param faction - The faction name (e.g., "Space Wolves")
 * @param subfaction - Optional subfaction
 * @returns Array of datasheets with weapons and abilities
 */
export async function fetchFactionDatasheets(
  faction: string,
  subfaction: string | null
): Promise<DatasheetWithWeaponsAndAbilities[]> {
  // Get the faction record to check for parent faction
  const factionRecord = await prisma.faction.findFirst({
    where: { name: { equals: faction, mode: 'insensitive' } },
    include: { parentFaction: true }
  });
  
  // Build list of factions to include: this faction + parent (if exists)
  const factionNames: string[] = [faction];
  if (factionRecord?.parentFaction) {
    factionNames.push(factionRecord.parentFaction.name);
  }
  
  // Also check if faction IS a parent (e.g., "Space Marines") - include it
  // Handle case where faction string might be "Space Marines" directly
  if (!factionRecord) {
    // Try finding as-is
    factionNames.push(faction);
  }
  
  console.log(`📋 Fetching datasheets for factions: ${factionNames.join(', ')}`);
  
  // Fetch all datasheets from applicable factions
  const datasheets = await prisma.datasheet.findMany({
    where: {
      OR: factionNames.map(f => ({ 
        faction: { equals: f, mode: 'insensitive' as const } 
      })),
      isEnabled: true
    },
    include: {
      weapons: {
        include: { weapon: true }
      },
      abilities: {
        include: { ability: true }
      }
    },
    orderBy: [
      { role: 'asc' },
      { name: 'asc' }
    ]
  });
  
  console.log(`📋 Found ${datasheets.length} datasheets for suggestion pool`);
  
  return datasheets as DatasheetWithWeaponsAndAbilities[];
}

// ============================================
// FORMAT DATASHEETS FOR PROMPT
// ============================================

/**
 * Format datasheets with complete profiles for LLM consumption.
 * No condensing - LLM gets full weapon stats, abilities, etc.
 */
export function formatDatasheetsForPrompt(
  datasheets: DatasheetWithWeaponsAndAbilities[]
): string {
  if (datasheets.length === 0) {
    return 'No additional faction datasheets available.';
  }
  
  const sections: string[] = [];
  
  // Group by role for organization
  const byRole = new Map<string, DatasheetWithWeaponsAndAbilities[]>();
  for (const ds of datasheets) {
    const role = ds.role || 'Other';
    if (!byRole.has(role)) {
      byRole.set(role, []);
    }
    byRole.get(role)!.push(ds);
  }
  
  for (const [role, units] of byRole) {
    sections.push(`### ${role.toUpperCase()}`);
    
    for (const ds of units) {
      sections.push(formatSingleDatasheet(ds));
    }
  }
  
  return sections.join('\n\n');
}

/**
 * Format a single datasheet with full details
 */
function formatSingleDatasheet(ds: DatasheetWithWeaponsAndAbilities): string {
  const lines: string[] = [];
  
  // Header with name and points
  const pointsTiers = ds.pointsTiers ? JSON.parse(ds.pointsTiers) : null;
  const pointsStr = pointsTiers && pointsTiers.length > 1
    ? `${ds.pointsCost}-${pointsTiers[pointsTiers.length - 1].points}pts`
    : `${ds.pointsCost}pts`;
  
  lines.push(`**${ds.name}** (${pointsStr})`);
  
  // Stats line
  const saveStr = ds.invulnerableSave 
    ? `${ds.save}/${ds.invulnerableSave}` 
    : ds.save;
  lines.push(`M${ds.movement} | T${ds.toughness} | ${saveStr} | W${ds.wounds} | OC${ds.objectiveControl} | Ld${ds.leadership}`);
  
  // Composition
  if (ds.unitSize) {
    lines.push(`Size: ${ds.unitSize} models`);
  }
  if (ds.composition) {
    lines.push(`Composition: ${ds.composition}`);
  }
  
  // Points tiers if variable size
  if (pointsTiers && pointsTiers.length > 1) {
    const tiersStr = pointsTiers
      .map((t: { models: number; points: number }) => `${t.models}=${t.points}pts`)
      .join(', ');
    lines.push(`Points by size: ${tiersStr}`);
  }
  
  // Keywords
  try {
    const keywords = JSON.parse(ds.keywords || '[]');
    if (keywords.length > 0) {
      lines.push(`Keywords: ${keywords.join(', ')}`);
    }
  } catch {
    if (ds.keywords) {
      lines.push(`Keywords: ${ds.keywords}`);
    }
  }
  
  // Weapons
  if (ds.weapons.length > 0) {
    lines.push('Weapons:');
    for (const w of ds.weapons) {
      const weapon = w.weapon;
      const isMelee = weapon.type?.toLowerCase().includes('melee') || 
                      weapon.range === 'Melee' ||
                      weapon.weaponSkill;
      
      const skillStr = isMelee 
        ? (weapon.weaponSkill || '3+')
        : (weapon.ballisticSkill || '3+');
      
      // Parse abilities
      let abilities: string[] = [];
      try {
        abilities = JSON.parse(weapon.abilities || '[]');
      } catch {
        if (weapon.abilities) {
          abilities = [weapon.abilities];
        }
      }
      const abilitiesStr = abilities.length > 0 ? ` [${abilities.join(', ')}]` : '';
      
      lines.push(`  - ${weapon.name}: ${weapon.range}, A${weapon.attacks}, ${skillStr}, S${weapon.strength}, AP${weapon.armorPenetration}, D${weapon.damage}${abilitiesStr}`);
    }
  }
  
  // Abilities
  if (ds.abilities.length > 0) {
    lines.push('Abilities:');
    for (const a of ds.abilities) {
      const ability = a.ability;
      // Truncate very long descriptions
      const desc = ability.description.length > 200
        ? ability.description.substring(0, 200) + '...'
        : ability.description;
      lines.push(`  - ${ability.name}: ${desc}`);
    }
  }
  
  // Leader rules
  if (ds.leaderRules) {
    lines.push(`Can Lead: ${ds.leaderRules}`);
  }
  if (ds.leaderAbilities) {
    lines.push(`Leader Bonus: ${ds.leaderAbilities}`);
  }
  
  // Competitive context if available
  if (ds.competitiveTier) {
    lines.push(`Competitive Tier: ${ds.competitiveTier}`);
  }
  if (ds.tierReasoning) {
    lines.push(`Tier Reasoning: ${ds.tierReasoning}`);
  }
  if (ds.synergies) {
    try {
      const synergies = JSON.parse(ds.synergies);
      if (Array.isArray(synergies) && synergies.length > 0) {
        lines.push(`Synergies: ${synergies.join(', ')}`);
      }
    } catch {
      lines.push(`Synergies: ${ds.synergies}`);
    }
  }
  if (ds.playstyleNotes) {
    lines.push(`Playstyle: ${ds.playstyleNotes}`);
  }
  
  return lines.join('\n');
}

// ============================================
// BUILD SUGGESTION PROMPT
// ============================================

/**
 * Build the complete prompt for the list modification suggestions LLM call.
 *
 * @param context - Current army composition (BriefContext)
 * @param strategicAnalysis - Full output from LLM call #1
 * @param detachmentRulesPrompt - Faction/detachment rules (reused from first call)
 * @param allDatasheets - All available faction datasheets
 * @param detachmentEnhancements - Available enhancements for this detachment
 * @returns Complete prompt string
 */
/**
 * Build the user prompt for list suggestions.
 * 
 * @param context - Current army composition (BriefContext)
 * @param strategicAnalysis - Full output from the analysis LLM call
 * @param detachmentRulesPrompt - Faction/detachment rules (skipped if usingSharedPrefix)
 * @param allDatasheets - All available faction datasheets (skipped if usingSharedPrefix)
 * @param detachmentEnhancements - Available enhancements for this detachment
 * @param usingSharedPrefix - If true, skip detachment rules and datasheets (they're in system prompt)
 * @returns Complete user prompt string
 */
export function buildSuggestionPrompt(
  context: BriefContext,
  strategicAnalysis: BriefStrategicAnalysis,
  detachmentRulesPrompt: string,
  allDatasheets: DatasheetWithWeaponsAndAbilities[],
  detachmentEnhancements: DetachmentEnhancement[] = [],
  usingSharedPrefix?: boolean
): string {
  const sections: string[] = [];

  // Header
  sections.push(`You are suggesting army list modifications for a ${context.faction || 'Unknown'} army using the ${context.detachment || 'Unknown'} detachment.`);
  sections.push('');

  // Calculate total enhancements in army
  const totalEnhancements = context.units.reduce((count, unit) =>
    count + (unit.enhancements?.length || 0), 0
  );
  const availablePoints = 2000 - context.totalPoints;

  // Army overview
  sections.push('## CURRENT ARMY OVERVIEW');
  sections.push(`- Total Points: ${context.totalPoints}`);
  sections.push(`- **AVAILABLE_POINTS: ${availablePoints}** (2000pt Strike Force limit)`);
  sections.push(`- Units: ${context.unitCount} | Models: ${context.modelCount}`);
  sections.push(`- Total Enhancements: ${totalEnhancements}/3 (max 3 per army)`);
  sections.push('');
  sections.push('**POINTS BUDGET REMINDER:**');
  sections.push(`- Each suggestion must result in a valid list at 1990-2000pts`);
  sections.push(`- pointsDelta should be between -10 and +${availablePoints}`);
  sections.push('- All 4 options are INDEPENDENT - each stands alone as a complete modification');
  sections.push('');

  // Detachment rules (skip if using shared prefix - they're in system prompt)
  if (!usingSharedPrefix && detachmentRulesPrompt) {
    sections.push(detachmentRulesPrompt);
    sections.push('');
  }

  // Strategic analysis output (the key context)
  sections.push('## STRATEGIC ANALYSIS OUTPUT (from first analysis)');
  sections.push('This is the complete strategic analysis of the current army. Use this to understand the gaps and inform your suggestions.');
  sections.push('');
  sections.push('```json');
  sections.push(JSON.stringify(strategicAnalysis, null, 2));
  sections.push('```');
  sections.push('');

  // Current army composition
  sections.push('## CURRENT ARMY COMPOSITION');
  sections.push('These are the units currently in the army with their loadouts:');
  sections.push('');
  for (const unit of context.units) {
    sections.push(formatCurrentArmyUnit(unit));
    sections.push('');
  }

  // Enhancement opportunities section
  const enhancementOpportunities = buildEnhancementOpportunitiesSection(context, detachmentEnhancements);
  if (enhancementOpportunities) {
    sections.push(enhancementOpportunities);
    sections.push('');
  }

  // All available datasheets (skip if using shared prefix - they're in system prompt)
  if (!usingSharedPrefix) {
    sections.push('## ALL AVAILABLE FACTION DATASHEETS');
    sections.push('These are ALL units available to this faction (including units already in the army - you may suggest adding more of the same unit):');
    sections.push('');
    sections.push(formatDatasheetsForPrompt(allDatasheets));
    sections.push('');
  }

  // Instructions - 4 independent complete options
  sections.push('## INSTRUCTIONS');
  sections.push('Based on the strategic analysis, suggest exactly 4 COMPLETE list modifications.');
  sections.push('Each is an INDEPENDENT option - user picks ONE that fits their collection.');
  sections.push('');
  sections.push('### SUGGESTION TYPES');
  sections.push('Each suggestion can include ANY combination of:');
  sections.push('- **removeUnits**: Units to remove from the list');
  sections.push('- **addUnits**: Units to add to the list');
  sections.push('- **addEnhancements**: Enhancements to add to characters');
  sections.push('');
  sections.push('Examples of valid suggestions:');
  sections.push('1. SIMPLE: Remove 1 unit, add 1 unit of similar cost');
  sections.push('2. MEDIUM: Remove 1 unit, add 2 smaller units');
  sections.push('3. WITH ENHANCEMENT: Remove unit, add unit + add enhancement to existing character');
  sections.push('4. COMPLEX: Remove 2 units, add 3 units + enhancement');
  sections.push('');
  sections.push('### CRITICAL RULES');
  sections.push(`- Each suggestion must result in 1990-2000pts (pointsDelta between -10 and +${availablePoints})`);
  sections.push('- All 4 suggestions must be INDEPENDENT - do NOT make them depend on each other');
  sections.push('- Each suggestion should address a different strategic gap when possible');
  sections.push('');
  sections.push('### UNIT AVAILABILITY (VERY IMPORTANT)');
  const datasheetLocation = usingSharedPrefix ? 'the REFERENCE DATA: FACTION DATASHEETS section' : 'ALL AVAILABLE FACTION DATASHEETS above';
  sections.push(`- **ONLY suggest units that have a full datasheet entry in ${datasheetLocation}**`);
  sections.push('- Do NOT suggest units mentioned in "Can Lead" text, collection recommendations, or strategic analysis if they lack a datasheet');
  sections.push('- If a unit name appears but has no stats/points in the datasheet section, it does NOT exist and must not be suggested');
  sections.push('- Legends units and discontinued models are NOT in the datasheet list - do not hallucinate them');
  sections.push('');
  sections.push('### ENHANCEMENT RULES');
  sections.push('- ONLY suggest enhancements for characters listed in ENHANCEMENT OPPORTUNITIES above');
  sections.push('- ONLY suggest from the "Eligible enhancements" list for each character');
  sections.push('- Characters with enhancements already equipped CANNOT take another');
  sections.push(`- Army already has ${totalEnhancements}/3 enhancements - ${totalEnhancements >= 3 ? 'CANNOT add more' : `can add ${3 - totalEnhancements} more`}`);

  return sections.join('\n');
}

/**
 * Build the enhancement opportunities section for the prompt
 */
function buildEnhancementOpportunitiesSection(
  context: BriefContext,
  detachmentEnhancements: DetachmentEnhancement[]
): string | null {
  // Find characters without enhancements
  const charactersWithoutEnhancements = context.units.filter(u =>
    u.keywords.some(k => k.toUpperCase() === 'CHARACTER') &&
    (!u.enhancements || u.enhancements.length === 0)
  );

  if (charactersWithoutEnhancements.length === 0 || detachmentEnhancements.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push('## ENHANCEMENT OPPORTUNITIES');
  lines.push('The following characters do NOT have enhancements equipped:');
  lines.push('');

  let hasEligible = false;

  for (const char of charactersWithoutEnhancements) {
    // Find eligible enhancements based on restrictions
    const eligible = detachmentEnhancements.filter(enh => {
      if (!enh.restrictions) return true; // No restrictions = anyone can take it

      try {
        const restrictions = JSON.parse(enh.restrictions);
        if (!Array.isArray(restrictions) || restrictions.length === 0) return true;

        // Check if character has all required keywords
        return restrictions.every((req: string) =>
          char.keywords.some(kw => kw.toUpperCase().includes(req.toUpperCase()))
        );
      } catch {
        return true; // If parsing fails, assume no restrictions
      }
    });

    if (eligible.length > 0) {
      hasEligible = true;
      lines.push(`- **${char.displayName}** (Keywords: ${char.keywords.slice(0, 5).join(', ')}${char.keywords.length > 5 ? '...' : ''})`);
      lines.push(`  Eligible enhancements: ${eligible.map(e => `${e.name} (${e.pointsCost}pts)`).join(', ')}`);
    }
  }

  if (!hasEligible) {
    return null;
  }

  lines.push('');
  lines.push(`Available points for enhancements: ${2000 - context.totalPoints}pts`);

  return lines.join('\n');
}

/**
 * Format a unit from the current army context
 */
function formatCurrentArmyUnit(unit: BriefContext['units'][0]): string {
  const lines: string[] = [];
  
  lines.push(`### ${unit.displayName} (${unit.points}pts, ${unit.models} models)`);
  
  // Stats
  const saveStr = unit.invulnerableSave 
    ? `${unit.save}/${unit.invulnerableSave}` 
    : unit.save;
  lines.push(`Stats: M${unit.movement} | T${unit.toughness} | ${saveStr} | W${unit.wounds} | OC${unit.objectiveControl}`);
  
  // Keywords
  if (unit.keywords.length > 0) {
    lines.push(`Keywords: ${unit.keywords.join(', ')}`);
  }
  
  // Weapons
  if (unit.weapons.length > 0) {
    lines.push('Weapons:');
    for (const w of unit.weapons) {
      const abilitiesStr = w.abilities.length > 0 ? ` [${w.abilities.join(', ')}]` : '';
      lines.push(`  - ${w.name}: ${w.range}, A${w.attacks}, S${w.strength}, AP${w.ap}, D${w.damage}${abilitiesStr}`);
    }
  }
  
  // Enhancements
  if (unit.enhancements.length > 0) {
    lines.push(`Enhancements: ${unit.enhancements.join(', ')}`);
  }
  
  // Role assignment from analysis
  lines.push(`Role: ${unit.role}`);
  
  return lines.join('\n');
}

// ============================================
// SUGGESTION SYSTEM PROMPT
// ============================================

// Optimizer instructions (appended to shared prefix or used standalone)
const OPTIMIZER_INSTRUCTIONS = `## YOUR TASK: LIST OPTIMIZER
You are an expert Warhammer 40,000 10th Edition list optimizer. Generate 4 complete, independent list modification options.`;

/**
 * Build system prompt for list suggestions.
 * Optionally accepts a shared prefix containing datasheets/rules for cache optimization.
 * 
 * @param sharedSystemPrefix - Pre-built shared context (datasheets, rules, detachment)
 * @returns Complete system prompt string
 */
export function buildSuggestionSystemPrompt(sharedSystemPrefix?: string): string {
  const fullInstructions = OPTIMIZER_INSTRUCTIONS + SUGGESTION_INSTRUCTIONS_BODY;
  
  if (sharedSystemPrefix) {
    return `${sharedSystemPrefix}\n\n${fullInstructions}`;
  }
  
  // Backwards compatibility: return just optimizer instructions
  return fullInstructions;
}

// Full suggestion instructions body (separated from header for modularity)
const SUGGESTION_INSTRUCTIONS_BODY = `

## YOUR TASK
Generate EXACTLY 4 self-contained suggestions. Each is a COMPLETE modification that results in a valid ~2000pt list. User will pick ONE option that fits their collection.

## SUGGESTION STRUCTURE
Each suggestion can include ANY combination of:
- **removeUnits**: Units to remove from the list
- **addUnits**: Units to add to the list
- **addEnhancements**: Enhancements to add to characters

Examples of valid suggestions:
1. SIMPLE: Remove 1 unit, add 1 unit of similar cost
2. MEDIUM: Remove 2 units, add 2-3 units + 1 enhancement
3. COMPLEX: Remove 2 units, add 3 units + 2 enhancements + upgrade existing unit

## CRITICAL RULES

### Points Efficiency (MOST IMPORTANT)
**Final list MUST be 1990-2000pts. Unused points = bad suggestion.**

- Current list is at TOTAL_POINTS. AVAILABLE_POINTS shows what's free.
- Every suggestion's pointsDelta should be between -10 and +AVAILABLE_POINTS
- If removing units frees points → ADD MORE to spend them!

BAD: Remove 255pts, add 180pts → 75pts wasted!
GOOD: Remove 255pts, add 250pts → Only 5pts under (acceptable)

### 10th Edition Rules
- **Rule of 3**: Max 3 copies of any non-Battleline datasheet
- **Max 3 Enhancements**: Army total, not per suggestion
- **One Enhancement Per Character**: Characters with enhancements cannot take another
- **Epic Heroes**: Max 1 of each

### Enhancement Rules
- ONLY suggest enhancements listed in ENHANCEMENT OPPORTUNITIES section
- Characters already equipped with an enhancement CANNOT take another
- Check army's current enhancement count before suggesting more

### Independence
- All 4 suggestions are INDEPENDENT ALTERNATIVES
- Each must stand alone as a complete, valid modification
- Do NOT create suggestions that depend on each other

### Unit Availability (CRITICAL)
- **ONLY suggest units that have a full datasheet entry in the REFERENCE DATA section**
- Do NOT suggest units mentioned in "Can Lead" text if they don't have their own datasheet
- Do NOT suggest units from collection recommendations or strategic analysis if they lack a datasheet
- Legends units and discontinued models will NOT have datasheets - do not hallucinate them

## TITLE GUIDELINES
Create short, descriptive titles (2-5 words):
- "Add Cavalry Leader" (adding leader to a mounted unit)
- "Upgrade Scoring Units" (swapping battleline)
- "Anti-Tank Package" (adding anti-vehicle capability)
- "Mobility Boost" (adding fast units)

## OUTPUT QUALITY

GOOD suggestions:
✓ Points-efficient: Remove 255pts, add 250pts → Only 5pts under (acceptable)
✓ Only uses units with datasheets listed in the prompt
✓ Each suggestion is independent

BAD suggestions:
✗ Remove 255pts, add only 180pts → 75pts wasted
✗ Enhancement for character who already has one
✗ Suggestion that exceeds 2000pt limit
✗ Two suggestions that remove the same unit
✗ Suggesting a unit that has no datasheet entry (even if mentioned in Can Lead or analysis)`;

// Legacy export for backwards compatibility
export const SUGGESTION_SYSTEM_PROMPT = `You are an expert Warhammer 40,000 10th Edition list optimizer. Generate 4 complete, independent list modification options.

## YOUR TASK
Generate EXACTLY 4 self-contained suggestions. Each is a COMPLETE modification that results in a valid ~2000pt list. User will pick ONE option that fits their collection.

## SUGGESTION STRUCTURE
Each suggestion can include ANY combination of:
- **removeUnits**: Units to remove from the list
- **addUnits**: Units to add to the list
- **addEnhancements**: Enhancements to add to characters

Examples of valid suggestions:
1. SIMPLE: Remove 1 unit, add 1 unit of similar cost
2. MEDIUM: Remove 2 units, add 2-3 units + 1 enhancement
3. COMPLEX: Remove 2 units, add 3 units + 2 enhancements + upgrade existing unit

## CRITICAL RULES

### Points Efficiency (MOST IMPORTANT)
**Final list MUST be 1990-2000pts. Unused points = bad suggestion.**

- Current list is at TOTAL_POINTS. AVAILABLE_POINTS shows what's free.
- Every suggestion's pointsDelta should be between -10 and +AVAILABLE_POINTS
- If removing units frees points → ADD MORE to spend them!

BAD: Remove 255pts, add 180pts → 75pts wasted!
GOOD: Remove 255pts, add 250pts → Only 5pts under (acceptable)

### 10th Edition Rules
- **Rule of 3**: Max 3 copies of any non-Battleline datasheet
- **Max 3 Enhancements**: Army total, not per suggestion
- **One Enhancement Per Character**: Characters with enhancements cannot take another
- **Epic Heroes**: Max 1 of each

### Enhancement Rules
- ONLY suggest enhancements listed in ENHANCEMENT OPPORTUNITIES section
- Characters already equipped with an enhancement CANNOT take another
- Check army's current enhancement count before suggesting more

### Independence
- All 4 suggestions are INDEPENDENT ALTERNATIVES
- Each must stand alone as a complete, valid modification
- Do NOT create suggestions that depend on each other

### Unit Availability (CRITICAL)
- **ONLY suggest units that have a full datasheet entry in the ALL AVAILABLE FACTION DATASHEETS section**
- Do NOT suggest units mentioned in "Can Lead" text if they don't have their own datasheet
- Do NOT suggest units from collection recommendations or strategic analysis if they lack a datasheet
- Legends units and discontinued models will NOT have datasheets - do not hallucinate them

## TITLE GUIDELINES
Create short, descriptive titles (2-5 words):
- "Add Cavalry Leader" (adding leader to a mounted unit)
- "Upgrade Scoring Units" (swapping battleline)
- "Anti-Tank Package" (adding anti-vehicle capability)
- "Mobility Boost" (adding fast units)

## OUTPUT QUALITY

GOOD suggestions:
✓ Points-efficient: Remove 255pts, add 250pts → Only 5pts under (acceptable)
✓ Only uses units with datasheets listed in the prompt
✓ Each suggestion is independent

BAD suggestions:
✗ Remove 255pts, add only 180pts → 75pts wasted
✗ Enhancement for character who already has one
✗ Suggestion that exceeds 2000pt limit
✗ Two suggestions that remove the same unit
✗ Suggesting a unit that has no datasheet entry (even if mentioned in Can Lead or analysis)`;

// ============================================
// SUGGESTION RESPONSE SCHEMA
// ============================================

export const SUGGESTION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      description: "2-4 complete, independent list modification options. Aim for 4 but fewer is acceptable if points are tight.",
      minItems: 1,
      maxItems: 6, // Allow flexibility - model can generate more if needed
      items: {
        type: "object",
        properties: {
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Priority: high = critical weakness, medium = significant, low = optimization"
          },
          title: {
            type: "string",
            description: "Short descriptive title (2-5 words), e.g., 'Add TWC Leadership'"
          },
          removeUnits: {
            type: "array",
            description: "Units to remove from the list",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Exact unit name from current army" },
                points: { type: "integer", description: "Points cost of unit being removed" }
              },
              required: ["name", "points"]
            }
          },
          addUnits: {
            type: "array",
            description: "Units to add to the list",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Exact datasheet name" },
                points: { type: "integer", description: "Points cost" }
              },
              required: ["name", "points"]
            }
          },
          addEnhancements: {
            type: "array",
            description: "Enhancements to add to characters",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Enhancement name from eligible list" },
                points: { type: "integer", description: "Points cost" },
                targetCharacter: { type: "string", description: "Character name to receive enhancement" }
              },
              required: ["name", "points", "targetCharacter"]
            }
          },
          pointsDelta: {
            type: "integer",
            description: "Net points change (should be between -10 and +AVAILABLE_POINTS)"
          },
          addressesGap: {
            type: "string",
            description: "Which strategic weakness this addresses (short phrase)"
          },
          tradeoffs: {
            type: "string",
            description: "What the army loses or risks with this change"
          },
          reasoning: {
            type: "string",
            description: "Full explanation of why this improves the list"
          }
        },
        required: ["priority", "title", "removeUnits", "addUnits", "addEnhancements", "pointsDelta", "addressesGap", "tradeoffs", "reasoning"]
      }
    }
  },
  required: ["suggestions"]
};

// Type for the suggestion response
export interface SuggestionResponse {
  suggestions: ListSuggestion[];
}

