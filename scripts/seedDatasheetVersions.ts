/**
 * Seed Initial Datasheet Versions
 * 
 * This script creates version 1 snapshots for all existing datasheets.
 * It also marks existing datasheets as official since they came from admin imports.
 * 
 * Run this after applying the database migration for versioning.
 * 
 * Usage: npx tsx scripts/seedDatasheetVersions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DatasheetSnapshot {
  id: string;
  name: string;
  faction: string;
  factionId: string | null;
  subfaction: string | null;
  role: string;
  keywords: string[];
  movement: string;
  toughness: number;
  save: string;
  invulnerableSave: string | null;
  wounds: number;
  leadership: number;
  objectiveControl: number;
  composition: string;
  compositionData: string | null;
  unitSize: string | null;
  leaderRules: string | null;
  leaderAbilities: string | null;
  transportCapacity: string | null;
  pointsCost: number;
  edition: string;
  sourceBook: string | null;
  weapons: Array<{
    id: string;
    name: string;
    range: string;
    type: string;
    attacks: string;
    ballisticSkill: string | null;
    weaponSkill: string | null;
    strength: string;
    armorPenetration: string;
    damage: string;
    abilities: string[];
    isDefault: boolean;
    quantity: string | null;
  }>;
  abilities: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    phase: string | null;
    triggerPhase: string[] | null;
    source: string;
  }>;
  wargearOptions: Array<{
    id: string;
    name: string;
    description: string;
    pointsCost: number;
    type: string;
  }>;
}

async function createDatasheetSnapshot(datasheetId: string): Promise<DatasheetSnapshot> {
  const datasheet = await prisma.datasheet.findUniqueOrThrow({
    where: { id: datasheetId },
    include: {
      weapons: {
        include: { weapon: true },
      },
      abilities: {
        include: { ability: true },
      },
      wargearOptions: {
        include: { wargearOption: true },
      },
    },
  });

  // Parse keywords JSON
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(datasheet.keywords);
  } catch (e) {
    keywords = [];
  }

  // Build snapshot
  const snapshot: DatasheetSnapshot = {
    id: datasheet.id,
    name: datasheet.name,
    faction: datasheet.faction,
    factionId: datasheet.factionId,
    subfaction: datasheet.subfaction,
    role: datasheet.role,
    keywords,
    movement: datasheet.movement,
    toughness: datasheet.toughness,
    save: datasheet.save,
    invulnerableSave: datasheet.invulnerableSave,
    wounds: datasheet.wounds,
    leadership: datasheet.leadership,
    objectiveControl: datasheet.objectiveControl,
    composition: datasheet.composition,
    compositionData: datasheet.compositionData,
    unitSize: datasheet.unitSize,
    leaderRules: datasheet.leaderRules,
    leaderAbilities: datasheet.leaderAbilities,
    transportCapacity: datasheet.transportCapacity,
    pointsCost: datasheet.pointsCost,
    edition: datasheet.edition,
    sourceBook: datasheet.sourceBook,
    weapons: datasheet.weapons.map(dw => {
      let abilities: string[] = [];
      try {
        abilities = JSON.parse(dw.weapon.abilities);
      } catch (e) {
        abilities = [];
      }
      return {
        id: dw.weapon.id,
        name: dw.weapon.name,
        range: dw.weapon.range,
        type: dw.weapon.type,
        attacks: dw.weapon.attacks,
        ballisticSkill: dw.weapon.ballisticSkill,
        weaponSkill: dw.weapon.weaponSkill,
        strength: dw.weapon.strength,
        armorPenetration: dw.weapon.armorPenetration,
        damage: dw.weapon.damage,
        abilities,
        isDefault: dw.isDefault,
        quantity: dw.quantity,
      };
    }),
    abilities: datasheet.abilities.map(da => {
      let triggerPhase: string[] | null = null;
      try {
        triggerPhase = da.ability.triggerPhase ? JSON.parse(da.ability.triggerPhase) : null;
      } catch (e) {
        triggerPhase = null;
      }
      return {
        id: da.ability.id,
        name: da.ability.name,
        type: da.ability.type,
        description: da.ability.description,
        phase: da.ability.phase,
        triggerPhase,
        source: da.source,
      };
    }),
    wargearOptions: datasheet.wargearOptions.map(dw => ({
      id: dw.wargearOption.id,
      name: dw.wargearOption.name,
      description: dw.wargearOption.description,
      pointsCost: dw.wargearOption.pointsCost,
      type: dw.wargearOption.type,
    })),
  };

  return snapshot;
}

async function seedDatasheetVersions() {
  console.log('🚀 Starting datasheet version seeding...\n');

  // Get all datasheets
  const datasheets = await prisma.datasheet.findMany({
    select: {
      id: true,
      name: true,
      faction: true,
      isOfficial: true,
      currentVersion: true,
    },
  });

  console.log(`📊 Found ${datasheets.length} datasheets\n`);

  let created = 0;
  let skipped = 0;
  let markedOfficial = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (const ds of datasheets) {
    try {
      // Check if version 1 already exists
      const existingVersion = await prisma.datasheetVersion.findUnique({
        where: {
          datasheetId_versionNumber: {
            datasheetId: ds.id,
            versionNumber: 1,
          },
        },
      });

      if (existingVersion) {
        skipped++;
        continue;
      }

      // Create snapshot
      const snapshot = await createDatasheetSnapshot(ds.id);

      // Create version record
      await prisma.datasheetVersion.create({
        data: {
          datasheetId: ds.id,
          versionNumber: 1,
          versionLabel: 'Initial Version',
          snapshotData: JSON.stringify(snapshot),
          changelog: 'Initial datasheet creation',
          createdById: null, // System/admin created
        },
      });

      // Mark as official and set current version (if not already)
      if (!ds.isOfficial) {
        await prisma.datasheet.update({
          where: { id: ds.id },
          data: {
            isOfficial: true,
            currentVersion: 1,
            visibility: 'public', // Official datasheets are public
          },
        });
        markedOfficial++;
      }

      created++;
      console.log(`✅ Created version 1 for: ${ds.name} (${ds.faction})`);
    } catch (error) {
      console.error(`❌ Error processing ${ds.name}:`, error);
      errors.push({
        name: ds.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Seeding Summary');
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Versions created: ${created}`);
  console.log(`⏭️  Skipped (already exists): ${skipped}`);
  console.log(`🏛️  Marked as official: ${markedOfficial}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n⚠️ Errors:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }

  console.log('\n✨ Seeding complete!');
}

async function main() {
  try {
    await seedDatasheetVersions();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedDatasheetVersions, createDatasheetSnapshot };
