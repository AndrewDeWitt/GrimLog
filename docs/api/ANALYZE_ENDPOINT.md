# 📡 Analyze API Endpoint - Complete Documentation

## 🎯 Overview

The `/api/analyze` endpoint is the heart of the Grimlog system. It orchestrates audio transcription, context building, AI analysis, game validation, and tool execution. Supports multiple AI providers (OpenAI and Google Gemini).

**Last Updated:** November 4, 2025  
**Version:** 4.4.0 - Multi-Provider Support with Context-Aware Analysis

---

## 🏗️ System Architecture

```
User Speech
    ↓
VAD (Voice Activity Detection)
    ↓ (Every 5s of silence)
/api/transcribe ━━━━━━━━━━┓
    ↓                      ↓
Whisper API           Accumulate
    ↓                 Transcripts
Validate              ↓
    ↓                 Smart Trigger
Save to DB            Detection
    ↓                      ↓
Return              Trigger Met?
    ↓                      ↓
Continue           /api/analyze ━━━━┓
Listening               ↓           ↓
                   Whisper API  Fetch Context
                        ↓           ↓
                   Validate     - Last 10 transcripts
                        ↓       - Game state
                   Save to DB  - Stratagems used
                        ↓       - Rules reference
                   Build Full Context
                        ↓
                   AI Provider Selection
                   (OpenAI GPT-5 OR Google Gemini)
                        ↓
                   AI Analysis with Tools
                        ↓
                   Execute Tools
                        ↓
                   Validate Actions
                        ↓
                   Update Game State
                        ↓
                   Return Results
```

---

## 🎤 Dual-Endpoint System

### Endpoint 1: `/api/transcribe` (Frequent)

**Purpose:** Fast transcription without analysis

**Frequency:** Every 5 seconds of silence

**Process:**
1. Validate audio file size
2. Call Whisper API
3. Validate transcription quality
4. Check for hallucinations
5. Save to database
6. Return (no GPT call, no tools)

**Response Time:** ~2-3 seconds

**Cost:** ~$0.006 per transcription

---

### Endpoint 2: `/api/analyze` (Context-Aware)

**Purpose:** Full analysis with tool calling

**Frequency:** When smart triggers detect natural stopping points

**Triggers:**
1. **Priority keyword** ("Grimlog") → Instant
2. **Completion phrase** ("done with", "moving to") → Immediate
3. **Long silence** (10s+ no speech) → Natural break
4. **Min context** (3+ transcripts) → Enough info
5. **Safety limit** (30s max) → Eventual analysis

**Process:**
1. All of `/api/transcribe` steps, PLUS:
2. **Intent Classification** (gpt-5-nano OR gemini-2.5-flash)
3. Fetch last 10-20 transcripts from database
4. Fetch current game state (CP, VP, phase, etc.)
5. Fetch recent stratagems
6. **Build tier-appropriate context** (minimal/units_only/unit_names/objectives/secondaries/full)
7. **Call AI provider** (gpt-5-mini OR gemini-2.5-flash) with tools
8. Execute tool calls in parallel
9. Validate actions against rules
10. Log validation events
11. Update game state
12. Return tool results + validations

**Response Time:** ~2-5 seconds (optimized with context tiers)

**Cost (OpenAI):** ~$0.006 (Whisper) + ~$0.002 (gpt-5-nano) + ~$0.015-0.075 (gpt-5-mini) = ~$0.023-0.083  
**Cost (Gemini):** ~$0.006 (Whisper) + Free (gemini-2.5-flash) = ~$0.006

---

## 🤖 AI Provider Support (v4.4.0)

The analyze endpoint supports two AI providers, selectable via the `AI_PROVIDER` environment variable:

### OpenAI (Default)
```bash
AI_PROVIDER=openai  # or omit (defaults to openai)
OPENAI_API_KEY=sk-...
```

**Models Used:**
- **Intent Classification:** `gpt-5-nano` (fast, cheap)
- **Main Analysis:** `gpt-5-mini` (powerful, reasoning)

**Characteristics:**
- More comprehensive multi-action inference
- Better at parsing complex compound commands
- Two-model approach (fast intent + powerful analysis)
- Mature tool calling with strict parameter handling

### Google Gemini
```bash
AI_PROVIDER=google
GOOGLE_API_KEY=...
```

**Models Used:**
- **Intent Classification:** `gemini-2.5-flash`
- **Main Analysis:** `gemini-2.5-flash`

**Characteristics:**
- Single model for both operations
- Free tier available
- Good cost efficiency
- Structured output support
- Simpler, clear commands work best

### Provider Selection Logic

The system automatically:
1. Reads `AI_PROVIDER` from environment (defaults to `openai`)
2. Validates required API key is present
3. Selects appropriate models for intent and analysis
4. Normalizes responses to common format
5. Logs provider name in Langfuse traces

See [Google Gemini Integration Guide](../features/GOOGLE_GEMINI_INTEGRATION.md) for detailed comparison.

---

## 📥 Request Format

### `/api/transcribe`
```typescript
FormData {
  audio: Blob,          // Audio file (webm format)
  sessionId: string     // Game session ID
}
```

### `/api/analyze`
```typescript
FormData {
  transcription: string, // Text from Speech API
  sessionId: string,     // Game session ID
  armyContext: string    // Optional: Army list context
}
```

---

## 📤 Response Format

### `/api/transcribe` Response
```typescript
{
  transcription: string,     // Whisper transcription
  saved: boolean,            // Whether saved to DB
  sequenceOrder: number,     // Transcript sequence number
  shouldAnalyze: boolean,    // Always false for this endpoint
  reason?: string            // Why not analyzed / validation failure
}
```

### `/api/analyze` Response
```typescript
{
  type: 'event' | 'none',
  transcription: string,
  confidence: number,
  toolCalls: [
    {
      toolName: string,
      success: boolean,
      message: string,
      data: any,
      validation?: {
        severity: 'info' | 'warning' | 'error' | 'critical',
        message: string,
        rule?: string,
        suggestion?: string,
        requiresOverride: boolean
      }
    }
  ]
}
```

---

## 🧠 Context Building

### What AI Receives (Full Analysis)

```
=== WARHAMMER 40K 10TH EDITION CORE RULES ===
[800+ lines of rules reference]

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

=== RECENT CONVERSATION (Last 10-15 transcripts) ===
- Moving to shooting phase
- My Intercessors shoot at his Terminators
- Got 8 hits and 6 wounds through
- He failed 4 saves
- [... more recent conversation ...]

=== CURRENT ANALYSIS ===
Analyze the accumulated context and call appropriate tools
```

**Token count:** ~3000-6000 tokens per analysis

---

## 🔍 Smart Trigger Logic

**File:** `lib/analysisTriggers.ts`

```typescript
export function checkAnalysisTriggers(
  recentTranscripts: string[],      // Accumulated since last analysis
  timeSinceLastAnalysis: number,    // Milliseconds
  timeSinceLastSpeech: number       // Milliseconds
): AnalysisTriggerResult {
  
  // Priority 1: Urgent keywords
  if (hasPriorityKeyword(latest)) {
    return { shouldAnalyze: true, reason: 'Priority keyword', confidence: 1.0 };
  }
  
  // Priority 2: Natural completion
  if (hasCompletionPhrase(latest)) {
    return { shouldAnalyze: true, reason: 'Completion phrase', confidence: 0.9 };
  }
  
  // Priority 3: Long natural break
  if (timeSinceLastSpeech > 10000) {
    return { shouldAnalyze: true, reason: 'Long silence', confidence: 0.85 };
  }
  
  // Priority 4: Accumulated enough context
  if (recentTranscripts.length >= 3 && timeSinceLastAnalysis > 8000) {
    return { shouldAnalyze: true, reason: 'Min transcripts', confidence: 0.75 };
  }
  
  // Priority 5: Safety limit
  if (timeSinceLastAnalysis > 30000) {
    return { shouldAnalyze: true, reason: 'Max time', confidence: 0.6 };
  }
  
  // No trigger - keep accumulating
  return { shouldAnalyze: false, reason: 'Accumulating...', confidence: 0 };
}
```

---

## 🛡️ Multi-Layer Validation

### Audio Validation (3 Layers)

**Layer 1: Client-Side (Pre-Send)**
```typescript
// lib/audioValidation.ts
validateAudioBlob(blob)
  - Check file size (1KB - 25MB)
  - Analyze audio content (RMS, dB, peak)
  - Detect silence vs speech
```

**Layer 2: Server-Side (Pre-Whisper)**
```typescript
// app/api/*/route.ts
if (audioFile.size < 1000) reject();
if (audioFile.size > 25MB) reject();
```

**Layer 3: Transcription (Post-Whisper)**
```typescript
// app/api/*/route.ts
validateTranscription(text)
  - Check length, content
  - Detect noise patterns
  - Check for hallucinations
```

---

### Game Validation (AI-Driven)

**Validation Functions:**
```typescript
// lib/validationHelpers.ts
validateCommandPointChange()
validatePhaseTransition()
validateStratagemUse()
validateRoundAdvancement()
```

**Severity Levels:**
- ℹ️ **INFO** - Unusual but valid
- ⚠️ **WARNING** - Suspicious, verify
- ❌ **ERROR** - Rule violation
- 🚨 **CRITICAL** - Severe mistake

**All validations logged to `ValidationEvent` table**

---

## 📊 Example Session Flow

### Minute 1: Setup
```
0:00 - "Starting new game, I'm going first"
0:05 → Transcribe only (#1)
0:06 - "Command phase, gaining 1 CP"
0:11 → Transcribe only (#2)
0:12 - "And that's command done"
0:17 → ✅ TRIGGER: Completion phrase
       Analysis: update_command_points(+1)
```

### Minute 2: Movement
```
1:00 - "Moving to movement phase"
1:05 → ✅ TRIGGER: Completion phrase "moving to"
       Analysis: change_phase(Movement)

1:10 - "Terminators advance 6 inches"
1:15 → Transcribe only (#1)
1:20 - "Intercessors move center"
1:25 → Transcribe only (#2)

[15 seconds of silence - moving models]

1:40 → ✅ TRIGGER: Long silence (15s)
       Analysis: log_unit_action x2
```

### Minute 3: Shooting  
```
2:00 - "Shooting phase now"
2:05 → ✅ TRIGGER: Completion phrase
       Analysis: change_phase(Shooting)

2:10 - "Using Transhuman on Terminators"
2:15 → Transcribe (#1)
2:20 - "For 2 CP"
2:25 → Transcribe (#2)
2:30 - "They shoot at Dreadnought"
2:35 → Transcribe (#3)
2:40 → ✅ TRIGGER: Min context (3 transcripts)
       Analysis: log_stratagem_use, log_combat_result
```

**Total in 3 minutes:**
- **Transcriptions:** 10-12 (every 5s)
- **Analyses:** 5-6 (only at natural points)
- **Context per analysis:** 3-5 transcripts
- **Tool calls:** 8-10 total

---

## 💰 Cost Breakdown

### Per Session (3 hours, active gameplay)

**Transcriptions:**
- Count: ~200 (every 5s average)
- Cost: 200 × $0.006 = $1.20

**Analyses:**
- Count: ~40 (context-aware triggers)
- Cost: 40 × $0.075 = $3.00

**Total:** $4.20 per session

**vs Time-Based (every 15s):**
- Analyses: ~80
- Cost: ~$7.20
- **Savings: $3.00 per session (42%)**

**vs Analyze Every Chunk:**
- Analyses: ~200  
- Cost: ~$16.20
- **Savings: $12.00 per session (74%)**

---

## 🔧 Tuning Guide

### Make More Responsive:
```typescript
LONG_SILENCE_THRESHOLD = 8000 ms   // 8 seconds
MIN_TRANSCRIPTS = 2                // 2 transcripts
```

### Make More Passive:
```typescript
LONG_SILENCE_THRESHOLD = 15000 ms  // 15 seconds
MIN_TRANSCRIPTS = 5                // 5 transcripts
```

### Add Custom Triggers:

**File:** `lib/analysisTriggers.ts`

```typescript
const ACTION_COMPLETION_PHRASES = [
  // Add your phrases
  'next unit',
  'back to you',
  'your turn',
];

const PRIORITY_KEYWORDS = [
  // Add your keywords
  'urgent',
  'quick question',
];
```

---

## 🐛 Debugging

### Check Transcription Frequency:
```
Look for: "📝 Transcribed only" every ~5-10 seconds
```

### Check Analysis Triggers:
```
Look for: "🔍 Analysis trigger check: [reason]"
```

### Check Full Analyses:
```
Look for: "🤖 Triggering FULL ANALYSIS: [reason]"
```

### Check Context:
```
Look for: "📜 Context: Using X previous transcriptions + current"
```

---

## ✅ Success Indicators

**System is working correctly when:**
- ✅ Transcriptions happen every 5-10 seconds
- ✅ Analyses happen at natural stopping points
- ✅ Completion phrases trigger analysis
- ✅ Long silences trigger analysis
- ✅ Tool calls have complete context
- ✅ Timeline shows accurate events
- ✅ Validation warnings appear when appropriate

---

## 📚 Related Documentation

- **Architecture:** `docs/FINAL_SYSTEM_ARCHITECTURE.md`
- **Triggers:** `docs/CONTEXT_AWARE_TRIGGERS.md`
- **Context:** `docs/CONVERSATION_CONTEXT_SYSTEM.md`
- **Quick Start:** `QUICK_START_CONTEXT_AWARE.md`

---

**The analyze endpoint is now intelligent, context-aware, and cost-efficient!** 🎯

