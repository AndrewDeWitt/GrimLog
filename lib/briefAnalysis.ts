/**
 * Tactical Brief Analysis Engine
 *
 * Three-pillar analysis system for army list evaluation:
 * 1. MathHammer - Raw damage output calculations
 * 2. Meta Context - Role distribution and keyword synergies
 * 3. Objective Ecology - Scoring potential and board control
 */

import {
  ParsedArmyList,
  ParsedUnit,
  ParsedDatasheet,
} from './types';
import {
  calculateDamage,
  AttackerProfile,
  DefenderProfile,
  parseDiceAverage,
} from './damageCalculation';

// ============================================
// TYPES
// ============================================

// Tactical roles for realistic army composition analysis
export type TacticalRole = 'hammer' | 'anvil' | 'scoring' | 'screening' | 'support' | 'skirmisher' | 'utility' | 'specialist';

export interface TacticalRoleAssignment {
  role: TacticalRole;
  confidence: number; // 0-100 how sure we are
  reasoning: string;  // Why this role was assigned
  alternateRoles?: TacticalRole[]; // Some units are flexible
}

// Extended toughness brackets for comprehensive analysis
export interface ToughnessBracketDamage {
  bracket: string;
  toughness: number;
  label: string;
  damage: number;
  rating: 'devastating' | 'strong' | 'moderate' | 'weak' | 'ineffective';
}

// Weapon-level damage breakdown
export interface WeaponDamageBreakdown {
  weaponName: string;
  type: 'ranged' | 'melee';
  attacks: string;
  strength: number;
  ap: number;
  damage: string;
  abilities: string[];
  damageByToughness: Record<number, number>; // T3-T12 damage
  bestAgainst: string;
}

// Enhanced unit profile with tactical role and weapon breakdowns
export interface UnitEngagementProfile {
  unitName: string;
  displayName: string; // "Wolf Guard Terminators (340pts)" for duplicates, otherwise same as unitName
  pointsCost: number;
  modelCount: number;
  tacticalRole: TacticalRoleAssignment;
  
  // Weapon-by-weapon breakdown
  weapons: WeaponDamageBreakdown[];
  
  // Best engagement scenarios for this unit
  bestTargets: {
    targetType: string;
    targetProfile: string; // e.g., "T5 2+ 4++"
    expectedDamage: number;
    rating: 'devastating' | 'strong' | 'moderate' | 'weak' | 'ineffective';
    notes?: string;
  }[];
  
  // Toughness performance curve (for visualization)
  toughnessPerformance: ToughnessBracketDamage[];
  
  // Unit stats for display
  toughness: number;
  wounds: number;
  save: string;
  keywords: string[];
  
  // Competitive context from content creators (optional)
  competitiveContext?: UnitCompetitiveContextSummary;
}

// Structured synergy with explanation (new format)
export interface StructuredSynergy {
  unit: string;
  why: string;
}

// Competitive context summary for a unit (from content creator insights)
export interface UnitCompetitiveContextSummary {
  tierRank?: string; // S, A, B, C, D, F
  tierReasoning?: string;
  tierConfidence: number;
  bestTargets: string[];
  counters: string[];
  synergies: (string | StructuredSynergy)[]; // Supports both old string[] and new structured format
  playstyleNotes?: string;
  deploymentTips?: string;
  sources: Array<{
    authorName: string;
    sourceType: string;
    gameVersion?: string;
    isStale: boolean;
  }>;
  hasStaleData: boolean;
}

// Faction-level competitive context
export interface FactionCompetitiveContextSummary {
  metaTier?: string;
  metaTierReasoning?: string;
  metaConfidence: number;
  playstyleArchetype?: string;
  strengths: string[];
  weaknesses: string[];
  recommendedDetachments: Array<{ name: string; reasoning: string }>;
  mustTakeUnits: string[];
  avoidUnits: string[];
  sources: Array<{
    authorName: string;
    sourceType: string;
    gameVersion?: string;
    isStale: boolean;
  }>;
  hasStaleData: boolean;
}

// Engagement scenario for key matchups
export interface EngagementScenario {
  title: string;
  attackingUnit: string;
  attackingUnitIcon?: string;
  targetDescription: string;
  targetProfile: {
    toughness: number;
    save: string;
    wounds: number;
    invuln?: string;
  };
  expectedDamage: number;
  probabilityToKill: number;
  turnsToKill: number;
  tacticalNotes: string;
}

// Role-grouped army composition
export interface RoleGroupedComposition {
  hammers: UnitEngagementProfile[];
  anvils: UnitEngagementProfile[];
  scoring: UnitEngagementProfile[];
  screening: UnitEngagementProfile[];
  support: UnitEngagementProfile[];
  skirmishers: UnitEngagementProfile[];
}

export interface BriefAnalysis {
  // Summary
  faction: string | null;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;

  // Radar chart scores (0-100 scale)
  radarScores: RadarScores;

  // Pillar 1: MathHammer
  mathHammer: MathHammerAnalysis;

  // Pillar 2: Meta Context
  metaContext: MetaContextAnalysis;

  // Pillar 3: Objective Ecology
  objectiveEcology: ObjectiveEcologyAnalysis;

  // NEW: Role-based analysis
  unitEngagementProfiles: UnitEngagementProfile[];
  roleGroupedComposition: RoleGroupedComposition;
  keyEngagementScenarios: EngagementScenario[];

  // Recommendations
  collectionGaps: CollectionGap[];
  keyStratagems: string[];
  threatAssessment: ThreatAssessment;
  
  // Competitive context from content creators (optional, enriched separately)
  competitiveContext?: {
    factionContext: FactionCompetitiveContextSummary | null;
    unitsWithContext: number;
    totalUnits: number;
    overallConfidence: number;
    hasStaleData: boolean;
  };
}

export interface RadarScores {
  killingPower: number;
  durability: number;
  mobility: number;
  boardControl: number;
  flexibility: number;
}

export interface MathHammerAnalysis {
  // Damage output against standard targets
  damageVsInfantry: number; // vs T4 3+ (MEQ)
  damageVsElite: number; // vs T5 2+ (TEQ)
  damageVsVehicle: number; // vs T10 3+ (Vehicle)
  damageVsMonster: number; // vs T12 4+ (Monster)

  // Per-unit breakdown
  unitDamageProfiles: UnitDamageProfile[];

  // Army composition
  totalRangedDamage: number;
  totalMeleeDamage: number;
  antiTankUnits: string[];
  antiInfantryUnits: string[];
}

export interface UnitDamageProfile {
  unitName: string;
  rangedDamageVsMEQ: number;
  rangedDamageVsTEQ: number;
  rangedDamageVsVehicle: number;
  meleeDamageVsMEQ: number;
  meleeDamageVsTEQ: number;
  meleeDamageVsVehicle: number;
  threatRating: 'low' | 'medium' | 'high' | 'extreme';
  primaryRole: string;
}

export interface MetaContextAnalysis {
  // Role distribution
  roleDistribution: Record<string, number>;

  // Keyword counts
  keywordCounts: Record<string, number>;

  // Important keywords presence
  hasDeepStrike: boolean;
  hasScouts: boolean;
  hasInfiltrators: boolean;
  hasPsykers: boolean;
  hasTransports: boolean;

  // Character analysis
  characterCount: number;
  leaderUnits: string[];

  // Detachment synergy score (0-100)
  detachmentSynergy: number;
  detachmentSynergyNotes: string[];
}

export interface ObjectiveEcologyAnalysis {
  // Objective Control
  totalOC: number;
  ocPerUnit: number;
  highOCUnits: string[]; // Units with OC 2+

  // Action capability
  actionUnits: string[]; // INFANTRY units good for actions
  actionUnitCount: number;

  // Mobility breakdown
  mobilityTiers: {
    slow: string[]; // M < 6"
    medium: string[]; // M 6-10"
    fast: string[]; // M > 10"
    flying: string[]; // FLY keyword
  };
  averageMovement: number;

  // Durability
  totalWounds: number;
  effectiveWounds: number; // Adjusted for saves
  durabilityPerUnit: UnitDurability[];
}

export interface UnitDurability {
  unitName: string;
  wounds: number;
  effectiveWounds: number;
  durabilityTier: 'fragile' | 'standard' | 'tough' | 'fortress';
}

export interface CollectionGap {
  category: string;
  issue: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  potentialUnits?: string[];
}

export interface ThreatAssessment {
  overallThreat: 'low' | 'medium' | 'high' | 'extreme';
  primaryStrengths: string[];
  primaryWeaknesses: string[];
  counterplayTips: string[];
}

// ============================================
// VIRAL INSIGHTS (Shareable Army Spirit)
// ============================================

export interface FunStat {
  name: string;        // AI-generated name like "Salt Generator", "Dice Gods Favor"
  emoji: string;       // Fitting emoji
  value: string;       // "8/10", "Maximum", "High", etc.
  description: string; // Why this stat applies to this army
  iconPrompt: string;  // AI-generated prompt for creating a unique icon for this stat
}

// Flattened structure for Gemini API compatibility (no deep nesting)
export interface ViralInsightsRaw {
  tagline: string;
  spiritDescription: string;
  funStat1Name: string;
  funStat1Emoji: string;
  funStat1Value: string;
  funStat1Desc: string;
  funStat1IconPrompt: string;
  funStat2Name: string;
  funStat2Emoji: string;
  funStat2Value: string;
  funStat2Desc: string;
  funStat2IconPrompt: string;
  funStat3Name?: string;
  funStat3Emoji?: string;
  funStat3Value?: string;
  funStat3Desc?: string;
  funStat3IconPrompt?: string;
  funStat4Name?: string;
  funStat4Emoji?: string;
  funStat4Value?: string;
  funStat4Desc?: string;
  funStat4IconPrompt?: string;
  armySpiritIconPrompt: string;
}

// Structured version for component consumption
export interface ViralInsights {
  tagline: string;
  spiritDescription: string;
  funStats: FunStat[];
  armySpiritIconPrompt: string;
}

function sanitizeQuirkName(name: string): string {
  // Some model outputs put emoji in both `name` and `emoji`.
  // Keep `emoji` as the single icon source and strip trailing pictographs from name.
  return name
    .replace(/\s*[\p{Extended_Pictographic}\uFE0F\u200D]+$/gu, '')
    .trim();
}

// Helper to convert raw API response to structured format
export function parseViralInsights(raw: ViralInsightsRaw): ViralInsights {
  return {
    tagline: raw.tagline,
    spiritDescription: raw.spiritDescription,
    funStats: [
      { name: sanitizeQuirkName(raw.funStat1Name), emoji: raw.funStat1Emoji, value: raw.funStat1Value, description: raw.funStat1Desc, iconPrompt: raw.funStat1IconPrompt },
      { name: sanitizeQuirkName(raw.funStat2Name), emoji: raw.funStat2Emoji, value: raw.funStat2Value, description: raw.funStat2Desc, iconPrompt: raw.funStat2IconPrompt },
      ...(raw.funStat3Name ? [{ name: sanitizeQuirkName(raw.funStat3Name), emoji: raw.funStat3Emoji || '', value: raw.funStat3Value || '', description: raw.funStat3Desc || '', iconPrompt: raw.funStat3IconPrompt || '' }] : []),
      ...(raw.funStat4Name ? [{ name: sanitizeQuirkName(raw.funStat4Name), emoji: raw.funStat4Emoji || '', value: raw.funStat4Value || '', description: raw.funStat4Desc || '', iconPrompt: raw.funStat4IconPrompt || '' }] : []),
    ].filter(s => s.name && s.name.trim() !== ''),
    armySpiritIconPrompt: raw.armySpiritIconPrompt,
  };
}

// Storage for generated army spirit icons
export interface ArmySpiritIcon {
  id: string;
  briefHash: string;     // Hash of army list for uniqueness
  imageUrl: string;        // Supabase storage URL
  tagline: string;
  generatedAt: Date;
}

// ============================================
// TARGET PROFILES FOR MATHHAMMER
// ============================================

const TARGET_PROFILES: Record<string, DefenderProfile> = {
  MEQ: { toughness: 4, save: '3+', wounds: 2, modelCount: 5 },
  TEQ: { toughness: 5, save: '2+', invuln: '4+', wounds: 3, modelCount: 5 },
  GEQ: { toughness: 3, save: '5+', wounds: 1, modelCount: 10 },
  VEHICLE: { toughness: 10, save: '3+', wounds: 12, modelCount: 1 },
  MONSTER: { toughness: 12, save: '4+', wounds: 16, modelCount: 1 },
  KNIGHT: { toughness: 12, save: '3+', invuln: '5+', wounds: 22, modelCount: 1 },
};

// Extended toughness brackets for comprehensive per-unit analysis
const TOUGHNESS_BRACKETS: Record<string, { profile: DefenderProfile; label: string }> = {
  T3_HORDE: { 
    profile: { toughness: 3, save: '5+', wounds: 1, modelCount: 10 },
    label: 'Horde (T3 5+)'
  },
  T4_INFANTRY: { 
    profile: { toughness: 4, save: '3+', wounds: 2, modelCount: 5 },
    label: 'Infantry (T4 3+)'
  },
  T5_ELITE: { 
    profile: { toughness: 5, save: '2+', invuln: '4+', wounds: 3, modelCount: 5 },
    label: 'Elite (T5 2+)'
  },
  T6_GRAVIS: { 
    profile: { toughness: 6, save: '3+', wounds: 3, modelCount: 3 },
    label: 'Gravis (T6 3+)'
  },
  T8_DREAD: { 
    profile: { toughness: 8, save: '2+', wounds: 12, modelCount: 1 },
    label: 'Dreadnought (T8 2+)'
  },
  T10_VEHICLE: { 
    profile: { toughness: 10, save: '3+', wounds: 14, modelCount: 1 },
    label: 'Vehicle (T10 3+)'
  },
  T12_MONSTER: { 
    profile: { toughness: 12, save: '4+', wounds: 16, modelCount: 1 },
    label: 'Monster (T12 4+)'
  },
};

// ============================================
// TACTICAL ROLE ASSIGNMENT
// ============================================

/**
 * Assigns a tactical role to a unit based on its stats, keywords, and abilities.
 * Uses heuristics that reflect competitive 40K gameplay.
 */
function assignTacticalRole(
  unit: ParsedUnit,
  damageVsMEQ: number,
  damageVsVehicle: number,
  effectiveWounds: number
): TacticalRoleAssignment {
  const keywords = (unit.keywords || []).map(k => k.toUpperCase());
  const abilities = unit.abilities || [];
  const pointsCost = unit.pointsCost || 0;
  const modelCount = unit.modelCount || 1;
  const ds = unit.parsedDatasheet;
  const role = ds?.role?.toLowerCase() || '';
  
  // Calculate points per model (efficiency indicator)
  const pointsPerModel = modelCount > 0 ? pointsCost / modelCount : pointsCost;
  
  // Check for specific keywords/abilities that strongly indicate roles
  const isCharacter = keywords.includes('CHARACTER');
  const isBattleline = keywords.includes('BATTLELINE') || role.includes('battleline');
  const hasLeaderAbility = abilities.some(a => 
    a.name?.toUpperCase().includes('LEADER') || 
    a.description?.toUpperCase().includes('CAN BE ATTACHED')
  );
  const hasAuraAbility = abilities.some(a => 
    a.description?.toUpperCase().includes('AURA') ||
    a.description?.toUpperCase().includes('WITHIN 6"') ||
    a.description?.toUpperCase().includes('WITHIN 12"')
  );
  const hasDeepStrikeDenial = abilities.some(a =>
    a.description?.toUpperCase().includes('DEEP STRIKE') && 
    a.description?.toUpperCase().includes('12"')
  );
  const isTerminator = keywords.includes('TERMINATOR');
  const hasJumpPack = keywords.includes('JUMP PACK');
  const hasFly = keywords.includes('FLY');
  const isMounted = keywords.includes('MOUNTED') || keywords.includes('CAVALRY');
  const isVehicle = keywords.includes('VEHICLE');
  const isInfantry = keywords.includes('INFANTRY');
  const isPhobos = keywords.includes('PHOBOS');
  
  // Total damage output
  const totalDamage = damageVsMEQ + damageVsVehicle;
  
  // Decision tree for role assignment
  let role_result: TacticalRole;
  let confidence: number;
  let reasoning: string;
  let alternateRoles: TacticalRole[] = [];
  
  // SUPPORT: Characters with auras/buffs, not high damage
  if (isCharacter && (hasLeaderAbility || hasAuraAbility) && totalDamage < 15) {
    role_result = 'support';
    confidence = 85;
    reasoning = 'Leader or aura character that multiplies the effectiveness of nearby units - attach to key squads for maximum impact';
    if (totalDamage > 8) {
      alternateRoles = ['hammer'];
    }
  }
  // SCREENING: Phobos units with deep strike denial, cheap units
  else if (hasDeepStrikeDenial || (isPhobos && isInfantry)) {
    role_result = 'screening';
    confidence = 90;
    reasoning = 'Denies enemy deep strikes and protects your backfield - deploy to control where reserves can appear';
    alternateRoles = ['scoring'];
  }
  // HAMMER: High damage output units (damage > 15 vs MEQ or > 8 vs Vehicle)
  else if (totalDamage > 20 || damageVsVehicle > 8) {
    role_result = 'hammer';
    confidence = 90;
    reasoning = 'Heavy-hitting loadout designed to eliminate priority threats - point at what needs to die';
    if (effectiveWounds > 15) {
      alternateRoles = ['anvil'];
    }
  }
  // SKIRMISHER: Mobile units with moderate damage (Jump Pack, FLY, fast)
  else if ((hasJumpPack || hasFly || isMounted) && totalDamage > 8) {
    role_result = 'skirmisher';
    confidence = 80;
    reasoning = 'Fast and dangerous - use to threaten flanks, isolate weak targets, or grab distant objectives';
    alternateRoles = ['hammer'];
  }
  // ANVIL: High durability, moderate damage (Terminators, vehicles with OK damage)
  else if (effectiveWounds > 15 && totalDamage > 5) {
    role_result = 'anvil';
    confidence = 75;
    reasoning = 'Tough enough to anchor key positions and absorb punishment while your army maneuvers';
    if (totalDamage > 12) {
      alternateRoles = ['hammer'];
    }
  }
  // SCORING: Battleline or cheap infantry meant for objectives
  else if (isBattleline || (isInfantry && pointsPerModel < 20 && totalDamage < 10)) {
    role_result = 'scoring';
    confidence = 85;
    reasoning = isBattleline 
      ? 'Core battleline unit built for holding ground - plant on objectives and perform actions'
      : 'Efficient infantry for objective control - better at scoring than fighting';
    alternateRoles = ['screening'];
  }
  // Default: Classify based on primary attribute
  else if (effectiveWounds > 10) {
    role_result = 'anvil';
    confidence = 60;
    reasoning = 'Durable enough to hold a position under pressure';
    alternateRoles = ['scoring'];
  }
  else if (totalDamage > 6) {
    role_result = 'skirmisher';
    confidence = 55;
    reasoning = 'Versatile unit that can flex between roles as the battle demands';
    alternateRoles = ['scoring', 'support'];
  }
  else {
    role_result = 'scoring';
    confidence = 50;
    reasoning = 'Best used for objective play and performing actions rather than direct combat';
    alternateRoles = ['screening'];
  }
  
  return {
    role: role_result,
    confidence,
    reasoning,
    alternateRoles: alternateRoles.length > 0 ? alternateRoles : undefined,
  };
}

// ============================================
// DISPLAY NAME GENERATION
// ============================================

/**
 * Generates unique display names for units, handling duplicates:
 * - Single occurrence: "Wolf Guard Terminators"
 * - Different points: "Wolf Guard Terminators (340pts)" vs "Wolf Guard Terminators (170pts)"
 * - Same name AND points: "Wulfen with Storm Shields (200pts) A" vs "Wulfen with Storm Shields (200pts) B"
 */
function generateUniqueDisplayNames(units: { name: string; pointsCost: number }[]): string[] {
  // Count occurrences of each name
  const nameCounts: Record<string, number> = {};
  for (const unit of units) {
    nameCounts[unit.name] = (nameCounts[unit.name] || 0) + 1;
  }

  // Count occurrences of name+points combinations (for truly identical units)
  const namePointsKey = (name: string, points: number) => `${name}::${points}`;
  const namePointsCounts: Record<string, number> = {};
  for (const unit of units) {
    const key = namePointsKey(unit.name, unit.pointsCost);
    namePointsCounts[key] = (namePointsCounts[key] || 0) + 1;
  }

  // Track how many of each name+points we've seen so far (for A/B/C assignment)
  const namePointsSeen: Record<string, number> = {};

  return units.map(unit => {
    const hasDuplicateNames = nameCounts[unit.name] > 1;
    const key = namePointsKey(unit.name, unit.pointsCost);
    const hasDuplicateNamePoints = namePointsCounts[key] > 1;

    // Track which instance this is (A=0, B=1, C=2...)
    namePointsSeen[key] = (namePointsSeen[key] || 0) + 1;
    const instanceIndex = namePointsSeen[key] - 1;
    const instanceLetter = String.fromCharCode(65 + instanceIndex); // A, B, C...

    if (!hasDuplicateNames) {
      // Unique name - use as-is
      return unit.name;
    } else if (hasDuplicateNamePoints) {
      // Same name AND same points - add letter suffix
      return `${unit.name} (${unit.pointsCost}pts) ${instanceLetter}`;
    } else {
      // Same name but different points - points is enough to differentiate
      return `${unit.name} (${unit.pointsCost}pts)`;
    }
  });
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

export function analyzeBrief(armyList: ParsedArmyList): BriefAnalysis {
  // Calculate basic stats
  const totalPoints = armyList.units.reduce((sum, u) => sum + (u.pointsCost || 0), 0);
  const modelCount = armyList.units.reduce((sum, u) => sum + (u.modelCount || 1), 0);

  // Run three pillars
  const mathHammer = analyzeMathHammer(armyList);
  const metaContext = analyzeMetaContext(armyList);
  const objectiveEcology = analyzeObjectiveEcology(armyList);

  // Calculate radar scores
  const radarScores = calculateRadarScores(mathHammer, metaContext, objectiveEcology, armyList);

  // Generate recommendations
  const collectionGaps = identifyCollectionGaps(mathHammer, metaContext, objectiveEcology, armyList);
  const keyStratagems = identifyKeyStratagems(armyList);
  const threatAssessment = generateThreatAssessment(mathHammer, metaContext, objectiveEcology, radarScores);

  // NEW: Calculate unit engagement profiles with tactical roles
  const unitEngagementProfiles: UnitEngagementProfile[] = [];

  // Generate unique displayNames for all units (handles duplicates with same name AND points)
  const displayNames = generateUniqueDisplayNames(armyList.units);

  for (let i = 0; i < armyList.units.length; i++) {
    const unit = armyList.units[i];
    const basicProfile = mathHammer.unitDamageProfiles[i];
    const durability = objectiveEcology.durabilityPerUnit.find(d => d.unitName === unit.name) || {
      unitName: unit.name,
      wounds: (unit.parsedDatasheet?.wounds || 1) * (unit.modelCount || 1),
      effectiveWounds: (unit.parsedDatasheet?.wounds || 1) * (unit.modelCount || 1),
      durabilityTier: 'standard' as const,
    };

    const engagementProfile = calculateUnitEngagementProfile(unit, basicProfile, durability, displayNames[i]);
    unitEngagementProfiles.push(engagementProfile);
  }
  
  // Group units by tactical role
  const roleGroupedComposition = groupUnitsByRole(unitEngagementProfiles);
  
  // Generate key engagement scenarios
  const keyEngagementScenarios = generateEngagementScenarios(roleGroupedComposition, armyList);

  return {
    faction: armyList.detectedFaction,
    detachment: armyList.detectedDetachment,
    totalPoints,
    unitCount: armyList.units.length,
    modelCount,
    radarScores,
    mathHammer,
    metaContext,
    objectiveEcology,
    unitEngagementProfiles,
    roleGroupedComposition,
    keyEngagementScenarios,
    collectionGaps,
    keyStratagems,
    threatAssessment,
  };
}

// ============================================
// PILLAR 1: MATHHAMMER ANALYSIS
// ============================================

function analyzeMathHammer(armyList: ParsedArmyList): MathHammerAnalysis {
  // Helper to get safe number value (defined first so it can be used throughout)
  const safe = (val: number): number => (isNaN(val) || val === null || val === undefined) ? 0 : val;
  
  const unitDamageProfiles: UnitDamageProfile[] = [];
  let totalRangedDamage = 0;
  let totalMeleeDamage = 0;
  const antiTankUnits: string[] = [];
  const antiInfantryUnits: string[] = [];

  for (const unit of armyList.units) {
    const profile = calculateUnitDamage(unit);
    unitDamageProfiles.push(profile);

    totalRangedDamage += safe(profile.rangedDamageVsMEQ);
    totalMeleeDamage += safe(profile.meleeDamageVsMEQ);

    // Classify units (with safe values)
    if (safe(profile.rangedDamageVsVehicle) > 5 || safe(profile.meleeDamageVsVehicle) > 5) {
      antiTankUnits.push(unit.name);
    }
    if (safe(profile.rangedDamageVsMEQ) > 8 || safe(profile.meleeDamageVsMEQ) > 8) {
      antiInfantryUnits.push(unit.name);
    }
  }
  
  // Aggregate damage vs each target type (with NaN safety)
  const damageVsInfantry = unitDamageProfiles.reduce(
    (sum, p) => sum + safe(p.rangedDamageVsMEQ) + safe(p.meleeDamageVsMEQ),
    0
  );
  const damageVsElite = unitDamageProfiles.reduce(
    (sum, p) => sum + safe(p.rangedDamageVsTEQ) + safe(p.meleeDamageVsTEQ),
    0
  );
  const damageVsVehicle = unitDamageProfiles.reduce(
    (sum, p) => sum + safe(p.rangedDamageVsVehicle) + safe(p.meleeDamageVsVehicle),
    0
  );
  const damageVsMonster = safe(damageVsVehicle) * 0.85; // Slightly lower due to T12

  return {
    damageVsInfantry,
    damageVsElite,
    damageVsVehicle,
    damageVsMonster,
    unitDamageProfiles,
    totalRangedDamage,
    totalMeleeDamage,
    antiTankUnits,
    antiInfantryUnits,
  };
}

function calculateUnitDamage(unit: ParsedUnit): UnitDamageProfile {
  const modelCount = unit.modelCount || 1;
  let rangedDamageVsMEQ = 0;
  let rangedDamageVsTEQ = 0;
  let rangedDamageVsVehicle = 0;
  let meleeDamageVsMEQ = 0;
  let meleeDamageVsTEQ = 0;
  let meleeDamageVsVehicle = 0;

  // Process each weapon
  for (const weapon of unit.weapons || []) {
    if (!weapon.strength || !weapon.damage) continue;

    const isMelee = weapon.type?.toLowerCase().includes('melee') ||
      weapon.range === 'Melee' ||
      weapon.weaponSkill;

    // Build attacker profile
    const attackerProfile: AttackerProfile = {
      bs_ws: weapon.ballisticSkill || weapon.weaponSkill || '4+',
      strength: parseInt(weapon.strength) || 4,
      ap: parseInt(weapon.armorPenetration?.replace('-', '') || '0') * -1,
      damage: parseDiceAverage(weapon.damage || '1'),
      attacks: parseDiceAverage(weapon.attacks || '1') * modelCount,
      abilities: parseWeaponAbilities(weapon.abilities || []),
    };

    // Calculate damage vs each target (with NaN safety)
    const dmgResult = calculateDamage(attackerProfile, TARGET_PROFILES.MEQ);
    const dmgVsMEQ = (dmgResult && !isNaN(dmgResult.expected_damage)) ? dmgResult.expected_damage : 0;
    
    const teqResult = calculateDamage(attackerProfile, TARGET_PROFILES.TEQ);
    const dmgVsTEQ = (teqResult && !isNaN(teqResult.expected_damage)) ? teqResult.expected_damage : 0;
    
    const vehicleResult = calculateDamage(attackerProfile, TARGET_PROFILES.VEHICLE);
    const dmgVsVehicle = (vehicleResult && !isNaN(vehicleResult.expected_damage)) ? vehicleResult.expected_damage : 0;

    if (isMelee) {
      meleeDamageVsMEQ += dmgVsMEQ;
      meleeDamageVsTEQ += dmgVsTEQ;
      meleeDamageVsVehicle += dmgVsVehicle;
    } else {
      rangedDamageVsMEQ += dmgVsMEQ;
      rangedDamageVsTEQ += dmgVsTEQ;
      rangedDamageVsVehicle += dmgVsVehicle;
    }
  }

  // Determine threat rating
  const totalDamage = rangedDamageVsMEQ + rangedDamageVsVehicle + meleeDamageVsMEQ + meleeDamageVsVehicle;
  let threatRating: 'low' | 'medium' | 'high' | 'extreme' = 'low';
  if (totalDamage > 30) threatRating = 'extreme';
  else if (totalDamage > 15) threatRating = 'high';
  else if (totalDamage > 6) threatRating = 'medium';

  // Determine primary role
  let primaryRole = 'Support';
  if (rangedDamageVsVehicle > 5 || meleeDamageVsVehicle > 5) {
    primaryRole = 'Anti-Tank';
  } else if (rangedDamageVsMEQ > 8 || meleeDamageVsMEQ > 8) {
    primaryRole = 'Anti-Infantry';
  } else if (meleeDamageVsMEQ > rangedDamageVsMEQ * 2) {
    primaryRole = 'Melee Threat';
  } else if (rangedDamageVsMEQ > meleeDamageVsMEQ * 2) {
    primaryRole = 'Ranged Threat';
  }

  return {
    unitName: unit.name,
    rangedDamageVsMEQ,
    rangedDamageVsTEQ,
    rangedDamageVsVehicle,
    meleeDamageVsMEQ,
    meleeDamageVsTEQ,
    meleeDamageVsVehicle,
    threatRating,
    primaryRole,
  };
}

function parseWeaponAbilities(abilities: string[]): { kind: string; value?: number; condition?: string }[] {
  const parsed: { kind: string; value?: number; condition?: string; targetKeyword?: string }[] = [];

  for (const ability of abilities) {
    const upper = ability.toUpperCase();

    if (upper.includes('LETHAL HITS')) {
      parsed.push({ kind: 'LETHAL_HITS' });
    }
    if (upper.includes('DEVASTATING WOUNDS')) {
      parsed.push({ kind: 'DEVASTATING_WOUNDS' });
    }
    if (upper.includes('TWIN-LINKED')) {
      parsed.push({ kind: 'TWIN_LINKED' });
    }
    if (upper.includes('IGNORES COVER')) {
      parsed.push({ kind: 'IGNORES_COVER' });
    }

    // Sustained Hits X
    // eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifier, controlled ability string
    const sustainedMatch = upper.match(/SUSTAINED HITS\s{0,10}(\d+)?/);
    if (sustainedMatch) {
      parsed.push({ kind: 'SUSTAINED_HITS', value: parseInt(sustainedMatch[1] || '1') });
    }

    // Anti-X Y+
    const antiMatch = upper.match(/ANTI-(\w+)\s*(\d+)\+/);
    if (antiMatch) {
      parsed.push({ kind: 'ANTI', condition: `${antiMatch[2]}+`, targetKeyword: antiMatch[1] });
    }

    // Melta X
    // eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifier, controlled ability string
    const meltaMatch = upper.match(/MELTA\s{0,10}(\d+)?/);
    if (meltaMatch) {
      parsed.push({ kind: 'MELTA', value: parseInt(meltaMatch[1] || '2') });
    }
  }

  return parsed;
}

// ============================================
// UNIT ENGAGEMENT PROFILE CALCULATION
// ============================================

/**
 * Calculates detailed engagement profile for a unit including
 * per-weapon damage breakdown across toughness brackets
 */
function calculateUnitEngagementProfile(
  unit: ParsedUnit,
  basicDamageProfile: UnitDamageProfile,
  durability: UnitDurability,
  displayName: string
): UnitEngagementProfile {
  const modelCount = unit.modelCount || 1;
  const ds = unit.parsedDatasheet;
  
  // Calculate weapon breakdowns
  const weapons: WeaponDamageBreakdown[] = [];
  
  for (const weapon of unit.weapons || []) {
    if (!weapon.strength || !weapon.damage) continue;
    
    const isMelee = weapon.type?.toLowerCase().includes('melee') ||
      weapon.range === 'Melee' ||
      weapon.weaponSkill;
    
    const attackerProfile: AttackerProfile = {
      bs_ws: weapon.ballisticSkill || weapon.weaponSkill || '4+',
      strength: parseInt(weapon.strength) || 4,
      ap: parseInt(weapon.armorPenetration?.replace('-', '') || '0') * -1,
      damage: parseDiceAverage(weapon.damage || '1'),
      attacks: parseDiceAverage(weapon.attacks || '1') * modelCount,
      abilities: parseWeaponAbilities(weapon.abilities || []),
    };
    
    // Calculate damage vs each toughness bracket
    const damageByToughness: Record<number, number> = {};
    let bestDamage = 0;
    let bestAgainst = 'Infantry';
    
    for (const [key, bracket] of Object.entries(TOUGHNESS_BRACKETS)) {
      const result = calculateDamage(attackerProfile, bracket.profile);
      const damage = result?.expected_damage || 0;
      damageByToughness[bracket.profile.toughness] = damage;
      
      if (damage > bestDamage) {
        bestDamage = damage;
        bestAgainst = bracket.label;
      }
    }
    
    weapons.push({
      weaponName: weapon.name || 'Unknown Weapon',
      type: isMelee ? 'melee' : 'ranged',
      attacks: weapon.attacks || '1',
      strength: parseInt(weapon.strength) || 4,
      ap: parseInt(weapon.armorPenetration?.replace('-', '') || '0'),
      damage: weapon.damage || '1',
      abilities: weapon.abilities || [],
      damageByToughness,
      bestAgainst,
    });
  }
  
  // Calculate total toughness performance (all weapons combined)
  const toughnessPerformance: ToughnessBracketDamage[] = [];
  
  for (const [key, bracket] of Object.entries(TOUGHNESS_BRACKETS)) {
    let totalDamage = 0;
    for (const weapon of weapons) {
      totalDamage += weapon.damageByToughness[bracket.profile.toughness] || 0;
    }
    
    // Determine rating based on damage output
    let rating: 'devastating' | 'strong' | 'moderate' | 'weak' | 'ineffective';
    if (totalDamage > 20) rating = 'devastating';
    else if (totalDamage > 10) rating = 'strong';
    else if (totalDamage > 5) rating = 'moderate';
    else if (totalDamage > 2) rating = 'weak';
    else rating = 'ineffective';
    
    toughnessPerformance.push({
      bracket: key,
      toughness: bracket.profile.toughness,
      label: bracket.label,
      damage: totalDamage,
      rating,
    });
  }
  
  // Determine best targets (top 3 brackets where unit performs well)
  const sortedBrackets = [...toughnessPerformance].sort((a, b) => b.damage - a.damage);
  const bestTargets = sortedBrackets.slice(0, 3).map(b => {
    const bracket = TOUGHNESS_BRACKETS[b.bracket];
    const profile = bracket.profile;
    return {
      targetType: b.label,
      targetProfile: `T${profile.toughness} ${profile.save}${profile.invuln ? ` ${profile.invuln}` : ''}`,
      expectedDamage: b.damage,
      rating: b.rating,
      notes: b.rating === 'devastating' ? 'Primary target' : 
             b.rating === 'strong' ? 'Good matchup' : undefined,
    };
  });
  
  // Assign tactical role
  const totalDamageVsMEQ = basicDamageProfile.rangedDamageVsMEQ + basicDamageProfile.meleeDamageVsMEQ;
  const totalDamageVsVehicle = basicDamageProfile.rangedDamageVsVehicle + basicDamageProfile.meleeDamageVsVehicle;
  const tacticalRole = assignTacticalRole(unit, totalDamageVsMEQ, totalDamageVsVehicle, durability.effectiveWounds);
  
  return {
    unitName: unit.name,
    displayName,
    pointsCost: unit.pointsCost,
    modelCount,
    tacticalRole,
    weapons,
    bestTargets,
    toughnessPerformance,
    toughness: ds?.toughness || 4,
    wounds: (ds?.wounds || 1) * modelCount,
    save: ds?.save || '4+',
    keywords: unit.keywords || [],
  };
}

/**
 * Groups units by their tactical role
 */
function groupUnitsByRole(profiles: UnitEngagementProfile[]): RoleGroupedComposition {
  return {
    hammers: profiles.filter(p => p.tacticalRole.role === 'hammer'),
    anvils: profiles.filter(p => p.tacticalRole.role === 'anvil'),
    scoring: profiles.filter(p => p.tacticalRole.role === 'scoring'),
    screening: profiles.filter(p => p.tacticalRole.role === 'screening'),
    support: profiles.filter(p => p.tacticalRole.role === 'support'),
    skirmishers: profiles.filter(p => p.tacticalRole.role === 'skirmisher'),
  };
}

// ============================================
// ENGAGEMENT SCENARIO GENERATOR
// ============================================

/**
 * Common target profiles for scenario generation
 */
const COMMON_TARGETS = [
  { 
    name: 'Space Marine Squad',
    description: '5 Intercessors',
    profile: { toughness: 4, save: '3+', wounds: 10 },
  },
  { 
    name: 'Terminator Squad',
    description: '5 Terminators',
    profile: { toughness: 5, save: '2+', wounds: 15, invuln: '4+' },
  },
  {
    name: 'Redemptor Dreadnought',
    description: 'T9 Walker',
    profile: { toughness: 9, save: '2+', wounds: 12 },
  },
  {
    name: 'Leman Russ',
    description: 'Battle Tank',
    profile: { toughness: 11, save: '2+', wounds: 13 },
  },
  {
    name: 'Imperial Knight',
    description: 'Questoris class',
    profile: { toughness: 12, save: '3+', wounds: 22, invuln: '5+' },
  },
];

/**
 * Generates key engagement scenarios for hammer and skirmisher units
 */
function generateEngagementScenarios(
  roleGrouped: RoleGroupedComposition,
  armyList: ParsedArmyList
): EngagementScenario[] {
  const scenarios: EngagementScenario[] = [];
  
  // Get hammer and skirmisher units (units meant to deal damage)
  const damageUnits = [...roleGrouped.hammers, ...roleGrouped.skirmishers];
  
  for (const unit of damageUnits) {
    // Find best target from common targets
    let bestScenario: EngagementScenario | null = null;
    let bestDamageRatio = 0;
    
    for (const target of COMMON_TARGETS) {
      // Calculate total damage vs this target
      let totalDamage = 0;
      for (const weapon of unit.weapons) {
        // Build attacker profile for each weapon
        const attackerProfile: AttackerProfile = {
          bs_ws: '4+', // Default, would need weapon skill from data
          strength: weapon.strength,
          ap: weapon.ap * -1,
          damage: parseDiceAverage(weapon.damage),
          attacks: parseDiceAverage(weapon.attacks) * unit.modelCount,
          abilities: parseWeaponAbilities(weapon.abilities),
        };
        
        const defenderProfile: DefenderProfile = {
          toughness: target.profile.toughness,
          save: target.profile.save,
          wounds: target.profile.wounds,
          invuln: target.profile.invuln,
          modelCount: 1,
        };
        
        const result = calculateDamage(attackerProfile, defenderProfile);
        totalDamage += result?.expected_damage || 0;
      }
      
      // Calculate probability to kill (simplified)
      const probabilityToKill = Math.min(95, Math.round((totalDamage / target.profile.wounds) * 100));
      const turnsToKill = totalDamage > 0 ? Math.ceil(target.profile.wounds / totalDamage) : 99;
      
      // Score this matchup (prefer scenarios where unit is effective)
      const damageRatio = totalDamage / target.profile.wounds;
      
      if (damageRatio > bestDamageRatio && damageRatio >= 0.3) {
        bestDamageRatio = damageRatio;
        
        // Generate tactical notes
        let tacticalNotes = '';
        if (probabilityToKill >= 80) {
          tacticalNotes = `High-value engagement. ${unit.unitName} can reliably eliminate this target.`;
        } else if (probabilityToKill >= 50) {
          tacticalNotes = `Solid matchup. May need support or a second activation to finish.`;
        } else {
          tacticalNotes = `Chip damage role. Use to soften up for other units.`;
        }
        
        bestScenario = {
          title: `${unit.unitName} vs ${target.name}`,
          attackingUnit: unit.unitName,
          targetDescription: target.description,
          targetProfile: target.profile,
          expectedDamage: totalDamage,
          probabilityToKill,
          turnsToKill,
          tacticalNotes,
        };
      }
    }
    
    if (bestScenario) {
      scenarios.push(bestScenario);
    }
  }
  
  // Sort by probability to kill (most decisive scenarios first)
  scenarios.sort((a, b) => b.probabilityToKill - a.probabilityToKill);
  
  // Return top scenarios (limit to prevent overwhelming)
  return scenarios.slice(0, 6);
}

// ============================================
// PILLAR 2: META CONTEXT ANALYSIS
// ============================================

function analyzeMetaContext(armyList: ParsedArmyList): MetaContextAnalysis {
  const roleDistribution: Record<string, number> = {};
  const keywordCounts: Record<string, number> = {};
  const leaderUnits: string[] = [];
  let characterCount = 0;

  // Flags
  let hasDeepStrike = false;
  let hasScouts = false;
  let hasInfiltrators = false;
  let hasPsykers = false;
  let hasTransports = false;

  // Keywords that GRANT Deep Strike ability in 10th Edition
  const DEEP_STRIKE_KEYWORDS = [
    'TERMINATOR', 'JUMP PACK', 'TELEPORT HOMER', 'DAEMON', 
    'DEEP STRIKE', 'TELEPORT', 'DROP POD'
  ];
  
  // Keywords that GRANT Scouts ability
  const SCOUTS_KEYWORDS = ['SCOUTS', 'SCOUT'];
  
  // Keywords that GRANT Infiltrate ability
  const INFILTRATE_KEYWORDS = ['INFILTRATORS', 'INFILTRATE', 'PHOBOS'];

  for (const unit of armyList.units) {
    // Count roles
    const role = unit.parsedDatasheet?.role || 'Unknown';
    roleDistribution[role] = (roleDistribution[role] || 0) + 1;

    // Count keywords and check for special abilities
    const keywords = unit.keywords || [];
    for (const kw of keywords) {
      const upper = kw.toUpperCase();
      keywordCounts[upper] = (keywordCounts[upper] || 0) + 1;

      // Check for Deep Strike granting keywords
      if (DEEP_STRIKE_KEYWORDS.some(dsk => upper === dsk || upper.includes(dsk))) {
        hasDeepStrike = true;
      }
      
      // Check for Scouts granting keywords
      if (SCOUTS_KEYWORDS.some(sk => upper === sk || upper.includes(sk))) {
        hasScouts = true;
      }
      
      // Check for Infiltrate granting keywords (Phobos units can infiltrate)
      if (INFILTRATE_KEYWORDS.some(ik => upper === ik || upper.includes(ik))) {
        hasInfiltrators = true;
      }
      
      if (upper === 'PSYKER') hasPsykers = true;
      if (upper === 'TRANSPORT' || upper === 'DEDICATED TRANSPORT') hasTransports = true;
      if (upper === 'CHARACTER') {
        characterCount++;
        // Check if it's a leader
        const abilities = unit.abilities || [];
        const hasLeaderAbility = abilities.some(a =>
          a.name?.toUpperCase().includes('LEADER') ||
          a.description?.toUpperCase().includes('CAN BE ATTACHED')
        );
        if (hasLeaderAbility) {
          leaderUnits.push(unit.name);
        }
      }
    }
    
    // Also check unit abilities for deployment options
    const abilities = unit.abilities || [];
    for (const ability of abilities) {
      const abilityName = ability.name?.toUpperCase() || '';
      const abilityDesc = ability.description?.toUpperCase() || '';
      
      // Check ability names and descriptions for Deep Strike
      if (abilityName.includes('DEEP STRIKE') || 
          abilityDesc.includes('DEEP STRIKE') ||
          abilityDesc.includes('SET UP IN RESERVE') ||
          abilityDesc.includes('ARRIVE FROM RESERVE')) {
        hasDeepStrike = true;
      }
      
      // Check for Scouts ability (often "Scouts X"")
      if (abilityName.includes('SCOUT') || 
          abilityDesc.includes('SCOUT') ||
          abilityDesc.includes('MAKE A NORMAL MOVE OF UP TO')) {
        hasScouts = true;
      }
      
      // Check for Infiltrate ability
      if (abilityName.includes('INFILTRAT') || 
          abilityDesc.includes('INFILTRAT') ||
          abilityDesc.includes('SET UP ANYWHERE ON THE BATTLEFIELD') ||
          abilityDesc.includes('MORE THAN 9" HORIZONTALLY')) {
        hasInfiltrators = true;
      }
    }
  }

  // Calculate detachment synergy (simplified)
  const detachmentSynergy = calculateDetachmentSynergy(armyList, keywordCounts);

  return {
    roleDistribution,
    keywordCounts,
    hasDeepStrike,
    hasScouts,
    hasInfiltrators,
    hasPsykers,
    hasTransports,
    characterCount,
    leaderUnits,
    detachmentSynergy: detachmentSynergy.score,
    detachmentSynergyNotes: detachmentSynergy.notes,
  };
}

function calculateDetachmentSynergy(
  armyList: ParsedArmyList,
  keywordCounts: Record<string, number>
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 50; // Base score

  const detachment = armyList.detectedDetachment?.toLowerCase() || '';
  const faction = armyList.detectedFaction?.toLowerCase() || '';

  // Faction-specific synergy checks
  if (faction.includes('space wolves') || faction.includes('wolves')) {
    // Space Wolves benefit from melee units and BEASTS
    if (keywordCounts['BEASTS'] || keywordCounts['SPACE WOLVES BEASTS']) {
      score += 15;
      notes.push('BEASTS synergy with Space Wolves detachments');
    }
    if ((keywordCounts['INFANTRY'] || 0) > 3) {
      score += 10;
      notes.push('Good INFANTRY count for pack tactics');
    }
  }

  if (faction.includes('space marine') && !faction.includes('chaos')) {
    // Gladius benefits from BATTLELINE
    if (detachment.includes('gladius')) {
      const battlelineCount = armyList.units.filter(u =>
        u.parsedDatasheet?.role?.toLowerCase().includes('battleline')
      ).length;
      if (battlelineCount >= 3) {
        score += 20;
        notes.push('Strong BATTLELINE presence for Gladius Task Force');
      }
    }
  }

  // Generic checks
  if ((keywordCounts['CHARACTER'] || 0) >= 2) {
    score += 10;
    notes.push('Multiple CHARACTERs for leadership and buffs');
  }

  return { score: Math.min(100, score), notes };
}

// ============================================
// PILLAR 3: OBJECTIVE ECOLOGY ANALYSIS
// ============================================

function analyzeObjectiveEcology(armyList: ParsedArmyList): ObjectiveEcologyAnalysis {
  let totalOC = 0;
  let totalWounds = 0;
  let effectiveWounds = 0;
  let totalMovement = 0;
  let movementCount = 0;

  const highOCUnits: string[] = [];
  const actionUnits: string[] = [];
  const mobilityTiers = {
    slow: [] as string[],
    medium: [] as string[],
    fast: [] as string[],
    flying: [] as string[],
  };
  const durabilityPerUnit: UnitDurability[] = [];

  for (const unit of armyList.units) {
    const ds = unit.parsedDatasheet;
    if (!ds) continue;

    const modelCount = unit.modelCount || 1;
    const oc = (ds.objectiveControl || 1) * modelCount;
    totalOC += oc;

    if (oc >= 2) {
      highOCUnits.push(unit.name);
    }

    // Wounds calculation
    const wounds = (ds.wounds || 1) * modelCount;
    totalWounds += wounds;

    // Calculate effective wounds (adjusted for save)
    const saveValue = parseInt(ds.save?.replace('+', '') || '4');
    const saveMultiplier = 1 + (7 - saveValue) / 6 * 0.5; // Better save = more effective wounds
    const invuln = ds.invulnerableSave ? parseInt(ds.invulnerableSave.replace('+', '')) : 7;
    const invulnMultiplier = invuln <= 5 ? 1.3 : 1;
    const unitEffectiveWounds = wounds * saveMultiplier * invulnMultiplier;
    effectiveWounds += unitEffectiveWounds;

    // Durability tier
    let durabilityTier: 'fragile' | 'standard' | 'tough' | 'fortress' = 'standard';
    if (unitEffectiveWounds < 5) durabilityTier = 'fragile';
    else if (unitEffectiveWounds > 20) durabilityTier = 'fortress';
    else if (unitEffectiveWounds > 10) durabilityTier = 'tough';

    durabilityPerUnit.push({
      unitName: unit.name,
      wounds,
      effectiveWounds: unitEffectiveWounds,
      durabilityTier,
    });

    // Movement analysis
    const movement = parseInt(ds.movement?.replace('"', '') || '6');
    if (!isNaN(movement)) {
      totalMovement += movement;
      movementCount++;

      if (movement < 6) mobilityTiers.slow.push(unit.name);
      else if (movement <= 10) mobilityTiers.medium.push(unit.name);
      else mobilityTiers.fast.push(unit.name);
    }

    // FLY keyword
    if (unit.keywords?.some(k => k.toUpperCase() === 'FLY')) {
      mobilityTiers.flying.push(unit.name);
    }

    // Action units (INFANTRY without being a CHARACTER leader attached)
    const isInfantry = unit.keywords?.some(k => k.toUpperCase() === 'INFANTRY');
    const isCharacter = unit.keywords?.some(k => k.toUpperCase() === 'CHARACTER');
    if (isInfantry && !isCharacter) {
      actionUnits.push(unit.name);
    }
  }

  const averageMovement = movementCount > 0 ? totalMovement / movementCount : 6;

  return {
    totalOC,
    ocPerUnit: armyList.units.length > 0 ? totalOC / armyList.units.length : 0,
    highOCUnits,
    actionUnits,
    actionUnitCount: actionUnits.length,
    mobilityTiers,
    averageMovement,
    totalWounds,
    effectiveWounds,
    durabilityPerUnit,
  };
}

// ============================================
// RADAR SCORE CALCULATION
// ============================================

// Helper to ensure a number is valid (not NaN, null, undefined)
function safeNumber(val: number | null | undefined, fallback: number = 0): number {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return val;
}

function calculateRadarScores(
  mathHammer: MathHammerAnalysis,
  metaContext: MetaContextAnalysis,
  objectiveEcology: ObjectiveEcologyAnalysis,
  armyList: ParsedArmyList
): RadarScores {
  const totalPoints = armyList.units.reduce((sum, u) => sum + (u.pointsCost || 0), 0);
  const pointsScale = totalPoints > 0 ? totalPoints / 2000 : 1; // Normalize to 2000pt army, avoid divide by zero

  // Killing Power (0-100)
  // Base: ~50 damage vs MEQ is average for 2000pts
  const totalDamage = safeNumber(mathHammer.damageVsInfantry) + safeNumber(mathHammer.damageVsVehicle) * 0.5;
  const killingPower = Math.min(100, (totalDamage / (50 * pointsScale)) * 50);

  // Durability (0-100)
  // Base: ~100 effective wounds is average for 2000pts
  const durability = Math.min(100, (safeNumber(objectiveEcology.effectiveWounds) / (100 * pointsScale)) * 50);

  // Mobility (0-100)
  // Average movement 8" is baseline
  const mobilityBase = (safeNumber(objectiveEcology.averageMovement, 6) / 8) * 40;
  const mobilityBonus =
    (metaContext.hasDeepStrike ? 15 : 0) +
    (metaContext.hasScouts ? 10 : 0) +
    (metaContext.hasInfiltrators ? 10 : 0) +
    (objectiveEcology.mobilityTiers.flying.length > 0 ? 10 : 0);
  const mobility = Math.min(100, mobilityBase + mobilityBonus);

  // Board Control (0-100)
  // Base: ~20 OC is average for 2000pts
  const ocScore = (safeNumber(objectiveEcology.totalOC) / (20 * pointsScale)) * 40;
  const unitCountScore = (armyList.units.length / 10) * 20;
  const actionScore = safeNumber(objectiveEcology.actionUnitCount) >= 3 ? 20 : safeNumber(objectiveEcology.actionUnitCount) * 7;
  const boardControl = Math.min(100, ocScore + unitCountScore + actionScore);

  // Flexibility (0-100)
  // Role diversity + special capabilities
  const roleCount = Object.keys(metaContext.roleDistribution).length;
  const roleScore = (roleCount / 5) * 30;
  const capabilityScore =
    (metaContext.characterCount >= 2 ? 15 : metaContext.characterCount * 7) +
    (metaContext.hasTransports ? 10 : 0) +
    (metaContext.hasPsykers ? 10 : 0) +
    (mathHammer.antiTankUnits.length >= 2 ? 10 : 0) +
    (mathHammer.antiInfantryUnits.length >= 2 ? 10 : 0);
  const flexibility = Math.min(100, roleScore + capabilityScore);

  return {
    killingPower: Math.round(safeNumber(killingPower)),
    durability: Math.round(safeNumber(durability)),
    mobility: Math.round(safeNumber(mobility)),
    boardControl: Math.round(safeNumber(boardControl)),
    flexibility: Math.round(safeNumber(flexibility)),
  };
}

// ============================================
// COLLECTION GAPS IDENTIFICATION
// ============================================

function identifyCollectionGaps(
  mathHammer: MathHammerAnalysis,
  metaContext: MetaContextAnalysis,
  objectiveEcology: ObjectiveEcologyAnalysis,
  armyList: ParsedArmyList
): CollectionGap[] {
  const gaps: CollectionGap[] = [];
  const faction = armyList.detectedFaction?.toLowerCase() || '';

  // Anti-tank check
  if (mathHammer.antiTankUnits.length < 2) {
    gaps.push({
      category: 'Firepower',
      issue: 'Limited anti-vehicle capability',
      suggestion: 'Consider adding units with high Strength, high AP weapons (S10+, AP-3 or better)',
      priority: 'high',
      potentialUnits: faction.includes('marine')
        ? ['Eradicators', 'Multi-melta Attack Bikes', 'Gladiator Lancer']
        : undefined,
    });
  }

  // Action units check
  if (objectiveEcology.actionUnitCount < 2) {
    gaps.push({
      category: 'Objective Play',
      issue: 'Not enough units for actions and secondary objectives',
      suggestion: 'Add cheap INFANTRY units that can perform actions while your main force fights',
      priority: 'high',
      potentialUnits: faction.includes('marine')
        ? ['Scout Squad', 'Infiltrators', 'Incursors']
        : undefined,
    });
  }

  // Deep Strike capability
  if (!metaContext.hasDeepStrike && !metaContext.hasInfiltrators) {
    gaps.push({
      category: 'Deployment',
      issue: 'No deep strike or infiltrate options',
      suggestion: 'Units with Deep Strike or deployment flexibility help contest objectives and threaten backlines',
      priority: 'medium',
    });
  }

  // Character support
  if (metaContext.characterCount < 2) {
    gaps.push({
      category: 'Leadership',
      issue: 'Limited CHARACTER presence',
      suggestion: 'Characters provide key buffs and can score certain secondary objectives',
      priority: 'medium',
    });
  }

  // Mobility check
  if (objectiveEcology.averageMovement < 7 && objectiveEcology.mobilityTiers.fast.length === 0) {
    gaps.push({
      category: 'Mobility',
      issue: 'Army lacks fast elements',
      suggestion: 'Fast units help contest distant objectives and redeploy across the battlefield',
      priority: 'medium',
    });
  }

  // Durability check
  if (objectiveEcology.totalWounds < 50) {
    gaps.push({
      category: 'Durability',
      issue: 'Low total wound count - army may be fragile',
      suggestion: 'Consider adding multi-wound models or units with strong saves/invulnerable saves',
      priority: 'medium',
    });
  }

  return gaps;
}

// ============================================
// KEY STRATAGEMS
// ============================================

function identifyKeyStratagems(armyList: ParsedArmyList): string[] {
  const stratagems: string[] = [];
  const faction = armyList.detectedFaction?.toLowerCase() || '';
  const detachment = armyList.detectedDetachment?.toLowerCase() || '';

  // Universal core stratagems
  stratagems.push('Command Re-roll (1CP) - Reroll any dice roll');
  stratagems.push('Insane Bravery (1CP) - Auto-pass Battle-shock test');

  // Faction-specific suggestions
  if (faction.includes('space marine') || faction.includes('adeptus astartes')) {
    stratagems.push('Armour of Contempt (1CP) - Worsen AP by 1');
    stratagems.push('Only In Death Does Duty End (1CP) - Fight on death');
  }

  if (faction.includes('space wolves') || faction.includes('wolves')) {
    if (detachment.includes('saga') || detachment.includes('hunter')) {
      stratagems.push('Hunters\' Trail (1CP) - Extended pile-in/consolidate');
      stratagems.push('Chosen Prey (1CP) - Fall back and still shoot/charge');
    }
  }

  return stratagems.slice(0, 5); // Limit to top 5
}

// ============================================
// THREAT ASSESSMENT
// ============================================

function generateThreatAssessment(
  mathHammer: MathHammerAnalysis,
  metaContext: MetaContextAnalysis,
  objectiveEcology: ObjectiveEcologyAnalysis,
  radarScores: RadarScores
): ThreatAssessment {
  // Calculate overall threat
  const avgScore = (
    radarScores.killingPower +
    radarScores.durability +
    radarScores.mobility +
    radarScores.boardControl +
    radarScores.flexibility
  ) / 5;

  let overallThreat: 'low' | 'medium' | 'high' | 'extreme' = 'medium';
  if (avgScore > 75) overallThreat = 'extreme';
  else if (avgScore > 60) overallThreat = 'high';
  else if (avgScore < 40) overallThreat = 'low';

  // Identify strengths
  const strengths: string[] = [];
  if (radarScores.killingPower > 70) strengths.push('High damage output - can eliminate key targets quickly');
  if (radarScores.durability > 70) strengths.push('Very durable - hard to remove from objectives');
  if (radarScores.mobility > 70) strengths.push('Highly mobile - can contest objectives anywhere');
  if (radarScores.boardControl > 70) strengths.push('Strong board control - dominates objective play');
  if (mathHammer.antiTankUnits.length >= 3) strengths.push('Excellent anti-vehicle capability');
  if (metaContext.hasDeepStrike && metaContext.hasInfiltrators) strengths.push('Flexible deployment options');

  // Identify weaknesses
  const weaknesses: string[] = [];
  if (radarScores.killingPower < 40) weaknesses.push('Limited damage output');
  if (radarScores.durability < 40) weaknesses.push('Low durability - vulnerable to focused fire');
  if (radarScores.mobility < 40) weaknesses.push('Slow army - may struggle to reposition');
  if (objectiveEcology.actionUnitCount < 2) weaknesses.push('Few action units for secondaries');
  if (mathHammer.antiTankUnits.length < 2) weaknesses.push('Struggles against vehicles/monsters');

  // Counterplay tips
  const counterplay: string[] = [];
  if (radarScores.killingPower > 60) {
    counterplay.push('Stay in cover and use terrain to limit their shooting angles');
  }
  if (radarScores.durability > 60) {
    counterplay.push('Focus fire on one unit at a time rather than spreading damage');
  }
  if (metaContext.hasDeepStrike) {
    counterplay.push('Screen your backfield to prevent deep strike threats');
  }
  if (objectiveEcology.mobilityTiers.fast.length > 2) {
    counterplay.push('Control the center to limit their movement options');
  }

  return {
    overallThreat,
    primaryStrengths: strengths.slice(0, 3),
    primaryWeaknesses: weaknesses.slice(0, 3),
    counterplayTips: counterplay.slice(0, 3),
  };
}

// ============================================
// AI STRATEGIC ANALYSIS TYPES
// ============================================

export interface StrategicStrength {
  title: string;
  description: string;
  relevantUnits: string[];
}

export interface StrategicWeakness {
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  counterplayRisk: string;
  specificCounterArmies?: string[];
  mitigationStrategy?: string;
}

// Matchup-related types
export type OpponentArchetype = 'horde_armies' | 'elite_armies' | 'vehicle_spam' | 'monster_mash' | 'skirmish_msu' | 'melee_rush' | 'gunline' | 'attrition';
export type MatchupRating = 'very_unfavorable' | 'unfavorable' | 'even' | 'favorable' | 'very_favorable';
export type WinCondition = 'outscore' | 'tabling' | 'attrition' | 'alpha_strike' | 'denial';

export interface MatchupConsideration {
  opponentArchetype: OpponentArchetype;
  matchupRating: MatchupRating;
  winCondition: WinCondition;
  battlePlan: string;
  reasoning: string;
  keyTips: string[];
}

export interface BriefStrategicAnalysis {
  // Core required fields (displayed in UI)
  strategicStrengths: StrategicStrength[];
  strategicWeaknesses: StrategicWeakness[];
  matchupConsiderations: MatchupConsideration[];
  
  // Optional legacy fields (no longer generated, but may exist in old data)
  executiveSummary?: string;
  armyArchetype?: {
    primary: 'horde' | 'elite' | 'balanced' | 'skew' | 'castle' | 'alpha_strike' | 'attrition' | 'objective_play';
    secondary: 'melee_focused' | 'ranged_focused' | 'hybrid' | 'psychic' | 'vehicle_heavy' | 'monster_mash' | 'character_hammer' | 'transport_rush';
    description: string;
  };
  statisticalBreakdown?: {
    totalUnits: number;
    totalModels: number;
    totalWounds: number;
    averageToughness: number;
    toughnessDistribution: {
      t3OrLess: number;
      t4to5: number;
      t6to8: number;
      t9to11: number;
      t12Plus: number;
    };
    damageProfile: {
      totalRangedDamage: number;
      totalMeleeDamage: number;
      antiTankCapability: 'none' | 'minimal' | 'moderate' | 'strong' | 'exceptional';
      antiInfantryCapability: 'none' | 'minimal' | 'moderate' | 'strong' | 'exceptional';
      rangedVsMeleeRatio: string;
    };
    mobilityProfile: {
      averageMovement: number;
      hasDeepStrike: boolean;
      hasScouts: boolean;
      hasInfiltrate: boolean;
      hasFly: boolean;
      fastUnitsCount: number;
    };
  };
  secondaryRecommendations?: {
    strongSecondaries: Array<{
      name: string;
      reasoning: string;
      expectedScore: string;
    }>;
    avoidSecondaries: Array<{
      name: string;
      reasoning: string;
    }>;
    overallScoringPotential: 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent';
  };
  collectionRecommendations?: Array<{
    unitName: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    alternativeOptions: string[];
  }>;
  threatAssessment?: {
    overallThreatLevel: 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';
    peakThreatPhase: 'deployment' | 'early_game' | 'mid_game' | 'late_game';
    keyThreats: string[];
    counterStrategies: string[];
  };
  
  // Viral insights for shareable content
  viralInsights: ViralInsights;
  
  // Per-unit tactical summaries from AI
  unitTacticalSummaries: Record<string, string>;
  
  // Per-unit role assignments from AI
  unitRoleAssignments: Record<string, { role: TacticalRole; reasoning: string }>;
}

// ============================================
// LIST MODIFICATION SUGGESTIONS
// ============================================

/** A unit being removed or added */
export interface UnitChange {
  name: string;
  points: number;
}

/** An enhancement being added */
export interface EnhancementChange {
  name: string;
  points: number;
  targetCharacter: string;
}

/**
 * A complete, self-contained list modification suggestion.
 * Each suggestion represents ONE option the user can implement to improve their list.
 * All changes within a suggestion are meant to be done together.
 */
export interface ListSuggestion {
  /** Priority ranking: high = addresses critical weakness, medium = significant improvement, low = nice optimization */
  priority: 'high' | 'medium' | 'low';
  /** Short descriptive title (e.g., "Add TWC Leadership", "Upgrade Scoring Units") */
  title: string;
  /** Units to remove from the list */
  removeUnits: UnitChange[];
  /** Units to add to the list */
  addUnits: UnitChange[];
  /** Enhancements to add to characters */
  addEnhancements: EnhancementChange[];
  /** Net points change from this modification (should be between -10 and 0 for optimal lists) */
  pointsDelta: number;
  /** Which strategic weakness this addresses (short phrase) */
  addressesGap: string;
  /** Trade-offs and what the army loses (for expanded details) */
  tradeoffs: string;
  /** Full reasoning explaining why this suggestion improves the list (for expanded details) */
  reasoning: string;
}

// ============================================
// CONTEXT BUILDER FOR AI ANALYSIS
// ============================================

export interface BriefContext {
  // Army identification
  faction: string | null;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  
  // Pre-computed radar scores
  radarScores: RadarScores;
  
  // Capabilities with unit lists
  capabilities: {
    hasDeepStrike: boolean;
    hasScouts: boolean;
    hasInfiltrators: boolean;
    hasPsykers: boolean;
    hasTransports: boolean;
    characterCount: number;
    // Lists of units with each capability
    deepStrikeUnits: string[];
    scoutUnits: string[];
    infiltrateUnits: string[];
    flyUnits: string[];
  };
  
  // MathHammer summary
  damageOutput: {
    vsInfantry: number;
    vsElite: number;
    vsVehicle: number;
    vsMonster: number;
    totalRanged: number;
    totalMelee: number;
  };
  
  // Objective play
  objectivePlay: {
    totalOC: number;
    actionUnitCount: number;
    averageMovement: number;
    totalWounds: number;
  };
  
  // Unit breakdown for detailed analysis
  units: Array<{
    // Core identification
    name: string;
    displayName: string;       // "Wolf Guard Terminators (340pts)" for duplicates
    role: string;
    points: number;
    models: number;
    
    // Core stats
    movement: string;          // "10\"" or "5\""
    toughness: number;
    save: string;
    invulnerableSave: string | null;  // "4+" or null
    wounds: number;
    leadership: number;        // For battle-shock context
    objectiveControl: number;  // Per-model OC
    
    // Keywords
    keywords: string[];
    
    // Damage output (pre-calculated)
    damageVsMEQ: number;
    damageVsVehicle: number;
    threatRating: string;
    
    // Weapons with full stats
    weapons: Array<{
      name: string;
      type: 'ranged' | 'melee';
      range: string;           // "24\"" or "Melee"
      attacks: string;         // "3" or "D6"
      strength: string;
      ap: string;
      damage: string;
      abilities: string[];     // ["LETHAL HITS", "ANTI-INFANTRY 4+"]
      count: number;           // How many models have this weapon
    }>;
    
    // Unit abilities
    abilities: Array<{
      name: string;
      type: string;            // "core", "faction", "unit", "leader"
      description: string;     // Truncated to ~150 chars
      phase: string | null;    // When it triggers
    }>;
    
    // Enhancements
    enhancements: string[];    // ["Skjald's Foretelling"]
    
    // Leader rules (who this character can attach to)
    leaderRules: string | null; // e.g., "Blood Claws; Grey Hunters; Wolf Guard Headtakers"
    leaderAbilities: string | null; // Abilities granted when leading
    
    // Composition for complex units (null for simple units)
    composition: Array<{
      modelType: string;       // "Pack Leader", "Wolf Guard Terminator"
      role: string;            // "leader", "sergeant", "heavy_weapon", "regular"
      count: number;
      keyWeapons: string[];    // Notable weapons for this model type
    }> | null;
    
    // Competitive context from community sources (optional)
    competitiveContext?: {
      competitiveTier: string | null;
      tierReasoning: string | null;
      bestTargets: string | null;  // JSON array string
      counters: string | null;     // JSON array string
      synergies: string | null;    // JSON array string
      playstyleNotes: string | null;
      deploymentTips: string | null;
      competitiveNotes: string | null;
      // Additional fields from UnitCompetitiveContext
      avoidTargets: string | null;    // JSON array string - what to avoid engaging
      phasePriority: string | null;   // JSON: {"Movement": "high", "Shooting": "medium", "Fight": "high"}
      pointsEfficiency: string | null; // "overcosted", "efficient", "undercosted", "meta-dependent"
    };
  }>;

  // Faction-level competitive context (optional)
  factionContext?: {
    metaTier: string | null;
    metaPosition: string | null;
    playstyleArchetype: string | null;
    strengths: string | null;       // JSON array string
    weaknesses: string | null;      // JSON array string
    favorableMatchups: string | null;   // JSON array string
    unfavorableMatchups: string | null; // JSON array string
    recommendedDetachments: string | null; // JSON array string
    mustTakeUnits: string | null;   // JSON array string
    avoidUnits: string | null;      // JSON array string
    sleepHitUnits: string | null;   // JSON array string
  };
}

/**
 * Build context object for AI strategic analysis
 */
export function buildBriefContext(
  parsedArmy: ParsedArmyList,
  localAnalysis: BriefAnalysis
): BriefContext {
  // Keywords that grant deployment abilities
  const DEEP_STRIKE_KEYWORDS = ['TERMINATOR', 'JUMP PACK', 'TELEPORT HOMER', 'DAEMON', 'DEEP STRIKE', 'TELEPORT', 'DROP POD'];
  const SCOUTS_KEYWORDS = ['SCOUTS', 'SCOUT'];
  const INFILTRATE_KEYWORDS = ['INFILTRATORS', 'INFILTRATE', 'PHOBOS'];
  const FLY_KEYWORDS = ['FLY', 'AIRCRAFT'];
  
  // Compute which units have which deployment capabilities
  const deepStrikeUnits: string[] = [];
  const scoutUnits: string[] = [];
  const infiltrateUnits: string[] = [];
  const flyUnits: string[] = [];
  
  for (const unit of parsedArmy.units) {
    const keywords = unit.keywords || [];
    const upperKeywords = keywords.map(k => k.toUpperCase());
    
    // Check keywords for capabilities
    const hasDeepStrikeKeyword = DEEP_STRIKE_KEYWORDS.some(dsk => 
      upperKeywords.some(uk => uk === dsk || uk.includes(dsk))
    );
    const hasScoutsKeyword = SCOUTS_KEYWORDS.some(sk => 
      upperKeywords.some(uk => uk === sk || uk.includes(sk))
    );
    const hasInfiltrateKeyword = INFILTRATE_KEYWORDS.some(ik => 
      upperKeywords.some(uk => uk === ik || uk.includes(ik))
    );
    const hasFlyKeyword = FLY_KEYWORDS.some(fk => 
      upperKeywords.some(uk => uk === fk || uk.includes(fk))
    );
    
    // Also check abilities
    const abilities = unit.abilities || [];
    let hasDeepStrikeAbility = false;
    let hasScoutsAbility = false;
    let hasInfiltrateAbility = false;
    
    for (const ability of abilities) {
      const abilityName = ability.name?.toUpperCase() || '';
      const abilityDesc = ability.description?.toUpperCase() || '';
      
      if (abilityName.includes('DEEP STRIKE') || abilityDesc.includes('DEEP STRIKE') ||
          abilityDesc.includes('SET UP IN RESERVE') || abilityDesc.includes('ARRIVE FROM RESERVE')) {
        hasDeepStrikeAbility = true;
      }
      if (abilityName.includes('SCOUT') || abilityDesc.includes('SCOUT')) {
        hasScoutsAbility = true;
      }
      if (abilityName.includes('INFILTRAT') || abilityDesc.includes('INFILTRAT') ||
          abilityDesc.includes('SET UP ANYWHERE ON THE BATTLEFIELD')) {
        hasInfiltrateAbility = true;
      }
    }
    
    if (hasDeepStrikeKeyword || hasDeepStrikeAbility) deepStrikeUnits.push(unit.name);
    if (hasScoutsKeyword || hasScoutsAbility) scoutUnits.push(unit.name);
    if (hasInfiltrateKeyword || hasInfiltrateAbility) infiltrateUnits.push(unit.name);
    if (hasFlyKeyword) flyUnits.push(unit.name);
  }
  
  // Generate unique displayNames for all units (handles duplicates with same name AND points)
  const displayNames = generateUniqueDisplayNames(parsedArmy.units);

  // Build unit breakdown with enriched data
  const units = parsedArmy.units.map((unit, index) => {
    const ds = unit.parsedDatasheet;
    const damageProfile = localAnalysis.mathHammer.unitDamageProfiles[index];
    const displayName = displayNames[index];
    
    // Build weapons array with full stats
    const weapons = (unit.weapons || []).map(w => {
      const isMelee = w.type?.toLowerCase().includes('melee') || 
                      w.range === 'Melee' || 
                      w.weaponSkill;
      return {
        name: w.name,
        type: (isMelee ? 'melee' : 'ranged') as 'ranged' | 'melee',
        range: w.range || 'Melee',
        attacks: w.attacks || '1',
        strength: w.strength || '4',
        ap: w.armorPenetration || '0',
        damage: w.damage || '1',
        abilities: w.abilities || [],
        count: unit.modelCount, // Simplified - could be refined with composition data
      };
    });
    
    // Build abilities array with full descriptions for AI analysis
    const abilities = (unit.abilities || []).map(a => ({
      name: a.name,
      type: a.type || 'unit',
      description: a.description || '',
      phase: a.phase || null,
    }));
    
    // Build composition for complex units (multiple model types)
    const composition = unit.composition && unit.composition.length > 1
      ? unit.composition.map(c => ({
          modelType: c.modelType,
          role: c.role,
          count: c.count,
          keyWeapons: c.weapons.slice(0, 3), // Top 3 weapons
        }))
      : null;
    
    return {
      // Core identification
      name: unit.name,
      displayName,
      role: ds?.role || 'Unknown',
      points: unit.pointsCost,
      models: unit.modelCount,
      
      // Core stats
      movement: ds?.movement || '6"',
      toughness: ds?.toughness || 4,
      save: ds?.save || '4+',
      invulnerableSave: ds?.invulnerableSave || null,
      wounds: (ds?.wounds || 1) * unit.modelCount,
      leadership: ds?.leadership || 6,
      objectiveControl: ds?.objectiveControl || 1,
      
      // Keywords
      keywords: unit.keywords || [],
      
      // Damage output
      damageVsMEQ: damageProfile 
        ? damageProfile.rangedDamageVsMEQ + damageProfile.meleeDamageVsMEQ 
        : 0,
      damageVsVehicle: damageProfile 
        ? damageProfile.rangedDamageVsVehicle + damageProfile.meleeDamageVsVehicle 
        : 0,
      threatRating: damageProfile?.threatRating || 'low',
      
      // Weapons, abilities, enhancements, composition
      weapons,
      abilities,
      enhancements: unit.enhancements || [],
      
      // Leader rules (who this character can attach to)
      leaderRules: ds?.leaderRules || null,
      leaderAbilities: ds?.leaderAbilities || null,
      
      // Competitive context from community sources (if available)
      competitiveContext: (ds as any)?.competitiveContext || undefined,
      
      composition,
    };
  });
  
  return {
    faction: localAnalysis.faction,
    detachment: localAnalysis.detachment,
    totalPoints: localAnalysis.totalPoints,
    unitCount: localAnalysis.unitCount,
    modelCount: localAnalysis.modelCount,
    radarScores: localAnalysis.radarScores,
    capabilities: {
      hasDeepStrike: deepStrikeUnits.length > 0,
      hasScouts: scoutUnits.length > 0,
      hasInfiltrators: infiltrateUnits.length > 0,
      hasPsykers: localAnalysis.metaContext.hasPsykers,
      hasTransports: localAnalysis.metaContext.hasTransports,
      characterCount: localAnalysis.metaContext.characterCount,
      deepStrikeUnits,
      scoutUnits,
      infiltrateUnits,
      flyUnits,
    },
    damageOutput: {
      vsInfantry: localAnalysis.mathHammer?.damageVsInfantry ?? 0,
      vsElite: localAnalysis.mathHammer?.damageVsElite ?? 0,
      vsVehicle: localAnalysis.mathHammer?.damageVsVehicle ?? 0,
      vsMonster: localAnalysis.mathHammer?.damageVsMonster ?? 0,
      totalRanged: localAnalysis.mathHammer?.totalRangedDamage ?? 0,
      totalMelee: localAnalysis.mathHammer?.totalMeleeDamage ?? 0,
    },
    objectivePlay: {
      totalOC: localAnalysis.objectiveEcology.totalOC,
      actionUnitCount: localAnalysis.objectiveEcology.actionUnitCount,
      averageMovement: localAnalysis.objectiveEcology.averageMovement,
      totalWounds: localAnalysis.objectiveEcology.totalWounds,
    },
    units,
  };
}

// ============================================
// PROMPT BUILDERS FOR AI ANALYSIS
// ============================================

/**
 * Build system prompt for strategic army analysis
 * Optimized for Gemini 3 Pro: concise, direct instructions
 */
export function buildBriefSystemPrompt(): string {
  return `You are an expert Warhammer 40,000 10th Edition strategic analyst. Analyze army lists to help players understand what makes THEIR SPECIFIC LIST unique - not generic faction advice.

## Core Principle: LIST-SPECIFIC Analysis
Generic faction advice is NOT valuable - the player already knows their faction rules. Your job is to identify what makes THIS PARTICULAR LIST different from other lists using the same faction/detachment.

## Stat Check Awareness
When analyzing matchups, identify BINARY PASS/FAIL thresholds:
- "Can you kill their toughest model in one turn?" (Knights T12/20W, C'tan with halve damage, Avatar)
- "Can they kill YOUR toughest model in one turn?"
- If halve-damage or damage reduction exists, note that D6 weapons become effectively D3 weapons
- If the opponent has universal invuln saves (Custodes 4++), note that AP becomes less valuable

Include stat check conclusions in your reasoning when relevant. Example:
"Their Avatar halves damage, making your Lascannons deal avg 2 damage instead of 4. You need 6+ successful wound rolls to kill it. Switch to volume fire or accept attrition."

## Resource Economy
Identify the opponent archetype's LIMITING RESOURCE and advise how to deplete it:
- Aeldari: Fate Dice (finite pool - bait them on chaff before committing your key units)
- Thousand Sons: Cabal Points (kill Characters early to reduce generation)
- Sisters: Miracle Dice (generated on kills - deny them easy sacrificial units)
- Necrons: Reanimation (don't split fire - overkill units completely or they heal back)
- All armies: CP (bait defensive strats like Armour of Contempt on low-value targets first)

In your battle plan, name the resource if relevant to depleting their efficiency.

## CRITICAL RULE: One Leader Per Unit
In 10th Edition, each unit can only have ONE leader attached. NEVER suggest attaching multiple leaders (like "Logan AND Arjac") to the same unit - this creates an ILLEGAL army. When a list has multiple leaders and multiple eligible units, distribute them: one leader per unit.

## Identifying What Makes THIS List Unique
Before writing your analysis, identify:
1. What's the single most unusual thing about this composition?
2. What does this list do BETTER than typical lists of this faction?
3. What does this list SACRIFICE compared to typical builds?
4. If you played against this 10 times, what would you learn to fear most?

## Output Requirements

### Strategic Analysis
- Strengths/weaknesses must name SPECIFIC rules, abilities, stratagems AND explain the tactical impact
- Include which units benefit and HOW to exploit tactically
- Weaknesses must include mitigation strategies using THIS army's tools

### Viral Insights (Required)
1. **Tagline**: 2-5 word phrase capturing THIS LIST's identity (not generic faction flavor)
2. **Spirit Description**: One evocative sentence about how THIS LIST plays
3. **4 Army Quirks**: Explain the TACTICAL IMPACT of unit composition choices, not just stats. Each quirk should highlight a different aspect of the army (e.g., durability, damage output, mobility, board control).

   ### Quirk Quality Examples:
   BAD (Stats Only - So What?):
   - "Storm Shields: 21/50 models" ← Meaningless without tactical impact
   - "Deep Strike Units: 4 units" ← Just a count, no insight

   GOOD (Tactical Impact):
   - "AP Tax: 21 storm shields mean opponent's melta/plasma perform like bolters against your core"
   - "Reserve Overload: 725pts threaten Turn 1-2 arrival, forcing defensive deployment OR accept casualties"
   - "OC Desert: Only 5 models have reliable OC - you MUST kill to win, can't just hold"

   FORMAT REQUIREMENTS:
   - Name: SHORT (aim <= 18 chars), Title Case, no emoji, no punctuation
   - Value: SHORT (aim <= 12 chars). Prefer numbers/ratios/percents/points
   - Description: SHORT (aim <= 140 chars), 1 sentence explaining WHY this matters tactically

4. **Army Spirit Icon Prompt**: Detailed grimdark comic book style icon description with faction colors

### Leader Attachment Rules (CRITICAL - 10th Edition)
In Warhammer 40K 10th Edition:
- Each unit can only have ONE leader attached (with rare exceptions)
- Each leader character can only attach to specific unit types (shown in "CAN LEAD" rules)
- When suggesting leader attachments, you MUST ensure each leader goes to a DIFFERENT unit
- If there are 2 characters and 2 eligible units, assign one character to each unit
- NEVER suggest attaching multiple leaders to the same unit unless explicitly allowed by rules

### Unit Tactical Summaries
For EVERY unit, provide a unique tactical summary explaining HOW to use it.

CRITICAL: When the same datasheet appears multiple times at different sizes/points:
- Identify which squad is the PRIMARY threat (larger, has character attached)
- Identify secondary squads and their DIFFERENT role (flanking, objective grab, reserves)
- Reference the SPECIFIC leader attachment - ensure each leader goes to a DIFFERENT unit

### BAD (Multiple leaders to same unit - ILLEGAL IN 10TH EDITION):
- "Wolf Guard Terminators (340pts): Attach Logan Grimnar and Arjac Rockfist here. This is your primary win condition."
  WHY ILLEGAL: You cannot attach 2 leaders to the same unit. This advice would result in an illegal army.

### GOOD (One leader per unit - LEGAL):
- "Wolf Guard Terminators (340pts): ARJAC'S BRICK - His Fight on Death triggers on every model, making this 30W anvil deadly even when dying. Deploy on board to threaten the center."
- "Wolf Guard Terminators (170pts): LOGAN'S RESERVES - Use his Chapter Master Turn 1 reserves ability. Drop this flanking squad on a vulnerable objective while the main brick holds the center."

### Matchup Considerations (REQUIRED - ALL 8 ARCHETYPES)
You MUST provide analysis for ALL 8 opponent archetypes:
- horde_armies (Orks, Tyranids, Guard infantry spam)
- elite_armies (Custodes, Knights, Deathwing)
- vehicle_spam (Guard tanks, Ad Mech, Knights)
- monster_mash (Tyranid monsters, Chaos Daemon engines)
- skirmish_msu (Drukhari, Aeldari, fast multiple small units)
- melee_rush (World Eaters, Blood Angels, Orks)
- gunline (Tau, Guard artillery, Iron Hands)
- attrition (Death Guard, Necrons, durable grind armies)

For EACH matchup, provide:
1. **Rating**: Be honest - not every matchup is "even". If this list struggles against hordes, say "unfavorable"
2. **Win Condition**: What is your MACRO strategy against this archetype? Choose one:
   - outscore: You can't kill them efficiently; focus on Primary/Secondary scoring
   - tabling: You can mathematically remove their army
   - attrition: Grind them down over 5 turns, trading efficiently
   - alpha_strike: Cripple them T1-2 before they can respond
   - denial: Prevent their win condition (kill their scoring, screen their deep strike)
3. **Battle Plan**: One sentence combining: what you must kill/do, WHEN to do it (turn/phase), and their resource to deplete if applicable
4. **Reasoning**: Explain WHY using THIS LIST's specific units and weaknesses (include stat check awareness if relevant)
5. **Key Tips**: 3-4 actionable tips covering different game phases:
   - DEPLOYMENT: Where to position, what to reserve
   - EARLY GAME (T1-2): Screening, bait plays, resource denial
   - COMMITMENT (T2-3): When to drop reserves, commit charges
   - TARGET PRIORITY: What to kill first and why
   Each tip should specify WHEN (turn/phase) not just WHAT.

### BAD Matchup Analysis (Generic):
"Against vehicle spam, use your anti-tank units to destroy their vehicles."
WHY BAD: No win condition, no timing, no stat check, no resource consideration. Applies to any army.

### GOOD Matchup Analysis (Specific):
winCondition: "denial"
battlePlan: "Screen their T2 deep strike zones, then focus-fire Characters to strip buffs. Outscore them 3-2 on Primary."
reasoning: "FAVORABLE. Their Knights stat-check most lists, but your 20 Thunder Hammers (S12, AP-2, D3) deal avg 14 damage per charge phase - enough to bracket a Knight. If they halve damage (Rotate Ion Shields), switch to volume attacks. The risk: if they screen with Armigers, your hammers get stuck."
keyTips: [
  "DEPLOYMENT: Castle Terminators mid-board behind Obscuring. Reserve TWC for T2 flank.",
  "T1: Screen 9 inches from board edges with Intercessors to deny Rapid Ingress slots.",
  "T2-3: Drop TWC on backfield objectives. Charge screening Armigers to clear paths.",
  "PRIORITY: Kill Armigers first to expose big Knights. Focus one Knight at a time - no split fire."
]
WHY GOOD: Names win condition, timing, stat check awareness, specific unit counts/abilities, phased tips, and counter-play risk.

### Role Assignments
Assign roles based on actual battlefield purpose: hammer, anvil, scoring, screening, support, skirmisher, utility, specialist

Provide analysis in the exact JSON schema format specified.`;
}

/** Minimal datasheet info for available units list */
interface AvailableDatasheet {
  name: string;
  role: string;
  keywords: string;
}

/**
 * Format available datasheets for the strategic analysis prompt
 * Groups by role for easier scanning, shows keywords for leader eligibility
 */
function formatAvailableUnitsForStrategicAnalysis(datasheets: AvailableDatasheet[]): string {
  // Group by role
  const byRole = new Map<string, AvailableDatasheet[]>();
  for (const ds of datasheets) {
    const role = ds.role || 'Other';
    if (!byRole.has(role)) {
      byRole.set(role, []);
    }
    byRole.get(role)!.push(ds);
  }

  const lines: string[] = [];

  // Sort roles for consistent output
  const sortedRoles = Array.from(byRole.keys()).sort();

  for (const role of sortedRoles) {
    const units = byRole.get(role)!;
    lines.push(`### ${role}`);
    for (const unit of units) {
      // Check if it's a character (can lead others) or can be led
      const isCharacter = unit.keywords.toUpperCase().includes('CHARACTER');
      const marker = isCharacter ? '★' : '-';
      lines.push(`${marker} ${unit.name}`);
    }
    lines.push('');
  }

  lines.push('★ = Character (can lead units)');

  return lines.join('\n');
}

/**
 * Build user prompt with role-grouped army context and engagement scenarios
 * @param context - The brief context with army composition
 * @param detachmentRulesPrompt - Optional formatted string with detachment rules, stratagems, enhancements
 * @param availableDatasheets - Optional list of all faction datasheets for accurate collection recommendations
 */
export function buildBriefUserPrompt(
  context: BriefContext,
  detachmentRulesPrompt?: string,
  availableDatasheets?: AvailableDatasheet[]
): string {
  // Helper to safely format numbers (handles null, undefined, NaN)
  const safeNum = (val: number | null | undefined, decimals: number = 1): string => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return val.toFixed(decimals);
  };
  
  // Format a single unit as an enriched card with full tactical data
  const formatUnitCard = (u: BriefContext['units'][0]): string => {
    const lines: string[] = [];
    
    // Header with displayName and model count
    lines.push(`### ${u.displayName} - ${u.models} model${u.models > 1 ? 's' : ''}`);
    
    // Stats line: M | T | Save/Invuln | W | OC | Ld
    const saveStr = u.invulnerableSave ? `${u.save}/${u.invulnerableSave}` : u.save;
    lines.push(`Stats: M${u.movement} | T${u.toughness} | ${saveStr} | W${u.wounds} | OC${u.objectiveControl} | Ld${u.leadership}`);
    
    // Weapons (group by name, show stats and abilities)
    if (u.weapons.length > 0) {
      lines.push('Weapons:');
      for (const w of u.weapons) {
        const abilitiesStr = w.abilities.length > 0 ? `, ${w.abilities.join(', ')}` : '';
        const rangeStr = w.type === 'melee' ? 'Melee' : w.range;
        lines.push(`  - ${w.name} (${rangeStr}, A${w.attacks}, S${w.strength}, AP${w.ap}, D${w.damage}${abilitiesStr})`);
      }
    }
    
    // Enhancements (important for tactical advice)
    if (u.enhancements.length > 0) {
      lines.push(`Enhancements: ${u.enhancements.join(', ')}`);
    }
    
    // Key abilities
    if (u.abilities.length > 0) {
      const abilityNames = u.abilities.map(a => a.name).slice(0, 5);
      lines.push(`Abilities: ${abilityNames.join(', ')}`);
    }
    
    // Leader rules (CRITICAL: tells AI which units this character can actually attach to)
    if (u.leaderRules) {
      lines.push(`CAN LEAD: ${u.leaderRules}`);
    }
    if (u.leaderAbilities) {
      lines.push(`Leader bonus: ${u.leaderAbilities}`);
    }
    
    // Competitive context from community sources (condensed to essentials)
    if (u.competitiveContext) {
      const ctx = u.competitiveContext;

      // Helper to parse JSON arrays safely
      const parseJsonArray = (json: string | null): string[] => {
        if (!json) return [];
        try {
          const parsed = JSON.parse(json);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return json ? [json] : [];
        }
      };

      // Condensed tier info: "Tier: S - [brief reason]"
      if (ctx.competitiveTier) {
        const briefReason = ctx.tierReasoning
          ? ctx.tierReasoning.split('.')[0] // Take first sentence only
          : '';
        lines.push(`Tier: ${ctx.competitiveTier}${briefReason ? ` - ${briefReason}` : ''}`);
      }

      // Top 2 synergies with full tactical reasoning
      const synergiesRaw = parseJsonArray(ctx.synergies) as (string | { unit: string; why: string })[];
      if (synergiesRaw.length > 0) {
        const firstItem = synergiesRaw[0];
        const isStructured = firstItem && typeof firstItem === 'object' && 'unit' in firstItem;
        if (isStructured) {
          const topSynergies = synergiesRaw
            .filter((s): s is { unit: string; why: string } => typeof s === 'object' && s !== null && 'unit' in s)
            .slice(0, 2)
            .map(s => `${s.unit}: ${s.why}`);
          if (topSynergies.length > 0) {
            lines.push(`Synergies:\n${topSynergies.map(s => `  - ${s}`).join('\n')}`);
          }
        } else {
          const topSynergies = (synergiesRaw as string[]).slice(0, 2);
          if (topSynergies.length > 0) {
            lines.push(`Key Synergies: ${topSynergies.join(', ')}`);
          }
        }
      }

      // Condensed targeting info (top 2 each)
      const bestTargets = parseJsonArray(ctx.bestTargets).slice(0, 2);
      if (bestTargets.length > 0) {
        lines.push(`Best vs: ${bestTargets.join(', ')}`);
      }

      const counters = parseJsonArray(ctx.counters).slice(0, 2);
      if (counters.length > 0) {
        lines.push(`Weak vs: ${counters.join(', ')}`);
      }

      // Keep actionable tactical guidance (valuable for AI analysis)
      if (ctx.playstyleNotes) {
        lines.push(`Playstyle: ${ctx.playstyleNotes}`);
      }

      if (ctx.competitiveNotes) {
        lines.push(`Competitive Notes: ${ctx.competitiveNotes}`);
      }
    }
    
    // Qualitative weapon assessment (no damage numbers - let AI infer from profiles)
    const hasAntiArmor = u.weapons.some(w => 
      parseInt(w.strength) >= 8 || 
      w.abilities.some(a => a.toUpperCase().includes('MELTA') || a.toUpperCase().includes('LANCE'))
    );
    const hasHighAP = u.weapons.some(w => Math.abs(parseInt(w.ap)) >= 3);
    const hasAntiHorde = u.weapons.some(w => 
      w.abilities.some(a => a.toUpperCase().includes('BLAST') || a.toUpperCase().includes('TORRENT'))
    );
    const hasLethalAbilities = u.weapons.some(w =>
      w.abilities.some(a => 
        a.toUpperCase().includes('LETHAL') || 
        a.toUpperCase().includes('DEVASTATING') ||
        a.toUpperCase().includes('SUSTAINED')
      )
    );
    
    const loadoutTags: string[] = [];
    if (hasAntiArmor && hasHighAP) loadoutTags.push('anti-armor');
    else if (hasAntiArmor) loadoutTags.push('anti-elite');
    if (hasAntiHorde) loadoutTags.push('anti-horde');
    if (hasLethalAbilities) loadoutTags.push('force multiplier weapons');
    
    if (loadoutTags.length > 0) {
      lines.push(`Loadout focus: ${loadoutTags.join(', ')}`);
    }
    
    return lines.join('\n');
  };
  
  // Format role section with enriched unit cards
  const formatRoleSection = (
    roleName: string, 
    units: BriefContext['units'], 
    roleDescription: string
  ): string => {
    if (units.length === 0) return '';
    
    const totalPoints = units.reduce((sum, u) => sum + u.points, 0);
    const unitCards = units.map(u => formatUnitCard(u)).join('\n\n');
    
    return `## ${roleName.toUpperCase()} (${units.length} units, ${totalPoints} pts)
${roleDescription}

${unitCards}
`;
  };

  // Helper to format JSON array strings safely
  const formatJsonArrayString = (json: string | null | undefined): string[] => {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return json ? [json] : [];
    }
  };

  // Format faction-level competitive context section
  const formatFactionContext = (factionCtx: BriefContext['factionContext']): string => {
    if (!factionCtx) return '';

    const lines: string[] = ['## FACTION META CONTEXT'];
    lines.push(`Use this competitive intelligence about ${context.faction} to inform your analysis:\n`);

    if (factionCtx.metaTier || factionCtx.metaPosition) {
      const tier = factionCtx.metaTier ? `${factionCtx.metaTier}-tier` : '';
      const position = factionCtx.metaPosition || '';
      lines.push(`- **Meta Position:** ${[tier, position].filter(Boolean).join(' - ')}`);
    }

    if (factionCtx.playstyleArchetype) {
      lines.push(`- **Faction Playstyle:** ${factionCtx.playstyleArchetype}`);
    }

    const strengths = formatJsonArrayString(factionCtx.strengths);
    if (strengths.length > 0) {
      lines.push(`- **Faction Strengths:** ${strengths.join(', ')}`);
    }

    const weaknesses = formatJsonArrayString(factionCtx.weaknesses);
    if (weaknesses.length > 0) {
      lines.push(`- **Faction Weaknesses:** ${weaknesses.join(', ')}`);
    }

    const favorable = formatJsonArrayString(factionCtx.favorableMatchups);
    if (favorable.length > 0) {
      lines.push(`- **Good Matchups:** ${favorable.join(', ')}`);
    }

    const unfavorable = formatJsonArrayString(factionCtx.unfavorableMatchups);
    if (unfavorable.length > 0) {
      lines.push(`- **Bad Matchups:** ${unfavorable.join(', ')}`);
    }

    const mustTake = formatJsonArrayString(factionCtx.mustTakeUnits);
    if (mustTake.length > 0) {
      lines.push(`- **Must-Take Units:** ${mustTake.join(', ')}`);
    }

    const avoid = formatJsonArrayString(factionCtx.avoidUnits);
    if (avoid.length > 0) {
      lines.push(`- **Trap/Avoid Units:** ${avoid.join(', ')}`);
    }

    const sleepers = formatJsonArrayString(factionCtx.sleepHitUnits);
    if (sleepers.length > 0) {
      lines.push(`- **Sleeper Hits:** ${sleepers.join(', ')}`);
    }

    // Only return content if we have more than just the header
    if (lines.length <= 2) return '';

    return lines.join('\n') + '\n\n';
  };

  // Categorize units by tactical role based on their stats
  const hammers = context.units.filter(u => {
    const totalDmg = u.damageVsMEQ + u.damageVsVehicle;
    return totalDmg > 15 || u.damageVsVehicle > 8;
  });
  
  const anvils = context.units.filter(u => {
    const totalDmg = u.damageVsMEQ + u.damageVsVehicle;
    return u.wounds > 10 && totalDmg <= 15 && totalDmg > 5;
  });
  
  const skirmishers = context.units.filter(u => {
    const keywords = u.keywords.map(k => k.toUpperCase());
    const isMobile = keywords.includes('FLY') || keywords.includes('JUMP PACK') || keywords.includes('MOUNTED');
    const totalDmg = u.damageVsMEQ + u.damageVsVehicle;
    return isMobile && totalDmg > 5 && totalDmg <= 20;
  });
  
  const support = context.units.filter(u => {
    const keywords = u.keywords.map(k => k.toUpperCase());
    const totalDmg = u.damageVsMEQ + u.damageVsVehicle;
    return keywords.includes('CHARACTER') && totalDmg < 10;
  });
  
  const scoring = context.units.filter(u => {
    const keywords = u.keywords.map(k => k.toUpperCase());
    const totalDmg = u.damageVsMEQ + u.damageVsVehicle;
    return (keywords.includes('BATTLELINE') || keywords.includes('INFANTRY')) && 
           totalDmg < 10 && 
           !keywords.includes('CHARACTER');
  });
  
  // Units not in other categories become screening/flex (use displayName for uniqueness)
  const assignedUnits = new Set([
    ...hammers.map(u => u.displayName),
    ...anvils.map(u => u.displayName),
    ...skirmishers.map(u => u.displayName),
    ...support.map(u => u.displayName),
    ...scoring.map(u => u.displayName),
  ]);
  const screening = context.units.filter(u => !assignedUnits.has(u.displayName));
  
  // Build role sections with enriched unit cards
  const roleSection = [
    formatRoleSection('Hammers', hammers, 'Primary damage dealers - units meant to eliminate enemy threats'),
    formatRoleSection('Anvils', anvils, 'Durable holders - units that anchor positions and absorb damage'),
    formatRoleSection('Skirmishers', skirmishers, 'Mobile harassment - units that threaten flanks and pick off weak targets'),
    formatRoleSection('Support', support, 'Force multipliers - characters that buff other units'),
    formatRoleSection('Scoring', scoring, 'Objective holders - units for actions and holding ground'),
    formatRoleSection('Screening', screening, 'Flexible/utility - remaining units for various roles'),
  ].filter(s => s).join('\n');
  
  // Identify gaps in army composition (qualitative assessment)
  const gaps: string[] = [];
  if (hammers.length === 0) gaps.push('No dedicated damage dealers');
  if (anvils.length === 0 && context.objectivePlay.totalWounds < 80) gaps.push('Low durability for holding objectives');
  if (scoring.length < 2) gaps.push('Limited objective-holding units');
  if (!context.capabilities.hasDeepStrike && !context.capabilities.hasInfiltrators) {
    gaps.push('No deployment flexibility (no Deep Strike or Infiltrate)');
  }
  // Check for anti-armor capability based on weapon profiles, not damage calcs
  const hasAntiArmorWeapons = context.units.some(u => 
    u.weapons.some(w => 
      parseInt(w.strength) >= 8 || 
      w.abilities.some(a => a.toUpperCase().includes('MELTA') || a.toUpperCase().includes('LANCE'))
    )
  );
  if (!hasAntiArmorWeapons) {
    gaps.push('Limited anti-armor capability (no high-strength or melta weapons)');
  }
  
  return `Analyze this Warhammer 40K 10th Edition army list with a focus on TACTICAL ROLES and REALISTIC GAMEPLAY.

## ARMY OVERVIEW
- **Faction:** ${context.faction || 'Unknown'}
- **Detachment:** ${context.detachment || 'Unknown'}
- **Total Points:** ${context.totalPoints}
- **Units:** ${context.unitCount} | **Models:** ${context.modelCount}

## RADAR SCORES (0-100 scale)
- Killing Power: ${context.radarScores.killingPower}
- Durability: ${context.radarScores.durability}
- Mobility: ${context.radarScores.mobility}
- Board Control: ${context.radarScores.boardControl}
- Flexibility: ${context.radarScores.flexibility}

## DEPLOYMENT OPTIONS
- Deep Strike: ${context.capabilities.hasDeepStrike ? `YES (${context.capabilities.deepStrikeUnits.join(', ')})` : 'NO'}
- Infiltrate: ${context.capabilities.hasInfiltrators ? `YES (${context.capabilities.infiltrateUnits.join(', ')})` : 'NO'}
- FLY units: ${context.capabilities.flyUnits.length > 0 ? context.capabilities.flyUnits.join(', ') : 'None'}

${formatFactionContext(context.factionContext)}${detachmentRulesPrompt ? `${detachmentRulesPrompt}\n` : ''}## DETACHMENT-SPECIFIC ANALYSIS REQUIRED

For the **${context.detachment || 'Unknown'}** detachment, your analysis MUST address:

1. **Detachment Ability Sequencing**: If the detachment has turn-by-turn choices (like Hunting Packs, Combat Doctrines, etc.), explain WHICH option to use in WHICH turn and WHY based on this army's composition.

2. **Key Character Abilities**: If special characters are present (Logan Grimnar, Guilliman, etc.), explain when to use their unique abilities for maximum impact.

3. **Stratagem Priority**: From the available stratagems, identify the 2-3 MOST IMPORTANT ones for this specific army and explain WHEN to use them (save CP for X when Y happens).

4. **Enhancement Synergies**: Reference the equipped enhancements by name and explain how they change target priority or tactical options.

## ARMY COMPOSITION BY TACTICAL ROLE
Note: Not all units will deal damage every turn. Roles indicate how each unit should be used.

${roleSection}

## IDENTIFIED GAPS
${gaps.length > 0 ? gaps.map(g => `- ${g}`).join('\n') : '- Army appears well-rounded'}

## OBJECTIVE PLAY CAPACITY
- Total OC: ${context.objectivePlay.totalOC ?? 0}
- Action Units: ${context.objectivePlay.actionUnitCount ?? 0}
- Average Movement: ${safeNum(context.objectivePlay.averageMovement, 0)}"

## ALL UNIT IDENTIFIERS (for tactical summaries and role assignments)
Use these exact names when referencing units in your analysis:
${context.units.map(u => `- ${u.displayName}`).join('\n')}

---

## ANALYSIS REQUIREMENTS

Provide your strategic analysis in JSON format. CRITICAL: Make every section specific to THIS list, not generic faction advice.

**Army Quirks (4 required)**: Discover the 4 most interesting/unusual aspects of THIS specific list composition. Each quirk must explain TACTICAL IMPACT, not just state a statistic. Cover different aspects: durability, damage output, mobility, board control.

**Unit Tactical Summaries**: For EVERY unit, provide a UNIQUE tactical summary. If the same datasheet appears multiple times (e.g., 2 Terminator squads), each MUST have different advice reflecting their different roles (primary hammer vs flanking unit, etc.).

**Unit Role Assignments**: Assign roles based on actual battlefield purpose, considering squad size and likely leader attachments.

Focus on what would surprise someone who hasn't seen this exact list.`;
}

