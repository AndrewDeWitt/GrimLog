/**
 * Token Balance API Endpoint
 *
 * GET /api/tokens/balance - Get user's token balance and recent transactions
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/apiAuth';
import { getUserTokenInfo, getAllFeatureCosts } from '@/lib/tokenService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Require authentication
    const user = await requireAuth();

    // Get user's token info with recent transactions
    const tokenInfo = await getUserTokenInfo(user.id, 10);

    if (!tokenInfo) {
      return NextResponse.json(
        { error: 'Failed to get token info' },
        { status: 500 }
      );
    }

    // Get active feature costs for context
    const featureCosts = await getAllFeatureCosts();

    return NextResponse.json({
      success: true,
      balance: tokenInfo.balance,
      accessStatus: tokenInfo.accessStatus,
      isAdmin: tokenInfo.isAdmin,
      recentTransactions: tokenInfo.recentTransactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.transactionType,
        featureKey: t.featureKey,
        featureName: t.featureCost?.displayName || null,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
      featureCosts: featureCosts.map((fc) => ({
        featureKey: fc.featureKey,
        tokenCost: fc.tokenCost,
        displayName: fc.displayName,
        description: fc.description,
      })),
    });
  } catch (error) {
    console.error('Token balance error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get token balance' },
      { status: 500 }
    );
  }
}
