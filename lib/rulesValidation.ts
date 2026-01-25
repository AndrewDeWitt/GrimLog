/**
 * Rules Validation Engine
 * 
 * Deep validation using datasheet data for:
 * - Combat calculations
 * - Stratagem legality
 * - Leader attachments
 * - Wargear restrictions
 */

import { getDatasheetByName, getWeaponProfile, DatasheetWithRelations } from './datasheetHelpers';

export interface ValidationResult {
  isValid: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  suggestion?: string;
  rule?: string;
}

/**
 * Wound chart for calculating to-wound rolls
 * Returns the required roll (e.g., "2+", "3+", etc.)
 */
export function calculateWoundRoll(attackerStrength: number, defenderToughness: number): string {
  if (attackerStrength >= defenderToughness * 2) {
    return '2+';
  } else if (attackerStrength > defenderToughness) {
    return '3+';
  } else if (attackerStrength === defenderToughness) {
    return '4+';
  } else if (attackerStrength * 2 <= defenderToughness) {
    return '6+';
  } else {
    return '5+';
  }
}

/**
 * Parse strength value (handles "User", "+1", numeric strings)
 */
function parseStrength(strength: string, userStrength?: number): number {
  if (strength.toLowerCase() === 'user') {
    return userStrength || 4; // Default to 4 if not specified
  }
  
  if (strength.startsWith('+') || strength.startsWith('-')) {
    const modifier = parseInt(strength);
    return (userStrength || 4) + modifier;
  }
  
  return parseInt(strength) || 4;
}

/**
 * Parse numeric value with dice notation (e.g., "D6", "2D3")
 */
function parseNumeric(value: string): { min: number; max: number; average: number } {
  // Handle dice notation
  if (value.includes('D')) {
    const match = value.match(/(\d*)D(\d+)/i);
    if (match) {
      const count = match[1] ? parseInt(match[1]) : 1;
      const sides = parseInt(match[2]);
      return {
        min: count,
        max: count * sides,
        average: count * (sides + 1) / 2,
      };
    }
  }
  
  // Handle simple numeric
  const num = parseInt(value);
  if (!isNaN(num)) {
    return { min: num, max: num, average: num };
  }
  
  // Default fallback
  return { min: 1, max: 1, average: 1 };
}

/**
 * Validate weapon range
 */
export async function validateWeaponRange(
  weaponName: string,
  targetDistance?: number
): Promise<ValidationResult> {
  const weapon = await getWeaponProfile(weaponName);
  
  if (!weapon) {
    return {
      isValid: false,
      severity: 'warning',
      message: `Weapon "${weaponName}" not found in datasheet database`,
      suggestion: 'Check weapon name spelling or update datasheets',
    };
  }
  
  if (weapon.range.toLowerCase() === 'melee') {
    if (targetDistance && targetDistance > 2) {
      return {
        isValid: false,
        severity: 'error',
        message: `${weaponName} is a melee weapon (max range 2"), but target is ${targetDistance}" away`,
        suggestion: 'Unit must be within Engagement Range to use melee weapons',
        rule: 'melee_range',
      };
    }
    return {
      isValid: true,
      severity: 'info',
      message: `${weaponName} is a melee weapon (valid at 2" or less)`,
    };
  }
  
  const rangeMatch = weapon.range.match(/(\d+)/);
  if (rangeMatch && targetDistance) {
    const maxRange = parseInt(rangeMatch[1]);
    if (targetDistance > maxRange) {
      return {
        isValid: false,
        severity: 'error',
        message: `${weaponName} has range ${maxRange}", but target is ${targetDistance}" away`,
        suggestion: 'Move closer or choose different target',
        rule: 'weapon_range',
      };
    }
  }
  
  return {
    isValid: true,
    severity: 'info',
    message: `${weaponName} is in range`,
  };
}

/**
 * Validate combat interaction
 */
export async function validateCombat(params: {
  attackerName: string;
  defenderName: string;
  weaponName?: string;
  distance?: number;
  phase?: string;
}): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  // Get datasheets
  const attacker = await getDatasheetByName(params.attackerName);
  const defender = await getDatasheetByName(params.defenderName);
  
  if (!attacker) {
    results.push({
      isValid: false,
      severity: 'error',
      message: `Attacker "${params.attackerName}" not found in datasheet database`,
      suggestion: 'Check unit name spelling or import datasheets',
    });
    return results;
  }
  
  if (!defender) {
    results.push({
      isValid: false,
      severity: 'error',
      message: `Defender "${params.defenderName}" not found in datasheet database`,
      suggestion: 'Check unit name spelling or import datasheets',
    });
    return results;
  }
  
  // Validate phase
  if (params.phase) {
    const isMelee = params.phase.toLowerCase() === 'fight';
    const isShooting = params.phase.toLowerCase() === 'shooting';
    
    if (params.weaponName) {
      const weapon = await getWeaponProfile(params.weaponName);
      if (weapon) {
        const isWeaponMelee = weapon.range.toLowerCase() === 'melee';
        
        if (isMelee && !isWeaponMelee) {
          results.push({
            isValid: false,
            severity: 'error',
            message: `${params.weaponName} is a ranged weapon, cannot be used in Fight phase`,
            suggestion: 'Use melee weapons in Fight phase',
            rule: 'phase_restriction',
          });
        }
        
        if (isShooting && isWeaponMelee) {
          results.push({
            isValid: false,
            severity: 'error',
            message: `${params.weaponName} is a melee weapon, cannot be used in Shooting phase`,
            suggestion: 'Use ranged weapons in Shooting phase',
            rule: 'phase_restriction',
          });
        }
      }
    }
  }
  
  // Validate range
  if (params.weaponName && params.distance) {
    const rangeCheck = await validateWeaponRange(params.weaponName, params.distance);
    results.push(rangeCheck);
  }
  
  // Calculate wound rolls
  if (params.weaponName) {
    const weapon = await getWeaponProfile(params.weaponName);
    if (weapon) {
      const strength = parseStrength(weapon.strength);
      const woundRoll = calculateWoundRoll(strength, defender.toughness);
      
      results.push({
        isValid: true,
        severity: 'info',
        message: `${params.weaponName} (S${strength}) wounds ${defender.name} (T${defender.toughness}) on ${woundRoll}`,
      });
      
      // Check for ANTI- abilities
      const antiAbilities = weapon.abilities.filter((a: any) => a.toUpperCase().startsWith('ANTI-'));
      if (antiAbilities.length > 0) {
        const defenderKeywords = defender.keywords.map(k => k.toUpperCase());
        for (const ability of antiAbilities) {
          const match = ability.match(/ANTI-(\w+)/i);
          if (match) {
            const keyword = match[1].toUpperCase();
            if (defenderKeywords.includes(keyword)) {
              results.push({
                isValid: true,
                severity: 'info',
                message: `${weapon.name} has ${ability} - improved critical wound rolls against ${defender.name}`,
                suggestion: `ANTI-${keyword} ability applies!`,
              });
            }
          }
        }
      }
    }
  }
  
  // If no issues found, add success message
  if (results.every(r => r.isValid)) {
    results.push({
      isValid: true,
      severity: 'info',
      message: `Combat between ${attacker.name} and ${defender.name} is valid`,
    });
  }
  
  return results;
}

/**
 * Validate stratagem use
 */
export async function validateStratagemUse(params: {
  stratagemName: string;
  targetUnit?: string;
  phase?: string;
  cpAvailable?: number;
}): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  // TODO: Implement full stratagem validation once stratagem data is seeded
  // For now, basic CP check
  
  if (params.cpAvailable !== undefined && params.cpAvailable <= 0) {
    results.push({
      isValid: false,
      severity: 'error',
      message: `Not enough CP to use ${params.stratagemName} (0 CP available)`,
      suggestion: 'Wait until next Command phase to gain CP',
      rule: 'cp_cost',
    });
  }
  
  return results;
}

/**
 * Validate leader attachment
 */
export async function validateLeaderAttachment(
  leaderName: string,
  unitName: string
): Promise<ValidationResult> {
  const leader = await getDatasheetByName(leaderName);
  const unit = await getDatasheetByName(unitName);
  
  if (!leader) {
    return {
      isValid: false,
      severity: 'error',
      message: `Leader "${leaderName}" not found in datasheet database`,
    };
  }
  
  if (!unit) {
    return {
      isValid: false,
      severity: 'error',
      message: `Unit "${unitName}" not found in datasheet database`,
    };
  }
  
  // Check if leader has LEADER keyword
  const hasLeaderKeyword = leader.keywords.some(k => k.toUpperCase() === 'LEADER');
  if (!hasLeaderKeyword) {
    return {
      isValid: false,
      severity: 'error',
      message: `${leaderName} does not have the LEADER keyword and cannot be attached`,
      rule: 'leader_keyword',
    };
  }
  
  // Check leader rules (if specified)
  if (leader.leaderRules) {
    const canLead = leader.leaderRules.toLowerCase().includes(unit.name.toLowerCase());
    
    if (!canLead) {
      return {
        isValid: false,
        severity: 'warning',
        message: `${leaderName} may not be able to lead ${unitName}`,
        suggestion: `Check leader rules: ${leader.leaderRules}`,
        rule: 'leader_attachment',
      };
    }
  }
  
  return {
    isValid: true,
    severity: 'info',
    message: `${leaderName} can be attached to ${unitName}`,
  };
}

/**
 * Validate wargear legality (basic check)
 */
export async function validateWargearLegality(
  unitName: string,
  wargear: string
): Promise<ValidationResult> {
  const datasheet = await getDatasheetByName(unitName);
  
  if (!datasheet) {
    return {
      isValid: false,
      severity: 'error',
      message: `Unit "${unitName}" not found in datasheet database`,
    };
  }
  
  // Check if wargear is in weapons list
  const hasWeapon = datasheet.weapons.some(w => 
    w.name.toLowerCase().includes(wargear.toLowerCase())
  );
  
  if (hasWeapon) {
    return {
      isValid: true,
      severity: 'info',
      message: `${unitName} can equip ${wargear}`,
    };
  }
  
  return {
    isValid: false,
    severity: 'warning',
    message: `${wargear} not found in ${unitName}'s weapon list`,
    suggestion: 'Check wargear options on datasheet',
    rule: 'wargear_options',
  };
}

