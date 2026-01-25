/**
 * GET /api/armies/import/[shareToken] - Preview shared army
 * POST /api/armies/import/[shareToken] - Import (copy) shared army
 * 
 * Import an army via share link
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, getOptionalAuth } from '@/lib/auth/apiAuth';

interface RouteParams {
  params: Promise<{ shareToken: string }>;
}

/**
 * GET - Preview the shared army (no auth required)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { shareToken } = await params;

    // Find army by share token
    const army = await prisma.army.findFirst({
      where: {
        shareToken,
        OR: [
          { visibility: 'link' },
          { visibility: 'public' },
        ],
      },
      include: {
        faction: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true },
        },
        units: {
          include: {
            fullDatasheet: {
              select: {
                id: true,
                name: true,
                role: true,
                keywords: true,
              },
            },
          },
        },
      },
    });

    if (!army) {
      return NextResponse.json({ error: 'Shared army not found or link expired' }, { status: 404 });
    }

    // Transform to clean format
    const transformed = {
      id: army.id,
      name: army.name,
      faction: army.faction ? {
        id: army.faction.id,
        name: army.faction.name,
      } : null,
      detachment: army.detachment,
      pointsLimit: army.pointsLimit,
      author: army.user ? {
        id: army.user.id,
        name: army.user.name || 'Anonymous',
      } : null,
      units: army.units.map(unit => {
        let keywords: string[] = [];
        let wargear: any[] = [];
        let enhancements: any[] = [];
        try { keywords = JSON.parse(unit.keywords || '[]'); } catch { /* use default */ }
        try { if (unit.wargear) wargear = JSON.parse(unit.wargear); } catch { /* use default */ }
        try { if (unit.enhancements) enhancements = JSON.parse(unit.enhancements); } catch { /* use default */ }
        return {
          name: unit.name,
          datasheet: unit.datasheet,
          pointsCost: unit.pointsCost,
          modelCount: unit.modelCount,
          keywords,
          wargear,
          enhancements,
          datasheetInfo: unit.fullDatasheet ? {
            id: unit.fullDatasheet.id,
            name: unit.fullDatasheet.name,
            role: unit.fullDatasheet.role,
          } : null,
        };
      }),
      totalPoints: army.units.reduce((sum, u) => sum + u.pointsCost, 0),
      unitCount: army.units.length,
      createdAt: army.createdAt,
    };

    // Check if user is authenticated to show import button
    const user = await getOptionalAuth();

    return NextResponse.json({
      army: transformed,
      canImport: !!user,
      importMessage: user 
        ? 'Click Import to copy this army to your collection'
        : 'Sign in to import this army to your collection',
    });
  } catch (error) {
    console.error('Error fetching shared army:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Import (copy) the shared army (auth required)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { shareToken } = await params;

    // Find army by share token
    const source = await prisma.army.findFirst({
      where: {
        shareToken,
        OR: [
          { visibility: 'link' },
          { visibility: 'public' },
        ],
      },
      include: {
        player: true,
        units: true,
        stratagems: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'Shared army not found or link expired' }, { status: 404 });
    }

    // Create imported army
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique name
      let importedName = `${source.name} (Imported)`;
      const existing = await tx.army.findFirst({
        where: {
          name: importedName,
          userId: user.id,
        },
      });

      if (existing) {
        importedName = `${source.name} (Imported ${Date.now().toString(36)})`;
      }

      // Create or find player for the importing user
      let player = await tx.player.findFirst({
        where: {
          userId: user.id,
          faction: source.player?.faction || 'Unknown',
        },
      });

      if (!player) {
        player = await tx.player.create({
          data: {
            name: user.email?.split('@')[0] || 'Player',
            faction: source.player?.faction || 'Unknown',
            userId: user.id,
          },
        });
      }

      // Create the imported army
      const imported = await tx.army.create({
        data: {
          name: importedName,
          playerId: player.id,
          userId: user.id,
          factionId: source.factionId,
          pointsLimit: source.pointsLimit,
          detachment: source.detachment,
          characterAttachments: source.characterAttachments,
          visibility: 'private',
        },
      });

      // Copy units
      for (const unit of source.units) {
        await tx.unit.create({
          data: {
            name: unit.name,
            datasheet: unit.datasheet,
            keywords: unit.keywords,
            goal: unit.goal,
            armyId: imported.id,
            pointsCost: unit.pointsCost,
            modelCount: unit.modelCount,
            composition: unit.composition,
            wargear: unit.wargear,
            enhancements: unit.enhancements,
            weapons: unit.weapons,
            abilities: unit.abilities,
            needsReview: false,
            datasheetId: unit.datasheetId,
          },
        });
      }

      // Copy manual stratagems (not faction reference ones)
      for (const stratagem of source.stratagems) {
        await tx.stratagem.create({
          data: {
            name: stratagem.name,
            cpCost: stratagem.cpCost,
            phase: stratagem.phase,
            description: stratagem.description,
            keywords: stratagem.keywords,
            armyId: imported.id,
          },
        });
      }

      return imported;
    });

    // Get full army with counts
    const fullArmy = await prisma.army.findUnique({
      where: { id: result.id },
      include: {
        _count: {
          select: { units: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Army imported successfully',
      army: {
        id: result.id,
        name: result.name,
        importedFromId: source.id,
        importedFromName: source.name,
        unitCount: fullArmy?._count.units || 0,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error importing shared army:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required to import armies' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to import army' }, { status: 500 });
  }
}
