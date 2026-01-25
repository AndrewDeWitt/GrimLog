# 🎤 Voice Activity Detection (VAD) Troubleshooting

## 🐛 Issue: Audio Only Analyzes After Manual Stop

If you're experiencing the issue where audio chunks are **not automatically sent** after pauses, but only when you manually stop listening, this guide will help diagnose the problem.

---

## 🔍 How VAD Should Work

**Normal Flow:**
1. Click **START** → Audio capture begins
2. Speak → VAD detects speech → Recording starts automatically
3. Pause/stop speaking → VAD detects silence
4. After **2 seconds of silence** → Recording stops automatically
5. Audio chunk sent to API for analysis
6. System immediately ready for next speech
7. Repeat steps 2-6 automatically

**Problem Flow:**
1. Click **START** → Audio capture begins
2. Speak → Recording starts
3. Pause → Recording continues indefinitely
4. Click **STOP** → Recording finally stops and analyzes

---

## 🧪 Debugging Steps

### Step 1: Check Browser Console Logs

Open DevTools (F12) → Console tab, then click **START** and speak.

**What you should see:**

#### When Audio Capture Starts:
```
📊 Audio level: -56.3dB (threshold: -50dB) - IDLE
```
This logs every 5 seconds to show current audio levels.

#### When You Start Speaking:
```
🎤 Speech detected (-32.4dB) - Starting recording
```

#### When You Stop Speaking:
```
🔇 Silence detected (-54.1dB) - Waiting 2000ms
```

#### After 2 Seconds of Silence:
```
⏹️ Silence exceeded 2000ms - Stopping recording (3450ms total)
📦 Audio chunk captured: 12.45KB
🔍 Validating audio blob...
✅ Audio validation passed, sending to API
```

---

### Step 2: Diagnose the Problem

Look at the console logs and identify which scenario matches:

#### Scenario A: No Speech Detection
**Logs show:**
```
📊 Audio level: -56.3dB (threshold: -50dB) - IDLE
📊 Audio level: -55.8dB (threshold: -50dB) - IDLE
```
You speak but never see "🎤 Speech detected"

**Problem:** Your microphone level is too quiet or the threshold is too strict

**Solution:** See "Fix 1: Lower Silence Threshold" below

---

#### Scenario B: Speech Detected, But Never Stops
**Logs show:**
```
🎤 Speech detected (-32.4dB) - Starting recording
📊 Audio level: -48.2dB (threshold: -50dB) - RECORDING
📊 Audio level: -49.1dB (threshold: -50dB) - RECORDING
```
You stop speaking but never see "🔇 Silence detected"

**Problem:** Background noise keeps audio level above threshold

**Solution:** See "Fix 2: Adjust for Noisy Environment" below

---

#### Scenario C: Silence Detected, But Timer Resets
**Logs show:**
```
🔇 Silence detected (-54.1dB) - Waiting 2000ms
// 1 second later, small noise
🎤 Speech detected (-51.2dB) - Starting recording
🔇 Silence detected (-53.5dB) - Waiting 2000ms
```
Timer keeps resetting due to intermittent noise

**Problem:** Small noises (breathing, keyboard, etc.) reset silence timer

**Solution:** See "Fix 3: Longer Silence Duration" below

---

#### Scenario D: Audio Validation Fails
**Logs show:**
```
⏹️ Silence exceeded 2000ms - Stopping recording (3450ms total)
📦 Audio chunk captured: 12.45KB
🔍 Validating audio blob...
❌ Audio validation failed: Audio appears to be silence or too quiet
```
Recording stops but validation rejects the audio

**Problem:** Audio validation is too strict

**Solution:** See "Fix 4: Adjust Validation Thresholds" below

---

## 🔧 Fixes

### Fix 1: Lower Silence Threshold (More Sensitive)

If speech isn't being detected, make VAD more sensitive:

**File:** `lib/audioCapture.ts` (line 15)

```typescript
// Current (default)
private readonly SILENCE_THRESHOLD = -50; // dB

// More sensitive (detects quieter speech)
private readonly SILENCE_THRESHOLD = -55; // dB

// Much more sensitive (may pick up more noise)
private readonly SILENCE_THRESHOLD = -60; // dB
```

**Trade-off:** Lower threshold = detects quieter speech, but also more background noise

---

### Fix 2: Adjust for Noisy Environment

If background noise prevents silence detection:

**Option A: Raise Silence Threshold (Less Sensitive)**

```typescript
// For noisy environments
private readonly SILENCE_THRESHOLD = -45; // dB

// For very noisy environments
private readonly SILENCE_THRESHOLD = -40; // dB
```

**Option B: Use Noise Cancellation**
- Enable noise cancellation in browser/OS settings
- Use a better microphone with noise isolation
- Move to a quieter room

---

### Fix 3: Longer Silence Duration

If small noises keep resetting the timer:

**File:** `lib/audioCapture.ts` (line 16)

```typescript
// Current (default)
private readonly SILENCE_DURATION = 2000; // 2 seconds

// Longer wait (less interruptions)
private readonly SILENCE_DURATION = 3000; // 3 seconds

// Shorter wait (faster response, but may cut off speech)
private readonly SILENCE_DURATION = 1500; // 1.5 seconds
```

**Trade-off:** Longer duration = fewer false stops, but slower response

---

### Fix 4: Adjust Validation Thresholds

If audio validation is rejecting valid speech:

**File:** `lib/audioValidation.ts` (lines 57-73)

```typescript
// Current (default)
const MIN_DURATION = 0.3;  // 300ms
const MIN_RMS = 0.01;
const MIN_RMS_DB = -40;
const MIN_PEAK = 0.05;

// More lenient (accept quieter audio)
const MIN_DURATION = 0.2;  // 200ms
const MIN_RMS = 0.005;
const MIN_RMS_DB = -45;
const MIN_PEAK = 0.03;
```

---

### Fix 5: Disable Client-Side Validation (Testing Only)

To test if validation is the problem, temporarily disable it:

**File:** `lib/audioCapture.ts` (line 65-73)

```typescript
// Comment out validation
// const validation = await validateAudioBlob(audioBlob);
// if (!validation.isValid) {
//   console.log('❌ Audio validation failed:', validation.reason);
//   this.recordingStartTime = null;
//   this.onStatusChange('listening');
//   return;
// }

// Just send everything
console.log('✅ Skipping validation (debug mode), sending to API');
this.onStatusChange('processing');
this.onAudioReady(audioBlob);
```

**⚠️ Warning:** This will send all audio to API, including silence. Only use for debugging!

---

## 📊 Optimal Settings for Different Environments

### Quiet Room (Office/Home)
```typescript
SILENCE_THRESHOLD = -50 // dB
SILENCE_DURATION = 2000 // ms
MIN_RMS_DB = -40        // dB
```

### Noisy Environment (Open Office/Café)
```typescript
SILENCE_THRESHOLD = -45 // dB (less sensitive)
SILENCE_DURATION = 2500 // ms (longer wait)
MIN_RMS_DB = -35        // dB (stricter validation)
```

### Very Quiet (Studio/Library)
```typescript
SILENCE_THRESHOLD = -55 // dB (more sensitive)
SILENCE_DURATION = 1500 // ms (faster response)
MIN_RMS_DB = -45        // dB (more lenient)
```

---

## 🧪 Test Procedure

1. **Apply one fix at a time**
2. **Refresh the page** (Ctrl+R)
3. **Open console** (F12)
4. **Click START**
5. **Watch for periodic logs**: `📊 Audio level: ...`
6. **Speak clearly**: "Using Transhuman Physiology"
7. **Stop speaking and wait 3 seconds**
8. **Check if you see**:
   - `🎤 Speech detected`
   - `🔇 Silence detected`
   - `⏹️ Silence exceeded 2000ms`
   - `📦 Audio chunk captured`

---

## 🎯 Expected Console Output (Normal Flow)

```
// System ready
📊 Audio level: -56.3dB (threshold: -50dB) - IDLE

// You start speaking
🎤 Speech detected (-32.4dB) - Starting recording

// You stop speaking
🔇 Silence detected (-54.1dB) - Waiting 2000ms

// 2 seconds of silence
⏹️ Silence exceeded 2000ms - Stopping recording (3450ms total)
📦 Audio chunk captured: 12.45KB
🔍 Validating audio blob...
Audio analysis: { duration: 3.45s, rms: 0.0234, rmsDb: -32.61dB, peakAmplitude: 0.1456 }
✅ Audio validation passed, sending to API

// System ready for next speech
📊 Audio level: -55.8dB (threshold: -50dB) - IDLE
```

---

## 💡 Quick Fixes (Try These First)

### Quick Fix 1: Speak Louder
- Increase microphone volume in Windows/Mac settings
- Speak closer to microphone
- Check browser mic permissions

### Quick Fix 2: Reduce Background Noise
- Close windows
- Turn off fans/AC temporarily
- Mute notifications
- Use push-to-talk (manual stop) if environment is too noisy

### Quick Fix 3: Use Recommended Settings
```typescript
// In lib/audioCapture.ts
SILENCE_THRESHOLD = -50  // Start here
SILENCE_DURATION = 2000  // 2 seconds
MIN_RECORDING_TIME = 500 // 0.5 seconds
```

---

## 🆘 Still Not Working?

If none of these fixes work, please share:

1. **Console logs** (screenshot or copy/paste)
2. **Your environment** (quiet office? noisy café?)
3. **Microphone type** (built-in laptop? USB? headset?)
4. **Current settings** (threshold, duration values)

---

**Remember:** The VAD system is **always running** after you click START. It should automatically detect speech → record → stop after silence → analyze → repeat. If it's not doing this, the console logs will show you exactly where it's getting stuck!

