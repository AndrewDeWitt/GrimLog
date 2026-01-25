/**
 * Competitive Context Lookup API
 * 
 * GET /api/datasheets/detail/[id]/competitive-context
 * Returns the best matching competitive context for a datasheet with fallback logic:
 * 1. Detachment-specific (if factionId + detachmentId match)
 * 2. Faction-specific (if factionId matches)
 * 3. Generic (factionId=null, detachmentId=null)
 * 
 * Query params:
 *   - factionId: optional, the playing faction
 *   - detachmentId: optional, the playing detachment
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: datasheetId } = await params;
  const { searchParams } = new URL(request.url);
  const factionId = searchParams.get('factionId');
  const detachmentId = searchParams.get('detachmentId');
  
  // Verify datasheet exists
  const datasheet = await prisma.datasheet.findUnique({
    where: { id: datasheetId },
    select: { id: true, name: true, faction: true, subfaction: true }
  });
  
  if (!datasheet) {
    return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
  }
  
  // Try to find context with fallback logic
  let context = null;
  let matchType = 'none';
  
  // 1. Try detachment-specific (most specific)
  if (factionId && detachmentId) {
    context = await prisma.datasheetCompetitiveContext.findFirst({
      where: {
        datasheetId,
        factionId,
        detachmentId,
      },
      include: {
        faction: { select: { id: true, name: true } },
        detachment: { select: { id: true, name: true } },
      }
    });
    if (context) matchType = 'detachment';
  }
  
  // 2. Fall back to faction-specific
  if (!context && factionId) {
    context = await prisma.datasheetCompetitiveContext.findFirst({
      where: {
        datasheetId,
        factionId,
        detachmentId: null,
      },
      include: {
        faction: { select: { id: true, name: true } },
        detachment: { select: { id: true, name: true } },
      }
    });
    if (context) matchType = 'faction';
  }
  
  // 3. Fall back to generic
  if (!context) {
    context = await prisma.datasheetCompetitiveContext.findFirst({
      where: {
        datasheetId,
        factionId: null,
        detachmentId: null,
      },
      include: {
        faction: { select: { id: true, name: true } },
        detachment: { select: { id: true, name: true } },
      }
    });
    if (context) matchType = 'generic';
  }
  
  return NextResponse.json({
    datasheet,
    context,
    matchType, // 'detachment', 'faction', 'generic', or 'none'
    requestedScope: {
      factionId: factionId || null,
      detachmentId: detachmentId || null,
    }
  });
}

