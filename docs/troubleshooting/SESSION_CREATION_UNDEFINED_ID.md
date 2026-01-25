# Session Creation Undefined ID Bug

**Last Updated:** 2025-10-24  
**Status:** Fixed  
**Affected Versions:** ≤ 3.4.0  
**Fixed In:** 3.4.1

## Overview

When creating a new session from `/sessions/new`, the session ID was not being properly stored in localStorage due to incorrect response structure parsing. This caused all subsequent API calls to use `undefined` as the session ID, breaking the application flow.

## Table of Contents

- [Problem Description](#problem-description)
- [Symptoms](#symptoms)
- [Root Cause](#root-cause)
- [Solution](#solution)
- [How to Verify the Fix](#how-to-verify-the-fix)
- [Related Documentation](#related-documentation)

## Problem Description

After creating a new session by selecting armies and clicking "START BATTLE", users would be redirected to the main page but the session would not be properly loaded. The localStorage key `grimlog-current-session` would either be missing or contain `undefined`, causing the application to fail to load session data, units, and game state.

However, navigating back to `/sessions`, finding the newly created session, and clicking "CONTINUE" would work correctly. This indicated the session was created successfully in the database, but the initial redirect flow had an issue.

## Symptoms

**Primary Symptom:**
- Creating a new session redirects to `/` but shows "No active session" or "Previous session expired"
- Units are not loaded
- Game state is not initialized
- Timeline is empty

**Secondary Symptoms:**
- Browser DevTools → Network tab shows API calls to `/api/sessions/undefined`
- Browser DevTools → Application → Local Storage shows `grimlog-current-session` is missing or `undefined`
- Going back to `/sessions` and clicking "CONTINUE" on the same session works perfectly

**Console Errors:**
```
Error: Failed to fetch session: 404
Session not found
```

## Root Cause

The POST `/api/sessions` endpoint returns a response with the following structure:

```json
{
  "session": {
    "id": "6f9beb58-257f-4ce6-b20f-4abdb70b7a19",
    "playerArmyId": "...",
    "userId": "...",
    "currentPhase": "Command",
    "battleRound": 1,
    ...
  },
  "unitsInitialized": {
    "player": 14,
    "opponent": 15
  }
}
```

However, the client code in `app/sessions/new/page.tsx` was expecting the session object at the root level:

```typescript
// INCORRECT (before fix):
const session = await response.json();
localStorage.setItem('grimlog-current-session', session.id);
// Result: session.id is undefined because there's no 'id' at root
```

The actual session data is nested under the `session` key, so accessing `session.id` was returning `undefined`.

## Solution

**Fixed in Version:** 3.4.1

The response parsing was corrected to properly extract the nested session object:

```typescript
// CORRECT (after fix):
const data = await response.json();
localStorage.setItem('grimlog-current-session', data.session.id);
// Result: data.session.id correctly extracts the ID
```

**File Changed:** `app/sessions/new/page.tsx` (line 92)

**Commit:** [Reference to commit hash when available]

## How to Verify the Fix

### Before Fix:
1. Navigate to `/sessions/new`
2. Select two armies
3. Click "START BATTLE"
4. Open DevTools → Application → Local Storage
5. Check `grimlog-current-session` → Value is `undefined` or missing
6. Main page shows "No active session"

### After Fix:
1. Navigate to `/sessions/new`
2. Select two armies
3. Click "START BATTLE"
4. Open DevTools → Application → Local Storage
5. Check `grimlog-current-session` → Value is a valid UUID (e.g., `6f9beb58-257f-4ce6-b20f-4abdb70b7a19`)
6. Main page loads with:
   - Session restored successfully toast
   - Units visible in Unit Health view
   - Game state initialized (Command Phase, Round 1)
   - Timeline shows "Battle initialized" event

### Testing Checklist:
- [ ] New session creation stores valid session ID in localStorage
- [ ] Redirect to main page properly loads the session
- [ ] Units are visible in Unit Health view
- [ ] Game state displays correctly (phase, round, CP, VP)
- [ ] Timeline shows initial battle event
- [ ] No 404 errors in Network tab
- [ ] No console errors related to undefined session ID

## Related Documentation

- **[Session Setup Guide](../guides/SESSION_SETUP_GUIDE.md)** - How to create and manage sessions
- **[Session Management Feature](../features/SESSION_MANAGEMENT.md)** - Session lifecycle and architecture
- **[Sessions API](../api/SESSIONS_ENDPOINT.md)** - API endpoint documentation (if exists)
- **[CHANGELOG](../../CHANGELOG.md)** - Version history and bug fixes

## Prevention

This issue was caused by:
1. Inconsistent API response structure (nested vs flat)
2. Lack of TypeScript type checking on API responses
3. Missing integration tests for the session creation flow

**Future Prevention:**
- Add TypeScript interfaces for all API response structures
- Implement response validation/parsing layer
- Add integration tests for critical user flows
- Document API response structures clearly

