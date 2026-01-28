/**
 * Admin Feature Cost Detail API Endpoint
 *
 * GET /api/admin/feature-costs/[featureKey] - Get a specific feature cost
 * PATCH /api/admin/feature-costs/[featureKey] - Update a feature cost
 * DELETE /api/admin/feature-costs/[featureKey] - Delete a feature cost
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import { prisma } from '@/lib/prisma';
import { updateFeatureCost, getFeatureCost } from '@/lib/tokenService';

interface RouteParams {
  params: Promise<{ featureKey: string }>;
}

// GET: Get a specific feature cost
export async function GET(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async () => {
    try {
      const { featureKey } = await context.params;

      const cost = await prisma.featureCost.findUnique({
        where: { featureKey },
      });

      if (!cost) {
        return NextResponse.json(
          { error: `Feature '${featureKey}' not found` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        featureCost: {
          featureKey: cost.featureKey,
          tokenCost: cost.tokenCost,
          displayName: cost.displayName,
          description: cost.description,
          isActive: cost.isActive,
          createdAt: cost.createdAt.toISOString(),
          updatedAt: cost.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Error getting feature cost:', error);
      return NextResponse.json(
        { error: 'Failed to get feature cost' },
        { status: 500 }
      );
    }
  });
}

// PATCH: Update a feature cost
export async function PATCH(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async () => {
    try {
      const { featureKey } = await context.params;
      const body = await request.json();

      // Check if feature exists
      const existing = await getFeatureCost(featureKey);
      if (!existing) {
        // Check if it exists but is inactive
        const inactiveCost = await prisma.featureCost.findUnique({
          where: { featureKey },
        });
        
        if (!inactiveCost) {
          return NextResponse.json(
            { error: `Feature '${featureKey}' not found` },
            { status: 404 }
          );
        }
      }

      // Build update object with only provided fields
      const updates: {
        tokenCost?: number;
        displayName?: string;
        description?: string;
        isActive?: boolean;
      } = {};

      if (typeof body.tokenCost === 'number') {
        if (body.tokenCost < 0) {
          return NextResponse.json(
            { error: 'tokenCost must be non-negative' },
            { status: 400 }
          );
        }
        updates.tokenCost = body.tokenCost;
      }

      if (typeof body.displayName === 'string') {
        updates.displayName = body.displayName;
      }

      if (body.description !== undefined) {
        updates.description = body.description;
      }

      if (typeof body.isActive === 'boolean') {
        updates.isActive = body.isActive;
      }

      // Check if there's anything to update
      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields provided for update' },
          { status: 400 }
        );
      }

      // Update the feature cost
      const updated = await updateFeatureCost(featureKey, updates);

      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to update feature cost' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        featureCost: updated,
        message: `Feature '${featureKey}' updated successfully`,
      });
    } catch (error) {
      console.error('Error updating feature cost:', error);
      return NextResponse.json(
        { error: 'Failed to update feature cost' },
        { status: 500 }
      );
    }
  });
}

// DELETE: Delete a feature cost (soft delete by setting inactive)
export async function DELETE(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async () => {
    try {
      const { featureKey } = await context.params;

      // Check if feature exists
      const existing = await prisma.featureCost.findUnique({
        where: { featureKey },
      });

      if (!existing) {
        return NextResponse.json(
          { error: `Feature '${featureKey}' not found` },
          { status: 404 }
        );
      }

      // Check if there are any ledger entries referencing this feature
      const hasLedgerEntries = await prisma.tokenLedger.count({
        where: { featureKey },
      });

      if (hasLedgerEntries > 0) {
        // Soft delete - just deactivate to preserve ledger integrity
        await prisma.featureCost.update({
          where: { featureKey },
          data: { isActive: false },
        });

        return NextResponse.json({
          success: true,
          message: `Feature '${featureKey}' deactivated (has ${hasLedgerEntries} ledger entries)`,
          softDelete: true,
        });
      }

      // Hard delete - no ledger entries, safe to remove
      await prisma.featureCost.delete({
        where: { featureKey },
      });

      return NextResponse.json({
        success: true,
        message: `Feature '${featureKey}' deleted`,
        softDelete: false,
      });
    } catch (error) {
      console.error('Error deleting feature cost:', error);
      return NextResponse.json(
        { error: 'Failed to delete feature cost' },
        { status: 500 }
      );
    }
  });
}
