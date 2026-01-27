/**
 * Zod Validation Schemas for AI Tool Arguments
 *
 * These schemas provide runtime validation for AI-generated tool arguments
 * to ensure they match expected types and constraints before execution.
 */

import { z } from 'zod';

// Common enums
const PlayerEnum = z.enum(['attacker', 'defender']);
const PhaseEnum = z.enum(['Command', 'Movement', 'Shooting', 'Charge', 'Fight']);
const CombatPhaseEnum = z.enum(['Shooting', 'Fight']);
const ObjectiveControlEnum = z.enum(['attacker', 'defender', 'contested', 'none']);
const ActionTypeEnum = z.enum([
  'deepstrike', 'advance', 'charge', 'fall_back',
  'heroic_intervention', 'pile_in', 'consolidate', 'remains_stationary'
]);
const ModelRoleEnum = z.enum(['sergeant', 'leader', 'heavy_weapon', 'special_weapon', 'regular']);
const QueryTypeEnum = z.enum(['current_phase', 'cp_remaining', 'victory_points', 'objectives_held', 'battle_round']);
const AdviceQueryTypeEnum = z.enum(['opportunities', 'threats', 'all']);
const TargetTypeEnum = z.enum(['alpha', 'gamma']);
const TransactionTypeEnum = z.enum(['gain', 'spend']);
const EventTypeEnum = z.enum(['phase', 'stratagem', 'objective', 'vp', 'cp', 'combat', 'unit_action', 'secondary', 'any']);
const HowFarBackEnum = z.enum(['last', 'last_2', 'last_3', 'specific']);
const RerollEnum = z.enum(['ones', 'all']);

// Tool argument schemas
export const ChangePhaseSchema = z.object({
  new_phase: PhaseEnum,
  player_turn: PlayerEnum,
}).strict();

export const ChangePlayerTurnSchema = z.object({
  player_turn: PlayerEnum,
}).strict();

export const AdvanceBattleRoundSchema = z.object({
  round_number: z.number().int().min(1).max(10),
}).strict();

export const LogStratagemSchema = z.object({
  stratagem_name: z.string().min(1).max(200),
  cp_cost: z.number().int().min(0).max(3),
  used_by: PlayerEnum,
  target_unit: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
}).strict();

export const UpdateCommandPointsSchema = z.object({
  player: PlayerEnum,
  change: z.number().int().min(-20).max(20),
  reason: z.string().min(1).max(200),
}).strict();

export const UpdateVictoryPointsSchema = z.object({
  player: PlayerEnum,
  points: z.number().int().min(0).max(100),
  source: z.string().min(1).max(200),
}).strict();

export const UpdateObjectiveControlSchema = z.object({
  objective_number: z.number().int().min(1).max(6),
  controlled_by: ObjectiveControlEnum,
  controlling_unit: z.string().max(200).optional(),
}).strict();

export const LogUnitActionSchema = z.object({
  unit_name: z.string().min(1).max(200),
  action_type: ActionTypeEnum,
  owner: PlayerEnum,
  target: z.string().max(200).optional(),
  success: z.boolean().optional(),
  details: z.string().max(500).optional(),
}).strict();

export const LogCombatResultSchema = z.object({
  attacking_unit: z.string().min(1).max(200),
  attacking_player: PlayerEnum,
  defending_unit: z.string().min(1).max(200),
  defending_player: PlayerEnum,
  wounds_dealt: z.number().int().min(0).optional(),
  models_destroyed: z.number().int().min(0).optional(),
  unit_destroyed: z.boolean().optional(),
  phase: CombatPhaseEnum,
}).strict();

export const QueryGameStateSchema = z.object({
  query_type: QueryTypeEnum,
  player: z.enum(['attacker', 'defender', 'both']).optional(),
}).strict();

export const SetSecondaryObjectivesSchema = z.object({
  player: PlayerEnum,
  secondaries: z.array(z.string().min(1).max(200)).min(1).max(3),
}).strict();

export const RedrawSecondaryObjectiveSchema = z.object({
  player: PlayerEnum,
  old_secondary: z.string().min(1).max(200),
  new_secondary: z.string().min(1).max(200),
}).strict();

export const ScoreSecondaryVPSchema = z.object({
  player: PlayerEnum,
  secondary_name: z.string().min(1).max(200),
  vp_amount: z.number().int().min(1).max(20),
  progress_update: z.object({
    action: z.string().max(200).optional(),
    details: z.array(z.string().max(200)).optional(),
  }).optional(),
}).strict();

export const UpdateUnitHealthSchema = z.object({
  unit_name: z.string().min(1).max(200),
  owner: PlayerEnum,
  wounds_lost: z.number().int().min(0).max(100).optional(),
  models_lost: z.number().int().min(0).max(50).optional(),
  target_model_role: ModelRoleEnum.optional(),
  context: z.string().max(500).optional(),
  attacking_unit: z.string().max(200).optional(),
  attacking_player: PlayerEnum.optional(),
  combat_phase: CombatPhaseEnum.optional(),
}).strict();

export const MarkUnitDestroyedSchema = z.object({
  unit_name: z.string().min(1).max(200),
  owner: PlayerEnum,
  destroyed_by: z.string().max(200).optional(),
}).strict();

export const UpdateUnitStatusSchema = z.object({
  unit_name: z.string().min(1).max(200),
  owner: PlayerEnum,
  is_battle_shocked: z.boolean().optional(),
  add_effects: z.array(z.string().max(100)).optional(),
  remove_effects: z.array(z.string().max(100)).optional(),
}).strict();

export const GetStrategicAdviceSchema = z.object({
  query_type: AdviceQueryTypeEnum,
}).strict();

export const ScoreAssassinationSchema = z.object({
  player: PlayerEnum,
  character_name: z.string().min(1).max(200),
  wounds_characteristic: z.number().min(1).max(50),
}).strict();

export const ScoreBringItDownSchema = z.object({
  player: PlayerEnum,
  unit_name: z.string().min(1).max(200),
  total_wounds: z.number().min(1).max(100),
}).strict();

export const ScoreNoPrisonersSchema = z.object({
  player: PlayerEnum,
  unit_name: z.string().min(1).max(200),
}).strict();

export const ScoreMarkedForDeathSchema = z.object({
  player: PlayerEnum,
  target_type: TargetTypeEnum,
  unit_name: z.string().min(1).max(200),
}).strict();

export const ScoreCullTheHordeSchema = z.object({
  player: PlayerEnum,
  unit_name: z.string().min(1).max(200),
  starting_strength: z.number().int().min(13).max(100),
}).strict();

export const ScoreOverwhelmingForceSchema = z.object({
  player: PlayerEnum,
  unit_name: z.string().min(1).max(200),
  objective_number: z.number().int().min(1).max(6).optional(),
}).strict();

export const ValidateCPTransactionSchema = z.object({
  player: PlayerEnum,
  transaction_type: TransactionTypeEnum,
  amount: z.number().min(0).max(20),
  reason: z.string().min(1).max(200),
  stratagem_name: z.string().max(200).optional(),
}).strict();

export const CheckPrimaryScoringSchema = z.object({
  player: PlayerEnum,
}).strict();

export const RevertEventSchema = z.object({
  target_event_type: EventTypeEnum,
  search_description: z.string().max(500).optional(),
  revert_reason: z.string().min(1).max(500),
  correction_data: z.object({
    correct_value: z.string().max(200).optional(),
    reapply_corrected: z.boolean().optional(),
  }).optional(),
  how_far_back: HowFarBackEnum.optional(),
}).strict();

export const EstimateDamageSchema = z.object({
  attacker_name: z.string().min(1).max(200),
  defender_name: z.string().min(1).max(200),
  attacker_owner: PlayerEnum,
  weapon_name: z.string().max(200).optional(),
  modifiers: z.object({
    reroll_hits: RerollEnum.optional(),
    reroll_wounds: RerollEnum.optional(),
    plus_to_hit: z.number().int().min(-3).max(3).optional(),
    plus_to_wound: z.number().int().min(-3).max(3).optional(),
    cover: z.boolean().optional(),
    stealth: z.boolean().optional(),
    lethal_hits: z.boolean().optional(),
    sustained_hits: z.number().int().min(1).max(3).optional(),
    devastating_wounds: z.boolean().optional(),
    lance: z.boolean().optional(),
    anti_keyword_active: z.boolean().optional(),
  }).optional(),
}).strict();

// Change turn (internal tool)
export const ChangeTurnSchema = z.object({
  direction: z.enum(['next', 'previous', 'specific']),
  round: z.number().int().min(1).max(10).optional(),
  player_turn: PlayerEnum.optional(),
}).strict();

// Map of tool names to their validation schemas
export const ToolSchemas: Record<string, z.ZodSchema> = {
  change_phase: ChangePhaseSchema,
  change_player_turn: ChangePlayerTurnSchema,
  change_turn: ChangeTurnSchema,
  advance_battle_round: AdvanceBattleRoundSchema,
  log_stratagem_use: LogStratagemSchema,
  update_command_points: UpdateCommandPointsSchema,
  update_victory_points: UpdateVictoryPointsSchema,
  update_objective_control: UpdateObjectiveControlSchema,
  log_unit_action: LogUnitActionSchema,
  log_combat_result: LogCombatResultSchema,
  query_game_state: QueryGameStateSchema,
  set_secondary_objectives: SetSecondaryObjectivesSchema,
  redraw_secondary_objective: RedrawSecondaryObjectiveSchema,
  score_secondary_vp: ScoreSecondaryVPSchema,
  update_unit_health: UpdateUnitHealthSchema,
  mark_unit_destroyed: MarkUnitDestroyedSchema,
  update_unit_status: UpdateUnitStatusSchema,
  get_strategic_advice: GetStrategicAdviceSchema,
  score_assassination: ScoreAssassinationSchema,
  score_bring_it_down: ScoreBringItDownSchema,
  score_no_prisoners: ScoreNoPrisonersSchema,
  score_marked_for_death: ScoreMarkedForDeathSchema,
  score_cull_the_horde: ScoreCullTheHordeSchema,
  score_overwhelming_force: ScoreOverwhelmingForceSchema,
  validate_cp_transaction: ValidateCPTransactionSchema,
  check_primary_scoring: CheckPrimaryScoringSchema,
  revert_event: RevertEventSchema,
  estimate_damage: EstimateDamageSchema,
};

/**
 * Validate tool arguments against their schema
 * Returns validated data or throws an error with details
 */
export function validateToolArgs(toolName: string, args: unknown): { valid: true; data: unknown } | { valid: false; error: string } {
  const schema = ToolSchemas[toolName];

  if (!schema) {
    // Unknown tool - let the handler deal with it
    return { valid: true, data: args };
  }

  const result = schema.safeParse(args);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  // Format error message
  const errors = result.error.issues.map(e =>
    `${e.path.map(p => String(p)).join('.')}: ${e.message}`
  ).join('; ');

  return { valid: false, error: `Invalid arguments for ${toolName}: ${errors}` };
}
