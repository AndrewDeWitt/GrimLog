import { prisma } from './prisma';

export interface CPSpentData {
  player: {
    round: number;
    total: number;
  };
  opponent: {
    round: number;
    total: number;
  };
}

/**
 * Calculate CP spent by player and opponent for current round and total game
 * 
 * Tracks CP spending from:
 * - StratagemLog: CP spent on stratagems
 * - TimelineEvent: Manual CP adjustments (negative changes only)
 */
export async function calculateCPSpent(
  sessionId: string,
  battleRound: number
): Promise<CPSpentData> {
  // Find the timestamp when the current round started
  // Look for phase change events to "Command" phase for the current round
  const roundStartEvents = await prisma.timelineEvent.findMany({
    where: {
      gameSessionId: sessionId,
      eventType: 'phase',
      phase: 'Command',
      description: {
        contains: `Round ${battleRound}`
      }
    },
    orderBy: {
      timestamp: 'asc'
    },
    take: 1
  });

  const roundStartTime = roundStartEvents[0]?.timestamp || new Date(0);

  // Get all stratagem logs
  const allStratagems = await prisma.stratagemLog.findMany({
    where: {
      gameSessionId: sessionId
    }
  });

  // Get all timeline events with CP changes (manual adjustments)
  const allCPEvents = await prisma.timelineEvent.findMany({
    where: {
      gameSessionId: sessionId,
      eventType: 'custom',
      metadata: {
        not: null
      }
    }
  });

  // Calculate totals
  let playerTotal = 0;
  let opponentTotal = 0;
  let playerRound = 0;
  let opponentRound = 0;

  // Count stratagem CP costs
  for (const stratagem of allStratagems) {
    const cost = stratagem.cpCost || 0;
    
    // Map 'attacker' to 'player' and 'defender' to 'opponent' for the return object
    if (stratagem.usedBy === 'attacker' || stratagem.usedBy === 'player') {
      playerTotal += cost;
      if (stratagem.timestamp >= roundStartTime) {
        playerRound += cost;
      }
    } else if (stratagem.usedBy === 'defender' || stratagem.usedBy === 'opponent') {
      opponentTotal += cost;
      if (stratagem.timestamp >= roundStartTime) {
        opponentRound += cost;
      }
    }
  }

  // Count manual CP adjustments (only negative changes = spending)
  for (const event of allCPEvents) {
    if (!event.metadata) continue;
    
    try {
      const metadata = JSON.parse(event.metadata);
      
      // Check if this is a CP change event
      if (metadata.change !== undefined && metadata.player) {
        const change = metadata.change;
        
        // Only count negative changes (spending)
        if (change < 0) {
          const spent = Math.abs(change);
          
          if (metadata.player === 'attacker' || metadata.player === 'player') {
            playerTotal += spent;
            if (event.timestamp >= roundStartTime) {
              playerRound += spent;
            }
          } else if (metadata.player === 'defender' || metadata.player === 'opponent') {
            opponentTotal += spent;
            if (event.timestamp >= roundStartTime) {
              opponentRound += spent;
            }
          }
        }
      }
    } catch (e) {
      // Skip malformed JSON
      continue;
    }
  }

  return {
    player: {
      round: playerRound,
      total: playerTotal
    },
    opponent: {
      round: opponentRound,
      total: opponentTotal
    }
  };
}

