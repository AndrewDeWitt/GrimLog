import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

/**
 * POST /api/sessions/[id]/restore-secondary
 * 
 * Restores a discarded secondary back to available pool
 * Does NOT refund CP - just removes from discarded list
 */
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

    // Get current discarded list
    const discardedField = player === 'attacker' ? 'attackerDiscardedSecondaries' : 'defenderDiscardedSecondaries';
    const currentDiscarded: string[] = session[discardedField]
      ? JSON.parse(session[discardedField] as string)
      : [];

    // Check if secondary is in discarded list
    if (!currentDiscarded.includes(secondaryName)) {
      return NextResponse.json(
        { error: 'Secondary not found in discarded list' },
        { status: 400 }
      );
    }

    // Remove from discarded list
    const updatedDiscarded = currentDiscarded.filter(s => s !== secondaryName);

    // Update database
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        [discardedField]: JSON.stringify(updatedDiscarded)
      }
    });

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `${player} restored "${secondaryName}" from discarded pile`,
        metadata: JSON.stringify({
          player,
          secondaryName,
          action: 'restore'
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Restored "${secondaryName}" - can be selected again`
    });

  } catch (error: any) {
    console.error('Error restoring secondary:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to restore secondary' },
      { status: 500 }
    );
  }
}

