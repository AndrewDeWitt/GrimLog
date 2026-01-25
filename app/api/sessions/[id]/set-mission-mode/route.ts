import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { player, mode } = await request.json();
    const { id: sessionId } = await params;

    if (!player || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields: player, mode' },
        { status: 400 }
      );
    }

    if (!['attacker', 'defender'].includes(player)) {
      return NextResponse.json(
        { error: 'Invalid player. Must be "attacker" or "defender"' },
        { status: 400 }
      );
    }

    if (!['fixed', 'tactical'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "fixed" or "tactical"' },
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

    // Update mission mode
    const modeField = player === 'attacker' ? 'attackerMissionMode' : 'defenderMissionMode';

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        [modeField]: mode
      }
    });

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `${player} set to ${mode} mission mode`,
        metadata: JSON.stringify({
          player,
          mode,
          previousMode: player === 'attacker' ? session.attackerMissionMode : session.defenderMissionMode
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `${player} mission mode set to ${mode}`
    });

  } catch (error: any) {
    console.error('Error setting mission mode:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to set mission mode' },
      { status: 500 }
    );
  }
}

