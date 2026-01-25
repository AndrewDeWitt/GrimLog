/**
 * Database Seeding Script for Datasheets
 * 
 * Imports parsed JSON datasheets into PostgreSQL via Prisma
 * Handles:
 * - Deduplication of weapons and abilities
 * - Junction table relationships
 * - Transaction-based imports for consistency
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { FACTION_DATA } from '../lib/factionConstants';

// Use direct connection for bulk seeding operations (bypasses pgbouncer)
// Priority: DIRECT_URL > DATABASE_URL_DEV > DATABASE_URL
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
console.log(`🔌 Using database connection: ${directUrl?.includes('pooler') ? 'Pooled (may be slow)' : 'Direct'}`);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl,
    },
  },
});
const PARSED_DIR = path.join(process.cwd(), 'data', 'parsed-datasheets');

// Map directory names to Faction Names
const DIR_TO_FACTION_NAME: Record<string, string> = {
  'space-marines': 'Space Marines',
  'tyranids': 'Tyranids',
  'astra-militarum': 'Astra Militarum',
  // Add others as needed
};

// Composition entry for accurate wound tracking
interface CompositionEntry {
  name: string;
  role: 'leader' | 'regular';
  count: number;
  woundsPerModel: number;
}

// Wargear stat effects for equipment that modifies characteristics
interface WargearEffect {
  wounds?: number;
  toughness?: number;
  save?: string;
  invulnerableSave?: string;
  movement?: string;
}

interface ParsedDatasheet {
  name: string;
  faction: string;
  subfaction?: string;
  role: string;
  keywords: string[];
  stats: {
    movement: string;
    toughness: number;
    save: string;
    invulnerableSave?: string;
    wounds: number;
    leadership: number;
    objectiveControl: number;
  };
  composition: string;
  compositionData?: CompositionEntry[];  // NEW: Structured composition with wounds per model type
  unitSize?: string;
  leaderRules?: string;
  leaderAbilities?: string;
  transportCapacity?: string;
  weapons: Array<{
    name: string;
    range: string;
    type: string;
    attacks: string;
    ballisticSkill?: string;
    weaponSkill?: string;
    strength: string;
    armorPenetration: string;
    damage: string;
    abilities: string[];
  }>;
  abilities: Array<{
    name: string;
    type: string;
    description: string;
    triggerPhase?: string[];
    triggerSubphase?: string;
    isReactive?: boolean;
    requiredKeywords?: string[];
    effects?: WargearEffect;  // NEW: Wargear stat modifications
  }>;
  wargearOptions?: Array<{
    description: string;
    pointsCost: number;
  }>;
  pointsCost: number;
  pointsTiers?: Array<{
    models: number;
    points: number;
  }>;
}

/**
 * Create or get existing weapon
 */
async function upsertWeapon(weaponData: ParsedDatasheet['weapons'][0]): Promise<string> {
  const weapon = await prisma.weapon.upsert({
    where: { name: weaponData.name },
    update: {
      range: weaponData.range,
      type: weaponData.type,
      attacks: weaponData.attacks,
      ballisticSkill: weaponData.ballisticSkill && weaponData.ballisticSkill !== '' ? weaponData.ballisticSkill : null,
      weaponSkill: weaponData.weaponSkill && weaponData.weaponSkill !== '' ? weaponData.weaponSkill : null,
      strength: weaponData.strength,
      armorPenetration: weaponData.armorPenetration,
      damage: weaponData.damage,
      abilities: JSON.stringify(weaponData.abilities),
    },
    create: {
      name: weaponData.name,
      range: weaponData.range,
      type: weaponData.type,
      attacks: weaponData.attacks,
      ballisticSkill: weaponData.ballisticSkill && weaponData.ballisticSkill !== '' ? weaponData.ballisticSkill : null,
      weaponSkill: weaponData.weaponSkill && weaponData.weaponSkill !== '' ? weaponData.weaponSkill : null,
      strength: weaponData.strength,
      armorPenetration: weaponData.armorPenetration,
      damage: weaponData.damage,
      abilities: JSON.stringify(weaponData.abilities),
    },
  });
  
  return weapon.id;
}

/**
 * Normalize ability phase classification
 * Maps known ability names to correct phase values
 */
function normalizeAbilityPhase(abilityData: ParsedDatasheet['abilities'][0]): string[] {
  const abilityName = abilityData.name.trim();
  
  // Deployment abilities
  const deploymentAbilities = [
    'Deep Strike',
    'DEEP STRIKE',
    'Scout',
    'SCOUT',
    'Infiltrators',
    'INFILTRATORS',
    'Strategic Reserves',
    'STRATEGIC RESERVES',
  ];
  
  // Keyword abilities
  const keywordAbilities = [
    'Leader',
    'LEADER',
    'Stealth',
    'STEALTH',
  ];
  
  // General rules
  const generalAbilities = [
    'Embarking within transports',
    'EMBARKING WITHIN TRANSPORTS',
  ];
  
  // Check if ability name matches known patterns
  if (deploymentAbilities.includes(abilityName)) {
    return ['Deployment'];
  }
  
  if (keywordAbilities.includes(abilityName)) {
    return ['Keyword'];
  }
  
  if (generalAbilities.includes(abilityName)) {
    return ['General'];
  }
  
  // If ability already has a valid triggerPhase, use it
  if (abilityData.triggerPhase && abilityData.triggerPhase.length > 0) {
    return abilityData.triggerPhase;
  }
  
  // Default fallback (shouldn't happen with updated parser, but safety net)
  return ['Any'];
}

/**
 * Create or get existing ability
 */
async function upsertAbility(abilityData: ParsedDatasheet['abilities'][0]): Promise<string> {
  // Normalize phase classification
  const normalizedPhase = normalizeAbilityPhase(abilityData);
  
  const ability = await prisma.ability.upsert({
    where: { name: abilityData.name },
    update: {
      type: abilityData.type,
      description: abilityData.description,
      triggerPhase: JSON.stringify(normalizedPhase),
      triggerSubphase: abilityData.triggerSubphase || null,
      isReactive: abilityData.isReactive || false,
      requiredKeywords: JSON.stringify(abilityData.requiredKeywords || []),
    },
    create: {
      name: abilityData.name,
      type: abilityData.type,
      description: abilityData.description,
      triggerPhase: JSON.stringify(normalizedPhase),
      triggerSubphase: abilityData.triggerSubphase || null,
      isReactive: abilityData.isReactive || false,
      requiredKeywords: JSON.stringify(abilityData.requiredKeywords || []),
    },
  });
  
  return ability.id;
}

/**
 * Clean null bytes from strings (PostgreSQL doesn't support \x00 in text fields)
 */
function cleanNullBytes(str: string): string {
  return str.replace(/\u0000/g, '');
}

/**
 * Normalize empty strings to null for database
 */
function normalizeEmpty(str: string | undefined): string | null {
  if (!str || str.trim() === '') return null;
  return cleanNullBytes(str);
}

/**
 * Normalize empty strings to undefined for optional fields
 */
function normalizeEmptyToUndefined(str: string | undefined): string | undefined {
  if (!str || str.trim() === '') return undefined;
  return cleanNullBytes(str);
}

/**
 * Resolve Faction ID based on keywords and context
 */
function resolveFactionId(
  keywords: string[], 
  subfaction: string | null,
  defaultFactionName: string, 
  factionMap: Map<string, string>
): string | null {
  // 1. Check for specific divergent chapter keywords
  for (const faction of FACTION_DATA) {
    if (faction.isDivergent && faction.parentFaction === defaultFactionName) {
      const hasKeyword = faction.keywords.some(kw => keywords.includes(kw));
      if (hasKeyword) {
        return factionMap.get(faction.name) || null;
      }
    }
  }

  // 2. Check for Parent Keyword (e.g. ADEPTUS ASTARTES)
  // If it has parent keyword but NO divergent keyword (checked above), it is Parent Faction.
  const parentFaction = FACTION_DATA.find(f => f.name === defaultFactionName);
  if (parentFaction) {
     const hasParentKeyword = parentFaction.keywords.some(kw => keywords.includes(kw));
     if (hasParentKeyword) {
       return factionMap.get(defaultFactionName) || null;
     }
  }

  // 3. Fallback: If NO keywords matched, use subfaction as a hint
  // BUT only if the unit also has the chapter-specific keyword.
  // This prevents generic Space Marines (scraped from Space Wolves page) from being
  // incorrectly assigned to Space Wolves just because subfaction says "space-wolves".
  if (subfaction) {
    const normalizedSubfaction = subfaction.toLowerCase().replace(/-/g, ' ');
    for (const faction of FACTION_DATA) {
      if (faction.isDivergent && faction.parentFaction === defaultFactionName) {
        const normalizedFactionName = faction.name.toLowerCase().replace(/-/g, ' ');
        
        // CRITICAL: Only assign to divergent faction if unit has the chapter-specific keyword
        const hasChapterKeyword = faction.keywords.some(kw => keywords.includes(kw));
        if (normalizedSubfaction === normalizedFactionName && hasChapterKeyword) {
           return factionMap.get(faction.name) || null;
        }
      }
    }
  }

  // 4. Final Fallback - assign to parent faction
  return factionMap.get(defaultFactionName) || null;
}

/**
 * Import a single datasheet
 * @param versionLabel Optional label for version bump (e.g., "Q4 2024 Balance")
 */
async function importDatasheet(
  data: ParsedDatasheet, 
  defaultFactionName: string,
  factionMap: Map<string, string>,
  versionLabel?: string
): Promise<void> {
  console.log(`📝 Importing ${data.name}...`);
  
  // Clean and normalize the data
  const cleanedName = cleanNullBytes(data.name);
  
  // Normalize faction/subfaction to Title Case to match DB Faction names and prevent duplicates
  // e.g. "space-marines" -> "Space Marines"
  const normalizeString = (s: string) => {
    if (!s) return "";
    return s.replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase()); // Simple Title Case
  };

  const cleanedFaction = normalizeString(cleanNullBytes(data.faction));
  const cleanedSubfaction = normalizeString(normalizeEmpty(data.subfaction) || "");
  
  // Resolve Faction ID
  const factionId = resolveFactionId(data.keywords, cleanedSubfaction, defaultFactionName, factionMap);
  
  if (!factionId) {
    console.warn(`⚠️ Could not resolve Faction ID for ${data.name} (Default: ${defaultFactionName})`);
  }

  // Use empty string for subfaction if not set (for consistent lookups)
  const subfactionForDb = cleanedSubfaction || '';
  
  // Use transaction for data consistency
  // Increase timeout to 60 seconds for complex datasheets with many weapons/abilities
  await prisma.$transaction(async (tx) => {
    // Check if datasheet already exists to determine if this is an update
    // Note: Using findFirst instead of upsert because Prisma composite unique 
    // constraints don't work well with null values (ownerId is null for official datasheets)
    const existing = await tx.datasheet.findFirst({
      where: {
        name: cleanedName,
        faction: cleanedFaction,
        subfaction: subfactionForDb,
        ownerId: null, // Only match official datasheets
      },
      select: { id: true, currentVersion: true },
    });
    
    const isUpdate = !!existing;
    const newVersionNumber = isUpdate ? (existing.currentVersion + 1) : 1;
    
    // 1. Create or update the datasheet using manual pattern (not upsert)
    // This avoids Prisma's limitation with null values in composite unique constraints
    let datasheet;
    
    // Serialize compositionData if present
    const compositionDataJson = data.compositionData ? JSON.stringify(data.compositionData) : null;
    
    if (existing) {
      // Update existing datasheet
      datasheet = await tx.datasheet.update({
        where: { id: existing.id },
        data: {
          factionId: factionId,
          role: cleanNullBytes(data.role),
          keywords: JSON.stringify(data.keywords),
          movement: cleanNullBytes(data.stats.movement),
          toughness: data.stats.toughness,
          save: cleanNullBytes(data.stats.save),
          invulnerableSave: normalizeEmpty(data.stats.invulnerableSave),
          wounds: data.stats.wounds,
          leadership: data.stats.leadership,
          objectiveControl: data.stats.objectiveControl,
          composition: cleanNullBytes(data.composition),
          compositionData: compositionDataJson,  // NEW: Structured composition data
          unitSize: normalizeEmpty(data.unitSize),
          leaderRules: normalizeEmpty(data.leaderRules),
          leaderAbilities: normalizeEmpty(data.leaderAbilities),
          transportCapacity: normalizeEmpty(data.transportCapacity),
          pointsCost: data.pointsCost,
          pointsTiers: data.pointsTiers ? JSON.stringify(data.pointsTiers) : null,
          lastUpdated: new Date(),
          currentVersion: newVersionNumber,
        },
      });
    } else {
      // Create new datasheet
      datasheet = await tx.datasheet.create({
        data: {
          name: cleanedName,
          faction: cleanedFaction,
          factionId: factionId,
          subfaction: subfactionForDb,
          role: cleanNullBytes(data.role),
          keywords: JSON.stringify(data.keywords),
          movement: cleanNullBytes(data.stats.movement),
          toughness: data.stats.toughness,
          save: cleanNullBytes(data.stats.save),
          invulnerableSave: normalizeEmpty(data.stats.invulnerableSave),
          wounds: data.stats.wounds,
          leadership: data.stats.leadership,
          objectiveControl: data.stats.objectiveControl,
          composition: cleanNullBytes(data.composition),
          compositionData: compositionDataJson,  // NEW: Structured composition data
          unitSize: normalizeEmpty(data.unitSize),
          leaderRules: normalizeEmpty(data.leaderRules),
          leaderAbilities: normalizeEmpty(data.leaderAbilities),
          transportCapacity: normalizeEmpty(data.transportCapacity),
          pointsCost: data.pointsCost,
          pointsTiers: data.pointsTiers ? JSON.stringify(data.pointsTiers) : null,
          isOfficial: true,
          ownerId: null,
          visibility: 'public',
          currentVersion: 1,
        },
      });
    }
    
    // 2. Delete existing weapon relationships (for re-imports)
    await tx.datasheetWeapon.deleteMany({
      where: { datasheetId: datasheet.id },
    });
    
    // 3. Import weapons (track to avoid duplicates for same datasheet)
    const addedWeaponIds = new Set<string>();
    for (const weaponData of data.weapons) {
      // Clean weapon data
      const cleanedWeaponData = {
        ...weaponData,
        name: cleanNullBytes(weaponData.name),
        range: cleanNullBytes(weaponData.range),
        type: cleanNullBytes(weaponData.type),
        attacks: cleanNullBytes(weaponData.attacks),
        ballisticSkill: normalizeEmptyToUndefined(weaponData.ballisticSkill),
        weaponSkill: normalizeEmptyToUndefined(weaponData.weaponSkill),
        strength: cleanNullBytes(weaponData.strength),
        armorPenetration: cleanNullBytes(weaponData.armorPenetration),
        damage: cleanNullBytes(weaponData.damage),
      };
      
      const weaponId = await upsertWeapon(cleanedWeaponData);
      
      // Only create relationship if not already added
      if (!addedWeaponIds.has(weaponId)) {
        await tx.datasheetWeapon.create({
          data: {
            datasheetId: datasheet.id,
            weaponId: weaponId,
            isDefault: true, // Default assumption, could be refined
          },
        });
        addedWeaponIds.add(weaponId);
      }
    }
    
    // 4. Delete existing ability relationships (for re-imports)
    await tx.datasheetAbility.deleteMany({
      where: { datasheetId: datasheet.id },
    });
    
    // 5. Import abilities
    const addedAbilityIds = new Set<string>();
    for (const abilityData of data.abilities) {
      // Clean ability data
      const cleanedAbilityData = {
        ...abilityData,
        name: cleanNullBytes(abilityData.name),
        type: cleanNullBytes(abilityData.type),
        description: cleanNullBytes(abilityData.description),
      };
      
      const abilityId = await upsertAbility(cleanedAbilityData);
      
      // Only create relationship if not already added
      if (!addedAbilityIds.has(abilityId)) {
        await tx.datasheetAbility.create({
          data: {
            datasheetId: datasheet.id,
            abilityId: abilityId,
            source: cleanedAbilityData.type,
          },
        });
        addedAbilityIds.add(abilityId);
      }
    }
    
    // 6. Delete existing wargear relationships (for re-imports)
    await tx.datasheetWargear.deleteMany({
      where: { datasheetId: datasheet.id },
    });
    
    // 7. Import wargear options
    if (data.wargearOptions && data.wargearOptions.length > 0) {
      for (const wargearData of data.wargearOptions) {
        const cleanDescription = cleanNullBytes(wargearData.description);
        const wargearOption = await tx.wargearOption.create({
          data: {
            name: `${cleanedName} - ${cleanDescription}`,
            description: cleanDescription,
            pointsCost: wargearData.pointsCost,
            type: 'equipment',
          },
        });
        
        await tx.datasheetWargear.create({
          data: {
            datasheetId: datasheet.id,
            wargearOptionId: wargearOption.id,
          },
        });
      }
    }
    
    // 8. Create version snapshot
    const fullDatasheet = await tx.datasheet.findUniqueOrThrow({
      where: { id: datasheet.id },
      include: {
        weapons: { include: { weapon: true } },
        abilities: { include: { ability: true } },
        wargearOptions: { include: { wargearOption: true } },
      },
    });

    const snapshot = {
      id: fullDatasheet.id,
      name: fullDatasheet.name,
      faction: fullDatasheet.faction,
      factionId: fullDatasheet.factionId,
      subfaction: fullDatasheet.subfaction,
      role: fullDatasheet.role,
      keywords: data.keywords,
      movement: fullDatasheet.movement,
      toughness: fullDatasheet.toughness,
      save: fullDatasheet.save,
      invulnerableSave: fullDatasheet.invulnerableSave,
      wounds: fullDatasheet.wounds,
      leadership: fullDatasheet.leadership,
      objectiveControl: fullDatasheet.objectiveControl,
      composition: fullDatasheet.composition,
      compositionData: fullDatasheet.compositionData,
      unitSize: fullDatasheet.unitSize,
      leaderRules: fullDatasheet.leaderRules,
      leaderAbilities: fullDatasheet.leaderAbilities,
      transportCapacity: fullDatasheet.transportCapacity,
      pointsCost: fullDatasheet.pointsCost,
      pointsTiers: fullDatasheet.pointsTiers ? JSON.parse(fullDatasheet.pointsTiers) : null,
      edition: fullDatasheet.edition,
      sourceBook: fullDatasheet.sourceBook,
      weapons: fullDatasheet.weapons.map(dw => ({
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
        abilities: JSON.parse(dw.weapon.abilities || '[]'),
        isDefault: dw.isDefault,
        quantity: dw.quantity,
      })),
      abilities: fullDatasheet.abilities.map(da => ({
        id: da.ability.id,
        name: da.ability.name,
        type: da.ability.type,
        description: da.ability.description,
        triggerPhase: da.ability.triggerPhase ? JSON.parse(da.ability.triggerPhase) : null,
        source: da.source,
      })),
      wargearOptions: fullDatasheet.wargearOptions.map(dw => ({
        id: dw.wargearOption.id,
        name: dw.wargearOption.name,
        description: dw.wargearOption.description,
        pointsCost: dw.wargearOption.pointsCost,
        type: dw.wargearOption.type,
      })),
    };

    await tx.datasheetVersion.create({
      data: {
        datasheetId: datasheet.id,
        versionNumber: newVersionNumber,
        versionLabel: versionLabel || (isUpdate ? `Update ${newVersionNumber}` : 'Initial Import'),
        snapshotData: JSON.stringify(snapshot),
        changelog: isUpdate 
          ? (versionLabel || 'Official datasheet update')
          : 'Initial datasheet import from Games Workshop data',
        createdById: null, // System/admin created
      },
    });
    
    console.log(`✅ Imported ${cleanedName} v${newVersionNumber} with ${data.weapons.length} weapons, ${data.abilities.length} abilities`);
  }, {
    timeout: 60000, // 60 seconds for complex datasheets with many weapons
    maxWait: 10000, // 10 seconds to acquire connection
  });
}

/**
 * Import all datasheets for a faction
 * @param factionDirName Directory name for the faction (e.g., "space-marines")
 * @param versionLabel Optional version label for balance updates (e.g., "Q4 2024 Balance")
 */
export async function seedFaction(factionDirName: string, versionLabel?: string): Promise<void> {
  const factionDir = path.join(PARSED_DIR, factionDirName);
  
  if (!await fs.pathExists(factionDir)) {
    throw new Error(`No parsed data found for ${factionDirName}. Run parser first.`);
  }
  
  const defaultFactionName = DIR_TO_FACTION_NAME[factionDirName];
  if (!defaultFactionName) {
    throw new Error(`Unknown faction directory: ${factionDirName}. Add to DIR_TO_FACTION_NAME in script.`);
  }

  console.log(`\n🎯 Seeding datasheets for ${defaultFactionName} (from ${factionDirName})`);
  if (versionLabel) {
    console.log(`📌 Version Label: ${versionLabel}`);
  }
  console.log();
  
  // Fetch all factions to build ID map
  const allFactions = await prisma.faction.findMany();
  const factionMap = new Map<string, string>(allFactions.map(f => [f.name, f.id]));
  
  if (factionMap.size === 0) {
    console.warn('⚠️ No factions found in DB. Did you run seedFactions.ts?');
  }

  // Get all parsed JSON files
  const files = await fs.readdir(factionDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'parse-summary.json');
  
  console.log(`📊 Found ${jsonFiles.length} datasheets to import\n`);
  
  const results = {
    total: jsonFiles.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ file: string; error: string }>,
  };
  
  for (let i = 0; i < jsonFiles.length; i++) {
    const file = jsonFiles[i];
    console.log(`\n[${i + 1}/${jsonFiles.length}] ${file}`);
    
    try {
      const filePath = path.join(factionDir, file);
      const data: ParsedDatasheet = await fs.readJson(filePath);
      
      await importDatasheet(data, defaultFactionName, factionMap, versionLabel);
      results.success++;
    } catch (error) {
      console.error(`❌ Failed to import ${file}:`, error);
      results.failed++;
      results.errors.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Seed Summary for ${defaultFactionName}`);
  if (versionLabel) {
    console.log(`📌 Version: ${versionLabel}`);
  }
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📝 Total: ${results.total}`);
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️ Errors:`);
    results.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
  }
  
  console.log(`\n✨ Seeding complete!`);
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/seedDatasheets.ts <faction> [--version-label "Label"]

Examples:
  tsx scripts/seedDatasheets.ts "space-marines"
  tsx scripts/seedDatasheets.ts "tyranids"
  tsx scripts/seedDatasheets.ts "space-marines" --version-label "Q4 2024 Balance"

Options:
  --version-label "Label"  Add a version label for balance updates
                          This creates a new version for existing datasheets

Note: Run parseDatasheets.ts first to parse HTML data.
    `);
    process.exit(0);
  }
  
  const faction = args[0];
  
  // Parse --version-label flag
  let versionLabel: string | undefined;
  const versionLabelIndex = args.indexOf('--version-label');
  if (versionLabelIndex !== -1 && args[versionLabelIndex + 1]) {
    versionLabel = args[versionLabelIndex + 1];
  }
  
  try {
    await seedFaction(faction, versionLabel);
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

