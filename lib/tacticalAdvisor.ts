/**
 * Tactical Advisor - AI-Powered Strategic Suggestions
 * 
 * Builds rich context from game state and generates tactical advice
 * using Gemini 3 Flash for analysis.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from './prisma';
import {
  FullTacticalContext,
  TacticalUnitState,
  TacticalAbility,
  TacticalStratagem,
  TacticalSuggestion,
  TacticalAdviceResponse,
  TacticalContext,
} from './types';

// ============================================
// RULES REFERENCE
// ============================================

interface TacticalReference {
  gameOverview: {
    turnStructure: string;
    winConditions: string;
  };
  phases: Record<string, {
    sequence: string[];
    keyRules: string[];
    tacticalPriorities: string[];
    scoringOpportunities: string[];
  }>;
  secondaryObjectives: {
    fixed: Array<{ name: string; scoringMethod: string; tips: string[] }>;
    tactical: Array<{ name: string; scoringMethod: string; tips: string[] }>;
    generalRules: string[];
  };
  keyRules: Array<{ name: string; rule: string; tacticalImplication: string }>;
  tacticalWisdom: {
    generalPrinciples: string[];
    commonMistakes: string[];
  };
}

let cachedReference: TacticalReference | null = null;

/**
 * Load the tactical reference (cached after first load)
 */
function loadTacticalReference(): TacticalReference | null {
  if (cachedReference) return cachedReference;
  
  try {
    const refPath = path.join(process.cwd(), 'data', 'parsed-rules', 'tactical-advisor-reference.json');
    if (fs.existsSync(refPath)) {
      const content = fs.readFileSync(refPath, 'utf-8');
      cachedReference = JSON.parse(content);
      return cachedReference;
    }
  } catch (e) {
    console.warn('Failed to load tactical reference:', e);
  }
  return null;
}

/**
 * Get phase-specific rules context for the current phase
 */
function getPhaseRulesContext(phase: string): string {
  const ref = loadTacticalReference();
  if (!ref || !ref.phases[phase]) return '';
  
  const phaseRef = ref.phases[phase];
  let context = `\n## ${phase} Phase Rules Reference\n`;
  
  if (phaseRef.sequence?.length) {
    context += `**Sequence**: ${phaseRef.sequence.join(' → ')}\n`;
  }
  if (phaseRef.keyRules?.length) {
    context += `**Key Rules**: ${phaseRef.keyRules.slice(0, 3).join('; ')}\n`;
  }
  if (phaseRef.tacticalPriorities?.length) {
    context += `**Priorities**: ${phaseRef.tacticalPriorities.slice(0, 2).join('; ')}\n`;
  }
  if (phaseRef.scoringOpportunities?.length) {
    context += `**Scoring**: ${phaseRef.scoringOpportunities.join('; ')}\n`;
  }
  
  return context;
}

/**
 * Get secondary objectives context for known secondaries
 */
function getSecondaryContext(secondaryNames: string[]): string {
  const ref = loadTacticalReference();
  if (!ref || !secondaryNames.length) return '';
  
  let context = '';
  const allSecondaries = [...(ref.secondaryObjectives.fixed || []), ...(ref.secondaryObjectives.tactical || [])];
  
  for (const name of secondaryNames) {
    const sec = allSecondaries.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (sec) {
      context += `\n**${sec.name}**: ${sec.scoringMethod}`;
      if (sec.tips?.length) {
        context += ` Tips: ${sec.tips[0]}`;
      }
    }
  }
  
  return context;
}

/**
 * Get core rules summary for the system prompt
 */
function getCoreRulesSummary(): string {
  const ref = loadTacticalReference();
  if (!ref) return '';
  
  let summary = `\n## Core 10th Edition Rules Summary\n`;
  
  // Game overview
  if (ref.gameOverview) {
    summary += `**Turn Structure**: ${ref.gameOverview.turnStructure}\n`;
    summary += `**Win Conditions**: ${ref.gameOverview.winConditions}\n\n`;
  }
  
  // Key rules
  if (ref.keyRules?.length) {
    summary += `**Critical Rules**:\n`;
    for (const rule of ref.keyRules.slice(0, 5)) {
      summary += `- ${rule.name}: ${rule.tacticalImplication}\n`;
    }
    summary += '\n';
  }
  
  // Tactical wisdom
  if (ref.tacticalWisdom?.generalPrinciples?.length) {
    summary += `**Tactical Principles**:\n`;
    for (const principle of ref.tacticalWisdom.generalPrinciples.slice(0, 3)) {
      summary += `- ${principle}\n`;
    }
  }
  
  // Secondary rules
  if (ref.secondaryObjectives?.generalRules?.length) {
    summary += `\n**Secondary Objective Rules**:\n`;
    for (const rule of ref.secondaryObjectives.generalRules.slice(0, 3)) {
      summary += `- ${rule}\n`;
    }
  }
  
  return summary;
}

// ============================================
// CONTEXT BUILDING
// ============================================

/**
 * Build full tactical context for AI analysis
 */
export async function buildTacticalContext(
  sessionId: string,
  perspective: 'attacker' | 'defender'
): Promise<FullTacticalContext> {
  
  console.log(`🎯 Building tactical context for session ${sessionId} (${perspective} perspective)`);
  
  // Fetch session with all related data
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      attackerArmy: {
        include: {
          units: {
            include: {
              fullDatasheet: {
                include: {
                  abilities: {
                    include: {
                      ability: true
                    }
                  }
                }
              }
            }
          },
          faction: true
        }
      },
      unitInstances: {
        include: {
          fullDatasheet: {
            include: {
              abilities: {
                include: {
                  ability: true
                }
              }
            }
          }
        }
      },
      objectiveMarkers: true,
      primaryMission: true,
      // Include recent stratagem usage for this round
      stratagemLogs: {
        orderBy: { timestamp: 'desc' },
        take: 20
      },
      // Include timeline events for game history context (all non-reverted events)
      timelineEvents: {
        where: { isReverted: false },
        orderBy: { timestamp: 'asc' } // Chronological order
      }
    }
  });
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get faction and detachment info
  const attackerFaction = session.attackerArmy?.faction?.name || session.attackerArmy?.units[0]?.fullDatasheet?.faction;
  const attackerDetachment = session.attackerArmy?.detachment;
  const defenderFaction = session.defenderFaction;
  
  // Build unit states
  const attackerUnits = await buildUnitStates(
    session.unitInstances.filter(u => u.owner === 'attacker')
  );
  const defenderUnits = await buildUnitStates(
    session.unitInstances.filter(u => u.owner === 'defender')
  );
  
  // Get available stratagems for the perspective
  const availableStratagems = await getAvailableStratagems(
    perspective === 'attacker' ? attackerFaction : defenderFaction,
    perspective === 'attacker' ? attackerDetachment : undefined,
    session.currentPhase
  );
  
  // Get detachment ability
  let detachmentAbility: { name: string; description: string } | undefined;
  if (perspective === 'attacker' && attackerDetachment && attackerFaction) {
    const detachment = await prisma.detachment.findFirst({
      where: {
        name: attackerDetachment,
        faction: attackerFaction
      }
    });
    if (detachment?.abilityName && detachment?.abilityDescription) {
      detachmentAbility = {
        name: detachment.abilityName,
        description: detachment.abilityDescription
      };
    }
  }
  
  // Count objectives
  const objectivesHeldByAttacker = session.objectiveMarkers.filter(
    o => o.controlledBy === 'attacker'
  ).length;
  const objectivesHeldByDefender = session.objectiveMarkers.filter(
    o => o.controlledBy === 'defender'
  ).length;
  const objectivesContested = session.objectiveMarkers.filter(
    o => o.controlledBy === 'contested'
  ).length;

  const objectiveMarkers = session.objectiveMarkers.map((o) => ({
    objectiveNumber: o.objectiveNumber,
    controlledBy: (o.controlledBy || 'none') as 'attacker' | 'defender' | 'contested' | 'none',
    controllingUnit: o.controllingUnit || null
  }));

  const primaryMission = session.primaryMission
    ? {
        id: session.primaryMission.id,
        name: session.primaryMission.name,
        deploymentType: session.primaryMission.deploymentType,
        scoringPhase: session.primaryMission.scoringPhase,
        scoringTiming: session.primaryMission.scoringTiming,
        scoringFormula: session.primaryMission.scoringFormula,
        maxVP: session.primaryMission.maxVP,
        specialRules: session.primaryMission.specialRules || null,
      }
    : null;
  
  // Parse secondary objectives
  const parseSecondaries = (json: string | null): string[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };
  
  const parseSecondaryProgress = (json: string | null): Record<string, { vp: number; details: string[] }> => {
    if (!json) return {};
    try {
      const parsed = JSON.parse(json);
      const result: Record<string, { vp: number; details: string[] }> = {};
      for (const [name, data] of Object.entries(parsed)) {
        const d = data as any;
        result[name] = {
          vp: d.vp || 0,
          details: d.details || []
        };
      }
      return result;
    } catch {
      return {};
    }
  };
  
  const parseTargetSelections = (json: string | null): Record<string, { targets?: string[]; objective?: number }> | undefined => {
    if (!json) return undefined;
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  };
  
  const secondaryObjectives = {
    attacker: {
      active: parseSecondaries(session.attackerSecondaries),
      progress: parseSecondaryProgress(session.attackerSecondaryProgress),
      missionMode: (session.attackerMissionMode || 'tactical') as 'fixed' | 'tactical',
      discarded: parseSecondaries(session.attackerDiscardedSecondaries)
    },
    defender: {
      active: parseSecondaries(session.defenderSecondaries),
      progress: parseSecondaryProgress(session.defenderSecondaryProgress),
      missionMode: (session.defenderMissionMode || 'tactical') as 'fixed' | 'tactical',
      discarded: parseSecondaries(session.defenderDiscardedSecondaries)
    }
  };
  
  const targetSelections = {
    attacker: parseTargetSelections(session.attackerTargetSelections),
    defender: parseTargetSelections(session.defenderTargetSelections)
  };
  
  // Parse recent stratagem usage (filter to current round for relevance)
  const recentStratagems = session.stratagemLogs
    .filter(sl => sl.phase) // Ensure phase is present
    .map(sl => ({
      name: sl.stratagemName,
      usedBy: sl.usedBy as 'attacker' | 'defender',
      phase: sl.phase,
      round: session.battleRound, // Approximation - stratagems are sorted by recency
      targetUnit: sl.targetUnit || undefined
    }));
  
  // Parse event log for game history context (already in chronological order)
  const eventLog = session.timelineEvents.map(event => ({
    timestamp: event.timestamp.toISOString(),
    eventType: event.eventType,
    phase: event.phase || undefined,
    description: event.description
  }));
  
  return {
    sessionId,
    phase: session.currentPhase,
    battleRound: session.battleRound,
    currentTurn: session.currentTurn as 'attacker' | 'defender',
    
    attackerCP: session.attackerCommandPoints,
    defenderCP: session.defenderCommandPoints,
    attackerVP: session.attackerVictoryPoints,
    defenderVP: session.defenderVictoryPoints,
    
    objectivesHeldByAttacker,
    objectivesHeldByDefender,
    objectivesContested,
    
    attackerFaction,
    attackerDetachment: attackerDetachment || undefined,
    defenderFaction: defenderFaction || undefined,
    
    attackerUnits,
    defenderUnits,

    objectiveMarkers,
    primaryMission,
    
    availableStratagems,
    detachmentAbility,
    
    // New context fields
    firstTurn: session.firstTurn as 'attacker' | 'defender',
    secondaryObjectives,
    targetSelections,
    recentStratagems,
    eventLog
  };
}

/**
 * Build tactical unit states from unit instances
 */
async function buildUnitStates(
  unitInstances: any[]
): Promise<TacticalUnitState[]> {
  return unitInstances.map(unit => {
    // Parse keywords
    let keywords: string[] = [];
    if (unit.fullDatasheet?.keywords) {
      try {
        keywords = JSON.parse(unit.fullDatasheet.keywords);
      } catch {
        keywords = [];
      }
    }
    
    // Parse active effects
    let activeEffects: string[] = [];
    if (unit.activeEffects) {
      try {
        activeEffects = JSON.parse(unit.activeEffects);
      } catch {
        activeEffects = [];
      }
    }
    
    // Build abilities list
    const abilities: TacticalAbility[] = [];
    if (unit.fullDatasheet?.abilities) {
      for (const da of unit.fullDatasheet.abilities) {
        const ability = da.ability;
        if (ability) {
          let triggerPhase: string[] | undefined;
          if (ability.triggerPhase) {
            try {
              triggerPhase = JSON.parse(ability.triggerPhase);
            } catch {
              triggerPhase = undefined;
            }
          }
          
          abilities.push({
            name: ability.name,
            type: ability.type,
            description: ability.description,
            triggerPhase,
            isReactive: ability.isReactive
          });
        }
      }
    }
    
    // Calculate health percentage
    const startingWounds = unit.startingWounds || unit.startingModels;
    const currentWounds = unit.currentWounds || unit.currentModels;
    const healthPercentage = startingWounds > 0 
      ? Math.round((currentWounds / startingWounds) * 100) 
      : 0;
    
    return {
      id: unit.id,
      name: unit.unitName,
      owner: unit.owner as 'attacker' | 'defender',
      datasheet: unit.datasheet,
      iconUrl: unit.iconUrl || null,
      datasheetId: unit.datasheetId || null,
      
      startingModels: unit.startingModels,
      currentModels: unit.currentModels,
      startingWounds: unit.startingWounds || unit.startingModels,
      currentWounds: unit.currentWounds || unit.currentModels,
      woundsPerModel: unit.woundsPerModel || 1,
      healthPercentage,
      
      isDestroyed: unit.isDestroyed,
      isBattleShocked: unit.isBattleShocked,
      activeEffects,
      
      keywords,
      abilities,
      attachedToUnit: unit.attachedToUnit || undefined
    };
  });
}

/**
 * Get available stratagems for a faction/detachment in current phase
 */
async function getAvailableStratagems(
  faction: string | undefined | null,
  detachment: string | undefined | null,
  currentPhase: string
): Promise<TacticalStratagem[]> {
  if (!faction) return [];
  
  const stratagems = await prisma.stratagemData.findMany({
    where: {
      faction,
      ...(detachment ? { detachment } : {}),
      OR: [
        { triggerPhase: { contains: currentPhase } },
        { triggerPhase: null }
      ]
    },
    take: 20 // Limit to avoid overwhelming the AI
  });
  
  return stratagems.map(s => {
    let triggerPhase: string[] | undefined;
    if (s.triggerPhase) {
      try {
        triggerPhase = JSON.parse(s.triggerPhase);
      } catch {
        triggerPhase = undefined;
      }
    }
    
    return {
      id: s.id,
      name: s.name,
      cpCost: s.cpCost,
      type: s.type,
      when: s.when,
      effect: s.effect,
      triggerPhase,
      isReactive: s.isReactive,
      detachment: s.detachment || undefined
    };
  });
}

// ============================================
// PROMPT ENGINEERING
// ============================================

/**
 * Build the system prompt for tactical analysis
 */
export function buildTacticalSystemPrompt(
  detailLevel: 'quick' | 'detailed'
): string {
  // Load core rules from the tactical reference
  const coreRulesContext = getCoreRulesSummary();
  
  const basePrompt = `You are an expert Warhammer 40,000 10th Edition tactical advisor. Your role is to analyze the current game state and provide actionable tactical suggestions to help the player make better decisions.

## Your Expertise
- Deep understanding of 40k 10th edition rules
- Knowledge of unit synergies and ability interactions
- Strategic positioning and threat assessment
- Command Point economy and stratagem timing
- Objective control and victory point optimization
- Secondary objective scoring strategies and counter-play
${coreRulesContext}
## Analysis Guidelines
1. **Be Specific**: Reference actual units by name, not generic advice
2. **Consider Resources**: Account for CP, wounds remaining, and unit counts
3. **Phase-Appropriate**: Focus on actions relevant to the current phase
4. **Prioritize Impact**: High-priority suggestions should have the biggest game impact
5. **Synergy Awareness**: Look for ability combos (e.g., auras, leader abilities, stratagem interactions)
6. **Play The Mission**: Consider current objective control and the primary mission scoring window/timing
7. **Name Objectives**: When relevant, reference objective numbers (e.g., "Objective 2") and who controls them
8. **Secondary Awareness**: Consider both scoring your secondaries AND denying opponent's secondaries
9. **Stratagem Restrictions**: Don't suggest stratagems marked as [USED THIS ROUND] - they likely have usage restrictions
10. **Turn Order**: Consider who has first turn (acts first each round) when planning moves

## Secondary Objective Key Insights
- **Assassination**: Kill enemy CHARACTERs (4 VP each, max 15)
- **Bring It Down**: Kill enemy MONSTERS/VEHICLES (2-5 VP based on wounds)
- **Behind Enemy Lines**: Get units in opponent's deployment zone
- **Engage on All Fronts**: Control table quarters with units
- **Tactical secondaries**: Drawn each Command phase in tactical mode, can be discarded for 1 CP

## Categories for Suggestions
- **positioning**: Movement and placement advice
- **stratagem**: Stratagem usage recommendations  
- **ability**: Unit ability activations to consider
- **objective**: Objective control priorities (primary AND secondary)
- **resource**: CP or other resource management
- **threat**: Enemy threats to be aware of (including their secondary scoring)
- **opponent_threat**: What the OPPONENT could do to you (their stratagems, abilities, charges) - ALWAYS include 1-2 of these to warn the player about potential opponent plays`;

  if (detailLevel === 'quick') {
    return `${basePrompt}

## Output Format (Quick Mode)
Provide 3-5 concise tactical suggestions. Each suggestion should be:
- A single clear action or consideration
- 1-2 sentences maximum
- No detailed rule explanations needed
- Include at least one relevant unit in relatedUnits when possible
- ALWAYS include 1-2 "opponent_threat" suggestions showing what the opponent could do to you

Respond with a JSON object matching this structure:
{
  "suggestions": [
    {
      "priority": "high" | "medium" | "low",
      "category": "positioning" | "stratagem" | "ability" | "objective" | "resource" | "threat" | "opponent_threat",
      "title": "Brief action title",
      "description": "1-2 sentence actionable advice",
      "relatedUnits": ["Unit Name"],
      "cpCost": number (if stratagem),
      "isOpponentPlay": true (ONLY for opponent_threat category)
    }
  ]
}`;
  } else {
    return `${basePrompt}

## Output Format (Detailed Mode)
Provide 4-6 tactical suggestions with full reasoning. Each suggestion should include:
- Clear action recommendation
- Reasoning citing specific rules or abilities
- Related units involved
- Rule names being referenced
- ALWAYS include 1-2 "opponent_threat" suggestions showing what the opponent could do to you

Respond with a JSON object matching this structure:
{
  "suggestions": [
    {
      "priority": "high" | "medium" | "low",
      "category": "positioning" | "stratagem" | "ability" | "objective" | "resource" | "threat" | "opponent_threat",
      "title": "Brief action title",
      "description": "Detailed actionable advice",
      "reasoning": "Explanation citing specific rules and why this matters",
      "relatedUnits": ["Unit Name 1", "Unit Name 2"],
      "relatedRules": ["Rule Name 1", "Rule Name 2"],
      "cpCost": number (if stratagem),
      "isOpponentPlay": true (ONLY for opponent_threat category)
    }
  ]
}`;
  }
}

/**
 * Build the user prompt with game context
 */
export function buildTacticalUserPrompt(
  context: FullTacticalContext,
  perspective: 'attacker' | 'defender'
): string {
  const isMyTurn = context.currentTurn === perspective;
  const myCP = perspective === 'attacker' ? context.attackerCP : context.defenderCP;
  const enemyCP = perspective === 'attacker' ? context.defenderCP : context.attackerCP;
  const myVP = perspective === 'attacker' ? context.attackerVP : context.defenderVP;
  const enemyVP = perspective === 'attacker' ? context.defenderVP : context.attackerVP;
  const myObjectives = perspective === 'attacker' 
    ? context.objectivesHeldByAttacker 
    : context.objectivesHeldByDefender;
  const enemyObjectives = perspective === 'attacker' 
    ? context.objectivesHeldByDefender 
    : context.objectivesHeldByAttacker;
  
  const myUnits = perspective === 'attacker' ? context.attackerUnits : context.defenderUnits;
  const enemyUnits = perspective === 'attacker' ? context.defenderUnits : context.attackerUnits;
  
  const myFaction = perspective === 'attacker' ? context.attackerFaction : context.defenderFaction;
  
  // Get secondary objectives for perspective
  const mySecondaries = perspective === 'attacker' 
    ? context.secondaryObjectives?.attacker 
    : context.secondaryObjectives?.defender;
  const enemySecondaries = perspective === 'attacker'
    ? context.secondaryObjectives?.defender
    : context.secondaryObjectives?.attacker;
  
  // Determine turn order context
  const iWentFirst = context.firstTurn === perspective;
  
  let prompt = `# Current Game State

## Phase & Turn
- **Current Phase**: ${context.phase}
- **Battle Round**: ${context.battleRound}
- **Active Turn**: ${isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
- **First Turn This Round**: ${iWentFirst ? "YOU" : "OPPONENT"} (${iWentFirst ? "you act first each round" : "opponent acts first each round"})

## Primary Mission
${context.primaryMission?.name ? `- **Mission**: ${context.primaryMission.name}
- **Deployment**: ${context.primaryMission.deploymentType}
- **Scoring**: ${context.primaryMission.scoringTiming}
- **Formula**: ${context.primaryMission.scoringFormula}
${context.primaryMission.specialRules ? `- **Special Rules**: ${context.primaryMission.specialRules}` : ''}` : '- **Mission**: Not selected (primary scoring tracked manually)'}

## Secondary Objectives
### Your Secondaries (${mySecondaries?.missionMode || 'tactical'} mode)
${mySecondaries?.active && mySecondaries.active.length > 0 
  ? mySecondaries.active.map(sec => {
      const progress = mySecondaries.progress[sec];
      const vpStr = progress ? ` - ${progress.vp}/20 VP` : '';
      return `- **${sec}**${vpStr}`;
    }).join('\n')
  : '- No active secondaries (draw in Command phase if tactical mode)'}
${mySecondaries?.discarded && mySecondaries.discarded.length > 0 
  ? `\n*Discarded: ${mySecondaries.discarded.join(', ')}*` 
  : ''}

### Opponent Secondaries
${enemySecondaries?.active && enemySecondaries.active.length > 0
  ? enemySecondaries.active.map(sec => {
      const progress = enemySecondaries.progress[sec];
      const vpStr = progress ? ` - ${progress.vp}/20 VP` : '';
      return `- **${sec}**${vpStr}`;
    }).join('\n')
  : '- Unknown or none selected'}

## Resources
- **Your CP**: ${myCP}
- **Opponent CP**: ${enemyCP}
- **VP Differential**: ${myVP - enemyVP > 0 ? '+' : ''}${myVP - enemyVP} (You: ${myVP}, Opponent: ${enemyVP})

## Objectives
- **You Control**: ${myObjectives} objectives
- **Opponent Controls**: ${enemyObjectives} objectives
- **Contested**: ${context.objectivesContested} objectives
${context.objectiveMarkers && context.objectiveMarkers.length > 0 ? `

### Objective Markers
${context.objectiveMarkers
  .slice()
  .sort((a, b) => a.objectiveNumber - b.objectiveNumber)
  .map(o => {
    const unit = o.controllingUnit ? ` (${o.controllingUnit})` : '';
    return `- Objective ${o.objectiveNumber}: ${o.controlledBy}${unit}`;
  })
  .join('\n')}` : ''}

## Your Army
- **Faction**: ${myFaction || 'Unknown'}`;

  if (perspective === 'attacker' && context.attackerDetachment) {
    prompt += `\n- **Detachment**: ${context.attackerDetachment}`;
  }
  
  if (context.detachmentAbility && perspective === 'attacker') {
    prompt += `\n- **Detachment Ability**: ${context.detachmentAbility.name} - ${context.detachmentAbility.description}`;
  }

  prompt += `\n\n### Your Units (${myUnits.filter(u => !u.isDestroyed).length} active)`;
  
  for (const unit of myUnits.filter(u => !u.isDestroyed)) {
    const statusFlags: string[] = [];
    if (unit.isBattleShocked) statusFlags.push('BATTLESHOCKED');
    if (unit.activeEffects.length > 0) statusFlags.push(...unit.activeEffects);
    if (unit.attachedToUnit) statusFlags.push(`attached to ${unit.attachedToUnit}`);
    
    prompt += `\n- **${unit.name}**: ${unit.currentModels}/${unit.startingModels} models, ${unit.healthPercentage}% health`;
    if (statusFlags.length > 0) {
      prompt += ` [${statusFlags.join(', ')}]`;
    }
    
    // Include key abilities (limit to avoid prompt bloat)
    const keyAbilities = unit.abilities
      .filter(a => a.type === 'unit' || a.type === 'leader' || a.type === 'faction')
      .slice(0, 3);
    
    if (keyAbilities.length > 0) {
      prompt += `\n  Abilities: ${keyAbilities.map(a => `${a.name} (${a.description.substring(0, 100)}...)`).join('; ')}`;
    }
  }
  
  prompt += `\n\n### Opponent Units (${enemyUnits.filter(u => !u.isDestroyed).length} active)`;
  
  for (const unit of enemyUnits.filter(u => !u.isDestroyed)) {
    prompt += `\n- **${unit.name}**: ${unit.currentModels}/${unit.startingModels} models, ${unit.healthPercentage}% health`;
    if (unit.isBattleShocked) {
      prompt += ` [BATTLESHOCKED]`;
    }
  }
  
  // Include available stratagems if we have CP
  if (context.availableStratagems.length > 0 && myCP > 0) {
    prompt += `\n\n### Available Stratagems (${context.phase} Phase)`;
    
    // Get stratagems used by this player this round
    const myRecentlyUsed = context.recentStratagems
      ?.filter(s => s.usedBy === perspective)
      .map(s => s.name.toLowerCase()) || [];
    
    const affordableStratagems = context.availableStratagems
      .filter(s => s.cpCost <= myCP)
      // Deprioritize recently used stratagems (they may have once-per-turn restrictions)
      .sort((a, b) => {
        const aUsed = myRecentlyUsed.includes(a.name.toLowerCase());
        const bUsed = myRecentlyUsed.includes(b.name.toLowerCase());
        if (aUsed && !bUsed) return 1;
        if (!aUsed && bUsed) return -1;
        return 0;
      });
    
    for (const strat of affordableStratagems.slice(0, 8)) {
      const usedNote = myRecentlyUsed.includes(strat.name.toLowerCase()) ? ' [USED THIS ROUND]' : '';
      prompt += `\n- **${strat.name}** (${strat.cpCost} CP)${usedNote}: ${strat.effect.substring(0, 150)}...`;
    }
  }
  
  // Include recent stratagem activity (important for knowing what's been used)
  if (context.recentStratagems && context.recentStratagems.length > 0) {
    prompt += `\n\n### Recent Stratagem Activity`;
    const recentThisRound = context.recentStratagems.slice(0, 6);
    for (const strat of recentThisRound) {
      const who = strat.usedBy === perspective ? 'You' : 'Opponent';
      const target = strat.targetUnit ? ` on ${strat.targetUnit}` : '';
      prompt += `\n- ${who} used **${strat.name}** (${strat.phase} phase)${target}`;
    }
    prompt += `\n*Note: Many stratagems have once-per-turn or once-per-phase restrictions.*`;
  }
  
  // Include full event log for complete game history context
  if (context.eventLog && context.eventLog.length > 0) {
    prompt += `\n\n### Game Event History (Chronological)`;
    prompt += `\n*Complete log of what has happened in this game:*\n`;
    
    for (const event of context.eventLog) {
      const time = new Date(event.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const phaseInfo = event.phase ? ` [${event.phase}]` : '';
      prompt += `\n- ${time}${phaseInfo}: ${event.description}`;
    }
  }
  
  // Add phase-specific rules reference from tactical reference
  const phaseRulesContext = getPhaseRulesContext(context.phase);
  
  // Add secondary-specific context for known secondaries
  const allSecondaryNames = [
    ...(mySecondaries?.active || []),
    ...(enemySecondaries?.active || [])
  ];
  const secondaryContext = getSecondaryContext(allSecondaryNames);
  
  // Add phase-specific guidance
  const phaseGuidance: Record<string, string> = {
    'Command': 'Command phase actions: Draw tactical secondaries, use detachment abilities, Battle-shock tests, score primaries (end of Command phase).',
    'Movement': 'Movement phase actions: Positioning, Advance declarations, Deep Strike arrivals, setting up charges.',
    'Shooting': 'Shooting phase actions: Target priority, stratagems like Fire Discipline/Overwatch, maximize damage output.',
    'Charge': 'Charge phase actions: Declare charges (within 12"), Overwatch responses, charge rolls, heroic interventions.',
    'Fight': 'Fight phase actions: Fight order (chargers first), pile-in moves, combat resolution, consolidation.'
  };
  
  prompt += `\n\n---`;
  
  // Include phase rules reference if available
  if (phaseRulesContext) {
    prompt += phaseRulesContext;
  }
  
  // Include secondary rules context if we have active secondaries
  if (secondaryContext) {
    prompt += `\n\n## Active Secondary Rules Reference${secondaryContext}`;
  }
  
  prompt += `\n\n**Phase Context**: ${phaseGuidance[context.phase] || 'Standard phase actions apply.'}

Provide tactical suggestions for the ${perspective.toUpperCase()} player based on this game state. Focus on the ${context.phase} phase. Consider:
- Secondary objective scoring opportunities
- Opponent's secondary objectives (what they're trying to score)
- Objective control and primary mission scoring timing
- Stratagem opportunities (avoid suggesting already-used stratagems)`;
  
  return prompt;
}

// ============================================
// RESPONSE PARSING
// ============================================

/**
 * Parse AI response into structured suggestions
 */
export function parseAIResponse(
  responseText: string,
  context: FullTacticalContext,
  perspective: 'attacker' | 'defender',
  detailLevel: 'quick' | 'detailed'
): TacticalAdviceResponse {
  try {
    // Strip markdown code fences if present
    let cleanedText = responseText;
    
    // Remove ```json and ``` markers
    cleanedText = cleanedText.replace(/^```json\s*/i, '');
    cleanedText = cleanedText.replace(/^```\s*/i, '');
    cleanedText = cleanedText.replace(/\s*```$/i, '');
    cleanedText = cleanedText.trim();
    
    // Try to extract JSON from the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Build unit directory (for client UI / icon lookups)
    const unitDirectory: TacticalAdviceResponse['unitDirectory'] = {};
    for (const u of [...context.attackerUnits, ...context.defenderUnits]) {
      unitDirectory[u.id] = {
        id: u.id,
        name: u.name,
        owner: u.owner,
        datasheet: u.datasheet,
        iconUrl: u.iconUrl || null,
        datasheetId: u.datasheetId || null,
      };
    }

    const normalize = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const findBestUnitIds = (unitNames: string[] | undefined): string[] | undefined => {
      if (!unitNames || unitNames.length === 0) return undefined;

      const allUnits = [...context.attackerUnits, ...context.defenderUnits];
      const results = new Set<string>();

      for (const rawName of unitNames) {
        const target = normalize(rawName);
        if (!target) continue;

        // Score candidates: exact > contains > partial
        let bestScore = 0;
        let bestIds: string[] = [];

        for (const u of allUnits) {
          const candName = normalize(u.name);
          const candDs = normalize(u.datasheet);

          let score = 0;
          if (candName === target || candDs === target) score = 3;
          else if (candName.includes(target) || target.includes(candName)) score = 2;
          else if (candDs.includes(target) || target.includes(candDs)) score = 2;
          else if (candName.startsWith(target) || candDs.startsWith(target)) score = 1;

          if (score > bestScore) {
            bestScore = score;
            bestIds = [u.id];
          } else if (score > 0 && score === bestScore) {
            bestIds.push(u.id);
          }
        }

        // If we found multiple at same score, keep up to 2 (avoid noisy mappings)
        bestIds.slice(0, 2).forEach((id) => results.add(id));
      }

      return results.size > 0 ? Array.from(results) : undefined;
    };

    // Validate and transform suggestions
    const suggestions: TacticalSuggestion[] = (parsed.suggestions || []).map(
      (s: any, index: number) => {
        const category = validateCategory(s.category);
        return {
          id: `suggestion-${index}-${Date.now()}`,
          priority: validatePriority(s.priority),
          category,
          title: s.title || 'Tactical Suggestion',
          description: s.description || '',
          reasoning: detailLevel === 'detailed' ? s.reasoning : undefined,
          relatedUnits: Array.isArray(s.relatedUnits) ? s.relatedUnits : undefined,
          relatedUnitIds: findBestUnitIds(Array.isArray(s.relatedUnits) ? s.relatedUnits : undefined),
          relatedRules: Array.isArray(s.relatedRules) ? s.relatedRules : undefined,
          cpCost: typeof s.cpCost === 'number' ? s.cpCost : undefined,
          // Mark opponent_threat suggestions as opponent plays
          isOpponentPlay: category === 'opponent_threat' || s.isOpponentPlay === true
        };
      }
    );
    
    const myCP = perspective === 'attacker' ? context.attackerCP : context.defenderCP;
    const vpDiff = perspective === 'attacker' 
      ? context.attackerVP - context.defenderVP
      : context.defenderVP - context.attackerVP;
    const myObjectives = perspective === 'attacker'
      ? context.objectivesHeldByAttacker
      : context.objectivesHeldByDefender;
    const myUnits = perspective === 'attacker' ? context.attackerUnits : context.defenderUnits;
    
    const tacticalContext: TacticalContext = {
      phase: context.phase,
      battleRound: context.battleRound,
      perspective,
      cpAvailable: myCP,
      vpDifferential: vpDiff,
      unitsAnalyzed: myUnits.filter(u => !u.isDestroyed).length,
      objectivesHeld: myObjectives
    };
    
    return {
      suggestions,
      context: tacticalContext,
      generatedAt: new Date().toISOString(),
      detailLevel,
      meta: {
        attackerFaction: context.attackerFaction,
        defenderFaction: context.defenderFaction,
        primaryMission: context.primaryMission ?? null,
        objectiveMarkers: context.objectiveMarkers || []
      },
      unitDirectory
    };
    
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', responseText);
    
    // Return a fallback response
    return {
      suggestions: [{
        id: 'fallback-1',
        priority: 'medium',
        category: 'threat',
        title: 'Analysis Unavailable',
        description: 'Unable to parse tactical suggestions. Please try again.',
      }],
      context: {
        phase: context.phase,
        battleRound: context.battleRound,
        perspective,
        cpAvailable: perspective === 'attacker' ? context.attackerCP : context.defenderCP,
        vpDifferential: 0,
        unitsAnalyzed: 0,
        objectivesHeld: 0
      },
      generatedAt: new Date().toISOString(),
      detailLevel
    };
  }
}

function validatePriority(priority: any): 'high' | 'medium' | 'low' {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority;
  }
  return 'medium';
}

function validateCategory(
  category: any
): 'positioning' | 'stratagem' | 'ability' | 'objective' | 'resource' | 'threat' | 'opponent_threat' {
  const valid = ['positioning', 'stratagem', 'ability', 'objective', 'resource', 'threat', 'opponent_threat'];
  if (valid.includes(category)) {
    return category;
  }
  return 'ability';
}

