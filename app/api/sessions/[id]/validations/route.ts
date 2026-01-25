import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getValidationStats } from '@/lib/validationLogger';
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

// GET - Fetch all validation events for a session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';
    
    // Verify access
    const hasAccess = await verifySessionAccess(sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const events = await prisma.validationEvent.findMany({
      where: {
        gameSessionId: sessionId
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (includeStats) {
      const stats = await getValidationStats(sessionId);
      return NextResponse.json({
        events,
        stats
      });
    }

    return NextResponse.json(events);
  } catch (error: any) {
    console.error('Error fetching validation events:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch validation events' },
      { status: 500 }
    );
  }
}
