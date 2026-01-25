/**
 * Wahapedia Scraper Types
 *
 * Shared type definitions for the scraping, parsing, and validation pipeline.
 */

// ============================================================================
// Selector Strategy Types
// ============================================================================

export type SelectorConfidence = 'high' | 'medium' | 'low';

export interface SelectorStrategy {
  selector: string;
  confidence: SelectorConfidence;
}

export interface NavSelectorStrategy {
  nav: string;
  category: string;
  link: string;
  confidence: SelectorConfidence;
}

export interface SelectorResult {
  selector: string;
  fallbackLevel: number;
  matchCount: number;
  confidence: SelectorConfidence;
}

// ============================================================================
// Unit Classification Types (Legends/Forge World Detection)
// ============================================================================

export type DetectionSignal =
  | 'css_class'
  | 'url_pattern'
  | 'name_pattern'
  | 'content_marker'
  | 'hardcoded_fallback';

export interface UnitClassification {
  isLegends: boolean;
  isForgeWorld: boolean;
  confidence: SelectorConfidence;
  signals: DetectionSignal[];
  score: number;
}

// ============================================================================
// Pre-Parsed Datasheet Types (Cheerio extraction before LLM)
// ============================================================================

export interface PreParsedStats {
  movement: string | null;
  toughness: number | null;
  save: string | null;
  invulnerableSave: string | null;
  wounds: number | null;
  leadership: number | null;
  objectiveControl: number | null;
}

export interface PreParsedWeapon {
  name: string;
  range: string | null;
  type: 'ranged' | 'melee' | 'unknown';
  attacks: string | null;
  skill: string | null;
  strength: string | null;
  ap: string | null;
  damage: string | null;
}

export interface PreParsedDatasheet {
  // Metadata
  name: string;
  faction: string;
  role: string | null;
  keywords: string[];

  // Stats (from stat block table)
  stats: PreParsedStats;

  // Weapons (basic extraction for validation)
  weapons: PreParsedWeapon[];
  rangedWeaponCount: number;
  meleeWeaponCount: number;

  // Ability names (for validation)
  abilityNames: string[];

  // Source info
  classification: UnitClassification;
  pointsCost: number | null;
  pointsTiers: Array<{ models: number; points: number }>;

  // Parsing metadata
  parseConfidence: number;
  parseWarnings: string[];
  selectorUsed: string;
  fallbackLevel: number;
}

// ============================================================================
// Scrape Quality Types
// ============================================================================

export interface ScrapeQualityFactors {
  contentSize: 'good' | 'low' | 'suspicious';
  selectorConfidence: SelectorConfidence;
  keywordCount: number;
  weaponCount: number;
  abilityCount: number;
  hasPointsCost: boolean;
  hasStats: boolean;
}

export interface ScrapeQuality {
  score: number;  // 0-100
  factors: ScrapeQualityFactors;
  flags: string[];  // e.g., "unusually_small", "missing_weapons"
}

// ============================================================================
// Cache Metadata Types
// ============================================================================

export interface CacheMetadata {
  // Identity
  url: string;
  cacheKey: string;

  // Freshness
  fetchedAt: string;
  contentHash: string;  // SHA-256 of cleaned content
  rawSize: number;
  cleanedSize: number;

  // HTTP headers (when available)
  httpLastModified?: string;
  httpEtag?: string;

  // Change tracking
  previousHash?: string;
  previousFetchedAt?: string;
  changeDetected: boolean;

  // Validation
  selectorUsed: string;
  fallbackLevel: number;
  quality: ScrapeQuality;

  // Pre-parsed data (for validation)
  preParsedData?: PreParsedDatasheet;
}

export interface ContentDiff {
  changed: boolean;
  changedSections: string[];  // 'stats', 'weapons', 'abilities', 'points'
  pointsChanged: { from: number; to: number } | null;
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  preparsedValue?: string | number | null;
  llmValue?: string | number | null;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: number;  // 0-100 confidence score
}

// ============================================================================
// Datasheet Link Types (existing, extended)
// ============================================================================

export interface DatasheetLink {
  name: string;
  url: string;
  category: string;
  classification?: UnitClassification;
}

// ============================================================================
// Scrape Config Types (existing, extended)
// ============================================================================

export interface ScrapeConfig {
  faction: string;
  subfaction?: string;
  maxRetries?: number;
  skipCache?: boolean;
  skipLegends?: boolean;
  skipForgeWorld?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  checkFreshness?: boolean;
  detectionReport?: boolean;
  validationReport?: boolean;
}

// ============================================================================
// Scrape Results Types
// ============================================================================

export interface ScrapeResults {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  selectorFallbacks: number;
  legendsDetected: number;
  forgeWorldDetected: number;
  lowConfidenceDetections: number;
  qualityScores: {
    average: number;
    min: number;
    max: number;
  };
}

// ============================================================================
// Known Units Lists (for validation, not authority)
// ============================================================================

/**
 * Known Legends units for validation (not authoritative detection)
 * These are used as a validation signal with low weight
 */
export const KNOWN_LEGENDS_UNITS: string[] = [
  // Space Marines Legends
  'Chaplain on Bike',
  'Librarian on Bike',
  'Captain on Bike',
  'Techmarine on Bike',
  'Primaris Ancient',
  // Space Wolves Legends
  'Wolf Lord on Thunderwolf',
  'Wolf Guard Battle Leader on Thunderwolf',
  'Iron Priest on Thunderwolf',
  'Rune Priest on Bike',
  // Add more as discovered
];

/**
 * Known Forge World unit name patterns
 * These help detect FW units that might not have CSS markers
 */
export const FORGE_WORLD_PATTERNS: string[] = [
  'Sicaran',
  'Leviathan',
  'Contemptor',
  'Deredeo',
  'Rapier',
  'Cerberus',
  'Falchion',
  'Fellblade',
  'Typhon',
  'Spartan',
  'Mastodon',
  'Sokar',
  'Caestus',
  'Fire Raptor',
  'Storm Eagle',
  'Javelin',
  'Tarantula',
  'Deathstorm',
  'Terrax',
  'Kratos',
  'Deimos',
  'Relic Contemptor',
  'Relic Razorback',
  'Astraeus',
  'Thunderhawk',
];

// ============================================================================
// Selector Strategies Configuration
// ============================================================================

/**
 * Datasheet content selectors in priority order
 */
export const DATASHEET_SELECTORS: SelectorStrategy[] = [
  { selector: '.dsOuterFrame', confidence: 'high' },
  { selector: '.datasheet', confidence: 'medium' },
  { selector: '[class*="datasheet"]', confidence: 'low' },
];

/**
 * Navigation/link selectors in priority order
 */
export const NAV_SELECTORS: NavSelectorStrategy[] = [
  {
    nav: '.NavColumns3',
    category: '.BatRole',
    link: '.ArmyType_line a',
    confidence: 'high'
  },
  {
    nav: '.Columns3',
    category: '.dsH5',
    link: '.Unitbox a',
    confidence: 'medium'
  },
  {
    nav: '[class*="Nav"]',
    category: 'h5, h4',
    link: 'a[href*="/factions/"]',
    confidence: 'low'
  },
];

/**
 * Stats table selectors
 */
export const STATS_SELECTORS = {
  table: '.dsCharFrame table, .dsChar table, table.dsCharFrame',
  row: 'tr',
  cell: 'td, th',
};

/**
 * Keyword selectors
 */
export const KEYWORD_SELECTORS = '.kwb, .kwbo, .kwbu';

/**
 * Points selectors
 */
export const POINTS_SELECTORS = '.PriceTag';

/**
 * Legends/Forge World CSS class indicators
 */
export const CLASSIFICATION_CLASSES = {
  legends: ['.sLegendary', '.legends-unit', '[class*="legend"]'],
  forgeWorld: ['.sForgeWorld', '.fw-unit', '[class*="forgeworld"]'],
};
