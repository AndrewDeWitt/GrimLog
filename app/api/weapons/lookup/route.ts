/**
 * GET /api/weapons/lookup?name=X
 * 
 * Get weapon profile by name (cross-unit lookup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWeaponProfile } from '@/lib/datasheetHelpers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    
    if (!name) {
      return NextResponse.json(
        { error: 'Weapon name is required' },
        { status: 400 }
      );
    }
    
    const weapon = await getWeaponProfile(name);
    
    if (!weapon) {
      return NextResponse.json(
        { error: 'Weapon not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(weapon);
  } catch (error) {
    console.error('Error looking up weapon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

