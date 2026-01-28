/**
 * Admin Feature Costs API Endpoint
 *
 * GET /api/admin/feature-costs - List all feature costs
 * POST /api/admin/feature-costs - Create a new feature cost
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import { prisma } from '@/lib/prisma';
import { getAllFeatureCosts } from '@/lib/tokenService';

// GET: List all feature costs (including inactive)
export async function GET() {
  return withAdminAuth(async () => {
    try {
      const costs = await getAllFeatureCosts(true); // Include inactive

      return NextResponse.json({
        success: true,
        featureCosts: costs,
        count: costs.length,
      });
    } catch (error) {
      console.error('Error listing feature costs:', error);
      return NextResponse.json(
        { error: 'Failed to list feature costs' },
        { status: 500 }
      );
    }
  });
}

// POST: Create a new feature cost
export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const body = await request.json();
      const { featureKey, tokenCost, displayName, description, isActive } = body;

      // Validate required fields
      if (!featureKey || typeof featureKey !== 'string') {
        return NextResponse.json(
          { error: 'featureKey is required and must be a string' },
          { status: 400 }
        );
      }

      if (typeof tokenCost !== 'number' || tokenCost < 0) {
        return NextResponse.json(
          { error: 'tokenCost is required and must be a non-negative number' },
          { status: 400 }
        );
      }

      if (!displayName || typeof displayName !== 'string') {
        return NextResponse.json(
          { error: 'displayName is required and must be a string' },
          { status: 400 }
        );
      }

      // Check if feature already exists
      const existing = await prisma.featureCost.findUnique({
        where: { featureKey },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Feature '${featureKey}' already exists` },
          { status: 409 }
        );
      }

      // Create new feature cost
      const newCost = await prisma.featureCost.create({
        data: {
          featureKey,
          tokenCost,
          displayName,
          description: description || null,
          isActive: isActive ?? true,
        },
      });

      return NextResponse.json({
        success: true,
        featureCost: {
          featureKey: newCost.featureKey,
          tokenCost: newCost.tokenCost,
          displayName: newCost.displayName,
          description: newCost.description,
          isActive: newCost.isActive,
        },
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating feature cost:', error);
      return NextResponse.json(
        { error: 'Failed to create feature cost' },
        { status: 500 }
      );
    }
  });
}
