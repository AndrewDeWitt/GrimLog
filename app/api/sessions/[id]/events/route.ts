import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
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

// GET - Fetch all timeline events for a session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;
    
    // Verify access
    const hasAccess = await verifySessionAccess(sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const events = await prisma.timelineEvent.findMany({
      where: {
        gameSessionId: sessionId
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return NextResponse.json(events);
  } catch (error: any) {
    console.error('Error fetching timeline events:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST - Add timeline event to session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;
    const body = await request.json();
    
    // Verify ownership (only owner can add events)
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { userId: true }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const event = await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: body.eventType,
        phase: body.phase || null,
        description: body.description,
        metadata: body.metadata || null,
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date()
      }
    });

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error creating timeline event:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
