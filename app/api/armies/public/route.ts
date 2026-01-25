/**
 * GET /api/armies/public
 * 
 * Browse public army library
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

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
    const detachment = searchParams.get('detachment');
    // Safe numeric parsing with defaults
    const parsedMinPoints = parseInt(searchParams.get('minPoints') || '0');
    const minPoints = isNaN(parsedMinPoints) ? 0 : Math.max(0, parsedMinPoints);
    const parsedMaxPoints = parseInt(searchParams.get('maxPoints') || '10000');
    const maxPoints = isNaN(parsedMaxPoints) ? 10000 : parsedMaxPoints;
    const parsedLimit = parseInt(searchParams.get('limit') || '50');
    const limit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100);
    const parsedOffset = parseInt(searchParams.get('offset') || '0');
    const offset = isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // 'name', 'pointsLimit', 'createdAt'

    // Build filters
    const filters: any = {
      visibility: 'public',
      pointsLimit: {
        gte: minPoints,
        lte: maxPoints,
      },
    };

    // Search filter
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { detachment: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Faction filter (by faction ID or name)
    if (faction) {
      filters.OR = [
        ...(filters.OR || []),
        { factionId: faction },
        { faction: { name: { equals: faction, mode: 'insensitive' } } },
      ];
      
      // If there was no OR before, just use faction filter
      if (!search) {
        delete filters.OR;
        filters.OR = [
          { factionId: faction },
          { faction: { name: { equals: faction, mode: 'insensitive' } } },
        ];
      }
    }

    // Detachment filter
    if (detachment) {
      filters.detachment = { equals: detachment, mode: 'insensitive' };
    }

    // Build sort order
    let orderBy: any = { createdAt: 'desc' };
    switch (sortBy) {
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'pointsLimit':
        orderBy = { pointsLimit: 'desc' };
        break;
      case 'createdAt':
      default:
        orderBy = { createdAt: 'desc' };
    }

    // Query armies
    const [armies, totalCount] = await Promise.all([
      prisma.army.findMany({
        where: filters,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          faction: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              units: true,
            },
          },
        },
      }),
      prisma.army.count({ where: filters }),
    ]);

    // Get available factions for filtering
    const factions = await prisma.army.groupBy({
      by: ['factionId'],
      where: { visibility: 'public', factionId: { not: null } },
      _count: { factionId: true },
    });

    // Fetch faction names
    const factionDetails = await prisma.faction.findMany({
      where: { id: { in: factions.map(f => f.factionId!).filter(Boolean) } },
      select: { id: true, name: true },
    });

    // Get available detachments for filtering
    const detachments = await prisma.army.groupBy({
      by: ['detachment'],
      where: { visibility: 'public', detachment: { not: null } },
      _count: { detachment: true },
    });

    // Transform response
    const transformed = armies.map(army => ({
      id: army.id,
      name: army.name,
      faction: army.faction ? {
        id: army.faction.id,
        name: army.faction.name,
      } : null,
      detachment: army.detachment,
      pointsLimit: army.pointsLimit,
      unitCount: army._count.units,
      author: army.user ? {
        id: army.user.id,
        name: army.user.name || 'Anonymous',
      } : null,
      createdAt: army.createdAt,
      updatedAt: army.updatedAt,
    }));

    return NextResponse.json({
      armies: transformed,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + armies.length < totalCount,
      },
      filters: {
        factions: factionDetails.map(f => ({
          id: f.id,
          name: f.name,
          count: factions.find(x => x.factionId === f.id)?._count.factionId || 0,
        })),
        detachments: detachments
          .filter(d => d.detachment)
          .map(d => ({
            name: d.detachment!,
            count: d._count.detachment,
          })),
      },
    });
  } catch (error) {
    console.error('Error fetching public armies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
