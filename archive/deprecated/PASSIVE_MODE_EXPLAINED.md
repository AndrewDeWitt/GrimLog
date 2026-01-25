# 🎮 Passive Tracking Mode - Full Context Capture

## 🎯 The Core Issue (Fixed!)

**Problem:** VAD was chunking too aggressively, cutting off your thoughts mid-conversation.

**Before (2 second chunks):**
```
You: "I'm using Transhuman Physiology..."
[2 second pause while thinking/rolling dice]
⏹️ CHUNK 1: "I'm using Transhuman Physiology"

You: "...on my Terminators in the center..."
[2 second pause]
⏹️ CHUNK 2: "on my Terminators in the center"

You: "...and then moving them forward 6 inches"
[2 second pause]
⏹️ CHUNK 3: "and then moving them forward 6 inches"
```

**Result:** ❌ Fragmented context, AI doesn't understand the full action

**After (5 second chunks - PASSIVE MODE):**
```
You: "I'm using Transhuman Physiology... [pause 3s]... on my Terminators in the center... [pause 3s]... and then moving them forward 6 inches"
[5 second silence - measuring/rolling/thinking]
⏹️ CHUNK 1: "I'm using Transhuman Physiology on my Terminators in the center and then moving them forward 6 inches"
```

**Result:** ✅ Complete context, AI understands the full action!

---

## ✅ What Changed

### 1. Longer Silence Duration: 2s → 5s

**Setting:** `SILENCE_DURATION = 5000 ms` (5 seconds)

**Why this works for passive tracking:**
- You naturally pause while rolling dice (2-4 seconds)
- You pause while measuring movement (1-3 seconds)
- You pause while thinking (1-3 seconds)
- **5 seconds captures complete thoughts** before chunking

**Trade-off:**
- ✅ Better context (complete sentences/thoughts)
- ✅ Fewer chunks (less API calls)
- ⚠️ Slightly slower response (but you don't need instant response for passive tracking)

---

### 2. Maximum Recording Time: 30 seconds

**Setting:** `MAX_RECORDING_TIME = 30000 ms` (30 seconds)

**Why:** Safety limit to prevent recording forever if you forget it's running.

**What happens:**
```
Recording for 25s... still going...
Recording for 30s...
⏱️ Max recording time reached - Auto-chunking
```

**Benefit:** Prevents accidentally huge audio files

---

### 3. Priority Keyword System (NEW!)

**File:** `lib/priorityKeywords.ts`

**Concept:** Certain keywords trigger **immediate** processing (shorter timeout).

**Priority Keywords:**
- **System address:** "Taclog", "Hey Taclog"
- **Rules queries:** "What is the rule", "How does", "Can I"
- **Game state:** "How many CP", "What phase", "What round"
- **Corrections:** "Wait", "Actually", "I meant", "Scratch that"

**How it works:**
```
Normal speech: "Using Transhuman on my Terminators"
→ Wait 5 seconds after silence → Then analyze

Priority speech: "Taclog, how many CP do I have?"
→ Wait 1 second after silence → Immediate analysis
```

**Future implementation (not yet active):**
- Detect priority keywords in transcription
- Use shorter timeout for priority queries
- Provide immediate feedback for urgent needs

---

## 🎮 Use Cases

### Passive Tracking (Default - 5 second timeout)

**Scenario:** Describing your turn naturally

```
You: "Okay so I'm in my shooting phase... 
      [pause - picking up dice]
      My Intercessors are going to shoot at his Terminators...
      [pause - rolling dice]  
      I got 8 hits and 6 wounds...
      [pause - opponent rolling saves]
      He failed 4 saves so 4 damage through"
      
[5 seconds of silence]
⏹️ System chunks and analyzes complete thought
```

**AI receives:** Full context about shooting, targets, results  
**AI does:** Logs combat result with all details

---

### Priority Query (Future - 1 second timeout)

**Scenario:** Need immediate answer

```
You: "Taclog, how many CP do I have?"
[1 second of silence]
⏹️ System immediately processes (priority detected)
```

**AI receives:** Question about CP  
**AI does:** Calls `query_game_state` tool, returns answer

---

## ⚙️ Current Configuration (Passive Mode)

```typescript
// lib/audioCapture.ts
SILENCE_THRESHOLD = -15 dB          // Noise tolerance
SILENCE_DURATION = 5000 ms          // ✨ NEW: 5 seconds (was 2s)
SPEECH_CONFIRMATION_TIME = 600 ms   // Anti-twitch filter
MIN_RECORDING_TIME = 1000 ms        // 1 second minimum
MAX_RECORDING_TIME = 30000 ms       // ✨ NEW: 30 second safety limit
```

**What this means:**
- ✅ Captures full conversational context
- ✅ Pauses while rolling/measuring don't cut you off
- ✅ Still filters coughs/clicks (600ms confirmation)
- ✅ Auto-chunks every 30 seconds max (safety)

---

## 🧪 Testing

### Test 1: Full Context Capture

1. Click START
2. Say: "I'm using Transhuman Physiology... [pause 3s]... on my Terminators... [pause 3s]... for 2 CP"
3. Stop speaking
4. Wait 5 seconds

**Expected:**
```
🎤 Speech confirmed - Starting recording
🔇 Silence detected - Waiting 5000ms before chunking
⏹️ Silence exceeded 5000ms - Stopping recording
📦 Audio chunk captured
```

**Transcription should be:**
"I'm using Transhuman Physiology on my Terminators for 2 CP"

✅ Complete thought captured!

---

### Test 2: Natural Conversation Flow

1. Describe multiple actions with natural pauses:
   - "Moving to shooting phase" [pause 2s]
   - "My Intercessors shoot" [pause 3s] 
   - "I got 6 wounds"

2. Wait 5 seconds after your last word

**Expected:** All three sentences captured in one chunk

---

### Test 3: Coughs Still Ignored

1. Cough once (quick burst)

**Expected:**
```
👂 Potential speech - Confirming...
❌ Speech not confirmed (after 120ms) - Ignoring
```

✅ Still filters short noises!

---

### Test 4: Max Recording Safety

1. Start talking
2. Keep talking for 30+ seconds

**Expected:**
```
⏱️ Max recording time reached (30000ms) - Auto-chunking
```

✅ Safety limit prevents infinite recording

---

## 💡 Priority Keywords (Future Enhancement)

### How It Would Work:

**Normal tracking (5 second timeout):**
```
You: "I'm moving my Terminators forward..."
[Natural pauses while playing]
[5 seconds of silence]
→ Chunk and analyze
```

**Priority query (1 second timeout):**
```
You: "Taclog, how many CP do I have?"
[1 second of silence]
→ Immediate chunk and analyze
→ AI responds with CP count
```

### Keywords to Add:

**System commands:**
- "Taclog" (wake word)
- "Hey Taclog"
- "Computer"

**Urgent queries:**
- "What is the rule for..."
- "How does [ability] work"
- "Can I use..."
- "Am I allowed to..."

**Game state:**
- "How many CP"
- "What phase am I in"
- "What's the score"

**Corrections:**
- "Wait, actually..."
- "Correction"
- "I meant to say..."
- "Scratch that"

**Would you like me to implement this priority keyword system with dynamic timeouts?**

---

## 📊 Comparison

| Mode | Silence Duration | Use Case | Context Quality |
|------|-----------------|----------|-----------------|
| **Real-time** | 1-2 seconds | Instant feedback needed | Poor (fragmented) |
| **Passive** | 5 seconds | Casual game tracking | Good (complete thoughts) |
| **Priority** | 1 second | Urgent queries only | Good (short query) |
| **Manual** | Infinite | Full control | Excellent (user decides) |

**Current mode:** ✅ **Passive (5 seconds)**

---

## 🎯 Recommended Workflow

### During Normal Gameplay (Passive Mode)
- Just **talk naturally** about what you're doing
- Pauses for dice rolling, measuring, thinking are **fine**
- System will chunk after **5 seconds of silence**
- AI gets **full context** for better decisions

### For Immediate Needs (Future: Priority Mode)
- Say **"Taclog, how many CP do I have?"**
- System detects priority keyword
- Chunks after **1 second** instead of 5
- Get immediate answer

### For Long Descriptions
- Describe your whole turn naturally
- System will auto-chunk every **30 seconds** max
- Or wait for **5 second silence** when you're done

---

## ✅ Benefits of Passive Mode

### Better AI Decisions
```
Fragmented: "Using Transhuman"
→ AI: "On which unit? For what cost?"

Complete: "Using Transhuman Physiology on my Terminators for 2 CP"
→ AI: Logs stratagem with all details ✅
```

### Fewer API Calls
```
Before: 10 small chunks → 10 Whisper + 10 GPT calls
After: 3 large chunks → 3 Whisper + 3 GPT calls
Savings: 70% fewer API calls!
```

### Natural Gameplay
```
Before: Must speak quickly without pauses
After: Speak naturally, pause whenever
```

---

## 🔧 If You Need Adjustment

### If 5 Seconds Is Too Long
```typescript
// Chunk faster (more responsive)
SILENCE_DURATION = 3000 // 3 seconds
```

### If 5 Seconds Is Too Short
```typescript
// Wait longer (even more context)
SILENCE_DURATION = 7000 // 7 seconds
```

### If You Want Even More Context
```typescript
// Capture very long thoughts
SILENCE_DURATION = 10000  // 10 seconds
MAX_RECORDING_TIME = 60000 // 60 seconds
```

---

## 🎉 Summary

**Changes made:**
- ✅ Silence duration: **2s → 5s** (capture full thoughts)
- ✅ Max recording time: **30 seconds** (safety limit)
- ✅ Priority keywords: **Ready for implementation**

**Benefits:**
- ✅ Complete context captured
- ✅ Better AI understanding
- ✅ Natural conversation flow
- ✅ Fewer fragmented transcriptions
- ✅ Still filters coughs/clicks

**Ready to test:** Refresh page and speak naturally with pauses!

---

## ❓ Questions for You

1. **Is 5 seconds enough?** Or do you need longer pauses (7-10 seconds)?
2. **Priority keywords:** Want me to implement the 1-second timeout for priority queries?
3. **Wake word:** Would "Taclog" or "Hey Taclog" be good for urgent queries?
4. **Max recording time:** Is 30 seconds enough, or need longer?

Let me know and I can fine-tune further! 🎮

