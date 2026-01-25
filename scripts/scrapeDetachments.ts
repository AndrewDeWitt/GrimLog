
import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_URL = 'https://wahapedia.ru/wh40k10ed/factions';
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'parsed-rules');
const RATE_LIMIT_MS = 1500;

interface ScrapeConfig {
  faction: string;
  subfaction?: string; // For specific supplements like Space Wolves
  skipCache?: boolean;
}

// We will save detachments here
interface DetachmentsList {
  faction: string;
  detachments: string[];
  updatedAt: string;
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

// We will re-use cache from stratagems scraper if available, or create new cache
const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');

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

function parseDetachments(html: string, faction: string): string[] {
  const $ = cheerio.load(html);
  const detachments: Set<string> = new Set();
  
  // Wahapedia 10th Ed Structure
  // Detachments are typically listed in .s10Type within stratagems
  // e.g. "Gladius Task Force - Battle Tactic"
  
  // We can scan all stratagems and extract unique detachment names
  // This is safer than finding a specific list because Wahapedia layout varies
  
  $('.s10Wrap').each((_, el) => {
    const $el = $(el);
    const typeText = cleanText($el.find('.s10Type').text()); // e.g. "Core – Strategic Ploy" or "Gladius Task Force – Battle Tactic"
    
    if (!typeText) return;
    
    // Parse "Detachment – Type"
    const parts = typeText.split('–').map(s => s.trim());
    
    if (parts.length >= 2) {
        const detachment = parts[0];
        
        // Filter out "Core" and "Boarding Actions" if we want just army detachments
        // But user might be playing Boarding Actions, so keep them?
        // User specifically asked for "potential detachments" to distinguish from battle size.
        // "Core" is not a detachment. "Boarding Actions" is a game mode but acts like one.
        
        if (detachment !== 'Core' && detachment !== 'Boarding Actions' && detachment !== 'Boarding Strike') {
             detachments.add(detachment);
        }
    }
  });
  
  return Array.from(detachments).sort();
}

export async function scrapeDetachments(config: ScrapeConfig) {
  console.log(`\n🎯 Scraping detachments for ${config.faction}...`);
  
  // URL Construction
  const factionSlug = config.faction.toLowerCase().replace(/\s+/g, '-');
  
  // Try unit page to get stratagems which contain detachment names
  // This proved successful for Space Marines
  // We'll try Intercessor Squad for SM/SW and Termagants for Tyranids
  
  let urlsToTry = [
    `${BASE_URL}/${factionSlug}/detachments`, 
    `${BASE_URL}/${factionSlug}`, 
  ];
  
  if (factionSlug.includes('space-marines')) {
      urlsToTry.unshift(`${BASE_URL}/space-marines/Intercessor-Squad`);
  } else if (factionSlug.includes('space-wolves')) {
      // Space Wolves share the Space Marines pages often, but let's try their specific unit if we can find one
      // Or just re-use Space Marines logic but filter?
      // Wahapedia URL for Space Wolves faction page: https://wahapedia.ru/wh40k10ed/factions/space-marines/space-wolves
      // But stratagems are usually on the main Space Marines page or Supplement page.
      // Let's try a specific Space Wolves unit.
      urlsToTry.unshift(`${BASE_URL}/space-marines/Grey-Hunters`);
      urlsToTry.unshift(`${BASE_URL}/space-marines/space-wolves`);
  } else if (factionSlug.includes('tyranids')) {
      urlsToTry.unshift(`${BASE_URL}/${factionSlug}/Termagants`);
  } else {
      // Generic fallback - maybe scrape faction index and pick first unit?
      // For now rely on faction page
  }
  
  let html = '';
  
  for (const url of urlsToTry) {
    try {
        console.log(`Trying URL: ${url}`);
        const cacheKey = `${config.faction}/${url.split('/').pop() || 'index'}`;
        html = await getHTML(url, cacheKey, config.skipCache);
        
        // Quick check
        const temp$ = cheerio.load(html);
        if (temp$('.s10Wrap').length > 0) {
            console.log(`  Found content on this page.`);
            break;
        }
    } catch (e) {
        console.log(`  Failed: ${e.message}`);
    }
  }
  
  if (!html) {
      console.error('❌ Could not find a page with content.');
      return;
  }
  
  // Parse
  const detachments = parseDetachments(html, config.faction);
  
  console.log(`✅ Found ${detachments.length} detachments:`);
  console.log(detachments.join(', '));
  
  // Output
  const outputPath = path.join(OUTPUT_DIR, `detachments-${factionSlug}.json`);
  const outputData: DetachmentsList = {
      faction: config.faction,
      detachments,
      updatedAt: new Date().toISOString()
  };
  
  await fs.outputJson(outputPath, outputData, { spaces: 2 });
  console.log(`💾 Saved to ${outputPath}`);
}

async function main() {
  const factions = [
      'space-marines',
      'space-wolves',
      'tyranids'
  ];
  
  for (const faction of factions) {
      await scrapeDetachments({ faction });
  }
}

if (require.main === module) {
  main();
}

