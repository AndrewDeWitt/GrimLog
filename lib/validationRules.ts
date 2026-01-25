/**
 * Validation Rules Engine
 * 
 * Handles CP validation, phase transition validation, and other game rules checks.
 */

import { prisma } from './prisma';

// ============================================
// Types
// ============================================

export interface CPValidationResult {
  isValid: boolean;
  warning?: string;
  error?: string;
  cpGainedThisTurn: number;
  maxCPPerTurn: number;
}

export interface PhaseValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

// ============================================
// CP Validation
// ============================================

/**
 * Maximum CP gain per turn:
 * - 1 CP automatic at start of Command phase
 * - 1 CP from discarding secondary at end of Command phase
 * - Rarely, 1 CP from special ability (total max 3 CP/turn)
 */
const MAX_CP_PER_TURN = 2; // Standard limit
const ABSOLUTE_MAX_CP_PER_TURN = 3; // With rare ability

/**
 * Validate CP gain transaction
 */
export async function validateCPGain(
  sessionId: string,
  player: "attacker" | "defender",
  amount: number,
  reason: string,
  currentRound: number,
  currentTurn: string
): Promise<CPValidationResult> {
  // Get CP transactions for this turn
  const transactions = await prisma.cPTransaction.findMany({
    where: {
      gameSessionId: sessionId,
      player: player,
      battleRound: currentRound,
      playerTurn: currentTurn,
      transactionType: 'gain'
    }
  });
  
  const cpGainedThisTurn = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalAfterThis = cpGainedThisTurn + amount;
  
  // Validation checks
  if (totalAfterThis > ABSOLUTE_MAX_CP_PER_TURN) {
    return {
      isValid: false,
      error: `Would exceed absolute max CP per turn (${cpGainedThisTurn} + ${amount} > ${ABSOLUTE_MAX_CP_PER_TURN}). Max is 2 CP (1 auto + 1 discard) or rarely 3 CP with special ability.`,
      cpGainedThisTurn,
      maxCPPerTurn: ABSOLUTE_MAX_CP_PER_TURN
    };
  }
  
  if (totalAfterThis > MAX_CP_PER_TURN) {
    return {
      isValid: true, // Allow but warn
      warning: `Gaining ${amount} CP brings total to ${totalAfterThis} CP this turn. Standard max is ${MAX_CP_PER_TURN} (1 auto + 1 discard). Verify special ability grants extra CP.`,
      cpGainedThisTurn,
      maxCPPerTurn: MAX_CP_PER_TURN
    };
  }
  
  return {
    isValid: true,
    cpGainedThisTurn,
    maxCPPerTurn: MAX_CP_PER_TURN
  };
}

/**
 * Validate CP spend transaction
 */
export async function validateCPSpend(
  sessionId: string,
  player: "attacker" | "defender",
  amount: number
): Promise<CPValidationResult> {
  // Get current CP
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      attackerCommandPoints: true,
      defenderCommandPoints: true
    }
  });
  
  if (!session) {
    return {
      isValid: false,
      error: 'Session not found',
      cpGainedThisTurn: 0,
      maxCPPerTurn: MAX_CP_PER_TURN
    };
  }
  
  const currentCP = player === 'attacker' 
    ? session.attackerCommandPoints 
    : session.defenderCommandPoints;
  
  if (currentCP < amount) {
    return {
      isValid: false,
      error: `Insufficient CP: Have ${currentCP} CP, trying to spend ${amount} CP`,
      cpGainedThisTurn: 0,
      maxCPPerTurn: MAX_CP_PER_TURN
    };
  }
  
  return {
    isValid: true,
    cpGainedThisTurn: 0,
    maxCPPerTurn: MAX_CP_PER_TURN
  };
}

/**
 * Log CP transaction to history
 */
export async function logCPTransaction(
  sessionId: string,
  player: "attacker" | "defender",
  transactionType: "gain" | "spend",
  amount: number,
  reason: string,
  stratagemName: string | undefined,
  currentRound: number,
  currentPhase: string,
  currentTurn: string
): Promise<void> {
  await prisma.cPTransaction.create({
    data: {
      gameSessionId: sessionId,
      player,
      transactionType,
      amount,
      reason,
      stratagemName,
      battleRound: currentRound,
      phase: currentPhase,
      playerTurn: currentTurn
    }
  });
}

/**
 * Get CP transaction history summary
 */
export async function getCPTransactionHistory(
  sessionId: string,
  player: "attacker" | "defender",
  limit: number = 10
): Promise<string[]> {
  const transactions = await prisma.cPTransaction.findMany({
    where: {
      gameSessionId: sessionId,
      player: player
    },
    orderBy: { timestamp: 'desc' },
    take: limit
  });
  
  return transactions.map(t => 
    `Round ${t.battleRound} ${t.phase}: ${t.transactionType === 'gain' ? '+' : '-'}${t.amount} CP (${t.reason}${t.stratagemName ? ': ' + t.stratagemName : ''})`
  );
}

// ============================================
// Phase Validation
// ============================================

const VALID_PHASE_SEQUENCE = [
  'Command',
  'Movement',
  'Shooting',
  'Charge',
  'Fight'
];

/**
 * Validate phase transition
 */
export function validatePhaseTransition(
  currentPhase: string,
  newPhase: string
): PhaseValidationResult {
  const currentIndex = VALID_PHASE_SEQUENCE.indexOf(currentPhase);
  const newIndex = VALID_PHASE_SEQUENCE.indexOf(newPhase);
  
  if (currentIndex === -1 || newIndex === -1) {
    return {
      isValid: false,
      error: `Invalid phase name: ${currentPhase} → ${newPhase}`
    };
  }
  
  // Allow same phase (no-op)
  if (currentIndex === newIndex) {
    return {
      isValid: true,
      suggestion: 'Already in this phase'
    };
  }
  
  // Allow forward progression (including wrapping to Command)
  if (newIndex === currentIndex + 1 || (currentPhase === 'Fight' && newPhase === 'Command')) {
    return { isValid: true };
  }
  
  // Allow skipping phases (with warning)
  if (newIndex > currentIndex) {
    const skipped = VALID_PHASE_SEQUENCE.slice(currentIndex + 1, newIndex);
    return {
      isValid: true,
      suggestion: `Skipping ${skipped.join(', ')} phase(s). Confirm this is intentional.`
    };
  }
  
  // Backward progression (likely error, but allow with warning)
  if (newIndex < currentIndex) {
    return {
      isValid: true,
      suggestion: `Going backwards: ${currentPhase} → ${newPhase}. Did you mean to advance the turn/round instead?`
    };
  }
  
  return { isValid: true };
}

// ============================================
// Battle-Shock Validation
// ============================================

/**
 * Check which units need battle-shock tests
 */
export async function checkBattleShockRequired(
  sessionId: string,
  player: "attacker" | "defender"
): Promise<string[]> {
  // Get all units for this player
  const units = await prisma.unitInstance.findMany({
    where: {
      gameSessionId: sessionId,
      owner: player,
      isDestroyed: false
    }
  });
  
  const unitsBelowHalfStrength: string[] = [];
  
  for (const unit of units) {
    const totalModels = unit.startingModels || 1;
    const modelsRemaining = unit.currentModels || totalModels;
    
    if (modelsRemaining < totalModels / 2) {
      unitsBelowHalfStrength.push(unit.unitName);
    }
  }
  
  return unitsBelowHalfStrength;
}

// ============================================
// Stratagem Usage Validation
// ============================================

/**
 * Check if stratagem has been used this phase/turn/battle
 */
export async function validateStratagemUsage(
  sessionId: string,
  stratagemName: string,
  usageRestriction: string | null,
  currentRound: number,
  currentPhase: string,
  currentTurn: string
): Promise<PhaseValidationResult> {
  if (!usageRestriction || usageRestriction === '') {
    return { isValid: true }; // No restriction
  }
  
  const logs = await prisma.stratagemLog.findMany({
    where: {
      gameSessionId: sessionId,
      stratagemName: stratagemName
    },
    orderBy: { timestamp: 'desc' }
  });
  
  switch (usageRestriction) {
    case 'once_per_battle': {
      if (logs.length > 0) {
        return {
          isValid: false,
          error: `${stratagemName} already used this battle (once per battle limit)`
        };
      }
      break;
    }
    
    case 'once_per_turn': {
      const usedThisTurn = logs.some(log => {
        const logRound = (log as any).battleRound;
        const logTurn = (log as any).playerTurn;
        return logRound === currentRound && logTurn === currentTurn;
      });
      if (usedThisTurn) {
        return {
          isValid: false,
          error: `${stratagemName} already used this turn (once per turn limit)`
        };
      }
      break;
    }
    
    case 'once_per_phase': {
      const usedThisPhase = logs.some(log => {
        const logRound = (log as any).battleRound;
        const logTurn = (log as any).playerTurn;
        return (
          logRound === currentRound &&
          log.phase === currentPhase &&
          logTurn === currentTurn
        );
      });
      if (usedThisPhase) {
        return {
          isValid: false,
          error: `${stratagemName} already used this phase (once per phase limit)`
        };
      }
      break;
    }
  }
  
  return { isValid: true };
}


