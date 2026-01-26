import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateText } from 'ai';
import { AudioAnalysisResult } from '@/lib/types';
import { prisma } from '@/lib/prisma';
import { AI_TOOLS } from '@/lib/aiTools';
import { GEMINI_TOOLS_AI_SDK } from '@/lib/aiToolsGemini';
import { executeToolCall } from '@/lib/toolHandlers';
import { langfuse } from '@/lib/langfuse';
import { fetchGameContext } from '@/lib/validationHelpers';
import { logValidationEvent } from '@/lib/validationLogger';
import { validateTranscription, isWhisperHallucination } from '@/lib/audioValidation';
import { checkAnalysisTriggers } from '@/lib/analysisTriggers';
import { requireAuth } from '@/lib/auth/apiAuth';
import { startAnalysisRequest, completeAnalysisRequest } from '@/lib/requestDeduplication';
import { orchestrateIntent } from '@/lib/intentOrchestrator';
import { buildContext, formatContextForPrompt } from '@/lib/contextBuilder';
import { getAnalyzeProvider, validateProviderConfig, getAnalyzeModel, extractOpenAIFunctionCalls, isGeminiProvider, type NormalizedFunctionCall } from '@/lib/aiProvider';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { getGeminiProvider } from '@/lib/vertexAI';

// Use plain OpenAI client (observeOpenAI adds massive overhead - 5-15 seconds per call!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// This function has been replaced by the contextBuilder module
// See lib/contextBuilder.ts for context building logic

export async function POST(request: NextRequest) {
  // Declare trace outside try block so it's accessible in catch
  let trace: any = null;
  
  try {
    // Check if request was already aborted before doing any work
    if (request.signal.aborted) {
      console.log('🛑 Request aborted before processing started');
      return NextResponse.json<AudioAnalysisResult>({
        type: 'none',
        transcription: '',
        confidence: 0,
        analyzed: false,
        reason: 'Request aborted by client'
      });
    }
    
    // Require authentication
    const user = await requireAuth();
    
    // Rate limiting
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.analyze);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many requests. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.analyze.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }
    
    // Create Langfuse trace for this analysis request
    trace = langfuse.trace({
      name: "analyze-game-speech",
      userId: user.id,
    });

    // Parse form data - can fail if request was aborted mid-stream
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError: any) {
      // Handle abort errors during form parsing gracefully
      if (request.signal.aborted || formError?.name === 'AbortError') {
        console.log('🛑 Request aborted during form data parsing');
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: '',
          confidence: 0,
          analyzed: false,
          reason: 'Request aborted by client'
        });
      }
      // Re-throw non-abort errors
      throw formError;
    }
    
    const transcribedText = formData.get('transcription') as string;
    const armyContext = formData.get('armyContext') as string;
    const sessionId = formData.get('sessionId') as string;

    if (!transcribedText) {
      return NextResponse.json(
        { error: 'No transcription provided' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      );
    }
    
    console.log(`📝 Received transcription (${transcribedText.length} chars): "${transcribedText.substring(0, 100)}..."`);

    // Fetch full game context once (includes session, stratagems, objectives)
    // This replaces multiple sequential queries with a single optimized query
    let gameContext;
    try {
      gameContext = await fetchGameContext(sessionId);
    } catch (error) {
      console.error('Session not found:', sessionId);
      return NextResponse.json(
        { error: 'Session not found. Please start a new game.' },
        { status: 404 }
      );
    }

    const session = gameContext.session;

    // Add game state to trace metadata
    const gameState = {
      sessionId: session.id,
      battleRound: session.battleRound,
      currentPhase: session.currentPhase,
      currentTurn: session.currentTurn,
      attackerCommandPoints: session.attackerCommandPoints,
      defenderCommandPoints: session.defenderCommandPoints,
      attackerVictoryPoints: session.attackerVictoryPoints,
      defenderVictoryPoints: session.defenderVictoryPoints,
      objectivesHeld: {
        player: gameContext.objectiveMarkers.filter(o => o.controlledBy === 'player').length,
        opponent: gameContext.objectiveMarkers.filter(o => o.controlledBy === 'opponent').length,
        contested: gameContext.objectiveMarkers.filter(o => o.controlledBy === 'contested').length,
      }
    };

    trace.update({
      sessionId: sessionId,
      metadata: {
        gameState,
        armyContext: armyContext || null,
        transcriptionLength: transcribedText.length,
        transcriptionSource: 'speech-api'
      },
      tags: [
        `session-${sessionId}`,
        `round-${session.battleRound}`,
        `phase-${session.currentPhase}`,
        'speech-api'
      ]
    });

    // No Whisper needed - we already have text from Speech API!
    const audioStartTime = new Date(); // Timestamp for this speech

    // Validate transcription before proceeding
    const transcriptionValidation = validateTranscription(transcribedText);
    
    if (!transcriptionValidation.isValid) {
      console.log('Transcription validation failed:', transcriptionValidation.reason);
      return NextResponse.json<AudioAnalysisResult>({
        type: 'none',
        transcription: transcribedText, // Return it anyway for debugging
        confidence: 0,
      });
    }
    
    // Check for Whisper hallucinations
    if (isWhisperHallucination(transcribedText)) {
      console.log('Detected Whisper hallucination:', transcribedText);
      return NextResponse.json<AudioAnalysisResult>({
        type: 'none',
        transcription: transcribedText,
        confidence: 0,
      });
    }

    // Get next sequence order
    const nextSequenceOrder = await getNextSequenceOrder(sessionId);

    // Save transcript and fetch recent transcripts in parallel
    const [transcript, recentTranscripts, lastAnalysisTranscript] = await Promise.all([
      prisma.transcriptHistory.create({
        data: {
          gameSessionId: sessionId,
          text: transcribedText,
          sequenceOrder: nextSequenceOrder,
          timestamp: audioStartTime,
          segments: null // No segments from Speech API (could add word timestamps in future)
        }
      }),
      prisma.transcriptHistory.findMany({
        where: {
          gameSessionId: sessionId,
          sequenceOrder: { lt: nextSequenceOrder }
        },
        orderBy: { sequenceOrder: 'desc' },
        take: 20 // Increased from 10 to 20 for much better context
      }),
      // Find the last transcript that was analyzed (to calculate time since last analysis)
      prisma.transcriptHistory.findFirst({
        where: {
          gameSessionId: sessionId,
          wasAnalyzed: true
        },
        orderBy: { sequenceOrder: 'desc' }
      })
    ]);

    // Check if we should analyze using smart triggers
    const transcriptsSinceLastAnalysis = recentTranscripts
      .filter(t => !t.wasAnalyzed)
      .reverse()
      .map(t => t.text)
      .concat([transcribedText]); // Include current transcript
    
    const timeSinceLastAnalysis = lastAnalysisTranscript 
      ? Date.now() - new Date(lastAnalysisTranscript.timestamp).getTime()
      : Infinity; // If no previous analysis, always analyze
    
    const timeSinceLastSpeech = Date.now() - audioStartTime.getTime(); // Time since this audio chunk
    
    const triggerCheck = checkAnalysisTriggers(
      transcriptsSinceLastAnalysis,
      timeSinceLastAnalysis,
      timeSinceLastSpeech
    );
    
    console.log(`🔍 Analysis trigger check: ${triggerCheck.reason} (confidence: ${triggerCheck.confidence})`);
    
    // If we shouldn't analyze, return transcription only
    if (!triggerCheck.shouldAnalyze) {
      console.log(`📝 Transcribed only (${transcriptsSinceLastAnalysis.length} transcripts accumulated, no analysis needed)`);
      
      await langfuse.flushAsync().catch(() => {});
      
      return NextResponse.json<AudioAnalysisResult>({
        type: 'none',
        transcription: transcribedText,
        confidence: 0,
        analyzed: false, // Indicate we didn't analyze
        reason: triggerCheck.reason
      });
    }
    
    // Trigger detected - now classify intent AND validate relevance in one call
    console.log(`🤖 Triggering FULL ANALYSIS: ${triggerCheck.reason}`);
    console.time('⏱️ Total Analysis Time');
    
    // ============================================
    // STEP 1: REQUEST DEDUPLICATION
    // ============================================
    
    // Collect transcript IDs that would be part of this analysis
    const transcriptIdsForAnalysis = [
      transcript.id,
      ...recentTranscripts.map(t => t.id)
    ];
    
    // Check if these transcripts are already being analyzed
    const requestToken = startAnalysisRequest(transcriptIdsForAnalysis);
    
    if (!requestToken) {
      // Another request is already processing these transcripts
      console.log(`⏭️ Skipping analysis - already being processed by another request`);
      
      await langfuse.flushAsync().catch(() => {});
      
      return NextResponse.json<AudioAnalysisResult>({
        type: 'none',
        transcription: transcribedText,
        confidence: 0,
        analyzed: false,
        reason: 'Duplicate request - already being processed'
      });
    }
    
    // ============================================
    // STEP 2: COMBINED VALIDATION & INTENT CLASSIFICATION
    // ============================================
    
    // Get abort signal from request for cancellation propagation
    const abortSignal = request.signal;
    
    try {
      // Check if request was already aborted before starting expensive AI operations
      if (abortSignal.aborted) {
        console.log('🛑 Request aborted before intent classification');
        completeAnalysisRequest(requestToken);
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: transcribedText,
          confidence: 0,
          analyzed: false,
          reason: 'Request aborted by client'
        });
      }
      
      console.time('⏱️ Gatekeeper + Intent Classification');
      
      // Create a generation for combined validation + intent classification
      const intentGeneration = trace.generation({
        name: "gatekeeper-and-intent-classification",
        metadata: {
          transcription: transcribedText,
          currentPhase: session.currentPhase,
          battleRound: session.battleRound,
          contextTranscripts: transcriptsSinceLastAnalysis.slice(0, -1)
        }
      });
      
      // Single AI call that does BOTH gatekeeper validation AND intent classification
      // Pass abort signal to cancel if client disconnects
      const intentClassification = await orchestrateIntent(
        transcribedText,
        session.currentPhase,
        session.battleRound,
        transcriptsSinceLastAnalysis.slice(0, -1), // Pass context for gatekeeper check
        intentGeneration,
        abortSignal
      );
      
      console.timeEnd('⏱️ Gatekeeper + Intent Classification');
      
      // Check if gatekeeper blocked
      if (!intentClassification.isGameRelated && intentClassification.confidence >= 0.7) {
        console.log(`🚦 Gatekeeper blocked: Not game-related (${intentClassification.confidence.toFixed(2)} confidence)`);
        console.timeEnd('⏱️ Total Analysis Time');
        
        await langfuse.flushAsync().catch(() => {});
        
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: transcribedText,
          confidence: 0,
          analyzed: false,
          reason: `Not game-related: ${intentClassification.reasoning}`
        });
      }
      
      console.log(`✅ Gatekeeper approved + Context tier selected: ${intentClassification.contextTier}`);
      
      // ============================================
      // STEP 3: BUILD APPROPRIATE CONTEXT TIER
      // ============================================
      
      console.time('⏱️ Context Building');
      const context = await buildContext(
        intentClassification.contextTier,
        sessionId,
        nextSequenceOrder
      );
      
      // Format context into system prompt (now async for mission context loading)
      const systemPrompt = await formatContextForPrompt(context, armyContext, sessionId);
      console.timeEnd('⏱️ Context Building');
      
      // ============================================
      // STEP 4: MARK TRANSCRIPT AS ANALYZED
      // ============================================
      
      await prisma.transcriptHistory.update({
        where: { id: transcript.id },
        data: { wasAnalyzed: true }
      });

      // ============================================
      // STEP 5: EXECUTE AI ANALYSIS
      // ============================================
      
      // Check if request was aborted before starting main AI analysis
      if (abortSignal.aborted) {
        console.log('🛑 Request aborted before main AI analysis');
        completeAnalysisRequest(requestToken);
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: transcribedText,
          confidence: 0,
          analyzed: false,
          reason: 'Request aborted by client'
        });
      }
      
      // Get configured provider
      const provider = getAnalyzeProvider();
      
      // Validate API key is present
      try {
        validateProviderConfig(provider);
      } catch (error) {
        console.error('Provider configuration error:', error);
        
        // Cleanup request token
        completeAnalysisRequest(requestToken);
        
        await langfuse.flushAsync().catch(() => {});
        
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: transcribedText,
          confidence: 0,
          toolCalls: [],
          analyzed: false,
          reason: `Provider configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      const modelName = getAnalyzeModel(provider, 'main');
      console.log(`🤖 Using AI Provider: ${provider.toUpperCase()}`);
      console.log(`📊 Model: ${modelName}`);

      // Create a generation span to capture the full prompt and response
      const analysisGeneration = trace.generation({
        name: `${provider}-analyze`,
        model: modelName,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcribedText },
        ],
        metadata: {
          provider,
          tools: isGeminiProvider(provider) ? Object.keys(GEMINI_TOOLS_AI_SDK) : AI_TOOLS.map(t => t.name),
          contextTier: context.tier,
          intentClassification: intentClassification.intent,
          intentConfidence: intentClassification.confidence,
          hasArmyContext: !!armyContext
        }
      });

      // Retry mechanism for AI calls (max 3 attempts)
      console.time(`⏱️ ${modelName} Analysis`);
      let response: any = null;
      let functionCallItems: NormalizedFunctionCall[] = [];
      let usage = { input: 0, output: 0, total: 0 };
      let lastError = null;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Check for abort before each retry attempt
          if (abortSignal.aborted) {
            console.log(`🛑 Request aborted before AI attempt ${attempt}`);
            throw new DOMException('Request aborted by client', 'AbortError');
          }
          
          if (isGeminiProvider(provider)) {
            // Google Gemini API call with function calling (AI Studio or Vertex AI with WIF)
            // Uses AI SDK for proper authentication
            const gemini = getGeminiProvider(provider as 'google' | 'vertex');
            
            const result = await generateText({
              model: gemini(modelName),
              system: systemPrompt,
              prompt: transcribedText,
              tools: GEMINI_TOOLS_AI_SDK,
              maxOutputTokens: 8192,
              temperature: 0.7,
              abortSignal,
            });
            
            response = result;
            
            // Extract token usage
            usage = {
              input: result.usage?.inputTokens || 0,
              output: result.usage?.outputTokens || 0,
              total: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
            };
            console.log(`📊 Gemini token usage: ${usage.input} input, ${usage.output} output, ${usage.total} total`);
            
            // Extract tool calls from AI SDK response
            console.log('🔍 Extracting function calls from Gemini response...');
            if (result.toolCalls && result.toolCalls.length > 0) {
              functionCallItems = result.toolCalls.map((tc: any) => ({
                name: tc.toolName,
                arguments: JSON.stringify(tc.args),
                call_id: tc.toolCallId
              }));
            }
            console.log(`📊 Extracted ${functionCallItems.length} function call(s) from Gemini`);
            
          } else {
            // OpenAI API call
            // Pass abort signal to cancel if client disconnects
            response = await openai.responses.create({
              model: modelName,
              instructions: systemPrompt,
              input: transcribedText,
              tools: AI_TOOLS,
              parallel_tool_calls: true,
              tool_choice: "auto", // Let model decide but with assertive prompt
              reasoning: {
                effort: 'low' // Good balance for tool calling - faster than medium
              },
              text: {
                verbosity: 'low' // Concise - we only need tool calls, not explanations
              }
            }, { signal: abortSignal });
            
            // Extract function calls from OpenAI response
            functionCallItems = extractOpenAIFunctionCalls(response);
          }
          
          // Success - break retry loop
          break;

        } catch (error: any) {
          // If abort error, don't retry - propagate immediately
          if (error?.name === 'AbortError' || abortSignal.aborted) {
            console.log('🛑 AI analysis aborted by client');
            throw error;
          }
          
          lastError = error;
          console.error(`${modelName} attempt ${attempt}/${MAX_RETRIES} failed:`, error);
          
          // If this was the last attempt, we'll handle it below
          if (attempt === MAX_RETRIES) {
            console.error('All retry attempts failed');
            console.error('Last error:', lastError);
          } else {
            // Wait briefly before retry (exponential backoff: 100ms, 200ms, 400ms)
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
          }
        }
      }
      console.timeEnd(`⏱️ ${modelName} Analysis`);

      // If all retries failed, return fallback response
      if (!response) {
        console.error('Failed to get response after retries:', lastError);
        
        // End generation with error
        analysisGeneration.end({
          level: "ERROR",
          statusMessage: lastError instanceof Error ? lastError.message : 'Unknown error'
        });
        
        // Cleanup request token
        completeAnalysisRequest(requestToken);
        
        await langfuse.flushAsync().catch(() => {});
        
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: transcribedText,
          confidence: 0,
          toolCalls: []
        });
      }

      // Log the response output to the generation (manual logging for control)
      console.time('  └─ Langfuse trace update');
      analysisGeneration.update({
        model: modelName,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcribedText }
        ],
        output: isGeminiProvider(provider) ? (response.text || JSON.stringify(response)) : (response as any).output,
        metadata: {
          provider,
          toolCallsDetected: functionCallItems.length,
          toolCallNames: functionCallItems.map((fc: NormalizedFunctionCall) => fc.name),
          contextTier: context.tier,
          responseId: isGeminiProvider(provider) ? 'gemini-response' : (response as any).id || 'unknown'
        }
      });
      // End generation with token usage for Langfuse cost calculation
      analysisGeneration.end({
        usage: usage.total > 0 ? {
          input: usage.input,
          output: usage.output,
          total: usage.total
        } : undefined
      });
      console.timeEnd('  └─ Langfuse trace update');

      // ============================================
      // STEP 6: EXECUTE TOOL CALLS
      // ============================================

      // Execute tool calls in parallel if any
      const toolResults = [];
      if (functionCallItems && functionCallItems.length > 0) {
        console.log(`Executing ${functionCallItems.length} tool calls in parallel...`);
        console.time('⏱️ Tool Execution');
        
        // Create a span for tool executions
        const toolExecutionSpan = trace.span({
          name: "execute-tool-calls",
          metadata: {
            toolCount: functionCallItems.length,
            tools: functionCallItems.map((fc: any) => fc.name)
          }
        });
      
        // Execute all tools in parallel for maximum performance
        const toolPromises = functionCallItems.map(async (functionCall: NormalizedFunctionCall, toolIndex: number) => {
          const functionName = functionCall.name;
          let args;
          
          try {
            // Arguments are already normalized to JSON string format by our extraction functions
            args = JSON.parse(functionCall.arguments);
          } catch (parseError) {
            console.error(`Failed to parse arguments for ${functionName}:`, functionCall.arguments);
            const errorResult = {
              toolName: functionName,
              success: false,
              message: `Invalid arguments: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
            };
            
            trace.event({
              name: `tool-${functionName}`,
              input: functionCall.arguments,
              output: errorResult,
              level: "ERROR",
              metadata: {
                callId: functionCall.call_id,
                sessionId: sessionId,
                provider,
                error: 'Argument parse error'
              }
            });
            
            return errorResult;
          }
          
          console.log(`Executing tool: ${functionName}`, args);
          
          // Use simple timestamp since we don't have word-level timing from Speech API
          // All tools from same speech get same timestamp (could add millisecond offsets if needed)
          const toolTimestamp = new Date(audioStartTime.getTime() + (toolIndex * 100)); // 100ms offset per tool
          
          console.log(`  Tool ${toolIndex + 1}/${functionCallItems.length} timestamp:`, toolTimestamp.toLocaleTimeString());
          
          try {
            const result = await executeToolCall(functionName, args, sessionId, toolTimestamp);
            console.log(`Tool ${functionName} result:`, result);
            
            // Log validation event asynchronously (don't block tool execution)
            if (result.validation) {
              logValidationEvent(
                sessionId,
                result,
                session.currentPhase,
                session.battleRound
              ).catch(err => console.error('Validation log error:', err));
            }
            
            // Create trace event (non-blocking)
            trace.event({
              name: `tool-${functionName}`,
              input: args,
              output: result,
              level: result.success ? "DEFAULT" : "WARNING",
              metadata: {
                callId: functionCall.call_id,
                sessionId: sessionId,
                provider,
                success: result.success
              }
            });
            
            return result;
          } catch (error) {
            console.error(`Failed to execute tool ${functionName}:`, error);
            const errorResult = {
              toolName: functionName,
              success: false,
              message: error instanceof Error ? error.message : 'Unknown error'
            };
            
            // Create trace event for error (non-blocking)
            trace.event({
              name: `tool-${functionName}`,
              input: args,
              output: errorResult,
              level: "ERROR",
              metadata: {
                callId: functionCall.call_id,
                sessionId: sessionId,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            });
            
            return errorResult;
          }
        });

        // Wait for all tools to complete
        const results = await Promise.all(toolPromises);
        toolResults.push(...results);

        toolExecutionSpan.end({
          metadata: {
            results: toolResults,
            successCount: toolResults.filter(r => r.success).length,
            failureCount: toolResults.filter(r => !r.success).length
          }
        });
        
        console.timeEnd('⏱️ Tool Execution');
      }

      // ============================================
      // STEP 7: CLEANUP AND RETURN
      // ============================================

      // Update trace with final results
      trace.update({
        output: {
          transcription: transcribedText,
          toolCallsExecuted: toolResults.length,
          toolResults: toolResults,
          eventDetected: toolResults.length > 0,
          gatekeeperApproved: true,
          contextTier: context.tier,
          intentClassification: intentClassification.intent
        },
        tags: [
          "audio-analysis",
          "gatekeeper-approved",
          toolResults.length > 0 ? "event-detected" : "no-event",
          `round-${gameState.battleRound}`,
          `phase-${gameState.currentPhase}`,
          `context-${context.tier}`,
          `intent-${intentClassification.intent}`
        ]
      });

      // Complete the analysis request (cleanup deduplication)
      completeAnalysisRequest(requestToken);

      // Flush trace asynchronously (don't block response)
      langfuse.flushAsync().catch(err => 
        console.error('Langfuse flush error:', err)
      );

      console.timeEnd('⏱️ Total Analysis Time');

      // Return analysis with tool execution results immediately
      return NextResponse.json<AudioAnalysisResult>({
        type: toolResults.length > 0 ? 'event' : 'none',
        transcription: transcribedText,
        confidence: toolResults.length > 0 ? 0.9 : 0.5,
        toolCalls: toolResults,
        analyzed: true // Indicate we performed full GPT analysis
      });
      
    } catch (analysisError: any) {
      // Cleanup on any error during analysis
      completeAnalysisRequest(requestToken);
      
      // Handle abort errors gracefully - return clean response instead of error
      if (analysisError?.name === 'AbortError' || request.signal.aborted) {
        console.log('🛑 Analysis aborted by client - returning clean response');
        console.timeEnd('⏱️ Total Analysis Time');
        
        await langfuse.flushAsync().catch(() => {});
        
        return NextResponse.json<AudioAnalysisResult>({
          type: 'none',
          transcription: transcribedText,
          confidence: 0,
          analyzed: false,
          reason: 'Request aborted by client'
        });
      }
      
      throw analysisError; // Re-throw non-abort errors to outer catch block
    }
  } catch (error: any) {
    console.error('Error in analyze API:', error);
    
    // Handle abort errors at the top level (in case they propagate)
    if (error?.name === 'AbortError') {
      console.log('🛑 Request aborted at top level');
      return NextResponse.json<AudioAnalysisResult>({
        type: 'none',
        transcription: '',
        confidence: 0,
        analyzed: false,
        reason: 'Request aborted by client'
      });
    }
    
    // Handle auth errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Log error to trace (if trace was created)
    if (trace) {
      try {
        trace.update({
          level: "ERROR",
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
        // Flush asynchronously, don't block error response
        langfuse.flushAsync().catch(flushError => 
          console.error('Failed to flush Langfuse trace:', flushError)
        );
      } catch (traceError) {
        // Ignore trace errors
        console.error('Failed to update trace:', traceError);
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze audio' },
      { status: 500 }
    );
  }
}

// Helper function to get next sequence order
async function getNextSequenceOrder(sessionId: string): Promise<number> {
  const lastTranscript = await prisma.transcriptHistory.findFirst({
    where: { gameSessionId: sessionId },
    orderBy: { sequenceOrder: 'desc' },
    select: { sequenceOrder: true }
  });

  return (lastTranscript?.sequenceOrder ?? -1) + 1;
}

