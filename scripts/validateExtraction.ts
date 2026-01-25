/**
 * Validate HTML Extraction
 * 
 * Tests the extraction process to ensure we're not losing critical data
 * Compares extracted content against what should be present
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as cheerio from 'cheerio';

const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');

/**
 * Extract datasheet content (same as in parseDatasheets.ts)
 */
function extractDatasheetContent(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove all unnecessary elements globally
  $('script, style, noscript').remove();
  $('.page_ads, .NavBtn, .NavColumns, .tooltip_templates').remove();
  $('nav, header, footer, .settings, .search').remove();
  
  // Get the main datasheet wrapper - this contains everything we need
  const $datasheet = $('.dsOuterFrame, .datasheet').first();
  
  if ($datasheet.length === 0) {
    console.warn('⚠️ Could not find datasheet wrapper, using full body');
    return $('body').text().substring(0, 20000);
  }
  
  // Get just the datasheet content as text (all tables, abilities, etc.)
  const datasheetText = $datasheet.text();
  
  // Also extract keywords from the page header/meta (they might not be in the datasheet box)
  const keywords: string[] = [];
  $('.kwb, .kwbo, .kwbu').each((_, el) => {
    const kw = $(el).text().trim();
    if (kw && kw.length > 0 && kw.length < 50 && !keywords.includes(kw)) {
      keywords.push(kw);
    }
  });
  
  // Build structured output
  const output = [
    `=== DATASHEET ===`,
    datasheetText,
    `\n=== KEYWORDS ===`,
    keywords.join(', '),
  ].join('\n');
  
  // Limit to reasonable size for LLM (max 15k chars ≈ 4k tokens)
  const truncated = output.substring(0, 15000);
  
  return truncated;
}

/**
 * Check if extracted content contains all critical elements
 */
function validateExtractedContent(extracted: string, unitName: string): {
  hasAllElements: boolean;
  missing: string[];
  found: string[];
} {
  const checks = {
    stats: /Movement|M\s+\d|Toughness|T\s+\d|Save|Sv\s+\d|Wounds|W\s+\d|Leadership|Ld\s+\d|OC\s+\d/i,
    weapons: /RANGED WEAPONS|MELEE WEAPONS|RANGE|Melee/i,
    abilities: /ABILITIES|CORE:|FACTION:/i,
    composition: /model|EPIC HERO|equipped with/i,
    points: /\d{1,3}\s*model\d{2,4}|models\d{2,4}|\d{1,4}\s*pts|\d{1,4}\s*points|PriceTag/i,
    invulnSave: /INVULNERABLE SAVE|\d\+\+/i,
    keywords: /KEYWORDS:|INFANTRY|CHARACTER|VEHICLE/i,
  };
  
  const found: string[] = [];
  const missing: string[] = [];
  
  for (const [element, regex] of Object.entries(checks)) {
    if (regex.test(extracted)) {
      found.push(element);
    } else {
      missing.push(element);
    }
  }
  
  return {
    hasAllElements: missing.length === 0,
    missing,
    found,
  };
}

/**
 * Validate a single unit's extraction
 */
async function validateUnit(unitFile: string): Promise<void> {
  const htmlPath = path.join(CACHE_DIR, 'space-marines', unitFile);
  const html = await fs.readFile(htmlPath, 'utf-8');
  
  const unitName = unitFile.replace('.html', '').replace(/_/g, ' ');
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Validating: ${unitName}`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log(`📊 Original HTML size: ${Math.round(html.length / 1024)} KB`);
  
  // Extract content
  const extracted = extractDatasheetContent(html);
  console.log(`📊 Extracted content size: ${Math.round(extracted.length / 1024)} KB`);
  console.log(`📊 Size reduction: ${Math.round((1 - extracted.length / html.length) * 100)}%\n`);
  
  // Validate content
  const validation = validateExtractedContent(extracted, unitName);
  
  console.log(`✅ Found elements: ${validation.found.join(', ')}`);
  
  if (validation.missing.length > 0) {
    console.log(`❌ Missing elements: ${validation.missing.join(', ')}\n`);
    console.log(`⚠️ WARNING: Some critical data may not have been extracted!`);
  } else {
    console.log(`✅ All critical elements present!\n`);
  }
  
  // Show preview of extracted content
  console.log(`📄 Extracted Content Preview (first 800 chars):`);
  console.log(`${'-'.repeat(70)}`);
  console.log(extracted.substring(0, 800));
  console.log(`${'-'.repeat(70)}\n`);
  
  // Save extracted content for manual review
  const outputPath = path.join(process.cwd(), 'data', 'extraction-test', `${unitFile.replace('.html', '.txt')}`);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, extracted, 'utf-8');
  console.log(`💾 Full extracted content saved to: ${outputPath}\n`);
  
  return;
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/validateExtraction.ts [unit-name] [unit-name2] ...

Examples:
  tsx scripts/validateExtraction.ts Logan_Grimnar
  tsx scripts/validateExtraction.ts Logan_Grimnar Arjac_Rockfist Grey_Hunters
  tsx scripts/validateExtraction.ts --all  (validate first 5 units)

This will:
1. Extract datasheet content from cached HTML
2. Check for presence of stats, weapons, abilities, etc.
3. Show size reduction
4. Save extracted content for manual review
    `);
    process.exit(0);
  }
  
  let unitsToTest: string[] = [];
  
  if (args[0] === '--all') {
    // Test first 5 units from cache
    const files = await fs.readdir(path.join(CACHE_DIR, 'space-marines'));
    unitsToTest = files
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .slice(0, 5);
    
    console.log(`\n🎯 Testing first 5 units from cache...\n`);
  } else {
    // Test specified units
    unitsToTest = args.map(name => {
      // Add .html if not present
      return name.endsWith('.html') ? name : `${name}.html`;
    });
  }
  
  console.log(`Testing ${unitsToTest.length} unit(s):\n`);
  
  for (const unitFile of unitsToTest) {
    try {
      await validateUnit(unitFile);
    } catch (error) {
      console.error(`❌ Error validating ${unitFile}:`, error);
    }
  }
  
  console.log(`\n✨ Validation complete!`);
  console.log(`\n📁 Review extracted files in: data/extraction-test/`);
  console.log(`\nIf all validations show "All critical elements present", you're good to proceed with parsing!`);
}

// Run if called directly
if (require.main === module) {
  main();
}

