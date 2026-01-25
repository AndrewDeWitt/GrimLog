/**
 * Dossier CRUD API Endpoint
 *
 * GET /api/dossier/[id] - Fetch a single dossier (respects visibility)
 * PATCH /api/dossier/[id] - Update visibility/name/content
 * DELETE /api/dossier/[id] - Delete user's own dossier
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth, requireAuth } from '@/lib/auth/apiAuth';
import { DossierStrategicAnalysis, ListSuggestion } from '@/lib/dossierAnalysis';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/dossier/[id]
 * Fetch a single dossier by ID
 * - Owner can always access
 * - Others can access if visibility is 'link' or 'public'
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getOptionalAuth();
    
    const dossier = await prisma.dossierGeneration.findUnique({
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
    
    if (!dossier) {
      return NextResponse.json(
        { error: 'Dossier not found' },
        { status: 404 }
      );
    }
    
    // Check access permissions
    const isOwner = user?.id === dossier.userId;
    const isAccessible = isOwner || dossier.visibility === 'link' || dossier.visibility === 'public';
    
    if (!isAccessible) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Increment view count for non-owner views
    if (!isOwner) {
      await prisma.dossierGeneration.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {}); // Don't fail on view count update
    }
    
    return NextResponse.json({
      ...dossier,
      isOwner,
    });
    
  } catch (error: any) {
    console.error('Dossier GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dossier' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dossier/[id]
 * Update dossier visibility, name, or content
 * - Only owner can update
 * - Content edits update strategicAnalysis and/or listSuggestions
 * - Optionally creates a version snapshot
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Verify ownership and get current data
    const dossier = await prisma.dossierGeneration.findUnique({
      where: { id },
      select: {
        userId: true,
        strategicAnalysis: true,
        listSuggestions: true,
        currentVersion: true,
      },
    });

    if (!dossier) {
      return NextResponse.json(
        { error: 'Dossier not found' },
        { status: 404 }
      );
    }

    if (dossier.userId !== user.id) {
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
      strategicAnalysis?: Partial<DossierStrategicAnalysis>;
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
        const existingDossier = await prisma.dossierGeneration.findUnique({
          where: { id },
          select: { shareToken: true },
        });

        if (!existingDossier?.shareToken) {
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
      const existingAnalysis = (dossier.strategicAnalysis as unknown as DossierStrategicAnalysis) || {};
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
      const nextVersionNumber = dossier.currentVersion + 1;

      // Create snapshot of current state (before the update)
      const snapshotData = JSON.stringify({
        strategicAnalysis: updateData.strategicAnalysis || dossier.strategicAnalysis,
        listSuggestions: updateData.listSuggestions || dossier.listSuggestions,
      });

      newVersion = await prisma.dossierVersion.create({
        data: {
          dossierId: id,
          versionNumber: nextVersionNumber,
          versionLabel: versionLabel || null,
          snapshotData,
          changelog: changelog || null,
          createdById: user.id,
        },
      });

      updateData.currentVersion = nextVersionNumber;
    }

    // Update dossier
    const updated = await prisma.dossierGeneration.update({
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
    console.error('Dossier PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update dossier' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dossier/[id]
 * Delete user's own dossier
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    
    // Verify ownership
    const dossier = await prisma.dossierGeneration.findUnique({
      where: { id },
      select: { userId: true },
    });
    
    if (!dossier) {
      return NextResponse.json(
        { error: 'Dossier not found' },
        { status: 404 }
      );
    }
    
    if (dossier.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Delete dossier
    await prisma.dossierGeneration.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Dossier DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete dossier' },
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

