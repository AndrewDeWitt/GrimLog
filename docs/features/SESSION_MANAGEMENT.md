# Grimlog Session Management System

## 🎯 Overview

Complete game session tracking with conversation history, timeline events, and replay capabilities.

## 📊 What's Been Built

### Database Models

**TranscriptHistory** - Conversation tracking
- Every Whisper transcription saved
- Sequenced for chronological order
- Linked to game session

**GameSession** (Enhanced)
- isActive flag for session state
- Optional army/opponent info
- Tracks current phase and round
- Links to transcripts and events

**TimelineEvent** (Enhanced)
- Saved to database (not just localStorage)
- Linked to game session
- Indexed for fast retrieval

### API Endpoints

```
Sessions:
POST   /api/sessions              Create new session
GET    /api/sessions              List all sessions (last 20)
GET    /api/sessions/[id]         Get session with full details
PATCH  /api/sessions/[id]         Update session (phase, round, end)
DELETE /api/sessions/[id]         Delete session
POST   /api/sessions/[id]/events  Save timeline event

Analysis:
POST   /api/analyze               Analyze audio with conversation history
  - Requires sessionId
  - Saves transcript to DB
  - Fetches last 5 transcripts
  - Sends context to GPT-5-nano
```

### UI Pages

**1. Main Game Page (`/`)**
- Auto-creates session on "START"
- Shows session ID in header
- 5 buttons: START/STOP, ROUND, LOG, CLEAR, END
- Saves all events to database
- Resumes session on refresh

**2. Session Manager (`/sessions`)**
- View all active and past games
- Continue active sessions
- View replays of past games
- Delete sessions
- Start new game

**3. Session Replay (`/sessions/[id]`)**
- View complete game timeline
- Toggle between events and transcripts
- Chronological play-by-play
- Duration and statistics

## 🔄 Data Flow

### When User Speaks:

```
1. VAD detects speech
   ↓
2. Captures audio blob
   ↓
3. POST /api/analyze with sessionId
   ↓
4. Whisper transcribes audio
   ↓
5. Save to TranscriptHistory table (sequence: N)
   ↓
6. Fetch last 5 transcripts (N-5 to N-1)
   ↓
7. Build context:
   Recent: ["I'm done", "with command", "phase now", "let's", "go"]
   Current: "moving to shooting phase"
   ↓
8. Send to GPT-5-nano
   ↓
9. GPT returns: { type: "phase", phase: "Shooting", confidence: 0.95 }
   ↓
10. Save TimelineEvent to database
    ↓
11. Update UI (localStorage + state)
```

### When User Clicks "▶ START":

```
1. Check if currentSessionId exists
   ↓
2. If not, POST /api/sessions
   ↓
3. Get session.id
   ↓
4. Save to localStorage ('grimlog-current-session')
   ↓
5. Set currentSessionId state
   ↓
6. Initialize audio capture
   ↓
7. Ready to listen!
```

### When User Clicks "◼ END":

```
1. Stop audio if active
   ↓
2. PATCH /api/sessions/[id]
   - Set endTime
   - Set isActive = false
   ↓
3. Clear currentSessionId
   ↓
4. Remove from localStorage
   ↓
5. Reset UI to defaults
   ↓
6. Session now appears in "Past Games"
```

## 📱 User Workflows

### Start New Game

1. Go to `/` or `/sessions`
2. Click "+ NEW GAME" or "▶ START"
3. Session auto-created
4. Audio activates
5. Start speaking!

### Continue Existing Game

1. Refresh page → Auto-resumes last session
   OR
2. Go to `/sessions` → Click "CONTINUE" on active session

### View Past Game

1. Go to `/sessions`
2. Find game in "PAST GAMES" section
3. Click "VIEW REPLAY"
4. Toggle between Events and Transcripts
5. See complete chronological record

### End Game

1. Click "◼ END" button
2. Confirm dialog
3. Session marked as complete
4. Can view in Past Games later

## 💾 Data Persistence

### LocalStorage (Fast, Session-Scoped)
```
grimlog-current-session: "session-uuid"
wh40k-timeline: { events, currentPhase, battleRound }
```

### Database (Permanent, Cross-Device)
```sql
GameSession
  ├── TranscriptHistory (all conversations)
  └── TimelineEvent (all game events)
```

**Strategy:** 
- localStorage for instant UI updates
- Database for permanent storage and replay
- Both stay in sync

## 🔍 Debugging

### Check Active Session:
```javascript
// In browser console:
localStorage.getItem('grimlog-current-session')
```

### View All Data:
```bash
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Check Transcripts:
```sql
SELECT * FROM TranscriptHistory 
WHERE gameSessionId = 'your-session-id'
ORDER BY sequenceOrder ASC;
```

## 🎮 Testing Checklist

- [ ] Start new game creates session
- [ ] Transcripts save to database
- [ ] Last 5 transcripts sent to GPT
- [ ] Events save to database
- [ ] Session shows in `/sessions`
- [ ] Can continue session after refresh
- [ ] End game marks session inactive
- [ ] Past games viewable in replay
- [ ] Transcripts appear in replay
- [ ] Events appear in replay

## 🚀 Benefits

**For Players:**
- Never lose game data
- Review past games
- Analyze tactical decisions
- Share battle reports

**For Development:**
- Full conversation history for AI training
- Analytics on common phrases
- A/B testing different prompts
- Performance monitoring

**For Future:**
- AI-generated battle reports
- Tactical analysis ("You used X stratagem Y times")
- Win/loss tracking
- Tournament history

---

**Last Updated:** October 3, 2025
**Status:** Fully Implemented ✅

