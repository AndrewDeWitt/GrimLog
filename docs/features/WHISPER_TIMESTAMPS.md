# Whisper Timestamp System

**Last Updated:** 2025-10-07  
**Status:** Complete  
**Version:** 2.6.0

## Overview

The Whisper Timestamp System uses OpenAI's Whisper API segment-level timestamps to accurately track **when** each event occurred during gameplay, rather than using a single timestamp for all events in an audio batch. This provides a true chronological timeline of the battle.

## Problem Solved

**Before:**
```
[Audio Recording: 15 seconds]
  0:00 - "Moving to shooting phase"
  0:05 - "Okay now charging" 
  0:10 - "Now in fight phase"
  
[All events stamped: 9:58:00 PM] ❌
  ✓ Phase changed to Shooting    [9:58:00 PM]
  ✓ Phase changed to Charge      [9:58:00 PM]
  ✓ Phase changed to Fight       [9:58:00 PM]
```

**After:**
```
[Audio Recording: 15 seconds with Whisper segments]
  Segment 0 (0.0s-3.5s): "Moving to shooting phase"
  Segment 1 (4.2s-7.8s): "Okay now charging"
  Segment 2 (9.1s-12.5s): "Now in fight phase"
  
[Events with accurate timestamps] ✅
  ✓ Phase changed to Shooting    [9:58:00 PM]
  ✓ Phase changed to Charge      [9:58:05 PM]
  ✓ Phase changed to Fight       [9:58:10 PM]
```

## How It Works

### 1. **Whisper Segment Timestamps**

When transcribing audio, we now request `verbose_json` format with `segment` granularity:

```typescript
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  language: 'en',
  response_format: 'verbose_json', // Get detailed response
  timestamp_granularities: ['segment'], // Get segment-level timestamps
});
```

Whisper returns:
```json
{
  "text": "Moving to shooting phase. Okay now charging. Now in fight phase.",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.5,
      "text": "Moving to shooting phase."
    },
    {
      "id": 1,
      "start": 4.2,
      "end": 7.8,
      "text": "Okay now charging."
    },
    {
      "id": 2,
      "start": 9.1,
      "end": 12.5,
      "text": "Now in fight phase."
    }
  ]
}
```

### 2. **Timestamp Matching**

The system distributes tool calls across segments chronologically:

```typescript
// If there are 3 tool calls and 5 segments
// Tool 0 → Segment 0 (0%)
// Tool 1 → Segment 2 (50%)
// Tool 2 → Segment 4 (100%)

const segmentIndex = Math.floor((toolIndex / totalToolCalls) * segments.length);
const matchedSegment = segments[segmentIndex];
const timestamp = new Date(audioStartTime.getTime() + matchedSegment.start * 1000);
```

### 3. **Event Creation**

Timeline events now use the calculated timestamp:

```typescript
await prisma.timelineEvent.create({
  data: {
    gameSessionId: sessionId,
    eventType: 'phase',
    phase: 'Shooting',
    description: 'Phase changed to Shooting',
    timestamp: customTimestamp || new Date() // Uses Whisper timestamp
  }
});
```

## Architecture

### **Files Modified**

**Database Schema:**
- `prisma/schema.prisma` - Added `segments` field to `TranscriptHistory`

**Transcription Endpoints:**
- `app/api/transcribe/route.ts` - Request and store segment timestamps
- `app/api/analyze/route.ts` - Request segments and calculate event timestamps

**Core Logic:**
- `lib/timestampMatching.ts` - **NEW** - Timestamp matching utilities
- `lib/toolHandlers.ts` - Accept `customTimestamp` parameter for all tool handlers

### **New Utility Functions**

**`lib/timestampMatching.ts`:**

```typescript
// Calculate timestamp for a specific tool call
getToolCallTimestamp(
  toolCallIndex: number,
  totalToolCalls: number,
  segments: WhisperSegment[],
  audioStartTime: Date
): Date

// Find segment that matches specific text
findSegmentByText(
  searchText: string,
  segments: WhisperSegment[],
  audioStartTime: Date
): Date | null

// Get all segment timestamps for debugging
getAllSegmentTimestamps(
  segments: WhisperSegment[],
  audioStartTime: Date
): Array<{ text, timestamp, duration }>

// Log segment timeline to console
logSegmentTimeline(
  segments: WhisperSegment[],
  audioStartTime: Date
): void
```

## Database Schema

### **TranscriptHistory Model**

```prisma
model TranscriptHistory {
  id            String      @id @default(uuid())
  gameSession   GameSession @relation(...)
  gameSessionId String
  timestamp     DateTime    @default(now())
  text          String      // Full transcription
  sequenceOrder Int         // Sequential order
  audioLength   Float?      // Duration in seconds
  segments      String?     // NEW: JSON array of Whisper segments
  
  @@index([gameSessionId, sequenceOrder])
}
```

**Segments JSON Format:**
```json
[
  {
    "id": 0,
    "start": 0.0,
    "end": 3.5,
    "text": "Moving to shooting phase.",
    "tokens": [...],
    "avg_logprob": -0.2,
    "no_speech_prob": 0.001
  },
  ...
]
```

## Example Flow

### **Voice Commands with Multiple Events**

**User speaks (over 12 seconds):**
```
"Alright moving to shooting phase... 
 *pause* 
 Okay I'm charging now... 
 *pause* 
 Now in the fight phase"
```

**Whisper Response:**
```json
{
  "text": "Alright moving to shooting phase. Okay I'm charging now. Now in the fight phase.",
  "segments": [
    { "id": 0, "start": 0.0, "end": 2.8, "text": "Alright moving to shooting phase." },
    { "id": 1, "start": 5.1, "end": 7.3, "text": "Okay I'm charging now." },
    { "id": 2, "start": 9.5, "end": 11.8, "text": "Now in the fight phase." }
  ]
}
```

**AI Tool Calls:**
```javascript
[
  { name: 'change_phase', args: { new_phase: 'Shooting', ... } },
  { name: 'change_phase', args: { new_phase: 'Charge', ... } },
  { name: 'change_phase', args: { new_phase: 'Fight', ... } }
]
```

**Timestamp Calculation:**
```typescript
// Audio started at: 9:58:00.000 PM

// Tool 0 (index 0 of 3) → Segment 0 (start: 0.0s)
timestamp1 = 9:58:00.000 PM + 0.0s = 9:58:00 PM

// Tool 1 (index 1 of 3) → Segment 1 (start: 5.1s)
timestamp2 = 9:58:00.000 PM + 5.1s = 9:58:05 PM

// Tool 2 (index 2 of 3) → Segment 2 (start: 9.5s)
timestamp3 = 9:58:00.000 PM + 9.5s = 9:58:10 PM
```

**Timeline Events Created:**
```
[9:58:00 PM] Phase changed to Shooting (player's turn)
[9:58:05 PM] Phase changed to Charge (player's turn)
[9:58:10 PM] Phase changed to Fight (player's turn)
```

## Benefits

### ✅ **Accurate Chronology**
- Events appear in the order they actually happened
- Timestamps reflect when user actually spoke each command
- True battle timeline reconstruction

### ✅ **Better Context**
- Can see gaps between actions (pauses, deliberation time)
- Understand pacing of the game
- More natural battle flow visualization

### ✅ **No Extra Cost**
- Same API call to Whisper
- Just requesting more detailed response format
- No additional transcription needed

### ✅ **Fallback Support**
- If segments aren't available, falls back to sequential offset (2s between events)
- System degrades gracefully

## Debugging

### **Console Logs**

When analyzing audio, you'll see:

```
📝 Whisper Segment Timeline:
  [0] 9:58:00 PM (+2.8s): "Alright moving to shooting phase."
  [1] 9:58:05 PM (+2.2s): "Okay I'm charging now."
  [2] 9:58:10 PM (+2.3s): "Now in the fight phase."

Executing 3 tool calls in parallel...
  Tool 1/3 timestamp: 9:58:00 PM
  Tool 2/3 timestamp: 9:58:05 PM
  Tool 3/3 timestamp: 9:58:10 PM
```

### **Database Inspection**

Check segment data:
```typescript
const transcript = await prisma.transcriptHistory.findFirst({
  where: { gameSessionId: 'session-id' },
  orderBy: { sequenceOrder: 'desc' }
});

const segments = JSON.parse(transcript.segments || '[]');
console.log('Segments:', segments);
```

Check event timestamps:
```typescript
const events = await prisma.timelineEvent.findMany({
  where: { gameSessionId: 'session-id' },
  orderBy: { timestamp: 'asc' }
});

events.forEach(e => {
  console.log(`${e.timestamp.toLocaleTimeString()}: ${e.description}`);
});
```

## Limitations

### **Timestamp Precision**

- **Segment-level, not word-level:** Whisper provides segment timestamps (usually phrases/sentences), not individual word timestamps
- **Distribution assumption:** System assumes tool calls are evenly distributed across speech segments
- **Still approximate:** If user says "shooting phase charging phase fight phase" in 1 second, all will be in same segment

### **Fallback Scenarios**

- **No segments:** Falls back to 2-second incremental offset
- **Empty segments:** Uses current time for all events
- **Single segment:** All events get same timestamp

### **Not Real-Time**

- Timestamps reflect when user **spoke**, not when system **processed**
- There's still processing delay (Whisper + GPT + database)
- Timeline shows battle chronology, not system response times

## Future Enhancements

### **Word-Level Timestamps**
Could request word-level granularity for even more precision:
```typescript
timestamp_granularities: ['word'] // More precise but more data
```

### **Text Matching**
Could match tool call content to specific segments:
```typescript
// Match "shooting phase" text to segment containing "shooting"
const matchedSegment = findSegmentByText('shooting phase', segments, audioStartTime);
```

### **Duration Tracking**
Could track how long actions took:
```typescript
const duration = segment.end - segment.start;
// "Shooting phase lasted 2.3 seconds"
```

## Related Documentation

- **[Audio VAD System](../guides/AUDIO_VAD_GUIDE.md)** - How audio is captured and chunked
- **[AI Tool Calling](AI_TOOL_CALLING.md)** - How commands are processed
- **[Game State Tracking](GAME_STATE_TRACKING.md)** - How events are recorded

## Testing

### **Verify Timestamps**

1. Start audio capture
2. Say multiple commands with pauses:
   - "Moving to shooting" *[wait 3s]*
   - "Now charging" *[wait 3s]*
   - "Fight phase"
3. Check timeline - timestamps should be ~3 seconds apart
4. Check console for segment timeline log

### **Expected Behavior**

- **Sequential commands:** Each gets distinct timestamp based on when spoken
- **Rapid commands:** May share same segment timestamp (still in order)
- **Long pauses:** Should show accurate gap in timeline
