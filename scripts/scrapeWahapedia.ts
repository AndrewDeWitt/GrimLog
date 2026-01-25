/**
 * Wahapedia Web Scraper v2
 *
 * Scrapes Warhammer 40K 10th Edition datasheets from Wahapedia
 *
 * Features:
 * - Multi-selector strategy with fallbacks and confidence tracking
 * - Multi-signal Legends/Forge World detection (CSS, URL, name, content)
 * - Content hashing for cache freshness detection
 * - Pre-parsing with Cheerio for stats/weapons validation
 * - Quality scoring per scrape
 * - Rate limiting with respectful delays
 * - Error handling and retry logic
 * - HTML caching with metadata
 */

import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';

import type {
  CacheMetadata,
  DatasheetLink,
  DetectionSignal,
  PreParsedDatasheet,
  PreParsedStats,
  PreParsedWeapon,
  ScrapeConfig,
  ScrapeQuality,
  ScrapeResults,
  SelectorConfidence,
  SelectorResult,
  UnitClassification,
} from './wahapediaTypes';

import {
  DATASHEET_SELECTORS,
  FORGE_WORLD_PATTERNS,
  KEYWORD_SELECTORS,
  KNOWN_LEGENDS_UNITS,
  NAV_SELECTORS,
  POINTS_SELECTORS,
  CLASSIFICATION_CLASSES,
} from './wahapediaTypes';

import { calculateQualityScore, validatePreParsedData } from './wahapediaValidation';

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = 'https://wahapedia.ru/wh40k10ed/factions';
const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');
const RATE_LIMIT_MS = 1500; // 1.5 seconds between requests

// Minimum content size to consider a page valid
const MIN_CONTENT_SIZE = 500;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delay execution for rate limiting
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Compute SHA-256 hash of content for freshness detection
 */
function computeContentHash(html: string): string {
  const $ = cheerio.load(html);

  // Remove elements that change on every request
  $('script, style, noscript, .page_ads, .ezoic, [data-ezoic]').remove();

  // Get just datasheet content for hashing
  let datasheetContent = '';
  for (const strategy of DATASHEET_SELECTORS) {
    const matches = $(strategy.selector);
    if (matches.length > 0) {
      datasheetContent = matches.first().html() || '';
      break;
    }
  }

  // Fallback to body if no datasheet wrapper found
  if (!datasheetContent) {
    datasheetContent = $('body').html() || '';
  }

  // Normalize whitespace for consistent hashing
  const normalized = datasheetContent.replace(/\s+/g, ' ').trim();

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ============================================================================
// HTTP Fetching
// ============================================================================

/**
 * Fetch HTML with error handling and retries
 */
async function fetchHTML(
  url: string,
  retries = 3,
  verbose = false
): Promise<{ html: string; headers: Record<string, string> }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (verbose) {
        console.log(`📡 Fetching: ${url} (attempt ${attempt}/${retries})`);
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Extract useful headers
      const headers: Record<string, string> = {};
      const lastModified = response.headers.get('last-modified');
      const etag = response.headers.get('etag');
      if (lastModified) headers['last-modified'] = lastModified;
      if (etag) headers['etag'] = etag;

      if (verbose) {
        console.log(`✅ Fetched ${html.length} bytes`);
      }

      return { html, headers };
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error);

      if (attempt === retries) {
        throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
      }

      // Exponential backoff
      await delay(RATE_LIMIT_MS * attempt);
    }
  }

  throw new Error('Unreachable');
}

// ============================================================================
// Selector Strategies
// ============================================================================

/**
 * Find datasheet content using tiered selector strategy
 */
function findDatasheetContent(
  $: cheerio.CheerioAPI,
  verbose = false
): { content: cheerio.Cheerio<any>; result: SelectorResult } {
  for (let i = 0; i < DATASHEET_SELECTORS.length; i++) {
    const strategy = DATASHEET_SELECTORS[i];
    const matches = $(strategy.selector);

    if (matches.length === 1) {
      if (verbose && i > 0) {
        console.log(`   ⚠️ Using fallback selector: ${strategy.selector} (level ${i})`);
      }
      return {
        content: matches,
        result: {
          selector: strategy.selector,
          fallbackLevel: i,
          matchCount: 1,
          confidence: strategy.confidence,
        },
      };
    }

    if (matches.length > 1 && verbose) {
      console.log(`   ⚠️ Multiple matches (${matches.length}) for ${strategy.selector}, trying next`);
    }
  }

  // Last resort: return body
  console.warn(`   ❌ No datasheet selector matched, using body`);
  return {
    content: $('body'),
    result: {
      selector: 'body',
      fallbackLevel: DATASHEET_SELECTORS.length,
      matchCount: 1,
      confidence: 'low',
    },
  };
}

/**
 * Find navigation links using tiered selector strategy
 * Also detects Legends/Forge World classification via CSS classes on elements
 */
function findNavigationLinks(
  $: cheerio.CheerioAPI,
  factionUrl: string,
  verbose = false
): { links: DatasheetLink[]; selectorUsed: string; confidence: SelectorConfidence } {
  for (const strategy of NAV_SELECTORS) {
    const $nav = $(strategy.nav);

    if ($nav.length === 0) continue;

    const links: DatasheetLink[] = [];
    let currentCategory = 'Unknown';

    $nav.find('*').each((_, element) => {
      const $el = $(element);

      // Check for category headers
      if ($el.is(strategy.category) || $el.find(strategy.category).length > 0) {
        const categoryText = $el.find(strategy.category).text().trim() || $el.text().trim();
        if (categoryText && categoryText.length > 0 && categoryText.length < 50) {
          currentCategory = categoryText;
        }
      }

      // Check for datasheet links
      $el.find(strategy.link).each((_, linkEl) => {
        const $link = $(linkEl);
        const name = $link.text().trim();
        const href = $link.attr('href');

        if (name && href && isValidDatasheetUrl(href)) {
          const url = href.startsWith('http')
            ? href
            : `https://wahapedia.ru${href}`;

          if (!links.some(l => l.url === url)) {
            // Detect classification using the link element (and its parent)
            const classification = detectLegendsFromElement(name, $, linkEl, url);

            links.push({
              name,
              url,
              category: currentCategory,
              classification,
            });
          }
        }
      });
    });

    if (links.length > 0) {
      if (verbose) {
        console.log(`   Found ${links.length} links using ${strategy.nav} (${strategy.confidence} confidence)`);
      }
      return { links, selectorUsed: strategy.nav, confidence: strategy.confidence };
    }
  }

  if (verbose) {
    console.log(`   ⚠️ No navigation selector matched`);
  }
  return { links: [], selectorUsed: 'none', confidence: 'low' };
}

/**
 * Check if URL is a valid datasheet URL (not index, stratagems, etc.)
 */
function isValidDatasheetUrl(href: string): boolean {
  if (!href) return false;
  if (href.includes('javascript')) return false;
  if (href.includes('#')) return false;
  if (!href.includes('/factions/')) return false;

  // Exclude known non-datasheet pages
  const excludePatterns = [
    'datasheets.html',
    'stratagems',
    'enhancements',
    'detachment',
    'army-rules',
    'crusade',
  ];

  const lowerHref = href.toLowerCase();
  return !excludePatterns.some(pattern => lowerHref.includes(pattern));
}

// ============================================================================
// Legends/Forge World Detection
// ============================================================================

/**
 * Simple name/URL-based Legends detection (no element context)
 * Used when we don't have access to the DOM element (e.g., from index page links)
 */
function detectLegendsFromNameAndUrl(name: string, url: string): UnitClassification {
  const signals: DetectionSignal[] = [];
  let legendsScore = 0;
  let forgeWorldScore = 0;

  // URL patterns (weight: 5)
  if (url.includes('/legends/') || url.includes('_legends') || url.includes('-legends')) {
    signals.push('url_pattern');
    legendsScore += 5;
  }

  // Name patterns for Legends (weight: 3)
  const legendsNamePatterns = ['(Legendary)', '(Legends)', '[Legends]', '(Legacy)'];
  if (legendsNamePatterns.some(pattern => name.includes(pattern))) {
    signals.push('name_pattern');
    legendsScore += 3;
  }

  // Hardcoded list as validation fallback (weight: 2)
  if (signals.length === 0 && KNOWN_LEGENDS_UNITS.some(u => name.toLowerCase().includes(u.toLowerCase()))) {
    signals.push('hardcoded_fallback');
    legendsScore += 2;
  }

  // Forge World name patterns (weight: 3)
  if (FORGE_WORLD_PATTERNS.some(pattern => name.includes(pattern))) {
    if (!signals.includes('name_pattern')) signals.push('name_pattern');
    forgeWorldScore += 3;
  }

  // Forge World URL patterns (weight: 5)
  if (url.includes('forge-world') || url.includes('forgeworld') || url.includes('/fw/')) {
    if (!signals.includes('url_pattern')) signals.push('url_pattern');
    forgeWorldScore += 5;
  }

  const totalScore = legendsScore + forgeWorldScore;
  const confidence: SelectorConfidence =
    totalScore >= 5 ? 'medium' : totalScore >= 2 ? 'low' : 'low';

  return {
    isLegends: legendsScore >= 3,
    isForgeWorld: forgeWorldScore >= 3,
    confidence,
    signals,
    score: totalScore,
  };
}

/**
 * Detect if a unit is Legends using multiple signals including CSS class detection
 * Used when we have the actual DOM element
 */
function detectLegendsFromElement(
  name: string,
  $: cheerio.CheerioAPI,
  element: any,
  url: string
): UnitClassification {
  const signals: DetectionSignal[] = [];
  let legendsScore = 0;
  let forgeWorldScore = 0;

  // Signal 1: CSS class on element or parent (weight: 10) - highest reliability
  const $el = $(element);
  const $parent = $el.closest('.ArmyType_line, .i15, [class*="ArmyType"]');

  // Check if the element or its parent has sLegendary class
  if ($el.hasClass('sLegendary') || $parent.hasClass('sLegendary')) {
    signals.push('css_class');
    legendsScore += 10;
  }

  // Check for Forge World
  if ($el.hasClass('sForgeWorld') || $parent.hasClass('sForgeWorld')) {
    signals.push('css_class');
    forgeWorldScore += 10;
  }

  // Signal 2: URL pattern (weight: 5)
  if (url.includes('/legends/') || url.includes('_legends') || url.includes('-legends')) {
    if (!signals.includes('url_pattern')) signals.push('url_pattern');
    legendsScore += 5;
  }

  // Signal 3: Name pattern (weight: 3)
  const legendsNamePatterns = ['(Legendary)', '(Legends)', '[Legends]', '(Legacy)'];
  if (legendsNamePatterns.some(pattern => name.includes(pattern))) {
    signals.push('name_pattern');
    legendsScore += 3;
  }

  // Signal 4: Hardcoded list as validation fallback (weight: 2)
  if (signals.length === 0 && KNOWN_LEGENDS_UNITS.some(u => name.toLowerCase().includes(u.toLowerCase()))) {
    signals.push('hardcoded_fallback');
    legendsScore += 2;
  }

  // Forge World name patterns
  if (FORGE_WORLD_PATTERNS.some(pattern => name.includes(pattern))) {
    if (!signals.includes('name_pattern')) signals.push('name_pattern');
    forgeWorldScore += 3;
  }

  // Forge World URL pattern
  if (url.includes('forge-world') || url.includes('forgeworld') || url.includes('/fw/')) {
    if (!signals.includes('url_pattern')) signals.push('url_pattern');
    forgeWorldScore += 5;
  }

  const totalScore = legendsScore + forgeWorldScore;
  const confidence: SelectorConfidence =
    totalScore >= 10 ? 'high' : totalScore >= 5 ? 'medium' : 'low';

  return {
    isLegends: legendsScore >= 3,
    isForgeWorld: forgeWorldScore >= 3,
    confidence,
    signals,
    score: totalScore,
  };
}

/**
 * Detect if a unit is Legends using multiple signals
 */
function detectLegends(
  name: string,
  $: cheerio.CheerioAPI,
  element: any,
  url: string
): UnitClassification {
  const signals: DetectionSignal[] = [];
  let legendsScore = 0;
  let forgeWorldScore = 0;

  // Signal 1: CSS class (weight: 10) - highest reliability
  for (const classSelector of CLASSIFICATION_CLASSES.legends) {
    if ($(element).closest(classSelector).length > 0 || $(element).find(classSelector).length > 0) {
      signals.push('css_class');
      legendsScore += 10;
      break;
    }
  }

  // Signal 2: URL pattern (weight: 5)
  if (url.includes('/legends/') || url.includes('_legends') || url.includes('-legends')) {
    signals.push('url_pattern');
    legendsScore += 5;
  }

  // Signal 3: Name pattern (weight: 3)
  const legendsNamePatterns = ['(Legendary)', '(Legends)', '[Legends]', '(Legacy)'];
  if (legendsNamePatterns.some(pattern => name.includes(pattern))) {
    signals.push('name_pattern');
    legendsScore += 3;
  }

  // Signal 4: Hardcoded list as VALIDATION fallback (weight: 2)
  if (signals.length === 0 && KNOWN_LEGENDS_UNITS.some(u => name.toLowerCase().includes(u.toLowerCase()))) {
    signals.push('hardcoded_fallback');
    legendsScore += 2;
  }

  // Forge World detection
  for (const classSelector of CLASSIFICATION_CLASSES.forgeWorld) {
    if ($(element).closest(classSelector).length > 0 || $(element).find(classSelector).length > 0) {
      signals.push('css_class');
      forgeWorldScore += 10;
      break;
    }
  }

  // Forge World name patterns
  if (FORGE_WORLD_PATTERNS.some(pattern => name.includes(pattern))) {
    if (!signals.includes('name_pattern')) signals.push('name_pattern');
    forgeWorldScore += 3;
  }

  // Forge World URL pattern
  if (url.includes('forge-world') || url.includes('forgeworld') || url.includes('/fw/')) {
    if (!signals.includes('url_pattern')) signals.push('url_pattern');
    forgeWorldScore += 5;
  }

  const totalScore = legendsScore + forgeWorldScore;
  const confidence: SelectorConfidence =
    totalScore >= 10 ? 'high' : totalScore >= 5 ? 'medium' : 'low';

  return {
    isLegends: legendsScore >= 3,
    isForgeWorld: forgeWorldScore >= 3,
    confidence,
    signals,
    score: totalScore,
  };
}

/**
 * Detect classification from full page content (for individual datasheet pages)
 * Only checks within the actual datasheet content, not the sidebar/navigation
 */
function detectClassificationFromPage(
  $: cheerio.CheerioAPI,
  url: string,
  name: string
): UnitClassification {
  const signals: DetectionSignal[] = [];
  let legendsScore = 0;
  let forgeWorldScore = 0;

  // Find the actual datasheet content (not sidebar/navigation)
  const $datasheet = $('.dsOuterFrame').first();
  const datasheetExists = $datasheet.length > 0;

  // Check for Legends markers only within datasheet content
  if (datasheetExists) {
    const datasheetText = $datasheet.text().toLowerCase();
    if (datasheetText.includes('legends unit') || datasheetText.includes('this datasheet is legends')) {
      signals.push('content_marker');
      legendsScore += 8;
    }

    // Check if the datasheet wrapper itself has the Legends/FW class
    if ($datasheet.hasClass('sLegendary') || $datasheet.closest('.sLegendary').length > 0) {
      signals.push('css_class');
      legendsScore += 10;
    }

    if ($datasheet.hasClass('sForgeWorld') || $datasheet.closest('.sForgeWorld').length > 0) {
      if (!signals.includes('css_class')) signals.push('css_class');
      forgeWorldScore += 10;
    }
  }

  // URL patterns (always check)
  if (url.includes('/legends/') || url.includes('_legends')) {
    if (!signals.includes('url_pattern')) signals.push('url_pattern');
    legendsScore += 5;
  }

  if (url.includes('forge-world') || url.includes('/fw/')) {
    if (!signals.includes('url_pattern')) signals.push('url_pattern');
    forgeWorldScore += 5;
  }

  // Name patterns (always check)
  const legendsNamePatterns = ['(Legendary)', '(Legends)', '[Legends]', '(Legacy)'];
  if (legendsNamePatterns.some(pattern => name.includes(pattern))) {
    if (!signals.includes('name_pattern')) signals.push('name_pattern');
    legendsScore += 3;
  }

  if (FORGE_WORLD_PATTERNS.some(pattern => name.includes(pattern))) {
    if (!signals.includes('name_pattern')) signals.push('name_pattern');
    forgeWorldScore += 3;
  }

  const totalScore = legendsScore + forgeWorldScore;
  const confidence: SelectorConfidence =
    totalScore >= 10 ? 'high' : totalScore >= 5 ? 'medium' : 'low';

  return {
    isLegends: legendsScore >= 3,
    isForgeWorld: forgeWorldScore >= 3,
    confidence,
    signals,
    score: totalScore,
  };
}

// ============================================================================
// Pre-Parsing (Cheerio extraction for validation)
// ============================================================================

/**
 * Extract stats from the stat block table
 */
function extractStats($: cheerio.CheerioAPI): PreParsedStats {
  const stats: PreParsedStats = {
    movement: null,
    toughness: null,
    save: null,
    invulnerableSave: null,
    wounds: null,
    leadership: null,
    objectiveControl: null,
  };

  // Find stat table - look for tables with M, T, SV, W, LD, OC headers
  $('table').each((_, table) => {
    const $table = $(table);
    const headerText = $table.find('th, td').first().text().trim().toUpperCase();

    // Check if this looks like a stats table
    if (headerText === 'M' || headerText.includes('MOVEMENT')) {
      const cells = $table.find('td');

      // Try to extract values (typical order: M, T, SV, W, LD, OC)
      cells.each((i, cell) => {
        const text = $(cell).text().trim();

        // Movement (e.g., "6\"", "12\"")
        if (text.match(/^\d+"?$/) && stats.movement === null) {
          stats.movement = text.includes('"') ? text : text + '"';
        }
        // Save (e.g., "3+", "4+")
        else if (text.match(/^[2-6]\+$/) && stats.save === null) {
          stats.save = text;
        }
        // Invuln (e.g., "4++", "5+")
        else if (text.match(/^[2-6]\+\+?$/) && stats.invulnerableSave === null && stats.save !== null) {
          stats.invulnerableSave = text.replace('++', '+');
        }
        // Numbers for T, W, LD, OC
        else if (text.match(/^\d+$/)) {
          const num = parseInt(text, 10);
          if (num >= 1 && num <= 14 && stats.toughness === null) {
            stats.toughness = num;
          } else if (num >= 1 && num <= 30 && stats.wounds === null) {
            stats.wounds = num;
          } else if (num >= 2 && num <= 7 && stats.leadership === null) {
            stats.leadership = num;
          } else if (num >= 0 && num <= 8 && stats.objectiveControl === null) {
            stats.objectiveControl = num;
          }
        }
      });

      // Found the stats table, stop searching
      if (stats.toughness !== null) return false;
    }
  });

  return stats;
}

/**
 * Extract weapons from weapon tables
 */
function extractWeapons($: cheerio.CheerioAPI): PreParsedWeapon[] {
  const weapons: PreParsedWeapon[] = [];

  // Look for weapon tables (typically have Range, A, BS/WS, S, AP, D columns)
  $('table').each((_, table) => {
    const $table = $(table);
    const headerRow = $table.find('tr').first();
    const headers = headerRow.find('th, td').map((_, el) => $(el).text().trim().toUpperCase()).get();

    // Check if this looks like a weapon table
    const hasRange = headers.some(h => h.includes('RANGE') || h === 'R');
    const hasStrength = headers.some(h => h === 'S' || h.includes('STR'));
    const hasDamage = headers.some(h => h === 'D' || h.includes('DAM'));

    if (!hasRange || !hasStrength || !hasDamage) return;

    // Extract weapons from rows
    $table.find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const name = $(cells[0]).text().trim();
      if (!name || name.length < 2) return;

      const range = $(cells[1]).text().trim();
      const isMelee = range.toLowerCase() === 'melee' || range === '-';

      weapons.push({
        name,
        range,
        type: isMelee ? 'melee' : 'ranged',
        attacks: cells.length > 2 ? $(cells[2]).text().trim() : null,
        skill: cells.length > 3 ? $(cells[3]).text().trim() : null,
        strength: cells.length > 4 ? $(cells[4]).text().trim() : null,
        ap: cells.length > 5 ? $(cells[5]).text().trim() : null,
        damage: cells.length > 6 ? $(cells[6]).text().trim() : null,
      });
    });
  });

  return weapons;
}

/**
 * Extract keywords from the page
 */
function extractKeywords($: cheerio.CheerioAPI): string[] {
  const keywords: string[] = [];

  $(KEYWORD_SELECTORS).each((_, el) => {
    const kw = $(el).text().trim().toUpperCase();
    if (kw && kw.length > 0 && kw.length < 50 && !keywords.includes(kw)) {
      keywords.push(kw);
    }
  });

  return keywords;
}

/**
 * Extract points cost from the page
 */
function extractPoints($: cheerio.CheerioAPI): { cost: number | null; tiers: Array<{ models: number; points: number }> } {
  const tiers: Array<{ models: number; points: number }> = [];
  let baseCost: number | null = null;

  // Find PriceTag elements
  $(POINTS_SELECTORS).each((_, el) => {
    const text = $(el).text().trim();
    const points = parseInt(text, 10);
    if (!isNaN(points)) {
      if (baseCost === null || points < baseCost) {
        baseCost = points;
      }
    }
  });

  // Try to extract tiers from points tables
  $('table').each((_, table) => {
    const $table = $(table);
    const priceTags = $table.find(POINTS_SELECTORS);
    if (priceTags.length === 0) return;

    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td');

      if (cells.length >= 2) {
        const modelText = $(cells[0]).text().trim();
        const priceTag = $(cells[1]).find(POINTS_SELECTORS);

        if (priceTag.length > 0) {
          const modelMatch = modelText.match(/(\d+)\s*models?/i);
          if (modelMatch) {
            const models = parseInt(modelMatch[1], 10);
            const points = parseInt(priceTag.text().trim(), 10);

            if (!isNaN(models) && !isNaN(points)) {
              tiers.push({ models, points });
            }
          }
        }
      }
    });
  });

  tiers.sort((a, b) => a.models - b.models);

  return { cost: baseCost, tiers };
}

/**
 * Extract ability names from the page
 */
function extractAbilityNames($: cheerio.CheerioAPI): string[] {
  const abilities: string[] = [];

  // Look for ability headers/names (typically in bold or specific classes)
  $('.dsAbility, .AbilityName, .ability-name, b, strong').each((_, el) => {
    const text = $(el).text().trim();
    // Filter out common non-ability text
    if (text.length > 2 && text.length < 50 && !text.includes(':') && !/^\d+/.test(text)) {
      if (!abilities.includes(text)) {
        abilities.push(text);
      }
    }
  });

  return abilities;
}

/**
 * Pre-parse a datasheet HTML to extract structured data
 */
function preParse(
  html: string,
  name: string,
  faction: string,
  url: string,
  verbose = false
): PreParsedDatasheet {
  const $ = cheerio.load(html);
  const warnings: string[] = [];

  // Find datasheet content
  const { content: $datasheet, result: selectorResult } = findDatasheetContent($, verbose);

  if (selectorResult.fallbackLevel > 0) {
    warnings.push(`Used fallback selector level ${selectorResult.fallbackLevel}`);
  }

  // Extract stats
  const stats = extractStats($);
  if (stats.toughness === null || stats.wounds === null) {
    warnings.push('Could not extract core stats (T/W)');
  }

  // Extract weapons
  const weapons = extractWeapons($);
  const rangedWeaponCount = weapons.filter(w => w.type === 'ranged').length;
  const meleeWeaponCount = weapons.filter(w => w.type === 'melee').length;

  if (weapons.length === 0) {
    warnings.push('No weapons detected');
  }

  // Extract keywords
  const keywords = extractKeywords($);
  if (keywords.length === 0) {
    warnings.push('No keywords detected');
  }

  // Extract points
  const { cost: pointsCost, tiers: pointsTiers } = extractPoints($);
  if (pointsCost === null) {
    warnings.push('No points cost detected');
  }

  // Extract abilities
  const abilityNames = extractAbilityNames($);

  // Detect classification
  const classification = detectClassificationFromPage($, url, name);

  // Detect role (if visible in page)
  let role: string | null = null;
  const rolePatterns = ['Character', 'Battleline', 'Elites', 'Fast Attack', 'Heavy Support', 'Dedicated Transport'];
  const pageText = $('body').text();
  for (const r of rolePatterns) {
    if (pageText.includes(r)) {
      role = r;
      break;
    }
  }

  // Calculate parse confidence
  let confidence = 1.0;
  if (selectorResult.fallbackLevel > 0) confidence -= 0.2 * selectorResult.fallbackLevel;
  if (stats.toughness === null) confidence -= 0.2;
  if (stats.wounds === null) confidence -= 0.2;
  if (weapons.length === 0) confidence -= 0.1;
  if (keywords.length === 0) confidence -= 0.1;
  if (pointsCost === null) confidence -= 0.1;
  confidence = Math.max(0, confidence);

  return {
    name,
    faction,
    role,
    keywords,
    stats,
    weapons,
    rangedWeaponCount,
    meleeWeaponCount,
    abilityNames,
    classification,
    pointsCost,
    pointsTiers,
    parseConfidence: confidence,
    parseWarnings: warnings,
    selectorUsed: selectorResult.selector,
    fallbackLevel: selectorResult.fallbackLevel,
  };
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Load existing cache metadata
 */
async function loadCacheMetadata(cacheKey: string): Promise<CacheMetadata | null> {
  const metadataPath = path.join(CACHE_DIR, `${cacheKey}.meta.json`);

  try {
    if (await fs.pathExists(metadataPath)) {
      return await fs.readJson(metadataPath);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to load cache metadata for ${cacheKey}`);
  }

  return null;
}

/**
 * Save cache metadata
 */
async function saveCacheMetadata(cacheKey: string, metadata: CacheMetadata): Promise<void> {
  const metadataPath = path.join(CACHE_DIR, `${cacheKey}.meta.json`);
  await fs.ensureDir(path.dirname(metadataPath));
  await fs.writeJson(metadataPath, metadata, { spaces: 2 });
}

/**
 * Cache HTML to filesystem with metadata
 */
async function cacheHTML(
  cacheKey: string,
  html: string,
  url: string,
  httpHeaders: Record<string, string>,
  preParsed: PreParsedDatasheet,
  quality: ScrapeQuality,
  verbose = false
): Promise<CacheMetadata> {
  const htmlPath = path.join(CACHE_DIR, `${cacheKey}.html`);
  await fs.ensureDir(path.dirname(htmlPath));
  await fs.writeFile(htmlPath, html, 'utf-8');

  // Load existing metadata to track changes
  const existingMeta = await loadCacheMetadata(cacheKey);
  const contentHash = computeContentHash(html);

  const metadata: CacheMetadata = {
    url,
    cacheKey,
    fetchedAt: new Date().toISOString(),
    contentHash,
    rawSize: html.length,
    cleanedSize: html.replace(/\s+/g, ' ').length,
    httpLastModified: httpHeaders['last-modified'],
    httpEtag: httpHeaders['etag'],
    previousHash: existingMeta?.contentHash,
    previousFetchedAt: existingMeta?.fetchedAt,
    changeDetected: existingMeta ? existingMeta.contentHash !== contentHash : false,
    selectorUsed: preParsed.selectorUsed,
    fallbackLevel: preParsed.fallbackLevel,
    quality,
    preParsedData: preParsed,
  };

  await saveCacheMetadata(cacheKey, metadata);

  if (verbose) {
    console.log(`💾 Cached to: ${htmlPath}`);
    if (metadata.changeDetected) {
      console.log(`   🔄 Content changed since last scrape!`);
    }
  }

  return metadata;
}

/**
 * Load HTML from cache
 */
async function loadCachedHTML(cacheKey: string): Promise<string | null> {
  const htmlPath = path.join(CACHE_DIR, `${cacheKey}.html`);

  try {
    if (await fs.pathExists(htmlPath)) {
      const html = await fs.readFile(htmlPath, 'utf-8');
      console.log(`📦 Loaded from cache: ${cacheKey}`);
      return html;
    }
  } catch (error) {
    console.warn(`⚠️ Cache read failed for ${cacheKey}:`, error);
  }

  return null;
}

/**
 * Get or fetch HTML with caching
 */
async function getHTML(
  url: string,
  cacheKey: string,
  faction: string,
  name: string,
  config: ScrapeConfig
): Promise<{ html: string; metadata: CacheMetadata }> {
  const verbose = config.verbose || false;

  // Check cache unless skipping
  if (!config.skipCache) {
    const cachedHtml = await loadCachedHTML(cacheKey);
    const existingMeta = await loadCacheMetadata(cacheKey);

    if (cachedHtml && existingMeta) {
      // For freshness check, compute new hash and compare
      if (config.checkFreshness) {
        // Would need to fetch to compare - skip for now
      }
      return { html: cachedHtml, metadata: existingMeta };
    }
  }

  // Rate limiting
  await delay(RATE_LIMIT_MS);

  // Fetch new content
  const { html, headers } = await fetchHTML(url, 3, verbose);

  // Pre-parse for metadata
  const preParsed = preParse(html, name, faction, url, verbose);
  const quality = calculateQualityScore(preParsed, html.length);

  // Cache with metadata
  const metadata = await cacheHTML(cacheKey, html, url, headers, preParsed, quality, verbose);

  return { html, metadata };
}

// ============================================================================
// Datasheet Link Parsing
// ============================================================================

/**
 * Parse faction index page to get all datasheet links
 */
function parseDatasheetLinks(
  html: string,
  factionUrl: string,
  config: ScrapeConfig
): { links: DatasheetLink[]; selectorUsed: string } {
  const $ = cheerio.load(html);
  const verbose = config.verbose || false;
  const skipLegends = config.skipLegends !== false;
  const skipForgeWorld = config.skipForgeWorld !== false;

  // Find links using selector strategy (classification is now done during link extraction)
  const { links: rawLinks, selectorUsed, confidence } = findNavigationLinks($, factionUrl, verbose);

  if (verbose) {
    console.log(`🔍 Found ${rawLinks.length} raw links (${confidence} confidence)`);
  }

  // Filter links based on classification
  const filteredLinks: DatasheetLink[] = [];
  let legendsSkipped = 0;
  let fwSkipped = 0;

  for (const link of rawLinks) {
    const classification = link.classification;

    // Apply filters
    if (classification && skipLegends && classification.isLegends) {
      legendsSkipped++;
      if (verbose) {
        console.log(`   ⏭️ Skipping Legends: ${link.name} (${classification.signals.join(', ')})`);
      }
      continue;
    }

    if (classification && skipForgeWorld && classification.isForgeWorld) {
      fwSkipped++;
      if (verbose) {
        console.log(`   ⏭️ Skipping Forge World: ${link.name} (${classification.signals.join(', ')})`);
      }
      continue;
    }

    filteredLinks.push(link);
  }

  if (verbose) {
    console.log(`📊 After filtering: ${filteredLinks.length} links`);
    console.log(`   Legends skipped: ${legendsSkipped}`);
    console.log(`   Forge World skipped: ${fwSkipped}`);
  }

  return { links: filteredLinks, selectorUsed };
}

// ============================================================================
// Scrape Functions
// ============================================================================

/**
 * Scrape a single datasheet
 */
async function scrapeDatasheet(
  link: DatasheetLink,
  config: ScrapeConfig
): Promise<{ success: boolean; metadata?: CacheMetadata; error?: string }> {
  const cacheKey = `${config.faction}/${link.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    const { metadata } = await getHTML(
      link.url,
      cacheKey,
      config.faction,
      link.name,
      config
    );

    // Also save simple JSON metadata (backwards compatibility)
    const metadataPath = path.join(CACHE_DIR, `${cacheKey}.json`);
    await fs.writeJson(metadataPath, {
      name: link.name,
      url: link.url,
      category: link.category,
      faction: config.faction,
      subfaction: config.subfaction,
      classification: link.classification,
      scrapedAt: new Date().toISOString(),
    }, { spaces: 2 });

    return { success: true, metadata };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to scrape ${link.name}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get Space Wolves specific datasheets (hardcoded fallback)
 */
function getSpaceWolvesDatasheets(): DatasheetLink[] {
  const spaceWolvesUnits = [
    'Arjac-Rockfist',
    'Bjorn-The-Fell-handed',
    'Logan-Grimnar',
    'Murderfang',
    'Njal-Stormcaller',
    'Ragnar-Blackmane',
    'Ulrik-The-Slayer',
    'Iron-Priest',
    'Wolf-Guard-Battle-Leader',
    'Wolf-Priest',
    'Blood-Claws',
    'Grey-Hunters',
    'Fenrisian-Wolves',
    'Thunderwolf-Cavalry',
    'Venerable-Dreadnought',
    'Wolf-Guard-Headtakers',
    'Wolf-Guard-Terminators',
    'Wulfen',
    'Wulfen-Dreadnought',
    'Wulfen-with-Storm-Shields',
  ];

  return spaceWolvesUnits.map(unit => ({
    name: unit.replace(/-/g, ' '),
    url: `https://wahapedia.ru/wh40k10ed/factions/space-marines/${unit}`,
    category: 'Space Wolves',
  }));
}

/**
 * Scrape all datasheets for a faction
 */
export async function scrapeFaction(config: ScrapeConfig): Promise<ScrapeResults> {
  const verbose = config.verbose || false;

  console.log(`\n🎯 Starting scrape for ${config.faction}${config.subfaction ? ` (${config.subfaction})` : ''}\n`);

  // Build faction URL
  const factionSlug = config.faction.toLowerCase().replace(/\s+/g, '-');
  const subfactionSlug = config.subfaction?.toLowerCase().replace(/\s+/g, '-');
  const factionUrl = subfactionSlug
    ? `${BASE_URL}/${factionSlug}/${subfactionSlug}`
    : `${BASE_URL}/${factionSlug}`;

  // Step 1: Get faction index page
  console.log(`📋 Fetching faction index...`);
  const indexCacheKey = `${config.faction}/index`;

  let indexHTML: string;
  if (!config.skipCache) {
    const cached = await loadCachedHTML(indexCacheKey);
    if (cached) {
      indexHTML = cached;
    } else {
      await delay(RATE_LIMIT_MS);
      const { html } = await fetchHTML(factionUrl, 3, verbose);
      indexHTML = html;
      await fs.ensureDir(path.join(CACHE_DIR, config.faction));
      await fs.writeFile(path.join(CACHE_DIR, `${indexCacheKey}.html`), html, 'utf-8');
    }
  } else {
    await delay(RATE_LIMIT_MS);
    const { html } = await fetchHTML(factionUrl, 3, verbose);
    indexHTML = html;
    await fs.ensureDir(path.join(CACHE_DIR, config.faction));
    await fs.writeFile(path.join(CACHE_DIR, `${indexCacheKey}.html`), html, 'utf-8');
  }

  // Step 2: Parse datasheet links
  const skipLegends = config.skipLegends !== false;
  const skipForgeWorld = config.skipForgeWorld !== false;

  console.log(`🔍 Parsing datasheet links from Army List sidebar...`);
  console.log(`   Filtering: ${skipLegends ? '✅ Skip Legends' : '❌ Include Legends'} | ${skipForgeWorld ? '✅ Skip Forge World' : '❌ Include Forge World'}`);

  let { links: datasheetLinks, selectorUsed } = parseDatasheetLinks(indexHTML, factionUrl, config);

  console.log(`📊 Found ${datasheetLinks.length} tournament-legal datasheets\n`);
  console.log(`   Selector used: ${selectorUsed}`);

  // Step 2b: Fallback for low link count
  if (datasheetLinks.length < 10) {
    console.log(`⚠️ Warning: Only found ${datasheetLinks.length} datasheets. This seems low.`);

    if (config.subfaction?.toLowerCase().includes('wolves')) {
      console.log(`📝 Adding Space Wolves-specific units from hardcoded fallback...`);
      const spaceWolvesUnits = getSpaceWolvesDatasheets();
      const existingUrls = new Set(datasheetLinks.map(d => d.url));
      for (const unit of spaceWolvesUnits) {
        if (!existingUrls.has(unit.url)) {
          datasheetLinks.push(unit);
        }
      }
      console.log(`📊 Total with fallback: ${datasheetLinks.length} datasheets\n`);
    }
  }

  // Dry run - just show what would be scraped
  if (config.dryRun) {
    console.log(`\n🔍 DRY RUN - Would scrape ${datasheetLinks.length} datasheets:`);
    for (const link of datasheetLinks) {
      const classInfo = link.classification
        ? ` [${link.classification.isLegends ? 'LEGENDS' : ''}${link.classification.isForgeWorld ? 'FW' : ''}${!link.classification.isLegends && !link.classification.isForgeWorld ? 'OK' : ''}]`
        : '';
      console.log(`   - ${link.name} (${link.category})${classInfo}`);
    }
    return {
      total: datasheetLinks.length,
      success: 0,
      failed: 0,
      skipped: datasheetLinks.length,
      errors: [],
      selectorFallbacks: 0,
      legendsDetected: 0,
      forgeWorldDetected: 0,
      lowConfidenceDetections: 0,
      qualityScores: { average: 0, min: 0, max: 0 },
    };
  }

  // Step 3: Scrape each datasheet
  const results: ScrapeResults = {
    total: datasheetLinks.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    selectorFallbacks: 0,
    legendsDetected: 0,
    forgeWorldDetected: 0,
    lowConfidenceDetections: 0,
    qualityScores: { average: 0, min: 100, max: 0 },
  };

  const qualityScores: number[] = [];

  for (let i = 0; i < datasheetLinks.length; i++) {
    const link = datasheetLinks[i];
    console.log(`\n[${i + 1}/${datasheetLinks.length}] ${link.name} (${link.category})`);

    const scrapeResult = await scrapeDatasheet(link, config);

    if (scrapeResult.success && scrapeResult.metadata) {
      results.success++;

      // Track quality scores
      const score = scrapeResult.metadata.quality.score;
      qualityScores.push(score);
      results.qualityScores.min = Math.min(results.qualityScores.min, score);
      results.qualityScores.max = Math.max(results.qualityScores.max, score);

      // Track selector fallbacks
      if (scrapeResult.metadata.fallbackLevel > 0) {
        results.selectorFallbacks++;
      }

      // Track classifications
      const preParsed = scrapeResult.metadata.preParsedData;
      if (preParsed) {
        if (preParsed.classification.isLegends) results.legendsDetected++;
        if (preParsed.classification.isForgeWorld) results.forgeWorldDetected++;
        if (preParsed.classification.confidence === 'low') results.lowConfidenceDetections++;
      }

      console.log(`✅ Scraped: ${link.name} (quality: ${score}/100)`);
    } else {
      results.failed++;
      results.errors.push({
        name: link.name,
        error: scrapeResult.error || 'Unknown error',
      });
    }
  }

  // Calculate average quality
  if (qualityScores.length > 0) {
    results.qualityScores.average = Math.round(
      qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    );
  }

  // Step 4: Save summary
  const summaryPath = path.join(CACHE_DIR, `${config.faction}/scrape-summary.json`);
  await fs.writeJson(summaryPath, {
    ...results,
    faction: config.faction,
    subfaction: config.subfaction,
    selectorUsed,
    completedAt: new Date().toISOString(),
  }, { spaces: 2 });

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Scrape Summary for ${config.faction}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📝 Total: ${results.total}`);
  console.log(`\n📈 Quality Scores:`);
  console.log(`   Average: ${results.qualityScores.average}/100`);
  console.log(`   Min: ${results.qualityScores.min}/100`);
  console.log(`   Max: ${results.qualityScores.max}/100`);
  console.log(`\n🔍 Detection Stats:`);
  console.log(`   Selector fallbacks: ${results.selectorFallbacks}`);
  console.log(`   Legends detected: ${results.legendsDetected}`);
  console.log(`   Forge World detected: ${results.forgeWorldDetected}`);
  console.log(`   Low confidence: ${results.lowConfidenceDetections}`);

  if (results.errors.length > 0) {
    console.log(`\n⚠️ Errors:`);
    results.errors.forEach(err => {
      console.log(`   - ${err.name}: ${err.error}`);
    });
  }

  console.log(`\n✨ Scrape complete! Data saved to: ${CACHE_DIR}`);

  return results;
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/scrapeWahapedia.ts <faction> [subfaction] [options]

Examples:
  tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"
  tsx scripts/scrapeWahapedia.ts "tyranids"
  tsx scripts/scrapeWahapedia.ts "space-marines" --skip-cache --verbose
  tsx scripts/scrapeWahapedia.ts "space-marines" --include-legends --include-forge-world
  tsx scripts/scrapeWahapedia.ts "space-marines" --dry-run

Options:
  --skip-cache           Skip cache and re-fetch all pages
  --include-legends      Include Legends units (default: skip)
  --include-forge-world  Include Forge World units (default: skip)
  --verbose              Show detailed logging
  --dry-run              Show what would be scraped without fetching
  --check-freshness      Check if cached content is stale
  --detection-report     Show detailed detection report
  --help, -h             Show this help message
    `);
    process.exit(0);
  }

  // Parse arguments
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  const faction = positionalArgs[0];
  const subfaction = positionalArgs[1];

  const config: ScrapeConfig = {
    faction,
    subfaction,
    skipCache: args.includes('--skip-cache'),
    skipLegends: !args.includes('--include-legends'),
    skipForgeWorld: !args.includes('--include-forge-world'),
    verbose: args.includes('--verbose'),
    dryRun: args.includes('--dry-run'),
    checkFreshness: args.includes('--check-freshness'),
    detectionReport: args.includes('--detection-report'),
  };

  try {
    await scrapeFaction(config);
  } catch (error) {
    console.error(`\n💥 Fatal error:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
