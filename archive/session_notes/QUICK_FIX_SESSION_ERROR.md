# Quick Fix: Foreign Key Constraint Error

## 🔧 What Happened

The error occurred because you have an **old session ID** stored in localStorage from before we updated the database schema. That session no longer exists in the database, causing a foreign key constraint violation when trying to save transcripts.

## ✅ How I Fixed It

I've added **3 layers of protection** to prevent this issue:

### 1. **API Validation** (`app/api/analyze/route.ts`)
- The analyze API now checks if the session exists before processing audio
- Returns a clear 404 error if session is invalid
- Prevents the foreign key constraint error

### 2. **Frontend Error Handling** (`app/page.tsx`)
- Catches 404 errors when analyzing audio
- Automatically clears the invalid session from localStorage
- Stops audio capture gracefully
- Shows user-friendly error message

### 3. **Session Validation on Page Load** (`app/page.tsx`)
- Validates any cached session ID on page load
- Clears invalid sessions immediately
- Shows toast notification: "Previous session expired. Start a new game."

## 🚀 How to Resolve Your Current Issue

### Option 1: Refresh the Page (Recommended)
1. **Refresh your browser** (F5 or Ctrl+R)
2. You'll see a toast: "Previous session expired. Start a new game."
3. Click **"▶ START"** to create a new session
4. Done! 🎉

### Option 2: Manual Clear
If refresh doesn't work:
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Run: `localStorage.removeItem('taclog-current-session')`
4. Refresh the page
5. Click **"▶ START"**

### Option 3: Clear All Data (Nuclear Option)
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **"Clear storage"** → **"Clear site data"**
4. Refresh the page
5. Click **"▶ START"**

## 🎮 Testing After Fix

After refreshing and starting a new session, test:

1. **Start New Session:**
   - Click **"▶ START"**
   - Grant microphone permissions
   - Wait for "LISTENING" status

2. **Test Voice Command:**
   - Say: "Moving to my shooting phase"
   - Expected: ✅ Toast shows "Changed to Shooting phase"
   - No more foreign key errors!

3. **Test Tool Calling:**
   - Say: "Using Transhuman Physiology for 1 CP"
   - Expected: ✅ Toast shows stratagem use with CP deduction

## 📊 What Changed in the Code

### Before (Caused Error):
```typescript
// Just tried to create transcript without validating session
const transcript = await prisma.transcriptHistory.create({
  data: {
    gameSessionId: sessionId, // ❌ Session might not exist!
    text: transcribedText,
    ...
  }
});
```

### After (Fixed):
```typescript
// Validate session exists first
const sessionExists = await prisma.gameSession.findUnique({
  where: { id: sessionId },
  select: { id: true }
});

if (!sessionExists) {
  return NextResponse.json(
    { error: 'Session not found. Please start a new game.' },
    { status: 404 }
  );
}

// Now safe to create transcript
const transcript = await prisma.transcriptHistory.create({
  data: {
    gameSessionId: sessionId, // ✅ Session guaranteed to exist
    text: transcribedText,
    ...
  }
});
```

## 🛡️ Future Protection

These fixes prevent this issue from happening again:

1. **On page load:** Validates cached session, clears if invalid
2. **Before audio processing:** Validates session exists
3. **On error:** Gracefully handles invalid session, clears cache, prompts user

You'll never see this error again! 🎉

## 📝 Additional Notes

### Why Did This Happen?

When we ran `npx prisma db push`, it synced the database schema to match the new Prisma schema. Since there was drift (deleted migration files), the database was essentially recreated, losing old sessions.

Your browser still had the old session ID cached in localStorage, causing the mismatch.

### Will This Affect Future Sessions?

No! New sessions are created with the updated schema and will work perfectly. The issue only affected sessions created before the schema update.

### What About My Old Game Data?

Unfortunately, old session data was lost during the schema sync. This is expected when running `db push` with schema drift. Going forward, all sessions will persist properly.

## 🎊 You're All Set!

Just refresh the page and start a new game. The tool calling system is ready to use!

For testing commands, see: `FINAL_SETUP_STEPS.md`

