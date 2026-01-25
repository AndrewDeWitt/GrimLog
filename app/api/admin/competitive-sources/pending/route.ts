/**
 * Pending Competitive Sources API
 * 
 * GET /api/admin/competitive-sources/pending - Get sources that need processing
 * Query params:
 *   - status: "pending" | "fetched" | "curated" (which stage to fetch)
 *   - limit: number (max sources to return)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Validate status
    const validStatuses = ['pending', 'fetched', 'curated'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }
    
    // Get sources at the specified stage
    const sources = await prisma.competitiveSource.findMany({
      where: { 
        status,
        // Only include sources that have a faction (faction-level sources)
        factionId: { not: null }
      },
      take: limit,
      orderBy: { createdAt: 'asc' }, // Process oldest first
      include: {
        faction: {
          select: {
            id: true,
            name: true,
          }
        },
        // For curated sources, include the datasheet links
        datasheetSources: status === 'curated' ? {
          where: { status: 'pending' },
          include: {
            datasheet: {
              select: {
                id: true,
                name: true,
                keywords: true,
              }
            }
          }
        } : false,
      }
    });
    
    // For fetched sources (ready for curation), include faction datasheets
    // so the AI knows what units to look for
    let factionDatasheets: Record<string, { id: string; name: string; keywords: string }[]> = {};
    
    if (status === 'fetched') {
      // Get unique faction IDs and names
      const factionIds = [...new Set(sources.map(s => s.factionId).filter(Boolean))] as string[];
      
      // Fetch datasheets for each faction
      for (const factionId of factionIds) {
        // Get the faction name and parent info
        const faction = await prisma.faction.findUnique({
          where: { id: factionId },
          select: { name: true, parentFactionId: true }
        });
        
        // Query datasheets by multiple criteria to catch all related units:
        // 1. factionId matches directly
        // 2. faction string matches faction name
        // 3. subfaction matches faction name (for subfaction-specific datasheets)
        // 4. If this is a subfaction, also include parent faction datasheets with matching subfaction
        const datasheets = await prisma.datasheet.findMany({
          where: {
            isEnabled: true,
            OR: [
              // Direct factionId match
              { factionId },
              // Faction name string match
              ...(faction?.name ? [{ faction: faction.name }] : []),
              // Subfaction match (e.g., Space Wolves datasheets under Space Marines)
              ...(faction?.name ? [{ subfaction: faction.name }] : []),
              // Case-insensitive subfaction match
              ...(faction?.name ? [{ subfaction: { equals: faction.name, mode: 'insensitive' as const } }] : []),
            ]
          },
          select: {
            id: true,
            name: true,
            keywords: true,
          },
          orderBy: { name: 'asc' }
        });
        
        console.log(`[Curation] Found ${datasheets.length} datasheets for faction ${faction?.name || factionId}`);
        factionDatasheets[factionId] = datasheets;
      }
    }
    
    return NextResponse.json({
      sources,
      factionDatasheets,
      count: sources.length,
      status,
    });
  });
}

