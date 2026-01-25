import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_URL = 'https://wahapedia.ru/wh40k10ed/factions';
const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'parsed-rules');
const RATE_LIMIT_MS = 1500;

interface ScrapeConfig {
  faction: string;
  subfaction?: string; // For specific supplements like Space Wolves
  skipCache?: boolean;
}

interface StratagemRaw {
  name: string;
  type: string; // Battle Tactic, Epic Deed, etc.
  cpCost: string;
  phase: string; // Turn/Phase info
  fluff: string;
  when: string;
  target: string;
  effect: string;
  restrictions: string;
  detachment?: string; // The detachment this belongs to
  faction: string;
  source: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHTML(url: string): Promise<string> {
  console.log(`📡 Fetching: ${url}`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return await response.text();
}

async function getHTML(url: string, cacheKey: string, skipCache = false): Promise<string> {
  const filePath = path.join(CACHE_DIR, `${cacheKey}.html`);
  if (!skipCache && await fs.pathExists(filePath)) {
    console.log(`📦 Loaded from cache: ${cacheKey}`);
    return fs.readFile(filePath, 'utf-8');
  }
  await delay(RATE_LIMIT_MS);
  const html = await fetchHTML(url);
  await fs.outputFile(filePath, html);
  return html;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseStratagems(html: string, faction: string, subfaction?: string): StratagemRaw[] {
  const $ = cheerio.load(html);
  const stratagems: StratagemRaw[] = [];
  
  // Wahapedia 10th Ed Structure
  // Stratagems are typically in .s10Wrap elements
  // Name: .s10Name
  // Type: .s10Type (often "Detachment - Type" e.g. "Gladius Task Force - Battle Tactic")
  // CP: .s10NameWrapCP > div:last-child (text "1CP")
  // Text: .str10Text
  
  const wraps = $('.s10Wrap');
  console.log(`DEBUG: Found ${wraps.length} .s10Wrap elements`);

  wraps.each((_, el) => {
    const $el = $(el);
    
    const name = cleanText($el.find('.s10Name').text());
    console.log(`DEBUG: Checking element with name: "${name}"`);
    
    // Skip if no name (might be just a spacer or legend)
    if (!name) return;

    const typeText = cleanText($el.find('.s10Type').text()); // e.g. "Core – Strategic Ploy"
    const cpText = cleanText($el.find('.s10NameWrapCP > div').last().text()); // e.g. "1CP"
    
    console.log(`DEBUG:   Type: "${typeText}", CP: "${cpText}"`);
    
    // Only process if it looks like a stratagem (has CP cost or type indicates Stratagem)
    if (!typeText.toLowerCase().includes('stratagem') && !cpText.includes('CP')) {
        console.log(`DEBUG:   Skipping - not a stratagem`);
        return;
    }

    // Parse Type and Detachment from typeText
    // Format usually: "Detachment Name – Stratagem Type"
    // e.g. "Gladius Task Force – Battle Tactic Stratagem"
    const parts = typeText.split('–').map(s => s.trim());
    let detachment = 'Unknown';
    let type = 'Unknown';
    
    if (parts.length >= 2) {
        detachment = parts[0];
        type = parts[1].replace(' Stratagem', '');
    } else {
        type = typeText.replace(' Stratagem', '');
    }

    const cpCost = cpText.replace(/CP/i, '').trim();
    
    const content = $el.find('.str10Text');
    
    // Remove the "WHEN:", "TARGET:" labels to get clean text for fields if possible,
    // but keeping the full HTML or text might be safer for now given the complex structure.
    // Let's try to extract structured data if labels exist.
    
    const fullText = cleanText(content.text());
    const fullHtml = content.html() || '';
    
    // Regex extract (improved)
    // Look for bold tags usually wrapping labels
    let when = '';
    let target = '';
    let effect = '';
    let restrictions = '';
    
    // Naive regex extraction on text
    const whenMatch = fullText.match(/WHEN:?\s*(.*?)(?=(TARGET|EFFECT|RESTRICTIONS)|$)/i);
    if (whenMatch) when = whenMatch[1].trim();
    
    const targetMatch = fullText.match(/TARGET:?\s*(.*?)(?=(EFFECT|RESTRICTIONS)|$)/i);
    if (targetMatch) target = targetMatch[1].trim();
    
    const effectMatch = fullText.match(/EFFECT:?\s*(.*?)(?=(RESTRICTIONS)|$)/i);
    if (effectMatch) effect = effectMatch[1].trim();
    
    const restrictionsMatch = fullText.match(/RESTRICTIONS:?\s*(.*?)$/i);
    if (restrictionsMatch) restrictions = restrictionsMatch[1].trim();
    
    // Fallback if regex fails (sometimes labels aren't standard)
    if (!effect && !target && !when) {
        effect = fullText;
    }

    // Filter out non-stratagem rules that might share the class (like Enhancements sometimes?)
    // Usually Enhancements have their own section, but let's be safe.
    // The typeText check usually handles this ("Stratagem" in name).

    stratagems.push({
      name,
      type,
      cpCost,
      phase: 'Any', // Would need icon parsing for this
      fluff: '', // Legend often not captured easily
      when,
      target,
      effect,
      restrictions,
      detachment,
      faction,
      source: 'Wahapedia'
    });
  });
  
  return stratagems;
}

export async function scrapeStratagems(config: ScrapeConfig) {
  console.log(`\n🎯 Scraping stratagems for ${config.faction}...`);
  
  // URL Construction
  const factionSlug = config.faction.toLowerCase().replace(/\s+/g, '-');
  
  // Try the detachments page
  // Wahapedia doesn't always have consistent URLs, but let's try likely candidates
  const urlsToTry = [
    `${BASE_URL}/${factionSlug}/Intercessor-Squad`, // Try a unit page - often contains all stratagems hidden
    `${BASE_URL}/${factionSlug}/Terminator-Squad`, // Fallback unit
    `${BASE_URL}/${factionSlug}/detachments`,
    `${BASE_URL}/${factionSlug}`, 
  ];
  
  let html = '';
  let successUrl = '';

  for (const url of urlsToTry) {
    try {
        console.log(`Trying URL: ${url}`);
        const cacheKey = `${config.faction}/${url.split('/').pop() || 'index'}`;
        html = await getHTML(url, cacheKey, config.skipCache);
        successUrl = url;
        
        // Check if we found any stratagems in this HTML
        const temp$ = cheerio.load(html);
        const count = temp$('.s10Wrap').length;
        if (count > 0) {
            console.log(`  Found ${count} potential stratagems on this page.`);
            break; // Found some!
        } else {
            console.log(`  No stratagems found on this page.`);
        }
    } catch (e) {
        console.log(`  Failed: ${e.message}`);
    }
  }
  
  if (!html) {
      console.error('❌ Could not find a page with stratagems.');
      return;
  }
  
  // Parse
  const stratagems = parseStratagems(html, config.faction, config.subfaction);
  
  console.log(`✅ Found ${stratagems.length} stratagems`);
  
  // Output
  const outputPath = path.join(OUTPUT_DIR, `stratagems-${factionSlug}.json`);
  await fs.outputJson(outputPath, { stratagems }, { spaces: 2 });
  console.log(`💾 Saved to ${outputPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: tsx scripts/scrapeStratagems.ts <faction> [--skip-cache]');
    process.exit(1);
  }
  
  const faction = args[0];
  const skipCache = args.includes('--skip-cache');
  
  await scrapeStratagems({ faction, skipCache });
}

if (require.main === module) {
  main();
}

