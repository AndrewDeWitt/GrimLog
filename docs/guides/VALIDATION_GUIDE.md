# 🛡️ Game Validation System Guide

**Last Updated:** October 6, 2025  
**Status:** Backend Complete, UI Integration Pending

## Overview

Grimlog's AI-driven validation system checks game actions against Warhammer 40K rules and current game state, providing contextual warnings with manual override capability.

## Table of Contents

1. [How Validation Works](#how-validation-works)
2. [Validation Types & Severities](#validation-types--severities)
3. [Validation Rules](#validation-rules)
4. [Implementation Status](#implementation-status)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Future Enhancements](#future-enhancements)

---

## How Validation Works

### Architecture Flow

```
User Speech
    ↓
Whisper Transcription
    ↓
AI Analysis (with full game state context)
    ↓
Tool Execution (with validation checks)
    ↓
Validation Result (if issues detected)
    ↓
UI Toast (with override option)
    ↓
User Override (optional)
```

### Context-Aware Validation

The AI receives complete game context before making decisions:

**Game State:**
- Current phase, round, turn
- CP counts (player & opponent)
- Victory points (player & opponent)
- Objectives held
- Current game statistics

**Recent History:**
- Recent stratagems used (last 10 mins)
- Conversation history (last 10-15 transcripts)
- Recent phase transitions

**Rules Reference:**
- Warhammer 40K 10th Edition rules cheat sheet
- Phase transition rules
- CP gain/loss rules
- Stratagem usage restrictions

### Validation Process

#### 1. Game Context Fetching

**File:** `lib/validationHelpers.ts`

```typescript
const context = await fetchGameContext(sessionId);
```

**Returns:**
- `session`: Current game session data
- `recentStratagems`: Stratagems used recently
- `objectives`: Objective marker control

#### 2. Validation Check

Each tool can trigger validation checks:

```typescript
const validation = validateStratagemUse(
  stratagemName,
  usedBy,
  phase,
  context
);
```

#### 3. Validation Result

```typescript
{
  severity: 'warning',
  message: '"Transhuman" may have already been used this phase',
  rule: 'duplicate_stratagem_this_phase',
  suggestion: 'Check if stratagem has "once per phase" restriction',
  requiresOverride: true
}
```

#### 4. Attached to Tool Result

```typescript
{
  toolName: 'log_stratagem_use',
  success: true,
  message: 'Transhuman Physiology used (-2 CP, 0 CP remaining)',
  data: { ... },
  validation: { ... } // ← Validation result here
}
```

---

## Validation Types & Severities

### Severity Levels

| Severity | Icon | Color | Use Case | Auto-Dismiss | Requires Override |
|----------|------|-------|----------|--------------|-------------------|
| **valid** | ✓ | Green | No issues | N/A | No |
| **info** | ℹ | Blue | FYI, unusual but ok | Yes (10s) | No |
| **warning** | ⚠ | Amber | Suspicious, verify | No | Yes |
| **error** | ✕ | Red | Rule violation | No | Yes |
| **critical** | 🚨 | Dark Red | Severe mistake | No | Yes |

### Example Validations by Severity

#### ✅ Valid Action (No Warning)
```
User: "Using Transhuman on my Terminators"
CP Available: 2 CP
Recent Stratagems: None
→ No validation warning, action executes normally
```

#### ℹ Info (Auto-Dismiss)
```
User: "Using Transhuman on my Terminators"
Recent: Transhuman used this turn (but different phase)
→ INFO: "Transhuman" was used earlier this turn
💡 If stratagem has "once per turn" restriction, this may be invalid
```

#### ⚠️ Warning (User Action Required)
```
User: "Using Transhuman on my Terminators"
CP Available: 2 CP
Recent Stratagems: Transhuman (this phase)
→ WARNING: "Transhuman" may have already been used this phase
💡 Check if stratagem has "once per phase" restriction
```

#### ❌ Error (User Action Required)
```
User: "Using Transhuman on my Terminators"
CP Available: 0 CP
Recent Stratagems: None
→ ERROR: Insufficient CP (player has 0 CP, stratagem costs 2 CP)
💡 Verify CP cost or current CP total
```

#### 🚨 Critical (Severe Issue)
```
User: "Moving to Battle Round 1"
Current Round: 3
→ CRITICAL: Cannot go backwards from Round 3 to Round 1
💡 Verify the intended round number
```

---

## Validation Rules

### Phase Transition Rules

**Validator:** `validatePhaseTransition()`

**Valid Phase Sequence:**
```
Command → Movement → Shooting → Charge → Fight
```

| Scenario | Severity | Example |
|----------|----------|---------|
| Forward progression | ✅ Valid | Command → Movement |
| Skipping phase | ℹ Info | Command → Shooting |
| Backwards transition | ❌ Error | Shooting → Movement |
| Same phase repeated | ⚠️ Warning | Shooting → Shooting |

**Implementation:** `lib/validationHelpers.ts`

### Battle Round Rules

**Validator:** `validateRoundAdvancement()`

**Valid Round Progression:**
```
Round 1 → 2 → 3 → 4 → 5
```

| Scenario | Severity | Example |
|----------|----------|---------|
| Sequential advance | ✅ Valid | Round 2 → 3 |
| Skipping round | ❌ Error | Round 2 → 4 |
| Going backwards | 🚨 Critical | Round 3 → 2 |
| Same round | ⚠️ Warning | Round 2 → 2 |

**Implementation:** `lib/validationHelpers.ts`

### Command Point Rules

**Validator:** `validateCommandPointChange()`

**CP Gain/Loss Rules:**
- Normal gain: +1 CP per Command Phase
- Maximum starting CP: 10
- Normal stratagem cost: 1-3 CP

| Scenario | Severity | Example |
|----------|----------|---------|
| Normal gain (+1-2 CP) | ✅ Valid | +1 CP in Command |
| High gain (+3 CP) | ⚠️ Warning | +3 CP at once |
| Excessive gain (+4+ CP) | 🚨 Critical | +5 CP at once |
| Spending more than available | ❌ Error | Spend 3 CP with 0 available |
| Negative CP | ℹ Info | CP drops below 0 (clamped) |

**Implementation:** `lib/validationHelpers.ts`

### Stratagem Usage Rules

**Validator:** `validateStratagemUse()`

**Duplication Detection:**

| Scenario | Severity | Example |
|----------|----------|---------|
| First use this phase | ✅ Valid | Transhuman (first time) |
| Used this phase | ⚠️ Warning | Transhuman (2nd time same phase) |
| Used this turn | ℹ Info | Transhuman (2nd time same turn) |
| Insufficient CP | ❌ Error | 2 CP stratagem with 0 CP |

**Time Windows:**
- **Phase:** Last 5 minutes, same phase, same turn
- **Turn:** Last 15 minutes, same turn
- **Battle Round:** Last 30 minutes

**Implementation:** `lib/validationHelpers.ts`

---

## Implementation Status

### ✅ Backend Complete

**Files Implemented:**

1. **`lib/rulesReference.ts`** ✅
   - Warhammer 40K 10th Edition rules cheat sheet
   - CP gain/loss rules with examples
   - Phase transition rules
   - Stratagem usage restrictions
   - Validation severity guidelines

2. **`lib/types.ts`** ✅
   - `ValidationSeverity` type
   - `ValidationResult` interface
   - Enhanced `ToolExecutionResult` with validation

3. **`lib/validationHelpers.ts`** ✅
   - `fetchGameContext()` - Load game state
   - `buildGameStatePrompt()` - Generate context for AI
   - `validateStratagemUse()` - Check duplication
   - `validatePhaseTransition()` - Check phase sequence
   - `validateCommandPointChange()` - Check CP changes
   - `validateRoundAdvancement()` - Check round progression

4. **`lib/toolHandlers.ts`** ✅
   - Validation integrated into:
     - `changePhase()`
     - `advanceBattleRound()`
     - `logStratagemUse()`
     - `updateCommandPoints()`

5. **`app/api/analyze/route.ts`** ✅
   - Game context fetched before AI analysis
   - Full context injected into AI prompt
   - AI has complete game state for decisions

6. **`components/ValidationToast.tsx`** ✅
   - Beautiful validation toast component
   - Severity-based styling
   - Override buttons
   - Auto-dismiss for info messages

### 🚧 UI Integration Pending

**What's Needed:**

1. **Main Page** (`app/page.tsx`)
   - Display `ValidationToast` components
   - Handle tool results with validation warnings
   - Override button handlers
   - Track overridden validations

2. **Validation State Management**
   - Track active validation warnings
   - Handle multiple simultaneous warnings
   - Stack toasts properly
   - Dismiss/override independently

3. **Timeline Visual Feedback** (Optional)
   - Validation icons next to timeline events
   - Badge for overridden actions
   - Filter by validation issues

### 📊 Future Enhancements

1. **Validation Analytics** (Phase 4)
   - Track validation events in database
   - Learn which rules are frequently triggered
   - Identify user patterns
   - Improve AI accuracy over time

2. **RAG System** (Phase 5)
   - Rule query system ("What's the CP gain rule?")
   - Semantic search of rule text
   - Rule citations in UI

---

## Configuration

### Validation Sensitivity

**File:** `lib/validationHelpers.ts`

**Time Windows for Duplicate Detection:**

```typescript
// Stratagem usage time windows
const SAME_PHASE_WINDOW = 5 * 60 * 1000;  // 5 minutes
const SAME_TURN_WINDOW = 15 * 60 * 1000;  // 15 minutes
const SAME_ROUND_WINDOW = 30 * 60 * 1000; // 30 minutes
```

**Adjust based on game pace:**
- Fast games: Reduce windows (3 min / 10 min / 20 min)
- Slow games: Increase windows (10 min / 20 min / 45 min)

### Rules Reference

**File:** `lib/rulesReference.ts`

To add custom house rules or modify validation behavior, edit the rules cheat sheet that's sent to the AI.

**Example: Adding Custom CP Gain Rule**

```typescript
export const RULES_REFERENCE = `
...
### Command Point Gains

- Standard: +1 CP at start of Command Phase
- House Rule: +1 CP when objective captured (custom)
...
`;
```

The AI will consider this when validating CP changes.

### Disable Validation (Testing Only)

To temporarily disable validation for testing:

**File:** `lib/toolHandlers.ts`

```typescript
// Comment out validation calls
// const validation = validatePhaseTransition(...);
// if (validation.severity !== 'valid') {
//   return { ...result, validation };
// }
```

---

## Testing

### Manual Test Scenarios

#### Test 1: Valid Phase Transition

**Setup:**
1. Start game session
2. Say: "Moving to Movement phase"

**Expected:**
- ✅ Phase changes to Movement
- No validation warning
- Tool result: `success: true`

#### Test 2: Invalid Phase Transition (Backwards)

**Setup:**
1. In Shooting phase
2. Say: "Moving to Movement phase"

**Expected:**
- ❌ Phase changes (always execute)
- Validation ERROR shown
- Message: "Invalid phase transition: Cannot go backwards from Shooting to Movement"

#### Test 3: Insufficient CP for Stratagem

**Setup:**
1. Set CP to 0 (manually or use all)
2. Say: "Using Transhuman Physiology" (costs 2 CP)

**Expected:**
- ❌ Stratagem logged (always execute)
- Validation ERROR shown
- Message: "Insufficient CP: player has 0 CP but stratagem costs 2 CP"
- CP remains at 0 (clamped)

#### Test 4: Duplicate Stratagem Warning

**Setup:**
1. Say: "Using Transhuman Physiology"
2. Wait 30 seconds
3. Say: "Using Transhuman again" (same phase)

**Expected:**
- ⚠️ Stratagem logged (always execute)
- Validation WARNING shown
- Message: '"Transhuman Physiology" may have already been used this phase'

#### Test 5: Round Regression (Critical)

**Setup:**
1. In Round 3
2. Say: "Moving to Round 1"

**Expected:**
- 🚨 Round changes to 1 (always execute)
- Validation CRITICAL shown
- Message: "Cannot go backwards from Round 3 to Round 1"

### Automated Testing (Future)

**Test file:** `__tests__/validation.test.ts` (not yet created)

**Test coverage needed:**
```typescript
describe('Validation System', () => {
  test('Phase transition validation');
  test('Round advancement validation');
  test('CP gain/loss validation');
  test('Stratagem duplication detection');
  test('Context fetching');
  test('Validation severity levels');
});
```

### E2E Testing Checklist

- [ ] Valid phase transitions work without warnings
- [ ] Invalid phase transitions show appropriate severity
- [ ] CP validation catches overspending
- [ ] Duplicate stratagems detected within time windows
- [ ] Round regression shows critical warning
- [ ] Validation toasts display correctly
- [ ] Override buttons work
- [ ] Validation doesn't block execution
- [ ] Game context loads correctly
- [ ] Rules reference is in AI prompt

---

## User Experience

### Key Design Principles

1. **Always Execute**
   - Actions are **never blocked**
   - Validation is advisory only
   - Users maintain full control

2. **User is Authority**
   - Every validation can be overridden
   - No forced corrections
   - System trusts user judgment

3. **Context Matters**
   - AI has full game state before validating
   - Considers recent history
   - Understands game flow

4. **Fail Gracefully**
   - Validation errors don't crash system
   - Missing context degrades gracefully
   - Database errors don't block gameplay

5. **Learn Over Time**
   - Track override patterns (future)
   - Improve AI accuracy based on data
   - Adapt to user preferences

### Validation Toast UI (Component Exists)

**File:** `components/ValidationToast.tsx`

**Features:**
- Severity-based color coding
- Tool name displayed
- Validation message (human-readable)
- Rule ID (for reference)
- Suggested fix
- Action that was executed
- Override & Accept button (for warnings/errors)
- Dismiss button
- Auto-dismiss for info messages

**Example Toast (ERROR):**
```
🚨 ERROR
LOG STRATAGEM USE

Insufficient CP: player has 0 CP but stratagem costs 2 CP
Rule: insufficient_cp
💡 Verify CP cost or current CP total

Action executed: Transhuman Physiology used (-2 CP, 0 CP remaining)

[OVERRIDE & ACCEPT] [DISMISS]
```

---

## Troubleshooting

### Validation Not Triggering

**Symptoms:**
- No validation warnings shown
- Tool executes without validation check

**Causes:**
1. Validation not integrated into tool handler
2. Game context not loading
3. Validation rules not matching scenario

**Solutions:**
1. Check `lib/toolHandlers.ts` - validation calls present?
2. Check console logs - game context loading?
3. Review `lib/validationHelpers.ts` - rules correct?

### False Positive Warnings

**Symptoms:**
- Validation warning for valid action
- Incorrect severity level

**Causes:**
1. Time windows too broad
2. Rules reference incorrect
3. Context data stale

**Solutions:**
1. Adjust time windows in `lib/validationHelpers.ts`
2. Update rules in `lib/rulesReference.ts`
3. Check database - recent stratagems correct?

### Validation Toasts Not Showing

**Symptoms:**
- Validation triggered (console logs)
- No toast displayed in UI

**Cause:**
- UI integration not complete yet

**Status:** ✅ Backend ready, 🚧 UI integration pending

---

## Related Documentation

- [Configuration Reference](../CONFIGURATION_REFERENCE.md) - All settings
- [Audio/VAD Guide](AUDIO_VAD_GUIDE.md) - Audio system
- [Context System Guide](CONTEXT_SYSTEM_GUIDE.md) - How context works
- [AI Tools](../features/AI_TOOL_CALLING.md) - Tool definitions
- [Architecture](../ARCHITECTURE.md) - System overview

---

## Code Examples

### Checking for Validation in Tool Results

```typescript
// After tool execution
const toolResults = analysisResult.toolCalls || [];

toolResults.forEach(result => {
  if (result.validation && result.validation.severity !== 'valid') {
    console.log('Validation triggered:', result.validation);
    // Display toast with validation info
  }
});
```

### Adding Custom Validation Rule

1. **Add to rules reference** (`lib/rulesReference.ts`):
```typescript
export const RULES_REFERENCE = `
### Custom Rule: Objective Capture Limits
- Maximum 3 objectives can be held by one player
- Violating this is a CRITICAL error
`;
```

2. **Add validation function** (`lib/validationHelpers.ts`):
```typescript
export function validateObjectiveCapture(
  playerId: string,
  objectivesHeld: number
): ValidationResult {
  if (objectivesHeld > 3) {
    return {
      severity: 'critical',
      message: `Player holds ${objectivesHeld} objectives (maximum is 3)`,
      rule: 'max_objectives_exceeded',
      suggestion: 'Verify objective count - maximum 3 per player',
      requiresOverride: true
    };
  }
  
  return { severity: 'valid' };
}
```

3. **Integrate into tool handler** (`lib/toolHandlers.ts`):
```typescript
export async function updateObjectiveControl(...) {
  // ... existing code ...
  
  const validation = validateObjectiveCapture(
    usedBy,
    objectivesHeldCount
  );
  
  if (validation.severity !== 'valid') {
    return { ...result, validation };
  }
  
  // ... rest of function ...
}
```

---

**Status:** ✅ Backend Complete, 🚧 UI Integration Pending  
**Next Steps:** Integrate ValidationToast into main page, handle override actions
