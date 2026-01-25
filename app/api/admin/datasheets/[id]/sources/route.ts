/**
 * Datasheet Sources API (NEW SCHEMA)
 * 
 * GET /api/admin/datasheets/[id]/sources - Get all source links for a datasheet
 * 
 * Note: In the new schema, sources are added at the FACTION level (CompetitiveSource),
 * and DatasheetSource is a junction table linking them to specific datasheets.
 * Adding sources should be done via /api/admin/factions/[id]/sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/datasheets/[id]/sources
 * Get all source links for a datasheet with their competitive source details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: datasheetId } = await params;
    
    // Verify datasheet exists and get aggregation status
    const datasheet = await prisma.datasheet.findUnique({
      where: { id: datasheetId },
      select: {
        id: true,
        name: true,
        faction: true,
        contextLastAggregated: true,
        contextSourceCount: true,
        contextConflicts: true,
        competitiveTier: true,
        tierReasoning: true,
        bestTargets: true,
        counters: true,
        synergies: true,
        playstyleNotes: true,
        deploymentTips: true,
        competitiveNotes: true,
      }
    });
    
    if (!datasheet) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }
    
    // Get all source links for this datasheet with the competitive source details
    const sourceLinks = await prisma.datasheetSource.findMany({
      where: { datasheetId },
      orderBy: [
        { isOutdated: 'asc' }, // Non-outdated first
        { relevanceScore: 'desc' }, // Most relevant first
        { createdAt: 'desc' }, // Then by newest
      ],
      include: {
        competitiveSource: {
          select: {
            id: true,
            sourceUrl: true,
            sourceType: true,
            contentTitle: true,
            authorName: true,
            status: true,
            gameVersion: true,
          }
        }
      }
    });
    
    // Format sources to include competitive source info
    const sources = sourceLinks.map(link => ({
      id: link.id,
      sourceType: link.competitiveSource.sourceType,
      sourceUrl: link.competitiveSource.sourceUrl,
      sourceTitle: link.competitiveSource.contentTitle,
      channelName: link.competitiveSource.authorName,
      status: link.status,
      confidence: link.confidence,
      relevanceScore: link.relevanceScore,
      mentionCount: link.mentionCount,
      mentionSummary: link.mentionSummary,
      extractedContext: link.extractedContext,
      isOutdated: link.isOutdated,
      outdatedAt: link.outdatedAt,
      outdatedReason: link.outdatedReason,
      createdAt: link.createdAt,
      extractedAt: link.extractedAt,
      gameVersion: link.competitiveSource.gameVersion,
      competitiveSourceStatus: link.competitiveSource.status,
    }));
    
    // Count sources by status
    const counts = {
      total: sources.length,
      pending: sources.filter(s => s.status === 'pending').length,
      extracted: sources.filter(s => s.status === 'extracted' && !s.isOutdated).length,
      outdated: sources.filter(s => s.isOutdated).length,
      error: sources.filter(s => s.status === 'error').length,
    };
    
    return NextResponse.json({
      datasheet,
      sources,
      counts,
    });
  });
}
