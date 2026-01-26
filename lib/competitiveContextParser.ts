/**
 * Competitive Context Parser
 *
 * Uses LLM (Gemini) to extract structured competitive insights
 * from YouTube transcripts about Warhammer 40K units and factions.
 */

import { langfuse } from '@/lib/langfuse';
import { getProvider, isGeminiProvider } from '@/lib/aiProvider';
import { getGeminiClient } from '@/lib/vertexAI';

// Model to use for context parsing
const PARSER_MODEL = 'gemini-3-flash-preview';

// ============================================
// TYPES
// ============================================

export type TierRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type TierContext = 'competitive' | 'casual' | 'narrative' | 'general';
export type PointsEfficiency = 'overcosted' | 'efficient' | 'undercosted' | 'meta-dependent';
export type MetaTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type PlaystyleArchetype = 
  | 'aggressive_melee' 
  | 'gunline' 
  | 'balanced' 
  | 'elite' 
  | 'horde' 
  | 'alpha_strike'
  | 'attrition'
  | 'mobile_skirmish'
  | 'castle'
  | 'trade_focused';

export interface ExtractedUnitContext {
  unitName: string;
  faction: string;
  subfaction?: string;
  tierRank?: TierRank;
  tierReasoning?: string;
  tierContext?: TierContext;
  bestTargets?: string[];
  counters?: string[];
  avoidTargets?: string[];
  synergies?: string[];
  synergyNotes?: string;
  playstyleNotes?: string;
  deploymentTips?: string;
  pointsEfficiency?: PointsEfficiency;
  pointsNotes?: string;
  timestamp?: string; // When in video this was discussed
  confidence: number; // 0-100
  clarifyingQuestions?: ClarifyingQuestion[];
}

export interface ExtractedFactionContext {
  factionName: string;
  subfaction?: string;
  metaTier?: MetaTier;
  metaTierReasoning?: string;
  metaPosition?: string;
  playstyleArchetype?: PlaystyleArchetype;
  playstyleNotes?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendedDetachments?: Array<{ name: string; reasoning: string }>;
  detachmentNotes?: string;
  favorableMatchups?: string[];
  unfavorableMatchups?: string[];
  matchupNotes?: string;
  mustTakeUnits?: string[];
  avoidUnits?: string[];
  sleeperHitUnits?: string[];
  confidence: number;
  clarifyingQuestions?: ClarifyingQuestion[];
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  context: string;
  possibleAnswers?: string[];
  answered: boolean;
  answer?: string;
}

export interface ParseResult {
  success: boolean;
  unitContexts: ExtractedUnitContext[];
  factionContexts: ExtractedFactionContext[];
  overallConfidence: number;
  clarifyingQuestions: ClarifyingQuestion[];
  parsingNotes: string[];
  error?: string;
}

// ============================================
// JSON SCHEMA FOR STRUCTURED OUTPUT
// ============================================

const COMPETITIVE_CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    unitContexts: {
      type: "array",
      description: "Competitive insights about specific units discussed in the transcript",
      items: {
        type: "object",
        properties: {
          unitName: { 
            type: "string", 
            description: "Official name of the unit (e.g., 'Thunderwolf Cavalry', 'Intercessors')" 
          },
          faction: { 
            type: "string", 
            description: "Main faction (e.g., 'Space Marines', 'Space Wolves', 'Tyranids')" 
          },
          subfaction: { 
            type: "string", 
            description: "Subfaction if applicable (e.g., 'Space Wolves' for Space Marines)" 
          },
          tierRank: { 
            type: "string", 
            enum: ["S", "A", "B", "C", "D", "F"],
            description: "Tier ranking from the creator's perspective" 
          },
          tierReasoning: { 
            type: "string", 
            description: "Why this tier was assigned - quote or paraphrase from video" 
          },
          tierContext: { 
            type: "string", 
            enum: ["competitive", "casual", "narrative", "general"],
            description: "What context the tier applies to" 
          },
          bestTargets: { 
            type: "array", 
            items: { type: "string" },
            description: "What this unit is best at killing/dealing with" 
          },
          counters: { 
            type: "array", 
            items: { type: "string" },
            description: "What counters or hard-counters this unit" 
          },
          avoidTargets: { 
            type: "array", 
            items: { type: "string" },
            description: "Units or situations this unit should avoid" 
          },
          synergies: { 
            type: "array", 
            items: { type: "string" },
            description: "Other units that combo well with this unit" 
          },
          synergyNotes: { 
            type: "string", 
            description: "Explanation of how the synergies work" 
          },
          playstyleNotes: { 
            type: "string", 
            description: "How to play this unit effectively - tactical advice" 
          },
          deploymentTips: { 
            type: "string", 
            description: "Deployment and positioning advice" 
          },
          pointsEfficiency: { 
            type: "string", 
            enum: ["overcosted", "efficient", "undercosted", "meta-dependent"],
            description: "Points value assessment" 
          },
          pointsNotes: { 
            type: "string", 
            description: "Details about points efficiency" 
          },
          timestamp: { 
            type: "string", 
            description: "Approximate timestamp where unit is discussed (e.g., '12:34')" 
          },
          confidence: { 
            type: "integer", 
            minimum: 0, 
            maximum: 100,
            description: "Confidence in the extracted data (100 = very clear, 50 = some inference)" 
          }
        },
        required: ["unitName", "faction", "confidence"]
      }
    },
    factionContexts: {
      type: "array",
      description: "Competitive insights about factions discussed in the transcript",
      items: {
        type: "object",
        properties: {
          factionName: { 
            type: "string", 
            description: "Name of the faction" 
          },
          subfaction: { 
            type: "string", 
            description: "Subfaction if specifically discussed" 
          },
          metaTier: { 
            type: "string", 
            enum: ["S", "A", "B", "C", "D", "F"],
            description: "Meta tier ranking" 
          },
          metaTierReasoning: { 
            type: "string", 
            description: "Why this meta position" 
          },
          metaPosition: { 
            type: "string", 
            description: "Description like 'top tier', 'gatekeeper', 'mid tier'" 
          },
          playstyleArchetype: { 
            type: "string", 
            enum: ["aggressive_melee", "gunline", "balanced", "elite", "horde", "alpha_strike", "attrition", "mobile_skirmish", "castle", "trade_focused"],
            description: "Primary playstyle archetype" 
          },
          playstyleNotes: { 
            type: "string", 
            description: "How the faction plays" 
          },
          strengths: { 
            type: "array", 
            items: { type: "string" },
            description: "Key strengths of the faction" 
          },
          weaknesses: { 
            type: "array", 
            items: { type: "string" },
            description: "Key weaknesses" 
          },
          recommendedDetachments: { 
            type: "array", 
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                reasoning: { type: "string" }
              },
              required: ["name", "reasoning"]
            },
            description: "Recommended detachments with explanations" 
          },
          detachmentNotes: { 
            type: "string", 
            description: "General notes about detachment choices" 
          },
          favorableMatchups: { 
            type: "array", 
            items: { type: "string" },
            description: "Factions this faction does well against" 
          },
          unfavorableMatchups: { 
            type: "array", 
            items: { type: "string" },
            description: "Factions that are difficult matchups" 
          },
          matchupNotes: { 
            type: "string", 
            description: "Notes about matchups" 
          },
          mustTakeUnits: { 
            type: "array", 
            items: { type: "string" },
            description: "Units that are auto-includes" 
          },
          avoidUnits: { 
            type: "array", 
            items: { type: "string" },
            description: "Units that are traps or not worth taking" 
          },
          sleeperHitUnits: { 
            type: "array", 
            items: { type: "string" },
            description: "Underrated units that are actually good" 
          },
          confidence: { 
            type: "integer", 
            minimum: 0, 
            maximum: 100,
            description: "Confidence in the extracted data" 
          }
        },
        required: ["factionName", "confidence"]
      }
    },
    clarifyingQuestions: {
      type: "array",
      description: "Questions that need human input to improve accuracy",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique question ID" },
          question: { type: "string", description: "The question to ask" },
          context: { type: "string", description: "Why this question is being asked" },
          possibleAnswers: { 
            type: "array", 
            items: { type: "string" },
            description: "Suggested answers if applicable" 
          }
        },
        required: ["id", "question", "context"]
      }
    },
    parsingNotes: {
      type: "array",
      items: { type: "string" },
      description: "Notes about the parsing process, issues encountered, or areas of uncertainty"
    },
    overallConfidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Overall confidence in the extracted data"
    }
  },
  required: ["unitContexts", "factionContexts", "clarifyingQuestions", "parsingNotes", "overallConfidence"]
};

// ============================================
// PROMPTS
// ============================================

function buildSystemPrompt(): string {
  return `You are an expert Warhammer 40,000 10th Edition competitive analyst. Your task is to extract structured competitive insights from YouTube video transcripts.

HANDLING NOISY TRANSCRIPTS:
1. The text may be a messy auto-transcript with heavy repetition (words or sentences repeated multiple times). Look past the repetition to find the core meaning.
2. Unit and faction names may be phonetically misspelled (e.g., "Adra Eggatone" instead of "Adrax Agatone", "Vulcan Hen" instead of "Vulkan He'stan"). Use your knowledge of Warhammer 40k to identify the intended units/factions.
3. Only extract information that is clearly about a specific unit or faction.

IMPORTANT GUIDELINES:

1. ACCURACY OVER COMPLETENESS
   - Only extract information that is EXPLICITLY stated or CLEARLY implied
   - Set confidence lower (50-70) when making inferences
   - Set confidence higher (80-100) when creator is explicit
   - If something is ambiguous, add a clarifying question instead of guessing

2. UNIT IDENTIFICATION
   - Use official unit names (e.g., "Thunderwolf Cavalry" not "TWC")
   - Include faction context (e.g., "Space Wolves" not just "Wolves")
   - Match units to their proper faction even if creator uses nicknames

3. TIER RANKINGS
   - S = Best in class, auto-include, meta-defining
   - A = Very strong, competitive staple
   - B = Solid choice, competitive viable
   - C = Situational, has niche uses
   - D = Below average, rarely worth taking
   - F = Avoid, actively bad

4. CONTEXT MATTERS
   - Note if advice is for competitive, casual, or narrative play
   - Mention if advice is detachment-specific
   - Flag if points values or rules may have changed since video

5. CLARIFYING QUESTIONS
   - Ask questions when the creator's meaning is unclear
   - Ask when multiple interpretations are possible
   - Ask when important context is missing
   - Format questions to be answerable by yes/no or multiple choice when possible

6. GAME VERSION AWARENESS
   - 10th Edition Warhammer 40K has quarterly balance updates
   - Points and rules can change every 3 months
   - Note if the video appears to reference a specific balance state

EXAMPLE CLARIFYING QUESTIONS:
- "Creator says 'this unit is great with support' - which support unit(s) are they referring to?"
- "Video mentions tier ranking - is this for competitive tournament play or casual games?"
- "Multiple opinions expressed - which represents the creator's final recommendation?"`;
}

function buildUserPrompt(
  transcript: string,
  contentTitle: string,
  authorName: string,
  gameVersion?: string
): string {
  const gameVersionNote = gameVersion 
    ? `\nNOTE: This content is categorized as from the ${gameVersion} game version.`
    : '';

  return `Extract competitive insights from this content about Warhammer 40K.

CONTENT INFORMATION:
- Title: ${contentTitle}
- Author/Source: ${authorName}${gameVersionNote}

CONTENT:
${transcript}

---

Extract all unit-level and faction-level competitive insights mentioned in this content. Focus on:

1. **Unit Insights**: Tier rankings, best targets, counters, synergies, playstyle tips
2. **Faction Insights**: Meta position, playstyle archetype, strengths/weaknesses, recommended detachments
3. **Clarifying Questions**: Where information is ambiguous or needs human verification

For each piece of information, provide:
- The insight itself
- Confidence level (0-100)
- Approximate location/timestamp if discernible from context

Be thorough but accurate - it's better to have fewer high-confidence insights than many low-confidence guesses.`;
}

// ============================================
// MAIN PARSER FUNCTION
// ============================================

export async function parseCompetitiveContext(
  transcript: string,
  contentTitle: string,
  authorName: string,
  gameVersion?: string,
  sourceId?: string
): Promise<ParseResult> {
  // Create Langfuse trace
  const trace = langfuse.trace({
    name: "competitive-context-parse",
    metadata: {
      contentTitle,
      authorName,
      gameVersion,
      transcriptLength: transcript.length,
      sourceId,
    },
    tags: [
      'competitive-context',
      `author-${authorName.toLowerCase().replace(/\s+/g, '-')}`,
    ]
  });

  try {
    console.log(`🎯 Parsing competitive context from: ${contentTitle} (${authorName})`);
    console.time('⏱️ Competitive Context Parse');

    // Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(transcript, contentTitle, authorName, gameVersion);

    // Get the Gemini client (supports both AI Studio and Vertex AI)
    const provider = getProvider();
    const geminiProvider = isGeminiProvider(provider) ? (provider as 'google' | 'vertex') : 'google';
    const gemini = await getGeminiClient(geminiProvider);

    // Create generation span for Langfuse
    const generation = trace.generation({
      name: "gemini-context-extraction",
      model: PARSER_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      metadata: {
        provider: geminiProvider,
        temperature: 0.3,
        responseMimeType: 'application/json',
        structuredOutput: true,
      }
    });

    // Call Gemini using the standard Gemini pattern
    let response;
    try {
      response = await gemini.models.generateContent({
        model: PARSER_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseJsonSchema: COMPETITIVE_CONTEXT_SCHEMA,
        }
      });
    } catch (aiError: unknown) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI error';
      console.error('Gemini API error:', aiError);
      
      generation.end({
        level: "ERROR",
        statusMessage: errorMessage
      });

      trace.update({
        metadata: { error: errorMessage, errorType: 'gemini_api_error', level: 'ERROR' }
      });

      await langfuse.flushAsync().catch(() => {});

      return {
        success: false,
        unitContexts: [],
        factionContexts: [],
        overallConfidence: 0,
        clarifyingQuestions: [],
        parsingNotes: [],
        error: `AI parsing failed: ${errorMessage}`,
      };
    }

    // Extract token usage from response for Langfuse cost tracking
    const geminiResponse = response as any;
    const usage = {
      input: geminiResponse.usageMetadata?.promptTokenCount || 0,
      output: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      total: geminiResponse.usageMetadata?.totalTokenCount || 0
    };
    console.log(`📊 Competitive context parser token usage: ${usage.input} input, ${usage.output} output, ${usage.total} total`);

    const responseText = response.text || '';

    if (!responseText) {
      generation.end({
        level: "ERROR",
        statusMessage: 'Empty response from Gemini',
        usage: usage.total > 0 ? { input: usage.input, output: usage.output, total: usage.total } : undefined
      });

      await langfuse.flushAsync().catch(() => {});

      return {
        success: false,
        unitContexts: [],
        factionContexts: [],
        overallConfidence: 0,
        clarifyingQuestions: [],
        parsingNotes: [],
        error: 'Empty response from AI',
      };
    }

    // Update generation with output
    generation.update({
      output: responseText,
      metadata: { responseLength: responseText.length }
    });
    // End generation with token usage for Langfuse cost calculation
    generation.end({
      usage: usage.total > 0 ? { input: usage.input, output: usage.output, total: usage.total } : undefined
    });

    // Parse response
    let parsed: {
      unitContexts: ExtractedUnitContext[];
      factionContexts: ExtractedFactionContext[];
      clarifyingQuestions: ClarifyingQuestion[];
      parsingNotes: string[];
      overallConfidence: number;
    };

    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);

      trace.update({
        metadata: { 
          level: 'ERROR',
          error: 'JSON parse error', 
          parseError: parseError instanceof Error ? parseError.message : 'Unknown',
          responseStart: responseText.substring(0, 500) 
        }
      });

      await langfuse.flushAsync().catch(() => {});

      return {
        success: false,
        unitContexts: [],
        factionContexts: [],
        overallConfidence: 0,
        clarifyingQuestions: [],
        parsingNotes: [],
        error: 'Failed to parse AI response',
      };
    }

    console.timeEnd('⏱️ Competitive Context Parse');
    console.log(`✅ Extracted ${parsed.unitContexts?.length || 0} unit contexts, ${parsed.factionContexts?.length || 0} faction contexts`);

    // Mark clarifying questions as unanswered
    const clarifyingQuestions = (parsed.clarifyingQuestions || []).map((q, idx) => ({
      ...q,
      id: q.id || `q-${idx}`,
      answered: false,
    }));

    // Update trace with results
    trace.update({
      output: {
        unitContextsCount: parsed.unitContexts?.length || 0,
        factionContextsCount: parsed.factionContexts?.length || 0,
        clarifyingQuestionsCount: clarifyingQuestions.length,
        overallConfidence: parsed.overallConfidence,
      },
      tags: [
        'competitive-context',
        `units-${parsed.unitContexts?.length || 0}`,
        `factions-${parsed.factionContexts?.length || 0}`,
        'success'
      ]
    });

    await langfuse.flushAsync().catch(() => {});

    return {
      success: true,
      unitContexts: parsed.unitContexts || [],
      factionContexts: parsed.factionContexts || [],
      overallConfidence: parsed.overallConfidence || 50,
      clarifyingQuestions,
      parsingNotes: parsed.parsingNotes || [],
    };

  } catch (error) {
    console.error('Competitive context parse error:', error);

    trace.update({
      metadata: { 
        level: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Error'
      }
    });

    await langfuse.flushAsync().catch(() => {});

    return {
      success: false,
      unitContexts: [],
      factionContexts: [],
      overallConfidence: 0,
      clarifyingQuestions: [],
      parsingNotes: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// INCREMENTAL PARSING FOR LONG TRANSCRIPTS
// ============================================

/**
 * Parse a long transcript in chunks to avoid token limits
 */
export async function parseCompetitiveContextChunked(
  transcript: string,
  contentTitle: string,
  authorName: string,
  gameVersion?: string,
  sourceId?: string,
  maxChunkSize: number = 500000
): Promise<ParseResult> {
  // If transcript is short enough, parse directly
  if (transcript.length <= maxChunkSize) {
    return parseCompetitiveContext(transcript, contentTitle, authorName, gameVersion, sourceId);
  }

  console.log(`📦 Transcript too long (${transcript.length} chars), chunking into ~${maxChunkSize} char pieces`);

  // Split into chunks at sentence boundaries
  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = transcript.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  console.log(`📦 Split into ${chunks.length} chunks`);

  // Parse each chunk
  const allUnitContexts: ExtractedUnitContext[] = [];
  const allFactionContexts: ExtractedFactionContext[] = [];
  const allClarifyingQuestions: ClarifyingQuestion[] = [];
  const allParsingNotes: string[] = [];
  let totalConfidence = 0;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`📦 Parsing chunk ${i + 1}/${chunks.length}`);
    
    const result = await parseCompetitiveContext(
      chunks[i],
      `${contentTitle} (Part ${i + 1}/${chunks.length})`,
      authorName,
      gameVersion,
      sourceId
    );

    if (result.success) {
      allUnitContexts.push(...result.unitContexts);
      allFactionContexts.push(...result.factionContexts);
      allClarifyingQuestions.push(...result.clarifyingQuestions);
      allParsingNotes.push(...result.parsingNotes);
      totalConfidence += result.overallConfidence;
    } else {
      allParsingNotes.push(`Chunk ${i + 1} failed: ${result.error}`);
    }
  }

  // Deduplicate unit contexts by unit name + faction
  const unitMap = new Map<string, ExtractedUnitContext>();
  for (const ctx of allUnitContexts) {
    const key = `${ctx.unitName}::${ctx.faction}`;
    const existing = unitMap.get(key);
    if (!existing || ctx.confidence > existing.confidence) {
      unitMap.set(key, ctx);
    } else {
      // Merge data from lower confidence into higher confidence
      const merged = mergeUnitContexts(existing, ctx);
      unitMap.set(key, merged);
    }
  }

  // Deduplicate faction contexts
  const factionMap = new Map<string, ExtractedFactionContext>();
  for (const ctx of allFactionContexts) {
    const key = ctx.subfaction ? `${ctx.factionName}::${ctx.subfaction}` : ctx.factionName;
    const existing = factionMap.get(key);
    if (!existing || ctx.confidence > existing.confidence) {
      factionMap.set(key, ctx);
    } else {
      const merged = mergeFactionContexts(existing, ctx);
      factionMap.set(key, merged);
    }
  }

  // Deduplicate questions by content
  const questionSet = new Set<string>();
  const uniqueQuestions = allClarifyingQuestions.filter(q => {
    if (questionSet.has(q.question)) return false;
    questionSet.add(q.question);
    return true;
  });

  return {
    success: true,
    unitContexts: Array.from(unitMap.values()),
    factionContexts: Array.from(factionMap.values()),
    overallConfidence: chunks.length > 0 ? Math.round(totalConfidence / chunks.length) : 0,
    clarifyingQuestions: uniqueQuestions,
    parsingNotes: allParsingNotes,
  };
}

// ============================================
// MERGE HELPERS
// ============================================

function mergeUnitContexts(
  primary: ExtractedUnitContext,
  secondary: ExtractedUnitContext
): ExtractedUnitContext {
  return {
    ...primary,
    // Merge arrays
    bestTargets: mergeArrays(primary.bestTargets, secondary.bestTargets),
    counters: mergeArrays(primary.counters, secondary.counters),
    avoidTargets: mergeArrays(primary.avoidTargets, secondary.avoidTargets),
    synergies: mergeArrays(primary.synergies, secondary.synergies),
    // Prefer primary's text fields, but use secondary if primary is empty
    synergyNotes: primary.synergyNotes || secondary.synergyNotes,
    playstyleNotes: primary.playstyleNotes || secondary.playstyleNotes,
    deploymentTips: primary.deploymentTips || secondary.deploymentTips,
    tierReasoning: primary.tierReasoning || secondary.tierReasoning,
    pointsNotes: primary.pointsNotes || secondary.pointsNotes,
  };
}

function mergeFactionContexts(
  primary: ExtractedFactionContext,
  secondary: ExtractedFactionContext
): ExtractedFactionContext {
  return {
    ...primary,
    strengths: mergeArrays(primary.strengths, secondary.strengths),
    weaknesses: mergeArrays(primary.weaknesses, secondary.weaknesses),
    favorableMatchups: mergeArrays(primary.favorableMatchups, secondary.favorableMatchups),
    unfavorableMatchups: mergeArrays(primary.unfavorableMatchups, secondary.unfavorableMatchups),
    mustTakeUnits: mergeArrays(primary.mustTakeUnits, secondary.mustTakeUnits),
    avoidUnits: mergeArrays(primary.avoidUnits, secondary.avoidUnits),
    sleeperHitUnits: mergeArrays(primary.sleeperHitUnits, secondary.sleeperHitUnits),
    playstyleNotes: primary.playstyleNotes || secondary.playstyleNotes,
    detachmentNotes: primary.detachmentNotes || secondary.detachmentNotes,
    matchupNotes: primary.matchupNotes || secondary.matchupNotes,
    metaTierReasoning: primary.metaTierReasoning || secondary.metaTierReasoning,
  };
}

function mergeArrays<T>(arr1?: T[], arr2?: T[]): T[] {
  const combined = [...(arr1 || []), ...(arr2 || [])];
  // Deduplicate strings
  if (combined.length > 0 && typeof combined[0] === 'string') {
    return [...new Set(combined as unknown as string[])] as unknown as T[];
  }
  return combined;
}

