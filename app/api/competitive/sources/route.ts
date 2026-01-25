/**
 * Competitive Context API: Sources Management
 * GET /api/competitive/sources - List all sources with filters
 * DELETE /api/competitive/sources?id=xxx - Delete a source
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface SourceFilters {
  status?: string;
  sourceType?: string;
  authorName?: string;
  gameVersion?: string;
  needsReview?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url);

    const filters: SourceFilters = {
      status: searchParams.get('status') || undefined,
      sourceType: searchParams.get('sourceType') || undefined,
      authorName: searchParams.get('authorName') || undefined,
      gameVersion: searchParams.get('gameVersion') || undefined,
      needsReview: searchParams.get('needsReview') === 'true' ? true : undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    };

    // Build where clause
    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.authorName) {
      where.authorName = { contains: filters.authorName, mode: 'insensitive' };
    }

    if (filters.gameVersion) {
      where.gameVersion = filters.gameVersion;
    }

    if (filters.search) {
      where.OR = [
        { contentTitle: { contains: filters.search, mode: 'insensitive' } },
        { authorName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Check if any contexts need review
    if (filters.needsReview) {
      where.OR = [
        { unitContexts: { some: { needsReview: true } } },
        { factionContexts: { some: { needsReview: true } } },
      ];
    }

    const skip = ((filters.page || 1) - 1) * (filters.limit || 20);

    const [sources, total] = await Promise.all([
      prisma.competitiveSource.findMany({
        where,
        include: {
          unitContexts: {
            select: {
              id: true,
              unitName: true,
              faction: true,
              tierRank: true,
              needsReview: true,
            },
          },
          factionContexts: {
            select: {
              id: true,
              factionName: true,
              metaTier: true,
              needsReview: true,
            },
          },
          _count: {
            select: {
              unitContexts: true,
              factionContexts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit || 20,
      }),
      prisma.competitiveSource.count({ where }),
    ]);

    // Transform to hide full content
    const transformedSources = sources.map((source) => ({
      ...source,
      contentLength: source.content?.length || 0,
      content: undefined,
      hasContent: !!source.content,
    }));

    return NextResponse.json({
      success: true,
      sources: transformedSources,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
    });
  });
}

export async function DELETE(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      );
    }

    // Check if source exists
    const source = await prisma.competitiveSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            unitContexts: true,
            factionContexts: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // Delete the source (cascades to contexts)
    await prisma.competitiveSource.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Source deleted successfully',
      deletedContexts: {
        units: source._count.unitContexts,
        factions: source._count.factionContexts,
      },
    });
  });
}

