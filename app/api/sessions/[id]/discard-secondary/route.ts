import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { player, secondaryName } = await request.json();
    const { id: sessionId } = await params;

    if (!player || !secondaryName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch session
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check authorization
    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get current state
    const secondariesField = player === 'attacker' ? 'attackerSecondaries' : 'defenderSecondaries';
    const discardedField = player === 'attacker' ? 'attackerDiscardedSecondaries' : 'defenderDiscardedSecondaries';
    const extraCPField = player === 'attacker' ? 'attackerExtraCPGainedThisTurn' : 'defenderExtraCPGainedThisTurn';
    const cpField = player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';

    const currentSecondaries: string[] = session[secondariesField] 
      ? JSON.parse(session[secondariesField] as string) 
      : [];
    
    const currentDiscarded: string[] = session[discardedField]
      ? JSON.parse(session[discardedField] as string)
      : [];

    const hasGainedExtraCP = session[extraCPField] as boolean;
    const currentCP = session[cpField] as number;

    // Check if secondary exists
    if (!currentSecondaries.includes(secondaryName)) {
      return NextResponse.json(
        { error: 'Secondary not found in current selection' },
        { status: 400 }
      );
    }

    // Remove from current secondaries
    const updatedSecondaries = currentSecondaries.filter(s => s !== secondaryName);
    
    // Add to discarded list
    const updatedDiscarded = [...currentDiscarded, secondaryName];

    // Determine if we should give CP
    const shouldGiveCP = !hasGainedExtraCP;
    const newCP = shouldGiveCP ? currentCP + 1 : currentCP;
    const newExtraCPFlag = shouldGiveCP ? true : hasGainedExtraCP;

    // Update database
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        [secondariesField]: JSON.stringify(updatedSecondaries),
        [discardedField]: JSON.stringify(updatedDiscarded),
        [cpField]: newCP,
        [extraCPField]: newExtraCPFlag
      }
    });

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `${player} discarded "${secondaryName}"${shouldGiveCP ? ' (+1 CP)' : ' (no CP - already gained extra this turn)'}`,
        metadata: JSON.stringify({
          player,
          secondaryName,
          cpGained: shouldGiveCP ? 1 : 0,
          newCP
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: shouldGiveCP 
        ? `Discarded "${secondaryName}" (+1 CP, ${newCP} CP total)`
        : `Discarded "${secondaryName}" (no CP - already gained extra this turn)`,
      cpGained: shouldGiveCP ? 1 : 0,
      newCP
    });

  } catch (error: any) {
    console.error('Error discarding secondary:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to discard secondary' },
      { status: 500 }
    );
  }
}

