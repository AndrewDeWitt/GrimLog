/**
 * Dossier Share Token API Endpoint
 * 
 * GET /api/dossier/share/[token] - Access a shared dossier by token
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/dossier/share/[token]
 * Access a shared dossier by its share token
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
    
    const dossier = await prisma.dossierGeneration.findUnique({
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
    
    if (!dossier) {
      return NextResponse.json(
        { error: 'Dossier not found or link expired' },
        { status: 404 }
      );
    }
    
    // Check access - share token only works for 'link' or 'public' visibility
    if (dossier.visibility === 'private') {
      // Only owner can access private dossiers
      if (!user || user.id !== dossier.userId) {
        return NextResponse.json(
          { error: 'This dossier is private' },
          { status: 403 }
        );
      }
    }
    
    const isOwner = user?.id === dossier.userId;
    
    // Increment view count for non-owner views
    if (!isOwner) {
      await prisma.dossierGeneration.update({
        where: { id: dossier.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {}); // Don't fail on view count update
    }
    
    return NextResponse.json({
      ...dossier,
      isOwner,
      authorName: dossier.user?.name || 'Anonymous',
    });
    
  } catch (error: any) {
    console.error('Dossier share token error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared dossier' },
      { status: 500 }
    );
  }
}

