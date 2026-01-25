# Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Step 1: Add Your OpenAI API Key

Edit `.env.local` and replace the placeholder with your actual API key:

```env
OPENAI_API_KEY=sk-proj-your-actual-key-here
DATABASE_URL="file:./dev.db"
```

### Step 2: The dev server should already be running!

If not, run:
```bash
npm run dev
```

### Step 3: Open the App

Navigate to: **http://localhost:3000**

### Step 4: Test Voice Recognition

1. Click **"ACTIVATE VOX"** button
2. Allow microphone access when prompted
3. Say: **"Starting my command phase"**
4. Watch the phase display update!

### Step 5: Try Game Events

Say any of these:
- "Using Stratagem of the Protector"
- "Deep striking my dreadnought"
- "Moving to shooting phase"
- "Capturing objective marker 3"

All events will appear in the timeline on the right!

## 🎨 Optional: Create Your First Army

1. Click **"📖 ARMY CODEX"** button
2. Click **"+ NEW ARMY"**
3. Fill in:
   - Player Name: Your name
   - Faction: Adeptus Mechanicus (or choose your faction)
   - Army Name: e.g., "Mars Forgeworld"
   - Points: 2000
4. Click **"CREATE ARMY"**

## 🎮 Playing a Game

### Starting:
1. Click **"ACTIVATE VOX"**
2. Announce phases as you play
3. Mention stratagems and important events
4. The timeline tracks everything!

### Between Rounds:
- Click **"⏭ NEXT BATTLE ROUND"** to advance
- Phase automatically resets to Command

### After Game:
- Timeline persists even if you refresh
- Click **"🗑 CLEAR LOG"** to start a new game

## 💡 Voice Tips

**GOOD:**
- "Starting my movement phase"
- "I'm using Oath of Moment stratagem"
- "Deep strike with my terminators"

**LESS GOOD:**
- "Uhh... maybe... shooting?" (too uncertain)
- Mumbling or very quiet speech
- Multiple people talking at once

## 🔧 Troubleshooting

**Microphone not working?**
- Check browser permissions
- Must use HTTPS in production (Vercel provides this)
- Try refreshing the page

**Phase not detecting?**
- Speak the full phase name clearly
- Check the transcription box to see what it heard
- Make sure your API key is valid

**Timeline not saving?**
- Check browser console for errors
- Verify database exists: `prisma/dev.db`
- Try clearing browser cache

## 📚 What's Next?

- Add your army list for better stratagem detection
- Customize the AI prompt in `app/api/analyze/route.ts`
- Deploy to Vercel for remote access
- Add custom event types

---

**Praise the Omnissiah! ⚙️**

