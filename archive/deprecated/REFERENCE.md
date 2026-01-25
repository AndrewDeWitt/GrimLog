# TacLog - Quick Reference

**Version:** 2.2.0 | **Status:** Production Ready ✅

---

## 🚀 Quick Start

```bash
# 1. Install & Setup
npm install
# Add OPENAI_API_KEY and DATABASE_URL to .env

# 2. Database
npx prisma db push
npx prisma generate

# 3. Run
npm run dev
# → http://localhost:3000
```

---

## 🎮 How to Use

### Start Game
1. Click **"▶ START"**
2. Grant microphone permission
3. Start speaking!

### During Game
- Speak naturally: "Moving to shooting phase"
- AI tracks phases and events automatically
- Click **"► ROUND"** between rounds
- Click **"▼ LOG"** to view timeline

### End Game
- Click **"◼ END"**
- Session saved to database
- View later in **"◈ SESSIONS"**

---

## 🗄 Database

### Connection Strings

**Development (SQLite):**
```env
DATABASE_URL="file:./dev.db"
```

**Production (Supabase):**
```env
DATABASE_URL="postgres://postgres.[REF]:[PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres"
```

⚠️ **Important:** Use port **5432** (session mode), not 6543

### Models
- `Player` - Player identity
- `Army` - Army lists with units/stratagems
- `GameSession` - Game tracking
- `TranscriptHistory` - All conversations
- `TimelineEvent` - Game events
- `Unit` & `Stratagem` - Army details

---

## 🔌 API Endpoints

### Sessions
```
POST   /api/sessions              # Create
GET    /api/sessions              # List all
GET    /api/sessions/[id]         # Get details
PATCH  /api/sessions/[id]         # Update
DELETE /api/sessions/[id]         # Delete
POST   /api/sessions/[id]/events  # Add event
```

### Analysis
```
POST   /api/analyze
Body: FormData {
  audio: File,
  sessionId: string,
  armyContext: string (optional)
}
```

### Armies
```
GET    /api/armies         # List
POST   /api/armies         # Create
GET    /api/armies/[id]    # Get
DELETE /api/armies/[id]    # Delete
```

---

## 🎯 AI Configuration

### Models
- **Whisper:** `whisper-1` (STT)
- **GPT:** `gpt-5-nano-2025-08-07` (Intent)

### GPT-5-nano Parameters
```typescript
{
  model: 'gpt-5-nano',
  max_completion_tokens: 800,
  response_format: { type: "json_object" }
}
```

### Retry Logic
- Max 3 attempts
- Exponential backoff (100ms, 200ms, 400ms)
- Graceful fallback on failure

---

## 📱 Pages

| URL | Purpose |
|-----|---------|
| `/` | Main game interface |
| `/sessions` | Session manager (list) |
| `/sessions/[id]` | Session replay |
| `/armies` | Army list |
| `/armies/new` | Create army |
| `/armies/[id]` | Army details |

---

## 🎨 Theme Classes

### Colors
```css
bg-taclog-black       /* #0a0a0a */
bg-taclog-gray        /* #2b2b2b */
bg-taclog-steel       /* #4a4a4a */
bg-taclog-orange      /* #ff6b00 */
bg-taclog-green       /* #00ff41 */
bg-taclog-red         /* #ff0000 */
```

### Effects
```css
glow-orange           /* Orange glow */
glow-green            /* Green glow */
pulse-animation       /* Pulsing dot */
warning-flash         /* Flashing warning */
scanline              /* CRT scanline effect */
hazard-stripes        /* Diagonal stripes */
```

---

## 🐛 Common Issues

### "Empty response from GPT-5-nano"
- Check: Conversation history being sent?
- Check: JSON response format correct?
- Check: Model name is `gpt-5-nano`

### "Can't reach database server"
- Check: Using port **5432** not 6543
- Check: Connection string has `.pooler.`
- Check: Password is correct

### "No session ID provided"
- Session didn't create properly
- Check: `/api/sessions` POST working?
- Check: localStorage has session ID

### Microphone not working
- Grant browser permissions
- Use HTTPS (required in production)
- Check: Another app using mic?

---

## 📊 Performance Tips

### Optimize AI Calls
- Conversation history reduces bad detections
- No filtering needed - context handles it
- Retry mechanism handles transient errors

### Database Performance
- Indexes on gameSessionId + sequenceOrder
- Limit queries to last 5 transcripts
- Cascade deletes for cleanup

### Frontend Performance
- localStorage for instant updates
- Database sync in background
- Collapsible timeline reduces DOM size

---

## 🔐 Environment Variables

```env
# Required
OPENAI_API_KEY=sk-proj-...

# Development
DATABASE_URL="file:./dev.db"

# Production
DATABASE_URL="postgres://postgres.[REF]:[PASS]@....pooler.supabase.com:5432/postgres"
```

---

## 📦 NPM Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio    # Open database GUI
npx prisma db push   # Push schema changes
npx prisma generate  # Generate Prisma client
```

---

## 🎯 Current Capabilities

✅ **Voice Recognition** - Continuous, context-aware  
✅ **Phase Tracking** - All 5 Warhammer 40K phases  
✅ **Event Detection** - Stratagems, deep strikes, objectives  
✅ **Session Management** - Full lifecycle  
✅ **Game Replay** - Complete conversation + events  
✅ **Mobile Optimized** - iPad/iPhone ready  
✅ **Database Backed** - PostgreSQL persistence  
✅ **Cost Effective** - ~$1.10 per 3-hour game  

---

**Last Updated:** October 3, 2025  
**Next Review:** After first production deployment

