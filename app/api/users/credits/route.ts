/**
 * User Credits API Endpoint
 * 
 * GET /api/users/credits - Get current user's credit balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/apiAuth';
import { getUserCredits, checkIsAdmin } from '@/lib/dossierCredits';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const [credits, isAdmin] = await Promise.all([
      getUserCredits(user.id),
      checkIsAdmin(user.id)
    ]);
    
    return NextResponse.json({
      credits: isAdmin ? 'unlimited' : credits,
      isAdmin,
      userId: user.id
    });
  } catch (error: any) {
    console.error('Error fetching user credits:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}

