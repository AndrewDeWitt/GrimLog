/**
 * Brief List API Endpoint
 *
 * GET /api/brief/list - List user's brief history
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/brief/list
 * List user's brief history with pagination and filtering
 *
 * Query params:
 * - limit: number (default 20, max 100)
 * - offset: number (default 0)
 * - faction: string (optional filter)
 * - detachment: string (optional filter)
 * - minPoints: number (optional filter, default 0)
 * - maxPoints: number (optional filter, default 99999)
 * - sort: 'recent' | 'popular' | 'oldest' (default 'recent')
 * - search: string (optional, searches listName and tagline)
 * - visibility: 'private' | 'link' | 'public' (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const faction = searchParams.get('faction');
    const detachment = searchParams.get('detachment');
    const minPoints = parseInt(searchParams.get('minPoints') || '0');
    const maxPoints = parseInt(searchParams.get('maxPoints') || '99999');
    const sort = searchParams.get('sort') || 'recent';
    const search = searchParams.get('search');
    const visibility = searchParams.get('visibility');

    // Build where clause
    const where: any = { userId: user.id };
    if (faction) {
      where.faction = faction;
    }
    if (detachment) {
      where.detachment = detachment;
    }
    if (minPoints > 0 || maxPoints < 99999) {
      where.totalPoints = { gte: minPoints, lte: maxPoints };
    }
    if (visibility) {
      where.visibility = visibility;
    }
    if (search) {
      where.OR = [
        { listName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Determine ordering
    const orderBy = sort === 'popular'
      ? { viewCount: 'desc' as const }
      : sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };

    // Fetch briefs with count
    const [briefs, total] = await Promise.all([
      prisma.briefGeneration.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          faction: true,
          detachment: true,
          totalPoints: true,
          unitCount: true,
          modelCount: true,
          listName: true,
          spiritIconUrl: true,
          visibility: true,
          shareToken: true,
          viewCount: true,
          createdAt: true,
          strategicAnalysis: true,
        },
      }),
      prisma.briefGeneration.count({ where }),
    ]);

    // Transform to include summary data
    const briefsWithSummary = briefs.map((brief) => {
      const strategic = brief.strategicAnalysis as any;
      const viralInsights = strategic?.viralInsights;
      return {
        id: brief.id,
        faction: brief.faction,
        detachment: brief.detachment,
        totalPoints: brief.totalPoints,
        unitCount: brief.unitCount,
        modelCount: brief.modelCount,
        listName: brief.listName,
        spiritIconUrl: brief.spiritIconUrl,
        visibility: brief.visibility,
        shareToken: brief.shareToken,
        viewCount: brief.viewCount,
        createdAt: brief.createdAt,
        // Summary data
        executiveSummary: strategic?.executiveSummary || null,
        tagline: viralInsights?.tagline || null,
        archetype: strategic?.armyArchetype?.primary || null,
        // Additional data for rich cards
        playstyleBlend: viralInsights?.playstyleBlend || null,
        combatSpectrum: viralInsights?.combatSpectrum ?? null,
        totalWounds: strategic?.statisticalBreakdown?.totalWounds ?? null,
      };
    });

    // Get unique factions for filter dropdown
    const factions = await prisma.briefGeneration.findMany({
      where: { userId: user.id },
      select: { faction: true },
      distinct: ['faction'],
      orderBy: { faction: 'asc' },
    });

    // Get unique detachments for filter dropdown
    const detachments = await prisma.briefGeneration.findMany({
      where: { userId: user.id, detachment: { not: null } },
      select: { detachment: true },
      distinct: ['detachment'],
      orderBy: { detachment: 'asc' },
    });

    // Fetch faction metadata for icons
    const factionNames = factions.map(f => f.faction).filter(Boolean) as string[];
    const factionRecords = await prisma.faction.findMany({
      where: { name: { in: factionNames } },
      select: { name: true, metaData: true },
    });
    const factionMeta: Record<string, { iconUrl?: string }> = {};
    for (const f of factionRecords) {
      if (f.metaData) {
        try {
          const meta = typeof f.metaData === 'string' ? JSON.parse(f.metaData) : f.metaData;
          factionMeta[f.name] = { iconUrl: meta?.iconUrl };
        } catch {
          factionMeta[f.name] = {};
        }
      }
    }

    return NextResponse.json({
      briefs: briefsWithSummary,
      total,
      limit,
      offset,
      factions: factions.map(f => f.faction),
      detachments: detachments.map(d => d.detachment).filter(Boolean),
      factionMeta,
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Brief list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brief history' },
      { status: 500 }
    );
  }
}

