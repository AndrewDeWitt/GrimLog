# Analyze API Orchestrator Map

> **Visual guide to understanding the orchestrator, intent classification, context building, and tool execution flow**

---

## 🔄 **Overall Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANALYZE API ENDPOINT                            │
│                        (app/api/analyze/route.ts)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: VALIDATION & FILTERING                                         │
│  ───────────────────────────────                                        │
│  ✓ Authentication Check                                                 │
│  ✓ Transcription Validation (length, quality)                           │
│  ✓ Whisper Hallucination Detection                                      │
│  ✓ Smart Analysis Triggers (priority keywords, time-based)              │
│  ✓ Gatekeeper (GPT-5-nano relevance check)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: REQUEST DEDUPLICATION                                          │
│  ───────────────────────────────                                        │
│  ✓ Check if transcripts already being analyzed                          │
│  ✓ Prevent duplicate tool calls                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: INTENT CLASSIFICATION                                          │
│  ────────────────────────────────                                       │
│  🤖 AI Classification (GPT-5-nano with structured output)                │
│     • Analyzes transcription intent and game state                      │
│     • Returns: Intent category + Context tier + Confidence              │
│     • Intent categories: SIMPLE_STATE, UNIT_OPERATION, STRATEGIC        │
│     • Context tiers: minimal, medium, full                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: CONTEXT BUILDING                                               │
│  ──────────────────────                                                 │
│  Based on context tier, fetch appropriate data:                         │
│                                                                          │
│  📦 MINIMAL (for simple state changes)                                   │
│     • Session state (phase, round, CP, VP)                              │
│     • Recent transcripts (5)                                            │
│                                                                          │
│  📦 MEDIUM (for unit operations)                                         │
│     • Session state                                                     │
│     • All units in session                                              │
│     • Recent transcripts (10)                                           │
│                                                                          │
│  📦 FULL (for strategic operations)                                      │
│     • Session state                                                     │
│     • All units + full datasheets                                       │
│     • All stratagems                                                    │
│     • Recent transcripts (20)                                           │
│     • Game rules                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: GPT-5 ANALYSIS                                                 │
│  ─────────────────────                                                  │
│  • Calls GPT-5-mini with:                                               │
│    - System prompt (formatted context)                                  │
│    - User transcription                                                 │
│    - 17 available tools (function calling)                              │
│    - Parallel tool calls enabled                                        │
│                                                                          │
│  • Returns: 0-N tool calls to execute                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 6: TOOL EXECUTION                                                 │
│  ─────────────────────                                                  │
│  • Execute all tool calls in PARALLEL                                   │
│  • Each tool updates database and creates timeline events               │
│  • Validation checks during execution                                   │
│  • Cache invalidation                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 7: RESPONSE                                                       │
│  ───────────────────                                                    │
│  • Return tool execution results                                        │
│  • Log to Langfuse (observability)                                      │
│  • Update client UI                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Intent Classification System**

The orchestrator uses AI classification for all intents:

### AI Classification (GPT-5-nano)
**File:** `lib/intentOrchestrator.ts` → `orchestrateIntent()` → `classifyIntent()`

```typescript
Transcription + Game State → GPT-5-nano → Structured Output

OUTPUT SCHEMA:
{
  intent: IntentCategory,       // SIMPLE_STATE | UNIT_OPERATION | STRATEGIC | UNCLEAR
  contextTier: ContextTier,     // minimal | medium | full
  confidence: number,           // 0.0 - 1.0
  reasoning: string             // Explanation
}
```

#### Intent Categories

| Intent Category | Description | Context Tier | Examples |
|----------------|-------------|--------------|----------|
| **SIMPLE_STATE** | Phase changes, round advancement, simple queries | `minimal` | "Moving to shooting", "What's my CP?" |
| **UNIT_OPERATION** | Health updates, unit status, unit actions | `medium` | "My terminators took 6 wounds", "Captured objective 3" |
| **STRATEGIC** | Stratagems, combat logging, strategic questions | `full` | "Using transhuman physiology", "What stratagems are available?" |
| **UNCLEAR** | Ambiguous or uncertain | `full` | Fallback for safety |

---

## 📦 **Context Tier System**

**File:** `lib/contextBuilder.ts` → `buildContext()`

### Minimal Context
**Use Case:** Simple state changes, phase/round updates, basic queries

```typescript
{
  tier: 'minimal',
  session: {
    id, battleRound, currentPhase, currentPlayerTurn,
    playerCP, opponentCP, playerVP, opponentVP
  },
  recentTranscripts: [...], // Last 5 transcripts
  timestamp: Date
}
```

### Medium Context
**Use Case:** Unit operations, health updates, objective control

```typescript
{
  tier: 'medium',
  session: { /* full session state */ },
  units: {
    player: [...],    // All player units with basic data
    opponent: [...]   // All opponent units with basic data
  },
  recentTranscripts: [...], // Last 10 transcripts
  timestamp: Date
}
```

### Full Context
**Use Case:** Strategic operations, stratagems, complex queries

```typescript
{
  tier: 'full',
  session: { /* full session state */ },
  units: {
    player: [...],    // All units with FULL datasheets
    opponent: [...]   // All units with FULL datasheets
  },
  stratagems: {
    player: [...],    // All player army stratagems
    opponent: [...]   // All opponent army stratagems
  },
  recentTranscripts: [...], // Last 20 transcripts
  gameRules: { /* core rules */ },
  timestamp: Date
}
```

---

## 🛠️ **Available Tools**

**File:** `lib/aiTools.ts` → `AI_TOOLS[]`

GPT-5 can call any of these 17 tools based on transcription analysis:

### 📊 Game State Management

#### 1. `change_phase`
Change the current game phase.

**Parameters:**
- `new_phase`: "Command" | "Movement" | "Shooting" | "Charge" | "Fight"
- `player_turn`: "player" | "opponent"

**Example:** "Moving to shooting phase"

---

#### 2. `advance_battle_round`
Move to the next battle round (resets to Command phase).

**Parameters:**
- `round_number`: integer (1-10)

**Example:** "Starting round 2"

---

#### 3. `update_command_points`
Manually adjust command points.

**Parameters:**
- `player`: "player" | "opponent"
- `change`: integer (positive to add, negative to subtract)
- `reason`: string

**Example:** "Gained 1 CP at start of round"

---

#### 4. `update_victory_points`
Record victory points scored.

**Parameters:**
- `player`: "player" | "opponent"
- `points`: integer
- `source`: string (e.g., "Primary Objective", "Secondary: Assassination")

**Example:** "I scored 5 VP from primary"

---

#### 5. `query_game_state`
Query current game state information.

**Parameters:**
- `query_type`: "current_phase" | "cp_remaining" | "victory_points" | "objectives_held" | "battle_round"
- `player`: "player" | "opponent" | "both" (optional)

**Example:** "How many CP do I have?"

---

### 🎖️ Stratagem Management

#### 6. `log_stratagem_use`
Record stratagem usage (automatically deducts CP).

**Parameters:**
- `stratagem_name`: string
- `cp_cost`: integer (0-3)
- `used_by`: "player" | "opponent"
- `target_unit`: string (optional)
- `description`: string (optional)

**Example:** "Using transhuman physiology on my terminators"

---

#### 7. `set_secondary_objectives`
Set or update secondary objectives.

**Parameters:**
- `player`: "player" | "opponent"
- `secondaries`: string[] (1-3 items)

**Example:** "My secondaries are assassination, banners, engage"

---

#### 8. `redraw_secondary_objective`
Discard and redraw a secondary (costs 1 CP).

**Parameters:**
- `player`: "player" | "opponent"
- `old_secondary`: string
- `new_secondary`: string

**Example:** "Redrawing assassination for banners"

---

### 🎯 Objective Control

#### 9. `update_objective_control`
Record objective capture/loss.

**Parameters:**
- `objective_number`: integer (1-6)
- `controlled_by`: "player" | "opponent" | "contested" | "none"
- `controlling_unit`: string (optional)

**Example:** "Captured objective 3 with my terminators"

---

### 🪖 Unit Operations

#### 10. `update_unit_health`
Update wounds/models lost for a unit.

**Parameters:**
- `unit_name`: string
- `owner`: "player" | "opponent"
- `wounds_lost`: integer (optional)
- `models_lost`: integer (optional)
- `target_model_role`: "sergeant" | "leader" | "heavy_weapon" | "special_weapon" | "regular" (optional)
- `context`: string (optional)

**Features:**
- Smart per-model wound tracking
- Automatic model destruction when wounds depleted
- Protects special models (sergeants, heavy weapons)
- Targets wounded models first

**Example:** "My terminators took 6 wounds"

---

#### 11. `mark_unit_destroyed`
Mark a unit as completely destroyed.

**Parameters:**
- `unit_name`: string
- `owner`: "player" | "opponent"
- `destroyed_by`: string (optional)

**Example:** "My dreadnought is wiped out"

---

#### 12. `update_unit_status`
Update status effects (battleshock, buffs, debuffs).

**Parameters:**
- `unit_name`: string
- `owner`: "player" | "opponent"
- `is_battle_shocked`: boolean (optional)
- `add_effects`: string[] (optional)
- `remove_effects`: string[] (optional)

**Example:** "My terminators are battle-shocked"

---

#### 13. `log_unit_action`
Record unit actions (deepstrike, advance, charge, etc.).

**Parameters:**
- `unit_name`: string
- `action_type`: "deepstrike" | "advance" | "charge" | "fall_back" | "heroic_intervention" | "pile_in" | "consolidate" | "remains_stationary"
- `owner`: "player" | "opponent"
- `target`: string (optional)
- `success`: boolean (optional)
- `details`: string (optional)

**Example:** "My terminators deep struck near objective 2"

---

### ⚔️ Combat Logging

#### 14. `log_combat_result`
Record combat outcomes.

**Parameters:**
- `attacking_unit`: string
- `attacking_player`: "player" | "opponent"
- `defending_unit`: string
- `defending_player`: "player" | "opponent"
- `wounds_dealt`: integer (optional)
- `models_destroyed`: integer (optional)
- `unit_destroyed`: boolean (optional)
- `phase`: "Shooting" | "Fight"

**Example:** "My dreadnought killed 3 space marines in shooting"

---

### 🎲 Strategic Assistant

#### 15. `get_strategic_advice`
Get relevant stratagems and abilities for current phase.

**Parameters:**
- `query_type`: "opportunities" | "threats" | "all"

**Features:**
- Analyzes current game state
- Returns phase-appropriate stratagems
- Shows player options and opponent threats
- Includes CP costs and timing windows

**Example:** "What can I do in the fight phase?"

---

## 🔧 **Tool Execution Flow**

**File:** `lib/toolHandlers.ts` → `executeToolCall()`

```
GPT-5 Response → Extract Tool Calls → Execute in Parallel

For Each Tool:
  ┌────────────────────────────────────────┐
  │ 1. Parse arguments                     │
  │ 2. Validate parameters                 │
  │ 3. Smart unit matching (if unit tool)  │
  │ 4. Fetch game context                  │
  │ 5. Validate against rules              │
  │ 6. Execute database update             │
  │ 7. Create timeline event               │
  │ 8. Invalidate caches                   │
  │ 9. Return result with validation       │
  └────────────────────────────────────────┘
```

### Tool Execution Features

#### Smart Unit Matching
**File:** `lib/unitMatching.ts`

When a tool references a unit by name, the system uses fuzzy matching:

```typescript
"terminators" → Matches: "Terminator Squad A"
"my dread"    → Matches: "Redemptor Dreadnought"
"logan"       → Matches: "Logan Grimnar"
```

Matching strategies:
1. Exact match
2. Partial name match
3. Datasheet name match
4. Nickname match

#### Validation System
**File:** `lib/validationHelpers.ts`

Each tool execution includes validation checks:

```typescript
Validation Result:
{
  severity: 'valid' | 'warning' | 'error',
  message: string,
  rule: string,
  suggestion?: string,
  requiresOverride?: boolean
}
```

Examples:
- **Warning:** "Stratagem typically used in Shooting phase (current: Movement)"
- **Error:** "Insufficient CP: player has 1 CP but stratagem costs 2 CP"

#### Cache Invalidation

After tool execution, relevant caches are invalidated:

```typescript
Session Changes (phase, CP, VP):
  ✓ Invalidate: /api/sessions/{id}
  ✓ Invalidate: /api/sessions/{id}/events

Unit Changes (health, status):
  ✓ Invalidate: /api/sessions/{id}
  ✓ Invalidate: /api/sessions/{id}/events
  ✓ Invalidate: /api/sessions/{id}/units
```

---

## 📊 **Tool Categories Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOOL CATEGORIES                          │
└─────────────────────────────────────────────────────────────────┘

📊 GAME STATE (5 tools)
   ├─ change_phase
   ├─ advance_battle_round
   ├─ update_command_points
   ├─ update_victory_points
   └─ query_game_state

🎖️ STRATAGEMS (3 tools)
   ├─ log_stratagem_use
   ├─ set_secondary_objectives
   └─ redraw_secondary_objective

🎯 OBJECTIVES (1 tool)
   └─ update_objective_control

🪖 UNITS (4 tools)
   ├─ update_unit_health          ⭐ Most complex (per-model tracking)
   ├─ mark_unit_destroyed
   ├─ update_unit_status
   └─ log_unit_action

⚔️ COMBAT (1 tool)
   └─ log_combat_result

🎲 STRATEGIC (1 tool)
   └─ get_strategic_advice

Total: 17 tools
```

---

## 🔍 **Example Orchestration Flow**

### Example 1: Simple Phase Change

```
User Speech: "Moving to shooting phase"
     ↓
AI Classification: SIMPLE_STATE
Context Tier: minimal
     ↓
Context Built: Session state only
     ↓
GPT-5 Analysis: Detects phase change
     ↓
Tool Called: change_phase({
  new_phase: "Shooting",
  player_turn: "player"
})
     ↓
Result: Phase updated, timeline event created
```

### Example 2: Unit Health Update

```
User Speech: "My terminators took 6 wounds from his lascannons"
     ↓
AI Classification: UNIT_OPERATION
Context Tier: medium
     ↓
Context Built: Session + Units + Recent transcripts
     ↓
GPT-5 Analysis: Detects health update
     ↓
Tool Called: update_unit_health({
  unit_name: "terminators",
  owner: "player",
  wounds_lost: 6,
  context: "hit by lascannons"
})
     ↓
Smart Unit Matching: "terminators" → "Terminator Squad A"
Per-Model Tracking: Distributes 6 wounds across models
     ↓
Result: 2 models killed, 3 remaining (warning: half strength)
```

### Example 3: Strategic Query

```
User Speech: "What stratagems can I use in the fight phase?"
     ↓
AI Classification: STRATEGIC
Context Tier: full
     ↓
Context Built: Session + Units + Datasheets + Stratagems + Rules
     ↓
GPT-5 Analysis: Detects strategic query
     ↓
Tool Called: get_strategic_advice({
  query_type: "opportunities"
})
     ↓
Strategic Assistant: Filters stratagems by phase and availability
     ↓
Result: Returns list of 5 relevant stratagems with CP costs
```

---

## 🎨 **Visual Tool Map**

```
                     🎤 TRANSCRIPTION INPUT
                              │
                              ▼
                  ┌─────────────────────┐
                  │   ORCHESTRATOR      │
                  │  (Intent + Context) │
                  └─────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   GPT-5-mini    │
                     │ (Tool Selection) │
                     └─────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │  Tool 1  │  │  Tool 2  │  │  Tool N  │
         └──────────┘  └──────────┘  └──────────┘
                │             │             │
                └─────────────┼─────────────┘
                              ▼
                     ┌─────────────────┐
                     │ Parallel Execute │
                     └─────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Update DB│  │Timeline  │  │ Validate │
         └──────────┘  └──────────┘  └──────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Response to UI │
                     └─────────────────┘
```

---

## 📚 **Key Files Reference**

| File | Purpose |
|------|---------|
| `app/api/analyze/route.ts` | Main endpoint, orchestrates entire flow |
| `lib/intentOrchestrator.ts` | Intent classification (AI) |
| `lib/contextBuilder.ts` | Context tier building |
| `lib/aiTools.ts` | Tool definitions (17 tools) |
| `lib/toolHandlers.ts` | Tool execution logic |
| `lib/unitMatching.ts` | Smart unit name matching |
| `lib/validationHelpers.ts` | Rule validation |
| `lib/strategicAssistant.ts` | Strategic advice engine |
| `lib/analysisTriggers.ts` | Smart trigger detection |
| `lib/audioValidation.ts` | Transcription validation |

---

## 🎯 **Performance Optimizations**

### 1. Tiered Context
- Minimal context: ~500 tokens
- Medium context: ~2000 tokens
- Full context: ~10000 tokens

### 2. Parallel Tool Execution
- All tools execute simultaneously
- Reduces latency by ~50%

### 3. Request Deduplication
- Prevents duplicate analysis
- Saves API costs

### 4. Smart Caching
- Selective cache invalidation
- Only invalidate what changed

---

## 🔧 **Debugging Tips**

### Check Intent Classification
Look for console logs:
```
🎯 Intent classified: UNIT_OPERATION → medium (confidence: 0.87)
   Reasoning: Player reporting damage to unit
```

### Check Tool Execution
Look for console logs:
```
Executing tool: update_unit_health { unit_name: "terminators", wounds_lost: 6 }
Tool update_unit_health result: { success: true, ... }
```

### Check Context Tier
Look for console logs:
```
🎯 Context tier selected: medium
```

### Trace in Langfuse
Every request is logged to Langfuse with:
- Intent classification
- Context tier
- Tool calls
- Execution times
- Validation results

---

## ❓ **Common Questions**

**Q: How does GPT-5 know which tool to use?**
A: The tool descriptions and current game context guide the model. The system prompt instructs it to be assertive and accurate.

**Q: Can GPT-5 call multiple tools at once?**
A: Yes! Parallel tool calls are enabled, so it can execute multiple operations simultaneously.

**Q: What if a unit name doesn't match exactly?**
A: The smart unit matching system uses fuzzy matching to find the closest match (see `lib/unitMatching.ts`).

**Q: How are validation errors handled?**
A: Tools still execute but return validation warnings/errors that appear in the UI as toast notifications.

**Q: Can I add new tools?**
A: Yes! Add to `AI_TOOLS` in `lib/aiTools.ts` and implement the handler in `lib/toolHandlers.ts`.

---

## 📝 **Next Steps**

- **Add custom tool:** See [`docs/guides/ADDING_NEW_TOOL.md`](./ADDING_NEW_TOOL.md)
- **Understand validation:** See [`docs/guides/VALIDATION_SYSTEM.md`](./VALIDATION_SYSTEM.md)
- **Debug issues:** See [`docs/troubleshooting/`](../troubleshooting/)

