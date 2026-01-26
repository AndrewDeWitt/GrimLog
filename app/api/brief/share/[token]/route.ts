/**
 * Brief Share Token API Endpoint
 * 
 * GET /api/brief/share/[token] - Access a shared brief by token
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/brief/share/[token]
 * Access a shared brief by its share token
 * - Works for visibility 'link' or 'public'
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const user = await getOptionalAuth();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Share token required' },
        { status: 400 }
      );
    }
    
    const brief = await prisma.briefGeneration.findUnique({
      where: { shareToken: token },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found or link expired' },
        { status: 404 }
      );
    }
    
    // Check access - share token only works for 'link' or 'public' visibility
    if (brief.visibility === 'private') {
      // Only owner can access private briefs
      if (!user || user.id !== brief.userId) {
        return NextResponse.json(
          { error: 'This brief is private' },
          { status: 403 }
        );
      }
    }
    
    const isOwner = user?.id === brief.userId;

    // Increment view count for non-owner views
    if (!isOwner) {
      await prisma.briefGeneration.update({
        where: { id: brief.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {}); // Don't fail on view count update
    }

    return NextResponse.json({
      ...brief,
      isOwner,
      authorName: brief.user?.name || 'Anonymous',
    });
    
  } catch (error: any) {
    console.error('Brief share token error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared brief' },
      { status: 500 }
    );
  }
}

