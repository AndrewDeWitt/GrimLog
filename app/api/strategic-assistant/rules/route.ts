import { NextRequest, NextResponse } from 'next/server';
import { getRelevantRules } from '@/lib/strategicAssistant';
import { requireAuth } from '@/lib/auth/apiAuth';

/**
 * Strategic Assistant API Endpoint
 * 
 * POST /api/strategic-assistant/rules
 * 
 * Returns phase-filtered rules (stratagems + abilities) for the current game state.
 * Used by the Strategic Assistant modal UI.
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();
    
    const { sessionId, currentPhase, currentPlayerTurn } = await request.json();
    
    // Validate required parameters
    if (!sessionId || !currentPhase || !currentPlayerTurn) {
      return NextResponse.json(
        { error: 'Missing required parameters: sessionId, currentPhase, currentPlayerTurn' },
        { status: 400 }
      );
    }
    
    // Validate phase
    const validPhases = ['Command', 'Movement', 'Shooting', 'Charge', 'Fight'];
    if (!validPhases.includes(currentPhase)) {
      return NextResponse.json(
        { error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate player turn
    if (currentPlayerTurn !== 'player' && currentPlayerTurn !== 'opponent') {
      return NextResponse.json(
        { error: 'Invalid currentPlayerTurn. Must be "player" or "opponent"' },
        { status: 400 }
      );
    }
    
    // Get relevant rules
    const rules = await getRelevantRules(sessionId, currentPhase, currentPlayerTurn);
    
    return NextResponse.json(rules);
    
  } catch (error) {
    console.error('Strategic assistant API error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return NextResponse.json(
          { error: 'Game session not found' },
          { status: 404 }
        );
      }
      
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    // Generic error
    return NextResponse.json(
      { error: 'Failed to fetch strategic rules' },
      { status: 500 }
    );
  }
}

