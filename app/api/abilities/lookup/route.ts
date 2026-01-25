/**
 * GET /api/abilities/lookup?name=X
 * 
 * Get ability description by name
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAbilityText } from '@/lib/datasheetHelpers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    
    if (!name) {
      return NextResponse.json(
        { error: 'Ability name is required' },
        { status: 400 }
      );
    }
    
    const description = await getAbilityText(name);
    
    if (!description) {
      return NextResponse.json(
        { error: 'Ability not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      name,
      description,
    });
  } catch (error) {
    console.error('Error looking up ability:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

