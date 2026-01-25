// Game phase types
export type GamePhase = 'Command' | 'Movement' | 'Shooting' | 'Charge' | 'Fight';

// Army Parsing Types
export interface ParsedWeapon {
  weaponId: string | null; // ID from Weapon table (null if not matched)
  name: string;
  range?: string;
  type?: string;
  attacks?: string;
  ballisticSkill?: string;
  weaponSkill?: string;
  strength?: string;
  armorPenetration?: string;
  damage?: string;
  abilities?: string[]; // Array of weapon ability strings
  matchConfidence: number; // 0-1
  needsReview: boolean;
}

export interface ParsedAbility {
  abilityId: string | null; // ID from Ability table (null if not matched)
  name: string;
  type?: string; // "core", "faction", "unit", "leader", "wargear"
  description?: string;
  phase?: string;
  matchConfidence: number; // 0-1
  needsReview: boolean;
}

export interface ParsedDatasheet {
  datasheetId: string | null; // ID from Datasheet table (null if not matched)
  name: string;
  factionId?: string | null;
  faction?: string;
  subfaction?: string;
  role?: string;
  keywords?: string[];
  // Stats
  movement?: string;
  toughness?: number;
  save?: string;
  invulnerableSave?: string;
  wounds?: number;
  leadership?: number;
  objectiveControl?: number;
  pointsCost?: number;
  // Leader rules
  leaderRules?: string | null; // Who this character can attach to
  leaderAbilities?: string | null; // Abilities granted when leading
  matchConfidence: number; // 0-1
  needsReview: boolean;
  // Competitive context (enriched from database)
  competitiveContext?: {
    competitiveTier?: string | null;
    tierReasoning?: string | null;
    bestTargets?: string | null;
    counters?: string | null;
    synergies?: string | null;
    playstyleNotes?: string | null;
    deploymentTips?: string | null;
    competitiveNotes?: string | null;
    avoidTargets?: string | null;
    phasePriority?: string | null;
    pointsEfficiency?: string | null;
  };
}

// ============================================
// UNIT COMPOSITION & POINTS TIERS
// ============================================

/**
 * Points tier for simple units where all models are the same type
 * Example: Wolf Guard Terminators (5=170pts, 10=340pts)
 */
export interface SimplePointsTier {
  models: number;
  points: number;
}

/**
 * Points tier for complex units with multiple model types
 * Example: Wolf Guard Headtakers with optional Hunting Wolves
 */
export interface CompositionPointsTier {
  composition: Record<string, number>; // { "Wolf Guard Headtaker": 6, "Hunting Wolf": 6 }
  points: number;
}

/**
 * Add-on model that adds extra points to base cost
 * Example: Outrider Squad with optional Invader ATV (+60pts)
 */
export interface AddOnPointsTier {
  addOn: string;        // Model type name (e.g., "Invader ATV")
  addOnPoints: number;  // Additional points cost
}

/**
 * Union type for points tiers - supports simple, composition-based, and add-on
 */
export type PointsTier = SimplePointsTier | CompositionPointsTier | AddOnPointsTier;

/**
 * Type guard to check if a tier is composition-based
 */
export function isCompositionTier(tier: PointsTier): tier is CompositionPointsTier {
  return 'composition' in tier;
}

/**
 * Type guard to check if a tier is an add-on
 */
export function isAddOnTier(tier: PointsTier): tier is AddOnPointsTier {
  return 'addOn' in tier;
}

/**
 * Check if two compositions match exactly
 */
export function compositionMatches(
  tierComposition: Record<string, number>,
  unitComposition: Record<string, number>
): boolean {
  const tierKeys = Object.keys(tierComposition);
  const unitKeys = Object.keys(unitComposition);
  
  // Must have same number of model types (accounting for zero counts)
  const nonZeroTierKeys = tierKeys.filter(k => tierComposition[k] > 0);
  const nonZeroUnitKeys = unitKeys.filter(k => unitComposition[k] > 0);
  
  if (nonZeroTierKeys.length !== nonZeroUnitKeys.length) {
    return false;
  }
  
  // All non-zero counts must match
  for (const key of nonZeroTierKeys) {
    if (tierComposition[key] !== unitComposition[key]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate points from points tiers based on unit composition
 */
export function calculatePointsFromTiers(
  pointsTiers: PointsTier[] | null,
  composition: CompositionEntry[],
  basePointsCost: number
): number {
  if (!pointsTiers || pointsTiers.length === 0) {
    return basePointsCost;
  }
  
  // Build composition map from unit
  const compMap: Record<string, number> = {};
  for (const entry of composition) {
    compMap[entry.modelType] = (compMap[entry.modelType] || 0) + entry.count;
  }
  
  let basePoints = 0;
  let addOnPoints = 0;
  
  // Try composition-based match first
  for (const tier of pointsTiers) {
    if (isCompositionTier(tier) && compositionMatches(tier.composition, compMap)) {
      basePoints = tier.points;
      break;
    }
  }
  
  // If no composition match, try simple model count match
  if (basePoints === 0) {
    // Calculate total models excluding add-on types
    const addOnTypes = pointsTiers
      .filter((t): t is AddOnPointsTier => isAddOnTier(t))
      .map(t => t.addOn);
    
    const coreModelCount = Object.entries(compMap)
      .filter(([type]) => !addOnTypes.includes(type))
      .reduce((sum, [, count]) => sum + count, 0);
    
    // Find matching simple tier
    const simpleTiers = pointsTiers.filter((t): t is SimplePointsTier => 
      !isCompositionTier(t) && !isAddOnTier(t)
    );
    
    const exactMatch = simpleTiers.find(t => t.models === coreModelCount);
    if (exactMatch) {
      basePoints = exactMatch.points;
    } else if (simpleTiers.length > 0) {
      // Find closest tier that doesn't exceed model count
      let applicableTier = simpleTiers[0];
      for (const tier of simpleTiers) {
        if (tier.models <= coreModelCount) {
          applicableTier = tier;
        } else {
          break;
        }
      }
      basePoints = applicableTier.points;
    }
  }
  
  // Calculate add-on points for any add-on models present in composition
  for (const tier of pointsTiers) {
    if (isAddOnTier(tier)) {
      const addOnCount = compMap[tier.addOn] || 0;
      if (addOnCount > 0) {
        addOnPoints += tier.addOnPoints * addOnCount;
      }
    }
  }
  
  return (basePoints || basePointsCost) + addOnPoints;
}

/**
 * Composition entry for parsed army units - tracks model type, count, and loadout
 */
export interface CompositionEntry {
  modelType: string;      // Model type name from datasheet (e.g., "Wolf Guard Headtaker", "Hunting Wolf")
  role: 'leader' | 'sergeant' | 'heavy_weapon' | 'special_weapon' | 'regular';
  count: number;
  weapons: string[];
  woundsPerModel: number;
}

export interface ParsedUnit {
  name: string;
  datasheet: string; // Datasheet name string
  parsedDatasheet: ParsedDatasheet; // Full matched datasheet info
  weapons: ParsedWeapon[]; // Array of matched weapons
  abilities: ParsedAbility[]; // Array of matched abilities
  keywords: string[]; // Array of keyword strings
  pointsCost: number;
  modelCount: number;
  composition: CompositionEntry[]; // Per-model breakdown with model types
  wargear?: string[]; // Legacy: list of wargear strings
  enhancements?: string[]; // List of enhancement strings
  needsReview: boolean; // Overall flag if any component needs review
}

export interface ParsedArmyList {
  detectedFaction: string | null;
  detectedDetachment: string | null; // e.g. "Gladius Task Force"
  detectedPointsLimit: number | null;
  units: ParsedUnit[];
  parsingConfidence: number; // Overall parsing confidence 0-1
}

// Timeline event types
export interface TimelineEventData {
  id: string;
  timestamp: Date;
  eventType: 'phase' | 'stratagem' | 'objective' | 'custom' | 'unit' | 'cp' | 'vp';
  phase: GamePhase;
  description: string;
  metadata?: any;
  
  // Revert tracking
  isReverted?: boolean;
  revertedAt?: Date | string | null;
  revertedBy?: string | null;
  revertReason?: string | null;
  revertedEventId?: string | null;
  cascadedFrom?: string | null;
}

// Audio analysis result from /api/analyze
export interface AudioAnalysisResult {
  type: 'phase' | 'event' | 'none';
  transcription: string;
  confidence: number;
  toolCalls?: ToolExecutionResult[];
  analyzed?: boolean; // True if GPT analysis was performed, false if transcribe-only
  reason?: string; // Explanation for why we didn't analyze (if applicable)
  phase?: GamePhase; // Legacy support
  event?: { type: string; description: string; metadata?: any }; // Legacy support
}

// Tool execution result
export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  message: string;
  data?: any;
  validation?: ValidationResult;
}

// Validation types
export type ValidationSeverity = 'valid' | 'info' | 'warning' | 'error' | 'critical';

export interface ValidationResult {
  severity: ValidationSeverity;
  message: string;
  rule?: string;
  suggestion?: string;
  requiresOverride: boolean;
}

// Game context for validation
export interface GameContext {
  session: {
    id: string;
    currentPhase: string;
    battleRound: number;
    attackerCommandPoints: number;
    defenderCommandPoints: number;
    attackerVictoryPoints: number;
    defenderVictoryPoints: number;
    currentTurn: string;
    attackerSecondaries?: string | null;
    defenderSecondaries?: string | null;
    attackerSecondaryProgress?: string | null;
    defenderSecondaryProgress?: string | null;
  };
  stratagems: Array<{
    id: string;
    stratagemName: string;
    usedBy: string;
    phase: string;
    timestamp: Date;
  }>;
  objectiveMarkers: Array<{
    objectiveNumber: number;
    controlledBy: string | null;
  }>;
  units?: Array<{
    unitName: string;
    owner: string;
    currentModels: number;
    currentWounds: number;
    isDestroyed: boolean;
  }>;
}

// ============================================
// SECONDARY OBJECTIVES TYPES
// ============================================

export type MissionType = 'fixed' | 'tactical' | 'both';
export type MissionMode = 'fixed' | 'tactical';
export type ScoringType = 'automatic' | 'per_turn' | 'end_of_game';
export type ScoringTiming = 'end_of_your_turn' | 'end_of_either_turn' | 'end_of_opponent_turn' | 'while_active';

// Deck history entry for tracking secondaries drawn
export interface DeckHistoryEntry {
  name: string;
  drawnRound: number;
  status: 'active' | 'scored' | 'discarded';
  scoredRound?: number;
  discardedRound?: number;
}

// Target selections for secondaries like Marked for Death
export interface TargetSelections {
  [secondaryName: string]: {
    alpha?: string[];
    gamma?: string;
    objective?: number;
  };
}

// New schema (GameRule-based)
export interface SecondaryObjective {
  id: string;
  name: string;
  description: string;
  category: string; // "Fixed", "Tactical", or "Both"
  type: string; // "Unit Destruction", "Objective Control", "Action", "Area Control", "Position Control"
  scoringType: ScoringType;
  vpCalculation: VPCalculation;
  maxVPPerTurn: number | null;
  maxVPTotal: number; // Usually 20
  scoringTrigger: string; // When/how it scores
  requiredKeywords: string[]; // ["CHARACTER"], ["MONSTER", "VEHICLE"], etc.
  createdAt: Date;
  updatedAt: Date;
}

export interface VPCalculation {
  type: 'threshold' | 'per_unit' | 'fixed';
  thresholds: Array<{
    condition: string;
    vp: number;
  }>;
  vpPerUnit: number | null;
  fixedVP: number | null;
}

// Legacy interfaces (for backward compatibility during migration)
export interface VPStructure {
  base?: number; // Base VP for simple scoring
  bonuses?: Array<{
    condition: string;
    vp: number;
    cumulative?: boolean; // If true, adds to previous bonuses
  }>;
  perTurn?: boolean; // If true, scores each turn
  perUnit?: boolean; // If true, scores per unit
  multiple?: boolean; // If true, can score multiple times
}

export interface ActionDetails {
  starts: string; // Phase when action starts (e.g., "Shooting")
  completes: string; // When action completes (e.g., "end of turn", "end of opponent's turn")
  units: string; // Number/type of units needed (e.g., "one", "two or more")
  conditions: string[]; // Array of conditions to complete
  location?: string; // Where action must be performed
}

export interface TrackingConditions {
  tracks: string[]; // What to track: ["character_destruction", "wound_characteristics", "objective_control", etc.]
  conditions: string[]; // Additional conditions to check
  autoScore?: boolean; // Can be automatically scored via voice
  manualOnly?: boolean; // Requires manual scoring only
}

export interface SecondaryProgress {
  vp: number; // Current VP scored
  progress?: {
    current: number;
    total?: number;
    details?: string; // Description of progress
  };
  details: string[]; // Specific details (unit names, objective numbers, etc.)
  turnScored?: number[]; // Which turns VP was scored
  lastScored?: Date; // When last scored
  scoringHistory?: Array<{
    round: number;
    turn: 'attacker' | 'defender';
    phase: string;
    vp: number;
    option: string; // Which scoring option was used
    timestamp: Date;
  }>;
}

export interface SecondaryProgressMap {
  [secondaryName: string]: SecondaryProgress;
}

// Tool arguments for secondary scoring
export interface ScoreSecondaryVPArgs {
  player: 'attacker' | 'defender';
  secondary_name: string;
  vp_amount: number;
  progress_update?: {
    action: string;
    details: string[];
  };
}

export interface ScoreAssassinationArgs {
  player: 'attacker' | 'defender';
  character_name: string;
  wounds_characteristic: number;
}

export interface ScoreBringItDownArgs {
  player: 'attacker' | 'defender';
  unit_name: string;
  total_wounds: number; // Total wounds characteristic of unit at full strength
}

export interface ScoreMarkedForDeathArgs {
  player: 'attacker' | 'defender';
  target_type: 'alpha' | 'gamma';
  unit_name: string;
}

// ============================================
// REVERT & CORRECTIONS TYPES
// ============================================

export interface RevertEventArgs {
  target_event_type: "phase" | "stratagem" | "objective" | "vp" | "cp" | "combat" | "unit_action" | "secondary" | "any";
  search_description?: string;
  revert_reason: string;
  correction_data?: {
    correct_value?: string;
    reapply_corrected?: boolean;
  };
  how_far_back?: "last" | "last_2" | "last_3" | "specific";
}

export interface RevertAction {
  id: string;
  gameSessionId: string;
  timestamp: Date;
  targetEventId: string;
  targetEventType: string;
  targetDescription: string;
  revertType: 'single' | 'cascade';
  triggerMethod: 'voice' | 'manual' | 'ai-correction';
  reason?: string;
  affectedEventIds: string[]; // Parsed from JSON
  stateBefore?: any; // Parsed from JSON
  stateAfter?: any; // Parsed from JSON
}

// ============================================
// WEAPON RULES ENGINE TYPES
// ============================================

/** Weapon type classification */
export type WeaponType = 'ranged' | 'melee' | 'pistol';

/** Phases where weapons can be used */
export type CombatPhase = 'Shooting' | 'Fight';

/** Parsed weapon ability from structuredAbilities */
export interface ParsedWeaponAbility {
  kind: string; // LETHAL_HITS, SUSTAINED_HITS, ANTI, RAPID_FIRE, BLAST, MELTA, etc.
  value?: number; // For SUSTAINED_HITS X, RAPID_FIRE X, etc.
  condition?: string; // For ANTI "4+" threshold
  targetKeyword?: string; // For ANTI "VEHICLE", "INFANTRY"
}

/** Weapon profile with calculated values */
export interface WeaponProfile {
  id: string;
  name: string;
  range: string;
  type: WeaponType;
  attacks: string; // Raw string (e.g., "D6", "3", "2D6")
  attacksAverage: number; // Calculated average
  ballisticSkill?: string; // For ranged
  weaponSkill?: string; // For melee
  strength: number;
  ap: number;
  damage: number; // Average damage
  damageRaw: string; // Raw string
  abilities: ParsedWeaponAbility[];
  
  // For profile grouping (e.g., "Axe Morkai — strike" and "Axe Morkai — sweep")
  profileGroup?: string; // Base name for grouped profiles
  profileVariant?: string; // Variant name (e.g., "strike", "sweep")
}

/** Result from weapon rules engine */
export interface EligibleWeaponsResult {
  phase: CombatPhase;
  weapons: WeaponProfile[];
  primaryWeapons: WeaponProfile[]; // Main weapons for the phase
  pistolWeapons: WeaponProfile[]; // Pistols (if eligible)
  extraAttackWeapons: WeaponProfile[]; // Weapons with EXTRA ATTACKS
  
  // Metadata
  modelCount: number;
  totalAttacks: number; // Sum of all attacks across eligible weapons
  
  // Groupings for display
  profileGroups: {
    [groupName: string]: WeaponProfile[];
  };
}

/** Input for weapon rules engine */
export interface WeaponEligibilityInput {
  phase: CombatPhase;
  weapons: Array<{
    weapon: {
      id: string;
      name: string;
      range: string;
      type: string;
      attacks: string;
      ballisticSkill?: string | null;
      weaponSkill?: string | null;
      strength: string;
      armorPenetration: string;
      damage: string;
      abilities: string; // JSON array
      strengthValue?: number | null;
      apValue?: number | null;
      damageValue?: number | null;
      structuredAbilities?: string | null; // JSON array
    };
    quantity?: string | null;
    isDefault: boolean;
  }>;
  modelCount: number;
  defenderKeywords?: string[]; // For Anti-X checking
  unitKeywords?: string[]; // For MONSTER/VEHICLE pistol exception
  
  // Modifiers
  isRapidFireRange?: boolean; // Within half range for RAPID FIRE
  targetModelCount?: number; // For BLAST
  charged?: boolean; // For LANCE
}

// ============================================
// TACTICAL ADVISOR TYPES
// ============================================

/**
 * A single tactical suggestion from the AI advisor
 */
export interface TacticalSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'positioning' | 'stratagem' | 'ability' | 'objective' | 'resource' | 'threat' | 'opponent_threat';
  title: string;
  description: string;
  reasoning?: string; // Only included in detailed mode
  relatedUnits?: string[]; // Units involved in this suggestion
  relatedUnitIds?: string[]; // UnitInstance IDs matched from relatedUnits (best-effort)
  relatedRules?: string[]; // Rule names cited
  cpCost?: number; // If suggesting a stratagem
  /** For opponent_threat suggestions: indicates this is what opponent could do */
  isOpponentPlay?: boolean;
}

/**
 * Context summary returned with tactical advice
 */
export interface TacticalContext {
  phase: string;
  battleRound: number;
  perspective: 'attacker' | 'defender';
  cpAvailable: number;
  vpDifferential: number;
  unitsAnalyzed: number;
  objectivesHeld: number;
}

/**
 * Full response from the tactical advisor API
 */
export interface TacticalAdviceResponse {
  suggestions: TacticalSuggestion[];
  context: TacticalContext;
  generatedAt: string;
  detailLevel: 'quick' | 'detailed';
  /**
   * Optional extra metadata to support richer UI surfaces (e.g. unit icons, mission chips)
   */
  meta?: {
    attackerFaction?: string;
    defenderFaction?: string;
    primaryMission?: {
      id: string;
      name: string;
      deploymentType: string;
      scoringPhase: string;
      scoringTiming: string;
      scoringFormula: string;
      maxVP: number;
      specialRules?: string | null;
    } | null;
    objectiveMarkers?: Array<{
      objectiveNumber: number;
      controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
      controllingUnit?: string | null;
    }>;
  };
  /**
   * Directory of active units for the session, keyed by UnitInstance ID.
   * Used to render unit icons/badges without extra client fetches.
   */
  unitDirectory?: Record<
    string,
    {
      id: string;
      name: string;
      owner: 'attacker' | 'defender';
      datasheet?: string;
      iconUrl?: string | null;
      datasheetId?: string | null;
    }
  >;
}

/**
 * Request payload for tactical advisor API
 */
export interface TacticalAdviceRequest {
  sessionId: string;
  perspective: 'attacker' | 'defender';
  detailLevel: 'quick' | 'detailed';
}

/**
 * Unit state for tactical analysis
 */
export interface TacticalUnitState {
  id: string;
  name: string;
  owner: 'attacker' | 'defender';
  datasheet: string;
  iconUrl?: string | null;
  datasheetId?: string | null;
  
  // Health status
  startingModels: number;
  currentModels: number;
  startingWounds: number;
  currentWounds: number;
  woundsPerModel: number;
  healthPercentage: number;
  
  // Status flags
  isDestroyed: boolean;
  isBattleShocked: boolean;
  activeEffects: string[];
  
  // Capabilities
  keywords: string[];
  abilities: TacticalAbility[];
  attachedToUnit?: string;
}

/**
 * Ability info for tactical analysis
 */
export interface TacticalAbility {
  name: string;
  type: string;
  description: string;
  triggerPhase?: string[];
  isReactive: boolean;
}

/**
 * Stratagem info for tactical analysis
 */
export interface TacticalStratagem {
  id: string;
  name: string;
  cpCost: number;
  type: string;
  when: string;
  effect: string;
  triggerPhase?: string[];
  isReactive: boolean;
  detachment?: string;
}

/**
 * Full tactical context built for AI analysis
 */
export interface FullTacticalContext {
  // Game state
  sessionId: string;
  phase: string;
  battleRound: number;
  currentTurn: 'attacker' | 'defender';
  
  // Resources
  attackerCP: number;
  defenderCP: number;
  attackerVP: number;
  defenderVP: number;
  
  // Objectives
  objectivesHeldByAttacker: number;
  objectivesHeldByDefender: number;
  objectivesContested: number;
  
  // Army info
  attackerFaction?: string;
  attackerDetachment?: string;
  defenderFaction?: string;
  
  // Units
  attackerUnits: TacticalUnitState[];
  defenderUnits: TacticalUnitState[];

  // Objective marker details (if tracked)
  objectiveMarkers?: Array<{
    objectiveNumber: number;
    controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
    controllingUnit?: string | null;
  }>;

  // Primary mission (if selected)
  primaryMission?: {
    id: string;
    name: string;
    deploymentType: string;
    scoringPhase: string;
    scoringTiming: string;
    scoringFormula: string;
    maxVP: number;
    specialRules?: string | null;
  } | null;
  
  // Available stratagems (for the perspective being analyzed)
  availableStratagems: TacticalStratagem[];
  
  // Detachment ability
  detachmentAbility?: {
    name: string;
    description: string;
  };
  
  // Turn order context
  firstTurn: 'attacker' | 'defender';
  
  // Secondary objectives
  secondaryObjectives?: {
    attacker: {
      active: string[];
      progress: Record<string, { vp: number; details: string[] }>;
      missionMode: 'fixed' | 'tactical';
      discarded: string[];
    };
    defender: {
      active: string[];
      progress: Record<string, { vp: number; details: string[] }>;
      missionMode: 'fixed' | 'tactical';
      discarded: string[];
    };
  };
  
  // Target selections for secondaries (Marked for Death, Tempting Target, etc.)
  targetSelections?: {
    attacker?: Record<string, { targets?: string[]; objective?: number }>;
    defender?: Record<string, { targets?: string[]; objective?: number }>;
  };
  
  // Recent stratagem usage (to avoid suggesting already-used stratagems)
  recentStratagems?: Array<{
    name: string;
    usedBy: 'attacker' | 'defender';
    phase: string;
    round: number;
    targetUnit?: string;
  }>;
  
  // Event log for game history context
  eventLog?: Array<{
    timestamp: string;
    eventType: string;
    phase?: string;
    description: string;
  }>;
}