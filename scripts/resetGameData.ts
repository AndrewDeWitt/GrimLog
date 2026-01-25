/**
 * Database Reset Script: Game Data Only
 * 
 * This script safely wipes all game data tables while preserving user data.
 * 
 * PRESERVED (user-generated content):
 * - User, Player, Army, Unit, Stratagem (army-specific)
 * - GameSession and related: TimelineEvent, TranscriptHistory, ObjectiveMarker,
 *   UnitInstance, CombatLog, StratagemLog, ValidationEvent, CPTransaction,
 *   SecondaryProgress, RevertAction
 * - UnitIcon (user-generated icons)
 * - DatasheetVersion (for user datasheets only - official ones will be recreated)
 * 
 * WIPED (game reference data):
 * - StratagemData, Enhancement, Detachment
 * - FactionRule, DetachmentRule, CoreStratagem
 * - DatasheetAbility, DatasheetWeapon, DatasheetWargear
 * - Datasheet, Weapon, Ability, WargearOption
 * - Faction
 * - GameRule, SecondaryObjective, PrimaryMission
 * 
 * Run with: npx tsx scripts/resetGameData.ts --confirm
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ResetStats {
  table: string;
  deleted: number;
}

async function resetGameData(dryRun: boolean = true): Promise<ResetStats[]> {
  const stats: ResetStats[] = [];
  
  console.log('\n' + '='.repeat(60));
  console.log(dryRun ? '🔍 DRY RUN - No data will be deleted' : '⚠️  LIVE RUN - Data will be deleted');
  console.log('='.repeat(60) + '\n');

  // Order matters! Delete in reverse dependency order
  const deleteOperations = [
    // Level 1: Junction tables and logs (deepest dependencies)
    {
      name: 'DatasheetAbility',
      count: () => prisma.datasheetAbility.count(),
      delete: () => prisma.datasheetAbility.deleteMany(),
    },
    {
      name: 'DatasheetWeapon',
      count: () => prisma.datasheetWeapon.count(),
      delete: () => prisma.datasheetWeapon.deleteMany(),
    },
    {
      name: 'DatasheetWargear',
      count: () => prisma.datasheetWargear.count(),
      delete: () => prisma.datasheetWargear.deleteMany(),
    },
    
    // Level 2: Stratagem data (linked to detachments)
    {
      name: 'StratagemData',
      count: () => prisma.stratagemData.count(),
      delete: () => prisma.stratagemData.deleteMany(),
    },
    
    // Level 3: Enhancements (linked to detachments)
    {
      name: 'Enhancement',
      count: () => prisma.enhancement.count(),
      delete: () => prisma.enhancement.deleteMany(),
    },
    
    // Level 4: Detachments (linked to factions)
    {
      name: 'Detachment',
      count: () => prisma.detachment.count(),
      delete: () => prisma.detachment.deleteMany(),
    },
    
    // Level 5: Faction rules
    {
      name: 'FactionRule',
      count: () => prisma.factionRule.count(),
      delete: () => prisma.factionRule.deleteMany(),
    },
    {
      name: 'DetachmentRule',
      count: () => prisma.detachmentRule.count(),
      delete: () => prisma.detachmentRule.deleteMany(),
    },
    {
      name: 'CoreStratagem',
      count: () => prisma.coreStratagem.count(),
      delete: () => prisma.coreStratagem.deleteMany(),
    },
    
    // Level 6: Secondary/Primary missions (linked to GameRule)
    {
      name: 'SecondaryObjective',
      count: () => prisma.secondaryObjective.count(),
      delete: () => prisma.secondaryObjective.deleteMany(),
    },
    {
      name: 'PrimaryMission',
      count: () => prisma.primaryMission.count(),
      delete: () => prisma.primaryMission.deleteMany(),
    },
    
    // Level 7: Game rules
    {
      name: 'GameRule',
      count: () => prisma.gameRule.count(),
      delete: () => prisma.gameRule.deleteMany(),
    },
    
    // Level 8: Official datasheets and versions
    {
      name: 'DatasheetVersion (official)',
      count: async () => {
        const officialDatasheets = await prisma.datasheet.findMany({
          where: { isOfficial: true },
          select: { id: true }
        });
        return prisma.datasheetVersion.count({
          where: { datasheetId: { in: officialDatasheets.map(d => d.id) } }
        });
      },
      delete: async () => {
        const officialDatasheets = await prisma.datasheet.findMany({
          where: { isOfficial: true },
          select: { id: true }
        });
        return prisma.datasheetVersion.deleteMany({
          where: { datasheetId: { in: officialDatasheets.map(d => d.id) } }
        });
      },
    },
    {
      name: 'Datasheet (official)',
      count: () => prisma.datasheet.count({ where: { isOfficial: true } }),
      delete: () => prisma.datasheet.deleteMany({ where: { isOfficial: true } }),
    },
    
    // Level 9: Weapons, Abilities, Wargear (shared resources)
    {
      name: 'Weapon',
      count: () => prisma.weapon.count(),
      delete: () => prisma.weapon.deleteMany(),
    },
    {
      name: 'Ability',
      count: () => prisma.ability.count(),
      delete: () => prisma.ability.deleteMany(),
    },
    {
      name: 'WargearOption',
      count: () => prisma.wargearOption.count(),
      delete: () => prisma.wargearOption.deleteMany(),
    },
    
    // Level 10: Factions (top level, delete last)
    {
      name: 'Faction',
      count: () => prisma.faction.count(),
      delete: () => prisma.faction.deleteMany(),
    },
  ];

  // Execute deletions
  for (const op of deleteOperations) {
    try {
      const count = await op.count();
      
      if (dryRun) {
        console.log(`   📋 ${op.name}: ${count} records would be deleted`);
        stats.push({ table: op.name, deleted: count });
      } else {
        if (count > 0) {
          const result = await op.delete();
          const deleted = typeof result === 'object' && 'count' in result ? result.count : count;
          console.log(`   ✅ ${op.name}: ${deleted} records deleted`);
          stats.push({ table: op.name, deleted });
        } else {
          console.log(`   ⏭️  ${op.name}: 0 records (skipped)`);
          stats.push({ table: op.name, deleted: 0 });
        }
      }
    } catch (error) {
      console.error(`   ❌ ${op.name}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
      stats.push({ table: op.name, deleted: -1 });
    }
  }

  return stats;
}

async function printPreservationInfo() {
  console.log('\n📊 Data that will be PRESERVED:');
  
  const preservedCounts = [
    { name: 'Users', count: await prisma.user.count() },
    { name: 'Players', count: await prisma.player.count() },
    { name: 'Armies', count: await prisma.army.count() },
    { name: 'Units (in armies)', count: await prisma.unit.count() },
    { name: 'Game Sessions', count: await prisma.gameSession.count() },
    { name: 'User Datasheets', count: await prisma.datasheet.count({ where: { isOfficial: false } }) },
    { name: 'Unit Icons', count: await prisma.unitIcon.count() },
  ];

  for (const item of preservedCounts) {
    console.log(`   🔒 ${item.name}: ${item.count} records`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const hasConfirm = args.includes('--confirm');
  const hasDryRun = args.includes('--dry-run');
  
  if (!hasConfirm && !hasDryRun) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🗑️  GAME DATA RESET SCRIPT                         ║
╠══════════════════════════════════════════════════════════════╣
║  This script will DELETE all game reference data:            ║
║  - Factions, Detachments, Stratagems, Enhancements           ║
║  - Datasheets (official only), Weapons, Abilities            ║
║  - Game Rules, Missions, Objectives                          ║
║                                                              ║
║  User data (armies, sessions, etc.) will be PRESERVED.       ║
╠══════════════════════════════════════════════════════════════╣
║  Usage:                                                      ║
║    npx tsx scripts/resetGameData.ts --dry-run                ║
║    npx tsx scripts/resetGameData.ts --confirm                ║
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  }

  console.log('\n🚀 Starting Game Data Reset...');
  
  await printPreservationInfo();
  
  const dryRun = !hasConfirm;
  const stats = await resetGameData(dryRun);
  
  // Summary
  const totalDeleted = stats.reduce((sum, s) => sum + (s.deleted > 0 ? s.deleted : 0), 0);
  const failedTables = stats.filter(s => s.deleted === -1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total records ${dryRun ? 'to delete' : 'deleted'}: ${totalDeleted}`);
  
  if (failedTables.length > 0) {
    console.log(`   ❌ Failed tables: ${failedTables.map(t => t.table).join(', ')}`);
  }
  
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No data was actually deleted.');
    console.log('   Run with --confirm to execute the deletion.');
  } else {
    console.log('\n✅ Game data reset completed successfully!');
    console.log('   You can now re-import faction data using:');
    console.log('   npx tsx scripts/importFaction.ts <path-to-json>');
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

export { resetGameData };

