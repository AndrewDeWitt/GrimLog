# Combined Gatekeeper + Intent Classification

**Date:** 2025-10-27  
**Status:** ✅ Complete

---

## 🎯 **Problem Solved**

Previously, we had **2 sequential AI calls**:
1. **Gatekeeper** (validateGameRelevance) - "Is this game-related?"
2. **Intent Classification** (orchestrateIntent) - "What intent category?"

This was wasteful because both are simple classification tasks and were blocking each other.

---

## ✅ **Solution**

Combined both into a **single AI call** that returns:
```typescript
{
  isGameRelated: boolean,        // Gatekeeper result
  intent: IntentCategory,        // SIMPLE_STATE | UNIT_OPERATION | STRATEGIC
  contextTier: ContextTier,      // minimal | medium | full
  confidence: number,
  reasoning: string
}
```

---

## 📊 **Performance Impact**

### Before (2 sequential calls)
```
Gatekeeper:        200-500ms   ← Wait for this
Intent Class:      200-500ms   ← Then wait for this
GPT-5 Analysis:    1000-3000ms
─────────────────────────────
TOTAL:             1400-4000ms
```

### After (1 combined call)
```
Gatekeeper + Intent:  200-500ms   ← Both at once!
GPT-5 Analysis:       1000-3000ms
─────────────────────────────────
TOTAL:                1200-3500ms
```

**Savings:** ~200-500ms per request (eliminated one AI call wait time)

---

## 🔧 **Changes Made**

### 1. Updated Interface (`lib/intentOrchestrator.ts`)

**Added `isGameRelated` field:**
```typescript
export interface IntentClassification {
  isGameRelated: boolean;      // NEW: Gatekeeper result
  intent: IntentCategory;
  contextTier: ContextTier;
  confidence: number;
  reasoning: string;
}
```

### 2. Updated Schema

```typescript
const INTENT_CLASSIFICATION_SCHEMA = {
  properties: {
    isGameRelated: {
      type: "boolean",
      description: "Is this speech about the Warhammer 40K game being played?"
    },
    intent: { ... },
    contextTier: { ... },
    confidence: { ... },
    reasoning: { ... }
  },
  required: ["isGameRelated", "intent", "contextTier", "confidence", "reasoning"]
};
```

### 3. Updated Instructions

The AI now does **both jobs** in one call:

```
PART 1: GATEKEEPER - Is this speech about the game?
- Set isGameRelated to TRUE for: game actions, unit health, phases, rounds
- Set isGameRelated to FALSE for: casual chat, off-topic conversations

PART 2: INTENT CLASSIFICATION - What game elements are needed?
- SIMPLE_STATE (minimal context)
- UNIT_OPERATION (medium context)
- STRATEGIC (full context)
```

### 4. Updated Call Site (`app/api/analyze/route.ts`)

**Before:**
```typescript
// 2 separate calls
const gatekeeperCheck = await validateGameRelevance(...);
if (!gatekeeperCheck.isGameRelated) return;

const intentClassification = await orchestrateIntent(...);
```

**After:**
```typescript
// 1 combined call
const intentClassification = await orchestrateIntent(
  transcribedText,
  session.currentPhase,
  session.battleRound,
  transcriptsSinceLastAnalysis.slice(0, -1), // Recent context
  intentGeneration
);

// Check gatekeeper result
if (!intentClassification.isGameRelated) return;
```

---

## 📝 **Logging**

New console output:
```
⏱️ Gatekeeper + Intent Classification: 247ms
🚦 Gatekeeper: ALLOWED (0.92 confidence)
🎯 Intent: UNIT_OPERATION → medium
   Reasoning: Player reporting damage to unit, needs unit list
```

Or for non-game content:
```
⏱️ Gatekeeper + Intent Classification: 198ms
🚦 Gatekeeper: BLOCKED (0.85 confidence)
   Reasoning: Casual conversation, not game-related
```

---

## 🧪 **Testing**

### Test Case 1: Game Content (Should Allow)
**Input:** "my terminators took 5 damage"

**Expected:**
```typescript
{
  isGameRelated: true,
  intent: 'UNIT_OPERATION',
  contextTier: 'medium',
  confidence: 0.9+
}
```

### Test Case 2: Non-Game Content (Should Block)
**Input:** "hey how are you doing?"

**Expected:**
```typescript
{
  isGameRelated: false,
  intent: 'UNCLEAR',
  contextTier: 'full',
  confidence: 0.8+
}
```

### Test Case 3: Ambiguous with Context
**Input:** "okay" (after "moving to shooting phase")

**Expected:** Uses recent context to determine if game-related

---

## 🎯 **Benefits**

1. ✅ **Faster:** Eliminates one AI call wait (~200-500ms saved)
2. ✅ **Simpler:** One call instead of two
3. ✅ **Cheaper:** One API call instead of two
4. ✅ **Smarter:** Can use context for both gatekeeper and intent classification
5. ✅ **Cleaner code:** Less complexity in analyze route

---

## ⚠️ **Potential Issues & Solutions**

### Issue: GPT-5-nano might be less accurate at gatekeeper
**Mitigation:** nano is fine for binary classification, but monitor accuracy

### Issue: If intent classification fails, gatekeeper fails too
**Mitigation:** Fallback returns `isGameRelated: true` to allow through

### Issue: Longer prompts might slow down nano
**Mitigation:** Monitor timing logs to verify it's still fast

---

## 📊 **Monitoring**

Watch for these in logs:
```bash
# Should see ONE combined call per request
⏱️ Gatekeeper + Intent Classification: XXXms

# Should NOT see separate:
⏱️ Gatekeeper Check: XXXms        ← REMOVED
⏱️ Intent Classification: XXXms   ← REMOVED
```

---

## 🎉 **Result**

- **Before:** 2 sequential AI calls (wasteful)
- **After:** 1 combined AI call (efficient)
- **Savings:** ~200-500ms per request
- **Simplicity:** Cleaner code, easier to understand

---

## 📁 **Files Modified**

- ✅ `lib/intentOrchestrator.ts` - Combined gatekeeper + intent
- ✅ `app/api/analyze/route.ts` - Updated call site
- ✅ `docs/guides/COMBINED_GATEKEEPER_INTENT.md` - This doc
- ✅ Removed fast path pattern matching

