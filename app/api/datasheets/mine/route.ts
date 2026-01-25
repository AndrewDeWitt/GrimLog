/**
 * GET /api/datasheets/mine
 * 
 * Fetch all datasheets owned by the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get all datasheets owned by this user
    const datasheets = await prisma.datasheet.findMany({
      where: {
        ownerId: user.id,
      },
      orderBy: [
        { faction: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        faction: true,
        factionId: true,
        subfaction: true,
        role: true,
        keywords: true,
        movement: true,
        toughness: true,
        save: true,
        invulnerableSave: true,
        wounds: true,
        leadership: true,
        objectiveControl: true,
        pointsCost: true,
        composition: true,
        isOfficial: true,
        ownerId: true,
        forkedFromId: true,
        currentVersion: true,
        visibility: true,
        forkedFrom: {
          select: {
            id: true,
            name: true,
            isOfficial: true,
          },
        },
      },
    });

    // Transform keywords from JSON string
    const transformed = datasheets.map(ds => ({
      ...ds,
      keywords: JSON.parse(ds.keywords || '[]'),
      iconUrl: null, // No icons for custom datasheets by default
    }));

    return NextResponse.json({
      datasheets: transformed,
      count: transformed.length,
    });
  } catch (error: any) {
    console.error('Error fetching user datasheets:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
