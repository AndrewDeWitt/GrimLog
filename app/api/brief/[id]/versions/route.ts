/**
 * Brief Version Management API
 *
 * GET /api/brief/[id]/versions - List all versions
 * POST /api/brief/[id]/versions - Create a new version snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/brief/[id]/versions
 * List all versions for a brief
 * - Only owner can view versions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Verify ownership
    const brief = await prisma.briefGeneration.findUnique({
      where: { id },
      select: { userId: true, currentVersion: true },
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

    // Fetch all versions
    const versions = await prisma.briefVersion.findMany({
      where: { briefId: id },
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

    // Check if v1 exists - for legacy briefs created before versioning
    const hasV1 = versions.some((v) => v.versionNumber === 1);

    // If no v1 exists, synthesize one from the brief's creation date
    let allVersions = versions.map((v) => ({
      ...v,
      isCurrent: v.versionNumber === brief.currentVersion,
    }));

    if (!hasV1) {
      // Get brief creation date for the synthetic v1
      const briefFull = await prisma.briefGeneration.findUnique({
        where: { id },
        select: { createdAt: true },
      });

      allVersions.push({
        id: `synthetic-v1-${id}`,
        versionNumber: 1,
        versionLabel: 'AI Generated',
        changelog: 'Original AI-generated brief',
        createdAt: briefFull?.createdAt || new Date(),
        createdBy: null,
        isCurrent: brief.currentVersion === 1,
      });

      // Re-sort to ensure v1 appears at the bottom (versions are desc order)
      allVersions.sort((a, b) => b.versionNumber - a.versionNumber);
    }

    return NextResponse.json({
      versions: allVersions,
      currentVersion: brief.currentVersion,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Brief versions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/brief/[id]/versions
 * Create a new version snapshot of the current state
 * - Only owner can create versions
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Verify ownership and get current data
    const brief = await prisma.briefGeneration.findUnique({
      where: { id },
      select: {
        userId: true,
        currentVersion: true,
        strategicAnalysis: true,
        listSuggestions: true,
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

    // Parse request body
    const body = await request.json();
    const { versionLabel, changelog } = body as {
      versionLabel?: string;
      changelog?: string;
    };

    const nextVersionNumber = brief.currentVersion + 1;

    // Create snapshot of current state
    const snapshotData = JSON.stringify({
      strategicAnalysis: brief.strategicAnalysis,
      listSuggestions: brief.listSuggestions,
    });

    // Create version and update current version number in a transaction
    const [newVersion] = await prisma.$transaction([
      prisma.briefVersion.create({
        data: {
          briefId: id,
          versionNumber: nextVersionNumber,
          versionLabel: versionLabel || null,
          snapshotData,
          changelog: changelog || null,
          createdById: user.id,
        },
      }),
      prisma.briefGeneration.update({
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
    console.error('Brief version POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
