/**
 * Dossier Version Management API
 *
 * GET /api/dossier/[id]/versions - List all versions
 * POST /api/dossier/[id]/versions - Create a new version snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/dossier/[id]/versions
 * List all versions for a dossier
 * - Only owner can view versions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();

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

    // Fetch all versions
    const versions = await prisma.dossierVersion.findMany({
      where: { dossierId: id },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        versionLabel: true,
        changelog: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Check if v1 exists - for legacy dossiers created before versioning
    const hasV1 = versions.some((v) => v.versionNumber === 1);

    // If no v1 exists, synthesize one from the dossier's creation date
    let allVersions = versions.map((v) => ({
      ...v,
      isCurrent: v.versionNumber === dossier.currentVersion,
    }));

    if (!hasV1) {
      // Get dossier creation date for the synthetic v1
      const dossierFull = await prisma.dossierGeneration.findUnique({
        where: { id },
        select: { createdAt: true },
      });

      allVersions.push({
        id: `synthetic-v1-${id}`,
        versionNumber: 1,
        versionLabel: 'AI Generated',
        changelog: 'Original AI-generated dossier',
        createdAt: dossierFull?.createdAt || new Date(),
        createdBy: null,
        isCurrent: dossier.currentVersion === 1,
      });

      // Re-sort to ensure v1 appears at the bottom (versions are desc order)
      allVersions.sort((a, b) => b.versionNumber - a.versionNumber);
    }

    return NextResponse.json({
      versions: allVersions,
      currentVersion: dossier.currentVersion,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Dossier versions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dossier/[id]/versions
 * Create a new version snapshot of the current state
 * - Only owner can create versions
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();

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

    // Parse request body
    const body = await request.json();
    const { versionLabel, changelog } = body as {
      versionLabel?: string;
      changelog?: string;
    };

    const nextVersionNumber = dossier.currentVersion + 1;

    // Create snapshot of current state
    const snapshotData = JSON.stringify({
      strategicAnalysis: dossier.strategicAnalysis,
      listSuggestions: dossier.listSuggestions,
    });

    // Create version and update current version number in a transaction
    const [newVersion] = await prisma.$transaction([
      prisma.dossierVersion.create({
        data: {
          dossierId: id,
          versionNumber: nextVersionNumber,
          versionLabel: versionLabel || null,
          snapshotData,
          changelog: changelog || null,
          createdById: user.id,
        },
      }),
      prisma.dossierGeneration.update({
        where: { id },
        data: { currentVersion: nextVersionNumber },
      }),
    ]);

    return NextResponse.json({
      version: newVersion,
      currentVersion: nextVersionNumber,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Dossier version POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
