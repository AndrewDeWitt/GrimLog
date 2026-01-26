/**
 * Army Spirit Icon Generation API Endpoint
 * 
 * POST /api/brief/generate-spirit-icon
 * 
 * Generates a unique grimdark comic book style icon for an army
 * based on the AI-generated image prompt from brief analysis.
 * 
 * NOTE: This endpoint still exists for backwards compatibility,
 * but spirit icons are now generated as part of the /api/brief/submit background flow.
 * 
 * Full Langfuse observability for LLM tracing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { langfuse } from '@/lib/langfuse';
import { requireAuth } from '@/lib/auth/apiAuth';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import {
  generateSpiritIconInternal,
  GenerateSpiritIconRequest,
} from '@/lib/spiritIconGenerator';

// HTTP endpoint (for backwards compatibility)
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();
    
    // Rate limiting
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.spiritIcon);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many icon generation requests. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.spiritIcon.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }
    
    const body: GenerateSpiritIconRequest = await request.json();
    const { imagePrompt, tagline, faction } = body;
    
    // Validate required fields
    if (!imagePrompt || !tagline || !faction) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: imagePrompt, tagline, faction' },
        { status: 400 }
      );
    }
    
    // Use the internal function
    const result = await generateSpiritIconInternal(imagePrompt, tagline, faction);
    
    // Flush Langfuse
    langfuse.flushAsync().catch(err => console.error('Langfuse flush error:', err));
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Army Spirit Icon Generation error:', error);
    
    // Handle authentication errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate icon' },
      { status: 500 }
    );
  }
}
