# ⚙️ Configuration Reference - Audio Validation & VAD System

## 🎯 Quick Configuration Guide

All configurable settings in one place for easy tuning.

---

## 🎤 VAD (Voice Activity Detection) Settings

**File:** `lib/audioCapture.ts` (lines 16-21)

### SILENCE_THRESHOLD
**What it does:** Audio level that separates speech from silence  
**Current:** `-15 dB`  
**Range:** `-60 dB` (very sensitive) to `-5 dB` (very strict)

```typescript
private readonly SILENCE_THRESHOLD = -15; // dB
```

**Adjust for your environment:**
- **Quiet room (library/studio):** `-50 dB` to `-40 dB`
- **Normal home office:** `-35 dB` to `-25 dB`
- **Noisy environment (your setup):** `-20 dB` to `-15 dB`
- **Very noisy (open office):** `-15 dB` to `-10 dB`
- **Extremely noisy (café):** `-10 dB` to `-5 dB`

**How to find your value:**
1. Click START, don't speak
2. Watch console: `📊 Audio level: -18.5dB`
3. Note the typical range when silent (e.g., -18dB to -22dB)
4. Set threshold 2-3dB **below** the lowest value (e.g., -24dB)

---

### SILENCE_DURATION
**What it does:** How long silence must be sustained before stopping recording  
**Current:** `2000 ms` (2 seconds)  
**Range:** `1000 ms` to `5000 ms`

```typescript
private readonly SILENCE_DURATION = 2000; // ms
```

**Adjust for your speaking style:**
- **Fast talker / short pauses:** `1500 ms` (1.5 seconds)
- **Normal:** `2000 ms` (2 seconds)
- **Slow talker / long pauses:** `3000 ms` (3 seconds)
- **Very deliberate:** `4000 ms` (4 seconds)

**Trade-off:**
- Shorter → Faster response, but might cut you off mid-thought
- Longer → Won't interrupt you, but slower to respond

---

### SPEECH_CONFIRMATION_TIME
**What it does:** How long speech must be sustained before recording starts (anti-twitch)  
**Current:** `600 ms` (0.6 seconds)  
**Range:** `200 ms` to `1000 ms`

```typescript
private readonly SPEECH_CONFIRMATION_TIME = 600; // ms
```

**Adjust for noise filtering:**
- **Clean environment, quick response:** `300 ms`
- **Normal, balanced:** `500 ms` to `600 ms`
- **Noisy, filter more noise:** `700 ms` to `800 ms`
- **Very noisy, strict filtering:** `1000 ms` (1 second)

**Trade-off:**
- Shorter → More responsive, but might catch coughs/clicks
- Longer → Filters more noise, but might miss first syllable

**Recommendation:** Start at `600 ms`, adjust based on testing

---

### MIN_RECORDING_TIME
**What it does:** Minimum duration for a recording to be sent to API  
**Current:** `1000 ms` (1 second)  
**Range:** `500 ms` to `3000 ms`

```typescript
private readonly MIN_RECORDING_TIME = 1000; // ms
```

**Adjust for chunk quality:**
- **Allow short phrases:** `500 ms` to `700 ms`
- **Normal sentences:** `1000 ms` (1 second)
- **Only full thoughts:** `2000 ms` (2 seconds)

**Trade-off:**
- Shorter → Captures quick responses
- Longer → Filters tiny noise chunks

---

### DEBUG_LOG_INTERVAL
**What it does:** How often to log current audio level to console  
**Current:** `5000 ms` (every 5 seconds)

```typescript
private readonly DEBUG_LOG_INTERVAL = 5000; // ms
```

**Adjust for debugging:**
- **Active debugging:** `1000 ms` (1 second)
- **Normal:** `5000 ms` (5 seconds)
- **Production (less logging):** `30000 ms` (30 seconds)
- **Disable:** `99999999 ms` (never)

---

## 🔊 Audio Validation Thresholds

**File:** `lib/audioValidation.ts`

### Duration Check (Line 57)
```typescript
const MIN_DURATION = 0.3;  // 300ms minimum
```

**Adjust:**
- **More strict:** `0.5` (500ms)
- **More lenient:** `0.2` (200ms)

---

### RMS Energy Check (Lines 64-66)
```typescript
const MIN_RMS = 0.01;      // Minimum RMS amplitude
const MIN_RMS_DB = -40;    // Minimum RMS in dB
const MIN_PEAK = 0.05;     // Minimum peak amplitude
```

**Adjust for quieter audio:**
```typescript
const MIN_RMS = 0.005;
const MIN_RMS_DB = -45;
const MIN_PEAK = 0.03;
```

**Adjust for stricter filtering:**
```typescript
const MIN_RMS = 0.02;
const MIN_RMS_DB = -35;
const MIN_PEAK = 0.08;
```

---

### File Size Check (Lines 19-20)
```typescript
const MIN_AUDIO_SIZE = 1000;           // 1KB minimum
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB maximum
```

**Adjust:**
- **More strict:** `MIN_AUDIO_SIZE = 2000` (2KB)
- **More lenient:** `MIN_AUDIO_SIZE = 500` (0.5KB)

---

## 📝 Transcription Validation

**File:** `lib/audioValidation.ts`

### Length Check (Line 30)
```typescript
const MIN_LENGTH = 3; // At least 3 characters
```

**Adjust:**
- **More strict:** `MIN_LENGTH = 5`
- **More lenient:** `MIN_LENGTH = 2`

---

### Word Count Check (Line 77)
```typescript
const MIN_WORD_COUNT = 1; // At least 1 word
```

**Adjust:**
- **Require full sentence:** `MIN_WORD_COUNT = 3`
- **Single word ok:** `MIN_WORD_COUNT = 1`

---

### Hallucination Detection (Lines 96-107)

**Common hallucinations to filter:**
```typescript
const hallucinations = [
  'thank you',
  'thanks for watching',
  'please subscribe',
  'thank you for watching',
  'you',
  'the',
  'okay',
  'bye',
  'thank',
];
```

**To add more patterns:**
```typescript
// Add your own
'see you next time',
'goodbye',
'hello',
```

---

## 🎮 Game Validation Settings

**File:** `lib/rulesReference.ts`

### Update Rules
Edit the `RULES_CHEAT_SHEET` constant to add/modify rules:

```typescript
export const RULES_CHEAT_SHEET = `
=== WARHAMMER 40K 10TH EDITION CORE RULES ===

COMMAND POINTS (CP):
- Players start with X CP...
- Standard: +1 CP per turn
- Maximum: +2 CP per turn (with secondary discard)
...
`;
```

**Add custom rules:**
```typescript
CUSTOM HOUSE RULES:
- Players gain +2 CP on round 1 only
- Stratagems cost -1 CP in deployment phase
...
```

---

## 🎨 UI Settings

### ValidationToast Auto-Dismiss Duration

**File:** `components/ValidationToast.tsx` (line 26)

```typescript
duration = 10000 // 10 seconds for info messages
```

**Adjust:**
- **Quicker:** `5000` (5 seconds)
- **Longer:** `15000` (15 seconds)

---

### Toast Stacking Position

**File:** `app/page.tsx` (line 863)

```typescript
<div className="fixed bottom-20 right-4 z-50 flex flex-col-reverse gap-3">
```

**Adjust position:**
- **Top-right:** `top-20 right-4`
- **Bottom-left:** `bottom-20 left-4`
- **Center-bottom:** `bottom-20 left-1/2 -translate-x-1/2`

**Adjust spacing:**
- **Tighter:** `gap-2`
- **Looser:** `gap-4`

---

## 📊 Preset Configurations

### Preset 1: Quiet Environment
```typescript
// lib/audioCapture.ts
SILENCE_THRESHOLD = -50
SILENCE_DURATION = 2000
SPEECH_CONFIRMATION_TIME = 300
MIN_RECORDING_TIME = 500
```

### Preset 2: Normal Home Office
```typescript
// lib/audioCapture.ts
SILENCE_THRESHOLD = -30
SILENCE_DURATION = 2000
SPEECH_CONFIRMATION_TIME = 500
MIN_RECORDING_TIME = 1000
```

### Preset 3: Noisy Environment (Current)
```typescript
// lib/audioCapture.ts
SILENCE_THRESHOLD = -15
SILENCE_DURATION = 2000
SPEECH_CONFIRMATION_TIME = 600
MIN_RECORDING_TIME = 1000
```

### Preset 4: Very Noisy / Open Office
```typescript
// lib/audioCapture.ts
SILENCE_THRESHOLD = -10
SILENCE_DURATION = 2500
SPEECH_CONFIRMATION_TIME = 800
MIN_RECORDING_TIME = 1500
```

### Preset 5: Manual Control (Disable Auto-Chunking)
```typescript
// lib/audioCapture.ts
SILENCE_THRESHOLD = -100  // Never triggers
SILENCE_DURATION = 999999 // Never triggers
SPEECH_CONFIRMATION_TIME = 0
MIN_RECORDING_TIME = 0

// User must manually click STOP
```

---

## 🧪 Testing Your Configuration

After changing any settings:

1. **Refresh page** (Ctrl+R)
2. **Open console** (F12)
3. **Click START**
4. **Test scenarios:**
   - Silence (10 seconds) → Should stay IDLE
   - Quick cough → Should ignore
   - Speak sentence → Should record
   - Stop speaking → Should auto-stop after silence duration

5. **Check console logs:**
   - Audio levels during silence
   - Speech confirmation messages
   - Recording start/stop
   - Validation results

---

## 🎯 Recommended Settings (Based on Your Environment)

**Based on your logs showing -18dB to -21dB background:**

```typescript
// lib/audioCapture.ts
private readonly SILENCE_THRESHOLD = -15;  // ✅ Current setting
private readonly SILENCE_DURATION = 2000;  // ✅ Current setting
private readonly SPEECH_CONFIRMATION_TIME = 600;  // ✅ Current setting
private readonly MIN_RECORDING_TIME = 1000;  // ✅ Current setting
```

**These settings should:**
- ✅ Ignore background noise (-18dB to -21dB)
- ✅ Filter coughs/clicks (< 600ms)
- ✅ Capture actual speech (> 600ms sustained)
- ✅ Auto-chunk after 2 seconds of silence

---

## 📚 Related Documentation

- **Full guide:** `docs/AUDIO_VALIDATION_SYSTEM.md`
- **Troubleshooting:** `docs/VAD_TROUBLESHOOTING.md`
- **Environment tuning:** `docs/NOISY_ENVIRONMENT_SOLUTIONS.md`
- **Master overview:** `docs/AUDIO_VALIDATION_FEATURE_COMPLETE.md`

---

**Last updated:** After speech confirmation time adjustment  
**Current preset:** Noisy Environment (Preset 3)  
**Status:** ✅ Optimized for your environment

