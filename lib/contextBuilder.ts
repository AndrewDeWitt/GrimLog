// Context Builder Module
// Provides tiered context loading for different analysis complexity levels

import { prisma } from './prisma';
import { fetchGameContext, buildGameStatePrompt } from './validationHelpers';
import { getSessionUnitNames, buildUnitListPrompt } from './unitMatching';
import { buildDatasheetContext } from './datasheetHelpers';
import { RULES_CHEAT_SHEET, VALIDATION_GUIDELINES, SECONDARY_SCORING_RULES, CP_VALIDATION_RULES, PHASE_REMINDER_RULES, DAMAGE_CALCULATION_RULES } from './rulesReference';
import { getMissionRules, formatMissionPrompt } from './missionRules';
import { getSecondaryProgressSummary, getSecondaryData } from './secondaryRules';
import { GENERATED_PHONETIC_CORRECTIONS, ALL_VOCABULARY } from './generatedVocabulary';

/**
 * Common phonetic patterns for Warhammer 40K terms
 * Maps likely misrecognitions to correct terms
 */
const COMMON_PHONETIC_PATTERNS: Record<string, string[]> = {
  // Word endings that are commonly split or misheard
  'gants': ['giants', 'against', 'gaunts'],
  'fex': ['flex', 'fax', 'pex', 'fix'],
  'marines': ['marines', 'marinas', 'machines'],
  'guard': ['guard', 'god', 'gard'],
  'knight': ['knight', 'night', 'kite'],
  'lord': ['lord', 'lard', 'board'],
  'prince': ['prince', 'prints', 'prims'],
  // Common prefixes
  'tyran': ['tyrant', 'tyranny', 'terrain', 'turban'],
  'inter': ['inter', 'enter', 'inner'],
  'hive': ['hive', 'high', 'hide', 'five'],
  // Faction-specific patterns
  'astra': ['astra', 'astro', 'extra'],
  'aeldari': ['elderly', 'el dari', 'eldar'],
  'necron': ['neck ron', 'necron', 'nekron'],
};

/**
 * Generate likely misrecognition patterns for a unit name
 */
function generatePhoneticPatterns(unitName: string): string[] {
  const patterns: string[] = [];
  const lower = unitName.toLowerCase();
  
  // Check against generated corrections
  for (const [misheard, correct] of Object.entries(GENERATED_PHONETIC_CORRECTIONS)) {
    if (correct.toLowerCase() === lower) {
      patterns.push(misheard);
    }
  }
  
  // Check common phonetic patterns
  for (const [ending, variants] of Object.entries(COMMON_PHONETIC_PATTERNS)) {
    if (lower.includes(ending)) {
      for (const variant of variants) {
        if (variant !== ending) {
          patterns.push(lower.replace(ending, variant));
        }
      }
    }
  }
  
  // Split compound words with spaces
  const spaceSplit = lower.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  if (spaceSplit !== lower) {
    patterns.push(spaceSplit);
  }
  
  // Limit to most likely patterns
  return patterns.slice(0, 3);
}

/**
 * Build phonetic hints for a list of unit names
 * Used to help AI understand likely transcription errors
 */
function buildPhoneticHintsPrompt(unitNames: string[]): string {
  if (unitNames.length === 0) return '';
  
  const hints: string[] = [];
  
  // Generate hints for each unit (limit to avoid prompt bloat)
  for (const unit of unitNames.slice(0, 15)) {
    const patterns = generatePhoneticPatterns(unit);
    if (patterns.length > 0) {
      hints.push(`- "${patterns[0]}" → ${unit}`);
    }
  }
  
  if (hints.length === 0) return '';
  
  return `
UNIT-SPECIFIC PHONETIC HINTS (for this army):
${hints.join('\n')}
`;
}

export type ContextTier = 'minimal' | 'units_only' | 'unit_names' | 'objectives' | 'secondaries' | 'full';

export interface MinimalContext {
  tier: 'minimal';
  gameStatePrompt: string;
  systemPromptAdditions: string;
}

export interface UnitsOnlyContext {
  tier: 'units_only';
  gameStatePrompt: string;
  unitListPrompt: string;
  recentConversation: string;
  systemPromptAdditions: string;
}

export interface UnitNamesContext {
  tier: 'unit_names';
  gameStatePrompt: string;
  unitNamesPrompt: string;
  recentConversation: string;
  systemPromptAdditions: string;
}

export interface ObjectivesContext {
  tier: 'objectives';
  gameStatePrompt: string;
  objectivesPrompt: string;
  unitNamesPrompt: string;
  recentConversation: string;
  systemPromptAdditions: string;
}

export interface SecondariesContext {
  tier: 'secondaries';
  gameStatePrompt: string;
  secondariesPrompt: string;
  unitNamesPrompt: string;
  recentConversation: string;
  systemPromptAdditions: string;
}

export interface FullContext {
  tier: 'full';
  gameStatePrompt: string;
  unitListPrompt: string;
  datasheetContext: string;
  conversationHistory: string;
  systemPromptAdditions: string;
}

export type AnalysisContext = MinimalContext | UnitsOnlyContext | UnitNamesContext | ObjectivesContext | SecondariesContext | FullContext;

/**
 * Build minimal context - just session state
 * Used for: Phase changes, round advancement, simple queries
 */
export async function buildMinimalContext(sessionId: string): Promise<MinimalContext> {
  console.log('📦 Building MINIMAL context (session state only)');
  
  // Fetch just the basic game context
  const gameContext = await fetchGameContext(sessionId);
  const gameStatePrompt = buildGameStatePrompt(gameContext);
  
  return {
    tier: 'minimal',
    gameStatePrompt,
    systemPromptAdditions: VALIDATION_GUIDELINES
  };
}

/**
 * Build units_only context - session state + full unit list with health + recent conversation
 * Used for: Unit health/wound tracking, models lost
 */
export async function buildUnitsOnlyContext(
  sessionId: string,
  currentTranscriptSequence: number
): Promise<UnitsOnlyContext> {
  console.log('📦 Building UNITS_ONLY context (session + full unit list with health + 3 transcripts)');
  
  // Fetch game context and unit names in parallel
  const [gameContext, unitNames] = await Promise.all([
    fetchGameContext(sessionId),
    getSessionUnitNames(sessionId)
  ]);
  
  const gameStatePrompt = buildGameStatePrompt(gameContext);
  const unitListPrompt = buildUnitListPrompt(unitNames.attacker, unitNames.defender);
  
  // Fetch only last 3 transcripts for recent context
  const recentTranscripts = await prisma.transcriptHistory.findMany({
    where: {
      gameSessionId: sessionId,
      sequenceOrder: { lt: currentTranscriptSequence }
    },
    orderBy: { sequenceOrder: 'desc' },
    take: 3
  });
  
  const recentConversation = recentTranscripts
    .reverse()
    .map(t => t.text)
    .join('\n- ');
  
  return {
    tier: 'units_only',
    gameStatePrompt,
    unitListPrompt,
    recentConversation,
    systemPromptAdditions: VALIDATION_GUIDELINES
  };
}

/**
 * Build unit_names context - session state + unit names only (no health details)
 * Used for: Combat logging, simple unit references
 */
export async function buildUnitNamesContext(
  sessionId: string,
  currentTranscriptSequence: number
): Promise<UnitNamesContext> {
  console.log('📦 Building UNIT_NAMES context (session + unit names only + 3 transcripts)');
  
  // Fetch game context and unit names in parallel
  const [gameContext, unitNames] = await Promise.all([
    fetchGameContext(sessionId),
    getSessionUnitNames(sessionId)
  ]);
  
  const gameStatePrompt = buildGameStatePrompt(gameContext);
  
  // Build lightweight unit names prompt (no health details)
  const unitNamesPrompt = `
=== UNITS IN PLAY ===
Attacker Units: ${unitNames.attacker.join(', ')}
Defender Units: ${unitNames.defender.join(', ')}
`;
  
  // Fetch only last 3 transcripts for recent context
  const recentTranscripts = await prisma.transcriptHistory.findMany({
    where: {
      gameSessionId: sessionId,
      sequenceOrder: { lt: currentTranscriptSequence }
    },
    orderBy: { sequenceOrder: 'desc' },
    take: 3
  });
  
  const recentConversation = recentTranscripts
    .reverse()
    .map(t => t.text)
    .join('\n- ');
  
  return {
    tier: 'unit_names',
    gameStatePrompt,
    unitNamesPrompt,
    recentConversation,
    systemPromptAdditions: VALIDATION_GUIDELINES
  };
}

/**
 * Build objectives context - session state + objectives + unit names
 * Used for: Objective marker control
 */
export async function buildObjectivesContext(
  sessionId: string,
  currentTranscriptSequence: number
): Promise<ObjectivesContext> {
  console.log('📦 Building OBJECTIVES context (session + objectives + unit names + 3 transcripts)');
  
  // Fetch game context and unit names in parallel
  const [gameContext, unitNames] = await Promise.all([
    fetchGameContext(sessionId),
    getSessionUnitNames(sessionId)
  ]);
  
  const gameStatePrompt = buildGameStatePrompt(gameContext);
  
  // Build unit names prompt
  const unitNamesPrompt = `
=== UNITS IN PLAY ===
Attacker Units: ${unitNames.attacker.join(', ')}
Defender Units: ${unitNames.defender.join(', ')}
`;
  
  // Build objectives prompt from game context
  const objectivesPrompt = `
=== OBJECTIVE MARKERS ===
${gameContext.objectiveMarkers.map(obj => 
  `Objective ${obj.objectiveNumber}: ${obj.controlledBy === 'none' ? 'Uncontrolled' : `Controlled by ${obj.controlledBy}`}`
).join('\n')}
`;
  
  // Fetch only last 3 transcripts for recent context
  const recentTranscripts = await prisma.transcriptHistory.findMany({
    where: {
      gameSessionId: sessionId,
      sequenceOrder: { lt: currentTranscriptSequence }
    },
    orderBy: { sequenceOrder: 'desc' },
    take: 3
  });
  
  const recentConversation = recentTranscripts
    .reverse()
    .map(t => t.text)
    .join('\n- ');
  
  return {
    tier: 'objectives',
    gameStatePrompt,
    objectivesPrompt,
    unitNamesPrompt,
    recentConversation,
    systemPromptAdditions: VALIDATION_GUIDELINES
  };
}

/**
 * Build secondaries context - session state + active secondaries + unit names
 * Used for: Secondary objectives scoring
 */
export async function buildSecondariesContext(
  sessionId: string,
  currentTranscriptSequence: number
): Promise<SecondariesContext> {
  console.log('📦 Building SECONDARIES context (session + secondaries + unit names + 3 transcripts)');
  
  // Fetch game context and unit names in parallel
  const [gameContext, unitNames] = await Promise.all([
    fetchGameContext(sessionId),
    getSessionUnitNames(sessionId)
  ]);
  
  const gameStatePrompt = buildGameStatePrompt(gameContext);
  
  // Build unit names prompt
  const unitNamesPrompt = `
=== UNITS IN PLAY ===
Attacker Units: ${unitNames.attacker.join(', ')}
Defender Units: ${unitNames.defender.join(', ')}
`;
  
  // Parse secondaries from game state
  const attackerSecondaries: string[] = gameContext.session.attackerSecondaries 
    ? JSON.parse(gameContext.session.attackerSecondaries) 
    : [];
  const defenderSecondaries: string[] = gameContext.session.defenderSecondaries 
    ? JSON.parse(gameContext.session.defenderSecondaries) 
    : [];
  
  // Get secondary rules from JSON data
  const allSecondaryNames = [...attackerSecondaries, ...defenderSecondaries];
  const secondaryRules: any[] = allSecondaryNames.map(name => {
    const data = getSecondaryData(name);
    if (!data) return null;
    return {
      name: data.name,
      description: data.description,
      scoringTrigger: data.scoringType === 'unit_destruction' ? 'Unit destroyed' : 
                      data.scoringType === 'objective_control' ? 'Control objectives' :
                      data.requiresAction ? 'Complete action' : 'Position check',
      vpCalculation: data.fixedScoring || data.tacticalScoring || null,
      maxVPTotal: data.maxVP || 20,
      maxVPPerTurn: data.vpPerTurnCap,
      missionType: data.missionType,
      fixedScoring: data.fixedScoring,
      tacticalScoring: data.tacticalScoring,
      completesOnScore: data.completesOnScore
    };
  }).filter(Boolean);
  
  // Get current progress
  const [attackerProgress, defenderProgress] = await Promise.all([
    getSecondaryProgressSummary(sessionId, 'attacker'),
    getSecondaryProgressSummary(sessionId, 'defender')
  ]);
  
  // Build enhanced secondaries prompt with scoring rules
  let secondariesPrompt = `
=== ACTIVE SECONDARY OBJECTIVES ===

Attacker Secondaries:`;
  
  if (attackerSecondaries.length === 0) {
    secondariesPrompt += `\n  None set`;
  } else {
    attackerSecondaries.forEach(name => {
      const rule = secondaryRules.find(r => r.name === name);
      if (rule) {
        secondariesPrompt += `\n  • ${name}: ${rule.description}
    Scoring: ${rule.scoringTrigger}
    VP: ${formatVPCalculation(rule.vpCalculation)}
    Max: ${rule.maxVPTotal} VP${rule.maxVPPerTurn ? `, ${rule.maxVPPerTurn} VP per turn` : ''}`;
      } else {
        secondariesPrompt += `\n  • ${name}`;
      }
    });
  }
  
  secondariesPrompt += `\n\nDefender Secondaries:`;
  
  if (defenderSecondaries.length === 0) {
    secondariesPrompt += `\n  None set`;
  } else {
    defenderSecondaries.forEach(name => {
      const rule = secondaryRules.find(r => r.name === name);
      if (rule) {
        secondariesPrompt += `\n  • ${name}: ${rule.description}
    Scoring: ${rule.scoringTrigger}
    VP: ${formatVPCalculation(rule.vpCalculation)}
    Max: ${rule.maxVPTotal} VP${rule.maxVPPerTurn ? `, ${rule.maxVPPerTurn} VP per turn` : ''}`;
      } else {
        secondariesPrompt += `\n  • ${name}`;
      }
    });
  }
  
  secondariesPrompt += `\n\nCurrent Progress:
Attacker: ${attackerProgress}
Defender: ${defenderProgress}
`;
  
  // Fetch only last 3 transcripts for recent context
  const recentTranscripts = await prisma.transcriptHistory.findMany({
    where: {
      gameSessionId: sessionId,
      sequenceOrder: { lt: currentTranscriptSequence }
    },
    orderBy: { sequenceOrder: 'desc' },
    take: 3
  });
  
  const recentConversation = recentTranscripts
    .reverse()
    .map(t => t.text)
    .join('\n- ');
  
  return {
    tier: 'secondaries',
    gameStatePrompt,
    secondariesPrompt,
    unitNamesPrompt,
    recentConversation,
    systemPromptAdditions: VALIDATION_GUIDELINES
  };
}

/**
 * Build mission context - includes primary mission details
 * Used across multiple context tiers
 */
export async function buildMissionContext(sessionId: string): Promise<string> {
  const mission = await getMissionRules(sessionId);
  
  if (!mission) {
    return `
=== PRIMARY MISSION ===
No mission selected for this game.
Primary VP will be tracked manually.
Use check_primary_scoring tool to get scoring reminders.
`;
  }
  
  return formatMissionPrompt(mission);
}

/**
 * Build full context - everything
 * Used for: Strategic questions, combat, stratagems, complex rules
 */
export async function buildFullContext(
  sessionId: string,
  currentTranscriptSequence: number
): Promise<FullContext> {
  console.log('📦 Building FULL context (session + units + datasheets + full history + rules)');
  
  // Fetch game context and unit names in parallel
  const [gameContext, unitNames] = await Promise.all([
    fetchGameContext(sessionId),
    getSessionUnitNames(sessionId)
  ]);
  
  const gameStatePrompt = buildGameStatePrompt(gameContext);
  const unitListPrompt = buildUnitListPrompt(unitNames.attacker, unitNames.defender);
  
  // Fetch full conversation history (20 transcripts)
  const recentTranscripts = await prisma.transcriptHistory.findMany({
    where: {
      gameSessionId: sessionId,
      sequenceOrder: { lt: currentTranscriptSequence }
    },
    orderBy: { sequenceOrder: 'desc' },
    take: 20
  });
  
  const conversationHistory = recentTranscripts
    .reverse()
    .map(t => t.text)
    .join('\n- ');
  
  // Build full datasheet context for AI
  const allUnitNames = [...unitNames.attacker, ...unitNames.defender];
  const datasheetContext = await buildDatasheetContext(allUnitNames);
  
  console.log(`📊 Loaded ${allUnitNames.length} datasheets for full context`);
  
  return {
    tier: 'full',
    gameStatePrompt,
    unitListPrompt,
    datasheetContext,
    conversationHistory,
    systemPromptAdditions: `${RULES_CHEAT_SHEET}\n\n${VALIDATION_GUIDELINES}`
  };
}

/**
 * Build context based on tier
 */
export async function buildContext(
  tier: ContextTier,
  sessionId: string,
  currentTranscriptSequence: number
): Promise<AnalysisContext> {
  const startTime = Date.now();
  
  let context: AnalysisContext;
  
  switch (tier) {
    case 'minimal':
      context = await buildMinimalContext(sessionId);
      break;
    case 'units_only':
      context = await buildUnitsOnlyContext(sessionId, currentTranscriptSequence);
      break;
    case 'unit_names':
      context = await buildUnitNamesContext(sessionId, currentTranscriptSequence);
      break;
    case 'objectives':
      context = await buildObjectivesContext(sessionId, currentTranscriptSequence);
      break;
    case 'secondaries':
      context = await buildSecondariesContext(sessionId, currentTranscriptSequence);
      break;
    case 'full':
      context = await buildFullContext(sessionId, currentTranscriptSequence);
      break;
  }
  
  const duration = Date.now() - startTime;
  console.log(`📦 Context built in ${duration}ms (tier: ${tier})`);
  
  return context;
}

/**
 * Format context into a system prompt
 * NOTE: This is now async to support mission context loading
 */
export async function formatContextForPrompt(
  context: AnalysisContext,
  armyContext?: string,
  sessionId?: string
): Promise<string> {
  let prompt = 'You are an expert Warhammer 40,000 10th Edition game assistant with access to tools to track game state.\n\n';
  
  // Add datasheet context if available (full context)
  if (context.tier === 'full') {
    prompt += context.datasheetContext + '\n\n';
    prompt += 'You have access to COMPLETE DATASHEET INFORMATION including stats, weapons, abilities, and rules.\n';
    prompt += 'Use this information to provide accurate rules clarification and validate game actions.\n\n';
  }
  
  // Add speech-to-text awareness for contexts that need unit identification
  if (context.tier === 'units_only' || context.tier === 'unit_names' || 
      context.tier === 'objectives' || context.tier === 'secondaries' || 
      context.tier === 'full') {
    
    // Build dynamic phonetic hints from active units
    let phoneticHints = '';
    if (context.tier === 'units_only' || context.tier === 'full') {
      // Extract unit names for phonetic hints
      const unitListMatch = context.unitListPrompt.match(/(?:Player's Army:|Opponent's Army:)\s*([\s\S]*?)(?=\n\n|Opponent's Army:|IMPORTANT:|$)/g);
      if (unitListMatch) {
        const allUnits = unitListMatch.join('\n')
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^\s*-\s*/, '').trim())
          .filter(Boolean);
        phoneticHints = buildPhoneticHintsPrompt(allUnits);
      }
    } else if ('unitNamesPrompt' in context) {
      // Extract from unit names prompt
      const attackerMatch = context.unitNamesPrompt.match(/Attacker Units:\s*(.+)/);
      const defenderMatch = context.unitNamesPrompt.match(/Defender Units:\s*(.+)/);
      const allUnits: string[] = [];
      if (attackerMatch) allUnits.push(...attackerMatch[1].split(',').map(s => s.trim()));
      if (defenderMatch) allUnits.push(...defenderMatch[1].split(',').map(s => s.trim()));
      phoneticHints = buildPhoneticHintsPrompt(allUnits);
    }
    
    prompt += `⚠️ SPEECH-TO-TEXT AWARENESS:
The text you receive comes from voice-to-text recognition and WILL contain phonetic transcription errors.
You MUST interpret the text using context and phonetic similarity, NOT literal text matching.

Common Warhammer 40K speech-to-text errors:
- "tournaments" or "term against" → Termagants
- "tyranno flex" or "tyrannoflex" → Tyrannofex  
- "elderly" or "el-dari" → Aeldari
- "trans human" → Transhuman Physiology
- "car knife x" or "carnifex" → Carnifex
- "hive tyrant" might be "high tyrant"
- "gene stealer" → Genestealer
- "oath of movement" → Oath of Moment
- "strata gems" or "strategy gem" → Stratagems
- Unit names may be broken into phonetic chunks
${phoneticHints}
CRITICAL: When you see an unusual word, check if it sounds like a unit/stratagem from the armies below.
Example: If armies contain "Termagants" and speech says "tournaments took damage", interpret as "Termagants".

`;
  }
  
  // Add rules reference (full context only)
  if (context.tier === 'full') {
    prompt += context.systemPromptAdditions + '\n\n';
  }
  
  // NEW: Add CP validation rules (all tiers)
  prompt += CP_VALIDATION_RULES + '\n\n';
  
  // NEW: Add secondary scoring rules (secondaries and full tiers)
  if (context.tier === 'secondaries' || context.tier === 'full') {
    prompt += SECONDARY_SCORING_RULES + '\n\n';
  }
  
  // NEW: Add phase reminder rules (full tier)
  if (context.tier === 'full') {
    prompt += PHASE_REMINDER_RULES + '\n\n';
  }
  
  // NEW: Add damage calculation rules (full tier)
  if (context.tier === 'full') {
    prompt += DAMAGE_CALCULATION_RULES + '\n\n';
  }
  
  // Add game state
  prompt += context.gameStatePrompt + '\n\n';
  
  // NEW: Add mission context (all tiers except minimal)
  if (context.tier !== 'minimal' && sessionId) {
    const missionContext = await buildMissionContext(sessionId);
    prompt += missionContext + '\n\n';
  }
  
  // Add context-specific data
  if (context.tier === 'units_only' || context.tier === 'full') {
    prompt += context.unitListPrompt + '\n\n';
  } else if (context.tier === 'unit_names' || context.tier === 'objectives' || context.tier === 'secondaries') {
    prompt += context.unitNamesPrompt + '\n\n';
  }
  
  // Add objectives for objectives context
  if (context.tier === 'objectives') {
    prompt += context.objectivesPrompt + '\n\n';
  }
  
  // Add secondaries for secondaries context
  if (context.tier === 'secondaries') {
    prompt += context.secondariesPrompt + '\n\n';
  }
  
  // Add army context if provided
  if (armyContext) {
    prompt += `\nARMY CONTEXT:\n${armyContext}\n\n`;
  }
  
  // Add conversation history
  if (context.tier === 'units_only' || context.tier === 'unit_names' || 
      context.tier === 'objectives' || context.tier === 'secondaries') {
    if (context.recentConversation) {
      prompt += `\nRECENT CONVERSATION:\n- ${context.recentConversation}\n\n`;
    }
  } else if (context.tier === 'full' && context.conversationHistory) {
    prompt += `\nRECENT CONVERSATION:\n- ${context.conversationHistory}\n\n`;
  }
  
  // Add validation guidelines for contexts that need them
  if (context.tier !== 'minimal' && context.tier !== 'full') {
    prompt += context.systemPromptAdditions + '\n\n';
  }
  
  // Add job description
  prompt += `YOUR JOB:
Listen to game speech and call the appropriate tools to track the game.

CRITICAL: You are a TOOL-CALLING AGENT, not a conversational assistant.
- You MUST call tools to track game actions
- DO NOT generate conversational responses
- DO NOT ask clarifying questions
- DO NOT explain your reasoning in text
- Use fuzzy matching and context to resolve ambiguities yourself

IMPORTANT RULES:
- Determine from context whether actions apply to "attacker" or "defender"
- Listen for contextual cues to identify which side is performing actions
- You can call MULTIPLE tools in one response if needed
- Use the unit matching system to handle speech-to-text errors
- For phase changes, ALWAYS include whose turn it is
- VALIDATE actions against current game state and rules before executing
- If the speech is unclear or not game-related, DO NOT call tools
`;
  
  // Add detailed tool usage instructions for relevant contexts
  if (context.tier === 'units_only' || context.tier === 'unit_names' || 
      context.tier === 'objectives' || context.tier === 'secondaries' || 
      context.tier === 'full') {
    prompt += `
UNIT HEALTH TRACKING:
- Track wounds and models lost during combat
- Use update_unit_health when units take damage: "Attacker's Terminators lost 2 models" or "Defender's Dreadnought took 6 wounds"
- Use mark_unit_destroyed when units are wiped out: "Defender's Intercessors are destroyed"
- Use update_unit_status for battleshock and status effects: "Attacker's Assault Squad is battle-shocked" or "Defender's Terminators have cover"
- IMPORTANT: Distinguish between models lost (whole models removed) and wounds dealt (damage to multi-wound units)

DAMAGE OVERKILL AWARENESS:
In Warhammer 40K, **excess damage from a single attack does NOT spill to other models**.
Example: 2 attacks with Damage 5 against 3-wound Terminators:
- Attack 1: 5 damage → Model 1 dies (only 3 wounds counted, 2 WASTED)
- Attack 2: 5 damage → Model 2 dies (only 3 wounds counted, 2 WASTED)
- Result: 2 models dead, NOT 10 wounds ÷ 3 = 3 dead!

TRUST PLAYER INPUT - they already calculated the overkill:
- PREFER models_lost when player says "killed X models"
- Use wounds_lost ONLY for partial damage on surviving multi-wound models
- DO NOT try to calculate models from raw damage - overkill makes this unreliable

COMBAT LOGGING (optional parameters):
When attacker is known, add combat context for the combat log:
- attacking_unit: "Bjorn", "Terminators", etc.
- attacking_player: "attacker" or "defender"
- combat_phase: "Shooting" or "Fight"

WOUND DISTRIBUTION ALGORITHM:
When speech indicates "Terminators took 6 wounds" without specifying which models:
1. The system will automatically distribute damage using smart logic:
   - Damage already-wounded models first (finish them off before starting new wounds)
   - Target regular models before special models (sergeant, heavy weapon)
   - Remove models when they reach 0 wounds
2. The system logs the distribution decision for transparency

When speech specifies a specific model:
- "Terminator Sergeant took 3 wounds" → use target_model_role="sergeant"
- "Heavy bolter guy died" → use target_model_role="heavy_weapon"
- "Lost plasma gun marine" → use target_model_role="special_weapon"

Examples:
- "Bjorn killed 2 Terminators" → update_unit_health(unit_name="Terminators", models_lost=2, attacking_unit="Bjorn", combat_phase="Fight")
- "Terminators killed 3 Intercessors" → update_unit_health(unit_name="Intercessors", models_lost=3, attacking_unit="Terminators")
- "Did 9 damage, killed 3 terminators" → update_unit_health(models_lost=3) [trust player's count!]
- "Terminators lost 4 wounds, one on 2 remaining" → update_unit_health(wounds_lost=4) [partial damage]
- "Terminator Sergeant took 3 wounds" → update_unit_health(wounds_lost=3, target_model_role="sergeant")
- "Lost heavy bolter guy" → update_unit_health(models_lost=1, target_model_role="heavy_weapon")

SECONDARY OBJECTIVES TRACKING:
When secondary objectives are mentioned, use the appropriate scoring tools:

AUTOMATIC VP CALCULATION (use these specialized tools):
- Assassination: When CHARACTER destroyed → score_assassination(player, character_name, wounds_characteristic)
  * System auto-calculates: 4 VP for 4+ wounds, 3 VP for <4 wounds
  * Example: "Destroyed Captain" → score_assassination(player="attacker", character_name="Captain", wounds_characteristic=5)
  
- Bring It Down: When MONSTER/VEHICLE destroyed → score_bring_it_down(player, unit_name, total_wounds)
  * System auto-calculates: 2 VP base + 2 VP (15W+) + 2 VP (20W+) cumulative
  * Example: "Killed Land Raider with 18 wounds" → score_bring_it_down(player="attacker", unit_name="Land Raider", total_wounds=18) = 4 VP
  
- Marked for Death: When target destroyed → score_marked_for_death(player, target_type, unit_name)
  * Alpha targets = 5 VP, Gamma target = 2 VP
  * Example: "Alpha target down" → score_marked_for_death(player="attacker", target_type="alpha", unit_name="...")
  
- No Prisoners: When any unit destroyed → score_no_prisoners(player, unit_name)
  * 2 VP per unit, capped at 5 VP per turn (system enforces)
  
- Cull the Horde: When INFANTRY with 13+ models destroyed → score_cull_the_horde(player, unit_name, starting_strength)
  * Example: "Destroyed 20-strong Boyz unit" → score_cull_the_horde(player="attacker", unit_name="Boyz", starting_strength=20)
  
- Overwhelming Force: When unit on objective destroyed → score_overwhelming_force(player, unit_name)
  * 3 VP per unit, capped at 5 VP per turn (system enforces)

MANUAL SCORING (use generic tool):
- All other secondaries → score_secondary_vp(player, secondary_name, vp_amount, progress_update)
  * Example: "Scored Behind Enemy Lines for 4 VP" → score_secondary_vp(player="attacker", secondary_name="Behind Enemy Lines", vp_amount=4)

IMPORTANT SECONDARY RULES:
- Check current secondaries in game state before scoring
- Only score if the secondary is active for that side
- The UI can also manually score via checkboxes
- Voice commands should complement (not replace) manual scoring

Examples:
- "Destroyed captain, that's assassinate" → score_assassination(...)
- "Killed dreadnought with 12 wounds for bring it down" → score_bring_it_down(...)
- "Scored 5 VP for Secure No Man's Land" → score_secondary_vp(...)
`;
  }
  
  prompt += '\nIf the speech is unclear or not game-related, don\'t call any tools.';
  
  return prompt;
}

/**
 * Helper function to format VP calculation for display
 */
function formatVPCalculation(vpCalculation: any): string {
  if (!vpCalculation) return 'Unknown';
  
  const calcType = vpCalculation.type;
  
  switch (calcType) {
    case 'threshold': {
      const thresholds = vpCalculation.thresholds || [];
      return thresholds.map((t: any) => `${t.vp} VP if ${t.condition}`).join(', ');
    }
    
    case 'per_unit': {
      return `${vpCalculation.vpPerUnit} VP per unit`;
    }
    
    case 'fixed': {
      return `${vpCalculation.fixedVP} VP`;
    }
    
    default:
      return 'See secondary card for details';
  }
}


