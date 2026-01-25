/**
 * Complete Wahapedia Scraper
 * 
 * Comprehensive scraper that extracts all faction data from Wahapedia:
 * - Army Rules (faction-level abilities like Synapse, Shadow in the Warp)
 * - Detachment Rules (detachment abilities)
 * - Stratagems (per detachment)
 * - Enhancements (per detachment)
 * 
 * Outputs JSON matching our import schema.
 * 
 * Usage:
 *   npx tsx scripts/scrapeWahapediaComplete.ts tyranids
 *   npx tsx scripts/scrapeWahapediaComplete.ts space-marines --skip-cache
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_URL = 'https://wahapedia.ru/wh40k10ed/factions';
const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'wahapedia-import');
const RATE_LIMIT_MS = 2000;

// ============================================
// Types matching our import schema
// ============================================

interface ArmyRule {
  name: string;
  description: string;
  flavorText?: string;
}

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
  flavorText?: string;
  restrictions?: string[] | null;
}

interface DetachmentData {
  name: string;
  abilityName: string | null;
  abilityDescription: string | null;
  abilityFlavorText?: string | null;
  stratagems: StratagemData[];
  enhancements: EnhancementData[];
}

interface FactionImportData {
  $schema: string;
  _scrapedAt: string;
  _sourceUrl: string;
  faction: {
    name: string;
    keywords: string[];
    parentFaction?: string | null;
    isDivergent?: boolean;
  };
  armyRules: ArmyRule[];
  detachments: DetachmentData[];
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
  cssColorClass: string; // e.g., "dsColorBgTYR" for Tyranids
}

const FACTION_CONFIGS: Record<string, FactionConfig> = {
  'tyranids': {
    name: 'Tyranids',
    slug: 'tyranids',
    keywords: ['TYRANIDS'],
    cssColorClass: 'dsColorBgTYR',
  },
  'space-marines': {
    name: 'Space Marines',
    slug: 'space-marines',
    keywords: ['ADEPTUS ASTARTES'],
    cssColorClass: 'dsColorBgSM',
  },
  'space-wolves': {
    name: 'Space Wolves',
    slug: 'space-marines',
    keywords: ['SPACE WOLVES', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
    isDivergent: true,
    cssColorClass: 'dsColorBgSM',
  },
  'blood-angels': {
    name: 'Blood Angels',
    slug: 'space-marines',
    keywords: ['BLOOD ANGELS', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
    isDivergent: true,
    cssColorClass: 'dsColorBgSM',
  },
  'dark-angels': {
    name: 'Dark Angels',
    slug: 'space-marines',
    keywords: ['DARK ANGELS', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
    isDivergent: true,
    cssColorClass: 'dsColorBgSM',
  },
  'astra-militarum': {
    name: 'Astra Militarum',
    slug: 'astra-militarum',
    keywords: ['ASTRA MILITARUM'],
    cssColorClass: 'dsColorBgAM',
  },
  'orks': {
    name: 'Orks',
    slug: 'orks',
    keywords: ['ORKS'],
    cssColorClass: 'dsColorBgOR',
  },
  'necrons': {
    name: 'Necrons',
    slug: 'necrons',
    keywords: ['NECRONS'],
    cssColorClass: 'dsColorBgNE',
  },
  'aeldari': {
    name: 'Aeldari',
    slug: 'aeldari',
    keywords: ['AELDARI'],
    cssColorClass: 'dsColorBgAE',
  },
  'chaos-space-marines': {
    name: 'Chaos Space Marines',
    slug: 'chaos-space-marines',
    keywords: ['HERETIC ASTARTES'],
    cssColorClass: 'dsColorBgCSM',
  },
  't-au-empire': {
    name: "T'au Empire",
    slug: 't-au-empire',
    keywords: ['T\'AU EMPIRE'],
    cssColorClass: 'dsColorBgTAU',
  },
  'adeptus-custodes': {
    name: 'Adeptus Custodes',
    slug: 'adeptus-custodes',
    keywords: ['ADEPTUS CUSTODES'],
    cssColorClass: 'dsColorBgAC',
  },
  'grey-knights': {
    name: 'Grey Knights',
    slug: 'grey-knights',
    keywords: ['GREY KNIGHTS'],
    cssColorClass: 'dsColorBgGK',
  },
  'adepta-sororitas': {
    name: 'Adepta Sororitas',
    slug: 'adepta-sororitas',
    keywords: ['ADEPTA SORORITAS'],
    cssColorClass: 'dsColorBgAS',
  },
  'death-guard': {
    name: 'Death Guard',
    slug: 'death-guard',
    keywords: ['DEATH GUARD'],
    cssColorClass: 'dsColorBgDG',
  },
  'thousand-sons': {
    name: 'Thousand Sons',
    slug: 'thousand-sons',
    keywords: ['THOUSAND SONS'],
    cssColorClass: 'dsColorBgTS',
  },
  'world-eaters': {
    name: 'World Eaters',
    slug: 'world-eaters',
    keywords: ['WORLD EATERS'],
    cssColorClass: 'dsColorBgWE',
  },
  'drukhari': {
    name: 'Drukhari',
    slug: 'drukhari',
    keywords: ['DRUKHARI'],
    cssColorClass: 'dsColorBgDE',
  },
  'chaos-daemons': {
    name: 'Chaos Daemons',
    slug: 'chaos-daemons',
    keywords: ['CHAOS DAEMONS'],
    cssColorClass: 'dsColorBgCD',
  },
  'genestealer-cults': {
    name: 'Genestealer Cults',
    slug: 'genestealer-cults',
    keywords: ['GENESTEALER CULTS'],
    cssColorClass: 'dsColorBgGSC',
  },
  'leagues-of-votann': {
    name: 'Leagues of Votann',
    slug: 'leagues-of-votann',
    keywords: ['LEAGUES OF VOTANN'],
    cssColorClass: 'dsColorBgLoV',
  },
  'adeptus-mechanicus': {
    name: 'Adeptus Mechanicus',
    slug: 'adeptus-mechanicus',
    keywords: ['ADEPTUS MECHANICUS'],
    cssColorClass: 'dsColorBgAdM',
  },
  'imperial-knights': {
    name: 'Imperial Knights',
    slug: 'imperial-knights',
    keywords: ['IMPERIAL KNIGHTS'],
    cssColorClass: 'dsColorBgIK',
  },
  'chaos-knights': {
    name: 'Chaos Knights',
    slug: 'chaos-knights',
    keywords: ['CHAOS KNIGHTS'],
    cssColorClass: 'dsColorBgCK',
  },
  'imperial-agents': {
    name: 'Imperial Agents',
    slug: 'imperial-agents',
    keywords: ['AGENTS OF THE IMPERIUM', 'IMPERIAL AGENTS'],
    cssColorClass: 'dsColorBgAoI',
  },
};

// ============================================
// Utility Functions
// ============================================

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n/g, '\n')
    .trim();
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
// Parsing Functions
// ============================================

function parseStratagemType(typeText: string): 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear' {
  const lower = typeText.toLowerCase();
  if (lower.includes('battle tactic')) return 'Battle Tactic';
  if (lower.includes('strategic ploy')) return 'Strategic Ploy';
  if (lower.includes('epic deed')) return 'Epic Deed';
  if (lower.includes('wargear')) return 'Wargear';
  return 'Strategic Ploy';
}

function parseTriggerPhases(whenText: string): string[] {
  const phases: string[] = [];
  const lower = whenText.toLowerCase();
  
  if (lower.includes('command phase')) phases.push('Command');
  if (lower.includes('movement phase')) phases.push('Movement');
  if (lower.includes('shooting phase')) phases.push('Shooting');
  if (lower.includes('charge phase')) phases.push('Charge');
  if (lower.includes('fight phase')) phases.push('Fight');
  if (lower.includes('any phase')) return ['Any'];
  
  return phases.length > 0 ? phases : ['Any'];
}

function isReactiveStratagem(whenText: string): boolean {
  const lower = whenText.toLowerCase();
  return lower.includes('opponent') || 
         lower.includes('enemy') || 
         lower.includes('your opponent');
}

/**
 * Parse Army Rules section
 */
function parseArmyRules($: cheerio.CheerioAPI): ArmyRule[] {
  const armyRules: ArmyRule[] = [];
  
  // Find the Army Rules header
  const armyRulesHeader = $('h2.outline_header').filter((_, el) => 
    $(el).text().trim() === 'Army Rules'
  );
  
  if (armyRulesHeader.length === 0) {
    console.log('   ⚠️  No Army Rules section found');
    return armyRules;
  }
  
  // Get the content container after the header - try multiple selectors
  // Some factions use .Columns2, others use .BreakInsideAvoid directly
  let container = armyRulesHeader.next('.Columns2');
  if (container.length === 0) {
    container = armyRulesHeader.next('.BreakInsideAvoid');
  }
  if (container.length === 0) {
    // Try next element regardless of class
    container = armyRulesHeader.next();
  }
  
  if (container.length === 0) {
    console.log('   ⚠️  No content after Army Rules header');
    return armyRules;
  }
  
  // Find all h3 elements which are rule names - search in container AND its siblings
  // until we hit the next major section
  const processRuleElement = (ruleEl: cheerio.Element) => {
    const $rule = $(ruleEl);
    const ruleName = cleanText($rule.text());
    
    if (!ruleName) return;
    
    // Skip if this looks like a detachment or non-army-rule
    const skipPatterns = ['detachment', 'stratagem', 'enhancement', 'boarding', 'crusade'];
    if (skipPatterns.some(p => ruleName.toLowerCase().includes(p))) return;
    
    // Get flavor text (in .ShowFluff or .legend2 class)
    const flavorText = cleanText($rule.next('p.ShowFluff').text()) || 
                       cleanText($rule.next('p.legend2').text());
    
    // Get the main rule description from parent container
    const $parent = $rule.closest('.BreakInsideAvoid');
    let description = '';
    
    if ($parent.length > 0) {
      const parentHtml = $parent.html() || '';
      const h3Index = parentHtml.indexOf('</h3>');
      if (h3Index !== -1) {
        let afterH3 = parentHtml.substring(h3Index + 5);
        afterH3 = afterH3.replace(/<p class="ShowFluff.*?<\/p>/gi, '');
        afterH3 = afterH3.replace(/<p class="legend2.*?<\/p>/gi, '');
        description = stripHtml(afterH3);
      }
    }
    
    // Avoid duplicate rules
    if (!armyRules.some(r => r.name === ruleName)) {
      armyRules.push({
        name: ruleName,
        description: description || 'See codex for full rules text.',
        flavorText: flavorText || undefined,
      });
    }
  };
  
  // Process h3 elements in the container
  container.find('h3').each((_, ruleEl) => processRuleElement(ruleEl));
  
  // Also check for h3 directly within .BreakInsideAvoid siblings after the header
  let sibling = container;
  while (sibling.length > 0) {
    const nextSibling = sibling.next();
    if (nextSibling.length === 0) break;
    
    // Stop if we hit a detachment section (h2.outline_header that's not Army Rules)
    if (nextSibling.is('h2.outline_header') || nextSibling.find('h2.outline_header').length > 0) break;
    if (nextSibling.is('a[name]') && !nextSibling.attr('name')?.includes('Army')) break;
    
    // Process if it's a BreakInsideAvoid with h3
    if (nextSibling.hasClass('BreakInsideAvoid') || nextSibling.hasClass('Columns2')) {
      nextSibling.find('h3').each((_, ruleEl) => processRuleElement(ruleEl));
    }
    
    sibling = nextSibling;
  }
  
  console.log(`   ✅ Found ${armyRules.length} army rules`);
  return armyRules;
}

/**
 * Parse a single detachment's content
 */
function parseDetachment($: cheerio.CheerioAPI, detachmentAnchor: cheerio.Cheerio<cheerio.Element>): DetachmentData | null {
  const detachmentName = cleanText(detachmentAnchor.next('h2.outline_header').text());
  
  if (!detachmentName) {
    return null;
  }
  
  // Skip boarding actions and other game modes
  const skipPatterns = ['boarding action', 'combat patrol', 'introduction'];
  if (skipPatterns.some(p => detachmentName.toLowerCase().includes(p))) {
    return null;
  }
  
  console.log(`\n   🏴 Parsing detachment: ${detachmentName}`);
  
  const detachment: DetachmentData = {
    name: detachmentName,
    abilityName: null,
    abilityDescription: null,
    abilityFlavorText: null,
    stratagems: [],
    enhancements: [],
  };
  
  // Find the content section for this detachment
  // The structure is: <a name="..."></a><h2>...</h2><div class="Columns2">...</div>
  const contentDiv = detachmentAnchor.nextAll('.Columns2').first();
  
  if (contentDiv.length === 0) {
    console.log(`      ⚠️  No content div found`);
    return detachment;
  }
  
  // Parse Detachment Rule
  const detRuleHeader = contentDiv.find('h2').filter((_, el) => 
    $(el).text().trim() === 'Detachment Rule'
  );
  
  if (detRuleHeader.length > 0) {
    const ruleH3 = detRuleHeader.closest('.BreakInsideAvoid').next('.BreakInsideAvoid').find('h3').first();
    if (ruleH3.length > 0) {
      detachment.abilityName = cleanText(ruleH3.text());
      detachment.abilityFlavorText = cleanText(ruleH3.next('p.ShowFluff').text()) || null;
      
      // Get the rule description from the parent container
      const ruleContainer = ruleH3.closest('.BreakInsideAvoid');
      const containerHtml = ruleContainer.html() || '';
      const h3End = containerHtml.indexOf('</h3>');
      if (h3End !== -1) {
        let ruleText = containerHtml.substring(h3End + 5);
        ruleText = ruleText.replace(/<p class="ShowFluff.*?<\/p>/gi, '');
        detachment.abilityDescription = stripHtml(ruleText);
      }
    }
  }
  
  console.log(`      📜 Ability: ${detachment.abilityName || 'None'}`);
  
  // Parse Enhancements - find all ul.EnhancementsPts elements in the content area
  contentDiv.find('ul.EnhancementsPts').each((_, enhListEl) => {
    const $enhList = $(enhListEl);
    const $li = $enhList.find('li').first();
    
    if ($li.length === 0) return;
    
    // Get name and points from spans
    const spans = $li.find('span');
    if (spans.length < 2) return;
    
    const enhName = cleanText($(spans[0]).text());
    const ptsText = cleanText($(spans[1]).text());
    const pointsCost = parseInt(ptsText.replace(/[^0-9]/g, '')) || 0;
    
    if (!enhName) return;
    
    // Get the parent table/container for additional content
    const $container = $enhList.closest('td, .BreakInsideAvoid');
    
    // Get flavor text (ShowFluff paragraph)
    const flavorText = cleanText($container.find('p.ShowFluff, p.legend2').first().text());
    
    // Get description - find all paragraphs that aren't flavor text
    let description = '';
    $container.find('p').not('.ShowFluff').not('.legend2').each((_, p) => {
      description += cleanText($(p).text()) + ' ';
    });
    description = description.trim();
    
    // Try to extract restrictions from description
    let restrictions: string[] | null = null;
    const restrictionMatch = description.match(/^([\w\s]+)\s+model\s+only/i);
    if (restrictionMatch) {
      const keyword = restrictionMatch[1].toUpperCase().trim();
      // Don't add the main faction keyword as a restriction
      if (keyword !== 'TYRANIDS' && keyword !== 'SPACE MARINES' && keyword !== 'ASTRA MILITARUM') {
        restrictions = [keyword];
      }
    }
    
    detachment.enhancements.push({
      name: enhName,
      pointsCost,
      description: description || 'See codex for full rules.',
      flavorText: flavorText || undefined,
      restrictions,
    });
  });
  
  console.log(`      ⚔️  Enhancements: ${detachment.enhancements.length}`);
  
  // Parse Stratagems
  // We need to find stratagems that belong to this detachment
  // They're in .str10Wrap elements where .str10Type contains the detachment name
  const stratSection = contentDiv.find('h2').filter((_, el) => 
    $(el).text().trim() === 'Stratagems'
  );
  
  if (stratSection.length > 0) {
    // Find all str10Wrap elements in the content area
    const stratContainer = stratSection.closest('.BreakInsideAvoid').next('.Columns2');
    
    stratContainer.find('.str10Wrap').each((_, stratEl) => {
      const $strat = $(stratEl);
      
      const name = cleanText($strat.find('.str10Name').text());
      if (!name) return;
      
      const typeText = cleanText($strat.find('.str10Type').text());
      const cpText = cleanText($strat.find('.str10CP').text());
      const cpCost = parseInt(cpText.replace(/[^0-9]/g, '')) || 1;
      
      // Verify this stratagem belongs to this detachment
      if (!typeText.toLowerCase().includes(detachmentName.toLowerCase().replace(/\s+/g, ' ').substring(0, 15))) {
        // Skip stratagems that don't match
        return;
      }
      
      const contentText = cleanText($strat.find('.str10Text').text());
      
      // Parse WHEN, TARGET, EFFECT, RESTRICTIONS
      let when = '';
      let target = '';
      let effect = '';
      let restrictions: string | null = null;
      
      const whenMatch = contentText.match(/WHEN:?\s*(.*?)(?=TARGET:|EFFECT:|RESTRICTIONS:|$)/i);
      if (whenMatch) when = whenMatch[1].trim();
      
      const targetMatch = contentText.match(/TARGET:?\s*(.*?)(?=EFFECT:|RESTRICTIONS:|$)/i);
      if (targetMatch) target = targetMatch[1].trim();
      
      const effectMatch = contentText.match(/EFFECT:?\s*(.*?)(?=RESTRICTIONS:|$)/i);
      if (effectMatch) effect = effectMatch[1].trim();
      
      const restrictionsMatch = contentText.match(/RESTRICTIONS?:?\s*(.*?)$/i);
      if (restrictionsMatch) restrictions = restrictionsMatch[1].trim() || null;
      
      if (!when && !target && !effect) {
        effect = contentText;
      }
      
      detachment.stratagems.push({
        name,
        cpCost,
        type: parseStratagemType(typeText),
        when: when || 'Any phase',
        target: target || 'One unit from your army',
        effect: effect || contentText,
        restrictions,
        triggerPhase: parseTriggerPhases(when),
        isReactive: isReactiveStratagem(when),
      });
    });
  }
  
  // Also search for stratagems in the broader page context with this detachment name
  if (detachment.stratagems.length === 0) {
    $('div.str10Wrap').each((_, stratEl) => {
      const $strat = $(stratEl);
      const typeText = cleanText($strat.find('.str10Type').text());
      
      // Check if this stratagem belongs to this detachment
      const detNameLower = detachmentName.toLowerCase();
      const typeTextLower = typeText.toLowerCase();
      
      if (!typeTextLower.includes(detNameLower.substring(0, Math.min(15, detNameLower.length)))) {
        return;
      }
      
      const name = cleanText($strat.find('.str10Name').text());
      if (!name) return;
      
      // Skip if already added
      if (detachment.stratagems.some(s => s.name === name)) return;
      
      const cpText = cleanText($strat.find('.str10CP').text());
      const cpCost = parseInt(cpText.replace(/[^0-9]/g, '')) || 1;
      
      const contentText = cleanText($strat.find('.str10Text').text());
      
      let when = '';
      let target = '';
      let effect = '';
      let restrictions: string | null = null;
      
      const whenMatch = contentText.match(/WHEN:?\s*(.*?)(?=TARGET:|EFFECT:|RESTRICTIONS:|$)/i);
      if (whenMatch) when = whenMatch[1].trim();
      
      const targetMatch = contentText.match(/TARGET:?\s*(.*?)(?=EFFECT:|RESTRICTIONS:|$)/i);
      if (targetMatch) target = targetMatch[1].trim();
      
      const effectMatch = contentText.match(/EFFECT:?\s*(.*?)(?=RESTRICTIONS:|$)/i);
      if (effectMatch) effect = effectMatch[1].trim();
      
      const restrictionsMatch = contentText.match(/RESTRICTIONS?:?\s*(.*?)$/i);
      if (restrictionsMatch) restrictions = restrictionsMatch[1].trim() || null;
      
      if (!when && !target && !effect) {
        effect = contentText;
      }
      
      detachment.stratagems.push({
        name,
        cpCost,
        type: parseStratagemType(typeText),
        when: when || 'Any phase',
        target: target || 'One unit from your army',
        effect: effect || contentText,
        restrictions,
        triggerPhase: parseTriggerPhases(when),
        isReactive: isReactiveStratagem(when),
      });
    });
  }
  
  console.log(`      📜 Stratagems: ${detachment.stratagems.length}`);
  
  return detachment;
}

/**
 * Find all detachment anchors in the page
 */
function findDetachmentAnchors($: cheerio.CheerioAPI): string[] {
  const detachments: string[] = [];
  
  // Look at the table of contents to find detachment names
  // They're in the navigation with links like #Invasion-Fleet
  $('.NavColumns3 a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = cleanText($(el).text());
    
    // Skip non-detachment links
    const skipPatterns = [
      'books', 'faq', 'introduction', 'army rules', 'army-rules',
      'synapse', 'shadow', 'crusade', 'boarding', 'combat patrol'
    ];
    
    if (skipPatterns.some(p => href.toLowerCase().includes(p) || text.toLowerCase().includes(p))) {
      return;
    }
    
    // If it's a bold link (main section), it might be a detachment
    if ($(el).find('b').length > 0 || $(el).parent().find('b').length > 0) {
      const anchorName = href.replace('#', '');
      if (anchorName && !detachments.includes(anchorName)) {
        detachments.push(anchorName);
      }
    }
  });
  
  // Also look for h2.outline_header elements that might be detachments
  $('h2.outline_header').each((_, el) => {
    const text = cleanText($(el).text());
    const prevAnchor = $(el).prev('a[name]');
    
    if (prevAnchor.length > 0) {
      const anchorName = prevAnchor.attr('name') || '';
      
      // Skip known non-detachment sections
      const skipPatterns = [
        'books', 'faq', 'introduction', 'army-rules', 'crusade',
        'boarding', 'combat-patrol', 'requisitions', 'battle-traits'
      ];
      
      if (!skipPatterns.some(p => anchorName.toLowerCase().includes(p)) && 
          !detachments.includes(anchorName)) {
        detachments.push(anchorName);
      }
    }
  });
  
  return detachments;
}

// ============================================
// Main Scraping Function
// ============================================

async function scrapeFaction(factionKey: string, skipCache: boolean): Promise<FactionImportData | null> {
  const config = FACTION_CONFIGS[factionKey];
  if (!config) {
    console.error(`❌ Unknown faction: ${factionKey}`);
    console.log('Available factions:', Object.keys(FACTION_CONFIGS).join(', '));
    return null;
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log(`🎯 SCRAPING: ${config.name}`);
  console.log('═'.repeat(60));
  
  const factionUrl = `${BASE_URL}/${config.slug}/`;
  const cacheKey = `${config.slug}/complete-scrape`;
  
  let html: string;
  try {
    html = await getHTML(factionUrl, cacheKey, skipCache);
  } catch (error) {
    console.error(`❌ Failed to fetch faction page:`, error);
    return null;
  }
  
  const $ = cheerio.load(html);
  
  // Parse Army Rules
  console.log('\n📜 Parsing Army Rules...');
  const armyRules = parseArmyRules($);
  
  // Find detachment anchors
  console.log('\n🔍 Finding detachments...');
  const detachmentAnchors = findDetachmentAnchors($);
  console.log(`   Found ${detachmentAnchors.length} potential detachments`);
  
  // Parse each detachment
  const detachments: DetachmentData[] = [];
  
  for (const anchorName of detachmentAnchors) {
    const anchor = $(`a[name="${anchorName}"]`);
    if (anchor.length === 0) continue;
    
    const detachment = parseDetachment($, anchor);
    if (detachment && (detachment.stratagems.length > 0 || detachment.enhancements.length > 0)) {
      detachments.push(detachment);
    }
  }
  
  // Build output
  const output: FactionImportData = {
    $schema: '../import-schema.json',
    _scrapedAt: new Date().toISOString(),
    _sourceUrl: factionUrl,
    faction: {
      name: config.name,
      keywords: config.keywords,
      parentFaction: config.parentFaction || null,
      isDivergent: config.isDivergent || false,
    },
    armyRules,
    detachments,
  };
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SCRAPE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Faction: ${config.name}`);
  console.log(`   Army Rules: ${armyRules.length}`);
  armyRules.forEach(r => console.log(`      - ${r.name}`));
  console.log(`   Detachments: ${detachments.length}`);
  
  let totalStrats = 0;
  let totalEnhancements = 0;
  
  detachments.forEach(d => {
    totalStrats += d.stratagems.length;
    totalEnhancements += d.enhancements.length;
    console.log(`      - ${d.name}: ${d.stratagems.length} stratagems, ${d.enhancements.length} enhancements`);
    if (d.abilityName) {
      console.log(`        Ability: ${d.abilityName}`);
    }
  });
  
  console.log(`   Total Stratagems: ${totalStrats}`);
  console.log(`   Total Enhancements: ${totalEnhancements}`);
  
  return output;
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  const factionKey = args.find(arg => !arg.startsWith('--'));
  const skipCache = args.includes('--skip-cache');
  
  if (!factionKey) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🌐 COMPLETE WAHAPEDIA SCRAPER                      ║
╠══════════════════════════════════════════════════════════════╣
║  Scrapes complete faction data including:                    ║
║  - Army Rules (faction-level abilities)                      ║
║  - Detachment Rules (detachment abilities)                   ║
║  - Stratagems (per detachment)                               ║
║  - Enhancements (per detachment)                             ║
║                                                              ║
║  Usage:                                                      ║
║    npx tsx scripts/scrapeWahapediaComplete.ts <faction>      ║
║    npx tsx scripts/scrapeWahapediaComplete.ts <faction> --skip-cache
║                                                              ║
║  Available factions:                                         ║
║    ${Object.keys(FACTION_CONFIGS).slice(0, 5).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(5, 10).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(10, 15).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(15, 20).join(', ')}
║    ${Object.keys(FACTION_CONFIGS).slice(20).join(', ')}
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  }
  
  const result = await scrapeFaction(factionKey, skipCache);
  
  if (result) {
    const outputPath = path.join(OUTPUT_DIR, `${factionKey}.json`);
    await fs.ensureDir(OUTPUT_DIR);
    await fs.writeJson(outputPath, result, { spaces: 2 });
    
    console.log(`\n✅ Saved to: ${outputPath}`);
    console.log('\n📥 To import this data, run:');
    console.log(`   npx tsx scripts/importFaction.ts ${outputPath}`);
  }
}

// Run
if (require.main === module) {
  main().catch((e) => {
    console.error('\n💥 Fatal error:', e);
    process.exit(1);
  });
}

export { scrapeFaction, FACTION_CONFIGS, FactionImportData };

