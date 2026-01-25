/**
 * Seed Secondary Objectives to Database
 * 
 * Reads parsed secondary missions from JSON and inserts into database
 * Run: npx tsx scripts/seedSecondaries.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs-extra';
import * as path from 'path';

const prisma = new PrismaClient();

interface SecondaryMissionData {
  name: string;
  description: string;
  fullRules: string;
  missionType: string;
  maxVP: number | null;
  vpPerTurnCap: number | null;
  scoringType: string;
  vpStructure: any;
  hasDrawCondition: boolean;
  drawCondition: string | null;
  requiresTargetSelection: boolean;
  targetSelectionRules: string | null;
  requiresAction: boolean;
  actionDetails: any;
  trackingConditions: any;
}

async function seedSecondaryObjectives() {
  console.log('🎯 Seeding Secondary Objectives...\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Read the JSON file
    const dataPath = path.join(process.cwd(), 'data', 'parsed-secondaries', 'secondary-missions.json');
    
    if (!await fs.pathExists(dataPath)) {
      throw new Error(`Data file not found: ${dataPath}`);
    }

    const secondariesData: SecondaryMissionData[] = await fs.readJSON(dataPath);
    console.log(`📄 Found ${secondariesData.length} secondary missions to seed\n`);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const secondary of secondariesData) {
      try {
        // Check if already exists
        const existing = await prisma.secondaryObjective.findUnique({
          where: { name: secondary.name }
        });

        if (existing) {
          // Update existing
          await prisma.secondaryObjective.update({
            where: { name: secondary.name },
            data: {
              description: secondary.description,
              fullRules: secondary.fullRules,
              missionType: secondary.missionType,
              maxVP: secondary.maxVP,
              vpPerTurnCap: secondary.vpPerTurnCap,
              scoringType: secondary.scoringType,
              vpStructure: secondary.vpStructure ? JSON.stringify(secondary.vpStructure) : null,
              hasDrawCondition: secondary.hasDrawCondition,
              drawCondition: secondary.drawCondition,
              requiresTargetSelection: secondary.requiresTargetSelection,
              targetSelectionRules: secondary.targetSelectionRules,
              requiresAction: secondary.requiresAction,
              actionDetails: secondary.actionDetails ? JSON.stringify(secondary.actionDetails) : null,
              trackingConditions: secondary.trackingConditions ? JSON.stringify(secondary.trackingConditions) : null,
            }
          });
          console.log(`✅ Updated: ${secondary.name}`);
          updated++;
        } else {
          // Insert new
          await prisma.secondaryObjective.create({
            data: {
              name: secondary.name,
              description: secondary.description,
              fullRules: secondary.fullRules,
              missionType: secondary.missionType,
              maxVP: secondary.maxVP,
              vpPerTurnCap: secondary.vpPerTurnCap,
              scoringType: secondary.scoringType,
              vpStructure: secondary.vpStructure ? JSON.stringify(secondary.vpStructure) : null,
              hasDrawCondition: secondary.hasDrawCondition,
              drawCondition: secondary.drawCondition,
              requiresTargetSelection: secondary.requiresTargetSelection,
              targetSelectionRules: secondary.targetSelectionRules,
              requiresAction: secondary.requiresAction,
              actionDetails: secondary.actionDetails ? JSON.stringify(secondary.actionDetails) : null,
              trackingConditions: secondary.trackingConditions ? JSON.stringify(secondary.trackingConditions) : null,
            }
          });
          console.log(`✅ Inserted: ${secondary.name}`);
          inserted++;
        }
      } catch (error) {
        console.error(`❌ Failed to process ${secondary.name}:`, error);
        skipped++;
      }
    }

    console.log('\n═══════════════════════════════════════════════\n');
    console.log('📊 Summary:');
    console.log(`   • Inserted: ${inserted}`);
    console.log(`   • Updated: ${updated}`);
    console.log(`   • Skipped: ${skipped}`);
    console.log(`   • Total: ${inserted + updated}\n`);
    
    // Display all secondaries by type
    console.log('📋 Secondary Objectives by Type:\n');
    
    const allSecondaries = await prisma.secondaryObjective.findMany({
      orderBy: { scoringType: 'asc' }
    });

    const byType: { [key: string]: string[] } = {};
    
    for (const sec of allSecondaries) {
      if (!byType[sec.scoringType]) {
        byType[sec.scoringType] = [];
      }
      byType[sec.scoringType].push(sec.name);
    }

    for (const [type, names] of Object.entries(byType)) {
      console.log(`   ${type}:`);
      names.forEach(name => console.log(`      • ${name}`));
      console.log('');
    }

    console.log('✅ Seeding complete!\n');

  } catch (error) {
    console.error('❌ Error seeding secondaries:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding
seedSecondaryObjectives()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

