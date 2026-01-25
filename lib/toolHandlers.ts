// Tool Execution Handlers
// These functions execute AI tool calls by updating the database

import { prisma } from './prisma';
import { ToolExecutionResult } from './types';
import { findBestUnitMatch } from './unitMatching';
import {
  ChangePhaseArgs,
  ChangePlayerTurnArgs,
  AdvanceBattleRoundArgs,
  LogStratagemArgs,
  UpdateCommandPointsArgs,
  UpdateVictoryPointsArgs,
  UpdateObjectiveControlArgs,
  LogUnitActionArgs,
  LogCombatResultArgs,
  QueryGameStateArgs,
  SetSecondaryObjectivesArgs,
  RedrawSecondaryObjectiveArgs,
  UpdateUnitHealthArgs,
  MarkUnitDestroyedArgs,
  UpdateUnitStatusArgs,
  GetStrategicAdviceArgs,
  ScoreAssassinationArgs,
  ScoreBringItDownArgs,
  ScoreNoPrisonersArgs,
  ScoreMarkedForDeathArgs,
  ScoreCullTheHordeArgs,
  ScoreOverwhelmingForceArgs,
  ValidateCPTransactionArgs,
  CheckPrimaryScoringArgs,
  RevertEventArgs,
  EstimateDamageArgs,
} from './aiTools';
import { getRelevantRules } from './strategicAssistant';
import { 
  checkSecondaryActive, 
  getCurrentSecondaryVP, 
  validateSecondaryScoring,
  validateScoringAttempt,
  updateSecondaryProgress as updateSecondaryProgressHelper,
  calculateVP,
  getSecondaryData,
  getScoringOptions,
  type MissionMode
} from './secondaryRules';
import {
  validateCPGain,
  validateCPSpend,
  logCPTransaction,
  validatePhaseTransition as validatePhaseTransitionHelper,
  checkBattleShockRequired as checkBattleShockRequiredHelper,
  validateStratagemUsage as validateStratagemUsageHelper
} from './validationRules';
import {
  getMissionRules,
  checkScoringOpportunity,
  calculatePrimaryVP,
  trackPrimaryVPScored
} from './missionRules';
import {
  fetchGameContext,
  validateStratagemUse,
  validatePhaseTransition,
  validateCommandPointChange,
  validateRoundAdvancement,
} from './validationHelpers';
import { invalidateCachePattern } from './requestCache';
import { getNextTurn, getPreviousTurn, getSpecificTurn, willAdvanceRound } from './turnHelpers';
import { 
  calculateDamage, 
  parseDiceAverage, 
  AttackerProfile, 
  DefenderProfile, 
  WeaponAbility as DamageWeaponAbility,
  Modifiers
} from './damageCalculation';
import {
  getEligibleWeapons,
  findBestWeapon,
  findWeaponByName,
  formatWeaponProfile,
} from './weaponRulesEngine';
import { CombatPhase, WeaponEligibilityInput, WeaponProfile } from './types';

// Interface for manual turn navigation
interface ChangeTurnArgs {
  direction: 'next' | 'previous' | 'specific';
  round?: number; // Required for 'specific' direction
  player_turn?: 'attacker' | 'defender'; // Required for 'specific' direction
}

/**
 * Invalidate relevant caches after tool execution
 */
function invalidateSessionCaches(sessionId: string, invalidateUnits: boolean = false): void {
  // Always invalidate session data (phase, CP, VP, etc.)
  invalidateCachePattern(`/api/sessions/${sessionId}`);
  
  // Also invalidate session events endpoint
  invalidateCachePattern(`/api/sessions/${sessionId}/events`);
  
  // Invalidate units if needed (health updates, status changes, destroyed)
  if (invalidateUnits) {
    invalidateCachePattern(`/api/sessions/${sessionId}/units`);
  }
  
  console.log(`♻️ Cache invalidated for session ${sessionId}${invalidateUnits ? ' (including units)' : ''}`);
}

/**
 * Execute a tool call based on the function name and arguments
 */
export async function executeToolCall(
  functionName: string,
  args: any,
  sessionId: string,
  customTimestamp?: Date // Optional: Use specific timestamp for this event
): Promise<ToolExecutionResult> {
  try {
    switch (functionName) {
      case 'change_phase':
        return await changePhase(args as ChangePhaseArgs, sessionId, customTimestamp);
      
      case 'change_turn':
        return await changeTurn(args as ChangeTurnArgs, sessionId, customTimestamp);
      
      case 'change_player_turn':
        return await changePlayerTurn(args as ChangePlayerTurnArgs, sessionId, customTimestamp);
      
      case 'advance_battle_round':
        return await advanceBattleRound(args as AdvanceBattleRoundArgs, sessionId, customTimestamp);
      
      case 'log_stratagem_use':
        return await logStratagemUse(args as LogStratagemArgs, sessionId, customTimestamp);
      
      case 'update_command_points':
        return await updateCommandPoints(args as UpdateCommandPointsArgs, sessionId, customTimestamp);
      
      case 'update_victory_points':
        return await updateVictoryPoints(args as UpdateVictoryPointsArgs, sessionId, customTimestamp);
      
      case 'update_objective_control':
        return await updateObjectiveControl(args as UpdateObjectiveControlArgs, sessionId, customTimestamp);
      
      case 'log_unit_action':
        return await logUnitAction(args as LogUnitActionArgs, sessionId, customTimestamp);
      
      case 'log_combat_result':
        return await logCombatResult(args as LogCombatResultArgs, sessionId, customTimestamp);
      
      case 'query_game_state':
        return await queryGameState(args as QueryGameStateArgs, sessionId);
      
      case 'set_secondary_objectives':
        return await setSecondaryObjectives(args as SetSecondaryObjectivesArgs, sessionId, customTimestamp);
      
      case 'redraw_secondary_objective':
        return await redrawSecondaryObjective(args as RedrawSecondaryObjectiveArgs, sessionId, customTimestamp);
      
      case 'score_secondary_vp':
        return await scoreSecondaryVP(args as any, sessionId, customTimestamp);
      
      case 'score_assassination':
        return await scoreAssassination(args as any, sessionId, customTimestamp);
      
      case 'score_bring_it_down':
        return await scoreBringItDown(args as any, sessionId, customTimestamp);
      
      case 'score_marked_for_death':
        return await scoreMarkedForDeath(args as any, sessionId, customTimestamp);
      
      case 'score_no_prisoners':
        return await scoreNoPrisoners(args as any, sessionId, customTimestamp);
      
      case 'score_cull_the_horde':
        return await scoreCullTheHorde(args as any, sessionId, customTimestamp);
      
      case 'score_overwhelming_force':
        return await scoreOverwhelmingForce(args as any, sessionId, customTimestamp);
      
      case 'update_unit_health':
        return await updateUnitHealth(args as UpdateUnitHealthArgs, sessionId, customTimestamp);
      
      case 'mark_unit_destroyed':
        return await markUnitDestroyed(args as MarkUnitDestroyedArgs, sessionId, customTimestamp);
      
      case 'update_unit_status':
        return await updateUnitStatus(args as UpdateUnitStatusArgs, sessionId, customTimestamp);
      
      case 'get_strategic_advice':
        return await getStrategicAdvice(args as GetStrategicAdviceArgs, sessionId);
      
      case 'validate_cp_transaction':
        return await validateCPTransaction(args as any, sessionId, customTimestamp);
      
      case 'check_primary_scoring':
        return await checkPrimaryScoring(args as any, sessionId, customTimestamp);
      
      case 'revert_event':
        return await revertEvent(args as RevertEventArgs, sessionId, customTimestamp);
        
      case 'estimate_damage':
        return await estimateDamage(args as EstimateDamageArgs, sessionId);
      
      default:
        return {
          toolName: functionName,
          success: false,
          message: `Unknown tool: ${functionName}`
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${functionName}:`, error);
    return {
      toolName: functionName,
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Estimate average damage between units
 */
/**
 * Estimate damage between units using the Weapon Rules Engine
 * 
 * This refactored version:
 * 1. Uses phase-aware weapon selection (ranged for Shooting, melee for Fight)
 * 2. Properly separates unit names from weapon names
 * 3. Handles weapon profile groups (e.g., "Axe Morkai — strike/sweep")
 * 4. Supports all combat modifiers from voice commands
 */
async function estimateDamage(args: EstimateDamageArgs, sessionId: string): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      currentPhase: true,
    }
  });

  if (!session) {
    return {
      toolName: 'estimate_damage',
      success: false,
      message: 'Session not found'
    };
  }

  // Determine combat phase for weapon selection
  const currentPhase = session.currentPhase;
  const combatPhase: CombatPhase = currentPhase === 'Fight' ? 'Fight' : 'Shooting';

  // 1. Find Attacker Unit
  const attackerMatch = await findBestUnitMatch(
    args.attacker_name,
    args.attacker_owner,
    sessionId,
    true // strict
  );

  if (!attackerMatch.success || !attackerMatch.unit?.fullDatasheet) {
    return {
      toolName: 'estimate_damage',
      success: false,
      message: `Attacker unit "${args.attacker_name}" not found. Make sure to use the UNIT name (e.g., "Terminators"), not a weapon name.`
    };
  }
  const attackerUnit = attackerMatch.unit;
  const attackerDatasheet = attackerUnit.fullDatasheet!;

  // 2. Find Defender Unit
  const defenderOwner = args.attacker_owner === 'attacker' ? 'defender' : 'attacker';
  const defenderMatch = await findBestUnitMatch(
    args.defender_name,
    defenderOwner as 'attacker' | 'defender',
    sessionId,
    true
  );

  if (!defenderMatch.success || !defenderMatch.unit?.fullDatasheet) {
    return {
      toolName: 'estimate_damage',
      success: false,
      message: `Defender unit "${args.defender_name}" not found. Make sure to use the UNIT name (e.g., "Hormagaunts"), not a weapon name.`
    };
  }
  const defenderUnit = defenderMatch.unit;
  const defenderDatasheet = defenderUnit.fullDatasheet!;

  // 3. Get all weapons from the attacker's datasheet
  const weapons = await prisma.datasheetWeapon.findMany({
    where: { datasheetId: attackerDatasheet.id },
    include: { weapon: true }
  });

  if (weapons.length === 0) {
    return {
      toolName: 'estimate_damage',
      success: false,
      message: `No weapons found for ${attackerUnit.unitName}`
    };
  }

  // 4. Use Weapon Rules Engine to get eligible weapons for this phase
  const modelCount = attackerUnit.currentModels || 1;
  
  // Parse attacker keywords for MONSTER/VEHICLE check
  let attackerKeywords: string[] = [];
  try {
    attackerKeywords = JSON.parse(attackerDatasheet.keywords || '[]');
  } catch (e) { /* ignore */ }

  // Parse defender keywords for Anti-X checking
  let defenderKeywords: string[] = [];
  try {
    defenderKeywords = JSON.parse(defenderDatasheet.keywords || '[]');
  } catch (e) { /* ignore */ }

  const weaponInput: WeaponEligibilityInput = {
    phase: combatPhase,
    weapons: weapons.map(w => ({
      weapon: w.weapon,
      quantity: w.quantity,
      isDefault: w.isDefault,
    })),
    modelCount,
    defenderKeywords,
    unitKeywords: attackerKeywords,
    isRapidFireRange: false, // Could be passed as a modifier
    targetModelCount: defenderUnit.currentModels || 1,
    charged: args.modifiers?.lance || false,
  };

  const eligibleWeapons = getEligibleWeapons(weaponInput);

  // Check we have weapons to calculate
  if (eligibleWeapons.primaryWeapons.length === 0) {
    return {
      toolName: 'estimate_damage',
      success: false,
      message: `No ${combatPhase === 'Fight' ? 'melee' : 'ranged'} weapons available for ${attackerUnit.unitName} in ${combatPhase} phase`
    };
  }

  // 5. Build defender profile (needed for all calculations)
  const defenderProfile: DefenderProfile = {
    toughness: defenderDatasheet.toughness,
    save: defenderDatasheet.save,
    invuln: defenderDatasheet.invulnerableSave || undefined,
    wounds: defenderUnit.woundsPerModel || defenderDatasheet.wounds,
    modelCount: defenderUnit.currentModels || 1,
  };

  // 6. Build modifiers from args
  const baseModifiers: Modifiers = {
    ...args.modifiers,
  };
  
  // Build modifiers list for display
  const modifiersList: string[] = [];
  if (baseModifiers.reroll_hits) modifiersList.push(`Reroll ${baseModifiers.reroll_hits} to hit`);
  if (baseModifiers.reroll_wounds) modifiersList.push(`Reroll ${baseModifiers.reroll_wounds} to wound`);
  if (baseModifiers.plus_to_hit) modifiersList.push(`${baseModifiers.plus_to_hit > 0 ? '+' : ''}${baseModifiers.plus_to_hit} to hit`);
  if (baseModifiers.plus_to_wound) modifiersList.push(`${baseModifiers.plus_to_wound > 0 ? '+' : ''}${baseModifiers.plus_to_wound} to wound`);
  if (baseModifiers.cover) modifiersList.push('Cover');
  if (baseModifiers.lance) modifiersList.push('Lance (+1 to wound)');
  if (baseModifiers.lethal_hits) modifiersList.push('Lethal Hits');
  if (baseModifiers.sustained_hits) modifiersList.push(`Sustained Hits ${baseModifiers.sustained_hits}`);
  if (baseModifiers.devastating_wounds) modifiersList.push('Devastating Wounds');

  // Helper function to calculate damage for a weapon
  const calculateWeaponDamage = (weapon: WeaponProfile) => {
    const weaponAbilities: DamageWeaponAbility[] = weapon.abilities.map(a => ({
      kind: a.kind,
      value: a.value,
      condition: a.condition,
      targetKeyword: a.targetKeyword,
    }));

    const weaponModifiers: Modifiers = {
      ...baseModifiers,
      anti_keyword_active: baseModifiers.anti_keyword_active ?? checkAntiKeywordMatch(weaponAbilities, defenderKeywords),
    };

    const attackerProfile: AttackerProfile = {
      bs_ws: (weapon.type === 'melee' ? weapon.weaponSkill : weapon.ballisticSkill) || "4+",
      strength: weapon.strength,
      ap: weapon.ap,
      damage: weapon.damage,
      attacks: weapon.attacksAverage,
      abilities: weaponAbilities
    };

    return calculateDamage(attackerProfile, defenderProfile, weaponModifiers);
  };

  // 7. Calculate damage for ALL primary weapons
  type WeaponResult = {
    weapon: WeaponProfile;
    result: ReturnType<typeof calculateDamage>;
    isExtraAttacks: boolean;
  };
  
  const allWeaponResults: WeaponResult[] = [];
  
  // If user specified a weapon, only calculate that one
  if (args.weapon_name) {
    const specifiedWeapon = findWeaponByName(eligibleWeapons.weapons, args.weapon_name) ||
      findWeaponByName(eligibleWeapons.primaryWeapons, args.weapon_name);
    
    if (!specifiedWeapon) {
      return {
        toolName: 'estimate_damage',
        success: false,
        message: `Weapon "${args.weapon_name}" not found for ${attackerUnit.unitName}. Available weapons: ${eligibleWeapons.primaryWeapons.map(w => w.name).join(', ')}`
      };
    }
    
    allWeaponResults.push({
      weapon: specifiedWeapon,
      result: calculateWeaponDamage(specifiedWeapon),
      isExtraAttacks: false,
    });
  } else {
    // Calculate ALL primary weapons for comparison
    for (const weapon of eligibleWeapons.primaryWeapons) {
      allWeaponResults.push({
        weapon,
        result: calculateWeaponDamage(weapon),
        isExtraAttacks: false,
      });
    }
  }

  // 8. Calculate EXTRA ATTACKS weapons (Fight phase only)
  // These are added IN ADDITION to any primary weapon choice
  const extraAttacksResults: WeaponResult[] = [];
  
  if (combatPhase === 'Fight' && eligibleWeapons.extraAttackWeapons.length > 0) {
    for (const extraWeapon of eligibleWeapons.extraAttackWeapons) {
      extraAttacksResults.push({
        weapon: extraWeapon,
        result: calculateWeaponDamage(extraWeapon),
        isExtraAttacks: true,
      });
    }
  }

  // Calculate extra attacks total (applies to ALL primary weapon choices)
  const extraAttacksDamage = extraAttacksResults.reduce((sum, er) => sum + er.result.expected_damage, 0);
  const extraAttacksKills = extraAttacksResults.reduce((sum, er) => sum + er.result.models_killed, 0);
  const extraAttacksHits = extraAttacksResults.reduce((sum, er) => sum + er.result.expected_hits, 0);
  const extraAttacksWounds = extraAttacksResults.reduce((sum, er) => sum + er.result.expected_wounds, 0);
  const extraAttacksUnsaved = extraAttacksResults.reduce((sum, er) => sum + er.result.expected_unsaved, 0);

  // 9. Find best weapon (for summary) - highest damage + extra attacks
  const bestWeaponResult = allWeaponResults.reduce((best, current) => {
    const currentTotal = current.result.expected_damage + extraAttacksDamage;
    const bestTotal = best.result.expected_damage + extraAttacksDamage;
    return currentTotal > bestTotal ? current : best;
  });

  // 10. Format output - show comparison of all weapons
  const modifiersStr = modifiersList.length > 0 ? `\nModifiers: ${modifiersList.join(', ')}` : '';
  
  // Build weapon comparison strings
  const weaponComparisonLines = allWeaponResults.map(wr => {
    const totalDmg = wr.result.expected_damage + extraAttacksDamage;
    const totalKills = wr.result.models_killed + extraAttacksKills;
    const isBest = wr.weapon.id === bestWeaponResult.weapon.id;
    return `• ${wr.weapon.name}: **${totalDmg.toFixed(1)} dmg** / ${totalKills.toFixed(1)} kills${isBest && allWeaponResults.length > 1 ? ' ⭐' : ''}`;
  });

  // Build extra attacks info
  let extraAttacksStr = '';
  if (extraAttacksResults.length > 0) {
    const extraInfo = extraAttacksResults.map(ea => 
      `${ea.weapon.name}: ${ea.result.expected_damage.toFixed(1)} dmg`
    ).join(', ');
    extraAttacksStr = `\n**+ Extra Attacks:** ${extraInfo}`;
  }

  const summary = `
**${attackerUnit.unitName}** (${modelCount} models) vs **${defenderUnit.unitName}**
Phase: ${combatPhase}${extraAttacksStr}${modifiersStr}

**Weapon Comparison${extraAttacksResults.length > 0 ? ' (includes extra attacks)' : ''}:**
${weaponComparisonLines.join('\n')}

**Best Choice: ${bestWeaponResult.weapon.name}**
• Hits: ${(bestWeaponResult.result.expected_hits + extraAttacksHits).toFixed(1)}
• Wounds: ${(bestWeaponResult.result.expected_wounds + extraAttacksWounds).toFixed(1)}
• Unsaved: ${(bestWeaponResult.result.expected_unsaved + extraAttacksUnsaved).toFixed(1)}
  `.trim();

  // Build all weapon stats for data output
  const allWeaponStats = allWeaponResults.map(wr => ({
    weapon: wr.weapon.name,
    weaponStats: `S:${wr.weapon.strength} AP:${wr.weapon.ap} D:${wr.weapon.damageRaw}`,
    attacks: wr.weapon.attacksAverage,
    skill: (wr.weapon.type === 'melee' ? wr.weapon.weaponSkill : wr.weapon.ballisticSkill) || "4+",
    stats: {
      expected_hits: wr.result.expected_hits + extraAttacksHits,
      expected_wounds: wr.result.expected_wounds + extraAttacksWounds,
      expected_unsaved: wr.result.expected_unsaved + extraAttacksUnsaved,
      expected_damage: wr.result.expected_damage + extraAttacksDamage,
      models_killed: wr.result.models_killed + extraAttacksKills,
      mortal_wounds: wr.result.mortal_wounds,
      hit_rate: wr.result.hit_rate,
      wound_rate: wr.result.wound_rate,
      save_rate: wr.result.save_rate,
      crit_hit_chance: wr.result.crit_hit_chance,
      crit_wound_chance: wr.result.crit_wound_chance,
    },
    // Also include the weapon-only stats (without extra attacks) for breakdown
    weaponOnlyDamage: wr.result.expected_damage,
    weaponOnlyKills: wr.result.models_killed,
  }));

  // Use best weapon's stats as the main stats (for backwards compatibility)
  const bestStats = allWeaponStats.find(ws => ws.weapon === bestWeaponResult.weapon.name)?.stats || allWeaponStats[0].stats;

  return {
    toolName: 'estimate_damage',
    success: true,
    message: summary,
    data: {
      attacker: attackerUnit.unitName,
      defender: defenderUnit.unitName,
      weapon: bestWeaponResult.weapon.name, // Best weapon for quick reference
      phase: combatPhase,
      modifiers: modifiersList,
      stats: bestStats, // Best weapon's stats (includes extra attacks)
      // NEW: All weapons comparison
      allWeapons: allWeaponStats,
      // Extra attacks breakdown
      extraAttacks: extraAttacksResults.length > 0 ? extraAttacksResults.map(ea => ({
        weapon: ea.weapon.name,
        damage: ea.result.expected_damage,
        kills: ea.result.models_killed,
        attacks: ea.weapon.attacksAverage,
        stats: `S:${ea.weapon.strength} AP:${ea.weapon.ap} D:${ea.weapon.damageRaw}`,
      })) : undefined,
    }
  };
}

/**
 * Check if any Anti-X ability matches the defender's keywords
 */
function checkAntiKeywordMatch(abilities: DamageWeaponAbility[], defenderKeywords: string[]): boolean {
  const normalizedDefenderKeywords = defenderKeywords.map(k => k.toUpperCase());
  
  for (const ability of abilities) {
    if (ability.kind === 'ANTI' && ability.targetKeyword) {
      if (normalizedDefenderKeywords.includes(ability.targetKeyword.toUpperCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Smart turn navigation - handles next/previous/specific turn changes with automatic round advancement
 */
async function changeTurn(args: ChangeTurnArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Fetch current session state
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      battleRound: true,
      currentTurn: true,
      currentPhase: true,
      firstTurn: true
    }
  });

  if (!session) {
    return {
      toolName: 'change_turn',
      success: false,
      message: 'Session not found'
    };
  }

  // Calculate new turn state based on direction
  let newState;
  const sessionData = {
    battleRound: session.battleRound,
    currentTurn: session.currentTurn,
    currentPhase: session.currentPhase,
    firstTurn: session.firstTurn || 'player'
  };

  if (args.direction === 'specific') {
    if (args.round === undefined || !args.player_turn) {
      return {
        toolName: 'change_turn',
        success: false,
        message: 'Round and player_turn required for specific direction'
      };
    }
    newState = getSpecificTurn(args.round, args.player_turn);
  } else if (args.direction === 'next') {
    newState = getNextTurn(sessionData);
  } else {
    newState = getPreviousTurn(sessionData);
  }

  // Determine if this is a round advancement
  const isRoundAdvancement = newState.round !== session.battleRound;
  
  // Store previous state for revert support
  const previousPhase = session.currentPhase;
  const previousTurn = session.currentTurn;
  const previousRound = session.battleRound;
  
  // Update session
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      battleRound: newState.round,
      currentPhase: newState.phase,
      currentTurn: newState.playerTurn,
      // Reset extra CP flags when advancing rounds
      ...(isRoundAdvancement ? {
        attackerExtraCPGainedThisTurn: false,
        defenderExtraCPGainedThisTurn: false
      } : {})
    }
  });

  // Create appropriate timeline event with attacker/defender terminology
  const isAttacker = newState.playerTurn === sessionData.firstTurn;
  const roleText = isAttacker ? 'Attacker' : 'Defender';
  const description = isRoundAdvancement
    ? `Round ${newState.round} started - ${roleText}`
    : `Turn switched to ${roleText}`;

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'phase',
      phase: newState.phase,
      description,
      metadata: JSON.stringify({
        playerTurn: newState.playerTurn,
        round: newState.round,
        roundAdvancement: isRoundAdvancement,
        direction: args.direction,
        previousPhase,
        previousTurn,
        previousRound
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  // Invalidate session cache
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'change_turn',
    success: true,
    message: description,
    data: {
      phase: newState.phase,
      playerTurn: newState.playerTurn,
      round: newState.round
    }
  };
}

/**
 * Generate proactive reminders for phase transitions
 */
async function generatePhaseReminders(
  sessionId: string,
  newPhase: string,
  playerTurn: string,
  battleRound: number
): Promise<string[]> {
  const reminders: string[] = [];
  
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        primaryMission: true,
        objectiveMarkers: true
      }
    });
    
    if (!session) return reminders;
    
    // COMMAND PHASE reminders
    if (newPhase === 'Command') {
      // CP gain reminder
      const cpBefore = playerTurn === 'attacker' 
        ? session.attackerCommandPoints 
        : session.defenderCommandPoints;
      reminders.push(`+1 CP automatically (now ${cpBefore + 1} CP).`);
      
      // Battle-shock check
      const battleShockUnits = await checkBattleShockRequiredHelper(sessionId, playerTurn as any);
      if (battleShockUnits.length > 0) {
        reminders.push(`${battleShockUnits.length} unit(s) need battle-shock tests.`);
      }
      
      // Primary mission scoring check
      if (session.primaryMission && session.primaryMission.scoringPhase === 'Command') {
        const objectivesHeld = session.objectiveMarkers.filter(o => o.controlledBy === playerTurn).length;
        reminders.push(`Primary scores at end of phase (currently holding ${objectivesHeld} objectives).`);
      }
      
      // Secondary discard reminder
      reminders.push(`Can discard tactical secondary at end of phase for +1 CP.`);
    }
    
    // MOVEMENT PHASE reminders
    if (newPhase === 'Movement') {
      reminders.push(`Declare Advances (can't charge, -1 to shoot except Assault weapons).`);
    }
    
    // SHOOTING PHASE reminders
    if (newPhase === 'Shooting') {
      reminders.push(`Opponent can use Overwatch stratagems.`);
    }
    
    // CHARGE PHASE reminders
    if (newPhase === 'Charge') {
      reminders.push(`Declare charges. Must be within 12", roll 2D6.`);
    }
    
    // FIGHT PHASE reminders
    if (newPhase === 'Fight') {
      reminders.push(`Fight in alternating activation. Pile in 3", consolidate 3".`);
    }
    
    // ... (Add more reminders as needed)
    
  } catch (error) {
    console.error('Error generating phase reminders:', error);
  }
  
  return reminders;
}

/**
 * Change the current game phase
 */
async function changePhase(args: ChangePhaseArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Fetch context and validate phase transition
  const context = await fetchGameContext(sessionId);
  const validation = validatePhaseTransition(args.new_phase, context);

  // Store previous phase and turn for revert support
  const previousPhase = context.session.currentPhase;
  const previousTurn = context.session.currentTurn;

  // Execute the phase change
  const session = await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      currentPhase: args.new_phase,
      currentTurn: args.player_turn
    }
  });

  // NEW: Generate proactive reminders for this phase
  const reminders = await generatePhaseReminders(
    sessionId,
    args.new_phase,
    args.player_turn,
    session.battleRound
  );

  // Create timeline event with custom timestamp if provided
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'phase',
      phase: args.new_phase,
      description: `Phase changed to ${args.new_phase} (${args.player_turn}'s turn)`,
      metadata: JSON.stringify({ 
        playerTurn: args.player_turn, 
        reminders,
        previousPhase,
        previousTurn
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  // Invalidate session cache (phase/turn changed)
  invalidateSessionCaches(sessionId, false);

  const baseMessage = `Changed to ${args.new_phase} phase (${args.player_turn}'s turn)`;
  const fullMessage = reminders.length > 0 
    ? `${baseMessage}. ${reminders.join(' ')}` 
    : baseMessage;

  return {
    toolName: 'change_phase',
    success: true,
    message: fullMessage,
    data: { 
      phase: args.new_phase, 
      playerTurn: args.player_turn,
      reminders 
    },
    validation: validation.severity !== 'valid' ? validation : undefined,
  };
}

/**
 * Change player turn (always resets to Command phase)
 * Uses turn progression logic to automatically advance round when needed
 */
async function changePlayerTurn(args: ChangePlayerTurnArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Fetch current session state to determine if round should advance
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      battleRound: true,
      currentTurn: true,
      currentPhase: true,
      firstTurn: true
    }
  });

  if (!session) {
    return {
      toolName: 'change_player_turn',
      success: false,
      message: 'Session not found'
    };
  }

  // Check if this turn change should advance the round
  const sessionData = {
    battleRound: session.battleRound,
    currentTurn: session.currentTurn,
    currentPhase: session.currentPhase,
    firstTurn: session.firstTurn || 'player'
  };

  const shouldAdvanceRound = willAdvanceRound(sessionData) && args.player_turn !== session.currentTurn;
  const newRound = shouldAdvanceRound ? session.battleRound + 1 : session.battleRound;
  
  // Store previous state for revert support
  const previousPhase = session.currentPhase;
  const previousTurn = session.currentTurn;
  const previousRound = session.battleRound;
  
  // Always reset to Command phase when changing player turn
  const newPhase = 'Command';
  
  // Update session with new turn and reset phase
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      currentPhase: newPhase,
      currentTurn: args.player_turn,
      battleRound: newRound,
      // Reset extra CP flags if advancing round
      ...(shouldAdvanceRound ? {
        attackerExtraCPGainedThisTurn: false,
        defenderExtraCPGainedThisTurn: false
      } : {})
    }
  });

  // Create timeline event with custom timestamp if provided using attacker/defender terminology
  const isAttacker = args.player_turn === sessionData.firstTurn;
  const roleText = isAttacker ? 'Attacker' : 'Defender';
  const description = shouldAdvanceRound
    ? `Round ${newRound} started - ${roleText}`
    : `Turn switched to ${roleText}`;

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'phase',
      phase: newPhase,
      description,
      metadata: JSON.stringify({
        playerTurn: args.player_turn,
        turnChange: true,
        roundAdvancement: shouldAdvanceRound,
        round: newRound,
        previousPhase,
        previousTurn,
        previousRound
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  // Invalidate session cache (phase/turn changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'change_player_turn',
    success: true,
    message: description,
    data: { phase: newPhase, playerTurn: args.player_turn, round: newRound },
  };
}

/**
 * Advance to next battle round
 * Uses firstTurn to determine who goes first
 */
async function advanceBattleRound(args: AdvanceBattleRoundArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Fetch context and validate round advancement
  const context = await fetchGameContext(sessionId);
  const validation = validateRoundAdvancement(args.round_number, context);

  // Get first player from session
  const sessionData = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { firstTurn: true }
  });

  const firstTurnTurn = (sessionData?.firstTurn || 'player') as 'player' | 'opponent';
  
  // Store previous state for revert support
  const previousRound = context.session.battleRound;
  const previousPhase = context.session.currentPhase;
  const previousTurn = context.session.currentTurn;

  const session = await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      battleRound: args.round_number,
      currentPhase: 'Command',
      currentTurn: firstTurnTurn, // Reset to first player at start of round
      attackerExtraCPGainedThisTurn: false, // Reset extra CP flags each round
      defenderExtraCPGainedThisTurn: false
    }
  });

  // Create timeline event with attacker/defender terminology
  // First player to go is always the attacker
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'phase',
      phase: 'Command',
      description: `Battle Round ${args.round_number} started - Attacker`,
      metadata: JSON.stringify({
        round: args.round_number,
        playerTurn: firstTurnTurn,
        previousRound,
        previousPhase,
        previousTurn
      })
    }
  });

  // Invalidate session cache (round/phase changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'advance_battle_round',
    success: true,
    message: `Advanced to Round ${args.round_number} - Attacker`,
    data: { round: args.round_number, playerTurn: firstTurnTurn },
    validation: validation.severity !== 'valid' ? validation : undefined,
  };
}

/**
 * Log stratagem use and deduct CP
 */
async function logStratagemUse(args: LogStratagemArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Get current session to check CP
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Fetch context and validate stratagem use
  const context = await fetchGameContext(sessionId);
  const validation = validateStratagemUse(
    args.stratagem_name,
    args.used_by,
    session.currentPhase,
    context
  );

  const cpField = args.used_by === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
  const currentCP = args.used_by === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
  const newCP = Math.max(0, currentCP - args.cp_cost);

  // Check if insufficient CP - add additional validation
  if (currentCP < args.cp_cost) {
    // Invalidate session cache (CP changed even with error)
    invalidateSessionCaches(sessionId, false);
    
    return {
      toolName: 'log_stratagem_use',
      success: true, // Execute anyway, but flag it
      message: `${args.stratagem_name} used (-${args.cp_cost} CP, ${newCP} CP remaining)`,
      data: { stratagem: args.stratagem_name, cpCost: args.cp_cost, cpRemaining: newCP },
      validation: {
        severity: 'error',
        message: `Insufficient CP: ${args.used_by} has ${currentCP} CP but stratagem costs ${args.cp_cost} CP`,
        rule: 'insufficient_cp',
        suggestion: 'Verify CP cost or current CP total',
        requiresOverride: true,
      },
    };
  }

  // Update session CP
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [cpField]: newCP
    }
  });

  // Try to find matching StratagemData to link
  let stratagemDataId: string | null = null;
  
  try {
    // 1. Try exact match first
    const exactMatch = await prisma.stratagemData.findFirst({
      where: {
        name: {
          equals: args.stratagem_name,
          mode: 'insensitive'
        }
      }
    });
    
    if (exactMatch) {
      stratagemDataId = exactMatch.id;
    } else {
      // 2. Try contains match
      const containsMatch = await prisma.stratagemData.findFirst({
        where: {
          name: {
            contains: args.stratagem_name,
            mode: 'insensitive'
          }
        }
      });
      
      if (containsMatch) {
        stratagemDataId = containsMatch.id;
      }
    }
  } catch (error) {
    console.warn('Failed to lookup stratagem data:', error);
  }

  // Log the stratagem use
  await prisma.stratagemLog.create({
    data: {
      gameSessionId: sessionId,
      stratagemName: args.stratagem_name,
      cpCost: args.cp_cost,
      usedBy: args.used_by,
      phase: session.currentPhase,
      targetUnit: args.target_unit,
      description: args.description,
      stratagemDataId: stratagemDataId
    }
  });

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'stratagem',
      phase: session.currentPhase,
      description: `${args.used_by} used ${args.stratagem_name} (${args.cp_cost} CP)${args.target_unit ? ` on ${args.target_unit}` : ''}`,
      metadata: JSON.stringify({
        stratagem: args.stratagem_name,
        cpCost: args.cp_cost,
        usedBy: args.used_by,
        targetUnit: args.target_unit,
        cpRemaining: newCP
      })
    }
  });

  // Invalidate session cache (CP changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'log_stratagem_use',
    success: true,
    message: `${args.stratagem_name} used (-${args.cp_cost} CP, ${newCP} CP remaining)`,
    data: { stratagem: args.stratagem_name, cpCost: args.cp_cost, cpRemaining: newCP },
    validation: validation.severity !== 'valid' ? validation : undefined,
  };
}

/**
 * Update command points (gain/loss)
 */
async function updateCommandPoints(args: UpdateCommandPointsArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Fetch context and validate CP change
  const context = await fetchGameContext(sessionId);
  const validation = validateCommandPointChange(
    args.player,
    args.change,
    args.reason,
    context
  );

  const cpField = args.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
  const currentCP = args.player === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
  const newCP = Math.max(0, currentCP + args.change);

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [cpField]: newCP
    }
  });

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.player} ${args.change >= 0 ? 'gained' : 'lost'} ${Math.abs(args.change)} CP: ${args.reason}`,
      metadata: JSON.stringify({
        player: args.player,
        change: args.change,
        reason: args.reason,
        newTotal: newCP
      })
    }
  });

  // Invalidate session cache (CP changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'update_command_points',
    success: true,
    message: `${args.player} ${args.change >= 0 ? 'gained' : 'lost'} ${Math.abs(args.change)} CP (${newCP} total)`,
    data: { player: args.player, change: args.change, newCP },
    validation: validation.severity !== 'valid' ? validation : undefined,
  };
}

/**
 * Update victory points
 */
async function updateVictoryPoints(args: UpdateVictoryPointsArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const vpField = args.player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
  const currentVP = args.player === 'attacker' ? session.attackerVictoryPoints : session.defenderVictoryPoints;
  const newVP = currentVP + args.points;

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [vpField]: newVP
    }
  });

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.player} scored ${args.points} VP: ${args.source}`,
      metadata: JSON.stringify({
        player: args.player,
        points: args.points,
        source: args.source,
        newTotal: newVP
      })
    }
  });

  // Invalidate session cache (VP changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'update_victory_points',
    success: true,
    message: `${args.player} scored ${args.points} VP from ${args.source} (${newVP} total)`,
    data: { player: args.player, points: args.points, totalVP: newVP }
  };
}

/**
 * Update objective control
 */
async function updateObjectiveControl(args: UpdateObjectiveControlArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Get existing objective to track previous state
  const existingObjective = await prisma.objectiveMarker.findUnique({
    where: {
      gameSessionId_objectiveNumber: {
        gameSessionId: sessionId,
        objectiveNumber: args.objective_number
      }
    }
  });

  // Upsert objective marker
  await prisma.objectiveMarker.upsert({
    where: {
      gameSessionId_objectiveNumber: {
        gameSessionId: sessionId,
        objectiveNumber: args.objective_number
      }
    },
    update: {
      controlledBy: args.controlled_by,
      controllingUnit: args.controlling_unit,
      lastUpdated: new Date()
    },
    create: {
      gameSessionId: sessionId,
      objectiveNumber: args.objective_number,
      controlledBy: args.controlled_by,
      controllingUnit: args.controlling_unit
    }
  });

  // Create timeline event with enhanced metadata
  const controlDescription = args.controlled_by === 'none' 
    ? `Objective ${args.objective_number} is now uncontrolled`
    : args.controlled_by === 'contested'
    ? `Objective ${args.objective_number} is contested`
    : `Objective ${args.objective_number} controlled by ${args.controlled_by}${args.controlling_unit ? ` (${args.controlling_unit})` : ''}`;

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'objective',
      phase: session.currentPhase,
      description: controlDescription,
      metadata: JSON.stringify({
        objectiveNumber: args.objective_number,
        controlledBy: args.controlled_by,
        previouslyControlledBy: existingObjective?.controlledBy || 'none',
        controllingUnit: args.controlling_unit,
        battleRound: session.battleRound,
        currentTurn: session.currentTurn
      })
    }
  });

  // Invalidate session cache (objective control changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'update_objective_control',
    success: true,
    message: controlDescription,
    data: { objectiveNumber: args.objective_number, controlledBy: args.controlled_by }
  };
}

/**
 * Log unit action (deepstrike, charge, etc.)
 */
async function logUnitAction(args: LogUnitActionArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const actionVerb = {
    deepstrike: 'arrived via deep strike',
    advance: 'advanced',
    charge: args.success ? 'successfully charged' : 'failed charge against',
    fall_back: 'fell back',
    heroic_intervention: 'performed heroic intervention',
    pile_in: 'piled in',
    consolidate: 'consolidated',
    remains_stationary: 'remained stationary'
  }[args.action_type];

  const description = `${args.unit_name} (${args.owner}) ${actionVerb}${args.target ? ` ${args.target}` : ''}${args.details ? ` - ${args.details}` : ''}`;

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: args.action_type === 'deepstrike' ? 'deepstrike' : 'custom',
      phase: session.currentPhase,
      description,
      metadata: JSON.stringify({
        unitName: args.unit_name,
        actionType: args.action_type,
        owner: args.owner,
        target: args.target,
        success: args.success,
        details: args.details
      })
    }
  });

  return {
    toolName: 'log_unit_action',
    success: true,
    message: description,
    data: { unitName: args.unit_name, actionType: args.action_type }
  };
}

/**
 * Log combat result
 */
async function logCombatResult(args: LogCombatResultArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Create combat log entry
  await prisma.combatLog.create({
    data: {
      gameSessionId: sessionId,
      battleRound: session.battleRound,
      phase: args.phase,
      attackingUnit: args.attacking_unit,
      attackingPlayer: args.attacking_player,
      defendingUnit: args.defending_unit,
      defendingPlayer: args.defending_player,
      woundsDealt: args.wounds_dealt,
      modelsDestroyed: args.models_destroyed,
      unitDestroyed: args.unit_destroyed || false
    }
  });

  // Build description
  let description = `${args.attacking_unit} (${args.attacking_player}) attacked ${args.defending_unit} (${args.defending_player})`;
  
  if (args.wounds_dealt !== undefined) {
    description += ` - ${args.wounds_dealt} wounds dealt`;
  }
  
  if (args.models_destroyed !== undefined && args.models_destroyed > 0) {
    description += `, ${args.models_destroyed} models destroyed`;
  }
  
  if (args.unit_destroyed) {
    description += ' - UNIT DESTROYED';
  }

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: args.phase,
      description,
      metadata: JSON.stringify({
        attackingUnit: args.attacking_unit,
        attackingPlayer: args.attacking_player,
        defendingUnit: args.defending_unit,
        defendingPlayer: args.defending_player,
        woundsDealt: args.wounds_dealt,
        modelsDestroyed: args.models_destroyed,
        unitDestroyed: args.unit_destroyed
      })
    }
  });

  return {
    toolName: 'log_combat_result',
    success: true,
    message: description,
    data: {
      attackingUnit: args.attacking_unit,
      defendingUnit: args.defending_unit,
      woundsDealt: args.wounds_dealt,
      modelsDestroyed: args.models_destroyed,
      unitDestroyed: args.unit_destroyed
    }
  };
}

/**
 * Query game state
 */
async function queryGameState(args: QueryGameStateArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      objectiveMarkers: true
    }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  let result: any = {};
  let message = '';

  switch (args.query_type) {
    case 'current_phase':
      result = { phase: session.currentPhase, playerTurn: session.currentTurn };
      message = `Current phase: ${session.currentPhase} (${session.currentTurn}'s turn)`;
      break;

    case 'cp_remaining':
      if (!args.player || args.player === 'both') {
        result = { player: session.attackerCommandPoints, opponent: session.defenderCommandPoints };
        message = `CP: Player ${session.attackerCommandPoints}, Opponent ${session.defenderCommandPoints}`;
      } else {
        const cp = args.player === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
        result = { [args.player]: cp };
        message = `${args.player} has ${cp} CP`;
      }
      break;

    case 'victory_points':
      if (!args.player || args.player === 'both') {
        result = { player: session.attackerVictoryPoints, opponent: session.defenderVictoryPoints };
        message = `VP: Player ${session.attackerVictoryPoints}, Opponent ${session.defenderVictoryPoints}`;
      } else {
        const vp = args.player === 'attacker' ? session.attackerVictoryPoints : session.defenderVictoryPoints;
        result = { [args.player]: vp };
        message = `${args.player} has ${vp} VP`;
      }
      break;

    case 'objectives_held':
      const objectives = {
        player: session.objectiveMarkers.filter(o => o.controlledBy === 'attacker').length,
        opponent: session.objectiveMarkers.filter(o => o.controlledBy === 'defender').length,
        contested: session.objectiveMarkers.filter(o => o.controlledBy === 'contested').length,
        none: session.objectiveMarkers.filter(o => o.controlledBy === 'none').length
      };
      result = objectives;
      message = `Objectives - Player: ${objectives.player}, Opponent: ${objectives.opponent}, Contested: ${objectives.contested}`;
      break;

    case 'battle_round':
      result = { round: session.battleRound };
      message = `Battle Round ${session.battleRound}`;
      break;
  }

  return {
    toolName: 'query_game_state',
    success: true,
    message,
    data: result
  };
}

/**
 * Set secondary objectives for a player
 */
async function setSecondaryObjectives(args: SetSecondaryObjectivesArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const field = args.player === 'attacker' ? 'attackerSecondaries' : 'defenderSecondaries';
  
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [field]: JSON.stringify(args.secondaries)
    }
  });

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.player} set secondaries: ${args.secondaries.join(', ')}`,
      metadata: JSON.stringify({
        player: args.player,
        secondaries: args.secondaries
      })
    }
  });

  // Invalidate session cache (secondaries changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'set_secondary_objectives',
    success: true,
    message: `${args.player} secondaries set: ${args.secondaries.join(', ')}`,
    data: { secondaries: args.secondaries }
  };
}

/**
 * Redraw a secondary objective (costs 1 CP)
 */
async function redrawSecondaryObjective(args: RedrawSecondaryObjectiveArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Get current secondaries
  const field = args.player === 'attacker' ? 'attackerSecondaries' : 'defenderSecondaries';
  const cpField = args.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
  const currentCP = args.player === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
  
  // Check CP available
  if (currentCP < 1) {
    return {
      toolName: 'redraw_secondary_objective',
      success: false,
      message: `${args.player} doesn't have enough CP to redraw (needs 1 CP)`
    };
  }

  const currentSecondariesStr = args.player === 'attacker' ? session.attackerSecondaries : session.defenderSecondaries;
  const currentSecondaries: string[] = currentSecondariesStr ? JSON.parse(currentSecondariesStr) : [];
  
  // Replace old with new
  const newSecondaries = currentSecondaries.map(sec => 
    sec === args.old_secondary ? args.new_secondary : sec
  );

  // Update database
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [field]: JSON.stringify(newSecondaries),
      [cpField]: currentCP - 1
    }
  });

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.player} redrew secondary: ${args.old_secondary} → ${args.new_secondary} (-1 CP)`,
      metadata: JSON.stringify({
        player: args.player,
        oldSecondary: args.old_secondary,
        newSecondary: args.new_secondary,
        cpRemaining: currentCP - 1
      })
    }
  });

  // Invalidate session cache (secondaries and CP changed)
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'redraw_secondary_objective',
    success: true,
    message: `Redrew ${args.old_secondary} for ${args.new_secondary} (-1 CP, ${currentCP - 1} CP remaining)`,
    data: { 
      oldSecondary: args.old_secondary,
      newSecondary: args.new_secondary,
      secondaries: newSecondaries,
      cpRemaining: currentCP - 1
    }
  };
}

// ============================================
// SECONDARY OBJECTIVES SCORING HANDLERS
// ============================================

/**
 * Helper function to update secondary progress tracking
 */
async function updateSecondaryProgress(
  sessionId: string,
  player: 'attacker' | 'opponent',
  secondaryName: string,
  vpToAdd: number,
  progressUpdate?: { action: string; details: string[] }
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Get current progress
  const progressField = player === 'attacker' ? 'attackerSecondaryProgress' : 'defenderSecondaryProgress';
  const currentProgressStr = player === 'attacker' ? session.attackerSecondaryProgress : session.defenderSecondaryProgress;
  const currentProgress: any = currentProgressStr ? JSON.parse(currentProgressStr) : {};

  // Initialize or update progress for this secondary
  if (!currentProgress[secondaryName]) {
    currentProgress[secondaryName] = {
      vp: 0,
      progress: {},
      details: [],
      turnScored: [],
      lastScored: new Date()
    };
  }

  currentProgress[secondaryName].vp += vpToAdd;
  currentProgress[secondaryName].lastScored = new Date();
  
  if (!currentProgress[secondaryName].turnScored.includes(session.battleRound)) {
    currentProgress[secondaryName].turnScored.push(session.battleRound);
  }

  if (progressUpdate) {
    // Merge progress details
    if (progressUpdate.details && progressUpdate.details.length > 0) {
      currentProgress[secondaryName].details = [
        ...currentProgress[secondaryName].details,
        ...progressUpdate.details
      ];
    }

    // Update progress metadata
    if (progressUpdate.action) {
      currentProgress[secondaryName].progress.lastAction = progressUpdate.action;
    }
  }

  // Update database
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [progressField]: JSON.stringify(currentProgress)
    }
  });

  // Invalidate session cache
  invalidateSessionCaches(sessionId, false);
}

/**
 * Generic secondary VP scoring with progress tracking
 */
async function scoreSecondaryVP(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Update progress tracking
  await updateSecondaryProgress(
    sessionId,
    args.player,
    args.secondary_name,
    args.vp_amount,
    args.progress_update
  );

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session.currentPhase,
      description: `${args.player} scored ${args.vp_amount} VP for ${args.secondary_name}`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: args.secondary_name,
        vp: args.vp_amount,
        progressUpdate: args.progress_update
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  return {
    toolName: 'score_secondary_vp',
    success: true,
    message: `${args.player} scored ${args.vp_amount} VP for ${args.secondary_name}`,
    data: {
      secondary: args.secondary_name,
      vp: args.vp_amount,
      player: args.player
    }
  };
}

/**
 * Score Assassination secondary
 * Fixed: 4 VP for 4+ wounds, 3 VP for <4 wounds (per unit)
 * Tactical: 5 VP for any CHARACTER destroyed this turn
 */
async function scoreAssassination(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({ 
    where: { id: sessionId },
    select: {
      currentPhase: true,
      battleRound: true,
      currentTurn: true,
      attackerMissionMode: true,
      defenderMissionMode: true
    }
  });
  
  if (!session) {
    return {
      toolName: 'score_assassination',
      success: false,
      message: 'Session not found'
    };
  }
  
  // Get mission mode for this player
  const missionMode: MissionMode = (args.player === 'attacker' 
    ? session.attackerMissionMode 
    : session.defenderMissionMode) as MissionMode || 'tactical';
  
  // Get secondary data from JSON
  const secondaryData = getSecondaryData('Assassination');
  
  // Calculate VP based on mission mode
  let vpAmount: number;
  if (missionMode === 'fixed') {
    // Fixed: 4 VP for 4+ wounds, 3 VP for <4 wounds
    vpAmount = args.wounds_characteristic >= 4 ? 4 : 3;
  } else {
    // Tactical: 5 VP for any CHARACTER destroyed
    vpAmount = 5;
  }
  
  // Validate scoring with mission mode
  const validation = await validateScoringAttempt(
    sessionId,
    args.player,
    'Assassination',
    vpAmount,
    session.battleRound,
    session.currentTurn,
    missionMode
  );
  
  if (!validation.isValid) {
    return {
      toolName: 'score_assassination',
      success: false,
      message: validation.error || 'Validation failed',
      validation: {
        severity: 'error',
        message: validation.error || 'Validation failed',
        rule: 'secondary_validation',
        requiresOverride: false
      }
    };
  }

  // Apply VP cap if needed
  const finalVP = validation.cappedVP !== undefined ? validation.cappedVP : vpAmount;

  // Update progress
  await updateSecondaryProgressHelper(
    sessionId,
    args.player,
    'Assassination',
    finalVP,
    session.battleRound,
    session.currentPhase,
    {
      characterName: args.character_name,
      woundsCharacteristic: args.wounds_characteristic,
      missionMode
    }
  );

  // Legacy format update (for backward compatibility)
  await updateSecondaryProgress(
    sessionId,
    args.player,
    'Assassination',
    finalVP,
    {
      action: 'destroyed_character',
      details: [`${args.character_name} (${args.wounds_characteristic}W) [${missionMode}]`]
    }
  );

  // Timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session.currentPhase,
      description: `${args.player} scored ${finalVP} VP for Assassination (destroyed ${args.character_name}) [${missionMode}]`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: 'Assassination',
        character: args.character_name,
        wounds: args.wounds_characteristic,
        vp: finalVP,
        missionMode
      }),
      timestamp: customTimestamp || new Date()
    }
  });
  
  const currentVP = await getCurrentSecondaryVP(sessionId, args.player, 'Assassination');

  return {
    toolName: 'score_assassination',
    success: true,
    message: `Assassination [${missionMode}]: ${args.character_name} (${args.wounds_characteristic}W) = ${finalVP} VP. Total: ${currentVP}/20 VP`,
    data: {
      secondary: 'Assassination',
      character: args.character_name,
      wounds: args.wounds_characteristic,
      vp: finalVP,
      totalVP: currentVP,
      maxVP: 20,
      missionMode
    },
    validation: validation.warning ? {
      severity: 'warning',
      message: validation.warning || 'Validation warning',
      rule: 'secondary_scoring',
      requiresOverride: false
    } : undefined
  };
}

/**
 * Score Bring It Down secondary
 * Fixed: 2 VP base, +2 for 15+ wounds, +2 more for 20+ wounds (cumulative)
 * Tactical: 4 VP for any MONSTER/VEHICLE destroyed
 */
async function scoreBringItDown(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({ 
    where: { id: sessionId },
    select: {
      currentPhase: true,
      battleRound: true,
      currentTurn: true,
      attackerMissionMode: true,
      defenderMissionMode: true
    }
  });
  
  if (!session) {
    return {
      toolName: 'score_bring_it_down',
      success: false,
      message: 'Session not found'
    };
  }
  
  // Get mission mode for this player
  const missionMode: MissionMode = (args.player === 'attacker' 
    ? session.attackerMissionMode 
    : session.defenderMissionMode) as MissionMode || 'tactical';
  
  // Calculate VP based on mission mode
  let vpAmount: number;
  if (missionMode === 'fixed') {
    // Fixed: 2 VP base, +2 for 15+ wounds, +2 more for 20+ wounds (cumulative)
    vpAmount = 2;
    if (args.total_wounds >= 15) vpAmount += 2;
    if (args.total_wounds >= 20) vpAmount += 2;
  } else {
    // Tactical: 4 VP for any MONSTER/VEHICLE destroyed
    vpAmount = 4;
  }
  
  // Validate scoring with mission mode
  const validation = await validateScoringAttempt(
    sessionId,
    args.player,
    'Bring It Down',
    vpAmount,
    session.battleRound,
    session.currentTurn,
    missionMode
  );
  
  if (!validation.isValid) {
    return {
      toolName: 'score_bring_it_down',
      success: false,
      message: validation.error || 'Validation failed',
      validation: {
        severity: 'error',
        message: validation.error || 'Validation failed',
        rule: 'secondary_validation',
        requiresOverride: false
      }
    };
  }

  // Apply VP cap if needed
  const finalVP = validation.cappedVP !== undefined ? validation.cappedVP : vpAmount;

  // Update progress
  await updateSecondaryProgressHelper(
    sessionId,
    args.player,
    'Bring It Down',
    finalVP,
    session.battleRound,
    session.currentPhase,
    {
      unitName: args.unit_name,
      totalWounds: args.total_wounds,
      missionMode
    }
  );

  // Legacy format update (for backward compatibility)
  await updateSecondaryProgress(
    sessionId,
    args.player,
    'Bring It Down',
    finalVP,
    {
      action: 'destroyed_vehicle_monster',
      details: [`${args.unit_name} (${args.total_wounds}W total) - ${finalVP}VP [${missionMode}]`]
    }
  );

  // Timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session.currentPhase,
      description: `${args.player} scored ${finalVP} VP for Bring It Down (destroyed ${args.unit_name}) [${missionMode}]`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: 'Bring It Down',
        unit: args.unit_name,
        totalWounds: args.total_wounds,
        vp: finalVP,
        missionMode
      }),
      timestamp: customTimestamp || new Date()
    }
  });
  
  const currentVP = await getCurrentSecondaryVP(sessionId, args.player, 'Bring It Down');

  return {
    toolName: 'score_bring_it_down',
    success: true,
    message: `Bring It Down [${missionMode}]: ${args.unit_name} (${args.total_wounds}W) = ${finalVP} VP. Total: ${currentVP}/20 VP`,
    data: {
      secondary: 'Bring It Down',
      unit: args.unit_name,
      totalWounds: args.total_wounds,
      vp: finalVP,
      totalVP: currentVP,
      maxVP: 20,
      missionMode
    },
    validation: validation.warning ? {
      severity: 'warning',
      message: validation.warning || 'Validation warning',
      rule: 'secondary_scoring',
      requiresOverride: false
    } : undefined
  };
}

/**
 * Score Marked for Death secondary
 * 5 VP for Alpha targets, 2 VP for Gamma target
 */
async function scoreMarkedForDeath(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const vpAmount = args.target_type === 'alpha' ? 5 : 2;

  await updateSecondaryProgress(
    sessionId,
    args.player,
    'Marked for Death',
    vpAmount,
    {
      action: `destroyed_${args.target_type}_target`,
      details: [`${args.unit_name} (${args.target_type} target) - ${vpAmount}VP`]
    }
  );

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session?.currentPhase || 'Unknown',
      description: `${args.player} scored ${vpAmount} VP for Marked for Death (destroyed ${args.target_type} target: ${args.unit_name})`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: 'Marked for Death',
        unit: args.unit_name,
        targetType: args.target_type,
        vp: vpAmount
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  return {
    toolName: 'score_marked_for_death',
    success: true,
    message: `${args.player} scored ${vpAmount} VP for Marked for Death (destroyed ${args.target_type} target: ${args.unit_name})`,
    data: {
      secondary: 'Marked for Death',
      unit: args.unit_name,
      targetType: args.target_type,
      vp: vpAmount
    }
  };
}

/**
 * Score No Prisoners secondary
 * Fixed & Tactical: 2 VP per unit destroyed, up to 5 VP per turn
 * Fixed restriction: Only non-CHARACTER or Bodyguard units
 */
async function scoreNoPrisoners(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({ 
    where: { id: sessionId },
    select: {
      currentPhase: true,
      battleRound: true,
      currentTurn: true,
      attackerMissionMode: true,
      defenderMissionMode: true,
      attackerSecondaryProgress: true,
      defenderSecondaryProgress: true
    }
  });
  
  if (!session) {
    return {
      toolName: 'score_no_prisoners',
      success: false,
      message: 'Session not found'
    };
  }

  // Get mission mode for this player
  const missionMode: MissionMode = (args.player === 'attacker' 
    ? session.attackerMissionMode 
    : session.defenderMissionMode) as MissionMode || 'tactical';

  // Fixed mode restriction: Only non-CHARACTER or Bodyguard units
  if (missionMode === 'fixed' && args.is_character && !args.is_bodyguard) {
    return {
      toolName: 'score_no_prisoners',
      success: false,
      message: `No Prisoners (Fixed): Cannot score for CHARACTER units unless they are Bodyguards`,
      validation: {
        severity: 'error',
        message: 'Fixed mode: Only non-CHARACTER or Bodyguard units score VP',
        rule: 'no_prisoners_fixed_restriction',
        requiresOverride: false
      }
    };
  }

  const vpToScore = 2; // Always 2 VP per unit

  // Validate scoring with mission mode (handles turn cap)
  const validation = await validateScoringAttempt(
    sessionId,
    args.player,
    'No Prisoners',
    vpToScore,
    session.battleRound,
    session.currentTurn,
    missionMode
  );
  
  if (!validation.isValid) {
    return {
      toolName: 'score_no_prisoners',
      success: false,
      message: validation.error || 'Validation failed',
      validation: {
        severity: 'error',
        message: validation.error || 'Turn cap reached (5 VP/turn)',
        rule: 'secondary_validation',
        requiresOverride: false
      }
    };
  }

  // Apply VP cap if needed
  const finalVP = validation.cappedVP !== undefined ? validation.cappedVP : vpToScore;
  
  if (finalVP <= 0) {
    return {
      toolName: 'score_no_prisoners',
      success: false,
      message: `No Prisoners: Turn cap reached (5 VP/turn)`,
      data: { turnCapReached: true }
    };
  }

  await updateSecondaryProgress(
    sessionId,
    args.player,
    'No Prisoners',
    finalVP,
    {
      action: 'destroyed_unit',
      details: [`${args.unit_name} - ${finalVP}VP [${missionMode}]`]
    }
  );

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session.currentPhase,
      description: `${args.player} scored ${finalVP} VP for No Prisoners (destroyed ${args.unit_name}) [${missionMode}]`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: 'No Prisoners',
        unit: args.unit_name,
        vp: finalVP,
        missionMode,
        wasCapped: validation.cappedVP !== undefined
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  const currentVP = await getCurrentSecondaryVP(sessionId, args.player, 'No Prisoners');

  return {
    toolName: 'score_no_prisoners',
    success: true,
    message: `No Prisoners [${missionMode}]: ${args.unit_name} = ${finalVP} VP. Total: ${currentVP}/20 VP${validation.warning ? ` (${validation.warning})` : ''}`,
    data: {
      secondary: 'No Prisoners',
      unit: args.unit_name,
      vp: finalVP,
      totalVP: currentVP,
      maxVP: 20,
      missionMode
    },
    validation: validation.warning ? {
      severity: 'warning',
      message: validation.warning,
      rule: 'turn_cap',
      requiresOverride: false
    } : undefined
  };
}

/**
 * Score Cull the Horde secondary
 * 5 VP for destroying INFANTRY units with 13+ models
 */
async function scoreCullTheHorde(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const vpAmount = 5;

  await updateSecondaryProgress(
    sessionId,
    args.player,
    'Cull the Horde',
    vpAmount,
    {
      action: 'destroyed_horde_unit',
      details: [`${args.unit_name} (${args.starting_strength} models) - ${vpAmount}VP`]
    }
  );

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session?.currentPhase || 'Unknown',
      description: `${args.player} scored ${vpAmount} VP for Cull the Horde (destroyed ${args.unit_name} with ${args.starting_strength} models)`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: 'Cull the Horde',
        unit: args.unit_name,
        startingStrength: args.starting_strength,
        vp: vpAmount
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  return {
    toolName: 'score_cull_the_horde',
    success: true,
    message: `${args.player} scored ${vpAmount} VP for Cull the Horde (destroyed ${args.unit_name} with ${args.starting_strength} models)`,
    data: {
      secondary: 'Cull the Horde',
      unit: args.unit_name,
      startingStrength: args.starting_strength,
      vp: vpAmount
    }
  };
}

/**
 * Score Overwhelming Force secondary
 * 3 VP per unit destroyed that started turn within range of objective, up to 5 VP per turn
 */
async function scoreOverwhelmingForce(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  // Get current progress to check turn cap
  const progressField = args.player === 'attacker' ? 'attackerSecondaryProgress' : 'defenderSecondaryProgress';
  const currentProgressStr = args.player === 'attacker' ? session.attackerSecondaryProgress : session.defenderSecondaryProgress;
  const currentProgress: any = currentProgressStr ? JSON.parse(currentProgressStr) : {};

  const overwhelmingProgress = currentProgress['Overwhelming Force'] || { vp: 0, turnScored: [], details: [] };
  const vpThisTurn = overwhelmingProgress.turnScored?.filter((t: number) => t === session.battleRound).length * 3 || 0;
  
  const vpAmount = Math.min(3, 5 - vpThisTurn); // Cap at 5 VP per turn
  
  if (vpAmount > 0) {
    await updateSecondaryProgress(
      sessionId,
      args.player,
      'Overwhelming Force',
      vpAmount,
      {
        action: 'destroyed_unit_on_objective',
        details: [`${args.unit_name} - ${vpAmount}VP`]
      }
    );
  }

  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'vp',
      phase: session.currentPhase,
      description: `${args.player} scored ${vpAmount} VP for Overwhelming Force (destroyed ${args.unit_name})${vpAmount < 3 ? ' - turn cap reached' : ''}`,
      metadata: JSON.stringify({
        player: args.player,
        secondary: 'Overwhelming Force',
        unit: args.unit_name,
        vp: vpAmount,
        turnCap: vpAmount < 3
      }),
      timestamp: customTimestamp || new Date()
    }
  });

  return {
    toolName: 'score_overwhelming_force',
    success: true,
    message: vpAmount > 0
      ? `${args.player} scored ${vpAmount} VP for Overwhelming Force (destroyed ${args.unit_name})`
      : `${args.player} cannot score more VP for Overwhelming Force this turn (5 VP cap reached)`,
    data: {
      secondary: 'Overwhelming Force',
      unit: args.unit_name,
      vp: vpAmount
    }
  };
}

// ============================================
// PER-MODEL WOUND TRACKING HELPERS
// ============================================

interface ModelState {
  role: string; // "sergeant", "heavy_weapon", "special_weapon", "regular"
  currentWounds: number;
  maxWounds: number;
}

/**
 * Initialize models array from unit data
 */
function initializeModelsArray(
  currentModels: number,
  woundsPerModel: number,
  composition?: any
): ModelState[] {
  const models: ModelState[] = [];
  
  // If we have composition data from army list, use it
  if (composition && Array.isArray(composition)) {
    for (const comp of composition) {
      const count = comp.count || 1;
      const role = comp.role || 'regular';
      const wounds = comp.woundsPerModel || woundsPerModel;
      
      for (let i = 0; i < count; i++) {
        models.push({
          role,
          currentWounds: wounds,
          maxWounds: wounds
        });
      }
    }
  } else {
    // No composition data - create all as regular models
    for (let i = 0; i < currentModels; i++) {
      models.push({
        role: 'regular',
        currentWounds: woundsPerModel,
        maxWounds: woundsPerModel
      });
    }
  }
  
  return models;
}

/**
 * Distribute wounds smartly across models
 * Strategy: Damage wounded models first, protect special models, target regulars before special roles
 */
function distributeWoundsSmartly(
  models: ModelState[],
  woundsToDistribute: number
): { models: ModelState[]; modelsKilled: number; distributionLog: string[] } {
  const log: string[] = [];
  let remainingWounds = woundsToDistribute;
  let modelsKilled = 0;
  
  // Sort priority: already wounded > regular > special_weapon > heavy_weapon > sergeant
  const roleRankings = { 'sergeant': 4, 'leader': 4, 'heavy_weapon': 3, 'special_weapon': 2, 'regular': 1 };
  
  const sortedModels = [...models].sort((a, b) => {
    // First: prioritize already-wounded models
    const aWounded = a.currentWounds < a.maxWounds ? 1 : 0;
    const bWounded = b.currentWounds < b.maxWounds ? 1 : 0;
    if (bWounded !== aWounded) return bWounded - aWounded;
    
    // Second: prioritize lower-rank roles (regular before special)
    const aRank = roleRankings[a.role as keyof typeof roleRankings] || 0;
    const bRank = roleRankings[b.role as keyof typeof roleRankings] || 0;
    return aRank - bRank;
  });
  
  // Apply wounds to models in priority order
  for (const model of sortedModels) {
    if (remainingWounds === 0) break;
    
    const woundsToApply = Math.min(remainingWounds, model.currentWounds);
    model.currentWounds -= woundsToApply;
    remainingWounds -= woundsToApply;
    
    if (model.currentWounds === 0) {
      modelsKilled++;
      log.push(`${model.role} model destroyed`);
    } else if (woundsToApply > 0) {
      log.push(`${model.role} model took ${woundsToApply} wounds (${model.currentWounds}/${model.maxWounds} remaining)`);
    }
  }
  
  // Remove dead models
  const survivingModels = models.filter(m => m.currentWounds > 0);
  
  return {
    models: survivingModels,
    modelsKilled,
    distributionLog: log
  };
}

/**
 * Target specific model role with damage
 */
function targetSpecificRole(
  models: ModelState[],
  targetRole: string,
  woundsLost?: number,
  modelsLost?: number
): { models: ModelState[]; modelsKilled: number; distributionLog: string[] } {
  const log: string[] = [];
  let modelsKilled = 0;
  
  // Find models with target role
  const targetModels = models.filter(m => m.role === targetRole);
  
  if (targetModels.length === 0) {
    log.push(`⚠ No ${targetRole} models found in unit`);
    return { models, modelsKilled: 0, distributionLog: log };
  }
  
  // Apply models_lost first (remove entire models)
  if (modelsLost && modelsLost > 0) {
    const toRemove = Math.min(modelsLost, targetModels.length);
    
    for (let i = 0; i < toRemove; i++) {
      const modelIndex = models.findIndex(m => m.role === targetRole && m.currentWounds > 0);
      if (modelIndex !== -1) {
        models.splice(modelIndex, 1);
        modelsKilled++;
        log.push(`${targetRole} model destroyed`);
      }
    }
  }
  
  // Apply wounds_lost (distribute across remaining target role models)
  if (woundsLost && woundsLost > 0) {
    let remainingWounds = woundsLost;
    const remainingTargets = models.filter(m => m.role === targetRole);
    
    for (const model of remainingTargets) {
      if (remainingWounds === 0) break;
      
      const woundsToApply = Math.min(remainingWounds, model.currentWounds);
      model.currentWounds -= woundsToApply;
      remainingWounds -= woundsToApply;
      
      if (model.currentWounds === 0) {
        modelsKilled++;
        log.push(`${targetRole} model destroyed`);
      } else if (woundsToApply > 0) {
        log.push(`${targetRole} took ${woundsToApply} wounds (${model.currentWounds}/${model.maxWounds} remaining)`);
      }
    }
  }
  
  // Remove dead models
  const survivingModels = models.filter(m => m.currentWounds > 0);
  
  return {
    models: survivingModels,
    modelsKilled,
    distributionLog: log
  };
}

/**
 * Validate damage input for sanity checks
 * Returns warnings for suspicious but valid inputs, errors for impossible inputs
 */
interface DamageValidationResult {
  isValid: boolean;
  warning?: string;
  error?: string;
}

function validateDamageInput(
  woundsLost: number | undefined,
  modelsLost: number | undefined,
  woundsPerModel: number,
  currentModels: number
): DamageValidationResult {
  // Check 1: Can't lose more models than exist
  if (modelsLost !== undefined && modelsLost > currentModels) {
    return {
      isValid: false,
      error: `Cannot lose ${modelsLost} models - unit only has ${currentModels} remaining`
    };
  }
  
  // Check 2: Wounds exceeding total possible wounds
  if (woundsLost !== undefined) {
    const totalPossibleWounds = currentModels * woundsPerModel;
    if (woundsLost > totalPossibleWounds) {
      return {
        isValid: true, // Trust player, but warn
        warning: `${woundsLost} wounds exceeds unit's total remaining wounds (${totalPossibleWounds}). Models may have already been wounded.`
      };
    }
  }
  
  // Check 3: If both wounds and models specified, check for overkill concerns
  if (woundsLost !== undefined && modelsLost !== undefined && modelsLost > 0) {
    const expectedMaxWounds = modelsLost * woundsPerModel;
    
    // If wounds significantly exceed what killing X models would require
    // This suggests possible confusion about overkill mechanics
    if (woundsLost > expectedMaxWounds + woundsPerModel) {
      return {
        isValid: true, // Trust player, but warn
        warning: `${woundsLost} wounds killing ${modelsLost} models (${woundsPerModel}W each) - excess damage may be due to overkill`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Update unit health (wounds/models lost)
 */
async function updateUnitHealth(args: UpdateUnitHealthArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }
  
  // Validate required arguments
  if (!args.unit_name) {
    return {
      toolName: 'update_unit_health',
      success: false,
      message: 'Missing required parameter: unit_name'
    };
  }
  
  if (!args.owner) {
    return {
      toolName: 'update_unit_health',
      success: false,
      message: 'Missing required parameter: owner'
    };
  }

  // Use smart unit matching to find the unit
  const matchResult = await findBestUnitMatch(
    args.unit_name,
    args.owner,
    sessionId,
    true // strict mode
  );

  if (!matchResult.success) {
    return {
      toolName: 'update_unit_health',
      success: false,
      message: matchResult.error || `Unit "${args.unit_name}" not found`
    };
  }

  const unitInstance = matchResult.unit!;

  // Determine wounds per model from datasheet or fallback
  let woundsPerModel = unitInstance.woundsPerModel || 1;
  
  // Try to get from datasheet if not set (for older units without woundsPerModel)
  if (!unitInstance.woundsPerModel && unitInstance.fullDatasheet) {
    woundsPerModel = unitInstance.fullDatasheet.wounds;
  }

  // Validate damage input for sanity checks
  const validation = validateDamageInput(
    args.wounds_lost,
    args.models_lost,
    woundsPerModel,
    unitInstance.currentModels
  );
  
  // Block impossible inputs (e.g., killing more models than exist)
  if (!validation.isValid) {
    return {
      toolName: 'update_unit_health',
      success: false,
      message: validation.error || 'Invalid damage input'
    };
  }
  
  // Log warnings but continue processing (trust player input)
  let validationWarning = '';
  if (validation.warning) {
    console.warn(`⚠️ Damage validation warning: ${validation.warning}`);
    validationWarning = ` (⚠ ${validation.warning})`;
  }

  // Parse or initialize models array
  let modelsArray: ModelState[];
  
  if (unitInstance.modelsArray) {
    try {
      modelsArray = JSON.parse(unitInstance.modelsArray);
      
      // CRITICAL: Validate modelsArray matches currentModels
      // If out of sync, reinitialize to prevent incorrect damage calculations
      if (modelsArray.length !== unitInstance.currentModels) {
        console.warn(`⚠️ modelsArray out of sync for ${unitInstance.unitName}: ` +
          `modelsArray has ${modelsArray.length} models but currentModels is ${unitInstance.currentModels}. Reconciling...`);
        
        if (modelsArray.length < unitInstance.currentModels) {
          // Add missing models (happens when modelsArray wasn't properly initialized)
          const missingCount = unitInstance.currentModels - modelsArray.length;
          for (let i = 0; i < missingCount; i++) {
            modelsArray.push({
              role: 'regular',
              currentWounds: woundsPerModel,
              maxWounds: woundsPerModel
            });
          }
          console.log(`  → Added ${missingCount} missing models (now ${modelsArray.length} total)`);
        } else {
          // More models in array than currentModels - trim excess (unlikely but handle it)
          modelsArray = modelsArray.slice(0, unitInstance.currentModels);
          console.log(`  → Trimmed to ${modelsArray.length} models`);
        }
      }
    } catch (e) {
      console.warn('Failed to parse modelsArray, initializing new one');
      modelsArray = initializeModelsArray(unitInstance.currentModels, woundsPerModel);
    }
  } else {
    // First time using per-model tracking - initialize from current state
    modelsArray = initializeModelsArray(unitInstance.currentModels, woundsPerModel);
    console.log(`Initialized modelsArray for ${unitInstance.unitName} with ${modelsArray.length} models (${woundsPerModel} wounds per model)`);
  }

  // Apply damage based on whether a specific role is targeted
  let distributionResult;
  
  if (args.target_model_role) {
    // Target specific model role
    distributionResult = targetSpecificRole(
      modelsArray,
      args.target_model_role,
      args.wounds_lost,
      args.models_lost
    );
  } else if (args.wounds_lost) {
    // Distribute wounds smartly across all models
    distributionResult = distributeWoundsSmartly(modelsArray, args.wounds_lost);
  } else if (args.models_lost) {
    // Remove entire models (use smart distribution with max wounds per model)
    const totalWoundsToRemove = args.models_lost * woundsPerModel;
    distributionResult = distributeWoundsSmartly(modelsArray, totalWoundsToRemove);
  } else {
    // No damage specified - just return current state
    return {
      toolName: 'update_unit_health',
      success: false,
      message: 'No wounds_lost or models_lost specified'
    };
  }

  // Update models array with survivors
  modelsArray = distributionResult.models;
  const newModels = modelsArray.length;
  const totalCurrentWounds = modelsArray.reduce((sum, m) => sum + m.currentWounds, 0);
  const isDestroyed = newModels === 0;
  const isHalfStrength = newModels > 0 && newModels <= Math.floor(unitInstance.startingModels / 2);

  // NEW: Check for "Damaged" state transition
  const totalMaxWounds = unitInstance.startingModels * woundsPerModel;
  const wasAboveHalfWounds = unitInstance.currentWounds > totalMaxWounds / 2;
  const isNowBelowHalfWounds = totalCurrentWounds <= totalMaxWounds / 2;
  const isDamagedTransition = !isDestroyed && wasAboveHalfWounds && isNowBelowHalfWounds;
  
  let damagedAbilityText = '';
  if (isDamagedTransition && unitInstance.fullDatasheet) {
    // Check if unit has "Damaged" ability
    const damagedAbility = await prisma.datasheetAbility.findFirst({
      where: {
        datasheetId: unitInstance.fullDatasheet.id,
        ability: {
          name: {
            contains: 'Damaged',
            mode: 'insensitive'
          }
        }
      },
      include: {
        ability: true
      }
    });
    
    if (damagedAbility && damagedAbility.ability) {
      damagedAbilityText = ` DAMAGED: ${damagedAbility.ability.description}`;
    }
  }

  // Update unit instance in database
  await prisma.unitInstance.update({
    where: { id: unitInstance.id },
    data: {
      modelsArray: JSON.stringify(modelsArray),
      currentModels: newModels,
      currentWounds: totalCurrentWounds,
      woundsPerModel: woundsPerModel,
      isDestroyed,
      updatedAt: new Date()
    }
  });

  // Create CombatLog entry if combat context is provided
  if (args.attacking_unit && args.attacking_player) {
    await prisma.combatLog.create({
      data: {
        gameSessionId: sessionId,
        battleRound: session.battleRound,
        phase: args.combat_phase || session.currentPhase,
        attackingUnit: args.attacking_unit,
        attackingPlayer: args.attacking_player,
        defendingUnit: unitInstance.unitName,
        defendingPlayer: args.owner,
        woundsDealt: args.wounds_lost || null,
        modelsDestroyed: distributionResult.modelsKilled || null,
        unitDestroyed: isDestroyed
      }
    });
  }

  // Build description with distribution log
  const unitDisplayName = matchResult.matchMethod === 'exact' 
    ? unitInstance.unitName
    : `${unitInstance.unitName} (matched from "${matchResult.matchedFrom}")`;
  
  const distributionSummary = distributionResult.distributionLog.join(', ');
  const damagedNote = damagedAbilityText ? ` ⚠️${damagedAbilityText}` : '';
  
  const description = isDestroyed
    ? `${args.owner}'s ${unitDisplayName} was DESTROYED${args.context ? ` (${args.context})` : ''} - ${distributionSummary}`
    : `${args.owner}'s ${unitDisplayName}: ${distributionSummary} - ${newModels}/${unitInstance.startingModels} models remaining${args.context ? ` (${args.context})` : ''}${damagedNote}`;

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: args.combat_phase || session.currentPhase,
      description,
      metadata: JSON.stringify({
        unitName: unitInstance.unitName,
        owner: args.owner,
        modelsLost: args.models_lost,
        woundsLost: args.wounds_lost,
        modelsKilled: distributionResult.modelsKilled,
        currentModels: newModels,
        startingModels: unitInstance.startingModels,
        distributionLog: distributionResult.distributionLog,
        targetRole: args.target_model_role,
        isDestroyed,
        isHalfStrength,
        context: args.context,
        // Combat context (if provided)
        attackingUnit: args.attacking_unit,
        attackingPlayer: args.attacking_player,
        combatPhase: args.combat_phase
      })
    }
  });

  // Build user-friendly message
  let message = `${unitDisplayName}: `;
  if (isDestroyed) {
    message += `DESTROYED - ${distributionSummary}`;
  } else {
    message += `${distributionSummary} - ${newModels}/${unitInstance.startingModels} models remaining`;
    if (isHalfStrength) {
      message += ` (⚠ HALF STRENGTH - Battleshock test required)`;
    }
  }
  
  // Append validation warning if present
  if (validationWarning) {
    message += validationWarning;
  }

  // Invalidate caches (session + units modified)
  invalidateSessionCaches(sessionId, true);

  return {
    toolName: 'update_unit_health',
    success: true,
    message,
    data: {
      unitName: unitInstance.unitName,
      matchedFrom: matchResult.matchedFrom,
      matchMethod: matchResult.matchMethod,
      owner: args.owner,
      currentModels: newModels,
      startingModels: unitInstance.startingModels,
      currentWounds: totalCurrentWounds,
      modelsKilled: distributionResult.modelsKilled,
      distributionLog: distributionResult.distributionLog,
      targetRole: args.target_model_role,
      isDestroyed,
      isHalfStrength,
      // Combat context (if provided)
      attackingUnit: args.attacking_unit,
      attackingPlayer: args.attacking_player,
      combatLogged: !!(args.attacking_unit && args.attacking_player)
    }
  };
}

/**
 * Mark a unit as completely destroyed
 */
async function markUnitDestroyed(args: MarkUnitDestroyedArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Use smart unit matching (allow matching destroyed units for this tool)
  const matchResult = await findBestUnitMatch(
    args.unit_name,
    args.owner,
    sessionId,
    true // strict mode
  );

  if (!matchResult.success) {
    // Also check destroyed units in case it's already marked destroyed
    const destroyedUnit = await prisma.unitInstance.findFirst({
      where: {
        gameSessionId: sessionId,
        unitName: { contains: args.unit_name, mode: 'insensitive' },
        owner: args.owner,
        isDestroyed: true
      }
    });
    
    if (destroyedUnit) {
      return {
        toolName: 'mark_unit_destroyed',
        success: false,
        message: `${destroyedUnit.unitName} is already destroyed`
      };
    }
    
    return {
      toolName: 'mark_unit_destroyed',
      success: false,
      message: matchResult.error || `Unit "${args.unit_name}" not found`
    };
  }

  const unitInstance = matchResult.unit!;

  // Mark as destroyed
  await prisma.unitInstance.update({
    where: { id: unitInstance.id },
    data: {
      currentModels: 0,
      currentWounds: 0,
      isDestroyed: true,
      updatedAt: new Date()
    }
  });

  // Create timeline event with actual unit name
  const unitDisplayName = matchResult.matchMethod === 'exact' 
    ? unitInstance.unitName
    : `${unitInstance.unitName} (matched from "${matchResult.matchedFrom}")`;
    
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.owner}'s ${unitDisplayName} was DESTROYED${args.destroyed_by ? ` by ${args.destroyed_by}` : ''}`,
      metadata: JSON.stringify({
        unitName: unitInstance.unitName,
        matchedFrom: matchResult.matchedFrom,
        owner: args.owner,
        destroyedBy: args.destroyed_by
      })
    }
  });

  // Invalidate caches (session + units modified)
  invalidateSessionCaches(sessionId, true);

  return {
    toolName: 'mark_unit_destroyed',
    success: true,
    message: `${unitDisplayName} DESTROYED`,
    data: {
      unitName: unitInstance.unitName,
      matchedFrom: matchResult.matchedFrom,
      matchMethod: matchResult.matchMethod,
      owner: args.owner,
      isDestroyed: true
    }
  };
}

/**
 * Update unit status effects (battleshock, buffs, debuffs)
 */
async function updateUnitStatus(args: UpdateUnitStatusArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Use smart unit matching
  const matchResult = await findBestUnitMatch(
    args.unit_name,
    args.owner,
    sessionId,
    true // strict mode
  );

  if (!matchResult.success) {
    return {
      toolName: 'update_unit_status',
      success: false,
      message: matchResult.error || `Unit "${args.unit_name}" not found or destroyed`
    };
  }

  const unitInstance = matchResult.unit!;

  // Parse current effects
  let currentEffects: string[] = [];
  if (unitInstance.activeEffects) {
    try {
      currentEffects = JSON.parse(unitInstance.activeEffects);
    } catch (e) {
      currentEffects = [];
    }
  }

  // Add new effects
  if (args.add_effects) {
    currentEffects = [...currentEffects, ...args.add_effects.filter(e => !currentEffects.includes(e))];
  }

  // Remove effects
  if (args.remove_effects) {
    currentEffects = currentEffects.filter(e => !args.remove_effects!.includes(e));
  }

  // Update unit instance
  await prisma.unitInstance.update({
    where: { id: unitInstance.id },
    data: {
      isBattleShocked: args.is_battle_shocked !== undefined ? args.is_battle_shocked : unitInstance.isBattleShocked,
      activeEffects: JSON.stringify(currentEffects),
      updatedAt: new Date()
    }
  });

  // Build description
  const statusChanges: string[] = [];
  if (args.is_battle_shocked !== undefined) {
    statusChanges.push(args.is_battle_shocked ? 'BATTLE-SHOCKED' : 'recovered from battleshock');
  }
  if (args.add_effects && args.add_effects.length > 0) {
    statusChanges.push(`gained: ${args.add_effects.join(', ')}`);
  }
  if (args.remove_effects && args.remove_effects.length > 0) {
    statusChanges.push(`lost: ${args.remove_effects.join(', ')}`);
  }

  // Create timeline event with match feedback
  const unitDisplayName = matchResult.matchMethod === 'exact' 
    ? unitInstance.unitName
    : `${unitInstance.unitName} (matched from "${matchResult.matchedFrom}")`;
    
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.owner}'s ${unitDisplayName}: ${statusChanges.join(', ')}`,
      metadata: JSON.stringify({
        unitName: unitInstance.unitName,
        matchedFrom: matchResult.matchedFrom,
        owner: args.owner,
        isBattleShocked: args.is_battle_shocked,
        activeEffects: currentEffects,
        addedEffects: args.add_effects,
        removedEffects: args.remove_effects
      })
    }
  });

  // Invalidate caches (session + units modified)
  invalidateSessionCaches(sessionId, true);

  return {
    toolName: 'update_unit_status',
    success: true,
    message: `${unitDisplayName}: ${statusChanges.join(', ')}`,
    data: {
      unitName: unitInstance.unitName,
      matchedFrom: matchResult.matchedFrom,
      matchMethod: matchResult.matchMethod,
      owner: args.owner,
      isBattleShocked: args.is_battle_shocked,
      activeEffects: currentEffects
    }
  };
}

/**
 * Get strategic advice (relevant stratagems and abilities)
 */
async function getStrategicAdvice(args: GetStrategicAdviceArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Fetch session to get current phase and player turn
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { 
      currentPhase: true, 
      currentTurn: true 
    }
  });
  
  if (!session) {
    return {
      toolName: 'get_strategic_advice',
      success: false,
      message: 'Session not found'
    };
  }
  
  // Get relevant rules from Strategic Assistant engine
  const rules = await getRelevantRules(
    sessionId, 
    session.currentPhase, 
    session.currentTurn as 'attacker' | 'defender'
  );
  
  // Format response based on query type
  let summary = '';
  
  if (args.query_type === 'opportunities' || args.query_type === 'all') {
    const label = session.currentTurn === 'attacker' 
      ? 'Your Opportunities' 
      : 'Your Reactive Options';
    
    summary += `\n**${label}** (${rules.opportunities.length}):\n`;
    
    if (rules.opportunities.length === 0) {
      summary += `  No available options for ${session.currentPhase} phase.\n`;
    } else {
      // Show top 5 most relevant
      rules.opportunities.slice(0, 5).forEach(r => {
        const cpCost = r.cpCost !== undefined ? ` (${r.cpCost} CP)` : '';
        const timing = r.triggerSubphase !== 'Any' ? ` [${r.triggerSubphase}]` : '';
        summary += `  • **${r.name}**${cpCost}${timing} - ${r.source}\n`;
      });
      
      if (rules.opportunities.length > 5) {
        summary += `  ... and ${rules.opportunities.length - 5} more. Say "open strategic assistant" to see all.\n`;
      }
    }
  }
  
  if (args.query_type === 'threats' || args.query_type === 'all') {
    const label = session.currentTurn === 'attacker' 
      ? "Opponent's Threats" 
      : "Opponent's Options";
    
    summary += `\n**${label}** (${rules.threats.length}):\n`;
    
    if (rules.threats.length === 0) {
      summary += `  No threats to watch for.\n`;
    } else {
      // Show top 5 most likely threats
      rules.threats.slice(0, 5).forEach(r => {
        const cpCost = r.cpCost !== undefined ? ` (${r.cpCost} CP)` : '';
        const timing = r.triggerSubphase !== 'Any' ? ` [${r.triggerSubphase}]` : '';
        const reactive = r.isReactive ? ' ⚡' : '';
        summary += `  • **${r.name}**${cpCost}${timing}${reactive} - ${r.source}\n`;
      });
      
      if (rules.threats.length > 5) {
        summary += `  ... and ${rules.threats.length - 5} more.\n`;
      }
    }
  }
  
  return {
    toolName: 'get_strategic_advice',
    success: true,
    message: summary.trim(),
    data: {
      phase: session.currentPhase,
      playerTurn: session.currentTurn,
      opportunitiesCount: rules.opportunities.length,
      threatsCount: rules.threats.length,
      opportunities: rules.opportunities.slice(0, 10), // Top 10 for AI context
      threats: rules.threats.slice(0, 10)
    }
  };
}

/**
 * Validate CP transaction against game rules
 * Checks max 2 CP per turn (1 automatic + 1 from discard)
 * Logs transaction history for tracking
 */
async function validateCPTransaction(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      currentPhase: true,
      battleRound: true,
      currentTurn: true,
      attackerCommandPoints: true,
      defenderCommandPoints: true
    }
  });
  
  if (!session) {
    return {
      toolName: 'validate_cp_transaction',
      success: false,
      message: 'Session not found'
    };
  }
  
  let validationResult;
  
  if (args.transaction_type === 'gain') {
    // Validate CP gain
    validationResult = await validateCPGain(
      sessionId,
      args.player,
      args.amount,
      args.reason,
      session.battleRound,
      session.currentTurn
    );
  } else {
    // Validate CP spend
    validationResult = await validateCPSpend(
      sessionId,
      args.player,
      args.amount
    );
  }
  
  if (!validationResult.isValid) {
    return {
      toolName: 'validate_cp_transaction',
      success: false,
      message: validationResult.error || 'Validation failed',
      validation: {
        severity: 'error',
        message: validationResult.error || 'Validation failed',
        rule: 'cp_validation',
        requiresOverride: false
      }
    };
  }
  
  // Log transaction
  await logCPTransaction(
    sessionId,
    args.player,
    args.transaction_type,
    args.amount,
    args.reason,
    args.stratagem_name,
    session.battleRound,
    session.currentPhase,
    session.currentTurn
  );
  
  // Actually update CP
  const cpField = args.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
  const currentCP = args.player === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
  const newCP = args.transaction_type === 'gain' 
    ? currentCP + args.amount 
    : currentCP - args.amount;
  
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { [cpField]: newCP }
  });
  
  // Timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `${args.player} ${args.transaction_type === 'gain' ? 'gained' : 'spent'} ${args.amount} CP (${args.reason})`,
      metadata: JSON.stringify({
        player: args.player,
        type: args.transaction_type,
        amount: args.amount,
        reason: args.reason,
        stratagemName: args.stratagem_name,
        cpBefore: currentCP,
        cpAfter: newCP
      }),
      timestamp: customTimestamp || new Date()
    }
  });
  
  const warningMessage = validationResult.warning 
    ? ` ⚠️ ${validationResult.warning}` 
    : '';
  
  return {
    toolName: 'validate_cp_transaction',
    success: true,
    message: `${args.player} ${args.transaction_type === 'gain' ? 'gained' : 'spent'} ${args.amount} CP (${args.reason}). Now at ${newCP} CP.${warningMessage}`,
    data: {
      player: args.player,
      type: args.transaction_type,
      amount: args.amount,
      cpBefore: currentCP,
      cpAfter: newCP,
      cpGainedThisTurn: validationResult.cpGainedThisTurn,
      maxCPPerTurn: validationResult.maxCPPerTurn
    },
    validation: validationResult.warning ? {
      severity: 'warning',
      message: validationResult.warning || 'Validation warning',
      rule: 'cp_validation',
      requiresOverride: false
    } : undefined
  };
}

/**
 * Check primary scoring opportunity
 * Calculates VP based on objectives held and mission scoring formula
 */
async function checkPrimaryScoring(args: any, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      currentPhase: true,
      battleRound: true,
      primaryMissionId: true
    }
  });
  
  if (!session) {
    return {
      toolName: 'check_primary_scoring',
      success: false,
      message: 'Session not found'
    };
  }
  
  // Get mission rules
  const mission = await getMissionRules(sessionId);
  
  if (!mission) {
    return {
      toolName: 'check_primary_scoring',
      success: true,
      message: 'No primary mission selected for this game. Primary VP must be tracked manually.',
      data: {
        canScore: false,
        reason: 'No mission selected'
      }
    };
  }
  
  // Check if current phase allows scoring
  const canScore = checkScoringOpportunity(session.currentPhase, mission);
  
  if (!canScore) {
    return {
      toolName: 'check_primary_scoring',
      success: true,
      message: `Primary scoring not available in ${session.currentPhase} phase. ${mission.missionName} scores during ${mission.scoringTiming}.`,
      data: {
        canScore: false,
        scoringPhase: mission.scoringPhase,
        scoringTiming: mission.scoringTiming,
        currentPhase: session.currentPhase
      }
    };
  }
  
  // Calculate potential VP
  const scoringResult = await calculatePrimaryVP(sessionId, args.player, mission);
  
  return {
    toolName: 'check_primary_scoring',
    success: true,
    message: `Primary Scoring Available: ${scoringResult.explanation}`,
    data: {
      canScore: scoringResult.canScore,
      vp: scoringResult.vp,
      formula: scoringResult.formula,
      objectivesHeld: scoringResult.objectivesHeld,
      missionName: mission.missionName,
      maxVP: mission.maxVP
    }
  };
}

// ============================================
// REVERT & CORRECTIONS - HELPER FUNCTIONS
// ============================================

/**
 * Find events to revert based on search criteria
 */
async function findEventsToRevert(
  sessionId: string,
  eventType: string,
  searchDescription?: string,
  howFarBack: string = 'last'
): Promise<any[]> {
  const limit = howFarBack === 'last' ? 1 : howFarBack === 'last_2' ? 2 : howFarBack === 'last_3' ? 3 : 10;
  
  // Build where clause
  const where: any = {
    gameSessionId: sessionId,
    isReverted: false
  };
  
  // Filter by event type if not 'any'
  if (eventType !== 'any') {
    where.eventType = eventType;
  }
  
  // Search by description if provided
  if (searchDescription) {
    where.description = {
      contains: searchDescription,
      mode: 'insensitive' as const
    };
  }
  
  // Find matching events
  const events = await prisma.timelineEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit
  });
  
  return events;
}

/**
 * Reverse the state changes caused by an event
 */
async function reverseEventStateChanges(event: any, sessionId: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });
  
  if (!session) return;
  
  const metadata = event.metadata ? JSON.parse(event.metadata) : {};
  
  // Reverse changes based on event type
  switch (event.eventType) {
    case 'phase':
      // Restore previous phase, turn, and round (if stored in metadata)
      if (metadata.previousPhase !== undefined && metadata.previousTurn !== undefined) {
        const updateData: any = {
          currentPhase: metadata.previousPhase,
          currentTurn: metadata.previousTurn
        };
        
        // If round was advanced, revert it too
        if (metadata.roundAdvancement && metadata.previousRound !== undefined) {
          updateData.battleRound = metadata.previousRound;
          console.log(`✅ Restoring phase: ${metadata.previousPhase}, turn: ${metadata.previousTurn}, round: ${metadata.previousRound}`);
        } else {
          console.log(`✅ Restoring phase: ${metadata.previousPhase}, turn: ${metadata.previousTurn}`);
        }
        
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: updateData
        });
      } else {
        console.log('⚠️ Phase change revert: Previous phase not stored in metadata, cannot auto-revert');
      }
      break;
      
    case 'stratagem':
      // Restore CP spent on stratagem
      if (metadata.cpCost && metadata.usedBy) {
        const cpField = metadata.usedBy === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            [cpField]: session[cpField] + metadata.cpCost
          }
        });
        console.log(`✅ Restored ${metadata.cpCost} CP to ${metadata.usedBy}`);
      }
      break;
      
    case 'vp':
      // Restore VP
      if (metadata.points && metadata.player) {
        const vpField = metadata.player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            [vpField]: Math.max(0, session[vpField] - metadata.points)
          }
        });
        console.log(`✅ Removed ${metadata.points} VP from ${metadata.player}`);
        
        // If this was secondary VP, also update secondary progress
        if (metadata.secondary || metadata.vp) {
          const secondaryName = metadata.secondary;
          const progressField = metadata.player === 'attacker' ? 'attackerSecondaryProgress' : 'defenderSecondaryProgress';
          const currentProgress = session[progressField] ? JSON.parse(session[progressField]) : {};
          
          if (currentProgress[secondaryName]) {
            // Subtract VP from secondary progress
            currentProgress[secondaryName].vp = Math.max(0, (currentProgress[secondaryName].vp || 0) - (metadata.vp || metadata.points));
            
            await prisma.gameSession.update({
              where: { id: sessionId },
              data: {
                [progressField]: JSON.stringify(currentProgress)
              }
            });
            console.log(`✅ Reversed ${metadata.vp || metadata.points} VP from ${secondaryName} secondary`);
          }
        }
      }
      break;
      
    case 'cp':
      // Reverse CP change
      if (metadata.change && metadata.player) {
        const cpField = metadata.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            [cpField]: Math.max(0, session[cpField] - metadata.change)
          }
        });
        console.log(`✅ Reversed CP change for ${metadata.player}`);
      }
      break;
      
    case 'objective':
      // Revert objective control - restore previous state
      if (metadata.objectiveNumber !== undefined && metadata.previouslyControlledBy !== undefined) {
        await prisma.objectiveMarker.update({
          where: {
            gameSessionId_objectiveNumber: {
              gameSessionId: sessionId,
              objectiveNumber: metadata.objectiveNumber
            }
          },
          data: {
            controlledBy: metadata.previouslyControlledBy,
            lastUpdated: new Date()
          }
        });
        console.log(`✅ Restored Objective ${metadata.objectiveNumber} control to ${metadata.previouslyControlledBy}`);
      }
      break;
      
    case 'deepstrike':
      // Deepstrike is just a log event, no state to reverse
      console.log('ℹ️ Deepstrike event - no state to reverse');
      break;
      
    case 'custom':
      // Handle custom events - manual CP/VP changes from UI, unit health, etc.
      if (metadata.player) {
        // Manual CP change
        if (metadata.newCP !== undefined && metadata.change !== undefined) {
          const cpField = metadata.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
          // Calculate the old value: if it was set to newCP with a change amount,
          // the old value was newCP - change
          const oldCP = metadata.newCP - metadata.change;
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              [cpField]: Math.max(0, oldCP)
            }
          });
          console.log(`✅ Restored ${metadata.player} CP from ${metadata.newCP} back to ${oldCP}`);
        }
        // Manual VP change
        else if (metadata.newVP !== undefined && metadata.change !== undefined) {
          const vpField = metadata.player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
          // Calculate the old value
          const oldVP = metadata.newVP - metadata.change;
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              [vpField]: Math.max(0, oldVP)
            }
          });
          console.log(`✅ Restored ${metadata.player} VP from ${metadata.newVP} back to ${oldVP}`);
        }
        // Secondary objectives being set
        else if (metadata.secondaries !== undefined) {
          const field = metadata.player === 'attacker' ? 'attackerSecondaries' : 'defenderSecondaries';
          // Restore to empty or previous state (we don't track previous, so clear them)
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              [field]: JSON.stringify([])
            }
          });
          console.log(`✅ Cleared ${metadata.player} secondaries`);
        }
      } 
      // Unit health changes
      else if (metadata.unitName && metadata.owner && metadata.modelsLost !== undefined) {
        const unit = await prisma.unitInstance.findFirst({
          where: {
            gameSessionId: sessionId,
            unitName: metadata.unitName,
            owner: metadata.owner
          }
        });
        
        if (unit) {
          // Restore models that were lost
          const restoredModels = unit.currentModels + (metadata.modelsKilled || 0);
          
          await prisma.unitInstance.update({
            where: { id: unit.id },
            data: {
              currentModels: Math.min(restoredModels, unit.startingModels),
              isDestroyed: false // Un-destroy if it was destroyed
            }
          });
          console.log(`✅ Restored ${metadata.modelsKilled || 0} models to ${metadata.unitName}`);
        }
      }
      // Unit status changes
      else if (metadata.unitName && metadata.owner && (metadata.isBattleShocked !== undefined || metadata.activeEffects !== undefined)) {
        const unit = await prisma.unitInstance.findFirst({
          where: {
            gameSessionId: sessionId,
            unitName: metadata.unitName,
            owner: metadata.owner
          }
        });
        
        if (unit) {
          // Reverse status effects
          let currentEffects = unit.activeEffects ? JSON.parse(unit.activeEffects) : [];
          
          // Remove added effects
          if (metadata.addedEffects) {
            currentEffects = currentEffects.filter((e: string) => !metadata.addedEffects.includes(e));
          }
          
          // Re-add removed effects
          if (metadata.removedEffects) {
            currentEffects = [...new Set([...currentEffects, ...metadata.removedEffects])];
          }
          
          await prisma.unitInstance.update({
            where: { id: unit.id },
            data: {
              activeEffects: JSON.stringify(currentEffects),
              isBattleShocked: metadata.isBattleShocked !== undefined ? !metadata.isBattleShocked : unit.isBattleShocked
            }
          });
          console.log(`✅ Restored ${metadata.unitName} status effects`);
        }
      }
      else {
        // Other custom events - log for manual review
        console.log('⚠️ Custom event revert: Check event for specific reversals needed', metadata);
      }
      break;
      
    default:
      console.log(`⚠️ Unknown event type: ${event.eventType}`);
  }
}

/**
 * Capture current game state for audit trail
 */
async function captureGameState(sessionId: string): Promise<any> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      objectiveMarkers: true,
      unitInstances: {
        select: {
          id: true,
          unitName: true,
          owner: true,
          currentModels: true,
          currentWounds: true,
          isDestroyed: true
        }
      }
    }
  });
  
  if (!session) return null;
  
  return {
    battleRound: session.battleRound,
    currentPhase: session.currentPhase,
    currentTurn: session.currentTurn,
    attackerCP: session.attackerCommandPoints,
    defenderCP: session.defenderCommandPoints,
    attackerVP: session.attackerVictoryPoints,
    defenderVP: session.defenderVictoryPoints,
    objectives: session.objectiveMarkers,
    units: session.unitInstances
  };
}

/**
 * Revert an event (main handler)
 */
async function revertEvent(args: RevertEventArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // 1. Find the target event(s) to revert
  const targetEvents = await findEventsToRevert(
    sessionId,
    args.target_event_type,
    args.search_description,
    args.how_far_back || 'last'
  );
  
  if (targetEvents.length === 0) {
    return {
      toolName: 'revert_event',
      success: false,
      message: `No matching ${args.target_event_type} events found to revert`,
      validation: {
        severity: 'warning',
        message: 'Could not find event to revert',
        rule: 'revert-not-found',
        requiresOverride: false
      }
    };
  }
  
  const targetEvent = targetEvents[0]; // Most recent match
  
  // 2. Check for dependent/subsequent events (cascade detection)
  const subsequentEvents = await prisma.timelineEvent.findMany({
    where: {
      gameSessionId: sessionId,
      timestamp: { gt: targetEvent.timestamp },
      isReverted: false
    },
    orderBy: { timestamp: 'asc' }
  });
  
  // 3. Store current state for audit trail
  const currentState = await captureGameState(sessionId);
  
  // 4. Perform the revert (mark as reverted, don't delete)
  await prisma.timelineEvent.update({
    where: { id: targetEvent.id },
    data: {
      isReverted: true,
      revertedAt: new Date(),
      revertedBy: 'ai',
      revertReason: args.revert_reason
    }
  });
  
  // 5. Reverse the state changes caused by this event
  await reverseEventStateChanges(targetEvent, sessionId);
  
  // 6. Create revert action record
  const revertAction = await prisma.revertAction.create({
    data: {
      gameSessionId: sessionId,
      targetEventId: targetEvent.id,
      targetEventType: targetEvent.eventType,
      targetDescription: targetEvent.description,
      revertType: 'single',
      triggerMethod: 'voice',
      reason: args.revert_reason,
      affectedEventIds: JSON.stringify([targetEvent.id]),
      stateBefore: JSON.stringify(currentState),
      stateAfter: null
    }
  });
  
  // 7. Create timeline event showing the revert
  const revertTimelineEvent = await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: (await prisma.gameSession.findUnique({ where: { id: sessionId } }))?.currentPhase,
      description: `⎌ REVERTED: ${targetEvent.description} - Reason: ${args.revert_reason}`,
      metadata: JSON.stringify({
        isRevertAction: true,
        targetEventId: targetEvent.id,
        revertActionId: revertAction.id,
        subsequentEventsCount: subsequentEvents.length,
        requiresCascadeWarning: subsequentEvents.length > 0,
        affectedEvents: [{
          id: targetEvent.id,
          eventType: targetEvent.eventType,
          description: targetEvent.description,
          timestamp: targetEvent.timestamp
        }]
      }),
      timestamp: customTimestamp || new Date()
    }
  });
  
  // 8. Invalidate caches
  invalidateSessionCaches(sessionId);
  
  return {
    toolName: 'revert_event',
    success: true,
    message: `Reverted: ${targetEvent.description}${subsequentEvents.length > 0 ? ` (${subsequentEvents.length} subsequent events may need review)` : ''}`,
    data: {
      revertedEventId: targetEvent.id,
      revertActionId: revertAction.id,
      subsequentEventsCount: subsequentEvents.length
    },
    validation: {
      severity: subsequentEvents.length > 0 ? 'warning' : 'info',
      message: subsequentEvents.length > 0
        ? `This event has ${subsequentEvents.length} events after it. Consider reverting those too to maintain consistency.`
        : 'Event reverted successfully',
      rule: 'revert-cascade-warning',
      requiresOverride: false
    }
  };
}
