/**
 * GET /api/sessions/[id]/stratagems
 * 
 * Fetch available stratagems for a game session, filtered by current phase.
 * Returns both core stratagems and faction/detachment-specific stratagems.
 * 
 * Query parameters:
 * - phase: Current game phase (Command, Movement, Shooting, Charge, Fight)
 * - turn: Whose turn it is (attacker, defender)
 * - player: Which player is viewing (attacker, defender)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface FormattedStratagem {
  id: string;
  name: string;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
  triggerPhase: string[];
  isReactive: boolean;
  source: 'core' | 'faction';
  faction?: string;
  detachment?: string;
  availableNow: boolean;
}

/**
 * Helper to verify session access (owner or shared)
 */
async function verifySessionAccess(sessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, sharedWith: true }
  });

  if (!session) return false;
  if (session.userId === userId) return true;

  // Check shared access
  if (session.sharedWith) {
    try {
      const sharedWith = JSON.parse(session.sharedWith);
      if (Array.isArray(sharedWith) && sharedWith.includes(userId)) {
        return true;
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  return false;
}

/**
 * Check if a stratagem is available for the current phase
 */
function isAvailableInPhase(triggerPhase: string[], currentPhase: string): boolean {
  if (!triggerPhase || triggerPhase.length === 0) return true;
  if (triggerPhase.includes('Any')) return true;
  return triggerPhase.some(phase => 
    phase.toLowerCase() === currentPhase.toLowerCase()
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const currentPhase = searchParams.get('phase') || 'Command';
    const currentTurn = searchParams.get('turn') || 'attacker';
    const viewingPlayer = searchParams.get('player') || 'attacker';

    // Verify access
    const hasAccess = await verifySessionAccess(sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get session with army info for both attacker and defender
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attackerArmy: {
          include: {
            player: true,
            faction: true,
          }
        },
        defenderArmy: {
          include: {
            player: true,
            faction: true,
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Extract faction info from attacker army
    const attackerFaction = session.attackerArmy?.faction?.name 
      || session.attackerArmy?.player?.faction 
      || null;
    const attackerDetachment = session.attackerArmy?.detachment || null;
    
    // Extract faction info from defender army (use linked army, fallback to text fields)
    const defenderFaction = session.defenderArmy?.faction?.name 
      || session.defenderArmy?.player?.faction 
      || session.defenderFaction 
      || null;
    const defenderDetachment = session.defenderArmy?.detachment || null;

    // Determine which faction to load stratagems for
    const targetFaction = viewingPlayer === 'attacker' ? attackerFaction : defenderFaction;
    const targetDetachment = viewingPlayer === 'attacker' ? attackerDetachment : defenderDetachment;

    // Is it this player's turn?
    const isPlayerTurn = currentTurn === viewingPlayer;

    // 1. Fetch Core Stratagems
    const coreStratagems = await prisma.coreStratagem.findMany({
      orderBy: [
        { cpCost: 'asc' },
        { name: 'asc' }
      ]
    });

    // 2. Fetch Faction Stratagems (if faction is known)
    let factionStratagems: any[] = [];
    if (targetFaction) {
      // Build faction filter
      const factionConditions: any[] = [
        { faction: { equals: targetFaction, mode: 'insensitive' } }
      ];

      // If it's a Space Marines subfaction, also include general Space Marines stratagems
      const spaceMarineSubfactions = [
        'Space Wolves', 'Blood Angels', 'Dark Angels', 'Black Templars',
        'Salamanders', 'Imperial Fists', 'Iron Hands', 'Ultramarines',
        'White Scars', 'Raven Guard', 'Deathwatch'
      ];
      
      const isSpaceMarineSubfaction = spaceMarineSubfactions.some(sf => 
        targetFaction.toLowerCase().includes(sf.toLowerCase())
      );
      
      if (isSpaceMarineSubfaction) {
        factionConditions.push(
          { faction: { equals: 'Space Marines', mode: 'insensitive' } }
        );
      }

      // Build the complete where condition
      const whereCondition: any = {
        OR: factionConditions
      };

      // If detachment is specified, STRICTLY filter to that detachment only
      if (targetDetachment) {
        whereCondition.detachment = { equals: targetDetachment, mode: 'insensitive' };
      }

      factionStratagems = await prisma.stratagemData.findMany({
        where: whereCondition,
        orderBy: [
          { cpCost: 'asc' },
          { name: 'asc' }
        ]
      });

      // If no detachment specified, deduplicate by name (keep first occurrence)
      if (!targetDetachment && factionStratagems.length > 0) {
        const seen = new Set<string>();
        factionStratagems = factionStratagems.filter(s => {
          const key = s.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    // 3. Format and filter stratagems
    const formattedCore: FormattedStratagem[] = coreStratagems.map(strat => {
      const triggerPhase = strat.triggerPhase 
        ? JSON.parse(strat.triggerPhase) 
        : ['Any'];
      
      // Determine availability
      const phaseMatch = isAvailableInPhase(triggerPhase, currentPhase);
      const turnMatch = strat.isReactive ? !isPlayerTurn : isPlayerTurn;
      const availableNow = phaseMatch && turnMatch;

      return {
        id: strat.id,
        name: strat.name,
        cpCost: strat.cpCost,
        type: strat.category,
        when: strat.when,
        target: strat.target,
        effect: strat.effect,
        triggerPhase,
        isReactive: strat.isReactive,
        source: 'core' as const,
        availableNow
      };
    });

    const formattedFaction: FormattedStratagem[] = factionStratagems.map(strat => {
      const triggerPhase = strat.triggerPhase 
        ? JSON.parse(strat.triggerPhase) 
        : ['Any'];
      
      // Determine availability
      const phaseMatch = isAvailableInPhase(triggerPhase, currentPhase);
      const turnMatch = strat.isReactive ? !isPlayerTurn : isPlayerTurn;
      const availableNow = phaseMatch && turnMatch;

      return {
        id: strat.id,
        name: strat.name,
        cpCost: strat.cpCost,
        type: strat.type,
        when: strat.when,
        target: strat.target,
        effect: strat.effect,
        triggerPhase,
        isReactive: strat.isReactive,
        source: 'faction' as const,
        faction: strat.faction,
        detachment: strat.detachment || undefined,
        availableNow
      };
    });

    // Sort: available stratagems first, then by CP cost
    const sortStratagems = (a: FormattedStratagem, b: FormattedStratagem) => {
      if (a.availableNow !== b.availableNow) {
        return a.availableNow ? -1 : 1;
      }
      if (a.cpCost !== b.cpCost) {
        return a.cpCost - b.cpCost;
      }
      return a.name.localeCompare(b.name);
    };

    formattedCore.sort(sortStratagems);
    formattedFaction.sort(sortStratagems);

    // Count available stratagems
    const coreAvailable = formattedCore.filter(s => s.availableNow).length;
    const factionAvailable = formattedFaction.filter(s => s.availableNow).length;

    return NextResponse.json({
      sessionId,
      currentPhase,
      currentTurn,
      viewingPlayer,
      targetFaction,
      targetDetachment,
      core: {
        stratagems: formattedCore,
        total: formattedCore.length,
        available: coreAvailable
      },
      faction: {
        stratagems: formattedFaction,
        total: formattedFaction.length,
        available: factionAvailable
      },
      totalAvailable: coreAvailable + factionAvailable
    });
  } catch (error: any) {
    console.error('Error fetching stratagems:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch stratagems' },
      { status: 500 }
    );
  }
}
