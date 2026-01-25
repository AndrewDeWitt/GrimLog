/**
 * Mission Rules Engine
 * 
 * Handles primary mission scoring, mission context, and VP calculations.
 */

import { prisma } from './prisma';

// ============================================
// Types
// ============================================

export interface MissionScoringResult {
  canScore: boolean;
  vp: number;
  formula: string;
  explanation: string;
  objectivesHeld?: number;
}

export interface MissionContext {
  missionId: string | null;
  missionName: string | null;
  deploymentType: string | null;
  scoringPhase: string | null;
  scoringTiming: string | null;
  scoringFormula: string | null;
  maxVP: number;
  specialRules: string | null;
}

// ============================================
// Mission Loading
// ============================================

/**
 * Get mission rules for a game session
 */
export async function getMissionRules(
  sessionId: string
): Promise<MissionContext | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      primaryMission: true
    }
  });
  
  if (!session || !session.primaryMission) {
    return null;
  }
  
  const mission = session.primaryMission;
  
  return {
    missionId: mission.id,
    missionName: mission.name,
    deploymentType: mission.deploymentType,
    scoringPhase: mission.scoringPhase,
    scoringTiming: mission.scoringTiming,
    scoringFormula: mission.scoringFormula,
    maxVP: mission.maxVP,
    specialRules: mission.specialRules
  };
}

/**
 * Get mission by ID
 */
export async function getMissionById(
  missionId: string
): Promise<MissionContext | null> {
  const mission = await prisma.primaryMission.findUnique({
    where: { id: missionId }
  });
  
  if (!mission) return null;
  
  return {
    missionId: mission.id,
    missionName: mission.name,
    deploymentType: mission.deploymentType,
    scoringPhase: mission.scoringPhase,
    scoringTiming: mission.scoringTiming,
    scoringFormula: mission.scoringFormula,
    maxVP: mission.maxVP,
    specialRules: mission.specialRules
  };
}

/**
 * Get all available missions
 */
export async function getAllMissions(): Promise<MissionContext[]> {
  const missions = await prisma.primaryMission.findMany({
    orderBy: { name: 'asc' }
  });
  
  return missions.map(m => ({
    missionId: m.id,
    missionName: m.name,
    deploymentType: m.deploymentType,
    scoringPhase: m.scoringPhase,
    scoringTiming: m.scoringTiming,
    scoringFormula: m.scoringFormula,
    maxVP: m.maxVP,
    specialRules: m.specialRules
  }));
}

// ============================================
// Mission Scoring
// ============================================

/**
 * Check if current phase/timing allows primary scoring
 */
export function checkScoringOpportunity(
  currentPhase: string,
  mission: MissionContext
): boolean {
  if (!mission || !mission.scoringPhase) return false;
  
  // Check if we're in the correct phase for scoring
  return mission.scoringPhase === currentPhase ||
         mission.scoringPhase === 'Any' ||
         mission.scoringPhase === 'End of Turn';
}

/**
 * Calculate primary VP based on mission formula and objectives held
 */
export async function calculatePrimaryVP(
  sessionId: string,
  player: "attacker" | "defender",
  mission: MissionContext
): Promise<MissionScoringResult> {
  if (!mission || !mission.scoringFormula) {
    return {
      canScore: false,
      vp: 0,
      formula: 'No mission selected',
      explanation: 'Please select a primary mission for this game'
    };
  }
  
  // Get objectives controlled by this player
  const objectives = await prisma.objectiveMarker.findMany({
    where: {
      gameSessionId: sessionId,
      controlledBy: player
    }
  });
  
  const objectivesHeld = objectives.length;
  
  // Parse and evaluate formula
  const vp = evaluateScoringFormula(
    mission.scoringFormula,
    objectivesHeld,
    mission
  );
  
  return {
    canScore: true,
    vp,
    formula: mission.scoringFormula,
    explanation: `${objectivesHeld} objectives controlled → ${vp} VP (${mission.scoringFormula})`,
    objectivesHeld
  };
}

/**
 * Evaluate scoring formula
 * Examples:
 * - "objectives_controlled * 5" -> 3 objectives = 15 VP
 * - "10 VP if center + 2 in your half" -> complex condition
 */
function evaluateScoringFormula(
  formula: string,
  objectivesHeld: number,
  mission: MissionContext
): number {
  const formulaLower = formula.toLowerCase();
  
  // Simple multiplication: "objectives_controlled * 5"
  const multiplyMatch = formula.match(/objectives_controlled\s*\*\s*(\d+)/i);
  if (multiplyMatch) {
    const multiplier = parseInt(multiplyMatch[1]);
    return objectivesHeld * multiplier;
  }
  
  // Fixed VP per objective: "5 VP per objective"
  const perObjectiveMatch = formula.match(/(\d+)\s*vp\s+per\s+objective/i);
  if (perObjectiveMatch) {
    const vpPerObjective = parseInt(perObjectiveMatch[1]);
    return objectivesHeld * vpPerObjective;
  }
  
  // Conditional scoring: "10 VP if 3+"
  const conditionalMatch = formula.match(/(\d+)\s*vp\s+if\s+(\d+)\+?/i);
  if (conditionalMatch) {
    const vp = parseInt(conditionalMatch[1]);
    const threshold = parseInt(conditionalMatch[2]);
    return objectivesHeld >= threshold ? vp : 0;
  }
  
  // Range-based scoring: "5 VP for 1-2, 10 VP for 3-4, 15 VP for 5-6"
  const rangeScoringRegex = /(\d+)\s*vp\s+for\s+(\d+)-(\d+)/gi;
  let match;
  while ((match = rangeScoringRegex.exec(formula)) !== null) {
    const vp = parseInt(match[1]);
    const min = parseInt(match[2]);
    const max = parseInt(match[3]);
    if (objectivesHeld >= min && objectivesHeld <= max) {
      return vp;
    }
  }
  
  // Default: 5 VP per objective (standard)
  console.warn(`Could not parse formula: ${formula}. Using default 5 VP per objective.`);
  return objectivesHeld * 5;
}

/**
 * Track primary VP scored by round
 */
export async function trackPrimaryVPScored(
  sessionId: string,
  player: "attacker" | "defender",
  vp: number,
  currentRound: number
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      primaryVPScored: true,
      attackerVictoryPoints: true,
      defenderVictoryPoints: true
    }
  });
  
  if (!session) return;
  
  // Update VP scored tracking
  const vpScored = (session.primaryVPScored as any) || { attacker: {}, defender: {} };
  
  if (!vpScored[player]) {
    vpScored[player] = {};
  }
  
  vpScored[player][currentRound] = vp;
  
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      primaryVPScored: vpScored
    }
  });
}

/**
 * Get primary VP summary
 */
export async function getPrimaryVPSummary(
  sessionId: string
): Promise<string> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      primaryVPScored: true,
      attackerVictoryPoints: true,
      defenderVictoryPoints: true,
      primaryMission: true
    }
  });
  
  if (!session || !session.primaryMission) {
    return 'No mission selected';
  }
  
  const vpScored = (session.primaryVPScored as any) || { attacker: {}, defender: {} };
  
  const attackerRounds = Object.keys(vpScored.attacker || {}).map(r => 
    `R${r}: ${vpScored.attacker[r]} VP`
  );
  const defenderRounds = Object.keys(vpScored.defender || {}).map(r => 
    `R${r}: ${vpScored.defender[r]} VP`
  );
  
  return `
Mission: ${session.primaryMission.name}

Attacker Primary: ${session.attackerVictoryPoints} VP
${attackerRounds.length > 0 ? attackerRounds.join(', ') : 'Not scored yet'}

Defender Primary: ${session.defenderVictoryPoints} VP
${defenderRounds.length > 0 ? defenderRounds.join(', ') : 'Not scored yet'}
`.trim();
}

// ============================================
// Mission Context Formatting
// ============================================

/**
 * Format mission context for AI prompts
 */
export function formatMissionPrompt(mission: MissionContext | null): string {
  if (!mission || !mission.missionName) {
    return `
=== PRIMARY MISSION ===
No mission selected for this game.
Primary VP will be tracked manually.
`;
  }
  
  return `
=== PRIMARY MISSION ===
Mission: ${mission.missionName}
Deployment: ${mission.deploymentType}

Scoring Rules:
- When: ${mission.scoringTiming}
- Formula: ${mission.scoringFormula}
- Max VP: ${mission.maxVP}

${mission.specialRules ? `Special Rules:\n${mission.specialRules}\n` : ''}

Use check_primary_scoring tool to calculate available VP based on objectives held.
`;
}


