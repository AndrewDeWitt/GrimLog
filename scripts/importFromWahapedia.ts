/**
 * Combined Wahapedia Import Script
 * 
 * Scrapes faction data from Wahapedia and imports it directly into the database.
 * This is a convenience script that combines scrapeWahapediaFaction.ts and importFaction.ts.
 * 
 * Usage:
 *   npx tsx scripts/importFromWahapedia.ts tyranids
 *   npx tsx scripts/importFromWahapedia.ts space-marines --skip-cache
 *   npx tsx scripts/importFromWahapedia.ts space-marines --dry-run
 *   npx tsx scripts/importFromWahapedia.ts space-marines --update
 * 
 * Options:
 *   --skip-cache   Force fresh scrape from Wahapedia
 *   --dry-run      Scrape and validate but don't write to database
 *   --update       Update existing records instead of skipping
 *   --save-json    Save JSON file even when importing directly
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { scrapeFaction, FACTION_CONFIGS, FactionImportData } from './scrapeWahapediaFaction';
import { importFactionData, validateImportData } from './importFaction';

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'wahapedia-import');

interface ImportOptions {
  skipCache: boolean;
  dryRun: boolean;
  update: boolean;
  saveJson: boolean;
}

async function importFromWahapedia(
  factionKey: string,
  options: ImportOptions
): Promise<boolean> {
  console.log('\n' + '═'.repeat(60));
  console.log('🌐 WAHAPEDIA IMPORT WORKFLOW');
  console.log('═'.repeat(60));
  console.log(`   Faction: ${factionKey}`);
  console.log(`   Skip Cache: ${options.skipCache}`);
  console.log(`   Dry Run: ${options.dryRun}`);
  console.log(`   Update Existing: ${options.update}`);
  console.log(`   Save JSON: ${options.saveJson}`);
  console.log('═'.repeat(60));

  // Step 1: Scrape from Wahapedia
  console.log('\n📡 STEP 1: Scraping from Wahapedia...');
  
  const scrapeResult = await scrapeFaction(factionKey, { 
    skipCache: options.skipCache 
  });
  
  if (!scrapeResult) {
    console.error('\n❌ Scraping failed. Aborting import.');
    return false;
  }

  // Step 2: Validate the scraped data
  console.log('\n🔍 STEP 2: Validating scraped data...');
  
  const validation = validateImportData(scrapeResult);
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  if (!validation.valid) {
    console.log('\n❌ Validation errors:');
    validation.errors.forEach(e => console.log(`   - ${e}`));
    
    // Still save JSON for debugging
    if (options.saveJson) {
      const outputPath = path.join(OUTPUT_DIR, `${factionKey}-invalid.json`);
      await fs.ensureDir(OUTPUT_DIR);
      await fs.writeJson(outputPath, scrapeResult, { spaces: 2 });
      console.log(`\n📁 Invalid data saved to: ${outputPath}`);
    }
    
    return false;
  }
  
  console.log('   ✅ Validation passed');

  // Step 3: Save JSON file if requested
  if (options.saveJson || options.dryRun) {
    const outputPath = path.join(OUTPUT_DIR, `${factionKey}.json`);
    await fs.ensureDir(OUTPUT_DIR);
    await fs.writeJson(outputPath, scrapeResult, { spaces: 2 });
    console.log(`\n📁 JSON saved to: ${outputPath}`);
  }

  // Step 4: Import to database
  console.log('\n📥 STEP 3: Importing to database...');
  
  const stats = await importFactionData(scrapeResult, {
    dryRun: options.dryRun,
    update: options.update,
  });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Faction: ${stats.faction.name}`);
  console.log(`      Status: ${stats.faction.created ? 'Created' : stats.faction.updated ? 'Updated' : 'Unchanged'}`);
  console.log(`   Detachments:`);
  console.log(`      Created: ${stats.detachments.created}`);
  console.log(`      Updated: ${stats.detachments.updated}`);
  console.log(`      Skipped: ${stats.detachments.skipped}`);
  console.log(`   Stratagems:`);
  console.log(`      Created: ${stats.stratagems.created}`);
  console.log(`      Updated: ${stats.stratagems.updated}`);
  console.log(`      Skipped: ${stats.stratagems.skipped}`);
  console.log(`   Enhancements:`);
  console.log(`      Created: ${stats.enhancements.created}`);
  console.log(`      Updated: ${stats.enhancements.updated}`);
  console.log(`      Skipped: ${stats.enhancements.skipped}`);
  
  if (options.dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No data was written to the database.');
    console.log('   Remove --dry-run to perform the actual import.');
  } else {
    console.log('\n✅ Import completed successfully!');
  }

  return true;
}

// ============================================
// Batch Import
// ============================================

async function importAllFactions(options: ImportOptions): Promise<void> {
  const factions = Object.keys(FACTION_CONFIGS);
  const results: { faction: string; success: boolean }[] = [];
  
  console.log(`\n🚀 Batch importing ${factions.length} factions...`);
  console.log('   This will take a while due to rate limiting.\n');
  
  for (const factionKey of factions) {
    try {
      const success = await importFromWahapedia(factionKey, options);
      results.push({ faction: factionKey, success });
    } catch (error) {
      console.error(`❌ Failed to import ${factionKey}:`, error);
      results.push({ faction: factionKey, success: false });
    }
    
    // Extra delay between factions
    console.log('\n⏳ Waiting before next faction...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 BATCH IMPORT SUMMARY');
  console.log('═'.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`   ✅ Successful: ${successful.length}`);
  successful.forEach(r => console.log(`      - ${r.faction}`));
  
  if (failed.length > 0) {
    console.log(`   ❌ Failed: ${failed.length}`);
    failed.forEach(r => console.log(`      - ${r.faction}`));
  }
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const factionKey = args.find(arg => !arg.startsWith('--'));
  const skipCache = args.includes('--skip-cache');
  const dryRun = args.includes('--dry-run');
  const update = args.includes('--update');
  const saveJson = args.includes('--save-json');
  const importAll = args.includes('--all');
  
  if (!factionKey && !importAll) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🌐 WAHAPEDIA COMBINED IMPORT                       ║
╠══════════════════════════════════════════════════════════════╣
║  Scrapes faction data from Wahapedia and imports it into     ║
║  the database in one step.                                   ║
║                                                              ║
║  Usage:                                                      ║
║    npx tsx scripts/importFromWahapedia.ts <faction>          ║
║    npx tsx scripts/importFromWahapedia.ts --all              ║
║                                                              ║
║  Available factions:                                         ║
║    ${Object.keys(FACTION_CONFIGS).slice(0, 6).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(6, 12).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(12, 18).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(18).join(', ')}
║                                                              ║
║  Options:                                                    ║
║    --skip-cache   Force fresh scrape from Wahapedia          ║
║    --dry-run      Scrape and validate but don't import       ║
║    --update       Update existing records instead of skip    ║
║    --save-json    Save JSON file even when importing         ║
║    --all          Import all known factions (batch mode)     ║
║                                                              ║
║  Examples:                                                   ║
║    npx tsx scripts/importFromWahapedia.ts tyranids           ║
║    npx tsx scripts/importFromWahapedia.ts space-marines --update
║    npx tsx scripts/importFromWahapedia.ts --all --dry-run    ║
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  }
  
  const options: ImportOptions = {
    skipCache,
    dryRun,
    update,
    saveJson,
  };
  
  if (importAll) {
    await importAllFactions(options);
  } else if (factionKey) {
    const success = await importFromWahapedia(factionKey, options);
    process.exit(success ? 0 : 1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((e) => {
    console.error('\n💥 Fatal error:', e);
    process.exit(1);
  });
}

export { importFromWahapedia };

