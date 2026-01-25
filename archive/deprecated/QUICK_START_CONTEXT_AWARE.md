# ⚡ Quick Start - Context-Aware System

## 🚀 Get Started in 3 Steps

### Step 1: Migrate Database
```bash
npx prisma db push
```

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Test Context-Aware Triggers
1. Open http://localhost:3000
2. Open browser console (F12)
3. Click **START**
4. Say: "Moving to shooting phase... [5s pause]... My Intercessors shoot... [5s pause]... and that's my shooting done"
5. Watch for smart trigger detection!

---

## 📊 What You'll See

### Building Context (Transcribe-Only)
```
🎤 Speech confirmed - Starting recording
⏹️ Silence exceeded 5000ms - Stopping recording
📝 Transcribed only: "Moving to shooting phase"
📝 Accumulated transcript #1: "Moving to shooting phase"
🔍 Trigger check: Accumulating context (1 transcripts, 5.2s) (confidence: 0)

📝 Transcribed only: "My Intercessors shoot"
📝 Accumulated transcript #2: "My Intercessors shoot"
🔍 Trigger check: Accumulating context (2 transcripts, 10.5s) (confidence: 0)
```
✅ **No analysis yet - building context**

### Smart Trigger Fires (Full Analysis)
```
📝 Transcribed only: "and that's my shooting done"
📝 Accumulated transcript #3: "and that's my shooting done"
🔍 Trigger check: Action completion phrase detected (confidence: 0.9)
🤖 Triggering FULL ANALYSIS: Action completion phrase detected
📜 Context: Using 3 previous transcriptions + current
Tool calls executed: [change_phase, log_combat_result]
🔄 Resetting accumulated transcripts (had 3)
```
✅ **Analysis at natural stopping point with full context!**

---

## 🎯 Smart Triggers Explained

### 1. Completion Phrases (Most Common)
```
"...and that's my shooting done"
"...end of my turn"
"...moving to charge phase"
```
→ Analyze immediately (natural end point)

### 2. Priority Keywords (Urgent)
```
"Taclog, how many CP?"
"What phase am I in?"
```
→ Analyze immediately (need answer)

### 3. Long Silence (Gameplay Break)
```
[10+ seconds of silence]
```
→ Analyze now (rolling dice, measuring, etc.)

### 4. Min Context (Enough Info)
```
3+ transcripts accumulated
```
→ Analyze now (have enough context)

### 5. Safety Limit (Fallback)
```
30 seconds since last analysis
```
→ Analyze now (safety)

---

## ⚙️ Current Configuration

```typescript
// VAD
SILENCE_THRESHOLD = -15 dB         // Noise tolerance
SILENCE_DURATION = 5000 ms         // Transcribe every 5s
SPEECH_CONFIRMATION = 600 ms       // Filter coughs/clicks

// Analysis Triggers
LONG_SILENCE = 10000 ms            // 10s triggers analysis
MIN_TRANSCRIPTS = 3                // 3 transcripts minimum
MAX_TIME = 30000 ms                // 30s safety limit
```

---

## 🧪 Quick Tests

### Test 1: Completion Phrase
```
Say: "Got 8 hits and that's it"
Expected: Analysis triggered by "that's it"
```

### Test 2: Priority Keyword
```
Say: "Taclog, what round is it?"
Expected: Immediate analysis
```

### Test 3: Long Silence
```
Say: "Got 6 wounds"
[Wait 10+ seconds]
Expected: Analysis after 10s
```

---

## ✅ What's Different

### Old System (Time-Based):
- ❌ Analyzed every 15 seconds
- ❌ Could cut off mid-sentence
- ❌ Arbitrary timing

### New System (Context-Aware):
- ✅ Analyzes at completion phrases
- ✅ Analyzes after long silence
- ✅ Never cuts off mid-thought
- ✅ Natural conversation flow

---

## 📚 Full Documentation

See: `docs/FINAL_SYSTEM_ARCHITECTURE.md`

---

## 🎯 Expected Behavior

1. **You speak naturally** with pauses
2. **System transcribes** every 5s (silent, builds context)
3. **Smart triggers detect** natural stopping points
4. **System analyzes** with full accumulated context
5. **Tools execute** with complete understanding
6. **Timeline updates** with accurate events

---

**Test it now! The system will analyze at natural points in your conversation!** 🚀🧠

