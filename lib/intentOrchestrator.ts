// Intent Orchestrator
// Classifies speech intent and determines required context tier

import OpenAI from 'openai';
import { GoogleGenAI, Type } from '@google/genai';
import type { ContextTier } from './contextBuilder';
import { getAnalyzeProvider, validateProviderConfig, getAnalyzeModel, type IntentClassification as IIntentClassification } from './aiProvider';

// Use plain OpenAI client (observeOpenAI adds massive overhead - 10-15s per call!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini client
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export interface IntentClassification extends IIntentClassification {
  intent: IntentCategory;
  contextTier: ContextTier;
  detectedTools?: string[]; // Predicted tool calls
}

export type IntentCategory = 
  | 'SIMPLE_STATE'        // Phase changes, round advancement, simple queries
  | 'UNIT_HEALTH'         // Health updates, wounds, models lost
  | 'COMBAT_LOGGING'      // Combat results, attacks, kills
  | 'OBJECTIVE_CONTROL'   // Objective markers, control
  | 'SECONDARY_SCORING'   // Secondary objectives scoring
  | 'STRATEGIC'           // Stratagems, complex rules, strategic questions
  | 'UNCLEAR';            // Ambiguous or uncertain

// JSON Schema for combined gatekeeper + intent classification (OpenAI format)
const INTENT_CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    isGameRelated: {
      type: "boolean",
      description: "Is this speech about the Warhammer 40K game being played?"
    },
    intent: {
      type: "string",
      enum: ["SIMPLE_STATE", "UNIT_HEALTH", "COMBAT_LOGGING", "OBJECTIVE_CONTROL", "SECONDARY_SCORING", "STRATEGIC", "UNCLEAR"]
    },
    contextTier: {
      type: "string",
      enum: ["minimal", "units_only", "unit_names", "objectives", "secondaries", "full"]
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    reasoning: {
      type: "string"
    }
  },
  required: ["isGameRelated", "intent", "contextTier", "confidence", "reasoning"],
  additionalProperties: false
};

// Gemini schema format using Type enums
const INTENT_CLASSIFICATION_SCHEMA_GEMINI = {
  type: Type.OBJECT,
  properties: {
    isGameRelated: {
      type: Type.BOOLEAN,
      description: "Is this speech about the Warhammer 40K game being played?"
    },
    intent: {
      type: Type.STRING,
      enum: ["SIMPLE_STATE", "UNIT_HEALTH", "COMBAT_LOGGING", "OBJECTIVE_CONTROL", "SECONDARY_SCORING", "STRATEGIC", "UNCLEAR"]
    },
    contextTier: {
      type: Type.STRING,
      enum: ["minimal", "units_only", "unit_names", "objectives", "secondaries", "full"]
    },
    confidence: {
      type: Type.NUMBER
    },
    reasoning: {
      type: Type.STRING
    }
  },
  required: ["isGameRelated", "intent", "contextTier", "confidence", "reasoning"]
};

/**
 * Combined gatekeeper + intent classification using OpenAI Responses API with structured outputs
 */
async function classifyIntentWithOpenAI(
  transcription: string,
  currentPhase: string,
  currentRound: number,
  recentTranscripts: string[],
  langfuseGeneration?: any,
  modelName: string = 'gpt-5-nano',
  abortSignal?: AbortSignal
): Promise<IntentClassification> {
  const instructions = `You are a combined gatekeeper and intent classifier for a Warhammer 40K game tracking system.

Your job has TWO parts:

PART 1: GATEKEEPER - Is this speech about the Warhammer 40K game?

Game-related speech (isGameRelated = TRUE):
✓ Game state changes: "moving to shooting", "round 2", "your turn"
✓ Resource updates: "gained 2 CP", "scored 5 VP", "lost command points"
✓ Unit actions: "my unit took wounds", "charged your squad", "failed morale"
✓ Objective control: "captured objective 3", "lost the center"
✓ Rules questions: "can I shoot after advancing?", "what's the range?"
✓ Combat reporting: "killed 3 models", "did 5 damage"

NOT game-related (isGameRelated = FALSE):
✗ Casual conversation: "how are you?", "nice dice roll", "want a drink?"
✗ Meta-game chat: "this army is overpowered", "I need better models"
✗ Off-topic: "what's the weather?", "did you see the game last night?"
✗ Greetings/acknowledgments: "hello", "okay", "sure", "all right" (without game context)

Use recent context to resolve ambiguous cases like "all right" or "that's it".

PART 2: INTENT CLASSIFICATION - Map speech to tool categories

AVAILABLE TOOLS IN THE SYSTEM:

State Management (minimal context):
- change_phase: Transitions between game phases (Command → Movement → Shooting → Charge → Fight)
- change_player_turn: Switches active player
- advance_battle_round: Moves to next battle round
- query_game_state: Returns current phase, round, CP, VP

Resource Tracking (minimal context):
- update_command_points: Add/subtract CP for player/opponent
- update_victory_points: Add/subtract VP for player/opponent

Unit Operations (medium context - needs unit list):
- update_unit_health: Record wounds/model losses on specific units. Also logs combat context when attacker is specified.
- mark_unit_destroyed: Mark a unit as completely destroyed
- update_objective_control: Track which objectives are held

Combat Logging (medium context - merged into update_unit_health):
- Combat results are now logged via update_unit_health with optional combat context (attacking_unit, attacking_player, combat_phase)

Strategic Actions (full context - needs rules/abilities):
- Tools that require datasheet abilities, stratagems, rules lookups

INTENT CLASSIFICATION BASED ON TOOL NEEDS:

1. SIMPLE_STATE → Uses state/resource tools only
   Examples:
   - "Moving to shooting phase" → change_phase
   - "I have 3 CP" → query_game_state
   - "Add 5 VP to opponent" → update_victory_points
   - "Round 2" → advance_battle_round
   - "Your turn" → change_player_turn
   
   Context tier: minimal (only session state)
   Token cost: ~500

2. UNIT_HEALTH → Unit health/wounds tracking
   Examples:
   - "My terminators took 5 wounds" → update_unit_health
   - "Lost 2 models from my squad" → update_unit_health
   - "His tank is destroyed" → mark_unit_destroyed
   - "My unit took 3 damage" → update_unit_health
   
   Context tier: units_only (session + full unit list with health + 3 transcripts)
   Token cost: ~2500

3. COMBAT_LOGGING → Recording combat results (uses update_unit_health with combat context)
   Examples:
   - "Killed 3 marines" → update_unit_health with models_lost=3 and attacking_unit context
   - "Destroyed his intercessors" → update_unit_health with combat context
   - "My terminators wiped out his squad" → update_unit_health (attacker=terminators)
   - "Bjorn killed 2 Eradicators" → update_unit_health(unit_name="Eradicators", models_lost=2, attacking_unit="Bjorn")
   
   Context tier: units_only (session + full unit list with health + 3 transcripts)
   Token cost: ~2500

4. OBJECTIVE_CONTROL → Objective marker control
   Examples:
   - "I control objective 3" → update_objective_control
   - "Lost the center objective" → update_objective_control
   - "My terminators on objective 2" → update_objective_control
   
   Context tier: objectives (session + objectives + unit names + 3 transcripts)
   Token cost: ~600

5. SECONDARY_SCORING → Secondary objectives scoring
   Examples:
   - "Scored assassination" → score_assassination
   - "That's bring it down" → score_bring_it_down
   - "5 VP for behind enemy lines" → score_secondary_vp
   - "Destroyed his captain for assassinate" → score_assassination
   
   Context tier: secondaries (session + active secondaries + unit names + 3 transcripts)
   Token cost: ~700

6. STRATEGIC → Requires rules validation or complex multi-step logic
   Examples:
   - "Using transhuman physiology" → Need stratagem rules
   - "Can I advance and shoot?" → Need phase rules + unit abilities
   - "What should I watch out for?" → Strategic analysis
   - "Does my ability work in this phase?" → Rules lookup
   
   Context tier: full (session + units + datasheets + abilities + rules)
   Token cost: ~8000+

7. UNCLEAR → Ambiguous or off-topic
   Context tier: full (safest fallback)

CLASSIFICATION EXAMPLES:

Input: "moving to shooting phase"
→ Game-related? YES (phase transition)
→ Tool needed: change_phase
→ Intent: SIMPLE_STATE
→ Context tier: minimal
→ Reasoning: "Phase change requires only session state"

Input: "my terminators took 5 wounds"
→ Game-related? YES (unit health update)
→ Tool needed: update_unit_health
→ Intent: UNIT_HEALTH
→ Context tier: units_only
→ Reasoning: "Health update requires full unit list with wound tracking"

Input: "killed 3 marines"
→ Game-related? YES (combat result)
→ Tool needed: update_unit_health (with combat context)
→ Intent: COMBAT_LOGGING
→ Context tier: units_only
→ Reasoning: "Combat logging uses update_unit_health with attacking_unit context for combat log"

Input: "I control objective 2"
→ Game-related? YES (objective control)
→ Tool needed: update_objective_control
→ Intent: OBJECTIVE_CONTROL
→ Context tier: objectives
→ Reasoning: "Objective control needs objective markers and unit names"

Input: "scored assassination on his captain"
→ Game-related? YES (secondary scoring)
→ Tool needed: score_assassination
→ Intent: SECONDARY_SCORING
→ Context tier: secondaries
→ Reasoning: "Secondary scoring needs active secondaries and unit names"

Input: "using transhuman physiology on my intercessors"
→ Game-related? YES (stratagem activation)
→ Tools needed: (stratagem validation + potential follow-up)
→ Intent: STRATEGIC
→ Context tier: full
→ Reasoning: "Stratagem requires full datasheet context and rules validation"

Input: "nice weather today"
→ Game-related? NO
→ Intent: UNCLEAR
→ Context tier: full (safety fallback)
→ Reasoning: "Off-topic conversation"

CURRENT GAME STATE:
- Phase: ${currentPhase}
- Round: ${currentRound}

${recentTranscripts.length > 0 ? `RECENT CONVERSATION CONTEXT:\n${recentTranscripts.slice(-3).map((t, i) => `${i + 1}. "${t}"`).join('\n')}\n` : ''}

First determine if this is game-related (isGameRelated). If FALSE, set intent to UNCLEAR and contextTier to full.
If TRUE, map the speech to the appropriate tool category and determine the context tier based on what data the tool needs.`;

  try {
    console.log(`🔄 Starting ${modelName} call for gatekeeper + intent...`);
    console.time(`  └─ ${modelName} API call`);
    
    const response = await openai.responses.create({
      model: modelName,
      instructions,
      input: [
        {
          role: 'user',
          content: `Analyze this game speech:\n\n"${transcription}"`
        }
      ],
      reasoning: {
        effort: 'minimal' // Fastest possible - this is simple classification
      },
      text: {
        verbosity: 'low', // Concise output
        format: {
          type: 'json_schema',
          name: 'intent_classification',
          schema: INTENT_CLASSIFICATION_SCHEMA,
          strict: true
        }
      }
    }, { signal: abortSignal });

    console.timeEnd(`  └─ ${modelName} API call`);
    console.time('  └─ Parsing response');
    
    const classification = JSON.parse(response.output_text || '{}') as IntentClassification;
    
    console.timeEnd('  └─ Parsing response');
    
    // Log to Langfuse if generation provided (manual logging for better control)
    if (langfuseGeneration) {
      console.time('  └─ Langfuse logging');
      langfuseGeneration.update({
        model: modelName,
        input: [
          { role: 'system', content: instructions },
          { role: 'user', content: `Analyze this player speech:\n\n"${transcription}"` }
        ],
        output: classification,
        metadata: {
          transcription,
          currentPhase,
          currentRound,
          recentTranscriptsCount: recentTranscripts.length
        }
      });
      langfuseGeneration.end();
      console.timeEnd('  └─ Langfuse logging');
    }
    
    console.log(`🚦 Gatekeeper: ${classification.isGameRelated ? 'ALLOWED' : 'BLOCKED'} (${classification.confidence.toFixed(2)} confidence)`);
    console.log(`🎯 Intent: ${classification.intent} → ${classification.contextTier}`);
    console.log(`   Reasoning: ${classification.reasoning}`);
    
    return classification;
    
  } catch (error: any) {
    // Handle abort errors gracefully - don't log as error, just re-throw
    if (error?.name === 'AbortError' || abortSignal?.aborted) {
      console.log('🛑 OpenAI intent classification aborted by client');
      throw error; // Re-throw to propagate abort
    }
    
    console.error('OpenAI classification failed:', error);
    
    // Default to full context on error (safest fallback - allow through)
    return {
      isGameRelated: true, // Allow through on error
      intent: 'UNCLEAR',
      contextTier: 'full',
      confidence: 0.0,
      reasoning: 'OpenAI classification failed, using full context as fallback'
    };
  }
}

/**
 * Combined gatekeeper + intent classification using Google Gemini with structured outputs
 */
async function classifyIntentWithGemini(
  transcription: string,
  currentPhase: string,
  currentRound: number,
  recentTranscripts: string[],
  langfuseGeneration?: any,
  modelName: string = 'gemini-3-flash-preview',
  abortSignal?: AbortSignal
): Promise<IntentClassification> {
  const systemPrompt = `You are a combined gatekeeper and intent classifier for a Warhammer 40K game tracking system.

Your job has TWO parts:

PART 1: GATEKEEPER - Is this speech about the Warhammer 40K game?

Game-related speech (isGameRelated = TRUE):
✓ Game state changes: "moving to shooting", "round 2", "your turn"
✓ Resource updates: "gained 2 CP", "scored 5 VP", "lost command points"
✓ Unit actions: "my unit took wounds", "charged your squad", "failed morale"
✓ Objective control: "captured objective 3", "lost the center"
✓ Rules questions: "can I shoot after advancing?", "what's the range?"
✓ Combat reporting: "killed 3 models", "did 5 damage"

NOT game-related (isGameRelated = FALSE):
✗ Casual conversation: "how are you?", "nice dice roll", "want a drink?"
✗ Meta-game chat: "this army is overpowered", "I need better models"
✗ Off-topic: "what's the weather?", "did you see the game last night?"
✗ Greetings/acknowledgments: "hello", "okay", "sure", "all right" (without game context)

Use recent context to resolve ambiguous cases like "all right" or "that's it".

PART 2: INTENT CLASSIFICATION - Map speech to tool categories

AVAILABLE TOOLS IN THE SYSTEM:

State Management (minimal context):
- change_phase: Transitions between game phases (Command → Movement → Shooting → Charge → Fight)
- change_player_turn: Switches active player
- advance_battle_round: Moves to next battle round
- query_game_state: Returns current phase, round, CP, VP

Resource Tracking (minimal context):
- update_command_points: Add/subtract CP for player/opponent
- update_victory_points: Add/subtract VP for player/opponent

Unit Operations (medium context - needs unit list):
- update_unit_health: Record wounds/model losses on specific units. Also logs combat context when attacker is specified.
- mark_unit_destroyed: Mark a unit as completely destroyed
- update_objective_control: Track which objectives are held

Combat Logging (medium context - merged into update_unit_health):
- Combat results are now logged via update_unit_health with optional combat context (attacking_unit, attacking_player, combat_phase)

Strategic Actions (full context - needs rules/abilities):
- Tools that require datasheet abilities, stratagems, rules lookups

INTENT CLASSIFICATION BASED ON TOOL NEEDS:

1. SIMPLE_STATE → Uses state/resource tools only
   Examples:
   - "Moving to shooting phase" → change_phase
   - "I have 3 CP" → query_game_state
   - "Add 5 VP to opponent" → update_victory_points
   - "Round 2" → advance_battle_round
   - "Your turn" → change_player_turn
   
   Context tier: minimal (only session state)
   Token cost: ~500

2. UNIT_HEALTH → Unit health/wounds tracking
   Examples:
   - "My terminators took 5 wounds" → update_unit_health
   - "Lost 2 models from my squad" → update_unit_health
   - "His tank is destroyed" → mark_unit_destroyed
   - "My unit took 3 damage" → update_unit_health
   
   Context tier: units_only (session + full unit list with health + 3 transcripts)
   Token cost: ~2500

3. COMBAT_LOGGING → Recording combat results (uses update_unit_health with combat context)
   Examples:
   - "Killed 3 marines" → update_unit_health with models_lost=3 and attacking_unit context
   - "Destroyed his intercessors" → update_unit_health with combat context
   - "My terminators wiped out his squad" → update_unit_health (attacker=terminators)
   - "Bjorn killed 2 Eradicators" → update_unit_health(unit_name="Eradicators", models_lost=2, attacking_unit="Bjorn")
   
   Context tier: units_only (session + full unit list with health + 3 transcripts)
   Token cost: ~2500

4. OBJECTIVE_CONTROL → Objective marker control
   Examples:
   - "I control objective 3" → update_objective_control
   - "Lost the center objective" → update_objective_control
   - "My terminators on objective 2" → update_objective_control
   
   Context tier: objectives (session + objectives + unit names + 3 transcripts)
   Token cost: ~600

5. SECONDARY_SCORING → Secondary objectives scoring
   Examples:
   - "Scored assassination" → score_assassination
   - "That's bring it down" → score_bring_it_down
   - "5 VP for behind enemy lines" → score_secondary_vp
   - "Destroyed his captain for assassinate" → score_assassination
   
   Context tier: secondaries (session + active secondaries + unit names + 3 transcripts)
   Token cost: ~700

6. STRATEGIC → Requires rules validation or complex multi-step logic
   Examples:
   - "Using transhuman physiology" → Need stratagem rules
   - "Can I advance and shoot?" → Need phase rules + unit abilities
   - "What should I watch out for?" → Strategic analysis
   - "Does my ability work in this phase?" → Rules lookup
   
   Context tier: full (session + units + datasheets + abilities + rules)
   Token cost: ~8000+

7. UNCLEAR → Ambiguous or off-topic
   Context tier: full (safest fallback)

CURRENT GAME STATE:
- Phase: ${currentPhase}
- Round: ${currentRound}

${recentTranscripts.length > 0 ? `RECENT CONVERSATION CONTEXT:\n${recentTranscripts.slice(-3).map((t, i) => `${i + 1}. "${t}"`).join('\n')}\n` : ''}

First determine if this is game-related (isGameRelated). If FALSE, set intent to UNCLEAR and contextTier to full.
If TRUE, map the speech to the appropriate tool category and determine the context tier based on what data the tool needs.`;

  try {
    console.log(`🔄 Starting ${modelName} call for gatekeeper + intent...`);
    console.time(`  └─ ${modelName} API call`);
    
    const response = await gemini.models.generateContent({
      model: modelName,
      contents: `Analyze this game speech:\n\n"${transcription}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: INTENT_CLASSIFICATION_SCHEMA_GEMINI,
        abortSignal: abortSignal
      }
    });

    console.timeEnd(`  └─ ${modelName} API call`);
    console.time('  └─ Parsing response');

    // Extract token usage for Langfuse cost tracking
    const geminiResponse = response as any;
    const usage = {
      input: geminiResponse.usageMetadata?.promptTokenCount || 0,
      output: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      total: geminiResponse.usageMetadata?.totalTokenCount || 0
    };
    console.log(`📊 Gemini intent token usage: ${usage.input} input, ${usage.output} output, ${usage.total} total`);

    const classification = JSON.parse(response.text || '{}') as IntentClassification;

    console.timeEnd('  └─ Parsing response');

    // Log to Langfuse if generation provided (manual logging for better control)
    if (langfuseGeneration) {
      console.time('  └─ Langfuse logging');
      langfuseGeneration.update({
        model: modelName,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this player speech:\n\n"${transcription}"` }
        ],
        output: classification,
        metadata: {
          transcription,
          currentPhase,
          currentRound,
          recentTranscriptsCount: recentTranscripts.length,
          provider: 'google'
        }
      });
      // End generation with token usage for Langfuse cost calculation
      langfuseGeneration.end({
        usage: usage.total > 0 ? {
          input: usage.input,
          output: usage.output,
          total: usage.total
        } : undefined
      });
      console.timeEnd('  └─ Langfuse logging');
    }
    
    console.log(`🚦 Gatekeeper: ${classification.isGameRelated ? 'ALLOWED' : 'BLOCKED'} (${classification.confidence.toFixed(2)} confidence)`);
    console.log(`🎯 Intent: ${classification.intent} → ${classification.contextTier}`);
    console.log(`   Reasoning: ${classification.reasoning}`);
    
    return classification;
    
  } catch (error: any) {
    // Handle abort errors gracefully - don't log as error, just re-throw
    if (error?.name === 'AbortError' || abortSignal?.aborted) {
      console.log('🛑 Gemini intent classification aborted by client');
      throw error; // Re-throw to propagate abort
    }
    
    console.error('Gemini classification failed:', error);
    
    // Default to full context on error (safest fallback - allow through)
    return {
      isGameRelated: true, // Allow through on error
      intent: 'UNCLEAR',
      contextTier: 'full',
      confidence: 0.0,
      reasoning: 'Gemini classification failed, using full context as fallback'
    };
  }
}

/**
 * Main orchestration function
 * Combines gatekeeper validation and intent classification in a single AI call
 * Automatically selects provider based on ANALYZE_PROVIDER environment variable
 * @param abortSignal - Optional AbortSignal to cancel the AI call when client disconnects
 */
export async function orchestrateIntent(
  transcription: string,
  currentPhase: string,
  currentRound: number,
  recentTranscripts: string[] = [],
  langfuseGeneration?: any,
  abortSignal?: AbortSignal
): Promise<IntentClassification> {
  // Get configured provider
  const provider = getAnalyzeProvider();
  
  // Validate API key is present
  try {
    validateProviderConfig(provider);
  } catch (error) {
    console.error('Provider configuration error:', error);
    // Fall back to allowing through with full context on config error
    return {
      isGameRelated: true,
      intent: 'UNCLEAR',
      contextTier: 'full',
      confidence: 0.0,
      reasoning: 'Provider configuration error, using full context as fallback'
    };
  }
  
  const modelName = getAnalyzeModel(provider, 'intent');
  console.log(`🤖 Using AI Provider: ${provider.toUpperCase()}`);
  console.log(`📊 Model: ${modelName}`);
  
  // Single AI call for both gatekeeper and intent classification
  if (provider === 'google') {
    return await classifyIntentWithGemini(transcription, currentPhase, currentRound, recentTranscripts, langfuseGeneration, modelName, abortSignal);
  } else {
    return await classifyIntentWithOpenAI(transcription, currentPhase, currentRound, recentTranscripts, langfuseGeneration, modelName, abortSignal);
  }
}

