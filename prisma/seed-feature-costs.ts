/**
 * Seed script for feature costs
 * 
 * Run with: npx tsx prisma/seed-feature-costs.ts
 * 
 * This script ensures all feature costs exist in the database.
 * It uses upsert to avoid duplicates and allow updates.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FeatureCostSeed {
  featureKey: string;
  tokenCost: number;
  displayName: string;
  description: string;
  isActive: boolean;
}

const FEATURE_COSTS: FeatureCostSeed[] = [
  {
    featureKey: 'generate_brief',
    tokenCost: 3,
    displayName: 'Deep Tactical Brief',
    description: 'AI-powered strategic analysis of your army list with matchup insights and tactical recommendations',
    isActive: true,
  },
  {
    featureKey: 'list_check_quick',
    tokenCost: 1,
    displayName: 'Quick List Check',
    description: 'Fast validation and basic analysis of your army list (future feature)',
    isActive: false,
  },
  {
    featureKey: 'matchup_simulator',
    tokenCost: 5,
    displayName: 'Matchup Simulator',
    description: 'Detailed matchup simulation against specific opponent armies (future feature)',
    isActive: false,
  },
  {
    featureKey: 'spirit_icon',
    tokenCost: 2,
    displayName: 'Army Spirit Icon',
    description: 'AI-generated custom icon representing your army\'s spirit and theme',
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding feature costs...');

  for (const cost of FEATURE_COSTS) {
    const result = await prisma.featureCost.upsert({
      where: { featureKey: cost.featureKey },
      update: {
        tokenCost: cost.tokenCost,
        displayName: cost.displayName,
        description: cost.description,
        isActive: cost.isActive,
      },
      create: cost,
    });

    console.log(`  ✓ ${result.featureKey}: ${result.tokenCost} tokens (${result.isActive ? 'active' : 'inactive'})`);
  }

  console.log('✅ Feature costs seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding feature costs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
