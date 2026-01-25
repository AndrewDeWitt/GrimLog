import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

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
    
    const session = await prisma.gameSession.update({
      where: { id },
      data: body
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
