import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Get the faction to check for parent faction (e.g., Space Wolves -> Space Marines)
    const faction = await prisma.faction.findUnique({
      where: { id },
      select: { parentFactionId: true, name: true }
    });

    // Build list of faction IDs to query (this faction + parent if exists)
    const factionIds = [id];
    const factionNames: string[] = [];

    if (faction?.name) {
      factionNames.push(faction.name);
    }
    if (faction?.parentFactionId) {
      factionIds.push(faction.parentFactionId);

      const parentFaction = await prisma.faction.findUnique({
        where: { id: faction.parentFactionId },
        select: { name: true },
      });
      if (parentFaction?.name) {
        factionNames.push(parentFaction.name);
      }
    }
    
    // Get unique detachments for this faction AND parent faction from StratagemData
    const stratagems = await prisma.stratagemData.findMany({
      where: {
        OR: [
          // Preferred: ID-based linkage
          { factionId: { in: factionIds } },
          // Fallback: legacy records without factionId but with string faction
          ...(factionNames.length > 0
            ? [{ faction: { in: factionNames, mode: 'insensitive' as const } }]
            : []),
        ],
        detachment: {
          not: null
        }
      },
      select: {
        detachment: true
      },
      distinct: ['detachment']
    });

    // Extract and sort unique detachment names
    const detachments = stratagems
      .map(s => s.detachment)
      .filter((d): d is string => {
        if (!d) return false;
        const normalized = d.toLowerCase().trim();
        return normalized !== 'core' && normalized !== 'unknown';
      })
      .sort();

    return NextResponse.json(detachments);
  } catch (error) {
    console.error('Error fetching detachments:', error);
    return NextResponse.json({ error: 'Failed to fetch detachments' }, { status: 500 });
  }
}

