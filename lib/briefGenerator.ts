/**
 * Brief Generator - Core Logic
 *
 * Extracts the core brief generation functionality from the API route
 * so it can be called directly for background processing.
 *
 * Uses direct @google/genai SDK for Gemini calls to ensure proper
 * system instruction handling and implicit caching support.
 */

import { langfuse } from '@/lib/langfuse';
import { prisma } from '@/lib/prisma';
import {
  BriefAnalysis,
  BriefStrategicAnalysis,
  buildBriefContext,
  buildBriefSystemPrompt,
  buildBriefUserPrompt,
  parseViralInsights,
  ViralInsightsRaw,
  ListSuggestion,
} from '@/lib/briefAnalysis';
import { ParsedArmyList } from '@/lib/types';
import { fetchDetachmentContext, formatDetachmentContextForPrompt } from '@/lib/fetchDetachmentContext';
import {
  fetchFactionDatasheets,
  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  SUGGESTION_RESPONSE_SCHEMA,
  SuggestionResponse,
} from '@/lib/briefSuggestions';
import { buildSharedSystemPrefix, buildBaseSharedPrefix, extendSharedPrefix, getSharedPrefixStats } from '@/lib/briefSharedContext';
import { loadKnownDetachments } from '@/lib/armyListParser';
import { generateSpiritIconInternal } from '@/lib/spiritIconGenerator';
import { getProvider, isGeminiProvider } from '@/lib/aiProvider';
import { streamContent, formatCacheLog, type GeminiTokenUsage } from '@/lib/geminiDirect';

// Use Flash for speed - Pro is too slow and causes timeouts
const BRIEF_MODEL = 'gemini-3-flash-preview';

/**
 * Sanitize JSON string by removing/replacing control characters that break JSON parsing.
 * Gemini sometimes includes invalid control characters like \x13 (device control) in responses.
 */
function sanitizeJsonString(text: string): string {
  return text
    // Replace specific control chars that appear in game text (e.g., em-dash alternatives)
    .replace(/[\x13\x14\x15\x16\x17]/g, '–')
    // Remove other non-printable control chars (except \n, \r, \t which are valid in JSON)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    // Clean up multiple spaces
    .replace(/  +/g, ' ');
}

// JSON Schema for structured output - optimized to only include sections displayed in UI
// Removed: executiveSummary, armyArchetype, statisticalBreakdown, secondaryRecommendations, collectionRecommendations, threatAssessment
const BRIEF_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    strategicStrengths: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" }, relevantUnits: { type: "array", items: { type: "string" } } },
        required: ["title", "description", "relevantUnits"]
      }
    },
    strategicWeaknesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["minor", "moderate", "major", "critical"] },
          counterplayRisk: { type: "string" },
          specificCounterArmies: { type: "array", items: { type: "string" } },
          mitigationStrategy: { type: "string" }
        },
        required: ["title", "description", "severity", "counterplayRisk", "specificCounterArmies", "mitigationStrategy"]
      }
    },
    matchupConsiderations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          opponentArchetype: { type: "string", enum: ["horde_armies", "elite_armies", "vehicle_spam", "monster_mash", "skirmish_msu", "melee_rush", "gunline", "attrition"] },
          matchupRating: { type: "string", enum: ["very_unfavorable", "unfavorable", "even", "favorable", "very_favorable"] },
          winCondition: { type: "string", enum: ["outscore", "tabling", "attrition", "alpha_strike", "denial"] },
          battlePlan: { type: "string" },
          reasoning: { type: "string" },
          keyTips: { type: "array", items: { type: "string" } }
        },
        required: ["opponentArchetype", "matchupRating", "winCondition", "battlePlan", "reasoning", "keyTips"]
      }
    },
    viralInsights: {
      type: "object",
      properties: {
        tagline: { type: "string" },
        spiritDescription: { type: "string" },
        funStat1Name: { type: "string" },
        funStat1Emoji: { type: "string" },
        funStat1Value: { type: "string" },
        funStat1Desc: { type: "string" },
        funStat1IconPrompt: { type: "string" },
        funStat2Name: { type: "string" },
        funStat2Emoji: { type: "string" },
        funStat2Value: { type: "string" },
        funStat2Desc: { type: "string" },
        funStat2IconPrompt: { type: "string" },
        funStat3Name: { type: "string" },
        funStat3Emoji: { type: "string" },
        funStat3Value: { type: "string" },
        funStat3Desc: { type: "string" },
        funStat3IconPrompt: { type: "string" },
        funStat4Name: { type: "string" },
        funStat4Emoji: { type: "string" },
        funStat4Value: { type: "string" },
        funStat4Desc: { type: "string" },
        funStat4IconPrompt: { type: "string" },
        armySpiritIconPrompt: { type: "string" }
      },
      required: ["tagline", "spiritDescription", "funStat1Name", "funStat1Emoji", "funStat1Value", "funStat1Desc", "funStat1IconPrompt", "funStat2Name", "funStat2Emoji", "funStat2Value", "funStat2Desc", "funStat2IconPrompt", "funStat3Name", "funStat3Emoji", "funStat3Value", "funStat3Desc", "funStat3IconPrompt", "funStat4Name", "funStat4Emoji", "funStat4Value", "funStat4Desc", "funStat4IconPrompt", "armySpiritIconPrompt"]
    },
    unitTacticalSummaries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          unitName: { type: "string" },
          summary: { type: "string" }
        },
        required: ["unitName", "summary"]
      }
    },
    unitRoleAssignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          unitName: { type: "string" },
          role: { type: "string", enum: ["hammer", "anvil", "scoring", "screening", "support", "skirmisher", "utility", "specialist"] },
          reasoning: { type: "string" }
        },
        required: ["unitName", "role", "reasoning"]
      }
    }
  },
  required: ["strategicStrengths", "strategicWeaknesses", "matchupConsiderations", "viralInsights", "unitTacticalSummaries", "unitRoleAssignments"]
};

// Enrich parsed army with real database values
async function enrichParsedArmyFromDatabase(parsedArmy: ParsedArmyList, factionId?: string, detachmentId?: string): Promise<ParsedArmyList> {
  const datasheetNames = [...new Set(parsedArmy.units.map(u => u.parsedDatasheet?.name || u.name))];

  const dbDatasheets = await prisma.datasheet.findMany({
    where: {
      OR: datasheetNames.map(name => ({
        name: { equals: name, mode: 'insensitive' as const }
      }))
    },
    select: {
      id: true, name: true, leaderRules: true, leaderAbilities: true, faction: true, subfaction: true,
      competitiveTier: true, tierReasoning: true, bestTargets: true, counters: true, synergies: true,
      playstyleNotes: true, deploymentTips: true, competitiveNotes: true,
    },
  });

  const datasheetIds = dbDatasheets.map(ds => ds.id);
  let competitiveContexts: Array<any> = [];

  try {
    const whereClause: any = { datasheetId: { in: datasheetIds } };
    const scopeConditions: any[] = [];
    if (factionId && detachmentId) scopeConditions.push({ factionId, detachmentId });
    if (factionId) scopeConditions.push({ factionId, detachmentId: null });
    scopeConditions.push({ factionId: null, detachmentId: null });

    const contexts = await (prisma as any).datasheetCompetitiveContext?.findMany({
      where: { ...whereClause, OR: scopeConditions },
      select: {
        datasheetId: true, competitiveTier: true, tierReasoning: true, bestTargets: true,
        counters: true, synergies: true, playstyleNotes: true, deploymentTips: true,
        competitiveNotes: true, factionId: true, detachmentId: true,
      },
      orderBy: [{ factionId: { sort: 'asc', nulls: 'last' } }, { detachmentId: { sort: 'asc', nulls: 'last' } }],
    });

    if (contexts) {
      const contextMap = new Map<string, typeof contexts[0]>();
      for (const ctx of contexts) {
        const existing = contextMap.get(ctx.datasheetId);
        if (!existing || (ctx.factionId && !existing.factionId) || (ctx.detachmentId && !existing.detachmentId)) {
          contextMap.set(ctx.datasheetId, ctx);
        }
      }
      competitiveContexts = Array.from(contextMap.values());
    }
  } catch (error) {
    console.log('DatasheetCompetitiveContext table not available');
  }

  let unitContextsMap = new Map<string, any>();
  try {
    const unitContexts = await prisma.unitCompetitiveContext.findMany({
      where: { datasheetId: { in: datasheetIds }, isStale: false },
      select: { datasheetId: true, avoidTargets: true, phasePriority: true, pointsEfficiency: true, confidence: true },
      orderBy: { confidence: 'desc' },
    });
    for (const ctx of unitContexts) {
      if (ctx.datasheetId && !unitContextsMap.has(ctx.datasheetId)) {
        unitContextsMap.set(ctx.datasheetId, ctx);
      }
    }
  } catch (error) {
    console.log('UnitCompetitiveContext table not available');
  }

  const datasheetMap = new Map(dbDatasheets.map(ds => [ds.name.toLowerCase(), ds]));
  const contextMap = new Map(competitiveContexts.map((ctx: any) => [ctx.datasheetId, ctx]));

  const enrichedUnits = parsedArmy.units.map(unit => {
    const dbDatasheet = datasheetMap.get((unit.parsedDatasheet?.name || unit.name).toLowerCase());

    if (dbDatasheet && unit.parsedDatasheet) {
      const baseContext = contextMap.get(dbDatasheet.id) || {
        competitiveTier: dbDatasheet.competitiveTier,
        tierReasoning: dbDatasheet.tierReasoning,
        bestTargets: dbDatasheet.bestTargets,
        counters: dbDatasheet.counters,
        synergies: dbDatasheet.synergies,
        playstyleNotes: dbDatasheet.playstyleNotes,
        deploymentTips: dbDatasheet.deploymentTips,
        competitiveNotes: dbDatasheet.competitiveNotes,
      };

      const unitCtx = unitContextsMap.get(dbDatasheet.id);
      const competitiveContext = {
        ...baseContext,
        avoidTargets: unitCtx?.avoidTargets || null,
        phasePriority: unitCtx?.phasePriority || null,
        pointsEfficiency: unitCtx?.pointsEfficiency || null,
      };

      return {
        ...unit,
        parsedDatasheet: {
          ...unit.parsedDatasheet,
          datasheetId: dbDatasheet.id,
          leaderRules: dbDatasheet.leaderRules,
          leaderAbilities: dbDatasheet.leaderAbilities,
          competitiveContext: competitiveContext.competitiveTier || competitiveContext.tierReasoning || competitiveContext.synergies
            ? competitiveContext : undefined,
        },
      };
    }

    return unit;
  });

  return { ...parsedArmy, units: enrichedUnits };
}

// Extract JSON block helper
function extractFirstJsonBlock(text: string): { jsonText: string | null; truncated: boolean } {
  const start = text.search(/[\[{]/);
  if (start === -1) return { jsonText: null, truncated: false };

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = false; }
      continue;
    }

    if (c === '"') { inString = true; continue; }
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      const expected = stack.pop();
      if (expected !== c) return { jsonText: null, truncated: false };
      if (stack.length === 0) return { jsonText: text.slice(start, i + 1), truncated: false };
    }
  }

  return { jsonText: text.slice(start), truncated: true };
}

export interface GenerateBriefOptions {
  parsedArmy: ParsedArmyList;
  localAnalysis: BriefAnalysis;
  userId: string;
  briefId: string; // Required for background processing
  trace?: any; // Optional Langfuse trace (if provided, will be used instead of creating a new one)
  baseSharedPrefix?: string; // Pre-built base prefix (datasheets + known detachments) for cache optimization
}

export interface GenerateBriefResult {
  success: boolean;
  briefId?: string;
  strategicAnalysis?: BriefStrategicAnalysis;
  listSuggestions?: ListSuggestion[];
  spiritIconUrl?: string | null;
  error?: string;
}

/**
 * Generate a tactical brief from a parsed army list.
 * This is the main entry point for direct function calls (no HTTP).
 * Updates the brief record in the database with the results.
 */
export async function generateBrief(options: GenerateBriefOptions): Promise<GenerateBriefResult> {
  const { parsedArmy, localAnalysis, userId, briefId, trace: externalTrace, baseSharedPrefix } = options;

  // Use external trace if provided, otherwise will create one below
  let trace: any = externalTrace || null;
  const ownsTrace = !externalTrace; // Track if we created the trace (so we know to flush it)

  try {
    // Note: Token deduction is now handled by the API route (checkAndDeductTokens)
    // before calling this function. This ensures atomic deduction with proper
    // refund on failure.

    // Update status to processing
    await prisma.briefGeneration.update({
      where: { id: briefId },
      data: { status: 'processing' },
    });

    console.log(`🔄 Starting brief generation for: ${briefId}`);

    const faction = parsedArmy.detectedFaction || 'Unknown';
    const detachment = parsedArmy.detectedDetachment || 'Unknown';

    // Create Langfuse trace if not provided externally
    if (!trace) {
      trace = langfuse.trace({
        name: "brief-strategic-analysis-background",
        metadata: { faction, detachment, totalPoints: localAnalysis.totalPoints, briefId, unitCount: localAnalysis.unitCount },
        tags: ['brief-analysis', 'background-processing', `faction-${faction.toLowerCase().replace(/\s+/g, '-')}`]
      });
    } else {
      // Update external trace with brief metadata
      trace.update({
        metadata: { faction, detachment, totalPoints: localAnalysis.totalPoints, briefId, unitCount: localAnalysis.unitCount },
      });
    }

    // Get faction and detachment IDs for enrichment
    const dbLookupSpan = trace.span({
      name: "db-lookup-faction-detachment",
      metadata: { faction, detachment }
    });
    const dbFaction = await prisma.faction.findFirst({
      where: { name: { equals: faction, mode: 'insensitive' } },
      select: { id: true },
    });
    const dbDetachment = await prisma.detachment.findFirst({
      where: { name: { equals: detachment, mode: 'insensitive' }, faction: { equals: faction, mode: 'insensitive' } },
      select: { id: true },
    });
    dbLookupSpan.end({ metadata: { factionFound: !!dbFaction, detachmentFound: !!dbDetachment } });

    // Enrich parsed army with database values
    const enrichmentSpan = trace.span({
      name: "enrich-army-from-database",
      metadata: { unitCount: parsedArmy.units.length, factionId: dbFaction?.id }
    });
    const enrichedArmy = await enrichParsedArmyFromDatabase(parsedArmy, dbFaction?.id, dbDetachment?.id);
    const context = buildBriefContext(enrichedArmy, localAnalysis);
    enrichmentSpan.end({
      metadata: {
        enrichedUnitCount: enrichedArmy.units.length,
        unitsWithCompetitiveContext: enrichedArmy.units.filter(u => u.parsedDatasheet?.competitiveContext).length
      }
    });

    // Fetch faction competitive context
    const factionContextSpan = trace.span({
      name: "fetch-faction-competitive-context",
      metadata: { faction }
    });
    let factionCompetitiveContext = null;
    try {
      const factionCtx = await prisma.factionCompetitiveContext.findFirst({
        where: { factionName: faction, isStale: false },
        select: {
          metaTier: true, metaPosition: true, playstyleArchetype: true, strengths: true, weaknesses: true,
          favorableMatchups: true, unfavorableMatchups: true, recommendedDetachments: true,
          mustTakeUnits: true, avoidUnits: true, sleepHitUnits: true, confidence: true,
        },
        orderBy: { confidence: 'desc' },
      });
      if (factionCtx) {
        factionCompetitiveContext = factionCtx;
        (context as any).factionContext = factionCtx;
        console.log(`📊 Faction competitive context found for ${faction}`);
      }
    } catch (error) {
      console.log('FactionCompetitiveContext not available');
    }
    factionContextSpan.end({
      metadata: { found: !!factionCompetitiveContext, metaTier: factionCompetitiveContext?.metaTier || null }
    });

    // Fetch detachment context
    const detachmentFetchSpan = trace.span({
      name: "fetch-detachment-context",
      metadata: { faction, detachment }
    });
    const detachmentContext = await fetchDetachmentContext(faction, detachment);
    const detachmentRulesPrompt = formatDetachmentContextForPrompt(detachmentContext);
    detachmentFetchSpan.end({
      metadata: {
        found: !!detachmentContext.detachment,
        strategemsCount: detachmentContext.stratagems.length,
        enhancementsCount: detachmentContext.enhancements.length
      }
    });
    console.log(`📋 Detachment context: ${detachmentContext.stratagems.length} stratagems, ${detachmentContext.enhancements.length} enhancements`);

    // Fetch faction datasheets
    const datasheetsFetchSpan = trace.span({
      name: "fetch-faction-datasheets",
      metadata: { faction }
    });
    const allFactionDatasheets = await fetchFactionDatasheets(faction, null);
    datasheetsFetchSpan.end({ metadata: { datasheetCount: allFactionDatasheets.length } });
    console.log(`📋 Fetched ${allFactionDatasheets.length} faction datasheets`);

    // ========== BUILD SHARED SYSTEM PREFIX FOR CACHE OPTIMIZATION ==========
    // This prefix is IDENTICAL across parser, analysis, and suggestions calls to enable Gemini implicit caching
    const sharedPrefixSpan = trace.span({
      name: "build-shared-system-prefix",
      metadata: { faction, detachment, usingBasePrefix: !!baseSharedPrefix }
    });
    
    let sharedSystemPrefix: string;
    
    if (baseSharedPrefix) {
      // Extend the pre-built base prefix (from parser) with faction rules and detachment context
      // This ensures the datasheets section is IDENTICAL for cache hits
      sharedSystemPrefix = extendSharedPrefix(
        baseSharedPrefix,
        detachmentContext.factionRules,
        detachmentContext
      );
      console.log(`📋 Extended base shared prefix with detachment context`);
    } else {
      // Fallback: Build full prefix from scratch (backwards compatibility)
      const knownDetachments = await loadKnownDetachments();
      sharedSystemPrefix = buildSharedSystemPrefix(
        allFactionDatasheets,
        knownDetachments,
        detachmentContext.factionRules,
        detachmentContext
      );
      console.log(`📋 Built shared system prefix from scratch (no base prefix provided)`);
    }
    
    const prefixStats = getSharedPrefixStats(sharedSystemPrefix);
    sharedPrefixSpan.end({
      metadata: {
        prefixCharCount: prefixStats.charCount,
        estimatedTokens: prefixStats.estimatedTokens,
        datasheetCount: allFactionDatasheets.length,
        usedBasePrefix: !!baseSharedPrefix
      }
    });
    console.log(`📋 Shared system prefix: ${prefixStats.charCount} chars (~${prefixStats.estimatedTokens} tokens), ${allFactionDatasheets.length} datasheets`);

    // Build prompts with shared prefix for cache optimization
    // The shared prefix contains: datasheets, known detachments, faction rules, detachment context
    // User prompts skip these sections since they're in the system prompt
    const systemPrompt = buildBriefSystemPrompt(sharedSystemPrefix);
    const userPrompt = buildBriefUserPrompt(context, detachmentRulesPrompt, allFactionDatasheets, true); // usingSharedPrefix=true

    // Call Gemini for strategic analysis
    console.log(`🤖 Starting AI analysis for brief: ${briefId}`);

    // Get provider for logging
    const provider = getProvider();
    const geminiProvider = isGeminiProvider(provider) ? (provider as 'google' | 'vertex') : 'google';

    const analysisGeneration = trace.generation({
      name: "gemini-brief-analysis",
      model: BRIEF_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      metadata: {
        provider: geminiProvider,
        thinkingBudget: 1024,
        promptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
        sharedPrefixChars: prefixStats.charCount,
        sharedPrefixEstimatedTokens: prefixStats.estimatedTokens,
        usingSharedPrefix: true
      }
    });

    // Reduced from 32000 - removed 6 unused sections, actual output is ~4-6K tokens
    const maxOutputTokens = 12000;

    // Use direct @google/genai SDK for streaming structured output
    console.log(`🔄 [Brief] Starting streamContent call to ${BRIEF_MODEL}...`);
    const streamStartTime = Date.now();
    let chunkCount = 0;
    let lastLogTime = Date.now();
    
    const analysisResult = await streamContent({
      model: BRIEF_MODEL,
      systemInstruction: systemPrompt,
      contents: userPrompt,
      responseSchema: BRIEF_RESPONSE_SCHEMA,
      maxOutputTokens: maxOutputTokens,
      thinkingBudget: 1024, // Low thinking for speed
      onProgress: (count, elapsedMs) => {
        chunkCount = count;
        const now = Date.now();
        if (now - lastLogTime > 10000) {
          console.log(`📡 [Brief] Stream progress: ${count} chunks, ${Math.round(elapsedMs / 1000)}s elapsed`);
          lastLogTime = now;
        }
      },
    });
    
    const streamEndTime = Date.now();
    console.log(`✅ [Brief] Stream complete: ${chunkCount} chunks in ${Math.round((streamEndTime - streamStartTime) / 1000)}s`);

    const rawAnalysis = analysisResult.object;
    const analysisUsage = analysisResult.usage;
    const finishReason = analysisResult.finishReason;

    // Log token usage with cache info
    console.log(`📊 Main analysis token usage: ${analysisUsage.inputTokens} input, ${analysisUsage.outputTokens} output, ${analysisUsage.totalTokens} total`);
    console.log(formatCacheLog(analysisUsage));

    // Track for summary (keeping backwards compatible structure + full usage for cache stats)
    const mainAnalysisUsage = {
      input: analysisUsage.inputTokens,
      output: analysisUsage.outputTokens,
      total: analysisUsage.totalTokens,
      cached: analysisUsage.cacheReadInputTokens
    };
    const mainCacheStats = {
      cacheReadTokens: analysisUsage.cacheReadInputTokens,
      cacheWriteTokens: analysisUsage.cacheCreationInputTokens,
      cacheHitRate: analysisUsage.cacheHitRate
    };

    analysisGeneration.update({
      output: JSON.stringify(rawAnalysis),
      metadata: {
        finishReason,
        cachedTokens: analysisUsage.cacheReadInputTokens,
        cacheWriteTokens: analysisUsage.cacheCreationInputTokens,
        cacheHitRate: analysisUsage.cacheHitRate
      }
    });
    // End generation with token usage for Langfuse cost calculation
    analysisGeneration.end({
      usage: mainAnalysisUsage.total > 0 ? {
        input: mainAnalysisUsage.input,
        output: mainAnalysisUsage.output,
        total: mainAnalysisUsage.total
      } : undefined
    });

    if (!rawAnalysis) {
      throw new Error('Empty response from AI');
    }

    // Process the parsed response
    const parseSpan = trace.span({
      name: "parse-ai-response",
      metadata: { finishReason }
    });

    // Parse viral insights if present
    const processedAnalysis = { ...rawAnalysis } as any;
    if (processedAnalysis.viralInsights) {
      processedAnalysis.viralInsights = parseViralInsights(processedAnalysis.viralInsights as ViralInsightsRaw);
    }

    // Transform unitTacticalSummaries from array to Record (Gemini doesn't support additionalProperties)
    if (Array.isArray(processedAnalysis.unitTacticalSummaries)) {
      const summariesRecord: Record<string, string> = {};
      for (const item of processedAnalysis.unitTacticalSummaries) {
        if (item.unitName && item.summary) {
          summariesRecord[item.unitName] = item.summary;
        }
      }
      processedAnalysis.unitTacticalSummaries = summariesRecord;
    }

    // Transform unitRoleAssignments from array to Record (Gemini doesn't support additionalProperties)
    if (Array.isArray(processedAnalysis.unitRoleAssignments)) {
      const rolesRecord: Record<string, { role: string; reasoning: string }> = {};
      for (const item of processedAnalysis.unitRoleAssignments) {
        if (item.unitName && item.role) {
          rolesRecord[item.unitName] = { role: item.role, reasoning: item.reasoning || '' };
        }
      }
      processedAnalysis.unitRoleAssignments = rolesRecord;
    }

    const strategicAnalysis: BriefStrategicAnalysis = processedAnalysis;
    parseSpan.end({
      metadata: {
        strengthsCount: strategicAnalysis.strategicStrengths?.length || 0,
        weaknessesCount: strategicAnalysis.strategicWeaknesses?.length || 0,
        matchupsCount: strategicAnalysis.matchupConsiderations?.length || 0
      }
    });

    console.log(`✅ AI analysis complete: ${strategicAnalysis.strategicStrengths?.length || 0} strengths`);

    // Generate suggestions (using shared prefix for cache optimization)
    const suggestionSpan = trace.span({
      name: "generate-list-suggestions",
      metadata: { faction, detachment, usingSharedPrefix: true }
    });
    let listSuggestions: ListSuggestion[] = [];
    let suggestionsUsage = { input: 0, output: 0, total: 0, cached: 0 };
    let suggestionsCacheStats = { cacheReadTokens: 0, cacheWriteTokens: 0, cacheHitRate: 0 };
    try {
      // Build suggestion prompts with shared prefix for cache optimization
      const suggestionSystemPrompt = buildSuggestionSystemPrompt(sharedSystemPrefix);
      
      // Debug: verify suggestion prompt starts with same prefix as analysis
      const prefixMatch = suggestionSystemPrompt.startsWith(sharedSystemPrefix);
      console.log(`📋 [Suggestions] Prefix match with analysis: ${prefixMatch}`);
      console.log(`📋 [Suggestions] System prompt length: ${suggestionSystemPrompt.length}, shared prefix length: ${sharedSystemPrefix.length}`);
      
      const suggestionPrompt = buildSuggestionPrompt(
        context,
        strategicAnalysis,
        detachmentRulesPrompt,
        allFactionDatasheets,
        detachmentContext.enhancements,
        true // usingSharedPrefix=true - skip datasheets in user prompt
      );

      const suggestionGeneration = trace.generation({
        name: "gemini-suggestions",
        model: BRIEF_MODEL,
        input: [
          { role: 'system', content: suggestionSystemPrompt },
          { role: 'user', content: suggestionPrompt }
        ],
        metadata: {
          provider: geminiProvider,
          thinkingBudget: 1024,
          promptLength: suggestionPrompt.length,
          systemPromptLength: suggestionSystemPrompt.length,
          usingSharedPrefix: true
        }
      });

      // Use direct @google/genai SDK for streaming structured output
      console.log(`🔄 [Suggestions] Starting streamContent call to ${BRIEF_MODEL}...`);
      const suggestionsStartTime = Date.now();
      let suggestionsChunkCount = 0;
      let suggestionsLastLogTime = Date.now();
      
      const suggestionsResult = await streamContent({
        model: BRIEF_MODEL,
        systemInstruction: suggestionSystemPrompt,
        contents: suggestionPrompt,
        responseSchema: SUGGESTION_RESPONSE_SCHEMA,
        maxOutputTokens: 12000,
        thinkingBudget: 1024, // Low thinking for speed
        onProgress: (count, elapsedMs) => {
          suggestionsChunkCount = count;
          const now = Date.now();
          if (now - suggestionsLastLogTime > 10000) {
            console.log(`📡 [Suggestions] Stream progress: ${count} chunks, ${Math.round(elapsedMs / 1000)}s elapsed`);
            suggestionsLastLogTime = now;
          }
        },
      });
      
      const suggestionsEndTime = Date.now();
      console.log(`✅ [Suggestions] Stream complete: ${suggestionsChunkCount} chunks in ${Math.round((suggestionsEndTime - suggestionsStartTime) / 1000)}s`);

      const suggestionsData = suggestionsResult.object as SuggestionResponse;
      const suggestionsUsageData = suggestionsResult.usage;
      const suggestionsFinishReason = suggestionsResult.finishReason;

      // Log token usage with cache info
      console.log(`📊 Suggestions token usage: ${suggestionsUsageData.inputTokens} input, ${suggestionsUsageData.outputTokens} output, ${suggestionsUsageData.totalTokens} total`);
      console.log(formatCacheLog(suggestionsUsageData));

      suggestionsUsage = {
        input: suggestionsUsageData.inputTokens,
        output: suggestionsUsageData.outputTokens,
        total: suggestionsUsageData.totalTokens,
        cached: suggestionsUsageData.cacheReadInputTokens
      };
      suggestionsCacheStats = {
        cacheReadTokens: suggestionsUsageData.cacheReadInputTokens,
        cacheWriteTokens: suggestionsUsageData.cacheCreationInputTokens,
        cacheHitRate: suggestionsUsageData.cacheHitRate
      };
      
      suggestionGeneration.update({
        output: JSON.stringify(suggestionsData),
        metadata: {
          finishReason: suggestionsFinishReason,
          cachedTokens: suggestionsUsageData.cacheReadInputTokens,
          cacheWriteTokens: suggestionsUsageData.cacheCreationInputTokens,
          cacheHitRate: suggestionsUsageData.cacheHitRate,
          chunksReceived: suggestionsChunkCount
        }
      });
      // End generation with token usage for Langfuse cost calculation
      suggestionGeneration.end({
        usage: suggestionsUsage.total > 0 ? {
          input: suggestionsUsage.input,
          output: suggestionsUsage.output,
          total: suggestionsUsage.total
        } : undefined
      });

      // Extract suggestions from data
      if (suggestionsData && Array.isArray(suggestionsData.suggestions)) {
        // Filter out any malformed suggestions (must have at minimum a title and reasoning)
        listSuggestions = suggestionsData.suggestions.filter(s => s && s.title && s.reasoning);
        console.log(`✅ Generated ${listSuggestions.length} suggestions`);
      } else {
        console.warn(`⚠️ [Suggestions] Data received but suggestions array is invalid`);
      }
      suggestionSpan.end({ metadata: { suggestionsCount: listSuggestions.length } });
    } catch (suggestionError: any) {
      suggestionSpan.end({ level: "WARNING", statusMessage: suggestionError.message });
      console.error('⚠️ Failed to generate suggestions:', suggestionError.message);
    }

    // Generate spirit icon (skip if disabled via environment variable to save costs during testing)
    let spiritIconUrl: string | null = null;
    const skipIconGeneration = process.env.DISABLE_SPIRIT_ICON === 'true';
    const viralInsights = strategicAnalysis.viralInsights;
    if (!skipIconGeneration && viralInsights?.armySpiritIconPrompt && viralInsights?.tagline) {
      try {
        const iconResult = await generateSpiritIconInternal(
          viralInsights.armySpiritIconPrompt,
          viralInsights.tagline,
          faction,
          trace
        );
        if (iconResult.success && iconResult.iconUrl) {
          spiritIconUrl = iconResult.iconUrl;
          console.log(`✅ Spirit icon generated`);
        }
      } catch (iconError: any) {
        console.error('⚠️ Spirit icon generation error:', iconError.message);
      }
    } else if (skipIconGeneration) {
      console.log('⏭️ Spirit icon generation skipped (DISABLE_SPIRIT_ICON=true)');
    }

    // Save to database
    const saveSpan = trace.span({
      name: "save-brief-to-database",
      metadata: { briefId, hasSpiritIcon: !!spiritIconUrl, suggestionsCount: listSuggestions.length }
    });
    await prisma.briefGeneration.update({
      where: { id: briefId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        faction,
        detachment: detachment !== 'Unknown' ? detachment : null,
        totalPoints: localAnalysis.totalPoints,
        unitCount: localAnalysis.unitCount,
        modelCount: localAnalysis.modelCount,
        spiritIconUrl,
        localAnalysis: localAnalysis as any,
        strategicAnalysis: strategicAnalysis as any,
        listSuggestions: listSuggestions.length > 0 ? (listSuggestions as any) : undefined,
        currentVersion: 1,
      },
    });

    // Create initial v1 version snapshot
    const v1SnapshotData = JSON.stringify({
      strategicAnalysis,
      listSuggestions: listSuggestions.length > 0 ? listSuggestions : [],
    });
    await prisma.briefVersion.create({
      data: {
        briefId,
        versionNumber: 1,
        versionLabel: 'AI Generated',
        snapshotData: v1SnapshotData,
        changelog: 'Original AI-generated brief',
        createdById: userId,
      },
    });
    saveSpan.end({ metadata: { savedBriefId: briefId, initialVersionCreated: true } });

    // Log cache efficiency summary
    const totalCachedTokens = mainAnalysisUsage.cached + suggestionsUsage.cached;
    const totalInputTokens = mainAnalysisUsage.input + suggestionsUsage.input;
    const overallCacheRate = totalInputTokens > 0
      ? Math.round((totalCachedTokens / totalInputTokens) * 100)
      : 0;
    console.log(`💾 Brief completed: ${briefId}`);
    console.log(`📊 Cache summary: ${totalCachedTokens}/${totalInputTokens} tokens cached (${overallCacheRate}% hit rate)`);

    // Flush Langfuse
    if (trace) {
      trace.update({
        output: {
          briefId,
          success: true,
          strengthsCount: strategicAnalysis.strategicStrengths?.length || 0,
          weaknessesCount: strategicAnalysis.strategicWeaknesses?.length || 0,
          matchupsCount: strategicAnalysis.matchupConsiderations?.length || 0,
          suggestionsCount: listSuggestions.length,
          hasSpiritIcon: !!spiritIconUrl,
          // Cache optimization stats (enhanced with detailed breakdown)
          cacheStats: {
            sharedPrefixChars: prefixStats.charCount,
            sharedPrefixEstimatedTokens: prefixStats.estimatedTokens,
            // Main analysis cache stats
            analysisCachedTokens: mainAnalysisUsage.cached,
            analysisCacheReadTokens: mainCacheStats.cacheReadTokens,
            analysisCacheWriteTokens: mainCacheStats.cacheWriteTokens,
            analysisCacheHitRate: mainCacheStats.cacheHitRate,
            // Suggestions cache stats
            suggestionsCachedTokens: suggestionsUsage.cached,
            suggestionsCacheReadTokens: suggestionsCacheStats.cacheReadTokens,
            suggestionsCacheWriteTokens: suggestionsCacheStats.cacheWriteTokens,
            suggestionsCacheHitRate: suggestionsCacheStats.cacheHitRate,
            // Overall totals
            totalCachedTokens,
            totalInputTokens,
            overallCacheHitRate: overallCacheRate
          }
        },
        tags: ['success', overallCacheRate > 50 ? 'cache-hit' : 'cache-miss']
      });
      // Only flush if we created the trace (not passed from parent)
      if (ownsTrace) {
        langfuse.flushAsync().catch(() => {});
      }
    }

    return {
      success: true,
      briefId,
      strategicAnalysis,
      listSuggestions,
      spiritIconUrl,
    };

  } catch (error: any) {
    console.error(`❌ Brief generation error for ${briefId}:`, error);

    // Mark as failed
    await prisma.briefGeneration.update({
      where: { id: briefId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message || 'Unknown error',
      },
    });

    if (trace) {
      trace.update({ level: "ERROR", metadata: { error: error.message } });
      // Only flush if we created the trace (not passed from parent)
      if (ownsTrace) {
        langfuse.flushAsync().catch(() => {});
      }
    }

    return {
      success: false,
      briefId,
      error: error.message || 'Unknown error',
    };
  }
}
