/**
 * Brief Status API Endpoint
 *
 * GET /api/brief/status
 *
 * Returns the status of pending briefs and recently completed ones for notifications.
 * Used by the client to poll for completion and show notifications.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

// Route segment config
export const dynamic = 'force-dynamic';

// Timeout threshold: briefs stuck in pending/processing for longer than this are auto-failed
const BRIEF_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  try {
    // Require authentication
    const user = await requireAuth();

    // Get pending/processing briefs
    const pendingBriefs = await prisma.briefGeneration.findMany({
      where: {
        userId: user.id,
        status: { in: ['pending', 'processing'] },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        faction: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check for stuck briefs and auto-fail them
    const now = Date.now();
    const stuckBriefIds: string[] = [];
    const activeBriefs = pendingBriefs.filter(d => {
      const elapsed = now - new Date(d.createdAt).getTime();
      if (elapsed > BRIEF_TIMEOUT_MS) {
        stuckBriefIds.push(d.id);
        return false;
      }
      return true;
    });

    // Mark stuck briefs as failed in the background (don't block the response)
    if (stuckBriefIds.length > 0) {
      console.log(`⏰ Auto-failing ${stuckBriefIds.length} stuck brief(s):`, stuckBriefIds);
      prisma.briefGeneration.updateMany({
        where: { id: { in: stuckBriefIds } },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'Generation timed out. Please try again.',
        },
      }).catch(err => console.error('Failed to auto-fail stuck briefs:', err));
    }

    // Get completed briefs that haven't been dismissed (for notifications)
    // Only show completions from the last 24 hours to avoid flooding with old data
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentlyCompleted = await prisma.briefGeneration.findMany({
      where: {
        userId: user.id,
        status: 'completed',
        notificationDismissedAt: null, // Only show unacknowledged completions
        completedAt: { gte: oneDayAgo }, // Only last 24 hours
      },
      select: {
        id: true,
        faction: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 5, // Limit to prevent overwhelming UI
    });

    // Get failed briefs that haven't been dismissed (last 24 hours)
    const recentlyFailed = await prisma.briefGeneration.findMany({
      where: {
        userId: user.id,
        status: 'failed',
        notificationDismissedAt: null, // Only show unacknowledged failures
        completedAt: { gte: oneDayAgo }, // Only last 24 hours
      },
      select: {
        id: true,
        faction: true,
        completedAt: true,
        errorMessage: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      pending: activeBriefs.map(d => ({
        id: d.id,
        status: d.status,
        startedAt: d.createdAt.toISOString(),
        faction: d.faction,
      })),
      pendingCount: activeBriefs.length,
      recentlyCompleted: recentlyCompleted.map(d => ({
        id: d.id,
        faction: d.faction,
        completedAt: d.completedAt?.toISOString(),
      })),
      recentlyFailed: recentlyFailed.map(d => ({
        id: d.id,
        faction: d.faction,
        completedAt: d.completedAt?.toISOString(),
        errorMessage: d.errorMessage,
      })),
    });

  } catch (error) {
    console.error('Brief status error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get brief status' },
      { status: 500 }
    );
  }
}
