/**
 * Turn Progression Helper Functions
 * 
 * Handles turn order logic for battle rounds where each round consists of two turns:
 * 1. First player's turn
 * 2. Second player's turn
 * 
 * After the second player completes their turn, the round advances.
 */

export type PlayerTurn = 'attacker' | 'defender';

export interface TurnState {
  round: number;
  playerTurn: PlayerTurn;
  phase: string;
}

export interface SessionTurnData {
  battleRound: number;
  currentTurn: string;
  currentPhase: string;
  firstTurn: string;
}

/**
 * Get who goes first each round
 */
export function getFirstPlayer(session: SessionTurnData): PlayerTurn {
  return session.firstTurn as PlayerTurn;
}

/**
 * Get who goes second each round
 */
export function getSecondPlayer(session: SessionTurnData): PlayerTurn {
  const firstTurn = getFirstPlayer(session);
  return firstTurn === 'attacker' ? 'defender' : 'attacker';
}

/**
 * Check if current turn is the first turn of the round
 */
export function isFirstTurn(session: SessionTurnData): boolean {
  const firstTurn = getFirstPlayer(session);
  return session.currentTurn === firstTurn;
}

/**
 * Check if current turn is the second turn of the round
 */
export function isSecondTurn(session: SessionTurnData): boolean {
  return !isFirstTurn(session);
}

/**
 * Get the next turn state (handles round advancement)
 * When second player finishes their turn, advances to next round
 */
export function getNextTurn(session: SessionTurnData): TurnState {
  const firstTurn = getFirstPlayer(session);
  const secondPlayer = getSecondPlayer(session);
  const currentIsFirst = isFirstTurn(session);
  
  if (currentIsFirst) {
    // First player's turn -> switch to second player, same round
    return {
      round: session.battleRound,
      playerTurn: secondPlayer,
      phase: 'Command' // Always reset to Command on turn change
    };
  } else {
    // Second player's turn -> advance to next round, first player goes
    return {
      round: session.battleRound + 1,
      playerTurn: firstTurn,
      phase: 'Command'
    };
  }
}

/**
 * Get the previous turn state (for error correction)
 * When first player's turn, goes back to previous round's second player
 */
export function getPreviousTurn(session: SessionTurnData): TurnState {
  const firstTurn = getFirstPlayer(session);
  const secondPlayer = getSecondPlayer(session);
  const currentIsFirst = isFirstTurn(session);
  
  if (currentIsFirst) {
    // First player's turn -> go back to previous round's second player
    const previousRound = Math.max(1, session.battleRound - 1);
    return {
      round: previousRound,
      playerTurn: secondPlayer,
      phase: 'Command'
    };
  } else {
    // Second player's turn -> go back to first player, same round
    return {
      round: session.battleRound,
      playerTurn: firstTurn,
      phase: 'Command'
    };
  }
}

/**
 * Format turn display text for UI using attacker/defender terminology
 * Returns strings like "ROUND 1 - ATTACKER" or "ROUND 1 - DEFENDER"
 */
export function formatTurnDisplay(session: SessionTurnData): {
  text: string;
  isPlayerTurn: boolean;
  isAttacker: boolean;
  turnPosition: 1 | 2;
} {
  const isPlayerTurn = session.currentTurn === 'attacker';
  const firstTurn = getFirstPlayer(session);
  const isAttacker = session.currentTurn === firstTurn;
  const turnText = isAttacker ? 'ATTACKER' : 'DEFENDER';
  const turnPosition = getTurnPosition(session);
  
  return {
    text: `ROUND ${session.battleRound} - ${turnText}`,
    isPlayerTurn,
    isAttacker,
    turnPosition
  };
}

/**
 * Get turn position within the round (1st or 2nd)
 */
export function getTurnPosition(session: SessionTurnData): 1 | 2 {
  return isFirstTurn(session) ? 1 : 2;
}

/**
 * Format detailed turn context for AI/logging
 */
export function formatTurnContext(session: SessionTurnData): string {
  const position = getTurnPosition(session);
  const positionText = position === 1 ? '1st' : '2nd';
  const playerText = session.currentTurn === 'attacker' ? 'Player' : 'Opponent';
  const firstTurn = getFirstPlayer(session);
  const firstTurnText = firstTurn === 'attacker' ? 'Player' : 'Opponent';
  
  return `Round ${session.battleRound}, ${playerText}'s turn (${positionText} turn of round). ${firstTurnText} goes first each round.`;
}

/**
 * Check if advancing turn would increment the round
 */
export function willAdvanceRound(session: SessionTurnData): boolean {
  return isSecondTurn(session);
}

/**
 * Get a specific turn state
 */
export function getSpecificTurn(round: number, playerTurn: PlayerTurn): TurnState {
  return {
    round: Math.max(1, round),
    playerTurn,
    phase: 'Command'
  };
}

