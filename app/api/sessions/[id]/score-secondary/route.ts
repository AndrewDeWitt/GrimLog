import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { 
  validateScoringAttempt, 
  getSecondaryData, 
  calculateVPForOption,
  updateDeckHistoryStatus,
  type MissionMode
} from '@/lib/secondaryRules';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { 
      player, 
      secondaryName, 
      vpAmount, 
      details, 
      option,
      optionIndex,
      missionMode: requestedMode 
    } = await request.json();
    const { id: sessionId } = await params;

    if (!player || !secondaryName || vpAmount === undefined) {
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

    // Get secondary data from JSON
    const secondary = getSecondaryData(secondaryName);
    if (!secondary) {
      return NextResponse.json(
        { error: 'Secondary objective not found' },
        { status: 404 }
      );
    }

    // Determine mission mode
    const missionMode: MissionMode = requestedMode || 
      (player === 'attacker' ? session.attackerMissionMode : session.defenderMissionMode) as MissionMode || 
      'tactical';

    // Comprehensive validation
    const validation = await validateScoringAttempt(
      sessionId,
      player,
      secondaryName,
      vpAmount,
      session.battleRound,
      session.currentTurn,
      missionMode
    );

    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        message: validation.error,
        alreadyScored: validation.error?.includes('already scored') || validation.error?.includes('cap reached')
      }, { status: 400 });
    }

    // Apply any VP cap from validation
    const finalVP = validation.cappedVP !== undefined ? validation.cappedVP : vpAmount;

    // Get progress field
    const progressField = player === 'attacker' ? 'attackerSecondaryProgress' : 'defenderSecondaryProgress';
    const currentProgressStr = session[progressField] as string | null;
    const currentProgress: any = currentProgressStr ? JSON.parse(currentProgressStr) : {};

    // Initialize progress if not exists
    if (!currentProgress[secondaryName]) {
      currentProgress[secondaryName] = {
        vp: 0,
        progress: {},
        details: [],
        turnScored: [],
        lastScored: new Date(),
        scoringHistory: []
      };
    }

    // Add VP
    currentProgress[secondaryName].vp += finalVP;
    currentProgress[secondaryName].lastScored = new Date();
    
    // Track turn
    if (!currentProgress[secondaryName].turnScored.includes(session.battleRound)) {
      currentProgress[secondaryName].turnScored.push(session.battleRound);
    }

    // Add details if provided
    if (details) {
      currentProgress[secondaryName].details.push(details);
    }

    // Add to scoring history
    currentProgress[secondaryName].scoringHistory.push({
      round: session.battleRound,
      turn: session.currentTurn,
      phase: session.currentPhase,
      vp: finalVP,
      option: option || details || `${finalVP}VP`,
      optionIndex,
      missionMode,
      timestamp: new Date()
    });

    // Update total VP counter
    const vpField = player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
    const currentTotalVP = session[vpField] || 0;
    const newTotalVP = currentTotalVP + finalVP;

    // Update database with both secondary progress and total VP
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        [progressField]: JSON.stringify(currentProgress),
        [vpField]: newTotalVP
      }
    });

    // Check if this secondary completes on score (Tactical missions)
    const needsCompletion = missionMode === 'tactical' && secondary.completesOnScore;
    
    if (needsCompletion) {
      // Update deck history to mark as scored
      await updateDeckHistoryStatus(sessionId, player, secondaryName, 'scored', session.battleRound);
    }

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'vp',
        phase: session.currentPhase,
        description: `${player} scored ${finalVP} VP for ${secondaryName}${validation.warning ? ` (${validation.warning})` : ''}`,
        metadata: JSON.stringify({
          player,
          secondary: secondaryName,
          vp: finalVP,
          requestedVP: vpAmount,
          wasCapped: validation.cappedVP !== undefined,
          details,
          missionMode,
          manual: true,
          completesOnScore: needsCompletion
        })
      }
    });

    // Build response message
    let message = `Scored ${finalVP} VP for ${secondaryName}`;
    if (validation.warning) {
      message += ` (${validation.warning})`;
    }
    if (needsCompletion) {
      message += ' - Tactical mission completed, draw a new card!';
    }

    return NextResponse.json({
      success: true,
      message,
      newVP: currentProgress[secondaryName].vp,
      totalVP: newTotalVP,
      warning: validation.warning,
      completesOnScore: needsCompletion
    });

  } catch (error: any) {
    console.error('Error scoring secondary:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to score secondary' },
      { status: 500 }
    );
  }
}
