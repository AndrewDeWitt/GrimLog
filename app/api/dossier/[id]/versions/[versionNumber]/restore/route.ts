/**
 * Dossier Version Restore API
 *
 * POST /api/dossier/[id]/versions/[versionNumber]/restore - Restore to a previous version
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; versionNumber: string }>;
}

/**
 * POST /api/dossier/[id]/versions/[versionNumber]/restore
 * Restore dossier to a previous version
 * - Creates a new version with the restored content
 * - Only owner can restore versions
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, versionNumber: versionNumberStr } = await params;
    const versionNumber = parseInt(versionNumberStr, 10);
    const user = await requireAuth();

    if (isNaN(versionNumber)) {
      return NextResponse.json(
        { error: 'Invalid version number' },
        { status: 400 }
      );
    }

    // Verify ownership and get current data
    const dossier = await prisma.dossierGeneration.findUnique({
      where: { id },
      select: {
        userId: true,
        currentVersion: true,
        strategicAnalysis: true,
        listSuggestions: true,
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

    // Fetch the version to restore
    const versionToRestore = await prisma.dossierVersion.findUnique({
      where: {
        dossierId_versionNumber: {
          dossierId: id,
          versionNumber,
        },
      },
    });

    if (!versionToRestore) {
      // Check if this is a legacy dossier without a v1 snapshot
      if (versionNumber === 1) {
        return NextResponse.json(
          { error: 'Cannot restore to v1 - this dossier was created before version snapshots were enabled. The original AI-generated content is not available for restore.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Parse the snapshot data
    let snapshot;
    try {
      snapshot = JSON.parse(versionToRestore.snapshotData);
    } catch {
      return NextResponse.json(
        { error: 'Invalid version snapshot data' },
        { status: 500 }
      );
    }

    const nextVersionNumber = dossier.currentVersion + 1;

    // Create new version with restored content and update dossier in a transaction
    const [newVersion, updatedDossier] = await prisma.$transaction([
      // Create a new version recording this restore action
      prisma.dossierVersion.create({
        data: {
          dossierId: id,
          versionNumber: nextVersionNumber,
          versionLabel: `Restored from v${versionNumber}`,
          snapshotData: versionToRestore.snapshotData,
          changelog: `Restored content from version ${versionNumber}${versionToRestore.versionLabel ? ` (${versionToRestore.versionLabel})` : ''}`,
          createdById: user.id,
        },
      }),
      // Update dossier with restored content
      prisma.dossierGeneration.update({
        where: { id },
        data: {
          strategicAnalysis: snapshot.strategicAnalysis,
          listSuggestions: snapshot.listSuggestions,
          currentVersion: nextVersionNumber,
          isEdited: true,
          lastEditedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      dossier: updatedDossier,
      newVersion,
      restoredFromVersion: versionNumber,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Dossier version restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore version' },
      { status: 500 }
    );
  }
}
