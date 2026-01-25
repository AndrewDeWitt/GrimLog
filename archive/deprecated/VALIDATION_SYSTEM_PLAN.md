# AI-Driven Validation System - Implementation Plan

## 🎯 Overview

This document outlines the enhanced validation system for the Warhammer 40K AI Assistant. The system uses **AI-driven validation** with contextual game state awareness to catch rule violations, with user-friendly warnings and manual override capabilities.

---

## ✅ Phase 1: Core Infrastructure (COMPLETED)

### Files Created/Modified:

1. **`lib/rulesReference.ts`** ✅
   - Comprehensive Warhammer 40K 10th Edition rules cheat sheet
   - CP gain/loss rules with examples
   - Phase transition rules
   - Stratagem usage restrictions
   - Validation severity guidelines (⚠️ WARNING, ❌ ERROR, 🚨 CRITICAL)

2. **`lib/types.ts`** ✅
   - Added `ValidationSeverity` type: `'valid' | 'info' | 'warning' | 'error' | 'critical'`
   - Added `ValidationResult` interface with:
     - `severity`: Validation level
     - `message`: Human-readable explanation
     - `rule`: Rule ID that was triggered
     - `suggestion`: Recommended fix
     - `requiresOverride`: Whether user must manually approve
   - Enhanced `ToolExecutionResult` with:
     - `validation?`: Optional validation result
     - `wasOverridden?`: Track if user overrode a warning

3. **`lib/validationHelpers.ts`** ✅
   - `fetchGameContext()`: Loads session, recent stratagems, objectives
   - `buildGameStatePrompt()`: Generates detailed game state for AI prompt
   - `validateStratagemUse()`: Checks for duplicate stratagem usage
   - `validatePhaseTransition()`: Validates phase sequence
   - `validateCommandPointChange()`: Validates CP gains/losses
   - `validateRoundAdvancement()`: Validates battle round progression

4. **`lib/toolHandlers.ts`** ✅
   - Integrated validation into:
     - `changePhase()` - validates phase transitions
     - `advanceBattleRound()` - validates round progression
     - `logStratagemUse()` - validates stratagem usage + CP availability
     - `updateCommandPoints()` - validates CP changes
   - All validation results attached to tool execution results

5. **`app/api/analyze/route.ts`** ✅
   - Import validation helpers and rules reference
   - Enhanced `buildSystemPrompt()` to accept game state context
   - Fetch game context before AI analysis
   - Inject game state, rules, and conversation history into AI prompt
   - AI now has full context to make informed decisions

6. **`components/ValidationToast.tsx`** ✅
   - Beautiful, detailed validation toast component
   - Severity-based styling (info/warning/error/critical)
   - Shows:
     - Validation severity level
     - Tool name
     - Validation message
     - Rule triggered
     - Suggested fix
     - Action that was executed
   - Override buttons for warnings/errors
   - Auto-dismisses info messages, requires action for errors

---

## 🚧 Phase 2: UI Integration (TODO)

### What's Needed:

The validation system is **backend-complete**, but we need to:

1. **Update the session page** (`app/sessions/[id]/page.tsx`) to:
   - Display `ValidationToast` components for tool results with validation warnings
   - Handle "Override & Accept" button clicks
   - Track overridden validations
   - Show validation history in timeline (optional)

2. **Add validation state management**:
   - Track which validation warnings are currently shown
   - Handle multiple simultaneous warnings (stack toasts)
   - Allow dismissing or overriding each warning independently

3. **Visual feedback in Timeline**:
   - Show validation icons next to timeline events
   - Mark overridden actions with special badge
   - Filter/highlight problematic actions

---

## 🔄 Phase 3: Override Mechanism (TODO)

When a user clicks **"Override & Accept"** on a validation warning:

### Option A: Log Override Only (Recommended)
- Mark the action as "overridden by user"
- Create a timeline event noting the override
- No re-execution needed (action already executed)
- Simplest implementation

### Option B: Re-execute with Override Flag
- Store pending actions that failed validation
- On override, re-execute tool with `wasOverridden: true` flag
- More complex but allows for "soft block" mode

**Recommendation:** Start with **Option A** - simpler and matches your stated goal that "AI is auto-drive, user can always override."

---

## 📊 Phase 4: Validation Analytics (TODO)

Track validation events for:
- Learning which rules are frequently triggered
- Identifying common user patterns
- Improving AI accuracy over time

### Database Changes Needed:

```prisma
model ValidationEvent {
  id              String      @id @default(uuid())
  gameSession     GameSession @relation(fields: [gameSessionId], references: [id], onDelete: Cascade)
  gameSessionId   String
  timestamp       DateTime    @default(now())
  
  toolName        String
  severity        String      // "info", "warning", "error", "critical"
  message         String
  rule            String?
  wasOverridden   Boolean     @default(false)
  overrideReason  String?     // Optional: user can provide reason
  
  // Original tool call data
  toolArgs        String      // JSON of original arguments
  
  @@index([gameSessionId, timestamp])
  @@index([rule, severity]) // For analytics
}
```

---

## 🤖 Phase 5: RAG System for Rule Queries (DEFERRED)

Future enhancement to let users ask rule questions:
- "What's the CP gain rule?"
- "Can I use Transhuman in the Fight phase?"
- "What's the phase sequence?"

### Implementation:
- Use `pg_vector` extension in PostgreSQL
- Embed rule text from rulebooks/datasheets
- Semantic search for relevant rules
- Display rule citations in UI

---

## 🎮 Example User Flow

### Scenario: Player tries to use stratagem without CP

1. **User says:** *"Using Transhuman Physiology on my Terminators"*

2. **AI analyzes:**
   - Current game state: Player has 0 CP
   - Stratagem costs 2 CP
   - Validation triggered: **ERROR - Insufficient CP**

3. **Backend executes:**
   - Stratagem is logged (AI executes action)
   - CP goes negative → clamped to 0
   - Validation result attached: `severity: 'error'`, `requiresOverride: true`

4. **UI shows ValidationToast:**
   ```
   🚨 ERROR
   LOG STRATAGEM USE
   
   Insufficient CP: player has 0 CP but stratagem costs 2 CP
   Rule: insufficient_cp
   💡 Verify CP cost or current CP total
   
   Action executed: Transhuman Physiology used (-2 CP, 0 CP remaining)
   
   [OVERRIDE & ACCEPT] [DISMISS]
   ```

5. **User options:**
   - **Override & Accept:** Acknowledges error, keeps action
   - **Dismiss:** Acknowledges error (action still happened)
   - Later: Manual correction via UI if needed

---

## 📝 Validation Rules Implemented

| Rule | Validation Function | Severity | Example |
|------|-------------------|----------|---------|
| **Phase Sequence** | `validatePhaseTransition()` | ERROR | Going from Shooting → Movement |
| **Phase Skip** | `validatePhaseTransition()` | INFO | Skipping from Command → Shooting |
| **Round Regression** | `validateRoundAdvancement()` | CRITICAL | Going from Round 3 → Round 2 |
| **Round Skip** | `validateRoundAdvancement()` | ERROR | Going from Round 2 → Round 4 |
| **Insufficient CP** | `logStratagemUse()` | ERROR | Spending 2 CP with 0 available |
| **High CP Gain** | `validateCommandPointChange()` | WARNING | Gaining >2 CP in one turn |
| **Excessive CP Gain** | `validateCommandPointChange()` | CRITICAL | Gaining >3 CP in one turn |
| **Duplicate Stratagem (Phase)** | `validateStratagemUse()` | WARNING | Using same stratagem twice in phase |
| **Duplicate Stratagem (Turn)** | `validateStratagemUse()` | INFO | Using same stratagem twice in turn |

---

## 🚀 Next Steps

### Immediate (Phase 2):
1. Update session page to display ValidationToast
2. Handle tool results with validation warnings
3. Add override button handlers
4. Test validation flow end-to-end

### Short-term (Phase 3):
1. Create override logging system
2. Add validation badges to timeline
3. Allow filtering timeline by validation issues

### Long-term (Phase 4-5):
1. Add ValidationEvent model to database
2. Track override patterns
3. Build analytics dashboard
4. Implement RAG system for rule queries

---

## 💡 Key Design Decisions

1. **AI-Driven, Not Hard-Coded:** Rules are in a text format the AI reads, not TypeScript logic
2. **Always Execute:** Actions are executed even with validation errors (with warnings)
3. **User is King:** All validations can be overridden
4. **Context-Aware:** AI has full game state, recent history, and conversation context
5. **Tiered Severity:** Info < Warning < Error < Critical (visual + behavioral differences)

---

## 🧪 Testing Checklist

- [ ] Test phase transition validation (backwards, skips, valid)
- [ ] Test CP validation (insufficient, high gain, negative)
- [ ] Test stratagem duplication detection (phase, turn, battle)
- [ ] Test round advancement validation (regression, skip)
- [ ] Test ValidationToast display and styling
- [ ] Test override button functionality
- [ ] Test multiple simultaneous warnings
- [ ] Test auto-dismiss for info messages
- [ ] Test accessibility (screen readers, keyboard nav)
- [ ] Test mobile responsiveness

---

## 📚 Related Documentation

- `/lib/rulesReference.ts` - Full rules cheat sheet
- `/lib/aiTools.ts` - AI tool definitions
- `/lib/toolHandlers.ts` - Tool execution logic
- `/docs/features/AI_TOOL_CALLING_SETUP.md` - AI tool calling system
- `/docs/features/SESSION_SYSTEM.md` - Game session architecture

---

**Status:** Backend validation system complete ✅  
**Next:** UI integration for displaying validation warnings




