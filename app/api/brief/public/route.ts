/**
 * Public Brief Gallery API Endpoint
 * 
 * GET /api/brief/public - Browse public briefs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/brief/public
 * Browse public briefs with pagination and filtering
 *
 * Query params:
 * - limit: number (default 20, max 50)
 * - offset: number (default 0)
 * - faction: string (optional filter)
 * - detachment: string (optional filter)
 * - minPoints: number (optional filter)
 * - maxPoints: number (optional filter)
 * - sort: 'recent' | 'popular' | 'oldest' (default 'recent')
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting (IP-based for public endpoint)
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(null, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.publicGallery);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Parse query params with safe numeric parsing
    const { searchParams } = new URL(request.url);
    const parsedLimit = parseInt(searchParams.get('limit') || '20');
    const limit = isNaN(parsedLimit) ? 20 : Math.min(parsedLimit, 50);
    const parsedOffset = parseInt(searchParams.get('offset') || '0');
    const offset = isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);
    const faction = searchParams.get('faction');
    const detachment = searchParams.get('detachment');
    const parsedMinPoints = parseInt(searchParams.get('minPoints') || '0');
    const minPoints = isNaN(parsedMinPoints) ? 0 : Math.max(0, parsedMinPoints);
    const parsedMaxPoints = parseInt(searchParams.get('maxPoints') || '99999');
    const maxPoints = isNaN(parsedMaxPoints) ? 99999 : parsedMaxPoints;
    const sort = searchParams.get('sort') || 'recent';

    // Build where clause
    const where: any = { visibility: 'public' };
    if (faction) {
      where.faction = faction;
    }
    if (detachment) {
      where.detachment = detachment;
    }
    if (minPoints > 0 || maxPoints < 99999) {
      where.totalPoints = { gte: minPoints, lte: maxPoints };
    }

    // Determine ordering
    const orderBy = sort === 'popular'
      ? { viewCount: 'desc' as const }
      : sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };
    
    // Fetch public briefs with count
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
          shareToken: true,
          viewCount: true,
          createdAt: true,
          strategicAnalysis: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.briefGeneration.count({ where }),
    ]);
    
    // Transform to include just the summary data
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
        shareToken: brief.shareToken,
        viewCount: brief.viewCount,
        createdAt: brief.createdAt,
        // Summary data
        executiveSummary: strategic?.executiveSummary || null,
        tagline: viralInsights?.tagline || null,
        archetype: strategic?.armyArchetype?.primary || null,
        // Playstyle and combat data for rich gallery cards
        playstyleBlend: viralInsights?.playstyleBlend || null,
        combatSpectrum: viralInsights?.combatSpectrum ?? null,
        // Army stats from statistical breakdown
        totalWounds: strategic?.statisticalBreakdown?.totalWounds ?? null,
      };
    });
    
    // Get unique factions for filter dropdown
    const factions = await prisma.briefGeneration.findMany({
      where: { visibility: 'public' },
      select: { faction: true },
      distinct: ['faction'],
      orderBy: { faction: 'asc' },
    });

    // Get unique detachments for filter dropdown
    const detachments = await prisma.briefGeneration.findMany({
      where: { visibility: 'public', detachment: { not: null } },
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
    console.error('Public brief gallery error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public briefs' },
      { status: 500 }
    );
  }
}

