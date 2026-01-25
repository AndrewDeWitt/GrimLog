import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllMissions } from '@/lib/missionRules';
import { requireAuth } from '@/lib/auth/apiAuth';

/**
 * GET /api/missions
 * Fetch all available primary missions
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();
    
    // Get all missions
    const missions = await prisma.primaryMission.findMany({
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json({
      missions: missions.map(m => ({
        id: m.id,
        name: m.name,
        deploymentType: m.deploymentType,
        scoringPhase: m.scoringPhase,
        scoringTiming: m.scoringTiming,
        scoringFormula: m.scoringFormula,
        maxVP: m.maxVP,
        specialRules: m.specialRules,
        description: m.description
      }))
    });
    
  } catch (error: any) {
    console.error('Error fetching missions:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch missions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/missions
 * Set primary mission for a game session
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();
    
    const body = await request.json();
    const { sessionId, missionId } = body;
    
    if (!sessionId || !missionId) {
      return NextResponse.json(
        { error: 'Missing sessionId or missionId' },
        { status: 400 }
      );
    }
    
    // Verify mission exists
    const mission = await prisma.primaryMission.findUnique({
      where: { id: missionId }
    });
    
    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }
    
    // Update session
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        primaryMissionId: missionId,
        primaryVPScored: { attacker: {}, defender: {} }
      }
    });
    
    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: 'Command',
        description: `Primary mission set: ${mission.name}`,
        metadata: JSON.stringify({
          missionId: mission.id,
          missionName: mission.name,
          deploymentType: mission.deploymentType
        })
      }
    });
    
    return NextResponse.json({
      success: true,
      mission: {
        id: mission.id,
        name: mission.name,
        deploymentType: mission.deploymentType,
        scoringFormula: mission.scoringFormula
      }
    });
    
  } catch (error: any) {
    console.error('Error setting mission:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to set mission' },
      { status: 500 }
    );
  }
}


