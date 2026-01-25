import { NextRequest, NextResponse } from 'next/server';
import { executeToolCall } from '@/lib/toolHandlers';
import { requireAuth } from '@/lib/auth/apiAuth';
import { verifySessionAccess } from '../route';

/**
 * Manual Action API Endpoint
 *
 * Allows users to manually trigger game actions through the UI.
 * Reuses the same tool execution logic as voice commands for consistency.
 * All actions are logged to timeline events.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { id: sessionId } = await params;

    // Verify user has access to this session
    const { hasAccess } = await verifySessionAccess(sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    
    const { toolName, args } = body;
    
    if (!toolName || !args) {
      return NextResponse.json(
        { error: 'Missing toolName or args' },
        { status: 400 }
      );
    }
    
    // Execute the tool call using the same handler as voice commands
    // This ensures consistent behavior and validation
    const result = await executeToolCall(
      toolName,
      args,
      sessionId,
      new Date() // Use current timestamp for manual actions
    );
    
    // Add metadata to indicate this was a manual action
    if (result.data) {
      result.data.inputMethod = 'manual';
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.data,
      validation: result.validation
    });
    
  } catch (error: any) {
    console.error('Error in manual action API:', error);
    
    // Handle auth errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to execute action' },
      { status: 500 }
    );
  }
}

