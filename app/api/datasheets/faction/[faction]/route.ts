/**
 * GET /api/datasheets/faction/[faction]?subfaction=X
 * 
 * List all datasheets for a faction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFactionDatasheets } from '@/lib/datasheetHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ faction: string }> }
) {
  try {
    const { faction } = await params;
    const searchParams = request.nextUrl.searchParams;
    const subfaction = searchParams.get('subfaction');
    
    const datasheets = await getFactionDatasheets(
      decodeURIComponent(faction),
      subfaction ? decodeURIComponent(subfaction) : undefined
    );
    
    // Group by role for easier navigation
    const grouped = datasheets.reduce((acc, ds) => {
      if (!acc[ds.role]) {
        acc[ds.role] = [];
      }
      acc[ds.role].push(ds);
      return acc;
    }, {} as Record<string, typeof datasheets>);
    
    return NextResponse.json({
      faction: decodeURIComponent(faction),
      subfaction: subfaction ? decodeURIComponent(subfaction) : null,
      count: datasheets.length,
      datasheets,
      byRole: grouped,
    });
  } catch (error) {
    console.error('Error fetching faction datasheets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

