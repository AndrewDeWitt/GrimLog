/**
 * Brief Generator - Core Logic
 *
 * Extracts the core brief generation functionality from the API route
 * so it can be called directly for background processing.
 *
 * Uses AI SDK for Gemini/Vertex AI calls with proper WIF authentication.
 */

import { streamObject, jsonSchema } from 'ai';
import { langfuse } from '@/lib/langfuse';
import { prisma } from '@/lib/prisma';
import { checkAndDeductCredit } from '@/lib/briefCredits';
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
  SUGGESTION_SYSTEM_PROMPT,
  SUGGESTION_RESPONSE_SCHEMA,
  SuggestionResponse,
} from '@/lib/briefSuggestions';
import { generateSpiritIconInternal } from '@/lib/spiritIconGenerator';
import { getProvider, isGeminiProvider } from '@/lib/aiProvider';
import { getGeminiProvider } from '@/lib/vertexAI';

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

// JSON Schema for structured output (same as analyze route)
const BRIEF_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string", description: "2-3 sentence high-level overview of the army's strategic identity and playstyle" },
    armyArchetype: {
      type: "object",
      description: "Classification of the army's playstyle",
      properties: {
        primary: { type: "string", enum: ["horde", "elite", "balanced", "skew", "castle", "alpha_strike", "attrition", "objective_play"] },
        secondary: { type: "string", enum: ["melee_focused", "ranged_focused", "hybrid", "psychic", "vehicle_heavy", "monster_mash", "character_hammer", "transport_rush"] },
        description: { type: "string" }
      },
      required: ["primary", "secondary", "description"]
    },
    statisticalBreakdown: {
      type: "object",
      properties: {
        totalUnits: { type: "integer" },
        totalModels: { type: "integer" },
        totalWounds: { type: "integer" },
        averageToughness: { type: "number" },
        toughnessDistribution: {
          type: "object",
          properties: { t3OrLess: { type: "integer" }, t4to5: { type: "integer" }, t6to8: { type: "integer" }, t9to11: { type: "integer" }, t12Plus: { type: "integer" } },
          required: ["t3OrLess", "t4to5", "t6to8", "t9to11", "t12Plus"]
        },
        damageProfile: {
          type: "object",
          properties: {
            totalRangedDamage: { type: "number" },
            totalMeleeDamage: { type: "number" },
            antiTankCapability: { type: "string", enum: ["none", "minimal", "moderate", "strong", "exceptional"] },
            antiInfantryCapability: { type: "string", enum: ["none", "minimal", "moderate", "strong", "exceptional"] },
            rangedVsMeleeRatio: { type: "string" }
          },
          required: ["totalRangedDamage", "totalMeleeDamage", "antiTankCapability", "antiInfantryCapability", "rangedVsMeleeRatio"]
        },
        mobilityProfile: {
          type: "object",
          properties: {
            averageMovement: { type: "number" },
            hasDeepStrike: { type: "boolean" },
            hasScouts: { type: "boolean" },
            hasInfiltrate: { type: "boolean" },
            hasFly: { type: "boolean" },
            fastUnitsCount: { type: "integer" }
          },
          required: ["averageMovement", "hasDeepStrike", "hasScouts", "hasInfiltrate", "hasFly", "fastUnitsCount"]
        }
      },
      required: ["totalUnits", "totalModels", "totalWounds", "averageToughness", "toughnessDistribution", "damageProfile", "mobilityProfile"]
    },
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
    secondaryRecommendations: {
      type: "object",
      properties: {
        strongSecondaries: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reasoning: { type: "string" }, expectedScore: { type: "string" } }, required: ["name", "reasoning", "expectedScore"] } },
        avoidSecondaries: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reasoning: { type: "string" } }, required: ["name", "reasoning"] } },
        overallScoringPotential: { type: "string", enum: ["poor", "below_average", "average", "above_average", "excellent"] }
      },
      required: ["strongSecondaries", "avoidSecondaries", "overallScoringPotential"]
    },
    collectionRecommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          unitName: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          alternativeOptions: { type: "array", items: { type: "string" } }
        },
        required: ["unitName", "reason", "priority", "alternativeOptions"]
      }
    },
    threatAssessment: {
      type: "object",
      properties: {
        overallThreatLevel: { type: "string", enum: ["low", "moderate", "high", "very_high", "extreme"] },
        peakThreatPhase: { type: "string", enum: ["deployment", "early_game", "mid_game", "late_game"] },
        keyThreats: { type: "array", items: { type: "string" } },
        counterStrategies: { type: "array", items: { type: "string" } }
      },
      required: ["overallThreatLevel", "peakThreatPhase", "keyThreats", "counterStrategies"]
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
    unitTacticalSummaries: { type: "object", additionalProperties: { type: "string" } },
    unitRoleAssignments: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["hammer", "anvil", "scoring", "screening", "support", "skirmisher", "utility", "specialist"] },
          reasoning: { type: "string" }
        },
        required: ["role", "reasoning"]
      }
    }
  },
  required: ["executiveSummary", "armyArchetype", "statisticalBreakdown", "strategicStrengths", "strategicWeaknesses", "matchupConsiderations", "secondaryRecommendations", "collectionRecommendations", "threatAssessment", "viralInsights", "unitTacticalSummaries", "unitRoleAssignments"]
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
  const { parsedArmy, localAnalysis, userId, briefId, trace: externalTrace } = options;

  // Use external trace if provided, otherwise will create one below
  let trace: any = externalTrace || null;
  const ownsTrace = !externalTrace; // Track if we created the trace (so we know to flush it)

  try {
    // Deduct credit
    const creditCheck = await checkAndDeductCredit(userId);
    if (!creditCheck.allowed) {
      await prisma.briefGeneration.update({
        where: { id: briefId },
        data: { status: 'failed', completedAt: new Date(), errorMessage: 'No credits remaining' },
      });
      return { success: false, error: 'No credits remaining' };
    }

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

    // Build prompts
    const systemPrompt = buildBriefSystemPrompt();
    const userPrompt = buildBriefUserPrompt(context, detachmentRulesPrompt, allFactionDatasheets);

    // Call Gemini for strategic analysis
    console.log(`🤖 Starting AI analysis for brief: ${briefId}`);

    // Get the Gemini provider (AI Studio or Vertex AI with WIF)
    const provider = getProvider();
    const geminiProvider = isGeminiProvider(provider) ? (provider as 'google' | 'vertex') : 'google';
    const gemini = getGeminiProvider(geminiProvider);

    const analysisGeneration = trace.generation({
      name: "gemini-brief-analysis",
      model: BRIEF_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      metadata: { provider: geminiProvider, thinkingLevel: 'high', promptLength: userPrompt.length }
    });

    // Increased from 12000 - model generates very detailed analysis that was hitting token limit
    const maxOutputTokens = 32000;

    // Use AI SDK streamObject for streaming structured output
    console.log(`🔄 [Brief] Starting streamObject call to ${BRIEF_MODEL}...`);
    const streamStartTime = Date.now();
    
    const streamResult = streamObject({
      model: gemini(BRIEF_MODEL),
      schema: jsonSchema(BRIEF_RESPONSE_SCHEMA as any),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: maxOutputTokens,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel: 'high' },
        },
      },
    });

    // Log streaming progress by consuming partialObjectStream
    // Wrapped in try-catch to detect silent errors
    let chunkCount = 0;
    let lastLogTime = Date.now();
    let lastPartialObject: any = null;
    
    try {
      for await (const partialObject of streamResult.partialObjectStream) {
        chunkCount++;
        lastPartialObject = partialObject;
        const now = Date.now();
        // Log every 10 seconds to show progress
        if (now - lastLogTime > 10000) {
          const elapsed = Math.round((now - streamStartTime) / 1000);
          console.log(`📡 [Brief] Stream progress: ${chunkCount} chunks, ${elapsed}s elapsed, keys: ${Object.keys(partialObject || {}).join(', ')}`);
          lastLogTime = now;
        }
      }
    } catch (streamError: any) {
      console.error(`❌ [Brief] Stream iteration error after ${chunkCount} chunks:`, streamError.message || streamError);
      console.error(`❌ [Brief] Last partial object keys:`, Object.keys(lastPartialObject || {}));
      throw streamError;
    }
    
    const streamEndTime = Date.now();
    console.log(`✅ [Brief] Stream complete: ${chunkCount} chunks in ${Math.round((streamEndTime - streamStartTime) / 1000)}s`);

    // Get the final object and metadata
    let rawAnalysis: any;
    let usage: any;
    let finishReason: string | undefined;
    
    try {
      console.log(`🔄 [Brief] Awaiting final object...`);
      rawAnalysis = await streamResult.object;
      console.log(`✅ [Brief] Got final object`);
    } catch (objectError: any) {
      console.error(`❌ [Brief] Error getting final object:`, objectError.message || objectError);
      
      // Try to use the last partial object if it has enough data
      // This happens when JSON parsing fails due to control characters
      if (lastPartialObject && Object.keys(lastPartialObject).length > 0) {
        console.log(`⚠️ [Brief] Attempting to use last partial object with keys: ${Object.keys(lastPartialObject).join(', ')}`);
        
        // Check if we have the critical fields
        const hasMinimumFields = lastPartialObject.executiveSummary && 
                                  lastPartialObject.armyArchetype && 
                                  lastPartialObject.strategicStrengths;
        
        if (hasMinimumFields) {
          console.log(`✅ [Brief] Using last partial object as fallback (has minimum required fields)`);
          rawAnalysis = lastPartialObject;
        } else {
          // Try to extract raw text from error and sanitize
          if (objectError.text) {
            console.log(`⚠️ [Brief] Attempting to sanitize raw response text...`);
            try {
              const sanitized = sanitizeJsonString(objectError.text);
              rawAnalysis = JSON.parse(sanitized);
              console.log(`✅ [Brief] Successfully parsed sanitized JSON`);
            } catch (parseError) {
              console.error(`❌ [Brief] Failed to parse sanitized JSON:`, parseError);
              throw objectError;
            }
          } else {
            throw objectError;
          }
        }
      } else {
        throw objectError;
      }
    }
    
    try {
      usage = await streamResult.usage;
      console.log(`✅ [Brief] Got usage`);
      finishReason = await streamResult.finishReason;
      console.log(`✅ [Brief] Got finishReason: ${finishReason}`);
    } catch (metaError: any) {
      console.warn(`⚠️ [Brief] Could not get usage/finishReason:`, metaError.message);
      // Non-fatal - we can continue without these
    }

    // Extract token usage for Langfuse cost tracking
    let mainAnalysisUsage = { input: 0, output: 0, total: 0 };
    if (usage) {
      mainAnalysisUsage = {
        input: usage.inputTokens || 0,
        output: usage.outputTokens || 0,
        total: (usage.inputTokens || 0) + (usage.outputTokens || 0)
      };
      console.log(`📊 Main analysis token usage: ${mainAnalysisUsage.input} input, ${mainAnalysisUsage.output} output, ${mainAnalysisUsage.total} total`);
    }

    analysisGeneration.update({ output: JSON.stringify(rawAnalysis), metadata: { finishReason } });
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
    const strategicAnalysis: BriefStrategicAnalysis = processedAnalysis;
    parseSpan.end({
      metadata: {
        strengthsCount: strategicAnalysis.strategicStrengths?.length || 0,
        weaknessesCount: strategicAnalysis.strategicWeaknesses?.length || 0,
        matchupsCount: strategicAnalysis.matchupConsiderations?.length || 0
      }
    });

    console.log(`✅ AI analysis complete: ${strategicAnalysis.strategicStrengths?.length || 0} strengths`);

    // Generate suggestions
    const suggestionSpan = trace.span({
      name: "generate-list-suggestions",
      metadata: { faction, detachment }
    });
    let listSuggestions: ListSuggestion[] = [];
    try {
      const suggestionPrompt = buildSuggestionPrompt(context, strategicAnalysis, detachmentRulesPrompt, allFactionDatasheets, detachmentContext.enhancements);

      const suggestionGeneration = trace.generation({
        name: "gemini-suggestions",
        model: BRIEF_MODEL,
        input: [
          { role: 'system', content: SUGGESTION_SYSTEM_PROMPT },
          { role: 'user', content: suggestionPrompt }
        ],
        metadata: { provider: geminiProvider, thinkingLevel: 'high', promptLength: suggestionPrompt.length }
      });

      // Use AI SDK streamObject for streaming structured output
      console.log(`🔄 [Suggestions] Starting streamObject call to ${BRIEF_MODEL}...`);
      const suggestionsStartTime = Date.now();
      
      const suggestionsStreamResult = streamObject({
        model: gemini(BRIEF_MODEL),
        schema: jsonSchema(SUGGESTION_RESPONSE_SCHEMA as any),
        system: SUGGESTION_SYSTEM_PROMPT,
        prompt: suggestionPrompt,
        maxOutputTokens: 20000,
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: 'high' },
          },
        },
      });

      // Log streaming progress by consuming partialObjectStream
      let suggestionsChunkCount = 0;
      let suggestionsLastLogTime = Date.now();
      for await (const partialObject of suggestionsStreamResult.partialObjectStream) {
        suggestionsChunkCount++;
        const now = Date.now();
        // Log every 10 seconds to show progress
        if (now - suggestionsLastLogTime > 10000) {
          const elapsed = Math.round((now - suggestionsStartTime) / 1000);
          console.log(`📡 [Suggestions] Stream progress: ${suggestionsChunkCount} chunks, ${elapsed}s elapsed`);
          suggestionsLastLogTime = now;
        }
      }
      
      const suggestionsEndTime = Date.now();
      console.log(`✅ [Suggestions] Stream complete: ${suggestionsChunkCount} chunks in ${Math.round((suggestionsEndTime - suggestionsStartTime) / 1000)}s`);

      // Get the final object and metadata
      const suggestionsData = await suggestionsStreamResult.object;
      const suggestionsUsageData = await suggestionsStreamResult.usage;
      const suggestionsFinishReason = await suggestionsStreamResult.finishReason;

      // Extract token usage for Langfuse cost tracking
      let suggestionsUsage = { input: 0, output: 0, total: 0 };
      if (suggestionsUsageData) {
        suggestionsUsage = {
          input: suggestionsUsageData.inputTokens || 0,
          output: suggestionsUsageData.outputTokens || 0,
          total: (suggestionsUsageData.inputTokens || 0) + (suggestionsUsageData.outputTokens || 0)
        };
        console.log(`📊 Suggestions token usage: ${suggestionsUsage.input} input, ${suggestionsUsage.output} output, ${suggestionsUsage.total} total`);
      }

      suggestionGeneration.update({ output: JSON.stringify(suggestionsData), metadata: { finishReason: suggestionsFinishReason } });
      // End generation with token usage for Langfuse cost calculation
      suggestionGeneration.end({
        usage: suggestionsUsage.total > 0 ? {
          input: suggestionsUsage.input,
          output: suggestionsUsage.output,
          total: suggestionsUsage.total
        } : undefined
      });

      if (suggestionsData) {
        listSuggestions = (suggestionsData as SuggestionResponse).suggestions || [];
        console.log(`✅ Generated ${listSuggestions.length} suggestions`);
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

    console.log(`💾 Brief completed: ${briefId}`);

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
          hasSpiritIcon: !!spiritIconUrl
        },
        tags: ['success']
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
