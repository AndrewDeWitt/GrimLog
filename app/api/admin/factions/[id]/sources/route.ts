/**
 * Faction Sources API
 * 
 * GET /api/admin/factions/[id]/sources - Get all competitive sources for a faction
 * POST /api/admin/factions/[id]/sources - Add a new source to a faction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/factions/[id]/sources
 * Get all competitive sources for a faction with their linked datasheets
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: factionId } = await params;
    
    // Verify faction exists
    const faction = await prisma.faction.findUnique({
      where: { id: factionId },
      select: { id: true, name: true }
    });
    
    if (!faction) {
      return NextResponse.json({ error: 'Faction not found' }, { status: 404 });
    }
    
    // Get all sources for this faction with their linked datasheets
    const sources = await prisma.competitiveSource.findMany({
      where: { factionId },
      orderBy: { createdAt: 'desc' },
      include: {
        detachment: {
          select: {
            id: true,
            name: true,
          }
        },
        datasheetSources: {
          include: {
            datasheet: {
              select: {
                id: true,
                name: true,
                role: true,
              }
            }
          }
        },
        _count: {
          select: {
            datasheetSources: true,
          }
        }
      }
    });
    
    // Count by status
    const counts = {
      total: sources.length,
      pending: sources.filter(s => s.status === 'pending').length,
      fetched: sources.filter(s => s.status === 'fetched').length,
      curated: sources.filter(s => s.status === 'curated').length,
      extracted: sources.filter(s => s.status === 'extracted').length,
      error: sources.filter(s => s.status === 'error').length,
    };
    
    return NextResponse.json({
      faction,
      sources,
      counts,
    });
  });
}

/**
 * POST /api/admin/factions/[id]/sources
 * Add a new competitive source to a faction
 * 
 * Body:
 *   - sourceUrl: URL of the source (required)
 *   - sourceType: "youtube" | "reddit" | "article" | "forum" | "other" (required)
 *   - gameVersion: optional game version string
 *   - detachmentId: optional detachment ID for detachment-specific sources
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: factionId } = await params;
    const body = await request.json();
    const { sourceUrl, sourceType, gameVersion, detachmentId } = body;
    
    if (!sourceUrl) {
      return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 });
    }
    
    if (!sourceType) {
      return NextResponse.json({ error: 'sourceType is required' }, { status: 400 });
    }
    
    // Verify faction exists
    const faction = await prisma.faction.findUnique({
      where: { id: factionId },
    });
    
    if (!faction) {
      return NextResponse.json({ error: 'Faction not found' }, { status: 404 });
    }
    
    // If detachmentId provided, verify it exists and belongs to this faction
    if (detachmentId) {
      const detachment = await prisma.detachment.findUnique({
        where: { id: detachmentId },
      });
      
      if (!detachment) {
        return NextResponse.json({ error: 'Detachment not found' }, { status: 404 });
      }
      
      // Check detachment belongs to this faction (by factionId or faction name)
      if (detachment.factionId && detachment.factionId !== factionId && detachment.faction !== faction.name) {
        return NextResponse.json({ 
          error: 'Detachment does not belong to this faction' 
        }, { status: 400 });
      }
    }
    
    // Check if source URL already exists
    const existing = await prisma.competitiveSource.findUnique({
      where: { sourceUrl }
    });
    
    if (existing) {
      // If it exists but for a different faction, that's an error
      if (existing.factionId && existing.factionId !== factionId) {
        return NextResponse.json({ 
          error: 'Source URL already exists for a different faction',
          existingSource: existing,
        }, { status: 409 });
      }
      
      // If it exists for the same faction, just return it
      if (existing.factionId === factionId) {
        return NextResponse.json({ 
          source: existing,
          message: 'Source already exists for this faction',
        }, { status: 200 });
      }
      
      // If it exists without a faction, update it to this faction
      const updated = await prisma.competitiveSource.update({
        where: { id: existing.id },
        data: { 
          factionId,
          detachmentId: detachmentId || null,
        }
      });
      
      return NextResponse.json({ 
        source: updated,
        message: 'Existing source linked to this faction',
      }, { status: 200 });
    }
    
    // Create the source
    const source = await prisma.competitiveSource.create({
      data: {
        sourceUrl,
        sourceType,
        factionId,
        detachmentId: detachmentId || null,
        gameVersion: gameVersion || null,
        status: 'pending',
      },
      include: {
        detachment: { select: { id: true, name: true } },
      }
    });
    
    return NextResponse.json({ source }, { status: 201 });
  });
}

