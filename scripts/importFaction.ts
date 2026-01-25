/**
 * Faction Import Script
 * 
 * Imports faction data from a JSON file into the database.
 * Creates/updates Faction, Detachment, StratagemData, and Enhancement records.
 * 
 * Usage:
 *   npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json
 *   npx tsx scripts/importFaction.ts data/templates/faction-template.json --dry-run
 * 
 * Options:
 *   --dry-run    Validate JSON without writing to database
 *   --update     Update existing records instead of skipping
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs-extra';
import * as path from 'path';

const prisma = new PrismaClient();

// ============================================
// Type Definitions (matching import-schema.json)
// ============================================

interface StratagemInput {
  name: string;
  cpCost: number;
  type: 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear';
  when: string;
  target: string;
  effect: string;
  restrictions?: string | null;
  keywords?: string[] | null;
  triggerPhase?: string[] | null;
  isReactive?: boolean;
  usageRestriction?: 'once_per_battle' | 'once_per_turn' | 'once_per_phase' | null;
}

interface EnhancementInput {
  name: string;
  pointsCost: number;
  description: string;
  flavorText?: string;
  restrictions?: string[] | null;
  keywords?: string[] | null;
}

interface ArmyRuleInput {
  name: string;
  description: string;
  flavorText?: string;
}

interface DetachmentInput {
  name: string;
  subfaction?: string | null;
  abilityName?: string | null;
  abilityDescription?: string | null;
  description?: string | null;
  stratagems: StratagemInput[];
  enhancements?: EnhancementInput[];
}

interface FactionInput {
  name: string;
  keywords: string[];
  parentFaction?: string | null;
  isDivergent?: boolean;
  forbiddenKeywords?: string[];
}

interface ImportData {
  faction: FactionInput;
  armyRules?: ArmyRuleInput[];
  detachments: DetachmentInput[];
}

// ============================================
// Validation
// ============================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid JSON structure'], warnings: [] };
  }
  
  const d = data as Record<string, unknown>;
  
  // Check required fields
  if (!d.faction || typeof d.faction !== 'object') {
    errors.push('Missing or invalid "faction" object');
  } else {
    const faction = d.faction as Record<string, unknown>;
    if (!faction.name || typeof faction.name !== 'string') {
      errors.push('faction.name is required and must be a string');
    }
    if (!Array.isArray(faction.keywords) || faction.keywords.length === 0) {
      errors.push('faction.keywords is required and must be a non-empty array');
    }
  }
  
  if (!Array.isArray(d.detachments)) {
    errors.push('Missing or invalid "detachments" array');
  } else {
    d.detachments.forEach((det, i) => {
      const detachment = det as Record<string, unknown>;
      if (!detachment.name || typeof detachment.name !== 'string') {
        errors.push(`detachments[${i}].name is required`);
      }
      if (!Array.isArray(detachment.stratagems)) {
        errors.push(`detachments[${i}].stratagems must be an array`);
      } else {
        (detachment.stratagems as unknown[]).forEach((strat, j) => {
          const stratagem = strat as Record<string, unknown>;
          const requiredFields = ['name', 'cpCost', 'type', 'when', 'target', 'effect'];
          requiredFields.forEach(field => {
            if (stratagem[field] === undefined || stratagem[field] === null) {
              errors.push(`detachments[${i}].stratagems[${j}].${field} is required`);
            }
          });
          
          // Type validation
          const validTypes = ['Battle Tactic', 'Strategic Ploy', 'Epic Deed', 'Wargear'];
          if (stratagem.type && !validTypes.includes(stratagem.type as string)) {
            warnings.push(`detachments[${i}].stratagems[${j}].type "${stratagem.type}" is non-standard`);
          }
        });
      }
      
      // Enhancement validation (optional)
      if (detachment.enhancements && Array.isArray(detachment.enhancements)) {
        (detachment.enhancements as unknown[]).forEach((enh, k) => {
          const enhancement = enh as Record<string, unknown>;
          if (!enhancement.name) {
            errors.push(`detachments[${i}].enhancements[${k}].name is required`);
          }
          if (enhancement.pointsCost === undefined) {
            errors.push(`detachments[${i}].enhancements[${k}].pointsCost is required`);
          }
          if (!enhancement.description) {
            errors.push(`detachments[${i}].enhancements[${k}].description is required`);
          }
        });
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================
// Import Logic
// ============================================

interface ImportStats {
  faction: { created: boolean; updated: boolean; name: string };
  armyRules: { created: number; updated: number; skipped: number };
  detachments: { created: number; updated: number; skipped: number };
  stratagems: { created: number; updated: number; skipped: number };
  enhancements: { created: number; updated: number; skipped: number };
}

async function importFactionData(
  data: ImportData,
  options: { dryRun: boolean; update: boolean }
): Promise<ImportStats> {
  const stats: ImportStats = {
    faction: { created: false, updated: false, name: data.faction.name },
    armyRules: { created: 0, updated: 0, skipped: 0 },
    detachments: { created: 0, updated: 0, skipped: 0 },
    stratagems: { created: 0, updated: 0, skipped: 0 },
    enhancements: { created: 0, updated: 0, skipped: 0 },
  };

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made to the database\n');
  }

  // ============================================
  // Step 1: Create/Update Faction
  // ============================================
  console.log(`\n📁 Processing Faction: ${data.faction.name}`);
  
  let parentFactionId: string | null = null;
  if (data.faction.parentFaction) {
    const parent = await prisma.faction.findUnique({
      where: { name: data.faction.parentFaction }
    });
    if (parent) {
      parentFactionId = parent.id;
      console.log(`   └─ Parent faction: ${parent.name}`);
    } else {
      console.log(`   ⚠️  Parent faction "${data.faction.parentFaction}" not found`);
    }
  }

  const factionMetaData = JSON.stringify({
    keywords: data.faction.keywords,
    isDivergent: data.faction.isDivergent ?? false,
    forbiddenKeywords: data.faction.forbiddenKeywords ?? [],
  });

  let faction = await prisma.faction.findUnique({
    where: { name: data.faction.name }
  });

  if (!options.dryRun) {
    if (faction) {
      if (options.update) {
        faction = await prisma.faction.update({
          where: { id: faction.id },
          data: {
            metaData: factionMetaData,
            parentFactionId,
          }
        });
        stats.faction.updated = true;
        console.log(`   ✅ Updated existing faction`);
      } else {
        console.log(`   ⏭️  Faction already exists (use --update to modify)`);
      }
    } else {
      faction = await prisma.faction.create({
        data: {
          name: data.faction.name,
          metaData: factionMetaData,
          parentFactionId,
        }
      });
      stats.faction.created = true;
      console.log(`   ✅ Created new faction`);
    }
  } else {
    console.log(`   📋 Would ${faction ? 'update' : 'create'} faction`);
  }

  const factionId = faction?.id ?? 'dry-run-id';

  // ============================================
  // Step 2: Create/Update Army Rules
  // ============================================
  const armyRules = data.armyRules ?? [];
  if (armyRules.length > 0) {
    console.log(`\n📜 Processing ${armyRules.length} Army Rules...`);
    
    for (const ruleInput of armyRules) {
      const existing = await prisma.factionRule.findFirst({
        where: {
          name: ruleInput.name,
          faction: data.faction.name,
          type: 'army_rule',
        }
      });

      if (!options.dryRun) {
        const ruleData = {
          name: ruleInput.name,
          faction: data.faction.name,
          factionId,
          type: 'army_rule',
          description: ruleInput.description,
          edition: '10th',
        };

        if (existing) {
          if (options.update) {
            await prisma.factionRule.update({
              where: { id: existing.id },
              data: ruleData,
            });
            stats.armyRules.updated++;
            console.log(`   ✅ Updated: ${ruleInput.name}`);
          } else {
            stats.armyRules.skipped++;
            console.log(`   ⏭️  Skipped: ${ruleInput.name}`);
          }
        } else {
          await prisma.factionRule.create({ data: ruleData });
          stats.armyRules.created++;
          console.log(`   ✅ Created: ${ruleInput.name}`);
        }
      } else {
        if (!existing) {
          stats.armyRules.created++;
          console.log(`   📋 Would create: ${ruleInput.name}`);
        } else {
          stats.armyRules.skipped++;
          console.log(`   📋 Already exists: ${ruleInput.name}`);
        }
      }
    }
  }

  // ============================================
  // Step 3: Create/Update Detachments
  // ============================================
  console.log(`\n📋 Processing ${data.detachments.length} Detachments...`);

  for (const detInput of data.detachments) {
    console.log(`\n   🏴 Detachment: ${detInput.name}`);

    let detachment = await prisma.detachment.findFirst({
      where: {
        name: detInput.name,
        faction: data.faction.name,
      }
    });

    if (!options.dryRun) {
      if (detachment) {
        if (options.update) {
          detachment = await prisma.detachment.update({
            where: { id: detachment.id },
            data: {
              subfaction: detInput.subfaction ?? null,
              abilityName: detInput.abilityName ?? null,
              abilityDescription: detInput.abilityDescription ?? null,
              description: detInput.description ?? null,
              factionId,
            }
          });
          stats.detachments.updated++;
          console.log(`      ✅ Updated`);
        } else {
          stats.detachments.skipped++;
          console.log(`      ⏭️  Exists (skipped)`);
        }
      } else {
        detachment = await prisma.detachment.create({
          data: {
            name: detInput.name,
            faction: data.faction.name,
            factionId,
            subfaction: detInput.subfaction ?? null,
            abilityName: detInput.abilityName ?? null,
            abilityDescription: detInput.abilityDescription ?? null,
            description: detInput.description ?? null,
            edition: '10th',
          }
        });
        stats.detachments.created++;
        console.log(`      ✅ Created`);
      }
    } else {
      console.log(`      📋 Would ${detachment ? 'update' : 'create'}`);
      if (!detachment) stats.detachments.created++;
    }

    const detachmentId = detachment?.id ?? 'dry-run-det-id';

    // ============================================
    // Step 4: Create/Update Stratagems
    // ============================================
    console.log(`      📜 Processing ${detInput.stratagems.length} stratagems...`);

    for (const stratInput of detInput.stratagems) {
      const existing = await prisma.stratagemData.findFirst({
        where: {
          name: stratInput.name,
          faction: data.faction.name,
          detachment: detInput.name,
        }
      });

      if (!options.dryRun) {
        const stratData = {
          name: stratInput.name,
          faction: data.faction.name,
          factionId,
          detachment: detInput.name,
          detachmentId,
          cpCost: stratInput.cpCost,
          type: stratInput.type,
          when: stratInput.when,
          target: stratInput.target,
          effect: stratInput.effect,
          restrictions: stratInput.restrictions ?? null,
          keywords: stratInput.keywords ? JSON.stringify(stratInput.keywords) : null,
          triggerPhase: stratInput.triggerPhase ? JSON.stringify(stratInput.triggerPhase) : null,
          isReactive: stratInput.isReactive ?? false,
          usageRestriction: stratInput.usageRestriction ?? null,
          edition: '10th',
        };

        if (existing) {
          if (options.update) {
            await prisma.stratagemData.update({
              where: { id: existing.id },
              data: stratData,
            });
            stats.stratagems.updated++;
          } else {
            stats.stratagems.skipped++;
          }
        } else {
          await prisma.stratagemData.create({ data: stratData });
          stats.stratagems.created++;
        }
      } else {
        if (!existing) stats.stratagems.created++;
        else stats.stratagems.skipped++;
      }
    }

    // ============================================
    // Step 5: Create/Update Enhancements
    // ============================================
    const enhancements = detInput.enhancements ?? [];
    if (enhancements.length > 0) {
      console.log(`      ⚔️  Processing ${enhancements.length} enhancements...`);

      for (const enhInput of enhancements) {
        const existing = await prisma.enhancement.findFirst({
          where: {
            name: enhInput.name,
            faction: data.faction.name,
            detachment: detInput.name,
          }
        });

        if (!options.dryRun) {
          const enhData = {
            name: enhInput.name,
            faction: data.faction.name,
            factionId,
            detachment: detInput.name,
            detachmentId,
            pointsCost: enhInput.pointsCost,
            description: enhInput.description,
            restrictions: enhInput.restrictions ? JSON.stringify(enhInput.restrictions) : '[]',
            keywords: enhInput.keywords ? JSON.stringify(enhInput.keywords) : null,
            edition: '10th',
          };

          if (existing) {
            if (options.update) {
              await prisma.enhancement.update({
                where: { id: existing.id },
                data: enhData,
              });
              stats.enhancements.updated++;
            } else {
              stats.enhancements.skipped++;
            }
          } else {
            await prisma.enhancement.create({ data: enhData });
            stats.enhancements.created++;
          }
        } else {
          if (!existing) stats.enhancements.created++;
          else stats.enhancements.skipped++;
        }
      }
    }
  }

  return stats;
}

// ============================================
// Main CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  // Find the JSON file path (first non-flag argument)
  const filePath = args.find(arg => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const update = args.includes('--update');
  
  if (!filePath) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           📥 FACTION IMPORT SCRIPT                           ║
╠══════════════════════════════════════════════════════════════╣
║  Imports faction data from a JSON file into the database.    ║
║                                                              ║
║  Usage:                                                      ║
║    npx tsx scripts/importFaction.ts <file.json>              ║
║    npx tsx scripts/importFaction.ts <file.json> --dry-run    ║
║    npx tsx scripts/importFaction.ts <file.json> --update     ║
║                                                              ║
║  Options:                                                    ║
║    --dry-run   Validate without writing to database          ║
║    --update    Update existing records instead of skipping   ║
║                                                              ║
║  Example:                                                    ║
║    npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  }

  // Resolve and validate file path
  const resolvedPath = path.resolve(process.cwd(), filePath);
  
  if (!await fs.pathExists(resolvedPath)) {
    console.error(`\n❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`\n🚀 Faction Import Script`);
  console.log(`   File: ${resolvedPath}`);
  console.log(`   Mode: ${dryRun ? 'Dry Run' : 'Live'}`);
  console.log(`   Update existing: ${update ? 'Yes' : 'No'}`);

  // Load and parse JSON
  let data: unknown;
  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    console.error(`\n❌ Failed to parse JSON:`, error);
    process.exit(1);
  }

  // Validate
  console.log(`\n🔍 Validating JSON structure...`);
  const validation = validateImportData(data);
  
  if (validation.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  if (!validation.valid) {
    console.log(`\n❌ Validation errors:`);
    validation.errors.forEach(e => console.log(`   - ${e}`));
    process.exit(1);
  }
  
  console.log(`   ✅ Validation passed`);

  // Import
  const importData = data as ImportData;
  const stats = await importFactionData(importData, { dryRun, update });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Faction: ${stats.faction.name} ${stats.faction.created ? '(created)' : stats.faction.updated ? '(updated)' : '(unchanged)'}`);
  console.log(`   Army Rules:   ${stats.armyRules.created} created, ${stats.armyRules.updated} updated, ${stats.armyRules.skipped} skipped`);
  console.log(`   Detachments:  ${stats.detachments.created} created, ${stats.detachments.updated} updated, ${stats.detachments.skipped} skipped`);
  console.log(`   Stratagems:   ${stats.stratagems.created} created, ${stats.stratagems.updated} updated, ${stats.stratagems.skipped} skipped`);
  console.log(`   Enhancements: ${stats.enhancements.created} created, ${stats.enhancements.updated} updated, ${stats.enhancements.skipped} skipped`);
  
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Remove --dry-run to actually import the data.');
  } else {
    console.log('\n✅ Import completed successfully!');
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('\n💥 Fatal error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { importFactionData, validateImportData, ImportData };

