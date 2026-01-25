/**
 * Individual Datasheet Source API (NEW SCHEMA)
 * 
 * DatasheetSource is now a junction table linking CompetitiveSource to Datasheet
 * with unit-specific extracted context
 * 
 * GET    /api/admin/datasheet-sources/:id - Get source link details
 * PATCH  /api/admin/datasheet-sources/:id - Update extraction results
 * DELETE /api/admin/datasheet-sources/:id - Remove link
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

/**
 * GET /api/admin/datasheet-sources/:id
 * Get full details of a single source link
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async () => {
    const { id } = await context.params;
    
    const source = await prisma.datasheetSource.findUnique({
      where: { id },
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
            content: true,
            status: true,
          }
        },
      }
    });
    
    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ source });
  });
}

/**
 * PATCH /api/admin/datasheet-sources/:id
 * Update a datasheet source link (extraction results, outdating, etc.)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async () => {
    const { id } = await context.params;
    
    try {
      const body = await request.json();
      const { 
        extractedContext,
        confidence,
        status,
        errorMessage,
        relevanceScore,
        mentionCount,
        mentionSummary,
        isOutdated,
        outdatedReason,
      } = body;
      
      // Build update data
      const updateData: Record<string, unknown> = {};
      
      if (extractedContext !== undefined) {
        updateData.extractedContext = typeof extractedContext === 'string' 
          ? extractedContext 
          : JSON.stringify(extractedContext);
        updateData.extractedAt = new Date();
      }
      
      if (confidence !== undefined) updateData.confidence = confidence;
      if (status !== undefined) updateData.status = status;
      if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
      if (relevanceScore !== undefined) updateData.relevanceScore = relevanceScore;
      if (mentionCount !== undefined) updateData.mentionCount = mentionCount;
      if (mentionSummary !== undefined) updateData.mentionSummary = mentionSummary;
      
      // Handle outdating
      if (isOutdated !== undefined) {
        updateData.isOutdated = isOutdated;
        if (isOutdated) {
          updateData.outdatedAt = new Date();
          updateData.outdatedReason = outdatedReason || null;
        } else {
          updateData.outdatedAt = null;
          updateData.outdatedReason = null;
        }
      }
      
      const source = await prisma.datasheetSource.update({
        where: { id },
        data: updateData,
        include: {
          datasheet: {
            select: {
              id: true,
              name: true,
              faction: true,
            }
          },
          competitiveSource: {
            select: {
              id: true,
              contentTitle: true,
            }
          }
        }
      });
      
      console.log(`📝 Updated DatasheetSource ${id}: status=${source.status}`);
      
      return NextResponse.json({
        success: true,
        source,
      });
      
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        );
      }
      
      console.error('Error updating datasheet source:', error);
      return NextResponse.json(
        { error: 'Failed to update datasheet source' },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/admin/datasheet-sources/:id
 * Remove a source link from a datasheet
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async () => {
    const { id } = await context.params;
    
    try {
      const source = await prisma.datasheetSource.delete({
        where: { id },
        select: {
          id: true,
          datasheet: {
            select: { name: true }
          },
          competitiveSource: {
            select: { contentTitle: true }
          }
        }
      });
      
      console.log(`🗑️ Deleted DatasheetSource link: ${source.datasheet.name} ← ${source.competitiveSource.contentTitle}`);
      
      return NextResponse.json({
        success: true,
        deleted: source,
      });
      
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        );
      }
      
      console.error('Error deleting datasheet source:', error);
      return NextResponse.json(
        { error: 'Failed to delete datasheet source' },
        { status: 500 }
      );
    }
  });
}
