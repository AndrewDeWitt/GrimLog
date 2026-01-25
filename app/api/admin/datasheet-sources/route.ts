/**
 * Datasheet Sources API (NEW SCHEMA)
 * 
 * These are the junction records between CompetitiveSource and Datasheet
 * Created during the curation step when AI identifies which units are mentioned
 * 
 * GET  /api/admin/datasheet-sources - List all datasheet source links with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

/**
 * GET /api/admin/datasheet-sources
 * List datasheet source links with optional filters
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url);
    const datasheetId = searchParams.get('datasheetId');
    const competitiveSourceId = searchParams.get('competitiveSourceId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const where: Record<string, unknown> = {};
    
    if (datasheetId) {
      where.datasheetId = datasheetId;
    }
    
    if (competitiveSourceId) {
      where.competitiveSourceId = competitiveSourceId;
    }
    
    if (status) {
      where.status = status;
    }
    
    const sources = await prisma.datasheetSource.findMany({
      where,
      include: {
        datasheet: {
          select: {
            id: true,
            name: true,
            faction: true,
            subfaction: true,
          }
        },
        competitiveSource: {
          select: {
            id: true,
            sourceUrl: true,
            sourceType: true,
            contentTitle: true,
            authorName: true,
            status: true,
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // pending first
        { relevanceScore: 'desc' }, // then by relevance
        { createdAt: 'desc' }
      ],
      take: limit,
    });
    
    // Get counts by status
    const counts = await prisma.datasheetSource.groupBy({
      by: ['status'],
      _count: true,
    });
    
    const statusCounts = counts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);
    
    return NextResponse.json({
      sources,
      counts: statusCounts,
      total: sources.length,
    });
  });
}
