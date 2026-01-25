/**
 * Validation Helper Functions
 * These perform contextual checks on game actions to detect potential rule violations
 */

import { prisma } from './prisma';
import { ValidationResult } from './types';
import type { GameSession, StratagemLog, ObjectiveMarker } from '@prisma/client';

interface GameContext {
  session: GameSession;
  recentStratagems: StratagemLog[];
  objectiveMarkers: ObjectiveMarker[];
}

/**
 * Fetch game context for validation (optimized single query)
 */
export async function fetchGameContext(sessionId: string): Promise<GameContext> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      objectiveMarkers: true,
      stratagemLogs: {
        orderBy: { timestamp: 'desc' },
        take: 50, // Last 50 stratagems for analysis
      },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  return {
    session: {
      ...session,
      // Remove included relations from session object to match type
      objectiveMarkers: undefined as any,
      stratagemLogs: undefined as any,
    } as GameSession,
    recentStratagems: session.stratagemLogs || [],
    objectiveMarkers: session.objectiveMarkers || [],
  };
}

/**
 * Build a detailed game state summary for AI prompt
 */
export function buildGameStatePrompt(context: GameContext): string {
  const { session, recentStratagems, objectiveMarkers } = context;

  // Get stratagems used this round
  const thisRoundStratagems = recentStratagems.filter(
    (s) => s.phase && isInCurrentRound(s.timestamp, session)
  );

  // Get stratagems used this phase
  const thisPhaseStratagems = thisRoundStratagems.filter(
    (s) => s.phase === session.currentPhase
  );

  // Parse secondary objectives and progress
  const attackerSecondaries: string[] = session.attackerSecondaries ? JSON.parse(session.attackerSecondaries) : [];
  const defenderSecondaries: string[] = session.defenderSecondaries ? JSON.parse(session.defenderSecondaries) : [];
  const playerProgress: any = session.attackerSecondaryProgress ? JSON.parse(session.attackerSecondaryProgress) : {};
  const opponentProgress: any = session.defenderSecondaryProgress ? JSON.parse(session.defenderSecondaryProgress) : {};

  // Build secondary objectives display
  const attackerSecondariesText = attackerSecondaries.length > 0
    ? attackerSecondaries.map((sec, idx) => {
        const progress = playerProgress[sec];
        if (progress) {
          return `${idx + 1}. ${sec} (${progress.vp} VP scored) - ${progress.details?.length || 0} tracked items`;
        }
        return `${idx + 1}. ${sec} (0 VP)`;
      }).join('\n- ')
    : 'None set';

  const defenderSecondariesText = defenderSecondaries.length > 0
    ? defenderSecondaries.map((sec, idx) => {
        const progress = opponentProgress[sec];
        if (progress) {
          return `${idx + 1}. ${sec} (${progress.vp} VP scored) - ${progress.details?.length || 0} tracked items`;
        }
        return `${idx + 1}. ${sec} (0 VP)`;
      }).join('\n- ')
    : 'None set';

  // Build turn order context using attacker/defender terminology
  const firstPlayer = (session as any).firstPlayer || 'player';
  const isAttacker = session.currentTurn === firstPlayer;
  const turnPosition = isAttacker ? '1st' : '2nd';
  const firstPlayerRole = firstPlayer === 'player' ? 'Player (Attacker)' : 'Opponent (Attacker)';
  const currentPlayerText = session.currentTurn === 'player' ? 'Player' : 'Opponent';
  const currentRole = isAttacker ? 'Attacker' : 'Defender';

  return `
=== CURRENT GAME STATE ===
Battle Round: ${session.battleRound}
Current Phase: ${session.currentPhase}
Current Turn: ${currentPlayerText} as ${currentRole} (${turnPosition} turn of round)

TURN ORDER RULES (Attacker/Defender System):
- ${firstPlayerRole} goes first each round (determined by roll-off at game start)
- Each round has TWO turns: Attacker goes first, then Defender
- Attacker = the player who goes first each round
- Defender = the player who goes second each round
- When Defender ends their turn, the round advances to the next round
- "End of my turn" should switch to the other player's turn OR advance the round (if this is Defender's turn)
- Always reset to Command phase when turns change

COMMAND POINTS:
- Player: ${session.attackerCommandPoints} CP
- Opponent: ${session.defenderCommandPoints} CP

VICTORY POINTS:
- Player: ${session.attackerVictoryPoints} VP
- Opponent: ${session.defenderVictoryPoints} VP

SECONDARY OBJECTIVES:
Player Secondaries:
- ${attackerSecondariesText}

Opponent Secondaries:
- ${defenderSecondariesText}

OBJECTIVE CONTROL:
- Player controls: ${objectiveMarkers.filter((o) => o.controlledBy === 'player').map((o) => `Obj ${o.objectiveNumber}`).join(', ') || 'none'}
- Opponent controls: ${objectiveMarkers.filter((o) => o.controlledBy === 'opponent').map((o) => `Obj ${o.objectiveNumber}`).join(', ') || 'none'}
- Contested: ${objectiveMarkers.filter((o) => o.controlledBy === 'contested').map((o) => `Obj ${o.objectiveNumber}`).join(', ') || 'none'}

STRATAGEMS USED THIS ROUND:
${thisRoundStratagems.length > 0 
  ? thisRoundStratagems
      .map((s) => `- ${s.usedBy} used "${s.stratagemName}" (${s.cpCost} CP) in ${s.phase} phase`)
      .join('\n')
  : '- None yet'}

STRATAGEMS USED THIS PHASE (${session.currentPhase}):
${thisPhaseStratagems.length > 0
  ? thisPhaseStratagems
      .map((s) => `- ${s.usedBy} used "${s.stratagemName}" (${s.cpCost} CP)`)
      .join('\n')
  : '- None yet'}
`.trim();
}

/**
 * Helper to check if a timestamp is in the current battle round
 * (within last ~15 minutes, or since last round advance)
 */
function isInCurrentRound(timestamp: Date, session: GameSession): boolean {
  const now = new Date();
  const timeSinceAction = now.getTime() - timestamp.getTime();
  const fifteenMinutes = 15 * 60 * 1000;

  // Simple heuristic: if action was within last 15 minutes, consider it this round
  // This could be enhanced by tracking explicit round transitions
  return timeSinceAction < fifteenMinutes;
}

/**
 * Validate stratagem use against recent history
 */
export function validateStratagemUse(
  stratagemName: string,
  usedBy: 'attacker' | 'defender',
  phase: string,
  context: GameContext
): ValidationResult {
  const { session, recentStratagems } = context;

  // Check for duplicates this phase
  const thisPhaseStratagems = recentStratagems.filter(
    (s) =>
      s.phase === session.currentPhase &&
      s.usedBy === usedBy &&
      s.stratagemName.toLowerCase() === stratagemName.toLowerCase() &&
      isInCurrentRound(s.timestamp, session)
  );

  if (thisPhaseStratagems.length > 0) {
    return {
      severity: 'warning',
      message: `"${stratagemName}" may have already been used by ${usedBy} this phase. Verify if this stratagem allows multiple uses.`,
      rule: 'duplicate_stratagem_this_phase',
      suggestion: 'Check if stratagem has "once per phase" restriction',
      requiresOverride: true,
    };
  }

  // Check for duplicates this turn (across all phases)
  const thisTurnStratagems = recentStratagems.filter(
    (s) =>
      s.usedBy === usedBy &&
      s.stratagemName.toLowerCase() === stratagemName.toLowerCase() &&
      isInCurrentRound(s.timestamp, session)
  );

  if (thisTurnStratagems.length > 0) {
    return {
      severity: 'info',
      message: `"${stratagemName}" was used by ${usedBy} earlier this turn. Verify if this is allowed.`,
      rule: 'duplicate_stratagem_this_turn',
      suggestion: 'Check if stratagem has "once per turn" restriction',
      requiresOverride: false, // Just info, don't require override
    };
  }

  // Check CP availability
  const currentCP = usedBy === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
  // Note: This is checked by the tool handler, but we can pre-validate here

  return {
    severity: 'valid',
    message: 'Stratagem use appears valid',
    requiresOverride: false,
  };
}

/**
 * Validate phase transition
 */
export function validatePhaseTransition(
  newPhase: string,
  context: GameContext
): ValidationResult {
  const currentPhase = context.session.currentPhase;

  const phaseOrder = ['Command', 'Movement', 'Shooting', 'Charge', 'Fight'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const newIndex = phaseOrder.indexOf(newPhase);

  if (currentIndex === -1 || newIndex === -1) {
    return {
      severity: 'warning',
      message: `Unknown phase transition: ${currentPhase} → ${newPhase}`,
      requiresOverride: false,
    };
  }

  // Allow cycling from last phase back to first (new turn)
  if (currentPhase === 'Fight' && newPhase === 'Command') {
    return {
      severity: 'info',
      message: 'Starting new turn cycle (Fight → Command)',
      rule: 'turn_cycle',
      suggestion: 'Consider using advance_battle_round if starting a new round',
      requiresOverride: false,
    };
  }

  // Check if going backwards (but not the turn cycle case)
  if (newIndex < currentIndex) {
    return {
      severity: 'error',
      message: `Invalid phase transition: Cannot go backwards from ${currentPhase} to ${newPhase}`,
      rule: 'phase_sequence_violation',
      suggestion: `Valid next phase: ${phaseOrder[currentIndex + 1] || 'End of turn (or Command for new turn)'}`,
      requiresOverride: true,
    };
  }

  // Check if skipping phases
  if (newIndex > currentIndex + 1) {
    const skippedPhases = phaseOrder.slice(currentIndex + 1, newIndex);
    return {
      severity: 'info',
      message: `Skipping ${skippedPhases.join(', ')} phase(s)`,
      rule: 'phase_skip',
      suggestion: 'This is allowed but unusual',
      requiresOverride: false,
    };
  }

  // Valid transition
  return {
    severity: 'valid',
    message: 'Valid phase transition',
    requiresOverride: false,
  };
}

/**
 * Validate CP change
 */
export function validateCommandPointChange(
  player: 'attacker' | 'defender',
  change: number,
  reason: string,
  context: GameContext
): ValidationResult {
  const { session } = context;
  const currentCP = player === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;

  // Check if spending more than available
  if (change < 0 && currentCP + change < 0) {
    return {
      severity: 'error',
      message: `Cannot spend ${Math.abs(change)} CP - ${player} only has ${currentCP} CP`,
      rule: 'insufficient_cp',
      suggestion: `Maximum can spend: ${currentCP} CP`,
      requiresOverride: true,
    };
  }

  // Check if gaining unusually high CP
  if (change > 2) {
    return {
      severity: 'warning',
      message: `Gaining ${change} CP is unusual (standard is +1 per turn, max +2 with secondary discard). Verify this is correct.`,
      rule: 'high_cp_gain',
      suggestion: 'Check for special abilities or rules',
      requiresOverride: true,
    };
  }

  if (change > 3) {
    return {
      severity: 'critical',
      message: `Gaining ${change} CP exceeds maximum possible gain per turn (+3)`,
      rule: 'excessive_cp_gain',
      suggestion: 'This is likely an error',
      requiresOverride: true,
    };
  }

  return {
    severity: 'valid',
    message: 'CP change appears valid',
    requiresOverride: false,
  };
}

/**
 * Validate battle round advancement
 */
export function validateRoundAdvancement(
  newRound: number,
  context: GameContext
): ValidationResult {
  const currentRound = context.session.battleRound;

  // Check if going backwards
  if (newRound < currentRound) {
    return {
      severity: 'critical',
      message: `Cannot go backwards from Round ${currentRound} to Round ${newRound}`,
      rule: 'round_regression',
      suggestion: 'Use manual correction if needed',
      requiresOverride: true,
    };
  }

  // Check if skipping rounds
  if (newRound > currentRound + 1) {
    return {
      severity: 'error',
      message: `Skipping from Round ${currentRound} to Round ${newRound} - missing Round ${currentRound + 1}`,
      rule: 'round_skip',
      suggestion: `Advance to Round ${currentRound + 1} instead`,
      requiresOverride: true,
    };
  }

  // Check if already in this round
  if (newRound === currentRound) {
    return {
      severity: 'info',
      message: `Already in Round ${currentRound}`,
      requiresOverride: false,
    };
  }

  return {
    severity: 'valid',
    message: 'Round advancement is valid',
    requiresOverride: false,
  };
}



