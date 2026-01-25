/**
 * GET /api/stratagems/[faction]?detachment=X
 * 
 * Get available stratagems for a faction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ faction: string }> }
) {
  try {
    const { faction } = await params;
    const searchParams = request.nextUrl.searchParams;
    const detachment = searchParams.get('detachment');
    const subfaction = searchParams.get('subfaction');
    
    const stratagems = await prisma.stratagemData.findMany({
      where: {
        faction: { equals: decodeURIComponent(faction), mode: 'insensitive' },
        ...(subfaction && { subfaction: { equals: decodeURIComponent(subfaction), mode: 'insensitive' } }),
        ...(detachment && { detachment: { equals: decodeURIComponent(detachment), mode: 'insensitive' } }),
      },
      orderBy: [
        { cpCost: 'asc' },
        { name: 'asc' },
      ],
    });
    
    const formatted = stratagems.map(s => ({
      id: s.id,
      name: s.name,
      faction: s.faction,
      subfaction: s.subfaction,
      detachment: s.detachment,
      cpCost: s.cpCost,
      type: s.type,
      when: s.when,
      target: s.target,
      effect: s.effect,
      restrictions: s.restrictions ? JSON.parse(s.restrictions) : [],
      keywords: s.keywords ? JSON.parse(s.keywords) : [],
    }));
    
    // Group by CP cost
    const byCost = formatted.reduce((acc, strat) => {
      const cost = `${strat.cpCost}CP`;
      if (!acc[cost]) {
        acc[cost] = [];
      }
      acc[cost].push(strat);
      return acc;
    }, {} as Record<string, typeof formatted>);
    
    return NextResponse.json({
      faction: decodeURIComponent(faction),
      subfaction: subfaction ? decodeURIComponent(subfaction) : null,
      detachment: detachment ? decodeURIComponent(detachment) : null,
      count: formatted.length,
      stratagems: formatted,
      byCost,
    });
  } catch (error) {
    console.error('Error fetching stratagems:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

