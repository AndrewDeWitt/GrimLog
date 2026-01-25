# Secondary Objectives Auto-Calculation

## Overview

The Secondary Objectives Auto-Calculation system provides intelligent, rules-based VP scoring for secondary objectives with automatic validation, cap enforcement, and progress tracking.

**Version:** 4.6.0  
**Last Updated:** November 15, 2025  
**Status:** Complete

> **Note:** This document focuses on AI voice scoring. For manual UI scoring and schema details, see [Secondary Objectives System](SECONDARY_OBJECTIVES_SYSTEM.md).

---

## Key Features

✅ **Automatic VP Calculation** - System calculates VP based on official rules  
✅ **Smart Validation** - Checks secondary is active, max VP not exceeded  
✅ **Per-Turn Caps** - Enforces 5 VP/turn limits automatically  
✅ **Wound-Based Scoring** - Calculates Assassination, Bring It Down from unit stats  
✅ **Progress Tracking** - Detailed history of what was scored when  
✅ **Voice Integration** - Natural language scoring via speech

---

## Supported Secondaries

### 1. Assassination

**AI Tool:** `score_assassination`

**Scoring Rules:**
- 3 VP if CHARACTER has <4 wounds
- 4 VP if CHARACTER has 4+ wounds
- Max 20 VP total

**Usage:**
```typescript
score_assassination(
  player: "attacker" | "defender",
  character_name: string,
  wounds_characteristic: number
)
```

**Examples:**
```
Voice: "Destroyed enemy captain"
AI: Looks up Captain wounds (5W), calls score_assassination("attacker", "Captain", 5)
Result: 4 VP scored, total 4/20 VP

Voice: "Killed his lieutenant for assassination"
AI: Looks up Lieutenant wounds (4W), calls score_assassination("attacker", "Lieutenant", 4)
Result: 4 VP scored, total 8/20 VP
```

### 2. Bring It Down

**AI Tool:** `score_bring_it_down`

**Scoring Rules:**
- 2 VP base when MONSTER or VEHICLE destroyed
- +2 VP if unit has 15+ wounds (cumulative: 4 VP)
- +2 VP if unit has 20+ wounds (cumulative: 6 VP)
- Max 20 VP total

**Usage:**
```typescript
score_bring_it_down(
  player: "attacker" | "defender",
  unit_name: string,
  total_wounds: number
)
```

**Examples:**
```
10W Dreadnought: 2 VP (base only)
16W Land Raider: 4 VP (2 base + 2 for 15+)
22W Knight: 6 VP (2 base + 2 for 15+ + 2 for 20+)
```

### 3. No Prisoners

**AI Tool:** `score_no_prisoners`

**Scoring Rules:**
- 2 VP per unit destroyed
- Max 5 VP per turn
- Max 20 VP total

**Usage:**
```typescript
score_no_prisoners(
  player: "attacker" | "defender",
  unit_name: string
)
```

**Per-Turn Cap Example:**
```
Turn 1: Destroy 2 units = 4 VP
Turn 1: Destroy 1 more unit = 2 VP (total 6 VP, but capped at 5 VP)
Result: Only 5 VP scored this turn, 1 VP lost
```

### 4. Marked for Death

**AI Tool:** `score_marked_for_death`

**Scoring Rules:**
- 5 VP for Alpha target destroyed
- 2 VP for Gamma target destroyed
- Max 20 VP total

**Usage:**
```typescript
score_marked_for_death(
  player: "attacker" | "defender",
  target_type: "alpha" | "gamma",
  unit_name: string
)
```

### 5. Cull the Horde

**AI Tool:** `score_cull_the_horde`

**Scoring Rules:**
- Score when INFANTRY unit with 13+ models destroyed
- VP based on starting strength

**Usage:**
```typescript
score_cull_the_horde(
  player: "attacker" | "defender",
  unit_name: string,
  starting_strength: number
)
```

### 6. Overwhelming Force

**AI Tool:** `score_overwhelming_force`

**Scoring Rules:**
- 3 VP per unit destroyed on objective marker
- Max 5 VP per turn
- Max 20 VP total

**Usage:**
```typescript
score_overwhelming_force(
  player: "attacker" | "defender",
  unit_name: string,
  objective_number: number
)
```

---

## Validation System

### Active Secondary Check

Before scoring, system validates:
```typescript
✓ Is this secondary active for the player?
✓ Is max VP total exceeded?
✓ Is per-turn cap exceeded?
```

### Error Handling

**Secondary Not Active:**
```
Error: "attacker doesn't have Assassination active"
Result: VP not scored, error message returned
```

**Max VP Exceeded:**
```
Current: 18/20 VP for Assassination
Attempting: +4 VP (would be 22 VP)
Error: "Would exceed max VP for Assassination (18 + 4 > 20)"
Result: VP not scored, error message returned
```

**Per-Turn Cap Exceeded:**
```
Current Turn: 4 VP scored for No Prisoners
Attempting: +2 VP (would be 6 VP this turn, max 5)
Error: "Would exceed per-turn limit for No Prisoners (4 + 2 > 5 per turn)"
Result: VP not scored, error message returned
```

---

## Progress Tracking

### SecondaryProgress Model

```prisma
model SecondaryProgress {
  id              String
  gameSessionId   String
  player          String
  secondaryName   String
  vpScored        Int
  maxVP           Int
  progressData    Json  // Detailed tracking
  lastScoredRound Int
  lastScoredPhase String
}
```

### Progress Data Structure

```json
{
  "turns": {
    "1": 4,  // Round 1: 4 VP
    "2": 3,  // Round 2: 3 VP
    "3": 6   // Round 3: 6 VP
  },
  "details": [
    {
      "characterName": "Captain",
      "woundsCharacteristic": 5,
      "round": 1,
      "phase": "Fight"
    },
    {
      "characterName": "Lieutenant",
      "woundsCharacteristic": 4,
      "round": 2,
      "phase": "Shooting"
    }
  ]
}
```

---

## Voice Command Examples

### Assassination

✅ "Destroyed captain for assassination"  
✅ "Killed his lieutenant, that's assassinate"  
✅ "Enemy chaplain is dead, score assassination"  

### Bring It Down

✅ "Destroyed land raider for bring it down"  
✅ "Killed dreadnought with 12 wounds"  
✅ "That's bring it down for the tank"  

### No Prisoners

✅ "Destroyed intercessors, no prisoners"  
✅ "Killed his scouts for no prisoners"  
✅ "That unit counts for no prisoners"  

---

## AI Context Integration

### Secondaries Context Tier

When AI loads "secondaries" context tier, it includes:

```
=== ACTIVE SECONDARY OBJECTIVES ===

Attacker Secondaries:
  • Assassination: Score VP when enemy CHARACTER units are destroyed
    Scoring: CHARACTER destroyed
    VP: 4 VP if CHARACTER with 4+ wounds destroyed, 3 VP if CHARACTER with <4 wounds destroyed
    Max: 20 VP total

  • Bring It Down: Score VP when enemy MONSTER or VEHICLE destroyed
    Scoring: MONSTER or VEHICLE destroyed
    VP: 6 VP if 20+ wounds, 4 VP if 15-19 wounds, 2 VP if <15 wounds
    Max: 20 VP total

Current Progress:
Attacker: Assassination: 8/20 VP, Bring It Down: 4/20 VP
Defender: Behind Enemy Lines: 12/20 VP
```

This context allows the AI to:
- Know which secondaries are active
- Understand scoring conditions
- Calculate VP correctly
- Track progress accurately

---

## Extensibility

### Adding New Secondaries

New secondaries are added through the rules parsing system:

**Step 1: Parse from PDF**
```bash
npx tsx scripts/parseGameplayRules.ts --source chapter-approved-2024 --category secondary-objectives
```

**Step 2: Seed to Database**
```bash
npx tsx scripts/seedGameplayRules.ts --category secondary-objectives
```

**Step 3: (Optional) Add Specialized Tool**

If the secondary has complex auto-calculation logic, add a tool:

```typescript
// lib/aiTools.ts
{
  name: "score_new_secondary",
  description: "Score [New Secondary] when [condition]",
  parameters: {
    player: { type: "string", enum: ["attacker", "defender"] },
    // ... secondary-specific params
  }
}

// lib/toolHandlers.ts
async function scoreNewSecondary(args, sessionId) {
  // Implement scoring logic
}
```

Otherwise, use the generic `score_secondary_vp` tool.

---

## Performance

### Query Performance

- **Secondary Lookup:** ~5-10ms (indexed by name)
- **Progress Fetch:** ~5-10ms (unique constraint)
- **Validation:** ~15-20ms (includes lookups)
- **Total Scoring:** ~30-50ms end-to-end

### Optimization

- Secondaries indexed by name for fast lookup
- Progress uses unique constraint for upsert operations
- VP calculation is pure function (no DB queries)

---

## Related Documentation

- [Mission System](./MISSION_SYSTEM.md) - Primary mission tracking
- [Strategic Assistant API](../api/STRATEGIC_ASSISTANT_API.md) - Strategic guidance
- [AI Tools Reference](../api/AI_TOOLS.md) - All available tools

---

## Changelog

### v4.0.0 (November 2024)
- Auto-calculation for 6 major secondaries
- Validation system with max VP enforcement
- Per-turn cap support
- Progress tracking with detailed history
- Integration with voice commands


