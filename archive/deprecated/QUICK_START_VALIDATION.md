# ⚡ Quick Start - Audio & Validation System

## 🚀 Get Started in 3 Steps

### Step 1: Migrate Database (Required)
```bash
npx prisma db push
```

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Test It
1. Open http://localhost:3000
2. Click **START**
3. Say: "Using Transhuman Physiology"
4. Wait 2 seconds → Should auto-stop and analyze

---

## 📊 What You'll See

### Console Logs (Success)
```
✅ VAD loop started
📊 Audio level: -18.5dB (threshold: -15dB) - IDLE
👂 Potential speech detected - Confirming...
🎤 Speech confirmed - Starting recording
🔇 Silence detected - Waiting 2000ms
⏹️ Silence exceeded - Stopping recording
📦 Audio chunk captured: 8.45KB
✅ Audio validation passed, sending to API
```

### Console Logs (Noise Filtered)
```
👂 Potential speech detected - Confirming...
❌ Speech not confirmed (after 120ms) - Ignoring
```

---

## ⚙️ Current Settings (Your Environment)

```typescript
SILENCE_THRESHOLD = -15 dB          // Noisy environment
SPEECH_CONFIRMATION_TIME = 600 ms   // Filter coughs/clicks  
SILENCE_DURATION = 2000 ms          // Auto-stop after 2s
MIN_RECORDING_TIME = 1000 ms        // 1 second minimum
```

**Optimized for:** Background noise -18dB to -21dB

---

## 🧪 Quick Tests

### Test 1: Cough (Should Ignore)
Cough once → Should see `❌ Speech not confirmed`

### Test 2: Speech (Should Record)
Say sentence → Should see `🎤 Speech confirmed` → Auto-stops after pause

### Test 3: Validation Warning
1. Set player CP to 0
2. Say: "Using Transhuman Physiology"
3. Should see red **ERROR** toast

---

## 🔧 Quick Adjustments

### If VAD triggers on coughs:
```typescript
// lib/audioCapture.ts line 19
SPEECH_CONFIRMATION_TIME = 800 // Increase to 800ms
```

### If speech not detected:
```typescript
// lib/audioCapture.ts line 17
SILENCE_THRESHOLD = -20 // Lower to -20dB
```

### If never stops recording:
```typescript
// lib/audioCapture.ts line 17
SILENCE_THRESHOLD = -10 // Raise to -10dB
```

---

## 📚 Full Docs

See: `AUDIO_AND_VALIDATION_COMPLETE.md`

---

## ✅ Success Criteria

✅ Automatic chunking after pauses  
✅ Coughs/clicks ignored  
✅ Validation warnings shown  
✅ Timeline badges visible  
✅ Override buttons work  

---

**Ready? Run `npx prisma db push` and test it!** 🎮

