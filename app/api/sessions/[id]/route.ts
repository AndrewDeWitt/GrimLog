import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { z } from 'zod';

// Schema for allowed session update fields (prevents mass assignment)
const SessionUpdateSchema = z.object({
  // Game state fields that can be updated
  currentPhase: z.enum(['Command', 'Movement', 'Shooting', 'Charge', 'Fight']).optional(),
  currentTurn: z.enum(['attacker', 'defender']).optional(),
  battleRound: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  endedAt: z.string().datetime().nullable().optional(),

  // Resource tracking
  attackerCommandPoints: z.number().int().min(0).max(20).optional(),
  defenderCommandPoints: z.number().int().min(0).max(20).optional(),
  attackerVictoryPoints: z.number().int().min(0).max(100).optional(),
  defenderVictoryPoints: z.number().int().min(0).max(100).optional(),

  // Secondary objectives (JSON strings)
  attackerSecondaries: z.string().optional(),
  defenderSecondaries: z.string().optional(),

  // Mission info
  missionId: z.string().optional(),
  missionName: z.string().max(200).optional(),
  missionType: z.string().max(100).optional(),

  // Notes
  notes: z.string().max(10000).optional(),
}).strict(); // Reject any additional properties not in schema

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Helper to check if user owns or has shared access to a session
 */
export async function verifySessionAccess(sessionId: string, userId: string): Promise<{ session: any | null; hasAccess: boolean }> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      attackerArmy: {
        include: {
          player: true
        }
      },
      timelineEvents: {
        orderBy: { timestamp: 'asc' }
      },
      transcripts: {
        orderBy: { sequenceOrder: 'asc' }
      },
      objectiveMarkers: true
    }
  });

  if (!session) {
    return { session: null, hasAccess: false };
  }

  // Check ownership
  if (session.userId === userId) {
    return { session, hasAccess: true };
  }

  // Check shared access
  if (session.sharedWith) {
    try {
      const sharedWith = JSON.parse(session.sharedWith);
      if (Array.isArray(sharedWith) && sharedWith.includes(userId)) {
        return { session, hasAccess: true };
      }
    } catch (e) {
      // Invalid JSON, no shared access
    }
  }

  return { session, hasAccess: false };
}

// GET - Get specific session with full details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    const { session, hasAccess } = await verifySessionAccess(id, user.id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Error fetching session:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// PATCH - Update session (end game, update phase/round)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Validate request body against schema (prevents mass assignment)
    const parseResult = SessionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      console.error('Session update validation failed:', parseResult.error.issues);
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues.map((e: { message: string }) => e.message) },
        { status: 400 }
      );
    }

    // Verify ownership (only owner can update)
    const existingSession = await prisma.gameSession.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (existingSession.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use validated data only (extra fields stripped by schema)
    const session = await prisma.gameSession.update({
      where: { id },
      data: parseResult.data
    });

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Error updating session:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

// DELETE - Delete session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    // Verify ownership (only owner can delete)
    const existingSession = await prisma.gameSession.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (existingSession.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    await prisma.gameSession.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting session:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
