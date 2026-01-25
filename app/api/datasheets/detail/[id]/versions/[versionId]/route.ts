/**
 * GET /api/datasheets/detail/[id]/versions/[versionId]
 * 
 * Get a specific version snapshot of a datasheet
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;

    // Verify datasheet exists
    const datasheet = await prisma.datasheet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        currentVersion: true,
      },
    });

    if (!datasheet) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }

    // Get the specific version
    // versionId can be either the UUID or the version number
    let version;
    
    // Try to parse as version number first
    const versionNumber = parseInt(versionId);
    if (!isNaN(versionNumber)) {
      version = await prisma.datasheetVersion.findUnique({
        where: {
          datasheetId_versionNumber: {
            datasheetId: id,
            versionNumber: versionNumber,
          },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }

    // If not found by version number, try by UUID
    if (!version) {
      version = await prisma.datasheetVersion.findFirst({
        where: {
          id: versionId,
          datasheetId: id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Parse the snapshot data
    let snapshotData;
    try {
      snapshotData = JSON.parse(version.snapshotData);
    } catch (e) {
      console.error('Error parsing snapshot data:', e);
      snapshotData = null;
    }

    return NextResponse.json({
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        versionLabel: version.versionLabel,
        changelog: version.changelog,
        createdAt: version.createdAt,
        createdBy: version.createdBy ? {
          id: version.createdBy.id,
          name: version.createdBy.name || version.createdBy.email,
        } : { id: null, name: 'System' },
        isCurrent: version.versionNumber === datasheet.currentVersion,
      },
      snapshot: snapshotData,
      datasheetId: datasheet.id,
      datasheetName: datasheet.name,
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
