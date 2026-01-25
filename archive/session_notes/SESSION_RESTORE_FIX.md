# Session Restore Fix - Complete Game State Preloading

## Problem
When users refreshed the page or came back after a crash, the session ID was restored but the actual game state (CP, VP, objectives, secondaries) and event history were not being loaded from the database. This made it appear as if the game state was lost.

## Root Cause
The initial page load (`useEffect` in `app/page.tsx`) was only:
1. Validating that the session existed in the database
2. Loading timeline events from **localStorage** (not database)
3. Not loading any game state variables at all

The `refreshGameState()` function existed and worked correctly, but was only called AFTER AI tool executions, not on initial page load.

## Solution
Modified the initial session load `useEffect` (lines 140-221 in `app/page.tsx`) to:

### 1. Load Full Game State
When a saved session is detected and validated, now loads:
- ✅ Current phase and battle round
- ✅ Player and opponent Command Points (CP)
- ✅ Player and opponent Victory Points (VP)
- ✅ Player and opponent secondary objectives
- ✅ Objective marker control status
- ✅ All timeline events from database

### 2. Database as Source of Truth
- Removed localStorage timeline loading
- Database is now the authoritative source
- Events are loaded from `/api/sessions/[id]/events`
- Full session state loaded from `/api/sessions/[id]`

### 3. User Feedback
- Shows success toast: "Session restored successfully"
- Logs number of events loaded to console
- Shows appropriate error messages if session is invalid

## What Happens Now

### On Page Refresh:
```
1. Check localStorage for session ID
2. Validate session exists in database
3. Load complete session data:
   - Phase, Round, CP, VP
   - Secondary objectives (both sides)
   - Objective control status
4. Load all timeline events from database
5. Restore UI to exact game state
6. Show "Session restored successfully" toast
```

### On New Session:
- Behavior unchanged
- Click START → creates new session
- Audio capture begins normally

## Testing
To verify the fix works:

1. **Start a game session**
   ```
   Click START
   Say: "I have 5 command points"
   Say: "I scored 10 victory points"
   Say: "My secondaries are Assassination and Deploy Scramblers"
   ```

2. **Refresh the page (F5 or Ctrl+R)**
   - Should see all CP, VP, and secondaries restored
   - Timeline should show all previous events
   - Phase and round should be correct

3. **Verify in console**
   ```
   Look for: "Loaded X timeline events from database"
   Look for: "Resumed session: [session-id]"
   ```

## Files Changed
- ✅ `app/page.tsx` - Enhanced session restoration logic (lines 140-221)

## Related Components
- `app/api/sessions/[id]/route.ts` - Provides full session data
- `app/api/sessions/[id]/events/route.ts` - Provides timeline events
- Database schema: `prisma/schema.prisma` - GameSession model

## Benefits
✅ **Crash Recovery** - Users can safely refresh without losing state  
✅ **Session Persistence** - Full game state persists across page loads  
✅ **Database-Driven** - Single source of truth for all game data  
✅ **Better UX** - Clear feedback when session is restored  
✅ **Reliable** - No more desynced state between UI and database

