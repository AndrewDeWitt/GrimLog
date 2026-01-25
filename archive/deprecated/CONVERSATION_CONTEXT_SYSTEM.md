# 💬 Conversation Context System - How It Works

## ✅ Already Implemented!

Good news - we're **already tracking and using conversation history**! Each analysis includes:
- ✅ Current transcription
- ✅ Last **10 previous transcriptions** (just increased from 5)
- ✅ Full game state (CP, VP, phase, round, objectives)
- ✅ Recent stratagems used this round/phase
- ✅ Army context (if provided)

---

## 🔄 How the Context System Works

### Step 1: You Speak
```
You: "I'm using Transhuman Physiology on my Terminators for 2 CP"
[5 seconds of silence]
⏹️ Recording stops, audio sent to API
```

### Step 2: Save & Fetch Context (Parallel)
```typescript
// Simultaneously:
// 1. Save current transcript to database
// 2. Fetch last 10 previous transcripts

const [transcript, recentTranscripts] = await Promise.all([
  saveTranscript(currentText),    // Save: "I'm using Transhuman..."
  fetchLast10Transcripts()         // Fetch previous conversation
]);
```

### Step 3: Build Conversation History
```typescript
const conversationHistory = recentTranscripts
  .reverse() // Oldest to newest
  .map(t => t.text)
  .join('\n- ');
```

**Example output:**
```
- Moving to shooting phase
- My Intercessors shoot at his Terminators
- I got 8 hits and 6 wounds
- He failed 4 saves
- 4 models destroyed
- I'm advancing my Terminators
- Using Oath of Moment on enemy Warlord
- Charging with my Terminators
- Made the charge roll
- [Current: I'm using Transhuman Physiology on my Terminators for 2 CP]
```

### Step 4: Build Complete AI Prompt
```typescript
const systemPrompt = buildSystemPrompt(
  armyContext,           // Your army list (if provided)
  conversationHistory,   // Last 10 transcripts ✅
  gameStatePrompt        // Current game state ✅
);
```

**Full prompt to AI includes:**

```
=== WARHAMMER 40K RULES ===
[Full rules cheat sheet]

=== CURRENT GAME STATE ===
Battle Round: 2
Current Phase: Shooting
Current Turn: player

COMMAND POINTS:
- Player: 3 CP
- Opponent: 2 CP

VICTORY POINTS:
- Player: 10 VP
- Opponent: 8 VP

STRATAGEMS USED THIS ROUND:
- player used "Oath of Moment" (1 CP) in Command phase

STRATAGEMS USED THIS PHASE (Shooting):
- None yet

=== RECENT CONVERSATION ===
- Moving to shooting phase
- My Intercessors shoot at his Terminators
- I got 8 hits and 6 wounds
- He failed 4 saves
- 4 models destroyed
- I'm advancing my Terminators
- Using Oath of Moment on enemy Warlord
- Charging with my Terminators
- Made the charge roll

=== CURRENT TRANSCRIPTION ===
"I'm using Transhuman Physiology on my Terminators for 2 CP"
```

### Step 5: AI Analyzes with Full Context

The AI now knows:
- ✅ You're in Shooting phase, Round 2
- ✅ You have 3 CP available
- ✅ You already used Oath of Moment this round (1 CP)
- ✅ You're talking about Terminators (mentioned in recent convo)
- ✅ You're using a stratagem on them
- ✅ The full conversation flow leading up to this action

**AI decision:**
```
Context understood:
- Player has 3 CP
- Transhuman costs 2 CP
- Terminators were mentioned (charging)
- No conflicts detected

Action: log_stratagem_use(
  stratagem_name="Transhuman Physiology",
  cp_cost=2,
  used_by="player",
  target_unit="Terminators"
)
```

✅ **Perfect understanding with full context!**

---

## 📊 Context Layers

The AI receives **4 layers of context**:

### Layer 1: Current Transcription
```
"I'm using Transhuman Physiology on my Terminators for 2 CP"
```

### Layer 2: Recent Conversation (10 previous transcripts)
```
- Moving to shooting phase
- My Intercessors shoot at his Terminators
- I got 8 hits and 6 wounds
- [... 7 more recent transcripts ...]
```

### Layer 3: Current Game State
```
Battle Round: 2
Phase: Shooting
Player CP: 3
Opponent CP: 2
Player VP: 10
Opponent VP: 8
Objectives: Player controls 1, 3, 5
Stratagems this round: Oath of Moment (1 CP)
```

### Layer 4: Warhammer Rules
```
Full 10th Edition rules cheat sheet
CP gain/loss rules
Phase sequences
Stratagem restrictions
```

**Total context:** ~3000-5000 tokens of relevant information!

---

## 🔧 What I Just Enhanced

### Increased Context Window: 5 → 10 Transcripts

**File:** `app/api/analyze/route.ts` (line 219)

**Before:**
```typescript
take: 5  // Last 5 transcriptions
```

**After:**
```typescript
take: 10  // Last 10 transcriptions for better context
```

**Benefit:** More conversation history for AI to understand ongoing actions

---

## 📝 Example: Multi-Step Action with Context

### Your Conversation:
```
Transcript 1: "Moving to my shooting phase"
Transcript 2: "My Intercessors are shooting at his Terminators"
Transcript 3: "I rolled 12 shots, got 8 hits"
Transcript 4: "He's rolling saves now"
Transcript 5: "He failed 4 saves, taking 4 damage"
Transcript 6: "Two models destroyed"
Transcript 7: "Now my Terminators are shooting"
Transcript 8: "I want to use Transhuman Physiology on them"
Transcript 9: "For 2 CP targeting my Terminators"
Transcript 10: "And they're shooting at his Dreadnought"
Transcript 11: "I got 10 hits from the Terminators" ← CURRENT
```

### What AI Receives for Transcript 11:
```
RECENT CONVERSATION:
- My Intercessors are shooting at his Terminators
- I rolled 12 shots, got 8 hits
- He's rolling saves now
- He failed 4 saves, taking 4 damage
- Two models destroyed
- Now my Terminators are shooting
- I want to use Transhuman Physiology on them
- For 2 CP targeting my Terminators
- And they're shooting at his Dreadnought

CURRENT:
I got 10 hits from the Terminators

GAME STATE:
Phase: Shooting
Player CP: 1 (was 3, spent 2 on Transhuman)
Stratagems this phase: Transhuman Physiology (2 CP)
```

**AI understanding:**
- ✅ Knows Intercessors shot first
- ✅ Knows Terminators have Transhuman active
- ✅ Knows Terminators are shooting at Dreadnought
- ✅ Can log combat result correctly: "Terminators vs Dreadnought, 10 hits"

**Without context:** AI would only see "I got 10 hits from the Terminators" - unclear who they're shooting at!

---

## 🎯 Why 10 Transcripts?

### Too Few (3-5):
- ❌ Might miss earlier context
- ❌ Multi-turn actions unclear
- ❌ AI makes assumptions

### Just Right (10):
- ✅ Captures typical conversation flow
- ✅ Understands multi-step actions
- ✅ Reasonable token count (~500-1000 tokens)
- ✅ Fast database query

### Too Many (20+):
- ⚠️ Token bloat (expensive)
- ⚠️ Might include irrelevant old conversation
- ⚠️ Slower queries

**Recommendation:** **10 transcripts** is optimal ✅

---

## 🔍 Database Schema

### TranscriptHistory Model

```prisma
model TranscriptHistory {
  id            String      @id @default(uuid())
  gameSession   GameSession @relation(...)
  gameSessionId String
  timestamp     DateTime    @default(now())
  text          String      // Raw transcription from Whisper
  sequenceOrder Int         // Sequential order for sorting
  
  @@index([gameSessionId, sequenceOrder])
}
```

**Key features:**
- ✅ `sequenceOrder` - Ensures correct chronological order
- ✅ Indexed for fast queries
- ✅ Linked to game session
- ✅ Timestamped for replay

---

## 📊 Full Context Example

### What the AI Sees:

```
You are an expert Warhammer 40K assistant...

=== WARHAMMER 40K RULES ===
Command Points:
- Standard: +1 CP per turn
- Maximum: +2 CP per turn (with secondary discard)
[... full rules ...]

=== CURRENT GAME STATE ===
Battle Round: 2
Current Phase: Shooting Phase (player's turn)

COMMAND POINTS:
- Player: 3 CP
- Opponent: 2 CP

VICTORY POINTS:
- Player: 10 VP
- Opponent: 8 VP

OBJECTIVES:
- Player controls: Objectives 1, 3, 5
- Opponent controls: Objectives 2, 4
- Contested: Objective 6

STRATAGEMS USED THIS ROUND:
- player used "Oath of Moment" (1 CP) in Command phase

STRATAGEMS USED THIS PHASE (Shooting):
- None yet

=== RECENT CONVERSATION ===
- Moving to shooting phase
- My Intercessors are shooting at his Terminators
- I got 8 hits
- He failed 4 saves
- Two models destroyed
- Now my Terminators are shooting
- I want to use Transhuman Physiology on them
- For 2 CP targeting my Terminators
- And they're shooting at his Dreadnought
- I got 10 hits from the Terminators

=== YOUR JOB ===
Analyze the player's current speech and call appropriate tools...
```

**AI has EVERYTHING it needs to make smart decisions!** 🧠

---

## 🧪 How to Verify It's Working

### Check Server Logs

After each analysis, look for:
```
📜 Context: Using 10 previous transcriptions + current
```

This confirms the conversation history is being included.

### Check Database

Query transcripts for your session:
```sql
SELECT text, sequenceOrder, timestamp 
FROM TranscriptHistory 
WHERE gameSessionId = 'your-session-id'
ORDER BY sequenceOrder ASC;
```

Should show all transcriptions in order with sequential numbering.

---

## 💡 How This Helps Passive Tracking

### Example: Multi-Turn Combat

**Turn 1:**
```
You: "My Intercessors shoot at his Terminators"
You: "I got 8 hits"
You: "6 wounds through"
```
→ AI logs combat result

**Turn 2 (later):**
```
You: "His Terminators charge my Intercessors"
```
→ AI knows which Intercessors (mentioned earlier)
→ AI knows they damaged the Terminators earlier
→ Better context for logging combat

---

### Example: Stratagem Tracking

**Earlier:**
```
You: "Using Oath of Moment on the enemy Warlord"
```
→ AI logs stratagem, deducts 1 CP

**Later:**
```
You: "My Terminators shoot at that Warlord"
```
→ AI remembers Oath of Moment is active
→ Could validate re-rolls are being used correctly

---

## 🎯 Enhanced with Passive Mode (5s chunks)

**Before (2s chunks):**
```
Chunk 1: "I'm using Transhuman"
Chunk 2: "on my Terminators"
Chunk 3: "for 2 CP"
```
❌ Even with context, current chunk is incomplete

**After (5s chunks):**
```
Chunk 1: "I'm using Transhuman on my Terminators for 2 CP"
```
✅ Current chunk is complete + has 10 previous transcripts for context

**Best of both worlds!**

---

## ⚙️ Future Enhancement: Contextual Summarization

**Idea:** Instead of raw transcripts, provide AI with structured summary.

**Current (raw transcripts):**
```
- Moving to shooting phase
- My Intercessors shoot
- I got 8 hits
- 6 wounds
- He failed 4 saves
```

**Enhanced (structured summary):**
```
PREVIOUS ACTIONS THIS TURN:
- Phase changed to: Shooting
- Combat: Intercessors → Terminators (8 hits, 6 wounds, 4 failed saves)

ACTIVE EFFECTS:
- Oath of Moment (on enemy Warlord)

RECENT STRATAGEMS:
- Oath of Moment (1 CP) - Command phase
```

**Would you want this?** Could make AI even smarter!

---

## 📊 Current Configuration

```typescript
// Conversation context
TRANSCRIPT_HISTORY_COUNT = 10  // Last 10 transcripts

// Chunking for passive mode  
SILENCE_DURATION = 5000 ms     // 5 seconds
MAX_RECORDING_TIME = 30000 ms  // 30 seconds

// Noise filtering
SPEECH_CONFIRMATION_TIME = 600 ms  // 0.6 seconds
SILENCE_THRESHOLD = -15 dB         // Noise tolerance
```

**Result:**
- ✅ Captures complete thoughts (5s chunks)
- ✅ Includes rich conversation history (10 transcripts)
- ✅ Full game state context
- ✅ AI makes informed decisions

---

## 🧪 How to Test Context System

### Test 1: Multi-Step Action

1. Say: "I'm in the shooting phase"
2. Wait for analysis
3. Say: "My Intercessors shoot at his Terminators"
4. Wait for analysis
5. Say: "I got 8 hits and 6 wounds"
6. Wait for analysis

**Check console:**
```
📜 Context: Using 2 previous transcriptions + current
📜 Context: Using 3 previous transcriptions + current
```

**AI should remember:**
- You're in Shooting phase (from transcript 1)
- Intercessors are shooting (from transcript 2)
- Can link hits/wounds to that combat (from transcript 3)

---

### Test 2: Stratagem Reference

1. Say: "Using Transhuman on my Terminators for 2 CP"
2. Wait for analysis (AI deducts 2 CP)
3. Later say: "Those same Terminators charge the enemy"

**AI should:**
- Remember which unit has Transhuman active
- Link "those same Terminators" to earlier mention
- Know they have defensive buff for overwatch

---

## 💬 Example AI Context (What It Actually Sees)

Here's what the AI receives for a typical analysis:

```
=== WARHAMMER 40K 10TH EDITION CORE RULES ===
[800+ lines of rules...]

=== CURRENT GAME STATE ===
Battle Round: 2
Current Phase: Shooting Phase (player's turn)
COMMAND POINTS: Player: 3 CP, Opponent: 2 CP
VICTORY POINTS: Player: 10 VP, Opponent: 8 VP
OBJECTIVES: Player controls 1,3,5 | Opponent controls 2,4 | Contested: 6
STRATAGEMS THIS ROUND: Oath of Moment (1 CP)
STRATAGEMS THIS PHASE: None yet

=== RECENT CONVERSATION ===
- Moving to shooting phase
- My Intercessors shoot at his Terminators  
- I got 8 hits and 6 wounds
- He failed 4 saves
- Two models destroyed
- I'm advancing my Terminators
- Using Oath of Moment on enemy Warlord
- Made the charge with Terminators
- Using Transhuman Physiology on them
- For 2 CP

=== CURRENT SPEECH ===
"My Terminators shoot at his Dreadnought and got 10 hits"

=== YOUR JOB ===
Analyze and call appropriate tools...
```

**Token count:** ~3000-5000 tokens (depending on conversation length)

**AI understanding:** 🧠 **Complete situational awareness!**

---

## ✅ Summary

**You asked:**
> "We need to keep track of all transcriptions and use previous ~10 as context"

**Answer:**
✅ **Already implemented!** Every analysis includes:
- Current transcription
- Last 10 previous transcriptions
- Full game state
- Rules reference
- Recent game events (stratagems, etc.)

**Just enhanced:**
- ✅ Increased from 5 to 10 transcripts (more context)
- ✅ Added logging to show context count
- ✅ Combined with 5-second passive mode (complete thoughts)

**Result:**
- ✅ AI has full conversational context
- ✅ Understands multi-step actions
- ✅ References earlier mentions
- ✅ Makes contextually aware decisions
- ✅ Better tool accuracy

---

## 🎯 Next Steps

1. **Test passive mode** (5 second chunks)
2. **Verify context in console** (look for `📜 Context: Using X previous transcriptions`)
3. **Try multi-step actions** to see context in action
4. **Let me know if 10 transcripts is enough** (can increase to 15-20 if needed)

**The system is already tracking everything - just needed longer chunks to capture complete thoughts!** 🎮

