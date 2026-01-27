/**
 * Brief Shared Context Builder
 *
 * Builds the shared system prompt prefix used by all 3 brief LLM calls:
 * 1. Army Parse
 * 2. Brief Analysis
 * 3. List Suggestions
 *
 * By placing identical content at the START of the system prompt,
 * Gemini's implicit caching can reuse the prefix across sequential calls,
 * reducing costs by ~60-70% per brief.
 *
 * CRITICAL: The content order and formatting MUST be identical across all calls
 * for cache hits to work. Do not add call-specific content to this prefix.
 */

import { DatasheetWithWeaponsAndAbilities } from './briefSuggestions';
import { DetachmentContext } from './fetchDetachmentContext';

// Type for faction rules from DetachmentContext
interface FactionRule {
  name: string;
  type: string;
  description: string;
}

/**
 * Builds the shared system prompt prefix used by all 3 brief LLM calls.
 * Content is placed FIRST to maximize Gemini implicit cache hits.
 *
 * Section order (DO NOT CHANGE - affects cache key):
 * 1. FACTION DATASHEETS (largest, ~80-100K tokens)
 * 2. KNOWN DETACHMENTS (list of valid detachments)
 * 3. FACTION RULES (Oath of Moment, etc.)
 * 4. DETACHMENT CONTEXT (selected detachment ability, stratagems, enhancements)
 *
 * @param datasheets - All datasheets available to the faction (including parent faction)
 * @param knownDetachments - Formatted string of known detachments by faction
 * @param factionRules - Faction-specific rules (from DetachmentContext)
 * @param detachmentContext - Selected detachment's ability, stratagems, enhancements
 * @returns Formatted system prompt prefix string
 */
export function buildSharedSystemPrefix(
  datasheets: DatasheetWithWeaponsAndAbilities[],
  knownDetachments: string,
  factionRules: FactionRule[],
  detachmentContext: DetachmentContext
): string {
  const sections: string[] = [];

  // Section 1: Faction datasheets (largest section, ~80-100K tokens)
  sections.push('## REFERENCE DATA: FACTION DATASHEETS');
  sections.push('Use these datasheets for matching, analysis, and suggestions.');
  sections.push('Each datasheet includes: stats, weapons with IDs, abilities with IDs, keywords, competitive context.');
  sections.push('');
  sections.push(formatDatasheetsForSharedPrefix(datasheets));

  // Section 2: Known detachments (for validation)
  sections.push('');
  sections.push('## KNOWN DETACHMENTS');
  sections.push('Valid detachments by faction. Use this to validate detected detachment names.');
  sections.push('');
  sections.push(knownDetachments);

  // Section 3: Faction rules (Oath of Moment, etc.)
  if (factionRules && factionRules.length > 0) {
    sections.push('');
    sections.push(`## FACTION RULES (${factionRules.length})`);
    sections.push('These rules apply to all units in the army:');
    sections.push('');
    for (const rule of factionRules) {
      sections.push(`**${rule.name}** (${rule.type})`);
      sections.push(rule.description);
      sections.push('');
    }
  }

  // Section 4: Detachment context (ability, stratagems, enhancements)
  if (detachmentContext.detachment) {
    sections.push('');
    sections.push(formatDetachmentContextForSharedPrefix(detachmentContext));
  }

  return sections.join('\n');
}

/**
 * Format datasheets with full detail for cache prefix.
 * Includes IDs for parser, competitive context for analysis, full stats for suggestions.
 *
 * IMPORTANT: Sort alphabetically for consistent cache key across calls.
 */
function formatDatasheetsForSharedPrefix(
  datasheets: DatasheetWithWeaponsAndAbilities[]
): string {
  if (datasheets.length === 0) {
    return 'No datasheets available.';
  }

  // Sort alphabetically for consistent cache key
  const sorted = [...datasheets].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  return sorted.map(ds => formatDatasheetFull(ds)).join('\n\n');
}

/**
 * Format a single datasheet with FULL details needed by all 3 calls:
 * - Parser needs: IDs, names, weapons, abilities
 * - Analysis needs: stats, keywords, competitive context, leader rules
 * - Suggestions needs: points tiers, composition, full weapon stats
 */
function formatDatasheetFull(ds: DatasheetWithWeaponsAndAbilities): string {
  const lines: string[] = [];

  // Parse points tiers for display
  let pointsStr = `${ds.pointsCost}pts`;
  let pointsTiers: Array<{ models: number; points: number }> | null = null;
  if (ds.pointsTiers) {
    try {
      pointsTiers = typeof ds.pointsTiers === 'string' ? JSON.parse(ds.pointsTiers) : ds.pointsTiers;
      if (pointsTiers && pointsTiers.length > 1) {
        pointsStr = pointsTiers.map(t => `${t.models}=${t.points}pts`).join(', ');
      }
    } catch {
      // Use base points if parsing fails
    }
  }

  // Header with ID and basic info
  lines.push(`[${ds.id}] DATASHEET: "${ds.name}" (${pointsStr})`);
  lines.push(`  Faction: ${ds.faction}${ds.subfaction ? ` (${ds.subfaction})` : ''} | Role: ${ds.role}`);

  // Stats line
  const saveStr = ds.invulnerableSave ? `${ds.save}/${ds.invulnerableSave}` : ds.save;
  lines.push(`  Stats: M:${ds.movement} T:${ds.toughness} SV:${saveStr} W:${ds.wounds} LD:${ds.leadership} OC:${ds.objectiveControl}`);

  // Keywords (important for detachment interactions)
  try {
    const keywords = JSON.parse(ds.keywords || '[]');
    if (keywords.length > 0) {
      lines.push(`  Keywords: ${keywords.join(', ')}`);
    }
  } catch {
    if (ds.keywords) {
      lines.push(`  Keywords: ${ds.keywords}`);
    }
  }

  // Composition info (for model count accuracy)
  if (ds.composition) {
    lines.push(`  Composition: ${ds.composition}`);
  }
  if (ds.unitSize) {
    lines.push(`  Unit Size: ${ds.unitSize}`);
  }

  // Leader rules (critical for character attachment logic)
  if (ds.leaderRules) {
    lines.push(`  Can Lead: ${ds.leaderRules}`);
  }
  if (ds.leaderAbilities) {
    lines.push(`  Leader Bonus: ${ds.leaderAbilities}`);
  }

  // Weapons with IDs (for parser matching)
  if (ds.weapons && ds.weapons.length > 0) {
    lines.push('  WEAPONS:');
    for (const dw of ds.weapons) {
      const w = dw.weapon;
      // Parse abilities
      let abilities: string[] = [];
      try {
        abilities = JSON.parse(w.abilities || '[]');
      } catch {
        if (w.abilities) abilities = [w.abilities];
      }
      const abilitiesStr = abilities.length > 0 ? ` | ${abilities.join(', ')}` : '';

      // Skill (BS or WS based on weapon type)
      const isMelee = w.range === 'Melee' || w.weaponSkill;
      const skillStr = isMelee ? (w.weaponSkill || 'WS3+') : (w.ballisticSkill || 'BS3+');

      lines.push(`    [${w.name}] ${w.range} | A${w.attacks} | ${skillStr} | S${w.strength} AP${w.armorPenetration} D${w.damage}${abilitiesStr}`);
    }
  }

  // Abilities with IDs (for parser matching)
  if (ds.abilities && ds.abilities.length > 0) {
    lines.push('  ABILITIES:');

    // Group by type for readability
    const coreAbilities = ds.abilities.filter(da => da.ability?.type === 'core');
    const factionAbilities = ds.abilities.filter(da => da.ability?.type === 'faction');
    const unitAbilities = ds.abilities.filter(da => da.ability?.type === 'unit');
    const wargearAbilities = ds.abilities.filter(da => da.ability?.type === 'wargear');
    const leaderAbilities = ds.abilities.filter(da => da.ability?.type === 'leader');

    // Format each group
    for (const da of coreAbilities) {
      lines.push(`    [${da.ability.name}] (core)`);
    }
    for (const da of factionAbilities) {
      lines.push(`    [${da.ability.name}] (faction)`);
    }
    for (const da of unitAbilities) {
      // Include description for unit abilities (needed for analysis)
      const desc = da.ability.description || '';
      const shortDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
      lines.push(`    [${da.ability.name}] (unit) - ${shortDesc}`);
    }
    for (const da of leaderAbilities) {
      const desc = da.ability.description || '';
      const shortDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
      lines.push(`    [${da.ability.name}] (leader) - ${shortDesc}`);
    }
    for (const da of wargearAbilities) {
      // Include description for wargear (may affect wounds)
      const desc = da.ability.description || '';
      const shortDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
      lines.push(`    [${da.ability.name}] (wargear) - ${shortDesc}`);
    }
  }

  // Competitive context (for analysis quality)
  if (ds.competitiveTier || ds.synergies || ds.playstyleNotes) {
    lines.push('  COMPETITIVE CONTEXT:');

    if (ds.competitiveTier) {
      lines.push(`    Tier: ${ds.competitiveTier}`);
    }
    if (ds.tierReasoning) {
      lines.push(`    Reasoning: ${ds.tierReasoning}`);
    }
    if (ds.synergies) {
      try {
        const synergies = JSON.parse(ds.synergies);
        if (Array.isArray(synergies) && synergies.length > 0) {
          // Handle both string[] and structured synergy formats
          const formatted = synergies.map((s: string | { unit: string; why: string }) =>
            typeof s === 'object' && s !== null && 'unit' in s
              ? `${s.unit}: ${s.why}`
              : s
          );
          lines.push(`    Synergies: ${formatted.join('; ')}`);
        }
      } catch {
        lines.push(`    Synergies: ${ds.synergies}`);
      }
    }
    if (ds.counters) {
      try {
        const counters = JSON.parse(ds.counters);
        if (Array.isArray(counters) && counters.length > 0) {
          lines.push(`    Countered by: ${counters.join(', ')}`);
        }
      } catch {
        lines.push(`    Countered by: ${ds.counters}`);
      }
    }
    if (ds.playstyleNotes) {
      lines.push(`    Playstyle: ${ds.playstyleNotes}`);
    }
    if (ds.deploymentTips) {
      lines.push(`    Deployment: ${ds.deploymentTips}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format detachment context for the shared prefix.
 * Includes ability, stratagems, and enhancements.
 */
function formatDetachmentContextForSharedPrefix(context: DetachmentContext): string {
  const sections: string[] = [];

  // Detachment ability
  if (context.detachment) {
    sections.push(`## DETACHMENT RULES: ${context.detachment.name}`);
    if (context.detachment.abilityName) {
      sections.push(`**Detachment Ability: ${context.detachment.abilityName}**`);
    }
    if (context.detachment.abilityDescription) {
      sections.push(context.detachment.abilityDescription);
    }
    sections.push('');
  }

  // Stratagems
  if (context.stratagems.length > 0) {
    sections.push(`## AVAILABLE STRATAGEMS (${context.stratagems.length})`);
    for (const strat of context.stratagems) {
      sections.push(`**${strat.name}** (${strat.cpCost}CP)`);
      sections.push(`- When: ${strat.when}`);
      sections.push(`- Target: ${strat.target}`);
      sections.push(`- Effect: ${strat.effect}`);
      sections.push('');
    }
  }

  // Enhancements
  if (context.enhancements.length > 0) {
    sections.push(`## AVAILABLE ENHANCEMENTS (${context.enhancements.length})`);
    for (const enh of context.enhancements) {
      sections.push(`**${enh.name}** (${enh.pointsCost}pts)`);
      sections.push(enh.description);
      if (enh.restrictions) {
        sections.push(`Restrictions: ${enh.restrictions}`);
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Get the character count and estimated token count for monitoring
 */
export function getSharedPrefixStats(prefix: string): {
  charCount: number;
  estimatedTokens: number;
} {
  return {
    charCount: prefix.length,
    // Rough estimate: ~4 chars per token for English text
    estimatedTokens: Math.ceil(prefix.length / 4),
  };
}
