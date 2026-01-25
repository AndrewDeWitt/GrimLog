/**
 * Secondary Objective Rules Engine
 * 
 * Handles VP calculation, validation, and progress tracking for secondary objectives.
 * Supports both Fixed and Tactical mission modes with proper scoring restrictions.
 */

import { prisma } from './prisma';
import secondaryMissionsData from '@/data/parsed-secondaries/secondary-missions.json';

// ============================================
// Types
// ============================================

export type MissionMode = 'fixed' | 'tactical';
export type ScoringTiming = 'end_of_your_turn' | 'end_of_either_turn' | 'end_of_opponent_turn' | 'while_active';

export interface SecondaryVPCalculation {
  vp: number;
  maxVPReached: boolean;
  perTurnLimitReached: boolean;
  calculation: string; // Human-readable explanation
}

export interface SecondaryValidation {
  isValid: boolean;
  error?: string;
  warning?: string;
  cappedVP?: number; // VP amount after applying caps
}

export interface ScoringOption {
  condition: string;
  vp: number;
  targetType?: 'alpha' | 'gamma';
  woundThreshold?: number;
}

export interface SecondaryMissionData {
  name: string;
  description: string;
  fullRules: string;
  missionType: 'tactical' | 'fixed' | 'both';
  maxVP: number | null;
  vpPerTurnCap: number | null;
  scoringType: string;
  scoringTiming: ScoringTiming;
  completesOnScore: boolean;
  roundRestrictions: {
    minRound: number | null;
    maxRound: number | null;
    redrawOnRound1: boolean;
  } | null;
  fixedScoring: {
    options: ScoringOption[];
    scoringTiming?: ScoringTiming;
    perUnit?: boolean;
    vpPerTurnCap?: number;
    bonuses?: Array<{ condition: string; vp: number; cumulative?: boolean }>;
    restrictions?: string[];
    notes?: string[];
  } | null;
  tacticalScoring: {
    options: ScoringOption[];
    scoringTiming?: ScoringTiming;
    perUnit?: boolean;
    vpPerTurnCap?: number;
    bonus?: { condition: string; vp: number };
    notes?: string[];
  } | null;
  requiresTargetSelection: boolean;
  targetSelectionRules: any | null;
  requiresAction: boolean;
  actionDetails: any | null;
  tournamentRestricted?: boolean;
  tournamentRestriction?: string;
}

export interface DeckHistoryEntry {
  name: string;
  drawnRound: number;
  status: 'active' | 'scored' | 'discarded';
  scoredRound?: number;
  discardedRound?: number;
}

export interface TargetSelections {
  [secondaryName: string]: {
    alpha?: string[];
    gamma?: string;
    objective?: number;
  };
}

// ============================================
// Data Access
// ============================================

/**
 * Get secondary mission data by name
 */
export function getSecondaryData(name: string): SecondaryMissionData | undefined {
  return (secondaryMissionsData as SecondaryMissionData[]).find(
    s => s.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all secondary missions
 */
export function getAllSecondaries(): SecondaryMissionData[] {
  return secondaryMissionsData as SecondaryMissionData[];
}

// ============================================
// VP Calculation Functions
// ============================================

/**
 * Calculate VP for a scoring option based on mission mode
 */
export function calculateVPForOption(
  secondaryName: string,
  optionIndex: number,
  missionMode: MissionMode,
  conditions?: Record<string, any>
): SecondaryVPCalculation {
  const secondary = getSecondaryData(secondaryName);
  
  if (!secondary) {
    return {
      vp: 0,
      maxVPReached: false,
      perTurnLimitReached: false,
      calculation: `Secondary "${secondaryName}" not found`
    };
  }

  const scoring = missionMode === 'fixed' ? secondary.fixedScoring : secondary.tacticalScoring;
  
  if (!scoring) {
    // Fall back to opposite mode if this mode not supported
    const fallbackScoring = missionMode === 'fixed' ? secondary.tacticalScoring : secondary.fixedScoring;
    if (fallbackScoring && fallbackScoring.options[optionIndex]) {
      const option = fallbackScoring.options[optionIndex];
      return {
        vp: option.vp,
        maxVPReached: false,
        perTurnLimitReached: false,
        calculation: `${option.condition}: ${option.vp}VP (using ${missionMode === 'fixed' ? 'tactical' : 'fixed'} values)`
      };
    }
    
    return {
      vp: 0,
      maxVPReached: false,
      perTurnLimitReached: false,
      calculation: `No ${missionMode} scoring available for "${secondaryName}"`
    };
  }

  const options = scoring.options || [];
  
  if (optionIndex < 0 || optionIndex >= options.length) {
    return {
      vp: 0,
      maxVPReached: false,
      perTurnLimitReached: false,
      calculation: `Invalid option index ${optionIndex} for "${secondaryName}"`
    };
  }

  const option = options[optionIndex];
  let vp = option.vp;
  let calculation = `${option.condition}: ${option.vp}VP`;

  // Apply cumulative bonuses for Fixed Bring It Down
  if (missionMode === 'fixed' && secondary.fixedScoring?.bonuses && conditions?.totalWounds) {
    for (const bonus of secondary.fixedScoring.bonuses) {
      const match = bonus.condition.match(/(\d+)\+/);
      if (match) {
        const threshold = parseInt(match[1]);
        if (conditions.totalWounds >= threshold) {
          vp += bonus.vp;
          calculation += ` + ${bonus.vp}VP (${bonus.condition})`;
        }
      }
    }
  }

  return {
    vp,
    maxVPReached: false,
    perTurnLimitReached: false,
    calculation
  };
}

/**
 * Calculate VP based on rule's vpCalculation logic (legacy support)
 */
export function calculateVP(
  vpCalculation: any,
  conditions: Record<string, any>
): number {
  const calcType = vpCalculation.type;
  
  switch (calcType) {
    case 'threshold': {
      // Find matching threshold (e.g., Assassination: 4W+ = 4VP, <4W = 3VP)
      const thresholds = vpCalculation.thresholds || [];
      
      // Sort by VP descending to check highest first
      const sorted = thresholds.sort((a: any, b: any) => b.vp - a.vp);
      
      for (const threshold of sorted) {
        if (evaluateCondition(threshold.condition, conditions)) {
          return threshold.vp;
        }
      }
      
      return 0;
    }
    
    case 'per_unit': {
      // Fixed VP per unit (e.g., No Prisoners: 2 VP per unit)
      return vpCalculation.vpPerUnit || 0;
    }
    
    case 'fixed': {
      // Fixed VP amount
      return vpCalculation.fixedVP || 0;
    }
    
    default:
      console.warn(`Unknown VP calculation type: ${calcType}`);
      return 0;
  }
}

/**
 * Evaluate a condition string against provided values
 */
function evaluateCondition(
  condition: string,
  values: Record<string, any>
): boolean {
  const conditionLower = condition.toLowerCase();
  
  // Extract wound threshold from condition
  const woundMatch = condition.match(/(\d+)\+?\s*w/i);
  if (woundMatch && values.wounds !== undefined) {
    const threshold = parseInt(woundMatch[1]);
    
    // Check if it's a minimum (4+) or maximum (<4)
    if (condition.includes('+')) {
      return values.wounds >= threshold;
    } else if (condition.includes('<')) {
      return values.wounds < threshold;
    } else if (condition.includes('-')) {
      // Range like "15-19"
      const rangeMatch = condition.match(/(\d+)-(\d+)/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        return values.wounds >= min && values.wounds <= max;
      }
    } else {
      return values.wounds >= threshold;
    }
  }
  
  // Check model count for Cull the Horde
  if (conditionLower.includes('13+') && values.models !== undefined) {
    return values.models >= 13;
  }
  
  // Default: condition met if mentioned in condition string
  return true;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Check if player has this secondary active
 */
export async function checkSecondaryActive(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string
): Promise<boolean> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerSecondaries: true,
      defenderSecondaries: true
    }
  });
  
  if (!session) return false;
  
  const secondaries = player === 'attacker'
    ? JSON.parse(session.attackerSecondaries || '[]')
    : JSON.parse(session.defenderSecondaries || '[]');
  
  return secondaries.includes(secondaryName);
}

/**
 * Get current VP scored for a secondary
 */
export async function getCurrentSecondaryVP(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string
): Promise<number> {
  const progress = await prisma.secondaryProgress.findUnique({
    where: {
      gameSessionId_player_secondaryName: {
        gameSessionId: sessionId,
        player: player,
        secondaryName: secondaryName
      }
    }
  });
  
  return progress?.vpScored || 0;
}

/**
 * Get VP scored this turn for a secondary (for per-turn caps)
 */
export async function getSecondaryVPThisTurn(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  currentRound: number,
  currentTurn: string
): Promise<number> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerSecondaryProgress: true,
      defenderSecondaryProgress: true
    }
  });
  
  if (!session) return 0;
  
  const progressStr = player === 'attacker' 
    ? session.attackerSecondaryProgress 
    : session.defenderSecondaryProgress;
    
  if (!progressStr) return 0;
  
  const progress = JSON.parse(progressStr);
  const secondaryProgress = progress[secondaryName];
  
  if (!secondaryProgress || !secondaryProgress.scoringHistory) return 0;
  
  // Sum VP from this round and turn
  return secondaryProgress.scoringHistory
    .filter((entry: any) => entry.round === currentRound && entry.turn === currentTurn)
    .reduce((sum: number, entry: any) => sum + (entry.vp || 0), 0);
}

/**
 * Check if round restriction allows scoring
 */
export function checkRoundRestriction(
  secondaryName: string,
  currentRound: number
): SecondaryValidation {
  const secondary = getSecondaryData(secondaryName);
  
  if (!secondary) {
    return { isValid: false, error: `Secondary "${secondaryName}" not found` };
  }
  
  if (!secondary.roundRestrictions) {
    return { isValid: true };
  }
  
  const { minRound, maxRound, redrawOnRound1 } = secondary.roundRestrictions;
  
  if (minRound && currentRound < minRound) {
    return {
      isValid: false,
      error: `${secondaryName} can only be scored from Round ${minRound} onwards (current: Round ${currentRound})`,
      warning: redrawOnRound1 ? 'This card should be redrawn in Round 1' : undefined
    };
  }
  
  if (maxRound && currentRound > maxRound) {
    return {
      isValid: false,
      error: `${secondaryName} can only be scored until Round ${maxRound}`
    };
  }
  
  return { isValid: true };
}

/**
 * Check per-turn VP cap
 */
export async function checkPerTurnCap(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  vpToScore: number,
  currentRound: number,
  currentTurn: string,
  missionMode: MissionMode
): Promise<SecondaryValidation> {
  const secondary = getSecondaryData(secondaryName);
  
  if (!secondary) {
    return { isValid: false, error: `Secondary "${secondaryName}" not found` };
  }
  
  // Determine the applicable turn cap
  let turnCap: number | null = null;
  
  if (missionMode === 'fixed' && secondary.fixedScoring?.vpPerTurnCap !== undefined) {
    turnCap = secondary.fixedScoring.vpPerTurnCap;
  } else if (missionMode === 'tactical' && secondary.tacticalScoring?.vpPerTurnCap !== undefined) {
    turnCap = secondary.tacticalScoring.vpPerTurnCap;
  } else {
    turnCap = secondary.vpPerTurnCap;
  }
  
  if (!turnCap) {
    return { isValid: true };
  }
  
  const vpThisTurn = await getSecondaryVPThisTurn(sessionId, player, secondaryName, currentRound, currentTurn);
  
  if (vpThisTurn >= turnCap) {
    return {
      isValid: false,
      error: `${secondaryName} has reached ${turnCap}VP turn cap (scored ${vpThisTurn}VP this turn)`
    };
  }
  
  if (vpThisTurn + vpToScore > turnCap) {
    const cappedVP = turnCap - vpThisTurn;
    return {
      isValid: true,
      warning: `VP capped at ${cappedVP} (turn cap: ${turnCap}VP, already scored: ${vpThisTurn}VP)`,
      cappedVP
    };
  }
  
  return { isValid: true };
}

/**
 * Comprehensive scoring attempt validation
 */
export async function validateScoringAttempt(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  vpToScore: number,
  currentRound: number,
  currentTurn: string,
  missionMode: MissionMode
): Promise<SecondaryValidation> {
  // 1. Check if secondary is active
  const isActive = await checkSecondaryActive(sessionId, player, secondaryName);
  if (!isActive) {
    return {
      isValid: false,
      error: `${player} doesn't have ${secondaryName} active`
    };
  }
  
  // 2. Check round restrictions
  const roundCheck = checkRoundRestriction(secondaryName, currentRound);
  if (!roundCheck.isValid) {
    return roundCheck;
  }
  
  // 3. Check Tactical once-per-turn scoring
  const secondary = getSecondaryData(secondaryName);
  if (!secondary) {
    return { isValid: false, error: `Secondary "${secondaryName}" not found` };
  }
  
  // For Tactical missions that complete on score, check if already scored this turn
  if (missionMode === 'tactical' && secondary.completesOnScore) {
    const vpThisTurn = await getSecondaryVPThisTurn(sessionId, player, secondaryName, currentRound, currentTurn);
    if (vpThisTurn > 0) {
      return {
        isValid: false,
        error: `${secondaryName} (Tactical) already scored ${vpThisTurn}VP this turn - completes on score`
      };
    }
  }
  
  // 4. Check per-turn cap
  const capCheck = await checkPerTurnCap(sessionId, player, secondaryName, vpToScore, currentRound, currentTurn, missionMode);
  if (!capCheck.isValid) {
    return capCheck;
  }
  
  // 5. Get max VP total
  const currentVP = await getCurrentSecondaryVP(sessionId, player, secondaryName);
  const maxVP = 20; // Standard max
  
  if (currentVP + vpToScore > maxVP) {
    const remaining = maxVP - currentVP;
    if (remaining <= 0) {
      return {
        isValid: false,
        error: `${secondaryName} has reached maximum VP (${maxVP})`
      };
    }
    return {
      isValid: true,
      warning: `VP capped at ${remaining} (max: ${maxVP}, current: ${currentVP})`,
      cappedVP: Math.min(capCheck.cappedVP || remaining, remaining)
    };
  }
  
  return {
    isValid: true,
    cappedVP: capCheck.cappedVP
  };
}

/**
 * Legacy validation function for backward compatibility
 */
export async function validateSecondaryScoring(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  vpToScore: number,
  currentRound: number
): Promise<SecondaryValidation> {
  // Get session to determine mission mode
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      currentTurn: true,
      attackerMissionMode: true,
      defenderMissionMode: true
    }
  });
  
  if (!session) {
    return { isValid: false, error: 'Session not found' };
  }
  
  const missionMode = (player === 'attacker' 
    ? session.attackerMissionMode 
    : session.defenderMissionMode) as MissionMode || 'tactical';
  
  return validateScoringAttempt(
    sessionId,
    player,
    secondaryName,
    vpToScore,
    currentRound,
    session.currentTurn,
    missionMode
  );
}

// ============================================
// Deck Management Functions
// ============================================

/**
 * Get secondaries available for drawing (not already used this game)
 */
export async function getAvailableForDraw(
  sessionId: string,
  player: "attacker" | "defender",
  missionMode: MissionMode
): Promise<SecondaryMissionData[]> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerDeckHistory: true,
      defenderDeckHistory: true,
      attackerSecondaries: true,
      defenderSecondaries: true,
      battleRound: true
    }
  });
  
  if (!session) return [];
  
  // Get deck history
  const historyStr = player === 'attacker' 
    ? session.attackerDeckHistory 
    : session.defenderDeckHistory;
  const history: DeckHistoryEntry[] = historyStr ? JSON.parse(historyStr) : [];
  
  // Get current active secondaries
  const activeStr = player === 'attacker' 
    ? session.attackerSecondaries 
    : session.defenderSecondaries;
  const activeSecondaries: string[] = activeStr ? JSON.parse(activeStr) : [];
  
  // Get all used names (can't draw the same card twice in Tactical)
  const usedNames = new Set(history.map(h => h.name));
  
  // Filter available secondaries
  const allSecondaries = getAllSecondaries();
  
  return allSecondaries.filter(secondary => {
    // Skip already used (for Tactical deck)
    if (missionMode === 'tactical' && usedNames.has(secondary.name)) {
      return false;
    }
    
    // Skip currently active
    if (activeSecondaries.includes(secondary.name)) {
      return false;
    }
    
    // Check mission type compatibility
    if (secondary.missionType !== 'both' && secondary.missionType !== missionMode) {
      return false;
    }
    
    // Check round restrictions for initial draw
    if (session.battleRound === 1 && secondary.roundRestrictions?.redrawOnRound1) {
      return false; // Don't offer cards that must be redrawn in Round 1
    }
    
    return true;
  });
}

/**
 * Record a secondary draw in deck history
 */
export async function recordSecondaryDraw(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  battleRound: number
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerDeckHistory: true,
      defenderDeckHistory: true
    }
  });
  
  if (!session) return;
  
  const historyField = player === 'attacker' ? 'attackerDeckHistory' : 'defenderDeckHistory';
  const currentHistoryStr = player === 'attacker' 
    ? session.attackerDeckHistory 
    : session.defenderDeckHistory;
  
  const history: DeckHistoryEntry[] = currentHistoryStr ? JSON.parse(currentHistoryStr) : [];
  
  // Add new entry
  history.push({
    name: secondaryName,
    drawnRound: battleRound,
    status: 'active'
  });
  
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [historyField]: JSON.stringify(history)
    }
  });
}

/**
 * Update deck history entry status
 */
export async function updateDeckHistoryStatus(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  newStatus: 'scored' | 'discarded',
  round: number
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerDeckHistory: true,
      defenderDeckHistory: true
    }
  });
  
  if (!session) return;
  
  const historyField = player === 'attacker' ? 'attackerDeckHistory' : 'defenderDeckHistory';
  const currentHistoryStr = player === 'attacker' 
    ? session.attackerDeckHistory 
    : session.defenderDeckHistory;
  
  const history: DeckHistoryEntry[] = currentHistoryStr ? JSON.parse(currentHistoryStr) : [];
  
  // Find and update the active entry for this secondary
  const entry = history.find(h => h.name === secondaryName && h.status === 'active');
  if (entry) {
    entry.status = newStatus;
    if (newStatus === 'scored') {
      entry.scoredRound = round;
    } else {
      entry.discardedRound = round;
    }
  }
  
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [historyField]: JSON.stringify(history)
    }
  });
}

// ============================================
// Secondary Progress Tracking
// ============================================

/**
 * Update secondary progress with new VP
 */
export async function updateSecondaryProgress(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  vpScored: number,
  currentRound: number,
  currentPhase: string,
  details?: Record<string, any>
): Promise<void> {
  // Get or create progress record
  let progress = await prisma.secondaryProgress.findUnique({
    where: {
      gameSessionId_player_secondaryName: {
        gameSessionId: sessionId,
        player: player,
        secondaryName: secondaryName
      }
    }
  });
  
  if (!progress) {
    // Create new progress record
    progress = await prisma.secondaryProgress.create({
      data: {
        gameSessionId: sessionId,
        player: player,
        secondaryName: secondaryName,
        vpScored: vpScored,
        maxVP: 20, // Default max
        lastScoredRound: currentRound,
        lastScoredPhase: currentPhase,
        progressData: {
          turns: { [currentRound]: vpScored },
          details: details ? [details] : []
        }
      }
    });
  } else {
    // Update existing progress
    const currentData = (progress.progressData as any) || { turns: {}, details: [] };
    const turns = currentData.turns || {};
    turns[currentRound] = (turns[currentRound] || 0) + vpScored;
    
    const detailsList = currentData.details || [];
    if (details) {
      detailsList.push({ ...details, round: currentRound, phase: currentPhase });
    }
    
    await prisma.secondaryProgress.update({
      where: { id: progress.id },
      data: {
        vpScored: progress.vpScored + vpScored,
        lastScoredRound: currentRound,
        lastScoredPhase: currentPhase,
        progressData: {
          turns,
          details: detailsList
        }
      }
    });
  }
}

/**
 * Get formatted secondary progress summary
 */
export async function getSecondaryProgressSummary(
  sessionId: string,
  player: "attacker" | "defender"
): Promise<string> {
  const progressRecords = await prisma.secondaryProgress.findMany({
    where: {
      gameSessionId: sessionId,
      player: player
    }
  });
  
  if (progressRecords.length === 0) {
    return 'No secondaries scored yet';
  }
  
  const lines = progressRecords.map(p => 
    `• ${p.secondaryName}: ${p.vpScored}/${p.maxVP} VP`
  );
  
  return lines.join('\n');
}

// ============================================
// Target Selection Functions
// ============================================

/**
 * Get target selections for a player
 */
export async function getTargetSelections(
  sessionId: string,
  player: "attacker" | "defender"
): Promise<TargetSelections> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerTargetSelections: true,
      defenderTargetSelections: true
    }
  });
  
  if (!session) return {};
  
  const selectionsStr = player === 'attacker' 
    ? session.attackerTargetSelections 
    : session.defenderTargetSelections;
  
  return selectionsStr ? JSON.parse(selectionsStr) : {};
}

/**
 * Update target selections for a player
 */
export async function updateTargetSelections(
  sessionId: string,
  player: "attacker" | "defender",
  secondaryName: string,
  selections: { alpha?: string[]; gamma?: string; objective?: number }
): Promise<void> {
  const current = await getTargetSelections(sessionId, player);
  
  current[secondaryName] = selections;
  
  const field = player === 'attacker' ? 'attackerTargetSelections' : 'defenderTargetSelections';
  
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [field]: JSON.stringify(current)
    }
  });
}

// ============================================
// Scoring Options Generation
// ============================================

/**
 * Generate scoring options for a secondary based on mission mode
 */
export function getScoringOptions(
  secondaryName: string,
  missionMode: MissionMode
): ScoringOption[] {
  const secondary = getSecondaryData(secondaryName);
  
  if (!secondary) return [];
  
  const scoring = missionMode === 'fixed' ? secondary.fixedScoring : secondary.tacticalScoring;
  
  if (!scoring) {
    // Fall back to opposite mode if available
    const fallback = missionMode === 'fixed' ? secondary.tacticalScoring : secondary.fixedScoring;
    return fallback?.options || [];
  }
  
  return scoring.options || [];
}

/**
 * Get the per-turn VP cap for a secondary in the given mode
 */
export function getVPPerTurnCap(
  secondaryName: string,
  missionMode: MissionMode
): number | null {
  const secondary = getSecondaryData(secondaryName);
  
  if (!secondary) return null;
  
  if (missionMode === 'fixed' && secondary.fixedScoring?.vpPerTurnCap !== undefined) {
    return secondary.fixedScoring.vpPerTurnCap;
  }
  
  if (missionMode === 'tactical' && secondary.tacticalScoring?.vpPerTurnCap !== undefined) {
    return secondary.tacticalScoring.vpPerTurnCap;
  }
  
  return secondary.vpPerTurnCap;
}
