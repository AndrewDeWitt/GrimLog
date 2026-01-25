import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch all factions that have at least one datasheet
    const factions = await prisma.faction.findMany({
      where: {
        datasheets: {
          some: {} // Must have at least one datasheet
        }
      },
      include: {
        parentFaction: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            datasheets: true,
            stratagemData: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform to a cleaner format
    const formattedFactions = factions.map(f => ({
      id: f.id,
      name: f.name,
      datasheetCount: f._count.datasheets,
      stratagemCount: f._count.stratagemData,
      parentFaction: f.parentFaction ? {
        id: f.parentFaction.id,
        name: f.parentFaction.name
      } : null
    }));

    return NextResponse.json(formattedFactions);
  } catch (error) {
    console.error('Error fetching factions:', error);
    return NextResponse.json({ error: 'Failed to fetch factions' }, { status: 500 });
  }
}

