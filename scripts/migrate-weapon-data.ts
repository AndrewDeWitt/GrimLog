
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Weapon Data Migration Script
 * 
 * Parses existing string-based weapon stats into new structured fields:
 * - strength -> strengthValue (Int), strengthFormula (String)
 * - damage -> damageValue (Int), damageFormula (String)
 * - armorPenetration -> apValue (Int)
 * - abilities -> structuredAbilities (JSON)
 */

// Regex patterns for parsing
// eslint-disable-next-line security/detect-unsafe-regex -- simple dice formula pattern
const D_NOTATION = /^(\d*)[dD](\d+)(?:\+(\d+))?$/; // e.g. D6, 2D6, D6+1
const FLAT_NUMBER = /^(\d+)$/; // e.g. 4, 1
const MODIFIER = /^([+-]\d+)$/; // e.g. +1, -1
const AP_PATTERN = /^-?(\d+)$/; // e.g. -1, 0, 1 (sometimes written as 1 for AP-1)

async function migrateWeapons() {
  console.log('Starting weapon data migration...');
  
  const weapons = await prisma.weapon.findMany();
  console.log(`Found ${weapons.length} weapons to process.`);
  
  let updatedCount = 0;
  let errorCount = 0;

  for (const weapon of weapons) {
    try {
      const updates: any = {};
      
      // 1. Parse Strength
      // "4" -> val: 4
      // "User" -> formula: "User"
      // "+1" -> formula: "+1"
      if (weapon.strength) {
        const s = weapon.strength.trim();
        if (FLAT_NUMBER.test(s)) {
          updates.strengthValue = parseInt(s);
        } else {
          updates.strengthFormula = s;
        }
      }

      // 2. Parse Damage
      // "2" -> val: 2
      // "D6" -> formula: "D6"
      // "D6+1" -> formula: "D6+1"
      if (weapon.damage) {
        const d = weapon.damage.trim();
        if (FLAT_NUMBER.test(d)) {
          updates.damageValue = parseInt(d);
        } else {
          updates.damageFormula = d;
        }
      }

      // 3. Parse AP
      // "0" -> 0
      // "-1" -> -1
      // "1" -> -1 (AP is usually negative, but sometimes stored as positive magnitude)
      if (weapon.armorPenetration) {
        const apStr = weapon.armorPenetration.trim().replace('AP', '');
        const match = apStr.match(/(-?\d+)/);
        if (match) {
          let val = parseInt(match[1]);
          // Heuristic: If AP is stored as positive "1", "2", treat as negative
          // UNLESS it's 0.
          if (val > 0) val = -val;
          updates.apValue = val;
        }
      }

      // 4. Parse Abilities (JSON Array String -> Structured JSON)
      // ["SUSTAINED HITS 1", "ANTI-VEHICLE 4+"]
      if (weapon.abilities) {
        try {
          const abilitiesRaw = JSON.parse(weapon.abilities);
          if (Array.isArray(abilitiesRaw)) {
            const structured: any[] = [];
            
            for (const ab of abilitiesRaw) {
              const parsed = parseAbilityString(ab);
              if (parsed) structured.push(parsed);
            }
            
            if (structured.length > 0) {
              updates.structuredAbilities = JSON.stringify(structured);
            }
          }
        } catch (e) {
          // Ignore parse errors for abilities, might not be JSON
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await prisma.weapon.update({
          where: { id: weapon.id },
          data: updates
        });
        updatedCount++;
      }
      
    } catch (error) {
      console.error(`Failed to update weapon ${weapon.name}:`, error);
      errorCount++;
    }
  }

  console.log(`Migration complete.`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

/**
 * Parses a weapon ability string into structured data
 * e.g. "SUSTAINED HITS 1" -> { kind: "SUSTAINED_HITS", value: 1 }
 * e.g. "ANTI-VEHICLE 4+" -> { kind: "ANTI", targetKeyword: "VEHICLE", condition: "4+" }
 */
function parseAbilityString(abilityStr: string): any {
  const upper = abilityStr.toUpperCase().trim();
  
  // Anti-X Y+
  if (upper.startsWith('ANTI-')) {
    const match = upper.match(/ANTI-([A-Z\s]+)\s+(\d+\+)/);
    if (match) {
      return {
        type: 'WEAPON',
        kind: 'ANTI',
        targetKeyword: match[1].trim(),
        condition: match[2]
      };
    }
  }
  
  // Sustained Hits X
  if (upper.startsWith('SUSTAINED HITS')) {
    const match = upper.match(/SUSTAINED HITS\s+(\d+|D3)/);
    if (match) {
      // Check if D3
      if (match[1] === 'D3') {
         return { type: 'WEAPON', kind: 'SUSTAINED_HITS', valueText: 'D3' };
      }
      return { type: 'WEAPON', kind: 'SUSTAINED_HITS', value: parseInt(match[1]) };
    }
  }
  
  // Lethal Hits
  if (upper.includes('LETHAL HITS')) {
    return { type: 'WEAPON', kind: 'LETHAL_HITS' };
  }
  
  // Devastating Wounds
  if (upper.includes('DEVASTATING WOUNDS')) {
    return { type: 'WEAPON', kind: 'DEVASTATING_WOUNDS' };
  }
  
  // Twin-Linked
  if (upper.includes('TWIN-LINKED')) {
    return { type: 'WEAPON', kind: 'TWIN_LINKED' };
  }
  
  // Torrent
  if (upper.includes('TORRENT')) {
    return { type: 'WEAPON', kind: 'TORRENT' };
  }
  
  // Ignore Cover
  if (upper.includes('IGNORE COVER') || upper.includes('IGNORES COVER')) {
    return { type: 'WEAPON', kind: 'IGNORES_COVER' };
  }
  
  // Blast
  if (upper.includes('BLAST')) {
    return { type: 'WEAPON', kind: 'BLAST' };
  }
  
  // Heavy
  if (upper.includes('HEAVY')) {
    return { type: 'WEAPON', kind: 'HEAVY' };
  }
  
  // Rapid Fire X
  if (upper.startsWith('RAPID FIRE')) {
    const match = upper.match(/RAPID FIRE\s+(\d+)/);
    if (match) {
      return { type: 'WEAPON', kind: 'RAPID_FIRE', value: parseInt(match[1]) };
    }
  }
  
  // Pistol X (usually just a type, but sometimes treated as ability)
  if (upper.startsWith('PISTOL') && !upper.match(/^PISTOL$/)) {
     const match = upper.match(/PISTOL\s+(\d+)/);
     if (match) {
       return { type: 'WEAPON', kind: 'PISTOL', value: parseInt(match[1]) };
     }
  }
  
  // Assault (Type, but good to flag)
  if (upper === 'ASSAULT') return { type: 'WEAPON', kind: 'ASSAULT' };
  
  // Precision
  if (upper.includes('PRECISION')) {
    return { type: 'WEAPON', kind: 'PRECISION' };
  }
  
  // Hazardous
  if (upper.includes('HAZARDOUS')) {
    return { type: 'WEAPON', kind: 'HAZARDOUS' };
  }
  
  // Melta X
  if (upper.startsWith('MELTA')) {
    const match = upper.match(/MELTA\s+(\d+)/);
    if (match) {
      return { type: 'WEAPON', kind: 'MELTA', value: parseInt(match[1]) };
    }
  }

  // Lance
  if (upper.includes('LANCE')) {
    return { type: 'WEAPON', kind: 'LANCE' };
  }

  // Return generic if matched nothing specific but looks like an ability
  return { type: 'WEAPON', kind: 'OTHER', name: abilityStr };
}

migrateWeapons()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

