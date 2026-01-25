/**
 * Gameplay Rules Seeding Script
 * 
 * Imports parsed rules from JSON files into the database.
 * Handles versioning, deduplication, and specialized table population.
 * 
 * Usage:
 *   npx tsx scripts/seedGameplayRules.ts --sync          # Import all rules
 *   npx tsx scripts/seedGameplayRules.ts --category <cat> # Import specific category
 *   npx tsx scripts/seedGameplayRules.ts --dry-run       # Preview without writing
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import cliProgress from 'cli-progress';

const prisma = new PrismaClient();

const PARSED_RULES_DIR = path.join(process.cwd(), 'data', 'parsed-rules');
const REGISTRY_PATH = path.join(process.cwd(), 'data', 'rules-source', 'rules-registry.json');

// ============================================
// Types
// ============================================

interface ParsedRulesFile {
  rules: any[];
  sources: Array<{
    id: string;
    name: string;
    version: string;
    lastExtracted: string;
  }>;
}

interface ImportStats {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
}

// ============================================
// Rule Importers
// ============================================

async function importSecondaryObjectives(
  rules: any[],
  dryRun: boolean = false
): Promise<ImportStats> {
  const stats: ImportStats = { added: 0, updated: 0, skipped: 0, errors: 0 };
  
  console.log(`\n📊 Importing ${rules.length} secondary objectives...`);
  
  for (const rule of rules) {
    try {
      // Check if secondary already exists
      const existing = await prisma.secondaryObjective.findUnique({
        where: { name: rule.name },
        include: { gameRule: true }
      });
      
      if (existing) {
        // Check if update is needed
        if (existing.gameRule.sourceVersion !== rule.sourceVersion) {
          console.log(`  ↻ Updating: ${rule.name} (${existing.gameRule.sourceVersion} → ${rule.sourceVersion})`);
          
          if (!dryRun) {
            // Update GameRule
            await prisma.gameRule.update({
              where: { id: existing.gameRuleId },
              data: {
                sourceVersion: rule.sourceVersion,
                description: rule.description,
                ruleData: rule,
                updatedAt: new Date()
              }
            });
            
            // Update SecondaryObjective
            await prisma.secondaryObjective.update({
              where: { id: existing.id },
              data: {
                category: rule.category,
                type: rule.type,
                scoringType: rule.scoringType,
                vpCalculation: rule.vpCalculation,
                maxVPPerTurn: rule.maxVPPerTurn,
                maxVPTotal: rule.maxVPTotal,
                description: rule.description,
                scoringTrigger: rule.scoringTrigger,
                requiredKeywords: rule.requiredKeywords,
                updatedAt: new Date()
              }
            });
          }
          
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } else {
        console.log(`  + Adding: ${rule.name}`);
        
        if (!dryRun) {
          // Create GameRule first
          const gameRule = await prisma.gameRule.create({
            data: {
              sourceId: rule.sourceId,
              sourceName: rule.sourceName,
              sourceVersion: rule.sourceVersion,
              category: 'secondary-objectives',
              ruleType: 'secondary',
              name: rule.name,
              description: rule.description,
              ruleData: rule,
              applicablePhases: [], // Secondaries can be scored in various phases
              applicableTiers: ['secondaries', 'full'],
              requiredKeywords: rule.requiredKeywords || [],
              priority: 1,
              isActive: true,
              tags: [rule.type, rule.category]
            }
          });
          
          // Create SecondaryObjective
          await prisma.secondaryObjective.create({
            data: {
              gameRuleId: gameRule.id,
              name: rule.name,
              category: rule.category,
              type: rule.type,
              scoringType: rule.scoringType,
              vpCalculation: rule.vpCalculation,
              maxVPPerTurn: rule.maxVPPerTurn,
              maxVPTotal: rule.maxVPTotal,
              description: rule.description,
              scoringTrigger: rule.scoringTrigger,
              requiredKeywords: rule.requiredKeywords || []
            }
          });
        }
        
        stats.added++;
      }
    } catch (error) {
      console.error(`  ❌ Error importing ${rule.name}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

async function importPrimaryMissions(
  rules: any[],
  dryRun: boolean = false
): Promise<ImportStats> {
  const stats: ImportStats = { added: 0, updated: 0, skipped: 0, errors: 0 };
  
  console.log(`\n🎯 Importing ${rules.length} primary missions...`);
  
  for (const rule of rules) {
    try {
      const existing = await prisma.primaryMission.findUnique({
        where: { name: rule.name },
        include: { gameRule: true }
      });
      
      if (existing) {
        // Mission exists - check if update needed
        if (existing.gameRule && existing.gameRule.sourceVersion !== rule.sourceVersion) {
          console.log(`  ↻ Updating: ${rule.name}`);
          
          if (!dryRun) {
            await prisma.gameRule.update({
              where: { id: existing.gameRuleId },
              data: {
                sourceVersion: rule.sourceVersion,
                description: rule.description,
                ruleData: rule,
                updatedAt: new Date()
              }
            });
            
            await prisma.primaryMission.update({
              where: { id: existing.id },
              data: {
                deploymentType: rule.deploymentType,
                scoringPhase: rule.scoringPhase,
                scoringTiming: rule.scoringTiming,
                scoringFormula: rule.scoringFormula,
                maxVP: rule.maxVP,
                specialRules: rule.specialRules,
                description: rule.description,
                updatedAt: new Date()
              }
            });
          }
          
          stats.updated++;
        } else {
          // Already up to date
          stats.skipped++;
        }
      } else {
        // New mission - add it
        console.log(`  + Adding: ${rule.name}`);
        
        if (!dryRun) {
          const gameRule = await prisma.gameRule.create({
            data: {
              sourceId: rule.sourceId,
              sourceName: rule.sourceName,
              sourceVersion: rule.sourceVersion,
              category: 'primary-missions',
              ruleType: 'mission',
              name: rule.name,
              description: rule.description,
              ruleData: rule,
              applicablePhases: [rule.scoringPhase],
              applicableTiers: ['secondaries', 'full'],
              requiredKeywords: [],
              priority: 1,
              isActive: true,
              tags: ['tournament', rule.deploymentType]
            }
          });
          
          await prisma.primaryMission.create({
            data: {
              gameRuleId: gameRule.id,
              name: rule.name,
              deploymentType: rule.deploymentType,
              scoringPhase: rule.scoringPhase,
              scoringTiming: rule.scoringTiming,
              scoringFormula: rule.scoringFormula,
              maxVP: rule.maxVP,
              specialRules: rule.specialRules,
              description: rule.description
            }
          });
        }
        
        stats.added++;
      }
    } catch (error) {
      console.error(`  ❌ Error importing ${rule.name}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

async function importCPRules(
  rules: any[],
  dryRun: boolean = false
): Promise<ImportStats> {
  const stats: ImportStats = { added: 0, updated: 0, skipped: 0, errors: 0 };
  
  console.log(`\n💎 Importing ${rules.length} CP rules...`);
  
  for (const rule of rules) {
    try {
      const existing = await prisma.gameRule.findFirst({
        where: {
          category: 'cp-rules',
          name: rule.name
        }
      });
      
      if (existing) {
        if (existing.sourceVersion !== rule.sourceVersion) {
          console.log(`  ↻ Updating: ${rule.name}`);
          
          if (!dryRun) {
            await prisma.gameRule.update({
              where: { id: existing.id },
              data: {
                sourceVersion: rule.sourceVersion,
                description: rule.description,
                ruleData: rule,
                updatedAt: new Date()
              }
            });
          }
          
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } else {
        console.log(`  + Adding: ${rule.name}`);
        
        if (!dryRun) {
          await prisma.gameRule.create({
            data: {
              sourceId: rule.sourceId,
              sourceName: rule.sourceName,
              sourceVersion: rule.sourceVersion,
              category: 'cp-rules',
              ruleType: 'cp-rule',
              name: rule.name,
              description: rule.description,
              ruleData: rule,
              applicablePhases: ['Command'], // CP rules primarily apply in Command phase
              applicableTiers: ['minimal', 'full'],
              requiredKeywords: [],
              priority: 1,
              isActive: true,
              tags: [rule.category]
            }
          });
        }
        
        stats.added++;
      }
    } catch (error) {
      console.error(`  ❌ Error importing ${rule.name}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

async function importPhaseRules(
  rules: any[],
  dryRun: boolean = false
): Promise<ImportStats> {
  const stats: ImportStats = { added: 0, updated: 0, skipped: 0, errors: 0 };
  
  console.log(`\n⏱️  Importing ${rules.length} phase rules...`);
  
  for (const rule of rules) {
    try {
      const existing = await prisma.gameRule.findFirst({
        where: {
          category: 'phase-rules',
          name: rule.name
        }
      });
      
      if (existing) {
        if (existing.sourceVersion !== rule.sourceVersion) {
          console.log(`  ↻ Updating: ${rule.name}`);
          
          if (!dryRun) {
            await prisma.gameRule.update({
              where: { id: existing.id },
              data: {
                sourceVersion: rule.sourceVersion,
                description: rule.description,
                ruleData: rule,
                updatedAt: new Date()
              }
            });
          }
          
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } else {
        console.log(`  + Adding: ${rule.name}`);
        
        if (!dryRun) {
          await prisma.gameRule.create({
            data: {
              sourceId: rule.sourceId,
              sourceName: rule.sourceName,
              sourceVersion: rule.sourceVersion,
              category: 'phase-rules',
              ruleType: 'phase-rule',
              name: rule.name,
              description: rule.description,
              ruleData: rule,
              applicablePhases: [rule.phase || 'All'],
              applicableTiers: ['full'],
              requiredKeywords: [],
              priority: 1,
              isActive: true,
              tags: [rule.phase, rule.timing]
            }
          });
        }
        
        stats.added++;
      }
    } catch (error) {
      console.error(`  ❌ Error importing ${rule.name}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

// ============================================
// Category Importer Registry
// ============================================

const CATEGORY_IMPORTERS: Record<string, (rules: any[], dryRun: boolean) => Promise<ImportStats>> = {
  'secondary-objectives': importSecondaryObjectives,
  'primary-missions': importPrimaryMissions,
  'cp-rules': importCPRules,
  'phase-rules': importPhaseRules
};

// ============================================
// Main Import Logic
// ============================================

async function importCategory(
  category: string,
  dryRun: boolean = false
): Promise<ImportStats> {
  const filePath = path.join(PARSED_RULES_DIR, `${category}.json`);
  
  if (!await fs.pathExists(filePath)) {
    console.log(`⏭️  Skipping ${category}: No parsed data found`);
    return { added: 0, updated: 0, skipped: 0, errors: 0 };
  }
  
  const data: ParsedRulesFile = await fs.readJson(filePath);
  
  if (data.rules.length === 0) {
    console.log(`⏭️  Skipping ${category}: No rules to import`);
    return { added: 0, updated: 0, skipped: 0, errors: 0 };
  }
  
  const importer = CATEGORY_IMPORTERS[category];
  if (!importer) {
    console.warn(`⚠️  No importer for category: ${category}`);
    return { added: 0, updated: 0, skipped: 0, errors: 0 };
  }
  
  return await importer(data.rules, dryRun);
}

async function syncAllCategories(dryRun: boolean = false): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎮 Warhammer 40K Gameplay Rules Seeding`);
  console.log(`${'='.repeat(60)}`);
  
  if (dryRun) {
    console.log(`\n⚠️  DRY RUN MODE - No changes will be written\n`);
  }
  
  // Load registry to get category list
  const registry = await fs.readJson(REGISTRY_PATH);
  const enabledCategories = Object.entries(registry.categories)
    .filter(([_, config]: [string, any]) => config.enabled)
    .map(([category, _]) => category);
  
  console.log(`📂 Enabled categories: ${enabledCategories.join(', ')}\n`);
  
  const totalStats: ImportStats = { added: 0, updated: 0, skipped: 0, errors: 0 };
  
  for (const category of enabledCategories) {
    const stats = await importCategory(category, dryRun);
    totalStats.added += stats.added;
    totalStats.updated += stats.updated;
    totalStats.skipped += stats.skipped;
    totalStats.errors += stats.errors;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Import Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Added:   ${totalStats.added}`);
  console.log(`↻  Updated: ${totalStats.updated}`);
  console.log(`⏭️  Skipped: ${totalStats.skipped}`);
  console.log(`❌ Errors:  ${totalStats.errors}`);
  console.log(`\n✨ Seeding complete!${dryRun ? ' (dry run - no changes made)' : ''}\n`);
}

// ============================================
// CLI Interface
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/seedGameplayRules.ts [options]

Options:
  --sync              Import all enabled categories
  --category <name>   Import specific category
  --dry-run           Preview changes without writing to database
  --help, -h          Show this help

Examples:
  tsx scripts/seedGameplayRules.ts --sync
  tsx scripts/seedGameplayRules.ts --category secondary-objectives
  tsx scripts/seedGameplayRules.ts --sync --dry-run
    `);
    process.exit(0);
  }
  
  const dryRun = args.includes('--dry-run');
  const category = args[args.indexOf('--category') + 1];
  const sync = args.includes('--sync');
  
  try {
    if (sync) {
      await syncAllCategories(dryRun);
    } else if (category) {
      const stats = await importCategory(category, dryRun);
      console.log(`\n✅ Imported ${stats.added} new, updated ${stats.updated}, skipped ${stats.skipped}\n`);
    } else {
      console.error(`❌ Please specify --sync or --category <name>`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n💥 Fatal error:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { importCategory, syncAllCategories };


