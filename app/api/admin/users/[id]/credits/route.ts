/**
 * Admin User Credits API Endpoint
 * 
 * PATCH /api/admin/users/[id]/credits - Adjust user credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import { adjustUserCredits, setUserCredits } from '@/lib/briefCredits';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  return withAdminAuth(async () => {
    try {
      const { id: userId } = await context.params;
      const body = await request.json();
      const { credits, adjustment } = body;

      let newCredits: number;

      if (typeof credits === 'number') {
        // Absolute set
        newCredits = await setUserCredits(userId, credits);
      } else if (typeof adjustment === 'number') {
        // Relative adjustment
        newCredits = await adjustUserCredits(userId, adjustment);
      } else {
        return NextResponse.json(
          { error: 'Must provide either "credits" (absolute) or "adjustment" (relative)' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        userId,
        newCredits
      });
    } catch (error: any) {
      console.error('Error adjusting user credits:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to adjust credits' },
        { status: 500 }
      );
    }
  });
}
