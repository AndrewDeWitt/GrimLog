/**
 * Dossier Notification Dismiss API Endpoint
 *
 * POST /api/dossier/dismiss
 *
 * Marks a dossier's notification as dismissed so it won't show in the badge/toast anymore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

// Route segment config
export const dynamic = 'force-dynamic';

interface DismissRequest {
  dossierId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    // Parse request body
    const body: DismissRequest = await request.json();
    const { dossierId } = body;

    if (!dossierId) {
      return NextResponse.json(
        { error: 'Missing dossierId' },
        { status: 400 }
      );
    }

    // Update the dossier to mark notification as dismissed
    // Only update if it belongs to the user
    const result = await prisma.dossierGeneration.updateMany({
      where: {
        id: dossierId,
        userId: user.id,
        notificationDismissedAt: null, // Only if not already dismissed
      },
      data: {
        notificationDismissedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      dismissed: result.count > 0,
    });

  } catch (error) {
    console.error('Dossier dismiss error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    );
  }
}
