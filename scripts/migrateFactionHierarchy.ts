/**
 * Migration Script: Flatten Faction Hierarchy
 * 
 * This script:
 * 1. Flattens faction hierarchy (removes parentFactionId from divergent chapters)
 * 2. Duplicates shared Space Marine datasheets into each divergent chapter
 * 3. Applies restriction rules (sets isEnabled: false for forbidden units)
 * 4. Normalizes stratagem faction names and links factionIds
 * 
 * Run with: npx ts-node scripts/migrateFactionHierarchy.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chapter-specific unit restrictions based on official rules
const CHAPTER_RESTRICTIONS: Record<string, {
  forbiddenUnits: string[];  // Exact unit names that cannot be taken
  forbiddenKeywords: string[];  // Keywords that disqualify units (e.g., PSYKER)
  requiresChapterVersion: string[];  // Units that need chapter-specific versions (Black Templars vehicles)
}> = {
  'Space Wolves': {
    forbiddenUnits: ['Apothecary', 'Devastator Squad', 'Tactical Squad'],
    forbiddenKeywords: [],
    requiresChapterVersion: []
  },
  'Deathwatch': {
    forbiddenUnits: ['Devastator Squad', 'Scout Squad', 'Tactical Squad'],
    forbiddenKeywords: [],
    requiresChapterVersion: []
  },
  'Black Templars': {
    forbiddenUnits: [],
    forbiddenKeywords: ['PSYKER'],
    requiresChapterVersion: ['Gladiator Lancer', 'Gladiator Reaper', 'Gladiator Valiant', 'Impulsor', 'Repulsor', 'Repulsor Executioner']
  },
  'Blood Angels': {
    forbiddenUnits: [],
    forbiddenKeywords: [],
    requiresChapterVersion: []
  },
  'Dark Angels': {
    forbiddenUnits: [],
    forbiddenKeywords: [],
    requiresChapterVersion: []
  }
};

// Divergent chapters to process
const DIVERGENT_CHAPTERS = ['Space Wolves', 'Blood Angels', 'Dark Angels', 'Black Templars', 'Deathwatch'];

async function flattenFactions() {
  console.log('\n📦 Phase 1: Flattening Faction Hierarchy...');
  
  // Remove parentFactionId from all divergent chapters
  for (const chapterName of DIVERGENT_CHAPTERS) {
    const result = await prisma.faction.updateMany({
      where: { name: chapterName },
      data: { parentFactionId: null }
    });
    
    if (result.count > 0) {
      console.log(`   ✓ Flattened: ${chapterName}`);
    }
  }
  
  console.log('   ✅ Faction hierarchy flattened');
}

async function normalizeDatasheetFactions() {
  console.log('\n🔤 Phase 1b: Normalizing Datasheet Faction Names...');
  
  // Normalize faction names in datasheets
  const normalizations: Record<string, string> = {
    'tyranids': 'Tyranids',
    'TYRANIDS': 'Tyranids',
    'astra-militarum': 'Astra Militarum',
    'ASTRA MILITARUM': 'Astra Militarum',
    'space-marines': 'Space Marines',
    'SPACE MARINES': 'Space Marines'
  };
  
  for (const [from, to] of Object.entries(normalizations)) {
    const result = await prisma.datasheet.updateMany({
      where: { faction: from },
      data: { faction: to }
    });
    
    if (result.count > 0) {
      console.log(`   ✓ Normalized "${from}" → "${to}" (${result.count} datasheets)`);
    }
  }
  
  // Link factionIds where missing
  const factions = await prisma.faction.findMany();
  for (const faction of factions) {
    const result = await prisma.datasheet.updateMany({
      where: {
        faction: faction.name,
        factionId: null
      },
      data: { factionId: faction.id }
    });
    
    if (result.count > 0) {
      console.log(`   ✓ Linked ${result.count} datasheets to faction "${faction.name}"`);
    }
  }
  
  console.log('   ✅ Datasheet faction names normalized');
}

async function duplicateDatasheets() {
  console.log('\n📋 Phase 2: Duplicating Shared Datasheets...');
  
  // Get all Space Wolves datasheets as the source (they have the most complete data)
  // We'll duplicate these to other chapters and to generic Space Marines
  const sourceDatasheets = await prisma.datasheet.findMany({
    where: {
      faction: 'Space Wolves'
    },
    include: {
      weapons: {
        include: { weapon: true }
      },
      abilities: {
        include: { ability: true }
      },
      wargearOptions: {
        include: { wargearOption: true }
      }
    }
  });
  
  console.log(`   Found ${sourceDatasheets.length} Space Wolves datasheets as source`);
  
  // Get faction IDs for each target faction (chapters + generic Space Marines)
  const targetFactions = ['Space Marines', ...DIVERGENT_CHAPTERS.filter(c => c !== 'Space Wolves')];
  const factionIds: Record<string, string> = {};
  for (const factionName of targetFactions) {
    const faction = await prisma.faction.findUnique({ where: { name: factionName } });
    if (faction) {
      factionIds[factionName] = faction.id;
    }
  }
  
  let totalCreated = 0;
  let totalDisabled = 0;
  
  for (const targetFaction of targetFactions) {
    console.log(`\n   Processing ${targetFaction}...`);
    const restrictions = CHAPTER_RESTRICTIONS[targetFaction] || { forbiddenUnits: [], forbiddenKeywords: [], requiresChapterVersion: [] };
    const targetFactionId = factionIds[targetFaction];
    
    if (!targetFactionId) {
      console.log(`   ⚠️  Faction not found for ${targetFaction}, skipping`);
      continue;
    }
    
    let created = 0;
    let disabled = 0;
    
    for (const datasheet of sourceDatasheets) {
      // Parse keywords
      let keywords: string[] = [];
      try {
        keywords = JSON.parse(datasheet.keywords);
      } catch {
        keywords = [];
      }
      
      // Check if this unit should be disabled for this target faction
      let shouldDisable = false;
      let disableReason = '';
      
      // Check forbidden units
      if (restrictions.forbiddenUnits.includes(datasheet.name)) {
        shouldDisable = true;
        disableReason = `Forbidden unit for ${targetFaction}`;
      }
      
      // Check forbidden keywords
      if (!shouldDisable && restrictions.forbiddenKeywords.length > 0) {
        const hasForbiddenKeyword = restrictions.forbiddenKeywords.some(
          kw => keywords.some(k => k.toUpperCase().includes(kw.toUpperCase()))
        );
        if (hasForbiddenKeyword) {
          shouldDisable = true;
          disableReason = `Has forbidden keyword for ${targetFaction}`;
        }
      }
      
      // Check if this needs a chapter-specific version (Black Templars vehicles)
      const needsChapterVersion = restrictions.requiresChapterVersion.includes(datasheet.name);
      
      // Update keywords for target faction
      const updatedKeywords = [...keywords];
      // Remove SPACE WOLVES keyword if copying to another faction
      const swIndex = updatedKeywords.findIndex(k => k.toUpperCase() === 'SPACE WOLVES');
      if (swIndex > -1 && targetFaction !== 'Space Wolves') {
        updatedKeywords.splice(swIndex, 1);
      }
      // Add target faction keyword if it's a divergent chapter
      if (DIVERGENT_CHAPTERS.includes(targetFaction) && targetFaction !== 'Space Wolves') {
        const factionKeyword = targetFaction.toUpperCase();
        if (!updatedKeywords.some(k => k.toUpperCase() === factionKeyword)) {
          updatedKeywords.push(factionKeyword);
        }
      }
      
      // Check if datasheet already exists for this target faction
      const existing = await prisma.datasheet.findFirst({
        where: {
          name: datasheet.name,
          faction: targetFaction
        }
      });
      
      if (existing) {
        // Update existing datasheet's isEnabled status if needed
        if (shouldDisable && existing.isEnabled) {
          await prisma.datasheet.update({
            where: { id: existing.id },
            data: { isEnabled: false }
          });
          disabled++;
        }
        continue;
      }
      
      // Create new datasheet for this target faction
      try {
        const newDatasheet = await prisma.datasheet.create({
          data: {
            name: needsChapterVersion ? `${datasheet.name} (${targetFaction})` : datasheet.name,
            faction: targetFaction,
            factionId: targetFactionId,
            subfaction: null,
            role: datasheet.role,
            keywords: JSON.stringify(updatedKeywords),
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
            version: datasheet.version,
            isOfficial: true,
            isEnabled: !shouldDisable,
            visibility: 'public'
          }
        });
        
        // Copy weapon relationships
        for (const dw of datasheet.weapons) {
          await prisma.datasheetWeapon.create({
            data: {
              datasheetId: newDatasheet.id,
              weaponId: dw.weaponId,
              isDefault: dw.isDefault,
              quantity: dw.quantity,
              notes: dw.notes
            }
          });
        }
        
        // Copy ability relationships
        for (const da of datasheet.abilities) {
          await prisma.datasheetAbility.create({
            data: {
              datasheetId: newDatasheet.id,
              abilityId: da.abilityId,
              source: da.source
            }
          });
        }
        
        // Copy wargear option relationships
        for (const wo of datasheet.wargearOptions) {
          await prisma.datasheetWargear.create({
            data: {
              datasheetId: newDatasheet.id,
              wargearOptionId: wo.wargearOptionId,
              isExclusive: wo.isExclusive,
              group: wo.group
            }
          });
        }
        
        created++;
        if (shouldDisable) {
          disabled++;
        }
      } catch (error) {
        // Likely duplicate, skip
        console.log(`   ⚠️  Skipped ${datasheet.name} for ${targetFaction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`   ✓ ${targetFaction}: ${created} datasheets created, ${disabled} disabled`);
    totalCreated += created;
    totalDisabled += disabled;
  }
  
  console.log(`\n   ✅ Datasheet duplication complete: ${totalCreated} total created, ${totalDisabled} total disabled`);
}

async function normalizeStratagems() {
  console.log('\n🎯 Phase 3: Normalizing Stratagems...');
  
  // Get all factions for ID lookup
  const factions = await prisma.faction.findMany();
  const factionMap = new Map(factions.map(f => [f.name.toLowerCase(), f]));
  
  // Normalize faction names mapping
  const FACTION_NAME_NORMALIZATION: Record<string, string> = {
    'space-marines': 'Space Marines',
    'space marines': 'Space Marines',
    'tyranids': 'Tyranids',
    'astra-militarum': 'Astra Militarum',
    'astra militarum': 'Astra Militarum',
    'space wolves': 'Space Wolves',
    'space-wolves': 'Space Wolves',
    'blood angels': 'Blood Angels',
    'blood-angels': 'Blood Angels',
    'dark angels': 'Dark Angels',
    'dark-angels': 'Dark Angels',
    'black templars': 'Black Templars',
    'black-templars': 'Black Templars',
    'deathwatch': 'Deathwatch'
  };
  
  // Get all stratagems
  const stratagems = await prisma.stratagemData.findMany();
  console.log(`   Found ${stratagems.length} stratagems to process`);
  
  let updated = 0;
  let deleted = 0;
  
  for (const strat of stratagems) {
    const normalizedName = FACTION_NAME_NORMALIZATION[strat.faction.toLowerCase()] || strat.faction;
    const faction = factionMap.get(normalizedName.toLowerCase());
    
    if (faction && (strat.faction !== normalizedName || strat.factionId !== faction.id)) {
      // Check if a stratagem with the normalized name already exists
      const existing = await prisma.stratagemData.findFirst({
        where: {
          name: strat.name,
          faction: normalizedName,
          detachment: strat.detachment
        }
      });
      
      if (existing && existing.id !== strat.id) {
        // Delete the duplicate with non-normalized name
        await prisma.stratagemData.delete({
          where: { id: strat.id }
        });
        deleted++;
        console.log(`   ⚠️  Deleted duplicate: "${strat.name}" (${strat.faction})`);
      } else {
        // Safe to update
        try {
          await prisma.stratagemData.update({
            where: { id: strat.id },
            data: {
              faction: normalizedName,
              factionId: faction.id
            }
          });
          updated++;
        } catch (error) {
          console.log(`   ⚠️  Failed to update: "${strat.name}" - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }
  
  console.log(`   ✅ Normalized ${updated} stratagems, deleted ${deleted} duplicates`);
}

async function updateExistingChapterDatasheets() {
  console.log('\n🔧 Phase 4: Updating Existing Chapter Datasheets...');
  
  // Find datasheets that already have subfaction set to a divergent chapter
  // and update their faction field and factionId
  for (const chapter of DIVERGENT_CHAPTERS) {
    const faction = await prisma.faction.findUnique({ where: { name: chapter } });
    if (!faction) continue;
    
    // Update datasheets where subfaction matches this chapter but faction is still "Space Marines"
    const result = await prisma.datasheet.updateMany({
      where: {
        subfaction: chapter,
        faction: 'Space Marines'
      },
      data: {
        faction: chapter,
        factionId: faction.id,
        subfaction: null
      }
    });
    
    if (result.count > 0) {
      console.log(`   ✓ Migrated ${result.count} datasheets from subfaction "${chapter}" to faction "${chapter}"`);
    }
    
    // Also check for case variations in subfaction
    const resultUppercase = await prisma.datasheet.updateMany({
      where: {
        subfaction: chapter.toUpperCase(),
        faction: 'Space Marines'
      },
      data: {
        faction: chapter,
        factionId: faction.id,
        subfaction: null
      }
    });
    
    if (resultUppercase.count > 0) {
      console.log(`   ✓ Migrated ${resultUppercase.count} datasheets from subfaction "${chapter.toUpperCase()}" to faction "${chapter}"`);
    }
  }
  
  console.log('   ✅ Existing chapter datasheets updated');
}

async function applyRestrictions() {
  console.log('\n🚫 Phase 5: Applying Restriction Rules...');
  
  for (const chapter of DIVERGENT_CHAPTERS) {
    const restrictions = CHAPTER_RESTRICTIONS[chapter];
    
    // Disable forbidden units
    if (restrictions.forbiddenUnits.length > 0) {
      for (const unitName of restrictions.forbiddenUnits) {
        const result = await prisma.datasheet.updateMany({
          where: {
            faction: chapter,
            name: unitName,
            isEnabled: true
          },
          data: { isEnabled: false }
        });
        
        if (result.count > 0) {
          console.log(`   ✓ Disabled "${unitName}" for ${chapter}`);
        }
      }
    }
    
    // Disable units with forbidden keywords
    if (restrictions.forbiddenKeywords.length > 0) {
      const datasheets = await prisma.datasheet.findMany({
        where: {
          faction: chapter,
          isEnabled: true
        }
      });
      
      for (const ds of datasheets) {
        let keywords: string[] = [];
        try {
          keywords = JSON.parse(ds.keywords);
        } catch {
          continue;
        }
        
        const hasForbidden = restrictions.forbiddenKeywords.some(
          fk => keywords.some(k => k.toUpperCase().includes(fk.toUpperCase()))
        );
        
        if (hasForbidden) {
          await prisma.datasheet.update({
            where: { id: ds.id },
            data: { isEnabled: false }
          });
          console.log(`   ✓ Disabled "${ds.name}" for ${chapter} (has forbidden keyword)`);
        }
      }
    }
  }
  
  console.log('   ✅ Restriction rules applied');
}

async function printSummary() {
  console.log('\n📊 Migration Summary:');
  
  const factions = await prisma.faction.findMany({
    include: {
      _count: {
        select: {
          datasheets: true,
          stratagemData: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  console.log('\n   Factions:');
  for (const f of factions) {
    const disabledCount = await prisma.datasheet.count({
      where: { factionId: f.id, isEnabled: false }
    });
    console.log(`   - ${f.name}: ${f._count.datasheets} datasheets (${disabledCount} disabled), ${f._count.stratagemData} stratagems`);
  }
  
  const totalDatasheets = await prisma.datasheet.count();
  const enabledDatasheets = await prisma.datasheet.count({ where: { isEnabled: true } });
  const disabledDatasheets = await prisma.datasheet.count({ where: { isEnabled: false } });
  
  console.log(`\n   Total Datasheets: ${totalDatasheets}`);
  console.log(`   - Enabled: ${enabledDatasheets}`);
  console.log(`   - Disabled: ${disabledDatasheets}`);
}

async function main() {
  console.log('🚀 Starting Faction Hierarchy Migration...\n');
  console.log('This migration will:');
  console.log('1. Flatten faction hierarchy (remove parent relationships)');
  console.log('1b. Normalize datasheet faction names');
  console.log('2. Update existing chapter datasheets');
  console.log('3. Duplicate Space Wolves datasheets to other chapters and generic Space Marines');
  console.log('4. Normalize stratagem faction names and link factionIds');
  console.log('5. Apply restriction rules (disable forbidden units)');
  
  try {
    await flattenFactions();
    await normalizeDatasheetFactions();
    await updateExistingChapterDatasheets();
    await duplicateDatasheets();
    await normalizeStratagems();
    await applyRestrictions();
    await printSummary();
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
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

export { main as migrateFactionHierarchy };

