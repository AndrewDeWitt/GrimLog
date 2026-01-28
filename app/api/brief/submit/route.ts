/**
 * Brief Submit API Endpoint
 *
 * POST /api/brief/submit
 *
 * Quick submission endpoint for async brief generation.
 * Creates a pending record and triggers background processing.
 * Returns immediately with the brief ID for polling.
 *
 * Uses direct function calls for background processing (no HTTP).
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { checkCreditsAvailable } from '@/lib/briefCredits';
import { analyzeBrief } from '@/lib/briefAnalysis';
import { parseArmyListFromText, loadKnownDetachments } from '@/lib/armyListParser';
import { generateBrief } from '@/lib/briefGenerator';
import { langfuse } from '@/lib/langfuse';
import { fetchFactionDatasheets } from '@/lib/briefSuggestions';
import { buildBaseSharedPrefix, getSharedPrefixStats } from '@/lib/briefSharedContext';

// Route segment config
export const dynamic = 'force-dynamic';
// Max duration for Vercel Pro plan with Fluid Compute (13+ minutes max)
// Background processing via after() inherits this timeout
export const maxDuration = 800;

interface SubmitRequest {
  text: string;
  factionId: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const user = await requireAuth();

    // 2. Rate limiting
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.briefAnalyze);

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
            'X-RateLimit-Limit': RATE_LIMITS.briefAnalyze.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    // 3. Check credits (without deducting - will deduct when processing starts)
    const creditCheck = await checkCreditsAvailable(user.id);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: 'No credits remaining',
          remainingCredits: 0,
          message: 'You have used all your free brief generations. Contact an administrator for more credits.'
        },
        { status: 402 }
      );
    }

    // 4. Parse and validate request body
    const body: SubmitRequest = await request.json();
    const { text, factionId } = body;

    if (!factionId?.trim()) {
      return NextResponse.json(
        { error: 'Please select a faction' },
        { status: 400 }
      );
    }

    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Please provide an army list text' },
        { status: 400 }
      );
    }

    // Basic validation - text should have some content
    if (text.trim().length < 20) {
      return NextResponse.json(
        { error: 'Army list text is too short. Please paste a complete army list.' },
        { status: 400 }
      );
    }

    // 5. Create pending brief record
    const brief = await prisma.briefGeneration.create({
      data: {
        userId: user.id,
        status: 'pending',
        inputText: text.trim(),
      },
    });

    console.log(`📋 Brief submitted: id=${brief.id}, userId=${user.id}`);

    // 6. Trigger background processing using Next.js after() API
    // Uses direct function calls - no HTTP requests needed
    after(async () => {
      // Create a single Langfuse trace for the entire brief generation process
      const trace = langfuse.trace({
        name: "brief-strategic-analysis-background",
        metadata: {
          briefId: brief.id,
          userId: user.id,
          textLength: text.length,
        },
        tags: ['brief-analysis', 'background-processing']
      });

      try {
        console.log(`🔄 Starting background processing for brief: ${brief.id}`);

        // Update status to processing
        await prisma.briefGeneration.update({
          where: { id: brief.id },
          data: { status: 'processing' },
        });

        // Step 0: Build base shared prefix for cache optimization
        // This prefix (datasheets + known detachments) is shared by ALL 3 LLM calls
        const prefixSpan = trace.span({
          name: "build-base-shared-prefix",
          metadata: { factionId }
        });
        console.log(`📋 Building shared prefix for brief: ${brief.id}`);
        
        // Look up faction name from ID for fetchFactionDatasheets
        const factionRecord = await prisma.faction.findUnique({
          where: { id: factionId }
        });
        const factionName = factionRecord?.name || 'Unknown';
        
        const [factionDatasheets, knownDetachments] = await Promise.all([
          fetchFactionDatasheets(factionName, null),
          loadKnownDetachments()
        ]);
        
        const baseSharedPrefix = buildBaseSharedPrefix(factionDatasheets, knownDetachments);
        const prefixStats = getSharedPrefixStats(baseSharedPrefix);
        
        prefixSpan.end({
          metadata: {
            prefixCharCount: prefixStats.charCount,
            estimatedTokens: prefixStats.estimatedTokens,
            datasheetCount: factionDatasheets.length
          }
        });
        console.log(`📋 Built base shared prefix: ${prefixStats.charCount} chars (~${prefixStats.estimatedTokens} tokens), ${factionDatasheets.length} datasheets`);

        // Step 1: Parse the army list (direct function call)
        const parseSpan = trace.span({
          name: "parse-army-list",
          metadata: { textLength: text.length }
        });
        console.log(`📝 Parsing army list for brief: ${brief.id}`);
        const parseResult = await parseArmyListFromText({
          text: text.trim(),
          factionId, // Filter datasheets by selected faction
          trace, // Pass trace for LLM cost tracking
          sharedSystemPrefix: baseSharedPrefix, // Use shared prefix for cache optimization
        });

        if (!parseResult.success || !parseResult.parsedArmy) {
          parseSpan.end({ level: "ERROR", statusMessage: parseResult.error });
          throw new Error(parseResult.error || 'Failed to parse army list');
        }

        const parsedArmy = parseResult.parsedArmy;
        parseSpan.end({
          metadata: {
            unitCount: parsedArmy.units?.length || 0,
            faction: parsedArmy.detectedFaction,
            detachment: parsedArmy.detectedDetachment,
          }
        });
        console.log(`✅ Army parsed: ${parsedArmy.units?.length || 0} units`);

        // DEBUG: Add delay to test cache propagation
        // Gemini implicit caching may need time to propagate before subsequent calls can hit it
        const CACHE_PROPAGATION_DELAY_MS = 30000; // 30 seconds
        console.log(`⏳ Waiting ${CACHE_PROPAGATION_DELAY_MS / 1000}s for cache propagation...`);
        await new Promise(resolve => setTimeout(resolve, CACHE_PROPAGATION_DELAY_MS));
        console.log(`✅ Cache propagation delay complete`);

        // Step 2: Run local analysis
        const localAnalysisSpan = trace.span({
          name: "run-local-analysis",
        });
        console.log(`📊 Running local analysis for brief: ${brief.id}`);
        const localAnalysis = analyzeBrief(parsedArmy);
        localAnalysisSpan.end({
          metadata: {
            totalPoints: localAnalysis.totalPoints,
            unitCount: localAnalysis.unitCount,
            modelCount: localAnalysis.modelCount,
          }
        });
        console.log(`✅ Local analysis complete: ${localAnalysis.totalPoints} points`);

        // Step 3: Generate brief with AI (direct function call)
        console.log(`🤖 Starting AI analysis for brief: ${brief.id}`);
        const generateResult = await generateBrief({
          parsedArmy,
          localAnalysis,
          userId: user.id,
          briefId: brief.id,
          trace, // Pass trace for LLM cost tracking
          baseSharedPrefix, // Pass the pre-built prefix for cache optimization
        });

        if (generateResult.success) {
          console.log(`✅ Background processing completed for brief: ${brief.id}`);
          trace.update({ tags: ['success'] });
        } else {
          console.error(`❌ AI analysis failed for brief ${brief.id}:`, generateResult.error);
          trace.update({ metadata: { error: generateResult.error, status: 'error' } });
          // generateBrief already marks the brief as failed in the database
        }

      } catch (error) {
        console.error(`❌ Background processing error for brief ${brief.id}:`, error);

        trace.update({
          metadata: { error: error instanceof Error ? error.message : 'Unknown error', status: 'error' }
        });

        // Update status to failed
        await prisma.briefGeneration.update({
          where: { id: brief.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } finally {
        // Always flush the trace at the end
        await langfuse.flushAsync().catch(() => {});
      }
    });

    // 7. Return immediately with brief ID
    return NextResponse.json({
      success: true,
      briefId: brief.id,
      status: 'pending',
      message: 'Brief generation started. You will be notified when complete.',
    });

  } catch (error) {
    console.error('Brief submit error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit brief for generation' },
      { status: 500 }
    );
  }
}
