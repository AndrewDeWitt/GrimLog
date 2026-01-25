/**
 * Wahapedia Validation Schemas
 *
 * Zod schemas with 40K-specific domain constraints for validating
 * scraped and parsed datasheet data.
 */

import { z } from 'zod';
import type {
  PreParsedDatasheet,
  PreParsedStats,
  ScrapeQuality,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from './wahapediaTypes';

// ============================================================================
// Domain Constants (40K-specific valid ranges)
// ============================================================================

const VALID_RANGES = {
  toughness: { min: 1, max: 14 },      // Knights/Titans can reach 14
  wounds: { min: 1, max: 30 },          // Titans can have 30+
  leadership: { min: 2, max: 7 },       // Typically 5-7, some edge cases at 2
  objectiveControl: { min: 0, max: 8 }, // 0 for swarms, up to 8 for large units
  save: { min: 2, max: 6 },             // 2+ to 6+
  invulnSave: { min: 2, max: 6 },       // 2+ to 6+
  movement: { min: 0, max: 24 },        // 0 for immobile, up to 24" for flyers
  strength: { min: 1, max: 20 },        // Weapons can go very high
  ap: { min: -6, max: 0 },              // -6 to 0
  damage: { min: 1, max: 12 },          // D12 is theoretical max per hit
  attacks: { min: 1, max: 20 },         // Some units have many attacks
};

const VALID_ROLES = [
  'Character',
  'Battleline',
  'Elites',
  'Fast Attack',
  'Heavy Support',
  'Dedicated Transport',
  'Fortification',
  'Allied Units',
];

// ============================================================================
// Pre-Parsed Stats Schema (Cheerio extraction)
// ============================================================================

export const PreParsedStatsSchema = z.object({
  movement: z
    .string()
    .regex(/^\d+"?$|^-$|^N\/A$/i, 'Movement must be like "6\\"", "-", or "N/A"')
    .nullable(),
  toughness: z
    .number()
    .int()
    .min(VALID_RANGES.toughness.min)
    .max(VALID_RANGES.toughness.max)
    .nullable(),
  save: z
    .string()
    .regex(/^[2-6]\+$/, 'Save must be 2+ to 6+')
    .nullable(),
  invulnerableSave: z
    .string()
    .regex(/^[2-6]\+\+?$/, 'Invuln save must be 2+ to 6+')
    .nullable(),
  wounds: z
    .number()
    .int()
    .min(VALID_RANGES.wounds.min)
    .max(VALID_RANGES.wounds.max)
    .nullable(),
  leadership: z
    .number()
    .int()
    .min(VALID_RANGES.leadership.min)
    .max(VALID_RANGES.leadership.max)
    .nullable(),
  objectiveControl: z
    .number()
    .int()
    .min(VALID_RANGES.objectiveControl.min)
    .max(VALID_RANGES.objectiveControl.max)
    .nullable(),
});

// ============================================================================
// Pre-Parsed Weapon Schema
// ============================================================================

export const PreParsedWeaponSchema = z.object({
  name: z.string().min(1).max(100),
  range: z.string().nullable(),
  type: z.enum(['ranged', 'melee', 'unknown']),
  attacks: z.string().nullable(),
  skill: z.string().nullable(),
  strength: z.string().nullable(),
  ap: z.string().nullable(),
  damage: z.string().nullable(),
});

// ============================================================================
// Unit Classification Schema
// ============================================================================

export const UnitClassificationSchema = z.object({
  isLegends: z.boolean(),
  isForgeWorld: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  signals: z.array(z.enum([
    'css_class',
    'url_pattern',
    'name_pattern',
    'content_marker',
    'hardcoded_fallback',
  ])),
  score: z.number().int().min(0),
});

// ============================================================================
// Pre-Parsed Datasheet Schema
// ============================================================================

export const PreParsedDatasheetSchema = z.object({
  name: z.string().min(1).max(100),
  faction: z.string().min(1).max(50),
  role: z.string().nullable(),
  keywords: z.array(z.string()),
  stats: PreParsedStatsSchema,
  weapons: z.array(PreParsedWeaponSchema),
  rangedWeaponCount: z.number().int().min(0).max(30),
  meleeWeaponCount: z.number().int().min(0).max(20),
  abilityNames: z.array(z.string()),
  classification: UnitClassificationSchema,
  pointsCost: z.number().int().min(0).max(2000).nullable(),
  pointsTiers: z.array(z.object({
    models: z.number().int().min(1),
    points: z.number().int().min(0),
  })),
  parseConfidence: z.number().min(0).max(1),
  parseWarnings: z.array(z.string()),
  selectorUsed: z.string(),
  fallbackLevel: z.number().int().min(0),
});

// ============================================================================
// Scrape Quality Schema
// ============================================================================

export const ScrapeQualitySchema = z.object({
  score: z.number().min(0).max(100),
  factors: z.object({
    contentSize: z.enum(['good', 'low', 'suspicious']),
    selectorConfidence: z.enum(['high', 'medium', 'low']),
    keywordCount: z.number().int().min(0),
    weaponCount: z.number().int().min(0),
    abilityCount: z.number().int().min(0),
    hasPointsCost: z.boolean(),
    hasStats: z.boolean(),
  }),
  flags: z.array(z.string()),
});

// ============================================================================
// Cache Metadata Schema
// ============================================================================

export const CacheMetadataSchema = z.object({
  url: z.string().url(),
  cacheKey: z.string().min(1),
  fetchedAt: z.string().datetime(),
  contentHash: z.string().length(64), // SHA-256 hex
  rawSize: z.number().int().min(0),
  cleanedSize: z.number().int().min(0),
  httpLastModified: z.string().optional(),
  httpEtag: z.string().optional(),
  previousHash: z.string().length(64).optional(),
  previousFetchedAt: z.string().datetime().optional(),
  changeDetected: z.boolean(),
  selectorUsed: z.string(),
  fallbackLevel: z.number().int().min(0),
  quality: ScrapeQualitySchema,
  preParsedData: PreParsedDatasheetSchema.optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Calculate scrape quality score based on various factors
 */
export function calculateQualityScore(data: PreParsedDatasheet, contentSize: number): ScrapeQuality {
  const factors: ScrapeQuality['factors'] = {
    contentSize: contentSize > 5000 ? 'good' : contentSize > 1000 ? 'low' : 'suspicious',
    selectorConfidence: data.fallbackLevel === 0 ? 'high' : data.fallbackLevel === 1 ? 'medium' : 'low',
    keywordCount: data.keywords.length,
    weaponCount: data.rangedWeaponCount + data.meleeWeaponCount,
    abilityCount: data.abilityNames.length,
    hasPointsCost: data.pointsCost !== null && data.pointsCost > 0,
    hasStats: data.stats.toughness !== null && data.stats.wounds !== null,
  };

  const flags: string[] = [];
  let score = 100;

  // Content size penalties
  if (factors.contentSize === 'suspicious') {
    score -= 30;
    flags.push('unusually_small_content');
  } else if (factors.contentSize === 'low') {
    score -= 10;
    flags.push('low_content_size');
  }

  // Selector confidence penalties
  if (factors.selectorConfidence === 'low') {
    score -= 20;
    flags.push('low_selector_confidence');
  } else if (factors.selectorConfidence === 'medium') {
    score -= 10;
    flags.push('fallback_selector_used');
  }

  // Missing data penalties
  if (factors.keywordCount === 0) {
    score -= 15;
    flags.push('no_keywords');
  } else if (factors.keywordCount < 3) {
    score -= 5;
    flags.push('few_keywords');
  }

  if (factors.weaponCount === 0) {
    score -= 20;
    flags.push('no_weapons');
  }

  if (factors.abilityCount === 0) {
    score -= 10;
    flags.push('no_abilities');
  }

  if (!factors.hasPointsCost) {
    score -= 15;
    flags.push('missing_points');
  }

  if (!factors.hasStats) {
    score -= 25;
    flags.push('missing_stats');
  }

  return {
    score: Math.max(0, score),
    factors,
    flags,
  };
}

/**
 * Validate pre-parsed data against domain constraints
 */
export function validatePreParsedData(data: PreParsedDatasheet): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Validate stats are in reasonable ranges
  if (data.stats.toughness !== null) {
    if (data.stats.toughness < VALID_RANGES.toughness.min || data.stats.toughness > VALID_RANGES.toughness.max) {
      issues.push({
        field: 'stats.toughness',
        message: `Toughness ${data.stats.toughness} outside valid range ${VALID_RANGES.toughness.min}-${VALID_RANGES.toughness.max}`,
        severity: 'error',
        preparsedValue: data.stats.toughness,
      });
    }
  }

  if (data.stats.wounds !== null) {
    if (data.stats.wounds < VALID_RANGES.wounds.min || data.stats.wounds > VALID_RANGES.wounds.max) {
      issues.push({
        field: 'stats.wounds',
        message: `Wounds ${data.stats.wounds} outside valid range ${VALID_RANGES.wounds.min}-${VALID_RANGES.wounds.max}`,
        severity: 'error',
        preparsedValue: data.stats.wounds,
      });
    }
  }

  if (data.stats.objectiveControl !== null) {
    if (data.stats.objectiveControl < VALID_RANGES.objectiveControl.min || data.stats.objectiveControl > VALID_RANGES.objectiveControl.max) {
      issues.push({
        field: 'stats.objectiveControl',
        message: `OC ${data.stats.objectiveControl} outside valid range ${VALID_RANGES.objectiveControl.min}-${VALID_RANGES.objectiveControl.max}`,
        severity: 'warning',
        preparsedValue: data.stats.objectiveControl,
      });
    }
  }

  // Validate role
  if (data.role !== null && !VALID_ROLES.includes(data.role)) {
    issues.push({
      field: 'role',
      message: `Unknown role "${data.role}"`,
      severity: 'warning',
      preparsedValue: data.role,
    });
  }

  // Validate points cost
  if (data.pointsCost !== null && data.pointsCost < 0) {
    issues.push({
      field: 'pointsCost',
      message: `Negative points cost: ${data.pointsCost}`,
      severity: 'error',
      preparsedValue: data.pointsCost,
    });
  }

  // Validate keywords contain faction
  const factionKeyword = data.faction.toUpperCase().replace(/\s+/g, ' ');
  const hasFactonKeyword = data.keywords.some(kw =>
    kw.toUpperCase().includes(factionKeyword) ||
    factionKeyword.includes(kw.toUpperCase())
  );
  if (!hasFactonKeyword && data.keywords.length > 0) {
    issues.push({
      field: 'keywords',
      message: `Keywords may not include faction keyword (expected "${factionKeyword}")`,
      severity: 'info',
    });
  }

  // Validate weapon counts make sense
  if (data.rangedWeaponCount === 0 && data.meleeWeaponCount === 0) {
    // Some units (like transports) might have no weapons, so just warn
    issues.push({
      field: 'weapons',
      message: 'No weapons detected - verify if this is correct (transports may have none)',
      severity: 'warning',
    });
  }

  // Calculate overall validation score
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 100 - (errorCount * 25) - (warningCount * 10));

  return {
    isValid: errorCount === 0,
    issues,
    score,
  };
}

/**
 * Cross-validate pre-parsed data against LLM-parsed data
 */
export function crossValidate(
  preparsed: PreParsedDatasheet,
  llmResult: {
    stats?: {
      toughness?: number;
      wounds?: number;
      save?: string;
      movement?: string;
      leadership?: number;
      objectiveControl?: number;
    };
    pointsCost?: number;
    weapons?: Array<{ name: string }>;
    abilities?: Array<{ name: string }>;
  }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Compare stats
  if (preparsed.stats.toughness !== null && llmResult.stats?.toughness !== undefined) {
    if (preparsed.stats.toughness !== llmResult.stats.toughness) {
      issues.push({
        field: 'stats.toughness',
        message: `Toughness mismatch: Cheerio=${preparsed.stats.toughness}, LLM=${llmResult.stats.toughness}`,
        severity: 'error',
        preparsedValue: preparsed.stats.toughness,
        llmValue: llmResult.stats.toughness,
      });
    }
  }

  if (preparsed.stats.wounds !== null && llmResult.stats?.wounds !== undefined) {
    if (preparsed.stats.wounds !== llmResult.stats.wounds) {
      issues.push({
        field: 'stats.wounds',
        message: `Wounds mismatch: Cheerio=${preparsed.stats.wounds}, LLM=${llmResult.stats.wounds}`,
        severity: 'error',
        preparsedValue: preparsed.stats.wounds,
        llmValue: llmResult.stats.wounds,
      });
    }
  }

  if (preparsed.stats.objectiveControl !== null && llmResult.stats?.objectiveControl !== undefined) {
    if (preparsed.stats.objectiveControl !== llmResult.stats.objectiveControl) {
      issues.push({
        field: 'stats.objectiveControl',
        message: `OC mismatch: Cheerio=${preparsed.stats.objectiveControl}, LLM=${llmResult.stats.objectiveControl}`,
        severity: 'warning',
        preparsedValue: preparsed.stats.objectiveControl,
        llmValue: llmResult.stats.objectiveControl,
      });
    }
  }

  // Compare points cost
  if (preparsed.pointsCost !== null && llmResult.pointsCost !== undefined) {
    if (preparsed.pointsCost !== llmResult.pointsCost) {
      issues.push({
        field: 'pointsCost',
        message: `Points mismatch: Cheerio=${preparsed.pointsCost}, LLM=${llmResult.pointsCost}`,
        severity: 'warning',
        preparsedValue: preparsed.pointsCost,
        llmValue: llmResult.pointsCost,
      });
    }
  }

  // Compare weapon counts (allow some flexibility)
  const llmWeaponCount = llmResult.weapons?.length || 0;
  const preparsedWeaponCount = preparsed.rangedWeaponCount + preparsed.meleeWeaponCount;
  if (preparsedWeaponCount > 0 && llmWeaponCount > 0) {
    const diff = Math.abs(preparsedWeaponCount - llmWeaponCount);
    if (diff > 2) {
      issues.push({
        field: 'weapons',
        message: `Weapon count mismatch: Cheerio=${preparsedWeaponCount}, LLM=${llmWeaponCount}`,
        severity: 'warning',
        preparsedValue: preparsedWeaponCount,
        llmValue: llmWeaponCount,
      });
    }
  }

  return issues;
}

/**
 * Format validation issues as a human-readable report
 */
export function formatValidationReport(
  unitName: string,
  validation: ValidationResult,
  crossValidation?: ValidationIssue[]
): string {
  const lines: string[] = [];
  lines.push(`\n=== Validation Report: ${unitName} ===`);
  lines.push(`Score: ${validation.score}/100 | Valid: ${validation.isValid ? 'Yes' : 'No'}`);

  if (validation.issues.length > 0) {
    lines.push('\nPre-parse issues:');
    for (const issue of validation.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} [${issue.field}] ${issue.message}`);
    }
  }

  if (crossValidation && crossValidation.length > 0) {
    lines.push('\nCross-validation issues:');
    for (const issue of crossValidation) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} [${issue.field}] ${issue.message}`);
    }
  }

  if (validation.issues.length === 0 && (!crossValidation || crossValidation.length === 0)) {
    lines.push('\n✅ No issues found');
  }

  return lines.join('\n');
}
