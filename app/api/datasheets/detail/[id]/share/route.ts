/**
 * POST /api/datasheets/detail/[id]/share
 * GET /api/datasheets/detail/[id]/share
 * 
 * Manage sharing settings for a datasheet
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { ShareSettingsSchema } from '@/lib/datasheetValidation';
import { randomBytes } from 'crypto';

/**
 * GET - Get current sharing settings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const datasheet = await prisma.datasheet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        isOfficial: true,
        visibility: true,
        shareToken: true,
      },
    });

    if (!datasheet) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }

    // Only owner can view sharing settings (official datasheets are always public)
    if (datasheet.ownerId !== user.id && !datasheet.isOfficial) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Generate share URL if token exists
    const shareUrl = datasheet.shareToken 
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/datasheets/shared/${datasheet.shareToken}`
      : null;

    return NextResponse.json({
      datasheetId: datasheet.id,
      datasheetName: datasheet.name,
      visibility: datasheet.visibility,
      shareToken: datasheet.shareToken,
      shareUrl,
      isOfficial: datasheet.isOfficial,
    });
  } catch (error) {
    console.error('Error getting share settings:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Update sharing settings (visibility, generate/revoke share link)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Fetch existing datasheet
    const existing = await prisma.datasheet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        isOfficial: true,
        shareToken: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }

    // Only owner can update sharing (cannot change official datasheets)
    if (existing.ownerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update sharing settings' }, { status: 403 });
    }

    if (existing.isOfficial) {
      return NextResponse.json({ error: 'Cannot change sharing settings for official datasheets' }, { status: 403 });
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
    // For 'public', keep existing token or don't require one

    // Update datasheet
    const updated = await prisma.datasheet.update({
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
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/datasheets/shared/${updated.shareToken}`
      : null;

    return NextResponse.json({
      success: true,
      datasheetId: updated.id,
      datasheetName: updated.name,
      visibility: updated.visibility,
      shareToken: updated.shareToken,
      shareUrl,
    });
  } catch (error) {
    console.error('Error updating share settings:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update sharing settings' }, { status: 500 });
  }
}
