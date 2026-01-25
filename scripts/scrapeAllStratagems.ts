
import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_URL = 'https://wahapedia.ru/wh40k10ed/factions/space-marines/';
const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'parsed-rules');
const RATE_LIMIT_MS = 1500;

interface StratagemRaw {
  name: string;
  type: string;
  cpCost: string;
  phase: string;
  fluff: string;
  when: string;
  target: string;
  effect: string;
  restrictions: string;
  detachment?: string;
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

function determineFaction(headerText: string): string | null {
    const text = headerText.toLowerCase();
    if (text.includes('space wolves')) return 'Space Wolves';
    if (text.includes('blood angels')) return 'Blood Angels';
    if (text.includes('dark angels')) return 'Dark Angels';
    if (text.includes('black templars')) return 'Black Templars';
    if (text.includes('deathwatch')) return 'Deathwatch';
    if (text.includes('space marine chapters')) return 'Space Marines'; // Generic
    if (text.includes('adeptus astartes')) return 'Space Marines';
    return null;
}

async function scrapeAllStratagems(skipCache = false) {
  console.log('🚀 Starting massive Space Marine scrape...');
  
  const html = await getHTML(BASE_URL, 'space-marines-full', skipCache);
  const $ = cheerio.load(html);
  
  const stratagemsByFaction: Record<string, StratagemRaw[]> = {};
  
  // Initialize collections
  const knownFactions = ['Space Marines', 'Space Wolves', 'Blood Angels', 'Dark Angels', 'Black Templars', 'Deathwatch'];
  knownFactions.forEach(f => stratagemsByFaction[f] = []);

  let currentFaction = 'Space Marines';
  let currentDetachment = 'Gladius Task Force'; // Default start
  
  // Traverse the content
  // The structure is complex, so we iterate through all elements in the main content area
  // looking for headers to switch context and .s10Wrap for content.
  
  // Wahapedia content usually sits in a specific container. 
  // Based on experience/inspection, we iterate strictly.
  
  // We'll iterate over specific headers and stratagem containers to maintain order
  // Select headers (h2, h3) and stratagem wrappers (.str10Wrap) in order of appearance
  
  const elements = $('.dsBanner, h2, h3, .str10Wrap, .break_before');
  
  console.log(`Found ${elements.length} elements to scan.`);

  elements.each((_, el) => {
    const $el = $(el);
    
    // 1. Check for Faction Headers (usually h2 or h3 with specific text)
    if ($el.is('h2') || $el.is('h3') || $el.is('.dsBanner')) {
        const text = cleanText($el.text());
        
        // Check for Supplement Headers
        if (text.includes('Codex Supplement') || text.includes('Army Rule')) {
            const newFaction = determineFaction(text);
            if (newFaction) {
                currentFaction = newFaction;
                console.log(`\n🔄 Switched Faction to: ${currentFaction}`);
            }
        }
        
        // Check for Detachment Headers
        if (!text.includes('Stratagems') && !text.includes('Enhancements') && !text.includes('Army Rule') && !text.includes('Introduction')) {
            // It might be a detachment name.
             if (!text.includes('Codex') && text.length < 40) {
                 // Exclude Boarding Actions game modes
                 const boardingActionsDetachments = [
                   'boarding strike', 
                   'boarding action', 
                   'pilum strike team', 
                   'terminator assault',
                   'combat patrol'
                 ];
                 
                 if (boardingActionsDetachments.some(ba => text.toLowerCase().includes(ba))) {
                    currentDetachment = 'IGNORED_MODE'; 
                 } else {
                    currentDetachment = text;
                 }
             }
        }
    }

    // 2. Process Stratagems
    if ($el.hasClass('str10Wrap')) {
        // Skip ignored detachments
        if (currentDetachment === 'IGNORED_MODE') return;

        const name = cleanText($el.find('.str10Name').text());
        if (!name) return;

        const typeText = cleanText($el.find('.str10Type').text());
        const cpText = cleanText($el.find('.str10CP').text());

        // Verify it's a stratagem (redundant with class check usually, but good for safety)
        // str10Wrap is pretty specific to stratagems.

        // Extract Type and Detachment
        let detachment = currentDetachment;
        let type = typeText.replace(' Stratagem', '');
        
        const parts = typeText.split('–').map(s => s.trim());
        if (parts.length >= 2) {
            detachment = parts[0];
            type = parts[1].replace(' Stratagem', '');
        }

        const cpCost = cpText.replace(/CP/i, '').trim();
        const content = $el.find('.str10Text');
        const fullText = cleanText(content.text());

        // Parsing details
        let when = '';
        let target = '';
        let effect = '';
        let restrictions = '';

        const whenMatch = fullText.match(/WHEN:?\s*(.*?)(?=(TARGET|EFFECT|RESTRICTIONS)|$)/i);
        if (whenMatch) when = whenMatch[1].trim();

        const targetMatch = fullText.match(/TARGET:?\s*(.*?)(?=(EFFECT|RESTRICTIONS)|$)/i);
        if (targetMatch) target = targetMatch[1].trim();

        const effectMatch = fullText.match(/EFFECT:?\s*(.*?)(?=(RESTRICTIONS)|$)/i);
        if (effectMatch) effect = effectMatch[1].trim();

        const restrictionsMatch = fullText.match(/RESTRICTIONS:?\s*(.*?)$/i);
        if (restrictionsMatch) restrictions = restrictionsMatch[1].trim();

        if (!effect && !target && !when) {
            effect = fullText;
        }

        // Add to collection
        if (!stratagemsByFaction[currentFaction]) {
            stratagemsByFaction[currentFaction] = [];
        }
        
        // Check for duplicates
        const existing = stratagemsByFaction[currentFaction].find(s => s.name === name && s.detachment === detachment);
        if (!existing) {
            stratagemsByFaction[currentFaction].push({
                name,
                type,
                cpCost,
                phase: 'Any',
                fluff: '',
                when,
                target,
                effect,
                restrictions,
                detachment,
                faction: currentFaction,
                source: 'Wahapedia Scrape'
            });
        }
    }
  });

  // Save files
  for (const [faction, stratagems] of Object.entries(stratagemsByFaction)) {
      if (stratagems.length === 0) continue;
      
      const slug = faction.toLowerCase().replace(/\s+/g, '-');
      const outputPath = path.join(OUTPUT_DIR, `stratagems-${slug}.json`);
      
      console.log(`💾 Saving ${stratagems.length} stratagems for ${faction} to ${outputPath}`);
      await fs.outputJson(outputPath, { stratagems }, { spaces: 2 });
  }
  
  console.log('✅ Scrape complete!');
}

async function main() {
  const args = process.argv.slice(2);
  const skipCache = args.includes('--skip-cache');
  await scrapeAllStratagems(skipCache);
}

if (require.main === module) {
  main();
}

