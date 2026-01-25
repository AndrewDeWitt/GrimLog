// AI Tool Definitions for OpenAI Responses API Function Calling
// These tools allow the AI agent to interact with game state

// Responses API uses internally-tagged tool definitions
// Note: We don't use strict: true because most tools have optional parameters,
// and strict mode requires ALL properties to be in the required array
export const AI_TOOLS = [
  {
    type: "function" as const,
    name: "change_phase",
    strict: false,
    description: "Change the current game phase. Use when announcing a move to a new phase.",
    parameters: {
      type: "object",
      properties: {
        new_phase: {
          type: "string",
          enum: ["Command", "Movement", "Shooting", "Charge", "Fight"],
          description: "The phase to transition to"
        },
        player_turn: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Whose turn it is (attacker or defender)"
        }
      },
      required: ["new_phase", "player_turn"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "change_player_turn",
    strict: false,
    description: "Change whose turn it is. Always resets phase to Command. Use when a side finishes their turn and passes to the other side. IMPORTANT: This tool automatically advances the round when the 2nd turn ends. No need to manually check or advance rounds.",
    parameters: {
      type: "object",
      properties: {
        player_turn: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Whose turn it is now (attacker or defender)"
        }
      },
      required: ["player_turn"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "advance_battle_round",
    strict: false,
    description: "Move to the next battle round. Automatically resets to Command phase and sets turn to whoever goes first each round. Use when player explicitly says 'next round', 'round 2', 'starting round X', etc. NOTE: You usually don't need this - change_player_turn automatically advances rounds.",
    parameters: {
      type: "object",
      properties: {
        round_number: {
          type: "integer",
          description: "The new round number",
          minimum: 1,
          maximum: 10
        }
      },
      required: ["round_number"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "log_stratagem_use",
    strict: false,
    description: "Record that a stratagem was used. Automatically deducts CP from the appropriate side.",
    parameters: {
      type: "object",
      properties: {
        stratagem_name: {
          type: "string",
          description: "Full or partial name of the stratagem used"
        },
        cp_cost: {
          type: "integer",
          description: "Command Points spent on this stratagem",
          minimum: 0,
          maximum: 3
        },
        used_by: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who used the stratagem (attacker or defender)"
        },
        target_unit: {
          type: "string",
          description: "Unit the stratagem was used on or by (optional)"
        },
        description: {
          type: "string",
          description: "Brief description of what the stratagem does or context"
        }
      },
      required: ["stratagem_name", "cp_cost", "used_by"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "update_command_points",
    strict: false,
    description: "Manually adjust command points (for gaining CP at start of round, corrections, etc.)",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Whose CP to update (attacker or defender)"
        },
        change: {
          type: "integer",
          description: "Change in CP (positive to add, negative to subtract)"
        },
        reason: {
          type: "string",
          description: "Why CP changed (e.g., 'gained at start of round', 'correction')"
        }
      },
      required: ["player", "change", "reason"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "update_victory_points",
    strict: false,
    description: "Record victory points scored by either side.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who scored the points (attacker or defender)"
        },
        points: {
          type: "integer",
          description: "Number of victory points scored",
          minimum: 0
        },
        source: {
          type: "string",
          description: "What the points were scored for (e.g., 'Primary Objective', 'Secondary: Assassination', 'Hold One Hold Two')"
        }
      },
      required: ["player", "points", "source"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "update_objective_control",
    strict: false,
    description: "Record objective capture, loss, or control change.",
    parameters: {
      type: "object",
      properties: {
        objective_number: {
          type: "integer",
          description: "Objective marker number (typically 1-6)",
          minimum: 1,
          maximum: 6
        },
        controlled_by: {
          type: "string",
          enum: ["attacker", "defender", "contested", "none"],
          description: "Who controls the objective now (attacker, defender, contested, or none)"
        },
        controlling_unit: {
          type: "string",
          description: "Name of unit holding the objective (optional)"
        }
      },
      required: ["objective_number", "controlled_by"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "log_unit_action",
    strict: false,
    description: "Record a significant unit action like deep strike, advance, charge, fall back, etc.",
    parameters: {
      type: "object",
      properties: {
        unit_name: {
          type: "string",
          description: "Name of the unit performing the action"
        },
        action_type: {
          type: "string",
          enum: ["deepstrike", "advance", "charge", "fall_back", "heroic_intervention", "pile_in", "consolidate", "remains_stationary"],
          description: "Type of action performed"
        },
        owner: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who owns this unit (attacker or defender)"
        },
        target: {
          type: "string",
          description: "Target unit (for charges, etc.) or location (optional)"
        },
        success: {
          type: "boolean",
          description: "Whether the action succeeded (e.g., charge roll passed)"
        },
        details: {
          type: "string",
          description: "Additional context or notes"
        }
      },
      required: ["unit_name", "action_type", "owner"],
      additionalProperties: false
    }
  },
  
  // NOTE: log_combat_result is DEPRECATED - use update_unit_health with combat context params instead
  // The handler is kept in toolHandlers.ts for backwards compatibility with existing logs
  
  {
    type: "function" as const,
    name: "query_game_state",
    strict: false,
    description: "Query current game state information. Use this when asking a question about the current state.",
    parameters: {
      type: "object",
      properties: {
        query_type: {
          type: "string",
          enum: ["current_phase", "cp_remaining", "victory_points", "objectives_held", "battle_round"],
          description: "Type of information requested"
        },
        player: {
          type: "string",
          enum: ["attacker", "defender", "both"],
          description: "Which side to query about (optional, defaults to 'both')"
        }
      },
      required: ["query_type"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "set_secondary_objectives",
    strict: false,
    description: "Set or update secondary objectives for a side. Usually done during Command Phase at game start.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is setting their secondaries (attacker or defender)"
        },
        secondaries: {
          type: "array",
          items: { type: "string" },
          description: "Array of 1-3 secondary objective names",
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["player", "secondaries"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "redraw_secondary_objective",
    strict: false,
    description: "Discard a secondary objective and draw a new one (costs 1 CP). Use when redrawing or discarding and drawing.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is redrawing (attacker or defender)"
        },
        old_secondary: {
          type: "string",
          description: "The secondary objective being discarded"
        },
        new_secondary: {
          type: "string",
          description: "The new secondary objective drawn"
        }
      },
      required: ["player", "old_secondary", "new_secondary"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_secondary_vp",
    strict: false,
    description: "Award VP for a secondary objective with progress tracking. Use this for any secondary not covered by specific tools.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring VP (attacker or defender)"
        },
        secondary_name: {
          type: "string",
          description: "Name of the secondary objective being scored"
        },
        vp_amount: {
          type: "integer",
          description: "Amount of VP to award",
          minimum: 1
        },
        progress_update: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "What action was completed (e.g., 'destroyed_unit', 'completed_action', 'controlled_objective')"
            },
            details: {
              type: "array",
              items: { type: "string" },
              description: "Specific details like unit names, objective numbers, etc."
            }
          },
          description: "Optional progress details for tracking"
        }
      },
      required: ["player", "secondary_name", "vp_amount"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_assassination",
    strict: false,
    description: "Score VP for Assassination secondary - destroying CHARACTER models. Automatically calculates VP based on wounds characteristic.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring (who destroyed the character - attacker or defender)"
        },
        character_name: {
          type: "string",
          description: "Name of the CHARACTER destroyed"
        },
        wounds_characteristic: {
          type: "integer",
          description: "Wounds characteristic of the destroyed CHARACTER",
          minimum: 1
        }
      },
      required: ["player", "character_name", "wounds_characteristic"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_bring_it_down",
    strict: false,
    description: "Score VP for Bring It Down secondary - destroying MONSTER or VEHICLE units. Automatically calculates VP based on total wounds at starting strength.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring (who destroyed the unit - attacker or defender)"
        },
        unit_name: {
          type: "string",
          description: "Name of the MONSTER or VEHICLE destroyed"
        },
        total_wounds: {
          type: "integer",
          description: "Total wounds characteristic of the unit at starting strength (e.g., 12 for Redemptor, 18 for Land Raider)",
          minimum: 1
        }
      },
      required: ["player", "unit_name", "total_wounds"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_marked_for_death",
    strict: false,
    description: "Score VP for Marked for Death secondary when Alpha or Gamma targets are destroyed.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        target_type: {
          type: "string",
          enum: ["alpha", "gamma"],
          description: "Whether this is an Alpha target (5VP) or Gamma target (2VP)"
        },
        unit_name: {
          type: "string",
          description: "Name of the target unit destroyed"
        }
      },
      required: ["player", "target_type", "unit_name"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_no_prisoners",
    strict: false,
    description: "Score VP for No Prisoners secondary - destroying units (2VP per unit, up to 5VP per turn).",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        unit_name: {
          type: "string",
          description: "Name of the unit destroyed"
        }
      },
      required: ["player", "unit_name"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_cull_the_horde",
    strict: false,
    description: "Score VP for Cull the Horde secondary - destroying INFANTRY units with 13+ models (5VP each).",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        unit_name: {
          type: "string",
          description: "Name of the INFANTRY unit destroyed"
        },
        starting_strength: {
          type: "integer",
          description: "Starting strength of the unit (including attached units)",
          minimum: 13
        }
      },
      required: ["player", "unit_name", "starting_strength"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "score_overwhelming_force",
    strict: false,
    description: "Score VP for Overwhelming Force secondary - destroying units that started the turn within range of an objective (3VP per unit, up to 5VP per turn).",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who is scoring (attacker or defender)"
        },
        unit_name: {
          type: "string",
          description: "Name of the unit destroyed"
        }
      },
      required: ["player", "unit_name"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "update_unit_health",
    strict: false,
    description: "Update unit health/wounds AND log combat context. Use when wounds are dealt, models are removed, or unit takes damage. PREFER models_lost for multi-wound units (player already calculated overkill). Trust player input - excess damage doesn't spill between models in 40K.",
    parameters: {
      type: "object",
      properties: {
        unit_name: {
          type: "string",
          description: "Name of the unit being damaged (e.g., 'Terminator Squad', 'Librarian')"
        },
        owner: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who owns this unit (attacker or defender)"
        },
        wounds_lost: {
          type: "integer",
          description: "Wounds actually applied (after saves, accounting for overkill). Use for partial damage on multi-wound models.",
          minimum: 0
        },
        models_lost: {
          type: "integer",
          description: "Models removed from unit. PREFERRED for multi-wound units - player knows how many died after overkill.",
          minimum: 0
        },
        target_model_role: {
          type: "string",
          enum: ["sergeant", "leader", "heavy_weapon", "special_weapon", "regular"],
          description: "Specific model role to target (e.g., 'sergeant', 'heavy_weapon'). If not specified, damage is distributed smartly."
        },
        context: {
          type: "string",
          description: "Context for the damage (e.g., 'hit by lascannon', 'failed morale')"
        },
        attacking_unit: {
          type: "string",
          description: "Unit that caused the damage (for combat logging). Optional but recommended when known."
        },
        attacking_player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who owns the attacking unit (for combat logging)"
        },
        combat_phase: {
          type: "string",
          enum: ["Shooting", "Fight"],
          description: "Phase in which combat occurred (for combat logging)"
        }
      },
      required: ["unit_name", "owner"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "mark_unit_destroyed",
    strict: false,
    description: "Mark a unit as completely destroyed/wiped out. Use when all models in a unit are removed.",
    parameters: {
      type: "object",
      properties: {
        unit_name: {
          type: "string",
          description: "Name of the unit that was destroyed"
        },
        owner: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who owned this unit (attacker or defender)"
        },
        destroyed_by: {
          type: "string",
          description: "What destroyed the unit (optional, e.g., 'Dreadnought melee', 'failed battleshock')"
        }
      },
      required: ["unit_name", "owner"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "update_unit_status",
    strict: false,
    description: "Update unit status effects like battleshock, buffs, debuffs, or movement state. Use for non-damage status changes.",
    parameters: {
      type: "object",
      properties: {
        unit_name: {
          type: "string",
          description: "Name of the unit"
        },
        owner: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Who owns this unit (attacker or defender)"
        },
        is_battle_shocked: {
          type: "boolean",
          description: "Whether unit is battle-shocked (optional)"
        },
        add_effects: {
          type: "array",
          items: { type: "string" },
          description: "Status effects to add (e.g., 'cover', 'transhuman', 'advance', 'fell_back')"
        },
        remove_effects: {
          type: "array",
          items: { type: "string" },
          description: "Status effects to remove"
        }
      },
      required: ["unit_name", "owner"],
      additionalProperties: false
    }
  },
  
  {
    type: "function" as const,
    name: "get_strategic_advice",
    strict: false,
    description: "Get relevant stratagems and abilities for the current phase. Use when asking 'what can I do?', 'what should I watch for?', 'what stratagems are available?', or similar strategic questions.",
    parameters: {
      type: "object",
      properties: {
        query_type: {
          type: "string",
          enum: ["opportunities", "threats", "all"],
          description: "Type of advice: 'opportunities' (what one side can do), 'threats' (what the other side can do), 'all' (both)"
        }
      },
      required: ["query_type"],
      additionalProperties: false
    }
  },

  // ============================================
  // SECONDARY OBJECTIVE SCORING TOOLS (Auto-Calculation)
  // ============================================

  {
    type: "function" as const,
    name: "score_assassination",
    strict: false,
    description: "Score Assassination secondary when CHARACTER unit destroyed. System automatically calculates VP: 3 VP if CHARACTER <4 wounds, 4 VP if CHARACTER 4+ wounds. Validates secondary is active and max VP not exceeded.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player scoring the VP"
        },
        character_name: {
          type: "string",
          description: "Name of destroyed CHARACTER unit"
        },
        wounds_characteristic: {
          type: "number",
          description: "Wounds characteristic from datasheet (NOT remaining wounds). Use unit's full wounds stat."
        }
      },
      required: ["player", "character_name", "wounds_characteristic"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "score_bring_it_down",
    strict: false,
    description: "Score Bring It Down secondary when MONSTER or VEHICLE destroyed. System auto-calculates cumulative VP: 2 VP base + 2 VP (15W+) + 2 VP (20W+). Max 20 VP total. Validates secondary is active.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player scoring the VP"
        },
        unit_name: {
          type: "string",
          description: "Name of destroyed MONSTER or VEHICLE"
        },
        total_wounds: {
          type: "number",
          description: "Total wounds characteristic of destroyed unit"
        }
      },
      required: ["player", "unit_name", "total_wounds"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "score_no_prisoners",
    strict: false,
    description: "Score No Prisoners secondary when any unit destroyed. 2 VP per unit. Max 5 VP per turn, 20 VP total. System enforces caps automatically.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player scoring the VP"
        },
        unit_name: {
          type: "string",
          description: "Name of destroyed unit"
        }
      },
      required: ["player", "unit_name"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "score_marked_for_death",
    strict: false,
    description: "Score Marked for Death secondary when designated target destroyed. 5 VP for Alpha target, 2 VP for Gamma target. Max 20 VP total.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player scoring the VP"
        },
        target_type: {
          type: "string",
          enum: ["alpha", "gamma"],
          description: "Type of target destroyed (alpha = 5 VP, gamma = 2 VP)"
        },
        unit_name: {
          type: "string",
          description: "Name of destroyed target unit"
        }
      },
      required: ["player", "target_type", "unit_name"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "score_cull_the_horde",
    strict: false,
    description: "Score Cull the Horde secondary when INFANTRY unit with 13+ models destroyed. System validates starting strength and calculates VP.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player scoring the VP"
        },
        unit_name: {
          type: "string",
          description: "Name of destroyed INFANTRY unit"
        },
        starting_strength: {
          type: "number",
          description: "Number of models unit had at start of game (must be 13+)"
        }
      },
      required: ["player", "unit_name", "starting_strength"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "score_overwhelming_force",
    strict: false,
    description: "Score Overwhelming Force secondary when unit on objective marker destroyed. 3 VP per unit. Max 5 VP per turn, 20 VP total.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player scoring the VP"
        },
        unit_name: {
          type: "string",
          description: "Name of destroyed unit that was on objective"
        },
        objective_number: {
          type: "number",
          description: "Which objective marker the unit was on (1-6)"
        }
      },
      required: ["player", "unit_name", "objective_number"],
      additionalProperties: false
    }
  },

  // ============================================
  // CP VALIDATION & PRIMARY SCORING
  // ============================================

  {
    type: "function" as const,
    name: "validate_cp_transaction",
    strict: false,
    description: "Validate CP gain/spend against game rules. Checks max 2 CP per turn (1 automatic + 1 from secondary discard), tracks CP history, warns on violations. Use before updating CP.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player making CP transaction"
        },
        transaction_type: {
          type: "string",
          enum: ["gain", "spend"],
          description: "Type of CP transaction"
        },
        amount: {
          type: "number",
          description: "Amount of CP to gain or spend"
        },
        reason: {
          type: "string",
          description: "Reason for transaction: 'automatic', 'secondary_discard', 'stratagem', 'ability'"
        },
        stratagem_name: {
          type: "string",
          description: "Name of stratagem if reason is 'stratagem' (optional)"
        }
      },
      required: ["player", "transaction_type", "amount", "reason"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "check_primary_scoring",
    strict: false,
    description: "Check if current phase allows primary mission scoring and calculate available VP based on objectives held. Returns scoring opportunity and VP calculation.",
    parameters: {
      type: "object",
      properties: {
        player: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Player to check scoring for"
        }
      },
      required: ["player"],
      additionalProperties: false
    }
  },

  // ============================================
  // REVERT & CORRECTIONS
  // ============================================

  {
    type: "function" as const,
    name: "revert_event",
    strict: false,
    description: "Revert/undo a previous game event or correct an error. Use when user says 'undo', 'take back', 'actually it was X not Y', or 'correction'. Can revert specific events by type (last stratagem, last phase change) or by description match.",
    parameters: {
      type: "object",
      properties: {
        target_event_type: {
          type: "string",
          enum: ["phase", "stratagem", "objective", "vp", "cp", "combat", "unit_action", "secondary", "any"],
          description: "Type of event to revert. Use 'any' to search by description or recent event."
        },
        search_description: {
          type: "string",
          description: "Search for event by description keywords (e.g., 'Transhuman', 'Objective 3', 'Intercessors')"
        },
        revert_reason: {
          type: "string",
          description: "Why the event is being reverted (e.g., 'Correction: was 4 VP not 3', 'Mistake', 'Wrong unit')"
        },
        correction_data: {
          type: "object",
          description: "If this is a correction (not just undo), provide the correct values",
          properties: {
            correct_value: {
              type: "string",
              description: "The correct value (e.g., '4 VP', '2 CP', 'Objective 4')"
            },
            reapply_corrected: {
              type: "boolean",
              description: "If true, immediately apply corrected version after revert"
            }
          }
        },
        how_far_back: {
          type: "string",
          enum: ["last", "last_2", "last_3", "specific"],
          description: "How far back to look for the event. Default 'last'."
        }
      },
      required: ["target_event_type", "revert_reason"],
      additionalProperties: false
    }
  },

  {
    type: "function" as const,
    name: "estimate_damage",
    strict: false,
    description: `Calculate estimated damage between an attacking UNIT and a defending UNIT. 
IMPORTANT: attacker_name and defender_name are UNIT names from the army list, NOT weapon names.
Examples of correct usage:
- attacker_name: "Terminators", "Wolf Guard", "Carnifex", "Hive Tyrant"
- attacker_name is NEVER: "Storm bolter", "Power fist", "Axe Morkai — strike"
The system will automatically select appropriate weapons based on the current phase (ranged for Shooting, melee for Fight).`,
    parameters: {
      type: "object",
      properties: {
        attacker_name: {
          type: "string",
          description: "Name of the attacking UNIT from the army list (e.g., 'Terminators', 'Carnifex'). This is the unit name, NOT a weapon name."
        },
        defender_name: {
          type: "string",
          description: "Name of the defending UNIT from the army list (e.g., 'Intercessors', 'Hormagaunts'). This is the unit name, NOT a weapon name."
        },
        attacker_owner: {
          type: "string",
          enum: ["attacker", "defender"],
          description: "Which side owns the attacking unit"
        },
        weapon_name: {
          type: "string",
          description: "Optional: Specific weapon profile to use (e.g., 'power fist', 'lascannon'). If omitted, system uses phase-appropriate weapons."
        },
        modifiers: {
          type: "object",
          description: "Combat modifiers from abilities, stratagems, or battlefield conditions. Map voice commands to these keys.",
          properties: {
            reroll_hits: { 
              type: "string", 
              enum: ["ones", "all"],
              description: "Voice: 'reroll 1s to hit' → 'ones', 'full rerolls to hit' → 'all'"
            },
            reroll_wounds: { 
              type: "string", 
              enum: ["ones", "all"],
              description: "Voice: 'reroll 1s to wound' → 'ones', 'full rerolls to wound' → 'all'"
            },
            plus_to_hit: { 
              type: "integer",
              description: "Voice: '+1 to hit', 'plus 1 to hit' → 1, '-1 to hit' → -1"
            },
            plus_to_wound: { 
              type: "integer",
              description: "Voice: '+1 to wound', 'plus 1 wound' → 1"
            },
            cover: { 
              type: "boolean",
              description: "Voice: 'in cover', 'has cover', 'benefit of cover' → true"
            },
            stealth: { 
              type: "boolean",
              description: "Voice: 'has stealth', 'stealth keyword' → true (gives -1 to hit)"
            },
            lethal_hits: { 
              type: "boolean",
              description: "Voice: 'lethal hits active', 'with lethal hits' → true"
            },
            sustained_hits: { 
              type: "integer",
              description: "Voice: 'sustained hits 1', 'sustained 2' → 1 or 2"
            },
            devastating_wounds: { 
              type: "boolean",
              description: "Voice: 'devastating wounds', 'dev wounds' → true"
            },
            lance: { 
              type: "boolean",
              description: "Voice: 'charged', 'after charging', 'lance active' → true (+1 to wound)"
            },
            anti_keyword_active: {
              type: "boolean",
              description: "Voice: 'target is a vehicle', 'anti-infantry applies' → true (enables Anti-X abilities)"
            }
          }
        }
      },
      required: ["attacker_name", "defender_name", "attacker_owner"],
      additionalProperties: false
    }
  }
];

// Type definitions for tool call arguments
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

// NEW: Secondary Objective Scoring Args
export interface ScoreAssassinationArgs {
  player: "attacker" | "defender";
  character_name: string;
  wounds_characteristic: number;
}

export interface ScoreBringItDownArgs {
  player: "attacker" | "defender";
  unit_name: string;
  total_wounds: number;
}

export interface ScoreNoPrisonersArgs {
  player: "attacker" | "defender";
  unit_name: string;
}

export interface ScoreMarkedForDeathArgs {
  player: "attacker" | "defender";
  target_type: "alpha" | "gamma";
  unit_name: string;
}

export interface ScoreCullTheHordeArgs {
  player: "attacker" | "defender";
  unit_name: string;
  starting_strength: number;
}

export interface ScoreOverwhelmingForceArgs {
  player: "attacker" | "defender";
  unit_name: string;
  objective_number: number;
}

// NEW: CP Validation & Primary Scoring Args
export interface ValidateCPTransactionArgs {
  player: "attacker" | "defender";
  transaction_type: "gain" | "spend";
  amount: number;
  reason: string;
  stratagem_name?: string;
}

export interface CheckPrimaryScoringArgs {
  player: "attacker" | "defender";
}

export interface RevertEventArgs {
  target_event_type: "phase" | "stratagem" | "objective" | "vp" | "cp" | "combat" | "unit_action" | "secondary" | "any";
  search_description?: string;
  revert_reason: string;
  correction_data?: {
    correct_value?: string;
    reapply_corrected?: boolean;
  };
  how_far_back?: "last" | "last_2" | "last_3" | "specific";
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
    anti_keyword_active?: boolean;
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
  | ScoreAssassinationArgs
  | ScoreBringItDownArgs
  | ScoreNoPrisonersArgs
  | ScoreMarkedForDeathArgs
  | ScoreCullTheHordeArgs
  | ScoreOverwhelmingForceArgs
  | ValidateCPTransactionArgs
  | CheckPrimaryScoringArgs
  | RevertEventArgs
  | EstimateDamageArgs;
