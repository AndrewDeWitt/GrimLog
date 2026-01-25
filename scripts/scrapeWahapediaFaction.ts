/**
 * Wahapedia Faction Scraper
 * 
 * Scrapes complete faction data from Wahapedia and outputs structured JSON
 * that matches our import schema for easy database import.
 * 
 * Features:
 * - Scrapes faction page for detachments
 * - Extracts detachment abilities, stratagems, and enhancements
 * - Outputs JSON compatible with importFaction.ts
 * - Rate limiting and caching
 * 
 * Usage:
 *   npx tsx scripts/scrapeWahapediaFaction.ts tyranids
 *   npx tsx scripts/scrapeWahapediaFaction.ts space-marines --skip-cache
 *   npx tsx scripts/scrapeWahapediaFaction.ts space-marines --subfaction space-wolves
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_URL = 'https://wahapedia.ru/wh40k10ed/factions';
const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'wahapedia-import');
const RATE_LIMIT_MS = 1500;

// ============================================
// Types matching our import schema
// ============================================

interface StratagemData {
  name: string;
  cpCost: number;
  type: 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear';
  when: string;
  target: string;
  effect: string;
  restrictions?: string | null;
  keywords?: string[] | null;
  triggerPhase?: string[] | null;
  isReactive?: boolean;
}

interface EnhancementData {
  name: string;
  pointsCost: number;
  description: string;
  restrictions?: string[] | null;
  keywords?: string[] | null;
}

interface DetachmentData {
  name: string;
  subfaction?: string | null;
  abilityName?: string | null;
  abilityDescription?: string | null;
  description?: string | null;
  stratagems: StratagemData[];
  enhancements: EnhancementData[];
}

interface FactionImportData {
  faction: {
    name: string;
    keywords: string[];
    parentFaction?: string | null;
    isDivergent?: boolean;
  };
  detachments: DetachmentData[];
}

// ============================================
// Utility Functions
// ============================================

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

async function fetchHTML(url: string): Promise<string> {
  console.log(`📡 Fetching: ${url}`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
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
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, html);
  return html;
}

// ============================================
// Faction Configuration
// ============================================

interface FactionConfig {
  name: string;
  slug: string;
  keywords: string[];
  parentFaction?: string;
  isDivergent?: boolean;
}

const FACTION_CONFIGS: Record<string, FactionConfig> = {
  'tyranids': {
    name: 'Tyranids',
    slug: 'tyranids',
    keywords: ['TYRANIDS'],
  },
  'space-marines': {
    name: 'Space Marines',
    slug: 'space-marines',
    keywords: ['ADEPTUS ASTARTES'],
  },
  'space-wolves': {
    name: 'Space Wolves',
    slug: 'space-marines',
    keywords: ['SPACE WOLVES', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
    isDivergent: true,
  },
  'blood-angels': {
    name: 'Blood Angels',
    slug: 'space-marines',
    keywords: ['BLOOD ANGELS', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
    isDivergent: true,
  },
  'dark-angels': {
    name: 'Dark Angels',
    slug: 'space-marines',
    keywords: ['DARK ANGELS', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
    isDivergent: true,
  },
  'astra-militarum': {
    name: 'Astra Militarum',
    slug: 'astra-militarum',
    keywords: ['ASTRA MILITARUM'],
  },
  'orks': {
    name: 'Orks',
    slug: 'orks',
    keywords: ['ORKS'],
  },
  'necrons': {
    name: 'Necrons',
    slug: 'necrons',
    keywords: ['NECRONS'],
  },
  'aeldari': {
    name: 'Aeldari',
    slug: 'aeldari',
    keywords: ['AELDARI'],
  },
  'chaos-space-marines': {
    name: 'Chaos Space Marines',
    slug: 'chaos-space-marines',
    keywords: ['HERETIC ASTARTES'],
  },
  'death-guard': {
    name: 'Death Guard',
    slug: 'death-guard',
    keywords: ['DEATH GUARD', 'HERETIC ASTARTES'],
  },
  'thousand-sons': {
    name: 'Thousand Sons',
    slug: 'thousand-sons',
    keywords: ['THOUSAND SONS', 'HERETIC ASTARTES'],
  },
  'world-eaters': {
    name: 'World Eaters',
    slug: 'world-eaters',
    keywords: ['WORLD EATERS', 'HERETIC ASTARTES'],
  },
  'chaos-daemons': {
    name: 'Chaos Daemons',
    slug: 'chaos-daemons',
    keywords: ['CHAOS DAEMONS'],
  },
  'tau-empire': {
    name: "T'au Empire",
    slug: 'tau-empire',
    keywords: ['TAU EMPIRE'],
  },
  'leagues-of-votann': {
    name: 'Leagues of Votann',
    slug: 'leagues-of-votann',
    keywords: ['LEAGUES OF VOTANN'],
  },
  'genestealer-cults': {
    name: 'Genestealer Cults',
    slug: 'genestealer-cults',
    keywords: ['GENESTEALER CULTS'],
  },
  'adeptus-custodes': {
    name: 'Adeptus Custodes',
    slug: 'adeptus-custodes',
    keywords: ['ADEPTUS CUSTODES'],
  },
  'grey-knights': {
    name: 'Grey Knights',
    slug: 'grey-knights',
    keywords: ['GREY KNIGHTS'],
  },
  'adepta-sororitas': {
    name: 'Adepta Sororitas',
    slug: 'adepta-sororitas',
    keywords: ['ADEPTA SORORITAS'],
  },
  'adeptus-mechanicus': {
    name: 'Adeptus Mechanicus',
    slug: 'adeptus-mechanicus',
    keywords: ['ADEPTUS MECHANICUS'],
  },
  'imperial-knights': {
    name: 'Imperial Knights',
    slug: 'imperial-knights',
    keywords: ['IMPERIAL KNIGHTS'],
  },
  'chaos-knights': {
    name: 'Chaos Knights',
    slug: 'chaos-knights',
    keywords: ['CHAOS KNIGHTS'],
  },
  'drukhari': {
    name: 'Drukhari',
    slug: 'drukhari',
    keywords: ['DRUKHARI'],
  },
};

// ============================================
// Parsing Functions
// ============================================

function parseStratagemType(typeText: string): 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear' {
  const lower = typeText.toLowerCase();
  if (lower.includes('battle tactic')) return 'Battle Tactic';
  if (lower.includes('strategic ploy')) return 'Strategic Ploy';
  if (lower.includes('epic deed')) return 'Epic Deed';
  if (lower.includes('wargear')) return 'Wargear';
  return 'Strategic Ploy'; // Default
}

function parseTriggerPhases(whenText: string): string[] {
  const phases: string[] = [];
  const lower = whenText.toLowerCase();
  
  if (lower.includes('command phase')) phases.push('Command');
  if (lower.includes('movement phase')) phases.push('Movement');
  if (lower.includes('shooting phase')) phases.push('Shooting');
  if (lower.includes('charge phase')) phases.push('Charge');
  if (lower.includes('fight phase')) phases.push('Fight');
  
  // Check for opponent's turn indicators
  if (lower.includes('opponent') || lower.includes('enemy')) {
    // This is a reactive stratagem
  }
  
  return phases.length > 0 ? phases : ['Any'];
}

function isReactiveStratagem(whenText: string): boolean {
  const lower = whenText.toLowerCase();
  return lower.includes('opponent') || 
         lower.includes('enemy') || 
         lower.includes('your opponent');
}

function parseStratagemsFromHTML($: cheerio.CheerioAPI): Map<string, StratagemData[]> {
  const stratagemsByDetachment = new Map<string, StratagemData[]>();
  
  // Wahapedia uses .str10Wrap for 10th edition stratagems
  $('.str10Wrap').each((_, el) => {
    const $el = $(el);
    
    const name = cleanText($el.find('.str10Name').text());
    if (!name) return;
    
    const typeText = cleanText($el.find('.str10Type').text());
    const cpText = cleanText($el.find('.str10CP').text());
    
    // Parse detachment from type text (e.g., "Gladius Task Force – Battle Tactic")
    let detachmentName = 'Core';
    let stratagemTypeText = typeText;
    
    const typeParts = typeText.split('–').map(s => s.trim());
    if (typeParts.length >= 2) {
      detachmentName = typeParts[0];
      stratagemTypeText = typeParts.slice(1).join(' ');
    }
    
    // Skip boarding actions and other game modes
    const ignoredModes = ['boarding actions', 'boarding strike', 'combat patrol'];
    if (ignoredModes.some(mode => detachmentName.toLowerCase().includes(mode))) {
      return;
    }
    
    // Parse CP cost
    const cpCost = parseInt(cpText.replace(/[^0-9]/g, '')) || 1;
    
    // Parse stratagem content
    const contentHtml = $el.find('.str10Text').html() || '';
    const contentText = cleanText($el.find('.str10Text').text());
    
    // Extract WHEN, TARGET, EFFECT, RESTRICTIONS
    let when = '';
    let target = '';
    let effect = '';
    let restrictions: string | null = null;
    
    // Try to parse structured format
    const whenMatch = contentText.match(/WHEN:?\s*(.*?)(?=TARGET:|EFFECT:|RESTRICTIONS:|$)/i);
    if (whenMatch) when = whenMatch[1].trim();
    
    const targetMatch = contentText.match(/TARGET:?\s*(.*?)(?=EFFECT:|RESTRICTIONS:|$)/i);
    if (targetMatch) target = targetMatch[1].trim();
    
    const effectMatch = contentText.match(/EFFECT:?\s*(.*?)(?=RESTRICTIONS:|$)/i);
    if (effectMatch) effect = effectMatch[1].trim();
    
    const restrictionsMatch = contentText.match(/RESTRICTIONS?:?\s*(.*?)$/i);
    if (restrictionsMatch) restrictions = restrictionsMatch[1].trim() || null;
    
    // Fallback if structured parsing fails
    if (!when && !target && !effect) {
      effect = contentText;
    }
    
    const stratagem: StratagemData = {
      name,
      cpCost,
      type: parseStratagemType(stratagemTypeText),
      when: when || 'Any phase',
      target: target || 'One unit from your army',
      effect: effect || contentText,
      restrictions,
      triggerPhase: parseTriggerPhases(when),
      isReactive: isReactiveStratagem(when),
    };
    
    // Add to detachment collection
    if (!stratagemsByDetachment.has(detachmentName)) {
      stratagemsByDetachment.set(detachmentName, []);
    }
    stratagemsByDetachment.get(detachmentName)!.push(stratagem);
  });
  
  return stratagemsByDetachment;
}

function parseEnhancementsFromHTML($: cheerio.CheerioAPI): Map<string, EnhancementData[]> {
  const enhancementsByDetachment = new Map<string, EnhancementData[]>();
  
  // Wahapedia uses .enhWrap or similar for enhancements
  // The exact structure varies, so we'll look for enhancement sections
  
  let currentDetachment = 'Unknown';
  
  // Look for enhancement headers and content
  $('h3, h4, .enhWrap, .enh10Wrap').each((_, el) => {
    const $el = $(el);
    
    // Check if this is a header indicating detachment
    if ($el.is('h3') || $el.is('h4')) {
      const headerText = cleanText($el.text());
      if (headerText.includes('Enhancement') && !headerText.includes(':')) {
        // Try to extract detachment from nearby context
        const prevHeader = $el.prevAll('h2, h3').first().text();
        if (prevHeader) {
          currentDetachment = cleanText(prevHeader);
        }
      }
    }
    
    // Parse enhancement content
    if ($el.hasClass('enhWrap') || $el.hasClass('enh10Wrap')) {
      const name = cleanText($el.find('.enhName, .enh10Name').text());
      if (!name) return;
      
      const costText = cleanText($el.find('.enhCost, .enh10Cost').text());
      const pointsCost = parseInt(costText.replace(/[^0-9]/g, '')) || 0;
      
      const description = cleanText($el.find('.enhText, .enh10Text').text());
      
      // Extract restrictions from description
      let restrictions: string[] | null = null;
      const restrictionMatch = description.match(/can only be given to|must be given to|(?:model|character) with/i);
      if (restrictionMatch) {
        restrictions = ['CHARACTER']; // Default assumption
      }
      
      const enhancement: EnhancementData = {
        name,
        pointsCost,
        description,
        restrictions,
      };
      
      if (!enhancementsByDetachment.has(currentDetachment)) {
        enhancementsByDetachment.set(currentDetachment, []);
      }
      enhancementsByDetachment.get(currentDetachment)!.push(enhancement);
    }
  });
  
  return enhancementsByDetachment;
}

function parseDetachmentAbilities($: cheerio.CheerioAPI): Map<string, { name: string; description: string }> {
  const abilities = new Map<string, { name: string; description: string }>();
  
  // Look for detachment ability sections
  // These usually have a specific structure with the detachment name and ability
  
  $('.dsAbility, .detAbility').each((_, el) => {
    const $el = $(el);
    const detachmentName = cleanText($el.find('.dsAbName, .detAbName').text());
    const abilityName = cleanText($el.find('.dsAbTitle, .detAbTitle').text());
    const description = cleanText($el.find('.dsAbText, .detAbText').text());
    
    if (detachmentName && abilityName) {
      abilities.set(detachmentName, { name: abilityName, description });
    }
  });
  
  return abilities;
}

// ============================================
// Main Scraping Function
// ============================================

interface ScrapeOptions {
  skipCache: boolean;
  subfaction?: string;
}

async function scrapeFaction(factionKey: string, options: ScrapeOptions): Promise<FactionImportData | null> {
  const config = FACTION_CONFIGS[factionKey];
  if (!config) {
    console.error(`❌ Unknown faction: ${factionKey}`);
    console.log('Available factions:', Object.keys(FACTION_CONFIGS).join(', '));
    return null;
  }
  
  console.log(`\n🎯 Scraping faction: ${config.name}`);
  console.log(`   URL slug: ${config.slug}`);
  if (options.subfaction) {
    console.log(`   Subfaction filter: ${options.subfaction}`);
  }
  
  // Build URL - faction index page contains detachments and stratagems
  const factionUrl = `${BASE_URL}/${config.slug}/`;
  const cacheKey = `${config.slug}/faction-full`;
  
  let html: string;
  try {
    html = await getHTML(factionUrl, cacheKey, options.skipCache);
  } catch (error) {
    console.error(`❌ Failed to fetch faction page:`, error);
    return null;
  }
  
  const $ = cheerio.load(html);
  
  // Parse all stratagems grouped by detachment
  console.log('\n📜 Parsing stratagems...');
  const stratagemsByDetachment = parseStratagemsFromHTML($);
  
  // Parse enhancements grouped by detachment
  console.log('⚔️  Parsing enhancements...');
  const enhancementsByDetachment = parseEnhancementsFromHTML($);
  
  // Parse detachment abilities
  console.log('🏴 Parsing detachment abilities...');
  const detachmentAbilities = parseDetachmentAbilities($);
  
  // Build detachment list from all sources
  const detachmentNames = new Set<string>();
  stratagemsByDetachment.forEach((_, name) => detachmentNames.add(name));
  enhancementsByDetachment.forEach((_, name) => detachmentNames.add(name));
  detachmentAbilities.forEach((_, name) => detachmentNames.add(name));
  
  // Remove "Core" from detachment names (those are universal stratagems)
  detachmentNames.delete('Core');
  
  // Build output data structure
  const detachments: DetachmentData[] = [];
  
  for (const detName of detachmentNames) {
    // Skip subfaction filtering if needed
    if (options.subfaction) {
      // Simple heuristic: check if detachment name contains subfaction name
      // This is imperfect but useful for divergent chapters
      // For now, include all detachments
    }
    
    const ability = detachmentAbilities.get(detName);
    const stratagems = stratagemsByDetachment.get(detName) || [];
    const enhancements = enhancementsByDetachment.get(detName) || [];
    
    // Only add detachment if it has content
    if (stratagems.length > 0 || enhancements.length > 0) {
      detachments.push({
        name: detName,
        abilityName: ability?.name || null,
        abilityDescription: ability?.description || null,
        stratagems,
        enhancements,
      });
    }
  }
  
  // Handle Core stratagems - they should be added to a "Core" detachment or merged
  const coreStratagems = stratagemsByDetachment.get('Core') || [];
  if (coreStratagems.length > 0) {
    console.log(`   Found ${coreStratagems.length} Core stratagems (universal)`);
    // We could add these as a separate "Core" detachment or skip them
    // For now, we'll include them as a Core detachment
    detachments.unshift({
      name: 'Core',
      abilityName: 'Core Stratagems',
      abilityDescription: 'Universal stratagems available to all armies.',
      stratagems: coreStratagems,
      enhancements: [],
    });
  }
  
  // Build final output
  const output: FactionImportData = {
    faction: {
      name: config.name,
      keywords: config.keywords,
      parentFaction: config.parentFaction || null,
      isDivergent: config.isDivergent || false,
    },
    detachments,
  };
  
  // Print summary
  console.log('\n📊 Scrape Summary:');
  console.log(`   Faction: ${config.name}`);
  console.log(`   Detachments: ${detachments.length}`);
  console.log(`   Total Stratagems: ${detachments.reduce((sum, d) => sum + d.stratagems.length, 0)}`);
  console.log(`   Total Enhancements: ${detachments.reduce((sum, d) => sum + d.enhancements.length, 0)}`);
  
  detachments.forEach(d => {
    console.log(`      - ${d.name}: ${d.stratagems.length} stratagems, ${d.enhancements.length} enhancements`);
  });
  
  return output;
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  // Find faction argument
  const factionKey = args.find(arg => !arg.startsWith('--'));
  const skipCache = args.includes('--skip-cache');
  const subfactionArg = args.find(arg => arg.startsWith('--subfaction='));
  const subfaction = subfactionArg ? subfactionArg.split('=')[1] : undefined;
  
  if (!factionKey) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🌐 WAHAPEDIA FACTION SCRAPER                       ║
╠══════════════════════════════════════════════════════════════╣
║  Scrapes faction data from Wahapedia and outputs JSON        ║
║  compatible with importFaction.ts                            ║
║                                                              ║
║  Usage:                                                      ║
║    npx tsx scripts/scrapeWahapediaFaction.ts <faction>       ║
║    npx tsx scripts/scrapeWahapediaFaction.ts <faction> --skip-cache
║                                                              ║
║  Available factions:                                         ║
║    ${Object.keys(FACTION_CONFIGS).slice(0, 6).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(6, 12).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(12, 18).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(18).join(', ')}
║                                                              ║
║  Options:                                                    ║
║    --skip-cache   Force fresh scrape, ignore cached HTML     ║
║    --subfaction=X Filter for specific subfaction             ║
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  }
  
  const result = await scrapeFaction(factionKey, { skipCache, subfaction });
  
  if (result) {
    // Save output
    const outputPath = path.join(OUTPUT_DIR, `${factionKey}.json`);
    await fs.ensureDir(OUTPUT_DIR);
    await fs.writeJson(outputPath, result, { spaces: 2 });
    
    console.log(`\n✅ Saved to: ${outputPath}`);
    console.log('\n📥 To import this data, run:');
    console.log(`   npx tsx scripts/importFaction.ts ${outputPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((e) => {
    console.error('\n💥 Fatal error:', e);
    process.exit(1);
  });
}

export { scrapeFaction, FACTION_CONFIGS, FactionImportData };

