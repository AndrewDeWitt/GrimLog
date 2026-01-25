/**
 * Bulk Update Datasheet Sources API
 * 
 * POST /api/admin/datasheet-sources/bulk-update - Update multiple sources at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';

interface SourceUpdate {
  id: string;
  transcript?: string;
  sourceTitle?: string;
  channelName?: string;
  extractedContext?: any;
  confidence?: number;
  status?: string;
  errorMessage?: string;
}

/**
 * POST /api/admin/datasheet-sources/bulk-update
 * Update multiple sources in a single request (for batch processing)
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const body = await request.json();
      const { updates } = body as { updates: SourceUpdate[] };
      
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json(
          { error: 'updates array is required and must not be empty' },
          { status: 400 }
        );
      }
      
      const results: { id: string; success: boolean; error?: string }[] = [];
      
      // Process updates in a transaction
      await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          try {
            const updateData: any = {};
            
            if (update.transcript !== undefined) {
              updateData.transcript = update.transcript;
              updateData.fetchedAt = new Date();
            }
            
            if (update.sourceTitle !== undefined) {
              updateData.sourceTitle = update.sourceTitle;
            }
            
            if (update.channelName !== undefined) {
              updateData.channelName = update.channelName;
            }
            
            if (update.extractedContext !== undefined) {
              updateData.extractedContext = typeof update.extractedContext === 'string' 
                ? update.extractedContext 
                : JSON.stringify(update.extractedContext);
              updateData.processedAt = new Date();
            }
            
            if (update.confidence !== undefined) {
              updateData.confidence = update.confidence;
            }
            
            if (update.status !== undefined) {
              updateData.status = update.status;
            }
            
            if (update.errorMessage !== undefined) {
              updateData.errorMessage = update.errorMessage;
            }
            
            await tx.datasheetSource.update({
              where: { id: update.id },
              data: updateData,
            });
            
            results.push({ id: update.id, success: true });
            
          } catch (error: any) {
            results.push({ 
              id: update.id, 
              success: false, 
              error: error.code === 'P2025' ? 'Not found' : 'Update failed'
            });
          }
        }
      });
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`📦 Bulk update: ${successCount} succeeded, ${failCount} failed`);
      
      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: updates.length,
          succeeded: successCount,
          failed: failCount,
        }
      });
      
    } catch (error) {
      console.error('Error in bulk update:', error);
      return NextResponse.json(
        { error: 'Failed to process bulk update' },
        { status: 500 }
      );
    }
  });
}

