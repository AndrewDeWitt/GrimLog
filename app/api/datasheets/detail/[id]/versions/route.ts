/**
 * GET /api/datasheets/detail/[id]/versions
 * 
 * List all versions of a datasheet (version history)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify datasheet exists
    const datasheet = await prisma.datasheet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        currentVersion: true,
        isOfficial: true,
      },
    });

    if (!datasheet) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }

    // Get all versions
    const versions = await prisma.datasheetVersion.findMany({
      where: { datasheetId: id },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        versionLabel: true,
        changelog: true,
        createdAt: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      datasheetId: datasheet.id,
      datasheetName: datasheet.name,
      currentVersion: datasheet.currentVersion,
      isOfficial: datasheet.isOfficial,
      versions: versions.map(v => ({
        id: v.id,
        versionNumber: v.versionNumber,
        versionLabel: v.versionLabel,
        changelog: v.changelog,
        createdAt: v.createdAt,
        createdBy: v.createdBy ? {
          id: v.createdBy.id,
          name: v.createdBy.name || v.createdBy.email,
        } : { id: null, name: 'System' },
        isCurrent: v.versionNumber === datasheet.currentVersion,
      })),
      totalVersions: versions.length,
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
