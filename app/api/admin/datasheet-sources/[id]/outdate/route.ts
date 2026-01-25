/**
 * Outdate Source API
 * 
 * PATCH /api/admin/datasheet-sources/[id]/outdate - Mark a source as outdated
 * DELETE /api/admin/datasheet-sources/[id]/outdate - Remove outdated flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/datasheet-sources/[id]/outdate
 * Mark a source as outdated
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: sourceId } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;
    
    // Verify source exists
    const source = await prisma.datasheetSource.findUnique({
      where: { id: sourceId },
    });
    
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    // Mark as outdated
    const updated = await prisma.datasheetSource.update({
      where: { id: sourceId },
      data: {
        isOutdated: true,
        outdatedAt: new Date(),
        outdatedReason: reason || null,
      }
    });
    
    return NextResponse.json({ 
      source: updated,
      message: 'Source marked as outdated',
    });
  });
}

/**
 * DELETE /api/admin/datasheet-sources/[id]/outdate
 * Remove the outdated flag (restore the source)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: sourceId } = await params;
    
    // Verify source exists
    const source = await prisma.datasheetSource.findUnique({
      where: { id: sourceId },
    });
    
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    
    // Remove outdated flag
    const updated = await prisma.datasheetSource.update({
      where: { id: sourceId },
      data: {
        isOutdated: false,
        outdatedAt: null,
        outdatedReason: null,
      }
    });
    
    return NextResponse.json({ 
      source: updated,
      message: 'Source restored (no longer outdated)',
    });
  });
}

