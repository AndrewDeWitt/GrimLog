# 🧠 Context-Aware Analysis Triggers

## 🎯 The Problem with Time-Based Analysis

**Time-based (arbitrary 15s):**
```
0:00 - "I'm moving my Terminators forward"
0:05 - "6 inches toward the objective"
0:10 - "Now they're in range to shoot"
0:15 - ⏰ 15 seconds passed → ANALYZE NOW
        But you're mid-sentence: "at his Dread..."
        ❌ Cuts off incomplete thought!
```

**Result:** Still fragments your conversation, just on a longer timescale.

---

## ✅ The Solution: Smart Contextual Triggers

**Context-aware triggers:**
```
0:00 - "I'm moving my Terminators forward"
0:05 - "6 inches toward the objective"  
0:10 - "They're in range to shoot at his Dreadnought"
0:15 - "And that's my movement phase done"
       ✅ Completion phrase detected → ANALYZE NOW
       
0:35 - [10 seconds of silence - rolling dice, no speech]
       ✅ Long natural break → ANALYZE NOW
```

**Result:** Analysis happens at **natural conversation boundaries**, not arbitrary times!

---

## 🎯 Five Smart Triggers

### Trigger 1: Priority Keywords (Immediate) 🔴
**Confidence:** 100%

```
You: "Taclog, how many CP do I have?"
→ ANALYZE IMMEDIATELY
```

**Keywords:**
- "Taclog" / "Hey Taclog"
- "How many CP" / "How much CP"
- "What phase" / "What round"
- "What is the rule"
- "Wait" / "Actually" / "Correction"

**Purpose:** Urgent queries need immediate answers

---

### Trigger 2: Action Completion Phrases 📍
**Confidence:** 90%

```
You: "...and that's my shooting phase done"
→ Completion phrase detected → ANALYZE NOW
```

**Phrases:**
- "that's my [phase/turn]"
- "end of my [phase/turn]"
- "done with [action]"
- "finished with [action]"
- "that's it for [phase]"
- "moving to [next phase]"
- "going to [next phase]"

**Purpose:** Natural end-of-action markers

---

### Trigger 3: Long Silence (Natural Break) ⏸️
**Confidence:** 85%

```
You: "...got 8 hits and 6 wounds"
[10+ seconds of complete silence - rolling saves, measuring, etc.]
→ Long natural break → ANALYZE NOW
```

**Threshold:** 10 seconds of no speech at all

**Purpose:** Detect natural pauses in gameplay (dice rolling, measuring, thinking)

---

### Trigger 4: Accumulated Transcripts (Minimum Context) 📚
**Confidence:** 75%

```
Transcript 1: "Moving forward"
Transcript 2: "Shooting at Terminators"
Transcript 3: "Got 8 hits"
→ 3+ transcripts accumulated + 8s passed → ANALYZE NOW
```

**Threshold:** 3 transcripts + 8 seconds minimum

**Purpose:** Ensure we have enough context before analyzing

---

### Trigger 5: Maximum Time Safety ⏱️
**Confidence:** 60%

```
[30 seconds since last analysis]
→ Safety limit → ANALYZE NOW
```

**Threshold:** 30 seconds maximum

**Purpose:** Don't wait forever, eventual analysis needed

---

## 📊 Trigger Priority (Highest to Lowest)

1. ⭐ **Priority Keyword** → Instant (100% confidence)
2. 📍 **Completion Phrase** → Immediate (90% confidence)
3. ⏸️ **Long Silence** → After 10s (85% confidence)
4. 📚 **Min Transcripts** → After 3+ transcripts + 8s (75% confidence)
5. ⏱️ **Max Time** → After 30s (60% confidence - safety)

**First matching trigger wins!**

---

## 🎮 Example Scenarios

### Scenario 1: Natural Completion Phrase

```
0:00 You: "I'm in my shooting phase"
0:05 → Transcribe only (1 transcript)

0:06 You: "My Intercessors shoot at his Terminators"
0:11 → Transcribe only (2 transcripts)

0:12 You: "Got 8 hits and that's my shooting phase done"
0:17 → ✅ TRIGGER: Completion phrase "that's my shooting phase done"
       Analyze with all 3 transcripts
       Tools: change_phase, log_combat_result
```

**Perfect!** Analysis happens at natural stopping point.

---

### Scenario 2: Long Silence

```
0:00 You: "Moving my Terminators 6 inches forward"
0:05 → Transcribe only (1 transcript)

0:06 You: "Now charging at his Dreadnought"
0:11 → Transcribe only (2 transcripts)

0:12 You: "Made the charge roll"
0:17 → Transcribe only (3 transcripts)

0:18 - [10 seconds of silence - moving models, rolling dice]

0:28 → ✅ TRIGGER: Long silence (10s with no speech)
       Analyze with all 3 transcripts
       Tools: log_unit_action(charge), etc.
```

**Perfect!** Analysis happens during natural gameplay pause.

---

### Scenario 3: Priority Keyword

```
0:00 You: "My Terminators shoot"
0:05 → Transcribe only (1 transcript)

0:06 You: "Taclog, how many CP do I have?"
0:11 → ✅ TRIGGER: Priority keyword "Taclog"
       Analyze immediately (even though only 11s)
       Tools: query_game_state
```

**Perfect!** Urgent query gets immediate answer.

---

### Scenario 4: Accumulated Context

```
0:00 You: "Moving to shooting"
0:05 → Transcribe only (1 transcript)

0:06 You: "Intercessors shoot"
0:11 → Transcribe only (2 transcripts)

0:12 You: "Got 8 hits"
0:17 → Transcribe only (3 transcripts, 17s total)

0:18 You: "6 wounds through"
0:23 → ✅ TRIGGER: 4 transcripts accumulated + 23s passed
       Analyze with all 4 transcripts
```

**Good!** Enough context accumulated, time to analyze.

---

## 🔍 Console Logs

### Transcribe-Only (No Trigger):
```
✅ Audio validated - Passing to decision layer (2 transcripts accumulated)
📝 Transcribed only: "My Intercessors shoot"
🔍 Analysis trigger check: Accumulating context (2 transcripts, 11.2s since last analysis) (confidence: 0)
📝 Transcribed only (2 transcripts accumulated)
📝 Accumulated transcript #2: "My Intercessors shoot"
```

### Completion Phrase Trigger:
```
✅ Audio validated - Passing to decision layer (3 transcripts accumulated)
📝 Transcribed only: "and that's my shooting phase done"
🔍 Analysis trigger check: Action completion phrase detected (confidence: 0.9)
🤖 Triggering FULL ANALYSIS: Action completion phrase detected
📜 Context: Using 3 previous transcriptions + current
Tool calls executed: [...]
🔄 Resetting accumulated transcripts (had 3)
```

### Long Silence Trigger:
```
🔍 Analysis trigger check: Long silence detected (12.3s with no speech) (confidence: 0.85)
🤖 Triggering FULL ANALYSIS: Long silence detected
```

### Priority Keyword Trigger:
```
📝 Transcribed only: "Taclog, how many CP do I have?"
🔍 Analysis trigger check: Priority keyword detected (confidence: 1.0)
🤖 Triggering FULL ANALYSIS: Priority keyword detected
```

---

## ⚙️ Tuning Thresholds

**File:** `lib/analysisTriggers.ts`

### Long Silence Threshold (Line 77)
```typescript
// Current
const LONG_SILENCE_THRESHOLD = 10000; // 10 seconds

// Shorter (more frequent analysis)
const LONG_SILENCE_THRESHOLD = 8000;  // 8 seconds

// Longer (less frequent analysis)
const LONG_SILENCE_THRESHOLD = 15000; // 15 seconds
```

### Minimum Transcripts (Line 87)
```typescript
// Current
const MIN_TRANSCRIPTS_FOR_ANALYSIS = 3;

// Fewer (analyze sooner)
const MIN_TRANSCRIPTS_FOR_ANALYSIS = 2;

// More (accumulate more context)
const MIN_TRANSCRIPTS_FOR_ANALYSIS = 5;
```

### Maximum Time Safety (Line 98)
```typescript
// Current
const MAX_TIME_BETWEEN_ANALYSES = 30000; // 30 seconds

// Shorter safety net
const MAX_TIME_BETWEEN_ANALYSES = 20000; // 20 seconds

// Longer (very passive)
const MAX_TIME_BETWEEN_ANALYSES = 60000; // 60 seconds
```

---

## 📋 Adding Custom Triggers

### Add More Completion Phrases

**File:** `lib/analysisTriggers.ts` (lines 10-31)

```typescript
const ACTION_COMPLETION_PHRASES = [
  // Your custom phrases
  'next unit',
  'back to you',
  'your go',
  'pass the turn',
  'rolling for',
  // etc...
];
```

### Add More Priority Keywords

**File:** `lib/analysisTriggers.ts` (lines 37-67)

```typescript
const PRIORITY_KEYWORDS = [
  // Your custom keywords
  'urgent',
  'quick question',
  'real quick',
  // etc...
];
```

---

## ✅ Benefits

### 1. Natural Stopping Points
- ✅ Analysis at end of actions ("done with shooting")
- ✅ Analysis during dice rolling breaks (10s silence)
- ✅ Analysis when explicitly requested ("Taclog")
- ❌ No arbitrary mid-sentence cutoffs

### 2. Better Context Quality
- ✅ Complete actions captured
- ✅ Multi-step sequences understood
- ✅ AI makes decisions at logical points

### 3. Flexible & Adaptive
- ✅ Quick games → More frequent triggers
- ✅ Slow games → Less frequent triggers
- ✅ Adapts to your speaking pace

---

## 🧪 How to Test

1. **Refresh page** (Ctrl+R)
2. **Click START**
3. **Test each trigger:**

### Test A: Completion Phrase
```
Say: "My Intercessors shoot at Terminators and that's my shooting done"
Wait 5s
```
**Expected:** FULL ANALYSIS triggered by "that's my shooting done"

### Test B: Long Silence
```
Say: "Got 8 hits"
Wait 10+ seconds (don't speak)
```
**Expected:** FULL ANALYSIS triggered by long silence

### Test C: Priority Keyword
```
Say: "Taclog, what phase am I in?"
Wait 5s
```
**Expected:** FULL ANALYSIS triggered by "Taclog"

### Test D: Accumulated Transcripts
```
Say 3-4 short sentences with 5s pauses
Don't use completion phrases
Wait
```
**Expected:** FULL ANALYSIS after 3+ transcripts accumulated

---

## 🎯 Summary

**Old system:**
- ❌ Analyze every 15 seconds (arbitrary)
- ❌ Could cut off mid-sentence
- ❌ Ignorant of conversation flow

**New system:**
- ✅ Analyze at completion phrases ("done with shooting")
- ✅ Analyze after long silence (10s of no speech)
- ✅ Analyze on priority keywords ("Taclog")
- ✅ Analyze after min context accumulated (3 transcripts)
- ✅ Safety limit (30s max)

**Result:** **Context-aware, natural analysis points!**

---

## 📚 Files Modified/Created

1. `lib/analysisTriggers.ts` ✨ NEW - Smart trigger logic
2. `lib/audioCapture.ts` - Track speech timing & accumulated transcripts
3. `app/page.tsx` - Use smart triggers instead of time
4. `docs/CONTEXT_AWARE_TRIGGERS.md` - This documentation

---

**Test it now! The system will analyze at natural stopping points in your conversation, not arbitrary times.** 🎯

