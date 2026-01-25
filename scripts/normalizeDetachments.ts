/**
 * Migration Script: Normalize Detachments
 * 
 * This script:
 * 1. Extracts unique detachment names from stratagems per faction
 * 2. Creates Detachment records for each faction
 * 3. Links stratagems to detachments via detachmentId
 * 4. Creates a "Core" faction for universal stratagems
 * 
 * Run with: npx tsx scripts/normalizeDetachments.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createCoreFaction() {
  console.log('\n🌐 Phase 1: Creating Core Faction...');
  
  // Check if Core faction already exists
  let coreFaction = await prisma.faction.findUnique({
    where: { name: 'Core' }
  });
  
  if (!coreFaction) {
    coreFaction = await prisma.faction.create({
      data: {
        name: 'Core',
        metaData: JSON.stringify({
          keywords: [],
          isUniversal: true,
          description: 'Universal stratagems and rules available to all factions'
        })
      }
    });
    console.log('   ✓ Created "Core" faction');
  } else {
    console.log('   ✓ "Core" faction already exists');
  }
  
  return coreFaction;
}

async function extractAndCreateDetachments() {
  console.log('\n📋 Phase 2: Extracting Detachments from Stratagems...');
  
  // Get all unique faction/detachment combinations from stratagems
  const detachmentCombos = await prisma.stratagemData.groupBy({
    by: ['faction', 'detachment'],
    where: {
      detachment: {
        not: null
      }
    },
    _count: true
  });
  
  console.log(`   Found ${detachmentCombos.length} unique faction/detachment combinations`);
  
  // Get all factions for lookup
  const factions = await prisma.faction.findMany();
  const factionMap = new Map(factions.map(f => [f.name, f]));
  
  let created = 0;
  let skipped = 0;
  
  for (const combo of detachmentCombos) {
    if (!combo.detachment) continue;
    
    // Skip "Core" detachments - they'll be centralized in the Core faction
    if (combo.detachment === 'Core' && combo.faction !== 'Core') {
      skipped++;
      continue;
    }
    
    const faction = factionMap.get(combo.faction);
    if (!faction) {
      console.log(`   ⚠️  Faction "${combo.faction}" not found, skipping detachment "${combo.detachment}"`);
      skipped++;
      continue;
    }
    
    // Check if detachment already exists for this faction
    const existing = await prisma.detachment.findFirst({
      where: {
        name: combo.detachment,
        faction: combo.faction
      }
    });
    
    if (existing) {
      skipped++;
      continue;
    }
    
    // Create new detachment
    try {
      await prisma.detachment.create({
        data: {
          name: combo.detachment,
          faction: combo.faction,
          factionId: faction.id,
          edition: '10th'
        }
      });
      created++;
    } catch (error) {
      console.log(`   ⚠️  Failed to create "${combo.detachment}" for ${combo.faction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log(`   ✅ Created ${created} detachments, skipped ${skipped} (already exist or invalid)`);
}

async function linkStratagemsToDetachments() {
  console.log('\n🔗 Phase 3: Linking Stratagems to Detachments...');
  
  // Get all detachments for lookup
  const detachments = await prisma.detachment.findMany();
  
  // Create a map of faction+detachment name to detachment ID
  const detachmentMap = new Map<string, string>();
  for (const d of detachments) {
    const key = `${d.faction}|${d.name}`;
    detachmentMap.set(key, d.id);
  }
  
  console.log(`   Built lookup map with ${detachmentMap.size} detachments`);
  
  // Get all stratagems that have a detachment name but no detachmentId
  const stratagems = await prisma.stratagemData.findMany({
    where: {
      detachment: { not: null },
      detachmentId: null
    }
  });
  
  console.log(`   Found ${stratagems.length} stratagems to link`);
  
  let linked = 0;
  let notFound = 0;
  
  for (const strat of stratagems) {
    if (!strat.detachment) continue;
    
    const key = `${strat.faction}|${strat.detachment}`;
    const detachmentId = detachmentMap.get(key);
    
    if (detachmentId) {
      await prisma.stratagemData.update({
        where: { id: strat.id },
        data: { detachmentId }
      });
      linked++;
    } else {
      notFound++;
      // Only log if it's not a known missing case
      if (strat.detachment !== 'Core') {
        console.log(`   ⚠️  No detachment found for "${strat.detachment}" in faction "${strat.faction}"`);
      }
    }
  }
  
  console.log(`   ✅ Linked ${linked} stratagems, ${notFound} not found (may be Core or cross-faction)`);
}

async function handleCoreStratagems() {
  console.log('\n🎯 Phase 4: Handling Core Stratagems...');
  
  // Get Core faction
  const coreFaction = await prisma.faction.findUnique({
    where: { name: 'Core' }
  });
  
  if (!coreFaction) {
    console.log('   ⚠️  Core faction not found, skipping');
    return;
  }
  
  // Create Core detachment for the Core faction
  let coreDetachment = await prisma.detachment.findFirst({
    where: {
      name: 'Core',
      faction: 'Core'
    }
  });
  
  if (!coreDetachment) {
    coreDetachment = await prisma.detachment.create({
      data: {
        name: 'Core',
        faction: 'Core',
        factionId: coreFaction.id,
        description: 'Universal stratagems available to all armies',
        edition: '10th'
      }
    });
    console.log('   ✓ Created Core detachment');
  }
  
  // Move Core stratagems to the Core faction
  const coreStratagems = await prisma.stratagemData.findMany({
    where: {
      detachment: 'Core'
    }
  });
  
  console.log(`   Found ${coreStratagems.length} Core stratagems to migrate`);
  
  // Group by unique stratagem name (to avoid duplicates when merging)
  const uniqueCore = new Map<string, typeof coreStratagems[0]>();
  for (const strat of coreStratagems) {
    if (!uniqueCore.has(strat.name)) {
      uniqueCore.set(strat.name, strat);
    }
  }
  
  console.log(`   ${uniqueCore.size} unique Core stratagems`);
  
  let migrated = 0;
  let deleted = 0;
  
  for (const [name, strat] of uniqueCore) {
    // Check if this stratagem already exists in Core faction
    const existingInCore = await prisma.stratagemData.findFirst({
      where: {
        name: strat.name,
        faction: 'Core',
        detachment: 'Core'
      }
    });
    
    if (!existingInCore) {
      // Create in Core faction
      await prisma.stratagemData.create({
        data: {
          name: strat.name,
          faction: 'Core',
          factionId: coreFaction.id,
          detachment: 'Core',
          detachmentId: coreDetachment.id,
          cpCost: strat.cpCost,
          type: strat.type,
          when: strat.when,
          target: strat.target,
          effect: strat.effect,
          restrictions: strat.restrictions,
          keywords: strat.keywords,
          triggerPhase: strat.triggerPhase,
          triggerSubphase: strat.triggerSubphase,
          isReactive: strat.isReactive,
          requiredKeywords: strat.requiredKeywords,
          usageRestriction: strat.usageRestriction,
          edition: strat.edition,
          sourceBook: strat.sourceBook
        }
      });
      migrated++;
    }
  }
  
  // Delete Core stratagems from other factions (they're now centralized)
  const deleteResult = await prisma.stratagemData.deleteMany({
    where: {
      detachment: 'Core',
      faction: { not: 'Core' }
    }
  });
  deleted = deleteResult.count;
  
  console.log(`   ✅ Migrated ${migrated} Core stratagems, deleted ${deleted} duplicates from other factions`);
}

async function printSummary() {
  console.log('\n📊 Detachment Normalization Summary:');
  
  const detachmentsByFaction = await prisma.detachment.groupBy({
    by: ['faction'],
    _count: true
  });
  
  console.log('\n   Detachments by Faction:');
  for (const d of detachmentsByFaction) {
    const linkedStratagems = await prisma.stratagemData.count({
      where: {
        faction: d.faction,
        detachmentId: { not: null }
      }
    });
    console.log(`   - ${d.faction}: ${d._count} detachments, ${linkedStratagems} linked stratagems`);
  }
  
  const totalDetachments = await prisma.detachment.count();
  const linkedStratagems = await prisma.stratagemData.count({
    where: { detachmentId: { not: null } }
  });
  const unlinkedStratagems = await prisma.stratagemData.count({
    where: { 
      detachmentId: null,
      detachment: { not: null }
    }
  });
  
  console.log(`\n   Total Detachments: ${totalDetachments}`);
  console.log(`   Linked Stratagems: ${linkedStratagems}`);
  console.log(`   Unlinked Stratagems: ${unlinkedStratagems}`);
}

async function main() {
  console.log('🚀 Starting Detachment Normalization...\n');
  console.log('This migration will:');
  console.log('1. Create a "Core" faction for universal stratagems');
  console.log('2. Extract unique detachments from stratagems and create Detachment records');
  console.log('3. Link stratagems to detachments via detachmentId');
  console.log('4. Centralize Core stratagems in the Core faction');
  
  try {
    await createCoreFaction();
    await extractAndCreateDetachments();
    await linkStratagemsToDetachments();
    await handleCoreStratagems();
    await printSummary();
    
    console.log('\n✅ Detachment normalization completed successfully!');
  } catch (error) {
    console.error('\n❌ Normalization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { main as normalizeDetachments };

