/**
 * Datasheet Source Extraction API
 * 
 * PATCH /api/admin/datasheet-sources/[id]/extract - Update extraction results
 * Body: { extractedContext, confidence, status, errorMessage }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/datasheet-sources/[id]/extract
 * Update extraction results for a datasheet source
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params;
    const body = await request.json();
    const { extractedContext, confidence, status, errorMessage } = body;
    
    // Verify source exists
    const existing = await prisma.datasheetSource.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'DatasheetSource not found' }, { status: 404 });
    }
    
    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (extractedContext !== undefined) {
      updateData.extractedContext = typeof extractedContext === 'string' 
        ? extractedContext 
        : JSON.stringify(extractedContext);
    }
    
    if (confidence !== undefined) updateData.confidence = confidence;
    if (status !== undefined) updateData.status = status;
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
    
    // Set extractedAt if status is 'extracted'
    if (status === 'extracted') {
      updateData.extractedAt = new Date();
    }
    
    const updated = await prisma.datasheetSource.update({
      where: { id },
      data: updateData,
      include: {
        datasheet: {
          select: { id: true, name: true }
        },
        competitiveSource: {
          select: { id: true, contentTitle: true }
        }
      }
    });
    
    return NextResponse.json({ datasheetSource: updated });
  });
}

