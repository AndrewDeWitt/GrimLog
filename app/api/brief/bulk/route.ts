/**
 * Brief Bulk Operations API Endpoint
 *
 * POST /api/brief/bulk - Perform bulk operations on multiple briefs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * Generate a cryptographically secure URL-safe share token
 */
function generateShareToken(): string {
  // Use crypto.randomUUID() for cryptographic randomness
  // Take first 12 chars (removing hyphens) for a compact, secure token
  return crypto.randomUUID().replace(/-/g, '').substring(0, 12);
}

/**
 * POST /api/brief/bulk
 * Perform bulk operations on multiple briefs
 *
 * Body:
 * - ids: string[] - Array of brief IDs
 * - action: 'delete' | 'setVisibility' - Action to perform
 * - visibility?: 'private' | 'link' | 'public' - Required for setVisibility action
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { ids, action, visibility } = body;

    // Validate ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot process more than 100 items at once' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['delete', 'setVisibility'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be delete or setVisibility.' },
        { status: 400 }
      );
    }

    // Validate visibility if setVisibility action
    if (action === 'setVisibility' && !['private', 'link', 'public'].includes(visibility)) {
      return NextResponse.json(
        { error: 'Invalid visibility. Must be private, link, or public.' },
        { status: 400 }
      );
    }

    // Verify all IDs belong to the user
    const briefs = await prisma.briefGeneration.findMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      select: { id: true, shareToken: true },
    });

    if (briefs.length !== ids.length) {
      const foundIds = new Set(briefs.map(d => d.id));
      const invalidIds = ids.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { error: 'Access denied or briefs not found', invalidIds },
        { status: 403 }
      );
    }

    // Perform the action
    if (action === 'delete') {
      await prisma.briefGeneration.deleteMany({
        where: {
          id: { in: ids },
          userId: user.id, // Extra safety check
        },
      });

      return NextResponse.json({
        success: true,
        action: 'delete',
        affected: ids.length,
      });
    }

    if (action === 'setVisibility') {
      // For link/public visibility, we need to generate share tokens for those without
      if (visibility === 'link' || visibility === 'public') {
        // Find briefs without share tokens
        const briefsNeedingTokens = briefs.filter(d => !d.shareToken);

        // Update each individually to generate unique tokens
        for (const brief of briefsNeedingTokens) {
          await prisma.briefGeneration.update({
            where: { id: brief.id },
            data: {
              visibility,
              shareToken: generateShareToken(),
            },
          });
        }

        // Update the rest that already have tokens
        const briefsWithTokens = briefs.filter(d => d.shareToken).map(d => d.id);
        if (briefsWithTokens.length > 0) {
          await prisma.briefGeneration.updateMany({
            where: { id: { in: briefsWithTokens } },
            data: { visibility },
          });
        }
      } else {
        // For private, just update all at once
        await prisma.briefGeneration.updateMany({
          where: {
            id: { in: ids },
            userId: user.id,
          },
          data: { visibility },
        });
      }

      return NextResponse.json({
        success: true,
        action: 'setVisibility',
        visibility,
        affected: ids.length,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Brief bulk operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}
