// AI Tool Definitions for Google Gemini Function Calling
// These tools allow the AI agent to interact with game state
// Converted from OpenAI format (lib/aiTools.ts) to Gemini format

import { Type, type FunctionDeclaration } from "@google/genai";

// Gemini uses FunctionDeclaration format with Type enums
export const GEMINI_TOOLS: FunctionDeclaration[] = [
  {
    name: "change_phase",
    description: "Change the current game phase. Use when announcing a move to a new phase.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_phase: {
          type: Type.STRING,
          enum: ["Command", "Movement", "Shooting", "Charge", "Fight"],
          description: "The phase to transition to"
        },
        player_turn: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Whose turn it is (attacker or defender)"
        }
      },
      required: ["new_phase", "player_turn"]
    }
  },

  {
    name: "change_player_turn",
    description: "Change whose turn it is. Always resets phase to Command. Use when a side finishes their turn and passes to the other side. IMPORTANT: This tool automatically advances the round when the 2nd turn ends. No need to manually check or advance rounds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player_turn: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Whose turn it is now (attacker or defender)"
        }
      },
      required: ["player_turn"]
    }
  },
  
  {
    name: "advance_battle_round",
    description: "Move to the next battle round. Automatically resets to Command phase and sets turn to whoever goes first each round. Use when player explicitly says 'next round', 'round 2', 'starting round X', etc. NOTE: You usually don't need this - change_player_turn automatically advances rounds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        round_number: {
          type: Type.INTEGER,
          description: "The new round number"
        }
      },
      required: ["round_number"]
    }
  },
  
  {
    name: "log_stratagem_use",
    description: "Record that a stratagem was used. Automatically deducts CP from the appropriate side.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        stratagem_name: {
          type: Type.STRING,
          description: "Full or partial name of the stratagem used"
        },
        cp_cost: {
          type: Type.INTEGER,
          description: "Command Points spent on this stratagem"
        },
        used_by: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who used the stratagem (attacker or defender)"
        },
        target_unit: {
          type: Type.STRING,
          description: "Unit the stratagem was used on or by (optional)"
        },
        description: {
          type: Type.STRING,
          description: "Brief description of what the stratagem does or context"
        }
      },
      required: ["stratagem_name", "cp_cost", "used_by"]
    }
  },
  
  {
    name: "update_command_points",
    description: "Manually adjust command points (for gaining CP at start of round, corrections, etc.)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Whose CP to update (attacker or defender)"
        },
        change: {
          type: Type.INTEGER,
          description: "Change in CP (positive to add, negative to subtract)"
        },
        reason: {
          type: Type.STRING,
          description: "Why CP changed (e.g., 'gained at start of round', 'correction')"
        }
      },
      required: ["player", "change", "reason"]
    }
  },
  
  {
    name: "update_victory_points",
    description: "Record victory points scored by either side.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who scored the points (attacker or defender)"
        },
        points: {
          type: Type.INTEGER,
          description: "Number of victory points scored"
        },
        source: {
          type: Type.STRING,
          description: "What the points were scored for (e.g., 'Primary Objective', 'Secondary: Assassination', 'Hold One Hold Two')"
        }
      },
      required: ["player", "points", "source"]
    }
  },
  
  {
    name: "update_objective_control",
    description: "Record objective capture, loss, or control change.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        objective_number: {
          type: Type.INTEGER,
          description: "Objective marker number (typically 1-6)"
        },
        controlled_by: {
          type: Type.STRING,
          enum: ["attacker", "defender", "contested", "none"],
          description: "Who controls the objective now (attacker, defender, contested, or none)"
        },
        controlling_unit: {
          type: Type.STRING,
          description: "Name of unit holding the objective (optional)"
        }
      },
      required: ["objective_number", "controlled_by"]
    }
  },
  
  {
    name: "log_unit_action",
    description: "Record a significant unit action like deep strike, advance, charge, fall back, etc.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        unit_name: {
          type: Type.STRING,
          description: "Name of the unit performing the action"
        },
        action_type: {
          type: Type.STRING,
          enum: ["deepstrike", "advance", "charge", "fall_back", "heroic_intervention", "pile_in", "consolidate", "remains_stationary"],
          description: "Type of action performed"
        },
        owner: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who owns this unit (attacker or defender)"
        },
        target: {
          type: Type.STRING,
          description: "Target unit (for charges, etc.) or location (optional)"
        },
        success: {
          type: Type.BOOLEAN,
          description: "Whether the action succeeded (e.g., charge roll passed)"
        },
        details: {
          type: Type.STRING,
          description: "Additional context or notes"
        }
      },
      required: ["unit_name", "action_type", "owner"]
    }
  },
  
  // NOTE: log_combat_result is DEPRECATED - use update_unit_health with combat context params instead
  // The handler is kept in toolHandlers.ts for backwards compatibility with existing logs
  
  {
    name: "query_game_state",
    description: "Query current game state information. Use this when asking a question about the current state.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query_type: {
          type: Type.STRING,
          enum: ["current_phase", "cp_remaining", "victory_points", "objectives_held", "battle_round"],
          description: "Type of information requested"
        },
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender", "both"],
          description: "Which side to query about (optional, defaults to 'both')"
        }
      },
      required: ["query_type"]
    }
  },
  
  {
    name: "set_secondary_objectives",
    description: "Set or update secondary objectives for a side. Usually done during Command Phase at game start.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is setting their secondaries (attacker or defender)"
        },
        secondaries: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Array of 1-3 secondary objective names"
        }
      },
      required: ["player", "secondaries"]
    }
  },
  
  {
    name: "redraw_secondary_objective",
    description: "Discard a secondary objective and draw a new one (costs 1 CP). Use when redrawing or discarding and drawing.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is redrawing (attacker or defender)"
        },
        old_secondary: {
          type: Type.STRING,
          description: "The secondary objective being discarded"
        },
        new_secondary: {
          type: Type.STRING,
          description: "The new secondary objective drawn"
        }
      },
      required: ["player", "old_secondary", "new_secondary"]
    }
  },
  
  {
    name: "score_secondary_vp",
    description: "Award VP for a secondary objective with progress tracking. Use this for any secondary not covered by specific tools.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring VP (attacker or defender)"
        },
        secondary_name: {
          type: Type.STRING,
          description: "Name of the secondary objective being scored"
        },
        vp_amount: {
          type: Type.INTEGER,
          description: "Amount of VP to award"
        },
        progress_update: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              description: "What action was completed (e.g., 'destroyed_unit', 'completed_action', 'controlled_objective')"
            },
            details: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific details like unit names, objective numbers, etc."
            }
          },
          description: "Optional progress details for tracking"
        }
      },
      required: ["player", "secondary_name", "vp_amount"]
    }
  },
  
  {
    name: "score_assassination",
    description: "Score VP for Assassination secondary - destroying CHARACTER models. Automatically calculates VP based on wounds characteristic.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring (who destroyed the character - attacker or defender)"
        },
        character_name: {
          type: Type.STRING,
          description: "Name of the CHARACTER destroyed"
        },
        wounds_characteristic: {
          type: Type.INTEGER,
          description: "Wounds characteristic of the destroyed CHARACTER"
        }
      },
      required: ["player", "character_name", "wounds_characteristic"]
    }
  },
  
  {
    name: "score_bring_it_down",
    description: "Score VP for Bring It Down secondary - destroying MONSTER or VEHICLE units. Automatically calculates VP based on total wounds at starting strength.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring (who destroyed the unit - attacker or defender)"
        },
        unit_name: {
          type: Type.STRING,
          description: "Name of the MONSTER or VEHICLE destroyed"
        },
        total_wounds: {
          type: Type.INTEGER,
          description: "Total wounds characteristic of the unit at starting strength (e.g., 12 for Redemptor, 18 for Land Raider)"
        }
      },
      required: ["player", "unit_name", "total_wounds"]
    }
  },
  
  {
    name: "score_marked_for_death",
    description: "Score VP for Marked for Death secondary when Alpha or Gamma targets are destroyed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        target_type: {
          type: Type.STRING,
          enum: ["alpha", "gamma"],
          description: "Whether this is an Alpha target (5VP) or Gamma target (2VP)"
        },
        unit_name: {
          type: Type.STRING,
          description: "Name of the target unit destroyed"
        }
      },
      required: ["player", "target_type", "unit_name"]
    }
  },
  
  {
    name: "score_no_prisoners",
    description: "Score VP for No Prisoners secondary - destroying units (2VP per unit, up to 5VP per turn).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        unit_name: {
          type: Type.STRING,
          description: "Name of the unit destroyed"
        }
      },
      required: ["player", "unit_name"]
    }
  },
  
  {
    name: "score_cull_the_horde",
    description: "Score VP for Cull the Horde secondary - destroying INFANTRY units with 13+ models (5VP each).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        unit_name: {
          type: Type.STRING,
          description: "Name of the INFANTRY unit destroyed"
        },
        starting_strength: {
          type: Type.INTEGER,
          description: "Starting strength of the unit (including attached units)"
        }
      },
      required: ["player", "unit_name", "starting_strength"]
    }
  },
  
  {
    name: "score_overwhelming_force",
    description: "Score VP for Overwhelming Force secondary - destroying units that started the turn within range of an objective (3VP per unit, up to 5VP per turn).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        unit_name: {
          type: Type.STRING,
          description: "Name of the unit destroyed"
        }
      },
      required: ["player", "unit_name"]
    }
  },
  
  {
    name: "update_unit_health",
    description: "Update unit health/wounds AND log combat context. Use when wounds are dealt, models are removed, or unit takes damage. PREFER models_lost for multi-wound units (player already calculated overkill). Trust player input - excess damage doesn't spill between models in 40K.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        unit_name: {
          type: Type.STRING,
          description: "Name of the unit being damaged (e.g., 'Terminator Squad', 'Librarian')"
        },
        owner: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who owns this unit (attacker or defender)"
        },
        wounds_lost: {
          type: Type.INTEGER,
          description: "Wounds actually applied (after saves, accounting for overkill). Use for partial damage on multi-wound models."
        },
        models_lost: {
          type: Type.INTEGER,
          description: "Models removed from unit. PREFERRED for multi-wound units - player knows how many died after overkill."
        },
        target_model_role: {
          type: Type.STRING,
          enum: ["sergeant", "leader", "heavy_weapon", "special_weapon", "regular"],
          description: "Specific model role to target (e.g., 'sergeant', 'heavy_weapon'). If not specified, damage is distributed smartly."
        },
        context: {
          type: Type.STRING,
          description: "Context for the damage (e.g., 'hit by lascannon', 'failed morale')"
        },
        attacking_unit: {
          type: Type.STRING,
          description: "Unit that caused the damage (for combat logging). Optional but recommended when known."
        },
        attacking_player: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who owns the attacking unit (for combat logging)"
        },
        combat_phase: {
          type: Type.STRING,
          enum: ["Shooting", "Fight"],
          description: "Phase in which combat occurred (for combat logging)"
        }
      },
      required: ["unit_name", "owner"]
    }
  },
  
  {
    name: "mark_unit_destroyed",
    description: "Mark a unit as completely destroyed/wiped out. Use when all models in a unit are removed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        unit_name: {
          type: Type.STRING,
          description: "Name of the unit that was destroyed"
        },
        owner: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who owned this unit (attacker or defender)"
        },
        destroyed_by: {
          type: Type.STRING,
          description: "What destroyed the unit (optional, e.g., 'Dreadnought melee', 'failed battleshock')"
        }
      },
      required: ["unit_name", "owner"]
    }
  },
  
  {
    name: "update_unit_status",
    description: "Update unit status effects like battleshock, buffs, debuffs, or movement state. Use for non-damage status changes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        unit_name: {
          type: Type.STRING,
          description: "Name of the unit"
        },
        owner: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who owns this unit (attacker or defender)"
        },
        is_battle_shocked: {
          type: Type.BOOLEAN,
          description: "Whether unit is battle-shocked (optional)"
        },
        add_effects: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Status effects to add (e.g., 'cover', 'transhuman', 'advance', 'fell_back')"
        },
        remove_effects: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Status effects to remove"
        }
      },
      required: ["unit_name", "owner"]
    }
  },
  
  {
    name: "get_strategic_advice",
    description: "Get relevant stratagems and abilities for the current phase. Use when asking 'what can I do?', 'what should I watch for?', 'what stratagems are available?', or similar strategic questions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query_type: {
          type: Type.STRING,
          enum: ["opportunities", "threats", "all"],
          description: "Type of advice: 'opportunities' (what one side can do), 'threats' (what the other side can do), 'all' (both)"
        }
      },
      required: ["query_type"]
    }
  },
  
  {
    name: "revert_event",
    description: "Revert/undo a previous game event or correct an error. Use when user says 'undo', 'take back', 'actually it was X not Y', or 'correction'. Can revert specific events by type (last stratagem, last phase change) or by description match.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target_event_type: {
          type: Type.STRING,
          enum: ["phase", "stratagem", "objective", "vp", "cp", "combat", "unit_action", "secondary", "any"],
          description: "Type of event to revert. Use 'any' to search by description or recent event."
        },
        search_description: {
          type: Type.STRING,
          description: "Search for event by description keywords (e.g., 'Transhuman', 'Objective 3', 'Intercessors')"
        },
        revert_reason: {
          type: Type.STRING,
          description: "Why the event is being reverted (e.g., 'Correction: was 4 VP not 3', 'Mistake', 'Wrong unit')"
        },
        correction_data: {
          type: Type.OBJECT,
          description: "If this is a correction (not just undo), provide the correct values",
          properties: {
            correct_value: {
              type: Type.STRING,
              description: "The correct value (e.g., '4 VP', '2 CP', 'Objective 4')"
            },
            reapply_corrected: {
              type: Type.BOOLEAN,
              description: "If true, immediately apply corrected version after revert"
            }
          }
        },
        how_far_back: {
          type: Type.STRING,
          enum: ["last", "last_2", "last_3", "specific"],
          description: "How far back to look for the event. Default 'last'."
        }
      },
      required: ["target_event_type", "revert_reason"]
    }
  },

  {
    name: "estimate_damage",
    description: "Calculate estimated damage between an attacker and a defender. Provides average expected wounds, damage, and kills.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        attacker_name: {
          type: Type.STRING,
          description: "Name of the attacking unit (fuzzy match)"
        },
        defender_name: {
          type: Type.STRING,
          description: "Name of the defending unit (fuzzy match)"
        },
        attacker_owner: {
          type: Type.STRING,
          enum: ["attacker", "defender"],
          description: "Who owns the attacking unit"
        },
        weapon_name: {
          type: Type.STRING,
          description: "Specific weapon to use (optional, defaults to all/best)"
        },
        modifiers: {
          type: Type.OBJECT,
          description: "Active modifiers",
          properties: {
            reroll_hits: { type: Type.STRING, enum: ["ones", "all"] },
            reroll_wounds: { type: Type.STRING, enum: ["ones", "all"] },
            plus_to_hit: { type: Type.INTEGER },
            plus_to_wound: { type: Type.INTEGER },
            cover: { type: Type.BOOLEAN },
            stealth: { type: Type.BOOLEAN },
            lethal_hits: { type: Type.BOOLEAN },
            sustained_hits: { type: Type.INTEGER },
            devastating_wounds: { type: Type.BOOLEAN },
            lance: { type: Type.BOOLEAN }
          }
        }
      },
      required: ["attacker_name", "defender_name", "attacker_owner"]
    }
  }
];

// Type definitions remain the same as OpenAI version
// (These are used by the toolHandlers, which work with both providers)
export interface ChangePhaseArgs {
  new_phase: "Command" | "Movement" | "Shooting" | "Charge" | "Fight";
  player_turn: "attacker" | "defender";
}

export interface ChangePlayerTurnArgs {
  player_turn: "attacker" | "defender";
}

export interface AdvanceBattleRoundArgs {
  round_number: number;
}

export interface LogStratagemArgs {
  stratagem_name: string;
  cp_cost: number;
  used_by: "attacker" | "defender";
  target_unit?: string;
  description?: string;
}

export interface UpdateCommandPointsArgs {
  player: "attacker" | "defender";
  change: number;
  reason: string;
}

export interface UpdateVictoryPointsArgs {
  player: "attacker" | "defender";
  points: number;
  source: string;
}

export interface UpdateObjectiveControlArgs {
  objective_number: number;
  controlled_by: "attacker" | "defender" | "contested" | "none";
  controlling_unit?: string;
}

export interface LogUnitActionArgs {
  unit_name: string;
  action_type: "deepstrike" | "advance" | "charge" | "fall_back" | "heroic_intervention" | "pile_in" | "consolidate" | "remains_stationary";
  owner: "attacker" | "defender";
  target?: string;
  success?: boolean;
  details?: string;
}

export interface LogCombatResultArgs {
  attacking_unit: string;
  attacking_player: "attacker" | "defender";
  defending_unit: string;
  defending_player: "attacker" | "defender";
  wounds_dealt?: number;
  models_destroyed?: number;
  unit_destroyed?: boolean;
  phase: "Shooting" | "Fight";
}

export interface QueryGameStateArgs {
  query_type: "current_phase" | "cp_remaining" | "victory_points" | "objectives_held" | "battle_round";
  player?: "attacker" | "defender" | "both";
}

export interface SetSecondaryObjectivesArgs {
  player: "attacker" | "defender";
  secondaries: string[];
}

export interface RedrawSecondaryObjectiveArgs {
  player: "attacker" | "defender";
  old_secondary: string;
  new_secondary: string;
}

export interface UpdateUnitHealthArgs {
  unit_name: string;
  owner: "attacker" | "defender";
  wounds_lost?: number;
  models_lost?: number;
  target_model_role?: "sergeant" | "leader" | "heavy_weapon" | "special_weapon" | "regular";
  context?: string;
  // Combat context (optional - for combat logging)
  attacking_unit?: string;
  attacking_player?: "attacker" | "defender";
  combat_phase?: "Shooting" | "Fight";
}

export interface MarkUnitDestroyedArgs {
  unit_name: string;
  owner: "attacker" | "defender";
  destroyed_by?: string;
}

export interface UpdateUnitStatusArgs {
  unit_name: string;
  owner: "attacker" | "defender";
  is_battle_shocked?: boolean;
  add_effects?: string[];
  remove_effects?: string[];
}

export interface GetStrategicAdviceArgs {
  query_type: "opportunities" | "threats" | "all";
}

export interface EstimateDamageArgs {
  attacker_name: string;
  defender_name: string;
  attacker_owner: "attacker" | "defender";
  weapon_name?: string;
  modifiers?: {
    reroll_hits?: "ones" | "all";
    reroll_wounds?: "ones" | "all";
    plus_to_hit?: number;
    plus_to_wound?: number;
    cover?: boolean;
    stealth?: boolean;
    lethal_hits?: boolean;
    sustained_hits?: number;
    devastating_wounds?: boolean;
    lance?: boolean;
  };
}

// Union type for all possible tool arguments
export type ToolCallArgs = 
  | ChangePhaseArgs
  | AdvanceBattleRoundArgs
  | LogStratagemArgs
  | UpdateCommandPointsArgs
  | UpdateVictoryPointsArgs
  | UpdateObjectiveControlArgs
  | LogUnitActionArgs
  | LogCombatResultArgs
  | QueryGameStateArgs
  | SetSecondaryObjectivesArgs
  | RedrawSecondaryObjectiveArgs
  | UpdateUnitHealthArgs
  | MarkUnitDestroyedArgs
  | UpdateUnitStatusArgs
  | GetStrategicAdviceArgs
  | EstimateDamageArgs;
