/**
 * Seed Core Stratagems to Database
 * 
 * This script seeds all 11 core stratagems from 10th Edition to the CoreStratagem table.
 * These are universal stratagems available to all armies.
 * 
 * Run with: npx ts-node scripts/seedCoreStratagems.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import coreStratagemData from '../data/parsed-rules/core-stratagems.json';

const prisma = new PrismaClient();

interface StratagemInput {
  id: string;
  name: string;
  cpCost: number;
  category: string;
  when: string;
  target: string;
  effect: string;
  restrictions: Array<{ type: string; value: string | string[] | boolean }>;
  isCalculatorRelevant: boolean;
  calculatorEffect: Record<string, unknown> | null;
}

/**
 * Convert calculatorEffect to Prisma-compatible JSON value
 * Prisma requires explicit Prisma.JsonNull for null values
 */
function toJsonValue(value: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

async function seedCoreStratagems() {
  console.log('🎲 Seeding Core Stratagems...\n');

  const stratagems = coreStratagemData.stratagems as StratagemInput[];

  for (const strat of stratagems) {
    // Determine trigger phases from timing description
    const triggerPhase = determineTriggerPhases(strat.when);
    const isReactive = strat.when.toLowerCase().includes('opponent');
    
    // Extract required keywords from restrictions
    const requiredKeywords = strat.restrictions
      .filter(r => r.type === 'required_keyword')
      .map(r => r.value as string);

    try {
      await prisma.coreStratagem.upsert({
        where: { name: strat.name },
        update: {
          cpCost: strat.cpCost,
          category: strat.category,
          when: strat.when,
          target: strat.target,
          effect: strat.effect,
          triggerPhase: JSON.stringify(triggerPhase),
          isReactive,
          requiredKeywords: requiredKeywords.length > 0 ? JSON.stringify(requiredKeywords) : null,
          isCalculatorRelevant: strat.isCalculatorRelevant,
          calculatorEffect: toJsonValue(strat.calculatorEffect),
          edition: coreStratagemData.version,
          sourceBook: coreStratagemData.source,
          updatedAt: new Date()
        },
        create: {
          name: strat.name,
          cpCost: strat.cpCost,
          category: strat.category,
          when: strat.when,
          target: strat.target,
          effect: strat.effect,
          triggerPhase: JSON.stringify(triggerPhase),
          isReactive,
          requiredKeywords: requiredKeywords.length > 0 ? JSON.stringify(requiredKeywords) : null,
          isCalculatorRelevant: strat.isCalculatorRelevant,
          calculatorEffect: toJsonValue(strat.calculatorEffect),
          edition: coreStratagemData.version,
          sourceBook: coreStratagemData.source
        }
      });

      const relevantTag = strat.isCalculatorRelevant ? '📊' : '📋';
      console.log(`  ${relevantTag} ${strat.name} (${strat.cpCost}CP) - ${strat.category}`);
    } catch (error) {
      console.error(`  ❌ Failed to seed ${strat.name}:`, error);
    }
  }

  console.log('\n✅ Core stratagems seeded successfully!');
  
  // Print summary
  const count = await prisma.coreStratagem.count();
  const calculatorRelevant = await prisma.coreStratagem.count({
    where: { isCalculatorRelevant: true }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total core stratagems: ${count}`);
  console.log(`   Calculator-relevant: ${calculatorRelevant}`);
}

/**
 * Determine trigger phases from the "when" description
 */
function determineTriggerPhases(when: string): string[] {
  const phases: string[] = [];
  const lower = when.toLowerCase();

  if (lower.includes('any phase')) return ['Any'];
  if (lower.includes('command phase')) phases.push('Command');
  if (lower.includes('movement phase')) phases.push('Movement');
  if (lower.includes('shooting phase')) phases.push('Shooting');
  if (lower.includes('charge phase')) phases.push('Charge');
  if (lower.includes('fight phase')) phases.push('Fight');
  if (lower.includes('morale phase')) phases.push('Morale');

  return phases.length > 0 ? phases : ['Any'];
}

// Run the seed
seedCoreStratagems()
  .catch((e) => {
    console.error('❌ Error seeding core stratagems:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

