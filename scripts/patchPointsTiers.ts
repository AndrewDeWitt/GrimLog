/**
 * Patch Points Tiers Script
 * 
 * Extracts points tiers from cached Wahapedia HTML files
 * and patches existing parsed-datasheets JSON files.
 * 
 * This avoids re-running expensive AI parsing - uses only local cached data.
 * 
 * Usage: npx ts-node scripts/patchPointsTiers.ts [faction]
 * Examples:
 *   npx ts-node scripts/patchPointsTiers.ts              # All factions
 *   npx ts-node scripts/patchPointsTiers.ts space-marines # Just Space Marines
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as cheerio from 'cheerio';

const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const PARSED_DIR = path.join(process.cwd(), 'data', 'parsed-datasheets');

// Simple points tier for uniform model units
interface SimplePointsTier {
  models: number;
  points: number;
}

// Composition-based points tier for multi-model-type units
interface CompositionPointsTier {
  composition: Record<string, number>;
  points: number;
}

// Add-on model that adds extra points to base cost
interface AddOnPointsTier {
  addOn: string;        // Model type name (e.g., "Invader ATV")
  addOnPoints: number;  // Additional points cost
}

type PointsTier = SimplePointsTier | CompositionPointsTier | AddOnPointsTier;

function isCompositionTier(tier: PointsTier): tier is CompositionPointsTier {
  return 'composition' in tier;
}

function isAddOnTier(tier: PointsTier): tier is AddOnPointsTier {
  return 'addOn' in tier;
}

interface PatchStats {
  processed: number;
  multiTier: number;
  singleTier: number;
  compositionTier: number; // Units with composition-based tiers (e.g., Headtakers + Wolves)
  addOnTier: number;       // Units with add-on models (e.g., Invader ATV +60pts)
  noMatch: number;
  errors: number;
}

/**
 * Parse composition text like "3 Wolf Guard Headtakers and 3 Hunting Wolves"
 * Returns a map of model type name to count, or null if not a composition pattern
 */
function parseCompositionText(text: string): Record<string, number> | null {
  // Check for "X ModelType and Y OtherModelType" pattern
  // Examples:
  //   "3 Wolf Guard Headtakers and 3 Hunting Wolves"
  //   "6 Wolf Guard Headtakers and 6 Hunting Wolves"
  //   "1 Neurogaunt Nodebeast and 10 Neurogaunts"
  
  // Pattern: "(\d+)\s+(.+?)\s+and\s+(\d+)\s+(.+)"
  const andPattern = /^(\d+)\s+(.+?)\s+and\s+(\d+)\s+(.+)$/i;
  const andMatch = text.match(andPattern);
  
  if (andMatch) {
    const count1 = parseInt(andMatch[1], 10);
    const type1 = andMatch[2].trim();
    const count2 = parseInt(andMatch[3], 10);
    const type2 = andMatch[4].trim();
    
    if (!isNaN(count1) && !isNaN(count2) && type1 && type2) {
      return {
        [type1]: count1,
        [type2]: count2,
      };
    }
  }
  
  // Check for simple "X ModelType" pattern (without "and")
  // This is still a composition tier if the model text doesn't say "models"
  // Examples:
  //   "3 Wolf Guard Headtakers"
  //   "6 Wolf Guard Headtakers"
  // eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifier, controlled datasheet input
  const simplePattern = /^(\d+)\s+(.+?)(?:\s{0,10}models?)?$/i;
  const simpleMatch = text.match(simplePattern);
  
  if (simpleMatch && !text.toLowerCase().includes('models')) {
    const count = parseInt(simpleMatch[1], 10);
    const modelType = simpleMatch[2].trim();
    
    // Only treat as composition if it looks like a specific model type name
    // (more than one word, not just a number)
    if (!isNaN(count) && modelType && modelType.split(/\s+/).length >= 2) {
      return { [modelType]: count };
    }
  }
  
  return null;
}

/**
 * Extract points tiers from HTML content
 * Supports:
 * - Simple model count tiers: "5 models" → 170pts
 * - Composition-based tiers: "3 Wolf Guard Headtakers and 3 Hunting Wolves" → 110pts
 * - Add-on model tiers: "Invader ATV" → +60pts (added to base cost)
 */
function extractPointsTiers(html: string): PointsTier[] | null {
  const $ = cheerio.load(html);
  const tiers: PointsTier[] = [];
  const addOns: AddOnPointsTier[] = [];
  
  // Find all PriceTag elements in tables
  $('table').each((_, table) => {
    const $table = $(table);
    
    // Check if this table contains PriceTag elements
    const priceTags = $table.find('.PriceTag');
    if (priceTags.length === 0) return;
    
    // Parse each row
    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td');
      
      if (cells.length >= 2) {
        const modelText = $(cells[0]).text().trim();
        const priceTagText = $(cells[1]).find('.PriceTag').text().trim();
        
        if (!priceTagText) return;
        
        // Check for add-on pricing (e.g., "+60" for Invader ATV)
        const addOnMatch = priceTagText.match(/^\+(\d+)$/);
        if (addOnMatch) {
          const addOnPoints = parseInt(addOnMatch[1], 10);
          if (!isNaN(addOnPoints) && modelText) {
            addOns.push({ addOn: modelText, addOnPoints });
          }
          return;
        }
        
        // Regular points cost
        const points = parseInt(priceTagText, 10);
        if (isNaN(points)) return;
        
        // First, try to parse as composition-based tier
        const composition = parseCompositionText(modelText);
        if (composition) {
          tiers.push({ composition, points });
          return;
        }
        
        // Fall back to simple "X models" pattern
        const modelMatch = modelText.match(/(\d+)\s*models?/i);
        if (modelMatch) {
          const models = parseInt(modelMatch[1], 10);
          if (!isNaN(models)) {
            tiers.push({ models, points });
          }
        }
      }
    });
  });
  
  // Sort regular tiers
  // For simple tiers: by model count ascending
  // For composition tiers: by total model count ascending
  tiers.sort((a, b) => {
    const totalA = isCompositionTier(a) 
      ? Object.values(a.composition).reduce((sum, c) => sum + c, 0)
      : (a as SimplePointsTier).models;
    const totalB = isCompositionTier(b)
      ? Object.values(b.composition).reduce((sum, c) => sum + c, 0)
      : (b as SimplePointsTier).models;
    return totalA - totalB;
  });
  
  // Add add-on tiers at the end
  tiers.push(...addOns);
  
  return tiers.length > 0 ? tiers : null;
}

/**
 * Convert filename to a normalized key for matching
 * E.g., "Wolf_Guard_Terminators.html" -> "wolfguardterminators"
 */
function normalizeForMatching(filename: string): string {
  return filename
    .replace(/\.(html|json)$/i, '')
    .replace(/[_\-\s]+/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Process a single faction directory
 */
async function processFaction(factionDir: string, stats: PatchStats): Promise<void> {
  const cacheDir = path.join(CACHE_DIR, factionDir);
  const parsedDir = path.join(PARSED_DIR, factionDir);
  
  // Check if directories exist
  if (!await fs.pathExists(cacheDir)) {
    console.error(`  ⚠️  Cache directory not found: ${cacheDir}`);
    return;
  }
  
  if (!await fs.pathExists(parsedDir)) {
    console.error(`  ⚠️  Parsed directory not found: ${parsedDir}`);
    return;
  }
  
  // Get all HTML files in cache
  const htmlFiles = (await fs.readdir(cacheDir))
    .filter(f => f.endsWith('.html') && !f.includes('complete-scrape') && !f.includes('index'));
  
  // Build a map of normalized names to JSON files
  const jsonFiles = (await fs.readdir(parsedDir))
    .filter(f => f.endsWith('.json'));
  
  const jsonMap = new Map<string, string>();
  for (const jsonFile of jsonFiles) {
    const normalized = normalizeForMatching(jsonFile);
    jsonMap.set(normalized, jsonFile);
  }
  
  console.error(`  📁 Found ${htmlFiles.length} HTML files, ${jsonFiles.length} JSON files`);
  
  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(cacheDir, htmlFile);
    const normalizedHtml = normalizeForMatching(htmlFile);
    
    // Try to find matching JSON file by normalized name
    let jsonFile = jsonMap.get(normalizedHtml);
    
    // Try direct filename match (just swap extension)
    if (!jsonFile) {
      const directMatch = htmlFile.replace('.html', '.json');
      if (jsonFiles.includes(directMatch)) {
        jsonFile = directMatch;
      }
    }
    
    if (!jsonFile) {
      stats.noMatch++;
      continue;
    }
    
    try {
      // Read HTML and extract tiers
      const html = await fs.readFile(htmlPath, 'utf-8');
      const tiers = extractPointsTiers(html);
      
      if (!tiers) {
        stats.noMatch++;
        continue;
      }
      
      // Read and update JSON
      const jsonPath = path.join(parsedDir, jsonFile);
      const datasheet = await fs.readJson(jsonPath);
      
      // Add pointsTiers field
      datasheet.pointsTiers = tiers;
      
      // Write back
      await fs.writeJson(jsonPath, datasheet, { spaces: 2 });
      
      stats.processed++;
      
      // Check if any tier is composition-based or add-on
      const hasComposition = tiers.some(t => isCompositionTier(t));
      const hasAddOn = tiers.some(t => isAddOnTier(t));
      
      // Build tier strings for logging
      const tierStrs = tiers.map(t => {
        if (isCompositionTier(t)) {
          const compStr = Object.entries(t.composition)
            .map(([name, count]) => `${count} ${name}`)
            .join(' + ');
          return `[${compStr}]→${t.points}pts`;
        } else if (isAddOnTier(t)) {
          return `[+${t.addOn}]+${t.addOnPoints}pts`;
        } else {
          return `${t.models}→${t.points}pts`;
        }
      });
      
      if (hasComposition) {
        stats.compositionTier++;
        console.error(`  🔷 ${datasheet.name} (COMPOSITION): ${tierStrs.join(', ')}`);
      } else if (hasAddOn) {
        stats.addOnTier++;
        console.error(`  ➕ ${datasheet.name} (ADD-ON): ${tierStrs.join(', ')}`);
      } else if (tiers.length > 1) {
        stats.multiTier++;
        console.error(`  ✅ ${datasheet.name}: ${tierStrs.join(', ')}`);
      } else {
        stats.singleTier++;
      }
      
    } catch (error) {
      stats.errors++;
      console.error(`  ❌ Error processing ${htmlFile}:`, error);
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const targetFaction = process.argv[2];
  
  console.error('\n' + '═'.repeat(60));
  console.error('🔧 PATCHING POINTS TIERS FROM CACHED HTML');
  console.error('═'.repeat(60));
  console.error(`Cache dir: ${CACHE_DIR}`);
  console.error(`Parsed dir: ${PARSED_DIR}`);
  
  const stats: PatchStats = {
    processed: 0,
    multiTier: 0,
    singleTier: 0,
    compositionTier: 0,
    addOnTier: 0,
    noMatch: 0,
    errors: 0,
  };
  
  // Get faction directories
  let factionDirs: string[];
  
  if (targetFaction) {
    factionDirs = [targetFaction];
  } else {
    // Get all faction directories in cache
    const allDirs = await fs.readdir(CACHE_DIR);
    factionDirs = [];
    
    for (const dir of allDirs) {
      const dirPath = path.join(CACHE_DIR, dir);
      const stat = await fs.stat(dirPath);
      if (stat.isDirectory()) {
        factionDirs.push(dir);
      }
    }
  }
  
  console.error(`\n📂 Processing ${factionDirs.length} faction(s): ${factionDirs.join(', ')}\n`);
  
  for (const factionDir of factionDirs) {
    console.error(`\n🎯 ${factionDir.toUpperCase()}`);
    await processFaction(factionDir, stats);
  }
  
  // Summary
  console.error('\n' + '═'.repeat(60));
  console.error('📊 PATCH SUMMARY');
  console.error('═'.repeat(60));
  console.error(`  ✅ Processed:       ${stats.processed} datasheets`);
  console.error(`  🔷 Composition:     ${stats.compositionTier} units (multi-model-type, e.g., Headtakers + Wolves)`);
  console.error(`  ➕ Add-on:          ${stats.addOnTier} units (optional add-on models, e.g., Invader ATV +60pts)`);
  console.error(`  📊 Multi-tier:      ${stats.multiTier} units (variable model count)`);
  console.error(`  📊 Single-tier:     ${stats.singleTier} units (fixed model count)`);
  console.error(`  ⚠️  No match:       ${stats.noMatch} HTML files without JSON match`);
  console.error(`  ❌ Errors:          ${stats.errors}`);
  console.error('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

