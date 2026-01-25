/**
 * Weapon Rules Engine
 * 
 * Implements 10th Edition weapon selection rules:
 * - Phase filtering (Shooting → ranged weapons, Fight → melee weapons)
 * - Pistol rules (can shoot in Engagement Range, MONSTER/VEHICLE exception)
 * - Profile grouping (e.g., "Axe Morkai — strike/sweep")
 * - Extra Attacks handling
 * - Attack modifiers (BLAST, RAPID FIRE, MELTA)
 */

import {
  WeaponType,
  CombatPhase,
  ParsedWeaponAbility,
  WeaponProfile,
  EligibleWeaponsResult,
  WeaponEligibilityInput,
} from './types';
import { parseDiceAverage } from './damageCalculation';

/**
 * Classify weapon type based on range
 */
export function classifyWeaponType(range: string, type?: string): WeaponType {
  const normalizedRange = range.toLowerCase().trim();
  const normalizedType = (type || '').toLowerCase().trim();
  
  // Check for melee
  if (normalizedRange === 'melee' || normalizedType === 'melee') {
    return 'melee';
  }
  
  // Check for pistol (by type string containing "pistol")
  if (normalizedType.includes('pistol')) {
    return 'pistol';
  }
  
  // Check for pistol by range format (e.g., "12\"" with type "Pistol 1")
  // Some weapons have "Pistol" in their type field
  if (normalizedType.startsWith('pistol')) {
    return 'pistol';
  }
  
  // Default to ranged
  return 'ranged';
}

/**
 * Parse structured abilities from JSON string
 */
export function parseStructuredAbilities(abilitiesJson: string | null): ParsedWeaponAbility[] {
  if (!abilitiesJson) return [];
  
  try {
    const parsed = JSON.parse(abilitiesJson);
    if (Array.isArray(parsed)) {
      return parsed.map(a => ({
        kind: a.kind || a.type || '',
        value: a.value,
        condition: a.condition,
        targetKeyword: a.targetKeyword,
      }));
    }
  } catch (e) {
    // Try parsing from abilities string array
  }
  
  return [];
}

/**
 * Parse abilities from string array (fallback for weapons without structuredAbilities)
 */
export function parseAbilitiesFromArray(abilitiesJson: string | null | undefined): ParsedWeaponAbility[] {
  if (!abilitiesJson) return [];
  
  try {
    const parsed = JSON.parse(abilitiesJson);
    if (!Array.isArray(parsed)) return [];
    
    // Also check weapon name for [extra attacks] pattern (some datasheets include it in name)
    // This is handled separately in createWeaponProfile
    
    return parsed.map((abilityStr: string) => {
      const normalized = abilityStr.toUpperCase().replace(/\s+/g, '_');
      
      // Parse common abilities
      // RAPID FIRE X
      const rapidFireMatch = abilityStr.match(/rapid\s*fire\s*(\d+)/i);
      if (rapidFireMatch) {
        return { kind: 'RAPID_FIRE', value: parseInt(rapidFireMatch[1]) };
      }
      
      // SUSTAINED HITS X
      const sustainedMatch = abilityStr.match(/sustained\s*hits?\s*(\d+)/i);
      if (sustainedMatch) {
        return { kind: 'SUSTAINED_HITS', value: parseInt(sustainedMatch[1]) };
      }
      
      // ANTI-X Y+
      const antiMatch = abilityStr.match(/anti[- ](\w+)\s*(\d+)\+/i);
      if (antiMatch) {
        return { kind: 'ANTI', targetKeyword: antiMatch[1].toUpperCase(), condition: `${antiMatch[2]}+` };
      }
      
      // BLAST
      if (/blast/i.test(abilityStr)) {
        return { kind: 'BLAST' };
      }
      
      // MELTA X
      // eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifier, controlled ability string
      const meltaMatch = abilityStr.match(/melta\s{0,10}(\d+)?/i);
      if (meltaMatch) {
        return { kind: 'MELTA', value: meltaMatch[1] ? parseInt(meltaMatch[1]) : undefined };
      }
      
      // DEVASTATING WOUNDS
      if (/devastating\s*wounds?/i.test(abilityStr)) {
        return { kind: 'DEVASTATING_WOUNDS' };
      }
      
      // LETHAL HITS
      if (/lethal\s*hits?/i.test(abilityStr)) {
        return { kind: 'LETHAL_HITS' };
      }
      
      // LANCE
      if (/lance/i.test(abilityStr)) {
        return { kind: 'LANCE' };
      }
      
      // HEAVY
      if (/heavy/i.test(abilityStr)) {
        return { kind: 'HEAVY' };
      }
      
      // ASSAULT
      if (/assault/i.test(abilityStr)) {
        return { kind: 'ASSAULT' };
      }
      
      // TWIN-LINKED
      if (/twin[- ]?linked/i.test(abilityStr)) {
        return { kind: 'TWIN_LINKED' };
      }
      
      // TORRENT
      if (/torrent/i.test(abilityStr)) {
        return { kind: 'TORRENT' };
      }
      
      // IGNORES COVER
      if (/ignores?\s*cover/i.test(abilityStr)) {
        return { kind: 'IGNORES_COVER' };
      }
      
      // EXTRA ATTACKS
      if (/extra\s*attacks?/i.test(abilityStr)) {
        return { kind: 'EXTRA_ATTACKS' };
      }
      
      // Default: return the ability as-is
      return { kind: normalized };
    });
  } catch (e) {
    return [];
  }
}

/**
 * Extract profile group from weapon name
 * e.g., "Axe Morkai — strike" → group: "Axe Morkai", variant: "strike"
 */
export function extractProfileGroup(weaponName: string): { group: string | undefined; variant: string | undefined } {
  // Common separators for profile variants
  const separators = [' — ', ' – ', ' - '];
  
  for (const sep of separators) {
    if (weaponName.includes(sep)) {
      const parts = weaponName.split(sep);
      if (parts.length === 2) {
        return {
          group: parts[0].trim(),
          variant: parts[1].trim().toLowerCase(),
        };
      }
    }
  }
  
  // Check for parenthetical variants like "Weapon Name (strike)"
  const parenMatch = weaponName.match(/^(.+?)\s*\((\w+)\)$/);
  if (parenMatch) {
    return {
      group: parenMatch[1].trim(),
      variant: parenMatch[2].toLowerCase(),
    };
  }
  
  return { group: undefined, variant: undefined };
}

/**
 * Calculate total attacks for a weapon considering modifiers
 */
export function calculateTotalAttacks(
  baseAttacks: string,
  modelCount: number,
  abilities: ParsedWeaponAbility[],
  modifiers: {
    isRapidFireRange?: boolean;
    targetModelCount?: number;
  }
): number {
  let attacks = parseDiceAverage(baseAttacks);
  
  // RAPID FIRE: Double attacks at half range
  if (modifiers.isRapidFireRange) {
    const rapidFire = abilities.find(a => a.kind === 'RAPID_FIRE');
    if (rapidFire && rapidFire.value) {
      attacks += rapidFire.value;
    }
  }
  
  // BLAST: Minimum 3 attacks if target has 6+ models, minimum D6 attacks if 11+
  const blast = abilities.find(a => a.kind === 'BLAST');
  if (blast && modifiers.targetModelCount) {
    if (modifiers.targetModelCount >= 11) {
      // Minimum D6 (3.5 average), but we use at least D6 average
      attacks = Math.max(attacks, 3.5);
    } else if (modifiers.targetModelCount >= 6) {
      // Minimum 3 attacks
      attacks = Math.max(attacks, 3);
    }
  }
  
  // Multiply by model count
  return attacks * modelCount;
}

/**
 * Convert raw weapon data to WeaponProfile
 */
export function createWeaponProfile(
  weapon: WeaponEligibilityInput['weapons'][0]['weapon'],
  quantity: string | null | undefined,
  modelCount: number,
  modifiers: { isRapidFireRange?: boolean; targetModelCount?: number }
): WeaponProfile {
  const type = classifyWeaponType(weapon.range, weapon.type);
  
  // Parse abilities - try structured first, fall back to array
  let abilities = parseStructuredAbilities(weapon.structuredAbilities || null);
  if (abilities.length === 0) {
    abilities = parseAbilitiesFromArray(weapon.abilities);
  }
  
  // Check weapon name for [extra attacks] pattern - some datasheets include it in the name
  // E.g., "Tyrnak and Fenrir [extra attacks]"
  if (/\[extra\s*attacks?\]/i.test(weapon.name)) {
    const hasExtraAttacks = abilities.some(a => a.kind === 'EXTRA_ATTACKS');
    if (!hasExtraAttacks) {
      abilities.push({ kind: 'EXTRA_ATTACKS' });
    }
  }
  
  // Calculate attacks
  const attacksAverage = calculateTotalAttacks(
    weapon.attacks,
    modelCount,
    abilities,
    modifiers
  );
  
  // Parse profile group
  const { group, variant } = extractProfileGroup(weapon.name);
  
  return {
    id: weapon.id,
    name: weapon.name,
    range: weapon.range,
    type,
    attacks: weapon.attacks,
    attacksAverage,
    ballisticSkill: weapon.ballisticSkill || undefined,
    weaponSkill: weapon.weaponSkill || undefined,
    strength: weapon.strengthValue || parseInt(weapon.strength) || 4,
    ap: weapon.apValue ?? (parseInt(weapon.armorPenetration) || 0),
    damage: weapon.damageValue || parseDiceAverage(weapon.damage || '1'),
    damageRaw: weapon.damage,
    abilities,
    profileGroup: group,
    profileVariant: variant,
  };
}

/**
 * Check if unit has MONSTER or VEHICLE keyword
 */
function isMonsterOrVehicle(keywords: string[]): boolean {
  const normalized = keywords.map(k => k.toUpperCase());
  return normalized.includes('MONSTER') || normalized.includes('VEHICLE');
}

/**
 * Main function: Get eligible weapons for a given phase
 * 
 * 10th Edition Rules:
 * - Shooting Phase: Use ranged weapons (unless in Engagement Range → only Pistols)
 * - Fight Phase: Use melee weapons
 * - Pistols: Can be fired in Engagement Range instead of other ranged weapons
 * - MONSTER/VEHICLE: Can use all ranged weapons, not just Pistols, in Engagement Range
 * - Extra Attacks: Weapons with this ability provide additional attacks (not replacement)
 */
export function getEligibleWeapons(input: WeaponEligibilityInput): EligibleWeaponsResult {
  const {
    phase,
    weapons,
    modelCount,
    unitKeywords = [],
    isRapidFireRange,
    targetModelCount,
  } = input;
  
  // Convert all weapons to profiles
  const allProfiles: WeaponProfile[] = weapons.map(w => 
    createWeaponProfile(w.weapon, w.quantity, modelCount, { isRapidFireRange, targetModelCount })
  );
  
  // Identify Extra Attacks weapons FIRST (they're used in ADDITION, not as primary)
  // In 10th Edition, Extra Attacks weapons are typically melee and used in Fight phase
  const allExtraAttackWeapons = allProfiles.filter(w => 
    w.abilities.some(a => a.kind === 'EXTRA_ATTACKS')
  );
  
  // Filter extra attacks by phase - melee extra attacks for Fight, ranged for Shooting
  const extraAttackWeapons = allExtraAttackWeapons.filter(w => 
    phase === 'Fight' ? w.type === 'melee' : w.type === 'ranged' || w.type === 'pistol'
  );
  
  const extraAttackIds = new Set(allExtraAttackWeapons.map(w => w.id));
  
  // Categorize weapons (excluding Extra Attacks from normal categories)
  const rangedWeapons = allProfiles.filter(w => 
    w.type === 'ranged' && !extraAttackIds.has(w.id)
  );
  const meleeWeapons = allProfiles.filter(w => 
    w.type === 'melee' && !extraAttackIds.has(w.id)
  );
  const pistolWeapons = allProfiles.filter(w => 
    w.type === 'pistol' && !extraAttackIds.has(w.id)
  );
  
  let primaryWeapons: WeaponProfile[] = [];
  let eligiblePistols: WeaponProfile[] = [];
  
  if (phase === 'Shooting') {
    // Shooting Phase: Use ranged weapons
    // If in Engagement Range (not tracked here), would only allow Pistols
    // MONSTER/VEHICLE can use all ranged weapons even in Engagement Range
    
    if (isMonsterOrVehicle(unitKeywords)) {
      // MONSTER/VEHICLE: Can use all ranged + pistols
      primaryWeapons = [...rangedWeapons, ...pistolWeapons];
    } else {
      // Normal units: Ranged weapons (Pistols handled separately if in Engagement Range)
      primaryWeapons = rangedWeapons;
      eligiblePistols = pistolWeapons;
    }
  } else if (phase === 'Fight') {
    // Fight Phase: Use melee weapons (excluding Extra Attacks weapons)
    primaryWeapons = meleeWeapons;
    // Pistols can also be used in Fight phase (within Engagement Range)
    eligiblePistols = pistolWeapons;
  }
  
  // Build profile groups
  const profileGroups: { [groupName: string]: WeaponProfile[] } = {};
  for (const weapon of [...primaryWeapons, ...eligiblePistols]) {
    if (weapon.profileGroup) {
      if (!profileGroups[weapon.profileGroup]) {
        profileGroups[weapon.profileGroup] = [];
      }
      profileGroups[weapon.profileGroup].push(weapon);
    }
  }
  
  // Calculate total attacks
  const totalAttacks = primaryWeapons.reduce((sum, w) => sum + w.attacksAverage, 0) +
    extraAttackWeapons.reduce((sum, w) => sum + w.attacksAverage, 0);
  
  return {
    phase,
    weapons: allProfiles,
    primaryWeapons,
    pistolWeapons: eligiblePistols,
    extraAttackWeapons,
    modelCount,
    totalAttacks,
    profileGroups,
  };
}

/**
 * Find best weapon for a target
 * Uses heuristic: Strength * Damage (adjusted for AP)
 */
export function findBestWeapon(
  weapons: WeaponProfile[],
  defenderToughness: number,
  defenderSave: number
): WeaponProfile | null {
  if (weapons.length === 0) return null;
  
  return weapons.reduce((best, current) => {
    // Simple heuristic: Higher strength + higher AP + higher damage = better
    // Weight more heavily towards weapons that wound on 3+ or better
    const strengthScore = current.strength >= defenderToughness * 2 ? 3 :
                          current.strength > defenderToughness ? 2 :
                          current.strength === defenderToughness ? 1 : 0.5;
    
    // AP improves chance of failed saves
    const apScore = Math.abs(current.ap);
    
    // Damage is multiplicative
    const damageScore = current.damage;
    
    // Attacks matter
    const attacksScore = current.attacksAverage;
    
    const currentScore = strengthScore * (1 + apScore * 0.2) * damageScore * Math.sqrt(attacksScore);
    
    const bestStrengthScore = best.strength >= defenderToughness * 2 ? 3 :
                              best.strength > defenderToughness ? 2 :
                              best.strength === defenderToughness ? 1 : 0.5;
    const bestApScore = Math.abs(best.ap);
    const bestDamageScore = best.damage;
    const bestAttacksScore = best.attacksAverage;
    const bestScore = bestStrengthScore * (1 + bestApScore * 0.2) * bestDamageScore * Math.sqrt(bestAttacksScore);
    
    return currentScore > bestScore ? current : best;
  });
}

/**
 * Find weapon by name (fuzzy match)
 */
export function findWeaponByName(weapons: WeaponProfile[], name: string): WeaponProfile | null {
  const normalizedSearch = name.toLowerCase().trim();
  
  // Exact match
  const exact = weapons.find(w => w.name.toLowerCase() === normalizedSearch);
  if (exact) return exact;
  
  // Contains match
  const contains = weapons.find(w => 
    w.name.toLowerCase().includes(normalizedSearch) ||
    normalizedSearch.includes(w.name.toLowerCase())
  );
  if (contains) return contains;
  
  // Profile group match (e.g., "axe morkai" matches "Axe Morkai — strike")
  const groupMatch = weapons.find(w => 
    w.profileGroup?.toLowerCase() === normalizedSearch
  );
  if (groupMatch) return groupMatch;
  
  return null;
}

/**
 * Get all weapons in a profile group
 */
export function getProfileGroupWeapons(weapons: WeaponProfile[], groupName: string): WeaponProfile[] {
  const normalizedGroup = groupName.toLowerCase().trim();
  return weapons.filter(w => w.profileGroup?.toLowerCase() === normalizedGroup);
}

/**
 * Format weapon profile for display
 */
export function formatWeaponProfile(weapon: WeaponProfile): string {
  const abilityStr = weapon.abilities.length > 0 
    ? ` [${weapon.abilities.map(a => a.kind.replace(/_/g, ' ')).join(', ')}]`
    : '';
  
  const skill = weapon.type === 'melee' ? weapon.weaponSkill : weapon.ballisticSkill;
  
  return `${weapon.name}: ${weapon.range}, A:${weapon.attacks}, ${skill} to hit, S:${weapon.strength}, AP:${weapon.ap}, D:${weapon.damageRaw}${abilityStr}`;
}

