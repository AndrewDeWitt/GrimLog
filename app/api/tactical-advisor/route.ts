/**
 * Tactical Advisor API Endpoint
 * 
 * POST /api/tactical-advisor
 * 
 * Analyzes current game state and returns AI-generated tactical suggestions
 * using Gemini 3 Flash for analysis.
 * 
 * Full Langfuse observability for LLM tracing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '@/lib/auth/apiAuth';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { langfuse } from '@/lib/langfuse';
import {
  buildTacticalContext,
  buildTacticalSystemPrompt,
  buildTacticalUserPrompt,
  parseAIResponse
} from '@/lib/tacticalAdvisor';
import { TacticalAdviceRequest, TacticalAdviceResponse } from '@/lib/types';

// Initialize Gemini client
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Model to use for tactical analysis
const TACTICAL_MODEL = 'gemini-3-flash-preview';

// JSON Schema for structured output - ensures consistent response format
const TACTICAL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      description: "List of tactical suggestions for the player",
      items: {
        type: "object",
        properties: {
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Priority level of this suggestion"
          },
          category: {
            type: "string",
            enum: ["positioning", "stratagem", "ability", "objective", "resource", "threat", "opponent_threat"],
            description: "Category of tactical advice"
          },
          title: {
            type: "string",
            description: "Brief action title"
          },
          description: {
            type: "string",
            description: "Detailed actionable advice"
          },
          reasoning: {
            type: "string",
            description: "Explanation citing specific rules (detailed mode only)"
          },
          relatedUnits: {
            type: "array",
            items: { type: "string" },
            description: "Unit names involved in this suggestion"
          },
          relatedRules: {
            type: "array",
            items: { type: "string" },
            description: "Rule names referenced (detailed mode only)"
          },
          cpCost: {
            type: "integer",
            description: "CP cost if this is a stratagem suggestion"
          },
          isOpponentPlay: {
            type: "boolean",
            description: "True if this is an opponent_threat category suggestion"
          }
        },
        required: ["priority", "category", "title", "description"]
      }
    }
  },
  required: ["suggestions"]
};

export async function POST(request: NextRequest) {
  // Declare trace outside try block for error handling access
  let trace: any = null;
  
  try {
    // Require authentication
    const user = await requireAuth();
    
    // Rate limiting
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.tacticalAdvisor);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many tactical advisor requests. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.tacticalAdvisor.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }
    
    // Parse request body
    const body: TacticalAdviceRequest = await request.json();
    const { sessionId, perspective, detailLevel } = body;
    
    // Validate required parameters
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      );
    }
    
    if (!perspective || !['attacker', 'defender'].includes(perspective)) {
      return NextResponse.json(
        { error: 'Invalid perspective. Must be "attacker" or "defender"' },
        { status: 400 }
      );
    }
    
    const level = detailLevel === 'detailed' ? 'detailed' : 'quick';
    
    // Create Langfuse trace for this tactical advisor request
    trace = langfuse.trace({
      name: "tactical-advisor",
      userId: user.id,
      sessionId: sessionId,
      metadata: {
        perspective,
        detailLevel: level,
      },
      tags: [
        `session-${sessionId}`,
        `perspective-${perspective}`,
        `detail-${level}`,
        'tactical-advisor'
      ]
    });
    
    console.log(`🎯 Tactical Advisor request: session=${sessionId}, perspective=${perspective}, detail=${level}`);
    console.time('⏱️ Total Tactical Analysis');
    
    // Build tactical context from game state (with span tracking)
    console.time('⏱️ Context Building');
    const contextSpan = trace.span({
      name: "build-tactical-context",
      metadata: { sessionId, perspective }
    });
    
    const context = await buildTacticalContext(sessionId, perspective);
    
    contextSpan.end({
      metadata: {
        attackerUnits: context.attackerUnits.length,
        defenderUnits: context.defenderUnits.length,
        availableStratagems: context.availableStratagems.length,
        phase: context.phase,
        battleRound: context.battleRound,
        currentTurn: context.currentTurn
      }
    });
    console.timeEnd('⏱️ Context Building');
    
    // Build prompts
    const systemPrompt = buildTacticalSystemPrompt(level);
    const userPrompt = buildTacticalUserPrompt(context, perspective);
    
    // Update trace with game state metadata
    trace.update({
      metadata: {
        perspective,
        detailLevel: level,
        gameState: {
          phase: context.phase,
          battleRound: context.battleRound,
          currentTurn: context.currentTurn,
          attackerCP: context.attackerCP,
          defenderCP: context.defenderCP,
          attackerVP: context.attackerVP,
          defenderVP: context.defenderVP,
          objectivesHeldByAttacker: context.objectivesHeldByAttacker,
          objectivesHeldByDefender: context.objectivesHeldByDefender,
        },
        units: {
          attackerCount: context.attackerUnits.length,
          defenderCount: context.defenderUnits.length,
          attackerActive: context.attackerUnits.filter(u => !u.isDestroyed).length,
          defenderActive: context.defenderUnits.filter(u => !u.isDestroyed).length,
        },
        stratagems: {
          available: context.availableStratagems.length,
        },
        factions: {
          attacker: context.attackerFaction,
          defender: context.defenderFaction,
        },
        detachment: context.attackerDetachment,
      }
    });
    
    console.log(`📊 Context built: ${context.attackerUnits.length} attacker units, ${context.defenderUnits.length} defender units`);
    console.log(`📊 Stratagems available: ${context.availableStratagems.length}`);
    
    // Create generation span for Gemini call
    const generation = trace.generation({
      name: "gemini-tactical-analysis",
      model: TACTICAL_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      metadata: {
        provider: 'google',
        temperature: 0.7,
        maxOutputTokens: 20000,
        responseMimeType: 'application/json',
        structuredOutput: true,
        thinkingDisabled: true,
      }
    });
    
    // Call Gemini for analysis
    console.time('⏱️ Gemini Analysis');
    
    let response;
    try {
      response = await gemini.models.generateContent({
        model: TACTICAL_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 20000,
          responseMimeType: 'application/json',
          responseJsonSchema: TACTICAL_RESPONSE_SCHEMA,
          // Disable thinking to ensure all tokens go to the actual response
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      });
    } catch (aiError: any) {
      console.error('Gemini API error:', aiError);
      
      // End generation with error
      generation.end({
        level: "ERROR",
        statusMessage: aiError.message || 'Gemini API error'
      });
      
      // Update trace with error
      trace.update({
        level: "ERROR",
        metadata: {
          error: aiError.message || 'Gemini API error',
          errorType: 'gemini_api_error'
        }
      });
      
      // Flush trace before returning error
      await langfuse.flushAsync().catch(() => {});
      
      return NextResponse.json(
        { error: 'AI analysis failed. Please try again.' },
        { status: 503 }
      );
    }
    
    console.timeEnd('⏱️ Gemini Analysis');

    // Extract token usage from response for Langfuse cost tracking
    const geminiResponse = response as any;
    const usage = {
      input: geminiResponse.usageMetadata?.promptTokenCount || 0,
      output: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      total: geminiResponse.usageMetadata?.totalTokenCount || 0
    };
    console.log(`📊 Tactical advisor token usage: ${usage.input} input, ${usage.output} output, ${usage.total} total`);

    // Extract text from response
    const responseText = response.text || '';

    if (!responseText) {
      console.error('Empty response from Gemini');
      
      // End generation with error
      generation.end({
        level: "ERROR",
        statusMessage: 'Empty response from Gemini'
      });
      
      // Flush trace before returning error
      await langfuse.flushAsync().catch(() => {});
      
      return NextResponse.json(
        { error: 'No response from AI. Please try again.' },
        { status: 500 }
      );
    }
    
    // Update generation with successful output
    console.time('  └─ Langfuse generation update');
    generation.update({
      output: responseText,
      metadata: {
        responseLength: responseText.length,
        provider: 'google',
      }
    });
    // End generation with token usage for Langfuse cost calculation
    generation.end({
      usage: usage.total > 0 ? {
        input: usage.input,
        output: usage.output,
        total: usage.total
      } : undefined
    });
    console.timeEnd('  └─ Langfuse generation update');
    
    console.log(`📝 Gemini response length: ${responseText.length} chars`);
    
    // Parse response into structured suggestions
    const advice: TacticalAdviceResponse = parseAIResponse(
      responseText,
      context,
      perspective,
      level
    );
    
    console.timeEnd('⏱️ Total Tactical Analysis');
    console.log(`✅ Returning ${advice.suggestions.length} suggestions`);
    
    // Update trace with final results
    trace.update({
      output: {
        suggestionsCount: advice.suggestions.length,
        suggestions: advice.suggestions.map(s => ({
          priority: s.priority,
          category: s.category,
          title: s.title
        })),
        generatedAt: advice.generatedAt,
      },
      tags: [
        `session-${sessionId}`,
        `perspective-${perspective}`,
        `detail-${level}`,
        `round-${context.battleRound}`,
        `phase-${context.phase}`,
        'tactical-advisor',
        'success'
      ]
    });
    
    // Flush trace asynchronously (don't block response)
    langfuse.flushAsync().catch(err => 
      console.error('Langfuse flush error:', err)
    );
    
    return NextResponse.json(advice);
    
  } catch (error: any) {
    console.error('Tactical Advisor API error:', error);
    
    // Log error to trace if it was created
    if (trace) {
      try {
        trace.update({
          level: "ERROR",
          metadata: {
            error: error.message || 'Unknown error',
            errorType: error.name || 'Error'
          }
        });
        
        // Flush asynchronously, don't block error response
        langfuse.flushAsync().catch(flushError => 
          console.error('Failed to flush Langfuse trace:', flushError)
        );
      } catch (traceError) {
        console.error('Failed to update trace:', traceError);
      }
    }
    
    // Handle auth errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Handle session not found
    if (error.message === 'Session not found') {
      return NextResponse.json(
        { error: 'Game session not found' },
        { status: 404 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { error: 'Failed to generate tactical advice' },
      { status: 500 }
    );
  }
}
