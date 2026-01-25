/**
 * Aggregate Context API
 * 
 * PATCH /api/admin/datasheets/[id]/aggregate - Update datasheet competitive context
 * 
 * Now writes to DatasheetCompetitiveContext table which supports:
 * - Generic context (factionId=null, detachmentId=null)
 * - Faction-specific context (factionId set, detachmentId=null)
 * - Detachment-specific context (both factionId and detachmentId set)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/datasheets/[id]/aggregate
 * Update competitive context for a datasheet (optionally faction/detachment-specific)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: datasheetId } = await params;
    const body = await request.json();
    
    // Verify datasheet exists
    const datasheet = await prisma.datasheet.findUnique({
      where: { id: datasheetId },
    });
    
    if (!datasheet) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }
    
    // Extract context scope (optional - defaults to generic)
    const { factionId, detachmentId } = body;
    
    // Extract competitive context fields
    const {
      competitiveTier,
      tierReasoning,
      bestTargets,
      counters,
      synergies,
      playstyleNotes,
      deploymentTips,
      competitiveNotes,
      contextLastAggregated,
      contextSourceCount,
      contextConflicts,
    } = body;
    
    // Build the unique key for upsert
    // We need to handle NULLs carefully since they're part of the unique constraint
    const scopeKey = {
      datasheetId,
      factionId: factionId || null,
      detachmentId: detachmentId || null,
    };
    
    // Check if context already exists for this scope
    const existingContext = await prisma.datasheetCompetitiveContext.findFirst({
      where: {
        datasheetId,
        factionId: factionId || null,
        detachmentId: detachmentId || null,
      },
    });
    
    let result;
    
    if (existingContext) {
      // Update existing context
      result = await prisma.datasheetCompetitiveContext.update({
        where: { id: existingContext.id },
        data: {
          competitiveTier: competitiveTier || null,
          tierReasoning: tierReasoning || null,
          bestTargets: bestTargets || null,
          counters: counters || null,
          synergies: synergies || null,
          playstyleNotes: playstyleNotes || null,
          deploymentTips: deploymentTips || null,
          competitiveNotes: competitiveNotes || null,
          lastAggregated: contextLastAggregated ? new Date(contextLastAggregated) : new Date(),
          sourceCount: contextSourceCount || null,
          conflicts: contextConflicts || null,
        },
        include: {
          faction: { select: { id: true, name: true } },
          detachment: { select: { id: true, name: true } },
        }
      });
    } else {
      // Create new context
      result = await prisma.datasheetCompetitiveContext.create({
        data: {
          datasheetId,
          factionId: factionId || null,
          detachmentId: detachmentId || null,
          competitiveTier: competitiveTier || null,
          tierReasoning: tierReasoning || null,
          bestTargets: bestTargets || null,
          counters: counters || null,
          synergies: synergies || null,
          playstyleNotes: playstyleNotes || null,
          deploymentTips: deploymentTips || null,
          competitiveNotes: competitiveNotes || null,
          lastAggregated: contextLastAggregated ? new Date(contextLastAggregated) : new Date(),
          sourceCount: contextSourceCount || null,
          conflicts: contextConflicts || null,
        },
        include: {
          faction: { select: { id: true, name: true } },
          detachment: { select: { id: true, name: true } },
        }
      });
    }
    
    // Determine scope description for logging
    const scopeDesc = detachmentId 
      ? `detachment-specific (${result.detachment?.name || detachmentId})`
      : factionId 
        ? `faction-specific (${result.faction?.name || factionId})`
        : 'generic';
    
    return NextResponse.json({ 
      context: result,
      scope: scopeDesc,
      message: `Competitive context updated (${scopeDesc})`,
    });
  });
}

/**
 * GET /api/admin/datasheets/[id]/aggregate
 * Get all competitive contexts for a datasheet
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: datasheetId } = await params;
    
    const datasheet = await prisma.datasheet.findUnique({
      where: { id: datasheetId },
      select: { id: true, name: true, faction: true, subfaction: true }
    });
    
    if (!datasheet) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }
    
    // Get all contexts for this datasheet
    const contexts = await prisma.datasheetCompetitiveContext.findMany({
      where: { datasheetId },
      include: {
        faction: { select: { id: true, name: true } },
        detachment: { select: { id: true, name: true } },
      },
      orderBy: [
        { factionId: 'asc' },  // Generic first (null)
        { detachmentId: 'asc' }, // Faction-generic before detachment-specific
      ]
    });
    
    return NextResponse.json({
      datasheet,
      contexts,
      count: contexts.length,
    });
  });
}
