/**
 * Dossier Version Detail API
 *
 * GET /api/dossier/[id]/versions/[versionNumber] - Get specific version snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; versionNumber: string }>;
}

/**
 * GET /api/dossier/[id]/versions/[versionNumber]
 * Get a specific version's snapshot data
 * - Only owner can view versions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Verify ownership
    const dossier = await prisma.dossierGeneration.findUnique({
      where: { id },
      select: { userId: true, currentVersion: true },
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

    // Fetch the specific version
    const version = await prisma.dossierVersion.findUnique({
      where: {
        dossierId_versionNumber: {
          dossierId: id,
          versionNumber,
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Parse the snapshot data
    let snapshot;
    try {
      snapshot = JSON.parse(version.snapshotData);
    } catch {
      snapshot = null;
    }

    return NextResponse.json({
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        versionLabel: version.versionLabel,
        changelog: version.changelog,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        isCurrent: version.versionNumber === dossier.currentVersion,
      },
      snapshot,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Dossier version GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}
