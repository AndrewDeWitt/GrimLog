/**
 * Phase Relevance Helpers
 * 
 * Determines which abilities, stratagems, and wargear are relevant
 * to the current game phase for contextual display
 */

export type GamePhase = 'Command' | 'Movement' | 'Shooting' | 'Charge' | 'Fight' | 'Any';

export interface PhaseRelevantAction {
  name: string;
  type: 'ability' | 'stratagem' | 'wargear';
  icon: string;
  description: string;
  phases: GamePhase[];
  cpCost?: number;
}

/**
 * Get icon for action type
 */
export function getActionIcon(type: string): string {
  switch (type) {
    case 'ability':
      return '✦';
    case 'stratagem':
      return '◆';
    case 'wargear':
      return '⚙';
    default:
      return '●';
  }
}

/**
 * Determine if an action is relevant to the current phase
 */
export function isActionRelevantToPhase(
  action: PhaseRelevantAction,
  currentPhase: GamePhase
): boolean {
  // "Any" phase actions are always relevant
  if (action.phases.includes('Any')) return true;
  
  // Check if current phase is in the action's phase list
  return action.phases.includes(currentPhase);
}

/**
 * Filter actions by current phase and return top 2-3 most relevant
 */
export function getTopPhaseActions(
  actions: PhaseRelevantAction[],
  currentPhase: GamePhase,
  limit: number = 3
): PhaseRelevantAction[] {
  const relevantActions = actions.filter(action => 
    isActionRelevantToPhase(action, currentPhase)
  );
  
  // Prioritize: stratagems first, then abilities, then wargear
  const prioritized = relevantActions.sort((a, b) => {
    const priority = { stratagem: 0, ability: 1, wargear: 2 };
    return priority[a.type] - priority[b.type];
  });
  
  return prioritized.slice(0, limit);
}

/**
 * Mock function - would normally query datasheet API
 * Returns common actions for demonstration
 */
export function getUnitActions(datasheet: string): PhaseRelevantAction[] {
  const lower = datasheet.toLowerCase();
  
  // Common tactical actions available to most units
  const commonActions: PhaseRelevantAction[] = [];
  
  // Shooting phase actions
  if (lower.includes('intercessor') || lower.includes('tactical') || lower.includes('marine')) {
    commonActions.push({
      name: 'Rapid Fire',
      type: 'wargear',
      icon: '🎯',
      description: 'Double shots at half range',
      phases: ['Shooting']
    });
    commonActions.push({
      name: 'Bolter Discipline',
      type: 'stratagem',
      icon: '◆',
      description: 'Rapid Fire at full range if stationary',
      phases: ['Shooting'],
      cpCost: 1
    });
  }
  
  // Movement phase actions
  commonActions.push({
    name: 'Advance',
    type: 'ability',
    icon: '✦',
    description: 'Move extra distance (no shooting)',
    phases: ['Movement']
  });
  
  // Charge phase actions
  commonActions.push({
    name: 'Heroic Intervention',
    type: 'ability',
    icon: '✦',
    description: 'Move towards enemy in their turn',
    phases: ['Charge']
  });
  
  // Command phase actions
  commonActions.push({
    name: 'Battleshock Test',
    type: 'ability',
    icon: '⚡',
    description: 'Test if below half strength',
    phases: ['Command']
  });
  
  // Character-specific actions
  if (lower.includes('captain') || lower.includes('lieutenant') || lower.includes('commander')) {
    commonActions.push({
      name: 'Rites of Battle',
      type: 'ability',
      icon: '⭐',
      description: 'Re-roll hit rolls of 1',
      phases: ['Any']
    });
    commonActions.push({
      name: 'Tactical Precision',
      type: 'ability',
      icon: '⭐',
      description: 'Re-roll wound rolls of 1',
      phases: ['Shooting', 'Fight']
    });
  }
  
  // Melee units
  if (lower.includes('assault') || lower.includes('terminator') || lower.includes('bladeguard')) {
    commonActions.push({
      name: 'Shock Assault',
      type: 'ability',
      icon: '⚔',
      description: '+1 attack when charging',
      phases: ['Fight']
    });
    commonActions.push({
      name: 'Counter-Offensive',
      type: 'stratagem',
      icon: '◆',
      description: 'Fight after enemy unit',
      phases: ['Fight'],
      cpCost: 2
    });
  }
  
  // Tyranid-specific
  if (lower.includes('tyranid') || lower.includes('gaunt') || lower.includes('hive')) {
    commonActions.push({
      name: 'Synapse',
      type: 'ability',
      icon: '🧠',
      description: 'Ignore Battleshock within range',
      phases: ['Command']
    });
    commonActions.push({
      name: 'Voracious Appetite',
      type: 'stratagem',
      icon: '◆',
      description: 'Re-roll charges',
      phases: ['Charge'],
      cpCost: 1
    });
  }
  
  return commonActions;
}

