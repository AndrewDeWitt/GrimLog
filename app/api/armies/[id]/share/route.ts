/**
 * POST /api/armies/[id]/share
 * GET /api/armies/[id]/share
 * 
 * Manage sharing settings for an army
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const ShareSettingsSchema = z.object({
  visibility: z.enum(['private', 'link', 'public']),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get current sharing settings
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const army = await prisma.army.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        userId: true,
        visibility: true,
        shareToken: true,
      },
    });

    if (!army) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    // Only owner can view sharing settings
    if (army.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Generate share URL if token exists
    const shareUrl = army.shareToken 
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/armies/shared/${army.shareToken}`
      : null;

    return NextResponse.json({
      armyId: army.id,
      armyName: army.name,
      visibility: army.visibility,
      shareToken: army.shareToken,
      shareUrl,
    });
  } catch (error: any) {
    console.error('Error getting share settings:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Update sharing settings
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = ShareSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { visibility } = validation.data;

    // Fetch existing army
    const existing = await prisma.army.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        userId: true,
        shareToken: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    // Only owner can update sharing
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update sharing settings' }, { status: 403 });
    }

    // Generate or revoke share token based on visibility
    let shareToken = existing.shareToken;
    
    if (visibility === 'link' && !shareToken) {
      // Generate new share token
      shareToken = randomBytes(16).toString('hex');
    } else if (visibility === 'private') {
      // Revoke share token
      shareToken = null;
    }

    // Update army
    const updated = await prisma.army.update({
      where: { id },
      data: {
        visibility,
        shareToken,
      },
      select: {
        id: true,
        name: true,
        visibility: true,
        shareToken: true,
      },
    });

    // Generate share URL if token exists
    const shareUrl = updated.shareToken 
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/armies/shared/${updated.shareToken}`
      : null;

    return NextResponse.json({
      success: true,
      armyId: updated.id,
      armyName: updated.name,
      visibility: updated.visibility,
      shareToken: updated.shareToken,
      shareUrl,
    });
  } catch (error: any) {
    console.error('Error updating share settings:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update sharing settings' }, { status: 500 });
  }
}
