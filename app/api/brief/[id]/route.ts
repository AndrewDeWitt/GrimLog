/**
 * Brief CRUD API Endpoint
 *
 * GET /api/brief/[id] - Fetch a single brief (respects visibility)
 * PATCH /api/brief/[id] - Update visibility/name/content
 * DELETE /api/brief/[id] - Delete user's own brief
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth, requireAuth } from '@/lib/auth/apiAuth';
import { BriefStrategicAnalysis, ListSuggestion } from '@/lib/briefAnalysis';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/brief/[id]
 * Fetch a single brief by ID
 * - Owner can always access
 * - Others can access if visibility is 'link' or 'public'
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getOptionalAuth();
    
    const brief = await prisma.briefGeneration.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }
    
    // Check access permissions
    const isOwner = user?.id === brief.userId;
    const isAccessible = isOwner || brief.visibility === 'link' || brief.visibility === 'public';
    
    if (!isAccessible) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Increment view count for non-owner views
    if (!isOwner) {
      await prisma.briefGeneration.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {}); // Don't fail on view count update
    }
    
    return NextResponse.json({
      ...brief,
      isOwner,
    });
    
  } catch (error: any) {
    console.error('Brief GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brief' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/brief/[id]
 * Update brief visibility, name, or content
 * - Only owner can update
 * - Content edits update strategicAnalysis and/or listSuggestions
 * - Optionally creates a version snapshot
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Verify ownership and get current data
    const brief = await prisma.briefGeneration.findUnique({
      where: { id },
      select: {
        userId: true,
        strategicAnalysis: true,
        listSuggestions: true,
        currentVersion: true,
      },
    });

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    if (brief.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Parse update data
    const body = await request.json();
    const {
      visibility,
      listName,
      strategicAnalysis,
      listSuggestions,
      createVersion,
      versionLabel,
      changelog,
    } = body as {
      visibility?: string;
      listName?: string;
      strategicAnalysis?: Partial<BriefStrategicAnalysis>;
      listSuggestions?: ListSuggestion[];
      createVersion?: boolean;
      versionLabel?: string;
      changelog?: string;
    };

    // Validate visibility
    if (visibility && !['private', 'link', 'public'].includes(visibility)) {
      return NextResponse.json(
        { error: 'Invalid visibility. Must be private, link, or public.' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    let isContentEdit = false;

    if (visibility !== undefined) {
      updateData.visibility = visibility;

      // Generate share token if setting to link or public (and no token exists)
      if (visibility === 'link' || visibility === 'public') {
        const existingBrief = await prisma.briefGeneration.findUnique({
          where: { id },
          select: { shareToken: true },
        });

        if (!existingBrief?.shareToken) {
          updateData.shareToken = generateShareToken();
        }
      }
    }

    if (listName !== undefined) {
      updateData.listName = listName || null;
    }

    // Handle content edits (strategicAnalysis)
    if (strategicAnalysis !== undefined) {
      isContentEdit = true;
      // Merge with existing strategicAnalysis
      const existingAnalysis = (brief.strategicAnalysis as unknown as BriefStrategicAnalysis) || {};
      updateData.strategicAnalysis = {
        ...existingAnalysis,
        ...strategicAnalysis,
      };
    }

    // Handle list suggestions replacement
    if (listSuggestions !== undefined) {
      isContentEdit = true;
      updateData.listSuggestions = listSuggestions;
    }

    // Mark as edited if content changed
    if (isContentEdit) {
      updateData.isEdited = true;
      updateData.lastEditedAt = new Date();
    }

    // Create version snapshot if requested
    let newVersion = null;
    if (createVersion && isContentEdit) {
      const nextVersionNumber = brief.currentVersion + 1;

      // Create snapshot of current state (before the update)
      const snapshotData = JSON.stringify({
        strategicAnalysis: updateData.strategicAnalysis || brief.strategicAnalysis,
        listSuggestions: updateData.listSuggestions || brief.listSuggestions,
      });

      newVersion = await prisma.briefVersion.create({
        data: {
          briefId: id,
          versionNumber: nextVersionNumber,
          versionLabel: versionLabel || null,
          snapshotData,
          changelog: changelog || null,
          createdById: user.id,
        },
      });

      updateData.currentVersion = nextVersionNumber;
    }

    // Update brief
    const updated = await prisma.briefGeneration.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      version: newVersion,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Brief PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update brief' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/brief/[id]
 * Delete user's own brief
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    
    // Verify ownership
    const brief = await prisma.briefGeneration.findUnique({
      where: { id },
      select: { userId: true },
    });
    
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }
    
    if (brief.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Delete brief
    await prisma.briefGeneration.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Brief DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete brief' },
      { status: 500 }
    );
  }
}

/**
 * Generate a URL-safe share token
 */
function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

