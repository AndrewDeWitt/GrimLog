/**
 * GET /api/datasheets/public
 * 
 * Browse public datasheet library (community-shared and official datasheets)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

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

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const faction = searchParams.get('faction');
    const role = searchParams.get('role');
    const type = searchParams.get('type'); // 'official', 'community', 'all'
    // Safe numeric parsing with defaults
    const parsedLimit = parseInt(searchParams.get('limit') || '50');
    const limit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100);
    const parsedOffset = parseInt(searchParams.get('offset') || '0');
    const offset = isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);
    const sortBy = searchParams.get('sortBy') || 'name'; // 'name', 'pointsCost', 'createdAt', 'popularity'

    // Build filters
    const filters: any = {
      OR: [
        { visibility: 'public' },
        { isOfficial: true },
      ],
    };

    // Filter by type
    if (type === 'official') {
      filters.isOfficial = true;
      delete filters.OR;
    } else if (type === 'community') {
      filters.visibility = 'public';
      filters.isOfficial = false;
      delete filters.OR;
    }

    // Search filter
    if (search) {
      filters.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { keywords: { contains: search, mode: 'insensitive' } },
            { faction: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Faction filter
    if (faction) {
      if (filters.AND) {
        filters.AND.push({ faction: { equals: faction, mode: 'insensitive' } });
      } else {
        filters.faction = { equals: faction, mode: 'insensitive' };
      }
    }

    // Role filter
    if (role) {
      if (filters.AND) {
        filters.AND.push({ role: { equals: role, mode: 'insensitive' } });
      } else {
        filters.role = { equals: role, mode: 'insensitive' };
      }
    }

    // Build sort order
    let orderBy: any = { name: 'asc' };
    switch (sortBy) {
      case 'pointsCost':
        orderBy = { pointsCost: 'asc' };
        break;
      case 'createdAt':
        orderBy = { createdAt: 'desc' };
        break;
      case 'name':
      default:
        orderBy = { name: 'asc' };
    }

    // Query datasheets
    const [datasheets, totalCount] = await Promise.all([
      prisma.datasheet.findMany({
        where: filters,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          faction: true,
          subfaction: true,
          role: true,
          keywords: true,
          movement: true,
          toughness: true,
          save: true,
          invulnerableSave: true,
          wounds: true,
          leadership: true,
          objectiveControl: true,
          pointsCost: true,
          composition: true,
          isOfficial: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
          forkedFromId: true,
          forkedFrom: {
            select: {
              id: true,
              name: true,
            },
          },
          currentVersion: true,
          createdAt: true,
          _count: {
            select: {
              forks: true,
            },
          },
        },
      }),
      prisma.datasheet.count({ where: filters }),
    ]);

    // Get available factions for filtering
    const factions = await prisma.datasheet.groupBy({
      by: ['faction'],
      where: {
        OR: [
          { visibility: 'public' },
          { isOfficial: true },
        ],
      },
      _count: { faction: true },
      orderBy: { faction: 'asc' },
    });

    // Get available roles for filtering
    const roles = await prisma.datasheet.groupBy({
      by: ['role'],
      where: {
        OR: [
          { visibility: 'public' },
          { isOfficial: true },
        ],
      },
      _count: { role: true },
      orderBy: { role: 'asc' },
    });

    // Transform response
    const transformed = datasheets.map(ds => ({
      id: ds.id,
      name: ds.name,
      faction: ds.faction,
      subfaction: ds.subfaction,
      role: ds.role,
      keywords: safeJsonParse<string[]>(ds.keywords, []),
      movement: ds.movement,
      toughness: ds.toughness,
      save: ds.save,
      invulnerableSave: ds.invulnerableSave,
      wounds: ds.wounds,
      leadership: ds.leadership,
      objectiveControl: ds.objectiveControl,
      pointsCost: ds.pointsCost,
      composition: ds.composition,
      isOfficial: ds.isOfficial,
      author: ds.owner ? {
        id: ds.owner.id,
        name: ds.owner.name || 'Anonymous',
      } : null,
      forkedFrom: ds.forkedFrom ? {
        id: ds.forkedFrom.id,
        name: ds.forkedFrom.name,
      } : null,
      currentVersion: ds.currentVersion,
      createdAt: ds.createdAt,
      forkCount: ds._count.forks,
    }));

    return NextResponse.json({
      datasheets: transformed,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + datasheets.length < totalCount,
      },
      filters: {
        factions: factions.map(f => ({ name: f.faction, count: f._count.faction })),
        roles: roles.map(r => ({ name: r.role, count: r._count.role })),
      },
    });
  } catch (error) {
    console.error('Error fetching public datasheets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
