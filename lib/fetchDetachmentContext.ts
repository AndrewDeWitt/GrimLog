/**
 * Detachment Context Fetcher
 * 
 * Fetches faction and detachment rules from the database to enrich
 * the brief analysis LLM prompt with accurate, current game rules.
 */

import { prisma } from './prisma';

/**
 * Detachment context containing all rules the LLM needs for accurate analysis
 */
export interface DetachmentContext {
  detachment: {
    name: string;
    abilityName: string | null;
    abilityDescription: string | null;
  } | null;
  stratagems: Array<{
    name: string;
    cpCost: number;
    when: string;
    target: string;
    effect: string;
  }>;
  enhancements: Array<{
    name: string;
    pointsCost: number;
    description: string;
    restrictions: string | null;
  }>;
  factionRules: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}

/**
 * Fetch detachment context from the database
 *
 * @param faction - The faction name (e.g., "Space Wolves")
 * @param detachmentName - The detachment name (e.g., "Saga of the Great Wolf")
 * @returns DetachmentContext with all available rules
 */
export async function fetchDetachmentContext(
  faction: string | null,
  detachmentName: string | null
): Promise<DetachmentContext> {
  // Return empty context if no faction
  if (!faction) {
    return {
      detachment: null,
      stratagems: [],
      enhancements: [],
      factionRules: [],
    };
  }

  // Get the faction record to check for parent faction
  // e.g., Space Wolves -> Space Marines (parent)
  // This allows us to find detachments like "Stormlance Task Force" which are stored under Space Marines
  const factionRecord = await prisma.faction.findFirst({
    where: { name: { equals: faction, mode: 'insensitive' } },
    include: { parentFaction: true }
  });

  // Build list of factions to search: this faction + parent (if exists)
  const factionNames: string[] = [faction];
  if (factionRecord?.parentFaction) {
    factionNames.push(factionRecord.parentFaction.name);
  }

  // Build faction filter for queries
  const factionFilter = {
    OR: factionNames.map(f => ({ faction: { equals: f, mode: 'insensitive' as const } }))
  };

  // Run all queries in parallel for performance
  const [detachment, stratagems, enhancements, factionRules] = await Promise.all([
    // Fetch detachment info - search in both faction and parent faction
    detachmentName
      ? prisma.detachment.findFirst({
          where: {
            AND: [
              {
                OR: [
                  { name: { equals: detachmentName, mode: 'insensitive' } },
                  { name: { contains: detachmentName, mode: 'insensitive' } },
                ],
              },
              factionFilter,
            ],
          },
          select: {
            name: true,
            abilityName: true,
            abilityDescription: true,
          },
        })
      : null,

    // Fetch stratagems for this faction + detachment (including parent faction)
    prisma.stratagemData.findMany({
      where: detachmentName
        ? {
            AND: [
              factionFilter,
              {
                OR: [
                  { detachment: { equals: detachmentName, mode: 'insensitive' } },
                  { detachment: { contains: detachmentName, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : factionFilter,
      select: {
        name: true,
        cpCost: true,
        when: true,
        target: true,
        effect: true,
      },
      orderBy: { name: 'asc' },
    }),

    // Fetch enhancements for this faction + detachment (including parent faction)
    prisma.enhancement.findMany({
      where: detachmentName
        ? {
            AND: [
              factionFilter,
              {
                OR: [
                  { detachment: { equals: detachmentName, mode: 'insensitive' } },
                  { detachment: { contains: detachmentName, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : factionFilter,
      select: {
        name: true,
        pointsCost: true,
        description: true,
        restrictions: true,
      },
      orderBy: { name: 'asc' },
    }),

    // Fetch faction rules (only for the specific faction, not parent - faction rules are unique)
    prisma.factionRule.findMany({
      where: {
        faction: { equals: faction, mode: 'insensitive' },
      },
      select: {
        name: true,
        type: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    detachment: detachment || null,
    stratagems,
    enhancements,
    factionRules,
  };
}

/**
 * Format detachment context as a prompt section for the LLM
 * Includes tactical usage hints to help the LLM provide actionable advice
 */
export function formatDetachmentContextForPrompt(context: DetachmentContext): string {
  const sections: string[] = [];

  // Detachment ability with tactical emphasis
  if (context.detachment) {
    sections.push(`## DETACHMENT RULES: ${context.detachment.name}`);
    sections.push('**IMPORTANT**: Reference this detachment ability in your Army Quirks if it creates a unique mechanical attribute for this army!');
    sections.push('');
    if (context.detachment.abilityName) {
      sections.push(`**Detachment Ability: ${context.detachment.abilityName}**`);
    }
    if (context.detachment.abilityDescription) {
      sections.push(context.detachment.abilityDescription);
    }
    sections.push('');
  }

  // Faction rules
  if (context.factionRules.length > 0) {
    sections.push(`## FACTION RULES (${context.factionRules.length})`);
    sections.push('Consider how these interact with the detachment and unit abilities:');
    sections.push('');
    for (const rule of context.factionRules) {
      sections.push(`**${rule.name}** (${rule.type})`);
      sections.push(rule.description);
      sections.push('');
    }
  }

  // Stratagems with tactical usage guidance
  if (context.stratagems.length > 0) {
    sections.push(`## AVAILABLE STRATAGEMS (${context.stratagems.length})`);
    sections.push('**CRITICAL**: In your analysis, identify the 2-3 MOST IMPORTANT stratagems for this specific army and explain:');
    sections.push('1. When to save CP for them (what situation triggers their use)');
    sections.push('2. Which units in the army benefit most from each');
    sections.push('3. Priority order if the player has limited CP');
    sections.push('');
    for (const strat of context.stratagems) {
      sections.push(`**${strat.name}** (${strat.cpCost}CP)`);
      sections.push(`- When: ${strat.when}`);
      sections.push(`- Target: ${strat.target}`);
      sections.push(`- Effect: ${strat.effect}`);
      // Add tactical hint based on timing
      const tacticalHint = inferStratagemTacticalHint(strat);
      if (tacticalHint) {
        sections.push(`- **Tactical Use**: ${tacticalHint}`);
      }
      sections.push('');
    }
  }

  // Enhancements with synergy guidance
  if (context.enhancements.length > 0) {
    sections.push(`## AVAILABLE ENHANCEMENTS (${context.enhancements.length})`);
    sections.push('**IMPORTANT**: If any of these are equipped on units in this army, explain how they change:');
    sections.push('1. Target priority (what units to attack/avoid)');
    sections.push('2. Positioning requirements (what range/position maximizes the enhancement)');
    sections.push('3. Synergies with other units or stratagems');
    sections.push('');
    for (const enh of context.enhancements) {
      sections.push(`**${enh.name}** (${enh.pointsCost}pts)`);
      sections.push(`${enh.description}`);
      if (enh.restrictions) {
        sections.push(`Restrictions: ${enh.restrictions}`);
      }
      sections.push('');
    }
  }

  // If nothing found, note that
  if (sections.length === 0) {
    return '## DETACHMENT RULES\nNo detachment-specific rules found in database. Use your knowledge of this faction.';
  }

  return sections.join('\n');
}

/**
 * Infer a tactical usage hint based on stratagem timing and effect
 * This helps the LLM understand when to recommend each stratagem
 */
function inferStratagemTacticalHint(strat: {
  name: string;
  cpCost: number;
  when: string;
  target: string;
  effect: string;
}): string | null {
  const whenLower = strat.when.toLowerCase();
  const effectLower = strat.effect.toLowerCase();
  const nameLower = strat.name.toLowerCase();
  
  // Movement/positioning stratagems
  if (effectLower.includes('move') || effectLower.includes('reposition') || effectLower.includes('advance')) {
    if (whenLower.includes('shooting phase') || whenLower.includes('after')) {
      return 'Use to reposition onto objectives after surviving enemy fire, or to get into charge range.';
    }
    return 'Use for tactical repositioning - contest objectives or escape unfavorable combats.';
  }
  
  // Charge-related stratagems
  if (effectLower.includes('charge') || effectLower.includes('re-roll')) {
    if (effectLower.includes('charge')) {
      return 'Critical for deep striking units or when a failed charge would leave you exposed.';
    }
  }
  
  // Defensive stratagems
  if (whenLower.includes('opponent') && (effectLower.includes('save') || effectLower.includes('wound') || effectLower.includes('damage'))) {
    return 'Save CP for this when a key unit is being targeted - don\'t waste it on expendable units.';
  }
  
  // Offensive stratagems
  if (effectLower.includes('hit') || effectLower.includes('wound') || effectLower.includes('damage') || effectLower.includes('lethal') || effectLower.includes('sustained')) {
    return 'Use on your damage-dealing units when attacking priority targets.';
  }
  
  // Reaction/interrupt stratagems
  if (whenLower.includes('fight') && effectLower.includes('first')) {
    return 'Critical for multi-charges or when you expect to lose units before they swing.';
  }
  
  // Fall back and shoot/charge
  if (effectLower.includes('fall back') && (effectLower.includes('shoot') || effectLower.includes('charge'))) {
    return 'Use to escape tar-pit combats and still contribute damage that turn.';
  }
  
  return null;
}

