# 🎤 Audio Validation System

## 🎯 Purpose

Prevent wasting API calls (Whisper and GPT-5) on silence, noise, or meaningless audio by implementing **multi-layer validation**.

---

## 📊 Problem Statement

Without validation, the system would:
- ❌ Send silent/empty audio to Whisper API (costs money)
- ❌ Process noise as speech (wasted GPT-5 calls)
- ❌ Analyze Whisper hallucinations (false positives)
- ❌ Create timeline events for meaningless transcriptions

**Cost Impact:**
- Whisper: ~$0.006 per minute of audio
- GPT-5-nano: ~$0.000075 per request
- False positives add up quickly over a session!

---

## 🛡️ Multi-Layer Defense System

### Layer 1: Client-Side Audio Analysis (Pre-Send)
**Location:** `lib/audioCapture.ts` (before sending to API)

**Checks:**
1. ✅ File size validation (1KB minimum, 25MB maximum)
2. ✅ Audio duration check (300ms minimum)
3. ✅ RMS (Root Mean Square) energy analysis
4. ✅ Peak amplitude detection
5. ✅ dB level measurement

**Thresholds:**
```typescript
MIN_DURATION = 0.3 seconds (300ms)
MIN_RMS = 0.01 (amplitude)
MIN_RMS_DB = -40 dB
MIN_PEAK = 0.05 (amplitude)
```

**Result:** Audio rejected client-side if it appears to be silence → **No API call made**

---

### Layer 2: Server-Side File Validation (Pre-Whisper)
**Location:** `app/api/analyze/route.ts` (before Whisper call)

**Checks:**
1. ✅ File size validation (1KB - 25MB)
2. ✅ File exists and is readable

**Result:** Early rejection before Whisper API call → **Saves Whisper costs**

---

### Layer 3: Transcription Validation (Post-Whisper)
**Location:** `app/api/analyze/route.ts` (after Whisper, before GPT)

**Checks:**
1. ✅ Empty/whitespace only
2. ✅ Too short (< 3 characters)
3. ✅ No alphanumeric characters
4. ✅ Noise patterns (uh, um, ah, etc.)
5. ✅ Repetitive characters (aaaaaaa)
6. ✅ Unusually long words (> 50 chars)
7. ✅ Whisper hallucination detection

**Common Whisper Hallucinations:**
- "thank you"
- "thanks for watching"
- "please subscribe"
- "you" (repeated)
- "the" (repeated)

**Result:** GPT-5 not called if transcription is meaningless → **Saves GPT costs**

---

## 🔍 Validation Functions

### `validateAudioBlob(audioBlob: Blob)`

Analyzes raw audio using Web Audio API.

```typescript
const validation = await validateAudioBlob(audioBlob);

if (!validation.isValid) {
  console.log('Rejected:', validation.reason);
  // Don't send to API
}
```

**Returns:**
```typescript
{
  isValid: boolean,
  reason?: string,
  confidence: number // 0-1 scale
}
```

**Example Output:**
```
Audio analysis: {
  duration: 1.23s,
  rms: 0.0234,
  rmsDb: -32.61dB,
  peakAmplitude: 0.1456
}
✅ Audio validation passed
```

---

### `validateTranscription(text: string)`

Checks if transcription is meaningful.

```typescript
const validation = validateTranscription("um uh");

if (!validation.isValid) {
  console.log('Rejected:', validation.reason);
  // Don't call GPT
}
```

**Returns:**
```typescript
{
  isValid: boolean,
  reason?: string,
  confidence: number
}
```

**Example Rejections:**
```
❌ Transcription too short (2 chars)
❌ Transcription contains no alphanumeric characters
❌ Transcription appears to be noise: "uh um ah"
❌ Transcription appears to be repetitive noise
```

---

### `isWhisperHallucination(text: string)`

Detects common Whisper hallucinations.

```typescript
if (isWhisperHallucination("thank you")) {
  // Rejected - common hallucination
}
```

**Detects:**
- Exact matches to known hallucinations
- Repetitive single-word patterns
- Common YouTube-style phrases (Whisper trained on YouTube)

---

## 📈 Validation Pipeline Flow

```
1. User speaks → Audio captured
         ↓
2. VAD detects silence → Recording stops
         ↓
3. CLIENT: Validate audio blob
   - Check size
   - Analyze audio content (RMS, dB, peak)
   ↓
   ❌ Invalid → STOP (no API call)
   ✅ Valid → Continue
         ↓
4. Send to /api/analyze
         ↓
5. SERVER: Validate file size
   ↓
   ❌ Invalid → Return early (no Whisper)
   ✅ Valid → Continue
         ↓
6. Call Whisper API
         ↓
7. Validate transcription
   - Check length, content, patterns
   - Check for hallucinations
   ↓
   ❌ Invalid → Return early (no GPT)
   ✅ Valid → Continue
         ↓
8. Call GPT-5 with tools
         ↓
9. Execute tools & update game state
```

---

## 🧪 Testing

### Test Scenario 1: Silence Detection

**Setup:**
1. Start audio capture
2. Don't speak for 2+ seconds
3. Recording stops automatically

**Expected:**
```
Audio rejected: too short or empty
```

**Result:** ✅ No API call made

---

### Test Scenario 2: Very Quiet Speech

**Setup:**
1. Speak very quietly (whisper)
2. Audio captured but below thresholds

**Expected:**
```
Audio analysis: {
  duration: 1.5s,
  rms: 0.002,
  rmsDb: -54.0dB,
  peakAmplitude: 0.01
}
Audio below thresholds - appears to be silence
Audio validation failed: Audio appears to be silence or too quiet
```

**Result:** ✅ No API call made

---

### Test Scenario 3: Background Noise Only

**Setup:**
1. Room noise without speech
2. Audio captured

**Expected:**
```
Audio validation passed (noise has energy)
→ Sent to Whisper
→ Transcription: "" (empty)
Transcription validation failed: Transcription is empty
```

**Result:** ✅ Whisper called, but GPT not called

---

### Test Scenario 4: Filler Words Only

**Setup:**
1. Say: "um uh ah"
2. Audio captured

**Expected:**
```
Audio validation passed
→ Whisper transcription: "Um, uh, ah."
Transcription appears to be noise: "um, uh, ah."
```

**Result:** ✅ Whisper called, but GPT not called

---

### Test Scenario 5: Whisper Hallucination

**Setup:**
1. 1-2 seconds of silence
2. Whisper might hallucinate common phrase

**Expected:**
```
Audio validation passed (borderline)
→ Whisper transcription: "Thank you."
Detected Whisper hallucination: Thank you.
```

**Result:** ✅ Whisper called, but GPT not called

---

### Test Scenario 6: Valid Speech

**Setup:**
1. Say: "Using Transhuman Physiology"
2. Clear, audible speech

**Expected:**
```
Audio analysis: {
  duration: 2.3s,
  rms: 0.0456,
  rmsDb: -26.8dB,
  peakAmplitude: 0.234
}
Audio validation passed
→ Whisper transcription: "Using Transhuman Physiology."
Transcription validation passed
→ GPT-5 called with tools
→ Tool execution: log_stratagem_use
```

**Result:** ✅ Full pipeline executed

---

## 📊 Cost Savings Estimate

### Before Validation:
- 100 audio captures per session
- 50% are silence/noise/hallucinations
- Cost: 100 Whisper + 100 GPT calls

### After Validation:
- 100 audio captures
- 25 rejected client-side (no API call)
- 10 rejected server-side (Whisper only)
- 15 rejected post-Whisper (GPT saved)
- 50 processed fully

**Savings:**
- 25% fewer Whisper calls (25 saved)
- 40% fewer GPT calls (40 saved)
- ~35% cost reduction overall

**Per Session (3 hours, very active):**
- Without validation: ~$3.00
- With validation: ~$1.95
- **Savings: $1.05 per session (35%)**

---

## ⚙️ Configuration

### Adjust Thresholds

**Audio Analysis Thresholds** (`lib/audioValidation.ts`):
```typescript
// Make validation more strict (fewer false positives)
const MIN_RMS = 0.02; // Higher threshold
const MIN_RMS_DB = -35; // Higher threshold
const MIN_PEAK = 0.08; // Higher threshold

// Make validation more lenient (fewer false negatives)
const MIN_RMS = 0.005; // Lower threshold
const MIN_RMS_DB = -45; // Lower threshold
const MIN_PEAK = 0.03; // Lower threshold
```

**Transcription Validation** (`lib/audioValidation.ts`):
```typescript
// Minimum meaningful length
const MIN_LENGTH = 5; // Require at least 5 characters

// Minimum word count
const MIN_WORD_COUNT = 2; // Require at least 2 words
```

**VAD Settings** (`lib/audioCapture.ts`):
```typescript
// More sensitive to speech
private readonly SILENCE_THRESHOLD = -55; // Lower = more sensitive

// Less sensitive (stricter)
private readonly SILENCE_THRESHOLD = -45; // Higher = less sensitive

// Faster response
private readonly SILENCE_DURATION = 1500; // 1.5 seconds

// Longer wait
private readonly SILENCE_DURATION = 3000; // 3 seconds
```

---

## 🐛 Debugging

### Enable Verbose Logging

Client-side logs are already enabled in `audioCapture.ts`:
```typescript
console.log('Audio validation failed:', validation.reason);
console.log('Audio validation passed, sending to API');
```

Server-side logs in `app/api/analyze/route.ts`:
```typescript
console.log('Audio file size: XXkB - processing');
console.log('Transcription validation failed:', reason);
console.log('Detected Whisper hallucination:', text);
```

### Check Browser Console

Look for validation messages:
```
Audio analysis: { duration: 1.23s, rms: 0.0234, ... }
Audio validation passed
Audio validation failed: Audio appears to be silence or too quiet
```

### Server Logs

Check terminal for validation rejections:
```
Audio file too small: 456 bytes - rejecting
Transcription validation failed: Too short (2 chars)
Detected Whisper hallucination: thank you
```

---

## 🎨 User Experience

### Silent Rejection (Good UX)
- No error message shown to user
- System simply waits for next speech
- Saves API calls invisibly
- Feels natural - like nothing happened

### Visual Feedback (Optional Enhancement)
Could add subtle indicators:
- "🔇 No speech detected" (transient message)
- Audio waveform visualization (show when audio is captured)
- Validation confidence meter

---

## 📝 Best Practices

### For Developers:

1. **Don't over-validate** - False negatives are worse than false positives
2. **Log everything** - Helps tune thresholds
3. **Monitor costs** - Track API usage before/after
4. **A/B test** - Try different thresholds
5. **User feedback** - If users complain about missed speech, lower thresholds

### For Users:

1. **Speak clearly** - Better audio = better detection
2. **Minimize background noise** - Improves accuracy
3. **Wait for pause** - Let VAD detect silence naturally
4. **Check microphone** - Ensure proper input levels

---

## 🚀 Future Enhancements

### 1. Machine Learning VAD
Replace threshold-based detection with ML model:
- WebRTC VAD
- Silero VAD
- More accurate speech detection

### 2. Audio Preprocessing
Before sending to Whisper:
- Noise reduction
- Volume normalization
- Silence trimming

### 3. Confidence Scoring
Return validation confidence to UI:
- High confidence → Proceed normally
- Low confidence → Show warning
- Very low → Reject

### 4. User Calibration
Let users test and adjust thresholds:
- Record sample audio
- Show analysis results
- Adjust sensitivity slider

### 5. Analytics Dashboard
Track validation metrics:
- Rejection rate
- False positive/negative rate
- Cost savings
- Adjust thresholds based on data

---

## ✅ Summary

**3-Layer Validation System:**
1. 🎤 **Client-Side Audio Analysis** - Reject silence before API call
2. 🖥️ **Server-Side File Check** - Validate size before Whisper
3. 📝 **Transcription Validation** - Check quality before GPT

**Benefits:**
- ✅ 35% cost reduction
- ✅ Faster response (fewer API calls)
- ✅ Better user experience (no meaningless events)
- ✅ Cleaner timeline (no noise entries)

**Trade-offs:**
- Tiny risk of false negatives (valid speech rejected)
- Slight processing overhead (audio analysis)
- More complex code to maintain

**Recommendation:** Enable all layers for production use. Monitor false negatives and adjust thresholds as needed.

---

**Status:** ✅ Fully Implemented & Ready for Testing

