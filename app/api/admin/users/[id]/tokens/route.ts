/**
 * Admin User Tokens API Endpoint
 *
 * GET /api/admin/users/[id]/tokens - Get user's token info
 * POST /api/admin/users/[id]/tokens - Grant tokens to user
 * PATCH /api/admin/users/[id]/tokens - Adjust user's token balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import {
  getUserTokenInfo,
  grantTokens,
  setUserTokenBalance,
  getTokenHistory,
} from '@/lib/tokenService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get user's token info and history
export async function GET(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async () => {
    try {
      const { id: userId } = await context.params;

      const tokenInfo = await getUserTokenInfo(userId, 50);

      if (!tokenInfo) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        userId,
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
      });
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return NextResponse.json(
        { error: 'Failed to get user tokens' },
        { status: 500 }
      );
    }
  });
}

// POST: Grant tokens to user
export async function POST(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async (admin) => {
    try {
      const { id: userId } = await context.params;
      const body = await request.json();
      const { amount, reason } = body;

      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive number' },
          { status: 400 }
        );
      }

      if (!reason || typeof reason !== 'string') {
        return NextResponse.json(
          { error: 'reason is required' },
          { status: 400 }
        );
      }

      const result = await grantTokens(
        userId,
        amount,
        'GRANT',
        `Admin grant by ${admin.dbUser.email}: ${reason}`,
        { grantedBy: admin.dbUser.id }
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to grant tokens' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        userId,
        tokensGranted: result.tokensGranted,
        newBalance: result.newBalance,
        ledgerEntryId: result.ledgerEntryId,
      });
    } catch (error) {
      console.error('Error granting tokens:', error);
      return NextResponse.json(
        { error: 'Failed to grant tokens' },
        { status: 500 }
      );
    }
  });
}

// PATCH: Adjust user's token balance (absolute set or relative adjustment)
export async function PATCH(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async (admin) => {
    try {
      const { id: userId } = await context.params;
      const body = await request.json();
      const { balance, adjustment, reason } = body;

      if (!reason || typeof reason !== 'string') {
        return NextResponse.json(
          { error: 'reason is required for balance adjustments' },
          { status: 400 }
        );
      }

      // Handle absolute set
      if (typeof balance === 'number') {
        if (balance < 0) {
          return NextResponse.json(
            { error: 'balance cannot be negative' },
            { status: 400 }
          );
        }

        const result = await setUserTokenBalance(
          userId,
          balance,
          `Set by ${admin.dbUser.email}: ${reason}`
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to set balance' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          userId,
          newBalance: result.newBalance,
          adjustment: result.tokensGranted,
          ledgerEntryId: result.ledgerEntryId,
        });
      }

      // Handle relative adjustment
      if (typeof adjustment === 'number') {
        if (adjustment === 0) {
          return NextResponse.json(
            { error: 'adjustment cannot be zero' },
            { status: 400 }
          );
        }

        // Get current balance to calculate new balance
        const tokenInfo = await getUserTokenInfo(userId);
        if (!tokenInfo) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        const newBalance = Math.max(0, tokenInfo.balance + adjustment);

        const result = await setUserTokenBalance(
          userId,
          newBalance,
          `Adjusted by ${admin.dbUser.email}: ${reason}`
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to adjust balance' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          userId,
          newBalance: result.newBalance,
          adjustment: result.tokensGranted,
          ledgerEntryId: result.ledgerEntryId,
        });
      }

      return NextResponse.json(
        { error: 'Must provide either "balance" (absolute) or "adjustment" (relative)' },
        { status: 400 }
      );
    } catch (error) {
      console.error('Error adjusting user tokens:', error);
      return NextResponse.json(
        { error: 'Failed to adjust tokens' },
        { status: 500 }
      );
    }
  });
}
