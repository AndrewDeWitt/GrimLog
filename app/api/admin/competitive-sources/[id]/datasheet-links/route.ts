/**
 * Datasheet Links API
 * 
 * POST /api/admin/competitive-sources/[id]/datasheet-links - Create links during curation
 * Body: { links: [{ datasheetId, relevanceScore, mentionCount, mentionSummary }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DatasheetLinkInput {
  datasheetId: string;
  relevanceScore?: number;
  mentionCount?: number;
  mentionSummary?: string;
}

/**
 * POST /api/admin/competitive-sources/[id]/datasheet-links
 * Create datasheet links during the curation step
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: competitiveSourceId } = await params;
    const body = await request.json();
    const { links } = body as { links: DatasheetLinkInput[] };
    
    if (!links || !Array.isArray(links)) {
      return NextResponse.json({ error: 'links array is required' }, { status: 400 });
    }
    
    // Verify source exists
    const source = await prisma.competitiveSource.findUnique({
      where: { id: competitiveSourceId },
    });
    
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    // Verify all datasheets exist
    const datasheetIds = links.map(l => l.datasheetId);
    const datasheets = await prisma.datasheet.findMany({
      where: { id: { in: datasheetIds } },
      select: { id: true, name: true }
    });
    
    const foundIds = new Set(datasheets.map(d => d.id));
    const missingIds = datasheetIds.filter(id => !foundIds.has(id));
    
    if (missingIds.length > 0) {
      return NextResponse.json({ 
        error: 'Some datasheets not found',
        missingIds,
      }, { status: 400 });
    }
    
    // Create links (upsert to handle re-curation)
    const results = await Promise.all(
      links.map(async (link) => {
        return prisma.datasheetSource.upsert({
          where: {
            datasheetId_competitiveSourceId: {
              datasheetId: link.datasheetId,
              competitiveSourceId,
            }
          },
          create: {
            datasheetId: link.datasheetId,
            competitiveSourceId,
            relevanceScore: link.relevanceScore,
            mentionCount: link.mentionCount,
            mentionSummary: link.mentionSummary,
            status: 'pending', // Ready for extraction
          },
          update: {
            relevanceScore: link.relevanceScore,
            mentionCount: link.mentionCount,
            mentionSummary: link.mentionSummary,
            status: 'pending', // Reset to pending if re-curating
            extractedAt: null,
            extractedContext: null,
          },
          include: {
            datasheet: {
              select: { id: true, name: true }
            }
          }
        });
      })
    );
    
    return NextResponse.json({
      created: results.length,
      links: results,
    }, { status: 201 });
  });
}

