/**
 * GET /api/datasheets/[faction]/[name]
 * 
 * Fetch a single datasheet with all relations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetByName } from '@/lib/datasheetHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ faction: string; name: string }> }
) {
  try {
    const { faction, name } = await params;
    
    const datasheet = await getDatasheetByName(
      decodeURIComponent(name),
      decodeURIComponent(faction)
    );
    
    if (!datasheet) {
      return NextResponse.json(
        { error: 'Datasheet not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(datasheet);
  } catch (error) {
    console.error('Error fetching datasheet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

