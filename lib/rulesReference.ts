/**
 * Warhammer 40K 10th Edition Rules Reference
 * Used by AI to validate game actions and provide context
 */

export const RULES_CHEAT_SHEET = `
=== WARHAMMER 40K 10TH EDITION CORE RULES ===

BATTLE ROUND STRUCTURE:
- Each battle round consists of both players taking a turn
- Turn order is determined by a roll-off at the start of each round
- Each turn follows this phase sequence (MUST be in order):
  1. Command Phase
  2. Movement Phase  
  3. Shooting Phase
  4. Charge Phase
  5. Fight Phase
- After both players complete their turns, advance to next battle round

COMMAND POINTS (CP):
- Players start the game with a CP pool based on game size:
  - Combat Patrol (1000pts): 3 CP
  - Incursion (1000pts): 3 CP  
  - Strike Force (2000pts): 6 CP
  - Onslaught (3000pts): 9 CP

- GAINING CP:
  - Standard: +1 CP at the start of YOUR Command Phase
  - Secondary discard: +1 CP for discarding a secondary at end of YOUR Command Phase
  - Maximum gain per turn: 2 CP (1 standard + 1 from secondary)
  - Rarely, specific abilities grant +1 CP (total: 3 CP/turn max)
  
- SPENDING CP:
  - Stratagems cost 1-3 CP each
  - CP can never go below 0
  - Some stratagems are limited to once per phase or once per battle

- CP VALIDATION RULES:
  - ⚠️ WARNING: If player gains >2 CP in one turn (verify secondary discard or ability)
  - ❌ ERROR: If player would spend more CP than they have
  - ❌ ERROR: If player gains >3 CP in one turn (impossible even with abilities)

STRATAGEMS:
- Cost between 1-3 CP
- Can be used during specific phases
- Some stratagems have usage restrictions:
  - "Once per phase" - can only be used once in that phase
  - "Once per turn" - can only be used once per player turn
  - "Once per battle" - can only be used once the entire game

- STRATAGEM VALIDATION:
  - ⚠️ WARNING: If same stratagem used twice in same phase (check for "once per phase")
  - ⚠️ WARNING: If same stratagem used twice in same turn (check for "once per turn")  
  - ⚠️ WARNING: If stratagem used in wrong phase
  - ❌ ERROR: If "once per battle" stratagem used again

PHASE TRANSITIONS:
- Phases MUST follow the correct sequence within a turn
- Valid transitions within a turn:
  - Command → Movement
  - Movement → Shooting
  - Shooting → Charge
  - Charge → Fight
  - Fight → (end of turn, opponent's Command Phase)

- PHASE TRANSITION VALIDATION:
  - ⚠️ WARNING: If skipping a phase (e.g., Movement → Charge, skipping Shooting)
  - ❌ ERROR: If going backwards (e.g., Shooting → Movement)
  - ❌ ERROR: If invalid transition (e.g., Command → Shooting)
  - ℹ️ INFO: If player says "next phase" without specifying (infer correct next phase)

BATTLE ROUNDS:
- Battle rounds only advance after BOTH players complete their turns
- Rounds typically go 1 → 2 → 3 → 4 → 5
- Game can end after round 5 or continue to round 6+ depending on mission

- ROUND VALIDATION:
  - ⚠️ WARNING: If advancing round in middle of turn (should be after both players)
  - ❌ ERROR: If going backwards in rounds
  - ❌ ERROR: If skipping rounds (e.g., Round 2 → Round 4)

VICTORY POINTS:
- Players score VP from primary and secondary objectives
- Primary objectives typically scored at end of Command Phase
- Secondary objectives have their own scoring conditions
- VP can never be negative

OBJECTIVE MARKERS:
- Typically 6 objective markers on the battlefield
- Controlled by having more OC (Objective Control) value within range
- Can be "player controlled", "opponent controlled", "contested", or "none"
- Control can change multiple times per turn

GENERAL VALIDATION APPROACH:
- Use ⚠️ WARNING for: Unusual but possible actions, need verification
- Use ❌ ERROR for: Rule violations, impossible actions
- Use 🚨 CRITICAL for: Game-breaking errors (wrong round, etc.)
- Always allow manual override - players may have special rules or house rules
`;

export const VALIDATION_GUIDELINES = `
WHEN TO FLAG ACTIONS AS WARNINGS OR ERRORS:

1. CHECK RECENT GAME HISTORY:
   - Has this stratagem been used already this phase/turn/battle?
   - Is the CP gain this round already at 2 or more?
   - Is the phase transition following correct sequence?

2. CHECK CURRENT GAME STATE:
   - Does the player have enough CP for this action?
   - Is this the correct phase for this action?
   - Is the battle round progressing correctly?

3. CONFIDENCE LEVELS:
   - High confidence (>0.9): Execute normally
   - Medium confidence (0.7-0.9): Execute with INFO note
   - Low confidence (0.5-0.7): Execute with WARNING
   - Very low confidence (<0.5): Flag as ERROR, recommend manual verification

4. WHEN IN DOUBT:
   - Err on the side of allowing actions with warnings
   - Provide clear explanation of why flagged
   - Suggest what the player might have meant
   - Always allow manual override
`;

export const SECONDARY_SCORING_RULES = `
=== SECONDARY OBJECTIVE AUTO-CALCULATION ===

The system automatically calculates VP for these secondaries using specialized tools:

1. ASSASSINATION (score_assassination):
   - 3 VP if destroyed CHARACTER has <4 wounds
   - 4 VP if destroyed CHARACTER has 4+ wounds
   - Max 20 VP total
   - Usage: score_assassination(player, character_name, wounds_characteristic)
   - Example: "Destroyed Captain" → score_assassination("attacker", "Captain", 5) = 4 VP

2. BRING IT DOWN (score_bring_it_down):
   - 2 VP base when MONSTER or VEHICLE destroyed
   - +2 VP if unit has 15+ wounds (cumulative: 4 VP total)
   - +2 VP if unit has 20+ wounds (cumulative: 6 VP total)
   - Max 20 VP total
   - Usage: score_bring_it_down(player, unit_name, total_wounds)
   - Example: "Killed Land Raider (18W)" → score_bring_it_down("attacker", "Land Raider", 18) = 4 VP

3. NO PRISONERS (score_no_prisoners):
   - 2 VP per unit destroyed
   - Max 5 VP per turn
   - Max 20 VP total
   - Usage: score_no_prisoners(player, unit_name)
   - Example: "Destroyed Intercessors" → score_no_prisoners("attacker", "Intercessors") = 2 VP

4. MARKED FOR DEATH (score_marked_for_death):
   - 5 VP for Alpha target destroyed
   - 2 VP for Gamma target destroyed
   - Max 20 VP total
   - Usage: score_marked_for_death(player, target_type, unit_name)
   - Example: "Alpha target down" → score_marked_for_death("attacker", "alpha", "...") = 5 VP

5. CULL THE HORDE (score_cull_the_horde):
   - Score when INFANTRY unit with 13+ models destroyed
   - Usage: score_cull_the_horde(player, unit_name, starting_strength)
   - Example: "Destroyed 20-strong Boyz" → score_cull_the_horde("attacker", "Boyz", 20)

6. OVERWHELMING FORCE (score_overwhelming_force):
   - 3 VP per unit destroyed on objective marker
   - Max 5 VP per turn
   - Max 20 VP total
   - Usage: score_overwhelming_force(player, unit_name, objective_number)
   - Example: "Killed unit on Objective 3" → score_overwhelming_force("attacker", "Intercessors", 3) = 3 VP

IMPORTANT SECONDARY RULES:
- System validates secondary is active before scoring
- System enforces max VP limits automatically (20 VP total, per-turn caps)
- System tracks detailed progress (units destroyed, conditions met)
- Voice commands complement manual UI scoring
- Use score_secondary_vp() for secondaries without specialized tools

VALIDATION:
- ⚠️ WARNING: If secondary not active for player
- ❌ ERROR: If max VP would be exceeded
- ❌ ERROR: If per-turn cap would be exceeded
`;

export const CP_VALIDATION_RULES = `
=== COMMAND POINT VALIDATION ===

CP GAIN LIMITS:
- Standard: +1 CP at start of YOUR Command Phase (automatic)
- Secondary Discard: +1 CP for discarding secondary at end of YOUR Command Phase
- Maximum: 2 CP per turn (1 standard + 1 discard)
- Rare abilities: Some abilities grant +1 CP (total 3 CP/turn is absolute max)

CP GAIN RULES (10th Edition):
- Players gain 1 CP at the start of THEIR Command phase
- Players can gain up to 1 additional CP per battle round from other sources (secondary discard, abilities)
- Absolute maximum: 3 CP per turn (1 auto + 2 from abilities/discard - very rare)

USE validate_cp_transaction TOOL:
When CP is mentioned, use validate_cp_transaction to check against rules:
- validate_cp_transaction(player, "gain", amount, reason)
- validate_cp_transaction(player, "spend", amount, "stratagem", stratagem_name)

VALIDATION CHECKS:
- ⚠️ WARNING: If player gains >2 CP in one turn → verify secondary discard or ability
- ❌ ERROR: Cannot spend more CP than available
- ❌ ERROR: Cannot gain >3 CP in one turn (impossible even with abilities)

CP TRANSACTION TRACKING:
- System logs all CP gains/spends with reason
- Tracks CP history per turn/round
- Flags unusual patterns for verification
- Provides detailed audit trail

EXAMPLES:
- "I gain 1 CP" → validate_cp_transaction("attacker", "gain", 1, "automatic")
- "Discard secondary for CP" → validate_cp_transaction("attacker", "gain", 1, "secondary_discard")
- "Use Transhuman for 1 CP" → validate_cp_transaction("attacker", "spend", 1, "stratagem", "Transhuman Physiology")
`;

export const PHASE_REMINDER_RULES = `
=== PHASE TRANSITION REMINDERS ===

When changing phases, the system provides proactive reminders of important game actions.

START OF COMMAND PHASE:
- ✅ Gain 1 CP automatically (system reminds)
- ✅ Check battle-shock tests for units below half-strength
- ✅ Resolve abilities that trigger "at start of Command phase"
- ✅ Draw tactical secondary if needed

END OF COMMAND PHASE:
- ✅ Check primary mission scoring (if mission scores in Command phase)
- ✅ Option to discard tactical secondaries for +1 CP
- ✅ Check secondary scoring opportunities
- ✅ Use check_primary_scoring tool to calculate available VP

START OF MOVEMENT PHASE:
- ✅ Resolve abilities that trigger "at start of Movement phase"
- ✅ Declare which units are Advancing (can't charge, -1 to shoot except Assault weapons)
- ✅ Declare which units Remain Stationary (for bonuses)

START OF SHOOTING PHASE:
- ✅ Resolve abilities that trigger "at start of Shooting phase"
- ✅ Declare shooting order

END OF SHOOTING PHASE:
- ✅ Check secondary scoring (Behind Enemy Lines, etc.)
- ✅ Resolve end-of-phase abilities

START OF CHARGE PHASE:
- ✅ Declare charges
- ✅ Opponent can declare Overwatch

START OF FIGHT PHASE:
- ✅ Determine fight order (alternating activations)
- ✅ Resolve pile-in and consolidate moves

END OF FIGHT PHASE:
- ✅ Check unit destruction for secondaries (Assassination, Bring It Down, No Prisoners)
- ✅ Resolve end-of-phase abilities

END OF TURN:
- ✅ Check if secondaries achieved (discard tactical secondaries if scored)
- ✅ Check for battle-shock tests
- ✅ Resolve end-of-turn abilities
- ✅ Prepare for opponent's turn

The system will provide these reminders automatically when phases change.
`;

export const DAMAGE_CALCULATION_RULES = `
=== DAMAGE CALCULATION INSTRUCTIONS ===

When players ask for damage estimates (e.g., "how much damage will Terminators do to Carnifex?"), 
use the estimate_damage tool. This tool calculates statistical expected damage.

CRITICAL: UNIT NAMES VS WEAPON NAMES
--------------------------------------
The estimate_damage tool takes UNIT names, NOT weapon names.

✅ CORRECT - Unit names from army list:
- "Terminators", "Terminator Squad"
- "Carnifex", "Carnifexes"
- "Logan Grimnar"
- "Hive Tyrant"
- "Wolf Guard Terminators"

❌ WRONG - Weapon or profile names:
- "Axe Morkai — strike" (this is a weapon profile, not a unit)
- "Storm bolter" (this is a weapon)
- "Power fist" (this is a weapon)
- "Logan Grimnar (Axe Morkai — strike)" (don't combine unit + weapon like this)

EXAMPLES OF CORRECT TOOL CALLS:
--------------------------------
Voice: "How much damage will Logan do to Carnifex with his axe strike?"
Tool: estimate_damage(attacker_name="Logan Grimnar", defender_name="Carnifex", weapon_name="Axe Morkai — strike")

Voice: "Terminators shooting at Hormagaunts"
Tool: estimate_damage(attacker_name="Terminators", defender_name="Hormagaunts")

Voice: "What if my Wolf Guard charge into the Termagants with full rerolls?"
Tool: estimate_damage(attacker_name="Wolf Guard", defender_name="Termagants", modifiers={reroll_hits: "all", lance: true})

PHASE-AWARE WEAPON SELECTION:
------------------------------
The system automatically selects appropriate weapons based on current phase:
- Shooting Phase → Ranged weapons (24", 36", etc.)
- Fight Phase → Melee weapons (Range: "Melee")

You can override with weapon_name parameter if player specifies a weapon.

MODIFIER VOICE MAPPINGS:
-------------------------
Listen for these phrases and map to modifier keys:

| Voice Phrase                        | Modifier                    |
|-------------------------------------|-----------------------------|
| "reroll 1s to hit"                  | reroll_hits: "ones"         |
| "full rerolls to hit"               | reroll_hits: "all"          |
| "reroll 1s to wound"                | reroll_wounds: "ones"       |
| "full rerolls to wound"             | reroll_wounds: "all"        |
| "+1 to hit", "plus 1 to hit"        | plus_to_hit: 1              |
| "-1 to hit", "minus 1 to hit"       | plus_to_hit: -1             |
| "+1 to wound", "plus 1 wound"       | plus_to_wound: 1            |
| "in cover", "has cover"             | cover: true                 |
| "has stealth", "stealth keyword"    | stealth: true               |
| "lethal hits active"                | lethal_hits: true           |
| "sustained hits 1", "sustained 2"   | sustained_hits: 1 or 2      |
| "devastating wounds", "dev wounds"  | devastating_wounds: true    |
| "charged", "after charging"         | lance: true                 |
| "target is a vehicle"               | anti_keyword_active: true   |

COMMON SCENARIOS:
------------------
1. Basic shooting: "Terminators shooting Hormagaunts" → no modifiers needed
2. After charge: "Terminators charging into Carnifex" → lance: true (if weapon has LANCE)
3. With stratagem: "With Oath of Moment active" → reroll_hits: "all", reroll_wounds: "all"
4. In cover: "They're in cover" → cover: true
5. Anti-vehicle: "Against the Dreadnought" → anti_keyword_active: true (for Anti-VEHICLE weapons)

IMPORTANT: The system will find the matching units from the army lists using fuzzy matching.
Do NOT include weapon profiles in unit names - pass weapons separately via weapon_name parameter.
`;

