import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth, requireAuth } from '@/lib/auth/apiAuth';

function normalizeFactionForLookup(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // Remove parenthetical subfaction, e.g. "Space Marines (Space Wolves)"
    .replace(/[^a-z0-9]+/g, ' ') // Remove punctuation, normalize separators
    .replace(/\s+/g, ' ')
    .trim();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Get optional auth - we'll check permissions based on army visibility
    const user = await getOptionalAuth();
    
    const army = await prisma.army.findUnique({
      where: { id },
      include: {
        player: true,
        units: {
          include: {
            fullDatasheet: {
              select: {
                id: true,
                name: true,
                role: true,
                keywords: true,
                wounds: true,
                compositionData: true,
              },
            },
          },
        },
        stratagems: true,
      },
    });

    if (!army) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    // Check access permissions:
    // 1. Owner can always access
    // 2. Public armies can be accessed by anyone
    // 3. Link-shared armies require the user to be authenticated (share token handled by separate route)
    // 4. Private armies require owner
    const isOwner = user?.id === army.userId;
    const isPublic = army.visibility === 'public';
    
    if (!isOwner && !isPublic) {
      // For private or link-shared armies, require authentication and ownership
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Not authorized to view this army' }, { status: 403 });
    }

    // Resolve factionId for legacy armies when possible (e.g. player.faction contains subfaction text)
    let resolvedFactionId: string | null = army.factionId || null;
    if (!resolvedFactionId && army.player?.faction) {
      const raw = army.player.faction;
      const normalized = normalizeFactionForLookup(raw);

      // Try exact/contains matches on normalized name (best-effort)
      const candidates = await prisma.faction.findMany({
        select: { id: true, name: true },
      });

      const best = candidates
        .map(f => ({ ...f, n: normalizeFactionForLookup(f.name) }))
        .find(f => f.n === normalized) ||
        candidates
          .map(f => ({ ...f, n: normalizeFactionForLookup(f.name) }))
          .find(f => normalized.includes(f.n) || f.n.includes(normalized)) ||
        null;

      if (best) {
        resolvedFactionId = best.id;
      }
    }

    // If we have a factionId (or string match), fetch available stratagems for this faction
    let availableStratagems: any[] = [];
    
    // Prefer ID-based lookup
    if (resolvedFactionId) {
      availableStratagems = await prisma.stratagemData.findMany({
        where: {
          OR: [
            { factionId: resolvedFactionId },
            // Fallback for legacy stratagem rows
            ...(army.player?.faction
              ? [{ faction: { equals: army.player.faction, mode: 'insensitive' as const } }]
              : []),
          ],
        }
      });
    } 
    // Fallback to string matching if legacy army
    else if (army.player?.faction) {
      // Try direct match or normalized
      availableStratagems = await prisma.stratagemData.findMany({
        where: { 
          faction: { equals: army.player.faction, mode: 'insensitive' } 
        }
      });
    }

    // Filter by Detachment
    if (army.detachment) {
      // Normalize comparison
      const armyDetachment = army.detachment.toLowerCase().trim();
      
      availableStratagems = availableStratagems.filter(s => {
        // Include if:
        // 1. Stratagem has no detachment restriction (null)
        // 2. Stratagem detachment is "Core" (universal stratagems)
        // 3. Stratagem detachment matches army detachment
        
        const sDetachment = (s.detachment || '').toLowerCase().trim();
        
        return !sDetachment || 
               sDetachment === 'core' || 
               sDetachment === armyDetachment;
      });
    } else {
      // If no detachment selected, only show Core stratagems
      availableStratagems = availableStratagems.filter(s => {
        const sDetachment = (s.detachment || '').toLowerCase().trim();
        return !sDetachment || sDetachment === 'core';
      });
    }

    // Map StratagemData to the format expected by the UI
    // The UI expects: { id, name, cpCost, phase, description, keywords }
    const mappedStratagems = availableStratagems.map(s => ({
      id: s.id,
      name: s.name,
      cpCost: s.cpCost,
      phase: s.when || 'Any', // Map 'when' to 'phase'
      description: s.effect, // Map 'effect' to 'description'
      keywords: s.keywords || '[]',
      detachment: s.detachment || null,
      source: 'faction_reference' // Flag to distinguish from manual ones
    }));

    // Combine manual stratagems with reference ones
    // We prioritze manual ones if they exist (though usually user wouldn't have duplicates)
    const combinedStratagems = [
      ...army.stratagems,
      ...mappedStratagems
    ];

    // Generate share URL if token exists
    const shareUrl = army.shareToken 
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/armies/shared/${army.shareToken}`
      : null;

    return NextResponse.json({
      ...army,
      factionId: resolvedFactionId, // ensure the client can load detachments even for legacy armies
      stratagems: combinedStratagems,
      visibility: army.visibility,
      shareToken: army.shareToken,
      shareUrl,
    });
  } catch (error) {
    console.error('Error fetching army:', error);
    return NextResponse.json({ error: 'Failed to fetch army' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    
    // Verify ownership
    const army = await prisma.army.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!army) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    if (army.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this army' }, { status: 403 });
    }
    
    // Update army with provided fields
    const updatedArmy = await prisma.army.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.pointsLimit !== undefined && { pointsLimit: body.pointsLimit }),
        ...(body.characterAttachments !== undefined && { characterAttachments: body.characterAttachments }),
        ...(body.detachment !== undefined && { detachment: body.detachment }),
        ...(body.visibility !== undefined && { visibility: body.visibility }),
      },
    });

    return NextResponse.json(updatedArmy);
  } catch (error: any) {
    console.error('Error updating army:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update army' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    // Verify ownership
    const army = await prisma.army.findUnique({
      where: { id },
      select: { userId: true, name: true },
    });

    if (!army) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    if (army.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this army' }, { status: 403 });
    }
    
    await prisma.army.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Army "${army.name}" deleted successfully` });
  } catch (error: any) {
    console.error('Error deleting army:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete army' }, { status: 500 });
  }
}
