/**
 * Validate Imported Datasheets
 * 
 * Checks that datasheets were imported correctly into the database
 */

import { prisma } from '../lib/prisma';
import { getDatasheetByName, getFactionDatasheets } from '../lib/datasheetHelpers';

interface ValidationReport {
  totalDatasheets: number;
  validated: number;
  errors: Array<{
    datasheet: string;
    issues: string[];
  }>;
}

/**
 * Validate a single datasheet
 */
async function validateDatasheet(name: string, faction: string): Promise<string[]> {
  const issues: string[] = [];
  
  const datasheet = await getDatasheetByName(name, faction);
  
  if (!datasheet) {
    issues.push('Datasheet not found in database');
    return issues;
  }
  
  // Check required fields
  if (!datasheet.name) issues.push('Missing name');
  if (!datasheet.faction) issues.push('Missing faction');
  if (!datasheet.role) issues.push('Missing role');
  if (!datasheet.keywords || datasheet.keywords.length === 0) issues.push('Missing keywords');
  
  // Validate stats
  if (!datasheet.movement) issues.push('Missing movement');
  if (datasheet.toughness < 1 || datasheet.toughness > 12) {
    issues.push(`Invalid toughness: ${datasheet.toughness} (must be 1-12)`);
  }
  if (!datasheet.save) issues.push('Missing save');
  if (datasheet.wounds < 1) issues.push(`Invalid wounds: ${datasheet.wounds}`);
  if (datasheet.leadership < 1) issues.push(`Invalid leadership: ${datasheet.leadership}`);
  if (datasheet.objectiveControl < 0) issues.push(`Invalid OC: ${datasheet.objectiveControl}`);
  
  // Check weapons
  if (datasheet.weapons.length === 0) {
    issues.push('No weapons found (unusual - verify datasheet)');
  } else {
    for (const weapon of datasheet.weapons) {
      if (!weapon.name) issues.push(`Weapon missing name`);
      if (!weapon.range) issues.push(`Weapon ${weapon.name} missing range`);
      if (!weapon.strength) issues.push(`Weapon ${weapon.name} missing strength`);
      if (!weapon.damage) issues.push(`Weapon ${weapon.name} missing damage`);
    }
  }
  
  // Check abilities
  if (datasheet.abilities.length === 0) {
    issues.push('No abilities found (unusual - verify datasheet)');
  } else {
    for (const ability of datasheet.abilities) {
      if (!ability.name) issues.push(`Ability missing name`);
      if (!ability.description) issues.push(`Ability ${ability.name} missing description`);
    }
  }
  
  return issues;
}

/**
 * Validate all datasheets for a faction
 */
async function validateFaction(faction: string, subfaction?: string): Promise<ValidationReport> {
  console.log(`\n🔍 Validating ${faction}${subfaction ? ` (${subfaction})` : ''}...\n`);
  
  const datasheets = await getFactionDatasheets(faction, subfaction);
  
  if (datasheets.length === 0) {
    console.log(`❌ No datasheets found for ${faction}`);
    console.log(`\nDid you run the import scripts?`);
    console.log(`  1. tsx scripts/scrapeWahapedia.ts "${faction}"${subfaction ? ` "${subfaction}"` : ''}`);
    console.log(`  2. tsx scripts/parseDatasheets.ts "${faction}"`);
    console.log(`  3. tsx scripts/seedDatasheets.ts "${faction}"`);
    process.exit(1);
  }
  
  console.log(`📊 Found ${datasheets.length} datasheets to validate\n`);
  
  const report: ValidationReport = {
    totalDatasheets: datasheets.length,
    validated: 0,
    errors: [],
  };
  
  for (let i = 0; i < datasheets.length; i++) {
    const ds = datasheets[i];
    console.log(`[${i + 1}/${datasheets.length}] Validating ${ds.name}...`);
    
    const issues = await validateDatasheet(ds.name, faction);
    
    if (issues.length > 0) {
      console.log(`  ⚠️ ${issues.length} issue(s) found`);
      report.errors.push({
        datasheet: ds.name,
        issues,
      });
    } else {
      console.log(`  ✅ Valid`);
      report.validated++;
    }
  }
  
  return report;
}

/**
 * Print validation report
 */
function printReport(report: ValidationReport, faction: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Validation Report for ${faction}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Datasheets: ${report.totalDatasheets}`);
  console.log(`Valid: ${report.validated} (${Math.round(report.validated / report.totalDatasheets * 100)}%)`);
  console.log(`Issues Found: ${report.errors.length}`);
  
  if (report.errors.length > 0) {
    console.log(`\n⚠️ Datasheets with Issues:\n`);
    for (const error of report.errors) {
      console.log(`${error.datasheet}:`);
      error.issues.forEach(issue => console.log(`  - ${issue}`));
      console.log();
    }
    
    console.log(`\n💡 Suggestions:`);
    console.log(`  1. Review the parsed JSON files in data/parsed-datasheets/${faction}/`);
    console.log(`  2. Check if GPT-4 parsing missed any fields`);
    console.log(`  3. Re-run parser if HTML structure changed`);
    console.log(`  4. Manually fix critical datasheets if needed`);
  } else {
    console.log(`\n✅ All datasheets passed validation!`);
    console.log(`\nThe import was successful. Datasheets are ready to use in game sessions.`);
  }
  
  console.log();
}

/**
 * Test a few specific datasheets (spot check)
 */
async function spotCheck(unitNames: string[], faction: string): Promise<void> {
  console.log(`\n🎯 Spot Check: Testing specific units\n`);
  
  for (const name of unitNames) {
    console.log(`Checking ${name}...`);
    const datasheet = await getDatasheetByName(name, faction);
    
    if (!datasheet) {
      console.log(`  ❌ Not found in database`);
      continue;
    }
    
    console.log(`  ✅ Found`);
    console.log(`  Stats: M ${datasheet.movement} | T ${datasheet.toughness} | Sv ${datasheet.save} | W ${datasheet.wounds} | Ld ${datasheet.leadership} | OC ${datasheet.objectiveControl}`);
    console.log(`  Weapons: ${datasheet.weapons.length}`);
    console.log(`  Abilities: ${datasheet.abilities.length}`);
    console.log(`  Points: ${datasheet.pointsCost}`);
    
    if (datasheet.weapons.length > 0) {
      const weapon = datasheet.weapons[0];
      console.log(`  Example weapon: ${weapon.name} (${weapon.range}, S${weapon.strength}, AP${weapon.armorPenetration}, D${weapon.damage})`);
    }
    
    console.log();
  }
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/validateImport.ts <faction> [subfaction]

Examples:
  tsx scripts/validateImport.ts "space-marines" "space-wolves"
  tsx scripts/validateImport.ts "tyranids"
    `);
    process.exit(0);
  }
  
  const faction = args[0];
  const subfaction = args[1];
  
  try {
    // Full validation
    const report = await validateFaction(faction, subfaction);
    printReport(report, faction);
    
    // Spot check famous units (if Space Wolves)
    if (faction.toLowerCase().includes('marine') && subfaction?.toLowerCase().includes('wolves')) {
      await spotCheck(['Logan Grimnar', 'Arjac Rockfist', 'Grey Hunters', 'Blood Claws'], faction);
    }
    
    // Exit with error code if issues found
    if (report.errors.length > 0) {
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

