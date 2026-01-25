/**
 * Competitive Source API
 * 
 * GET /api/admin/competitive-sources/[id] - Get a single source with details
 * PATCH /api/admin/competitive-sources/[id] - Update source (after fetch, curate, etc.)
 * DELETE /api/admin/competitive-sources/[id] - Delete a source
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/competitive-sources/[id]
 * Get a single source with all details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params;
    
    const source = await prisma.competitiveSource.findUnique({
      where: { id },
      include: {
        faction: {
          select: { id: true, name: true }
        },
        detachment: {
          select: { id: true, name: true }
        },
        datasheetSources: {
          include: {
            datasheet: {
              select: {
                id: true,
                name: true,
                role: true,
                keywords: true,
              }
            }
          },
          orderBy: { relevanceScore: 'desc' }
        }
      }
    });
    
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    return NextResponse.json({ source });
  });
}

/**
 * PATCH /api/admin/competitive-sources/[id]
 * Update a source (used by Python script for fetch/curate/extract steps)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params;
    const body = await request.json();
    
    // Verify source exists
    const existing = await prisma.competitiveSource.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    // Build update data based on what's provided
    const updateData: Record<string, unknown> = {};
    
    // Content fetch results
    if (body.content !== undefined) updateData.content = body.content;
    if (body.contentTitle !== undefined) updateData.contentTitle = body.contentTitle;
    if (body.authorName !== undefined) updateData.authorName = body.authorName;
    if (body.authorId !== undefined) updateData.authorId = body.authorId;
    if (body.publishedAt !== undefined) updateData.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.contentLang !== undefined) updateData.contentLang = body.contentLang;
    if (body.sourceId !== undefined) updateData.sourceId = body.sourceId;
    
    // Status updates
    if (body.status !== undefined) updateData.status = body.status;
    if (body.errorMessage !== undefined) updateData.errorMessage = body.errorMessage;
    if (body.fetchedAt !== undefined) updateData.fetchedAt = body.fetchedAt ? new Date(body.fetchedAt) : null;
    if (body.curatedAt !== undefined) updateData.curatedAt = body.curatedAt ? new Date(body.curatedAt) : null;
    if (body.extractedAt !== undefined) updateData.extractedAt = body.extractedAt ? new Date(body.extractedAt) : null;
    
    // Curation results
    if (body.mentionedUnitsJson !== undefined) updateData.mentionedUnitsJson = body.mentionedUnitsJson;
    
    // Game version
    if (body.gameVersion !== undefined) updateData.gameVersion = body.gameVersion;
    if (body.gameVersionDate !== undefined) updateData.gameVersionDate = body.gameVersionDate ? new Date(body.gameVersionDate) : null;
    
    // Detachment tagging
    if (body.detachmentId !== undefined) updateData.detachmentId = body.detachmentId;
    
    const updated = await prisma.competitiveSource.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({ source: updated });
  });
}

/**
 * DELETE /api/admin/competitive-sources/[id]
 * Delete a source and its datasheet links
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params;
    
    // Verify source exists
    const existing = await prisma.competitiveSource.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    // Delete the source (cascade will handle datasheetSources)
    await prisma.competitiveSource.delete({
      where: { id },
    });
    
    return NextResponse.json({ 
      message: 'Source deleted successfully',
      deletedId: id,
    });
  });
}

