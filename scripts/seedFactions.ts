import { PrismaClient } from '@prisma/client';
import { FACTION_DATA } from '../lib/factionConstants';

const prisma = new PrismaClient();

async function seedFactions() {
  console.log('🌱 Seeding Factions...');

  // 1. Seed Parent Factions first
  const parentFactions = FACTION_DATA.filter(f => !f.parentFaction);
  
  for (const faction of parentFactions) {
    console.log(`   Processing parent faction: ${faction.name}`);
    
    await prisma.faction.upsert({
      where: { name: faction.name },
      update: {
        metaData: JSON.stringify({
          keywords: faction.keywords,
          forbiddenKeywords: faction.forbiddenKeywords,
          isDivergent: faction.isDivergent
        })
      },
      create: {
        name: faction.name,
        metaData: JSON.stringify({
          keywords: faction.keywords,
          forbiddenKeywords: faction.forbiddenKeywords,
          isDivergent: faction.isDivergent
        })
      }
    });
  }

  // 2. Seed Child Factions (Divergent Chapters)
  const childFactions = FACTION_DATA.filter(f => f.parentFaction);
  
  for (const faction of childFactions) {
    console.log(`   Processing divergent faction: ${faction.name} (Parent: ${faction.parentFaction})`);
    
    // Find parent ID
    const parent = await prisma.faction.findUnique({
      where: { name: faction.parentFaction }
    });

    if (!parent) {
      console.error(`❌ Parent faction ${faction.parentFaction} not found for ${faction.name}`);
      continue;
    }

    await prisma.faction.upsert({
      where: { name: faction.name },
      update: {
        parentFactionId: parent.id,
        metaData: JSON.stringify({
          keywords: faction.keywords,
          forbiddenKeywords: faction.forbiddenKeywords,
          isDivergent: faction.isDivergent
        })
      },
      create: {
        name: faction.name,
        parentFactionId: parent.id,
        metaData: JSON.stringify({
          keywords: faction.keywords,
          forbiddenKeywords: faction.forbiddenKeywords,
          isDivergent: faction.isDivergent
        })
      }
    });
  }

  console.log('✅ Faction seeding complete!');
}

// Run if called directly
if (require.main === module) {
  seedFactions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

