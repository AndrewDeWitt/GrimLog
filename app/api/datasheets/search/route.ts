/**
 * GET /api/datasheets/search?q=name&faction=X&role=Y
 * 
 * Search datasheets by various criteria
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchDatasheets } from '@/lib/datasheetHelpers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const faction = searchParams.get('faction');
    const subfaction = searchParams.get('subfaction');
    const role = searchParams.get('role');
    const keyword = searchParams.get('keyword');
    const limit = searchParams.get('limit');
    
    const results = await searchDatasheets({
      faction: faction || undefined,
      subfaction: subfaction || undefined,
      role: role || undefined,
      keyword: keyword || query || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    
    return NextResponse.json({
      count: results.length,
      datasheets: results,
    });
  } catch (error) {
    console.error('Error searching datasheets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

