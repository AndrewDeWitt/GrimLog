# `/api/transcribe` - Transcription-Only Endpoint

**Last Updated:** October 6, 2025  
**Status:** Complete

## Overview

Fast transcription endpoint that converts audio to text without AI analysis or tool execution. Used for building conversation context in the hybrid transcribe-analyze system.

## Purpose

- Build rich conversation history quickly
- Low cost (Whisper only, no GPT-5)
- Fast response (~1-2 seconds)
- Continuous conversation tracking

## Endpoint Details

**URL:** `POST /api/transcribe`

**Authentication:** None (relies on session ID for context)

**Content-Type:** `multipart/form-data`

---

## Request

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `audio` | File | Yes | Audio file (webm format from browser) |
| `sessionId` | string | Yes | Current game session ID |

### Request Format

```typescript
const formData = new FormData();
formData.append('audio', audioBlob, 'audio.webm');
formData.append('sessionId', currentSessionId);

const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData,
});
```

### Example Request

```javascript
// Browser code
const audioBlob = new Blob([audioData], { type: 'audio/webm' });

const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');
formData.append('sessionId', 'session-uuid-here');

try {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  });
  
  const result = await response.json();
  console.log('Transcribed:', result.transcription);
} catch (error) {
  console.error('Transcription failed:', error);
}
```

---

## Response

### Success Response (200 OK)

```typescript
{
  success: true,
  transcription: string,        // Transcribed text
  sequenceOrder: number,         // Sequence number in conversation
  savedToDb: boolean,            // Always true for this endpoint
  validation: {
    isValid: boolean,
    reason?: string              // If invalid, why it was rejected
  }
}
```

### Example Success Response

```json
{
  "success": true,
  "transcription": "Moving to my shooting phase",
  "sequenceOrder": 42,
  "savedToDb": true,
  "validation": {
    "isValid": true
  }
}
```

### Validation Failed Response (200 OK)

Even when transcription is invalid, endpoint returns 200 with validation failure:

```json
{
  "success": false,
  "transcription": "um uh",
  "savedToDb": false,
  "validation": {
    "isValid": false,
    "reason": "Transcription appears to be noise: um uh"
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Missing required field: sessionId"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Whisper transcription failed: [error details]"
}
```

---

## Processing Flow

```
1. Receive audio file + sessionId
         ↓
2. Validate file size (1KB - 25MB)
         ↓
3. Call OpenAI Whisper API
         ↓
4. Transcribe audio to text
         ↓
5. Validate transcription quality
   - Check length (>= 3 chars)
   - Check for noise patterns
   - Check for hallucinations
         ↓
6. If valid: Save to database
   - Create TranscriptHistory record
   - Link to game session
   - Assign sequence number
         ↓
7. Return response with transcription
```

---

## Validation Checks

### Server-Side File Validation

**Before Whisper:**
- ✅ File size: 1KB minimum, 25MB maximum
- ✅ File exists and is readable

**Rejects with error if validation fails**

### Transcription Validation

**After Whisper:**
- ✅ Not empty/whitespace only
- ✅ Length >= 3 characters
- ✅ Contains alphanumeric characters
- ✅ Not just noise (um, uh, ah)
- ✅ Not repetitive characters (aaaa)
- ✅ No unusually long words (> 50 chars)
- ✅ Not a Whisper hallucination

**Common Whisper Hallucinations:**
- "thank you"
- "thanks for watching"
- "please subscribe"
- Repeated single words

**Returns success=false with reason if invalid**

---

## Database Impact

### TranscriptHistory Table

**When transcription is valid:**

```sql
INSERT INTO TranscriptHistory (
  id,
  gameSessionId,
  transcription,
  sequenceOrder,
  timestamp
) VALUES (
  'uuid',
  'session-uuid',
  'Moving to my shooting phase',
  42,
  CURRENT_TIMESTAMP
);
```

**Sequence numbers** are auto-incremented for chronological ordering.

### No Impact When Invalid

If transcription validation fails, no database record is created.

---

## Comparison with `/api/analyze`

| Feature | `/api/transcribe` | `/api/analyze` |
|---------|-------------------|----------------|
| **Purpose** | Build context | Make decisions |
| **Frequency** | Every 5s | Smart triggers |
| **Whisper Call** | ✅ Yes | ✅ Yes |
| **GPT-5 Call** | ❌ No | ✅ Yes |
| **Tool Execution** | ❌ No | ✅ Yes |
| **Save to DB** | ✅ Yes | ✅ Yes |
| **Cost** | ~$0.006/min | ~$0.075/call |
| **Response Time** | ~1-2s | ~3-5s |
| **Context Used** | None | 10-15 transcripts |

---

## When to Use

### Use `/api/transcribe` when:

- ✅ Building conversation context
- ✅ Fast transcription needed
- ✅ No immediate action required
- ✅ Between analysis intervals
- ✅ Accumulating information

### Use `/api/analyze` when:

- ✅ Smart trigger activates
- ✅ Need tool execution
- ✅ Complete context available
- ✅ Ready to make decisions

---

## Cost Analysis

### Per Transcription

**Whisper API:**
- ~$0.006 per minute of audio
- Average audio: 3 seconds = $0.0003

**Database:**
- Negligible (SQLite/PostgreSQL insert)

**Total:** ~$0.0003 per call

### Per Session

**With 30 transcriptions per session:**
- 30 × $0.0003 = **$0.009 per session**

**Compare to analyzing every transcription:**
- 30 × $0.075 = $2.25 per session
- **Savings: $2.24 per session (99.6%!)**

---

## Error Handling

### Client-Side

```typescript
async function transcribeAudio(audioBlob: Blob, sessionId: string) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('sessionId', sessionId);
    
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.log('Transcription invalid:', result.validation?.reason);
      return null;
    }
    
    return result.transcription;
    
  } catch (error) {
    console.error('Transcription failed:', error);
    return null;
  }
}
```

### Server-Side

The endpoint includes comprehensive error handling:

1. **File validation errors** → 400 Bad Request
2. **Whisper API errors** → Retry with exponential backoff (3 attempts)
3. **Database errors** → Log but don't fail (graceful degradation)
4. **Validation failures** → Return success=false with reason

---

## Testing

### Test Scenario 1: Valid Speech

**Request:**
```javascript
// Audio contains: "Using Transhuman Physiology"
formData.append('audio', audioBlob);
formData.append('sessionId', 'test-session-id');
```

**Expected Response:**
```json
{
  "success": true,
  "transcription": "Using Transhuman Physiology",
  "sequenceOrder": 1,
  "savedToDb": true,
  "validation": {
    "isValid": true
  }
}
```

### Test Scenario 2: Noise Only

**Request:**
```javascript
// Audio contains: "um uh ah"
formData.append('audio', audioBlob);
formData.append('sessionId', 'test-session-id');
```

**Expected Response:**
```json
{
  "success": false,
  "transcription": "um uh ah",
  "savedToDb": false,
  "validation": {
    "isValid": false,
    "reason": "Transcription appears to be noise: um uh ah"
  }
}
```

### Test Scenario 3: Empty Audio

**Request:**
```javascript
// Audio is silent
formData.append('audio', silentAudioBlob);
formData.append('sessionId', 'test-session-id');
```

**Expected Response:**
```json
{
  "success": false,
  "transcription": "",
  "savedToDb": false,
  "validation": {
    "isValid": false,
    "reason": "Transcription is empty"
  }
}
```

### Test Scenario 4: Hallucination

**Request:**
```javascript
// Audio is very quiet, Whisper hallucinates
formData.append('audio', quietAudioBlob);
formData.append('sessionId', 'test-session-id');
```

**Expected Response:**
```json
{
  "success": false,
  "transcription": "Thank you.",
  "savedToDb": false,
  "validation": {
    "isValid": false,
    "reason": "Detected Whisper hallucination: Thank you."
  }
}
```

---

## Related Documentation

- [Analyze Endpoint](ANALYZE_ENDPOINT.md) - Full analysis with tool execution
- [Context System Guide](../guides/CONTEXT_SYSTEM_GUIDE.md) - How transcriptions build context
- [Audio/VAD Guide](../guides/AUDIO_VAD_GUIDE.md) - Audio capture and validation
- [Architecture](../ARCHITECTURE.md) - System overview

---

## Implementation Reference

**File:** `app/api/transcribe/route.ts`

**Key dependencies:**
- `lib/audioValidation.ts` - Validation functions
- `lib/prisma.ts` - Database client
- OpenAI Whisper API

---

**Status:** ✅ Production Ready  
**Performance:** <2s response time, 99.6% cost savings vs full analysis
