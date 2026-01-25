# Optimistic UI Controls & Cache Management

**Last Updated:** 2025-10-30  
**Status:** Complete

## Overview

Grimlog implements optimistic UI updates for all user interactions, providing instant visual feedback without waiting for backend API responses. This document covers the simplified manual controls for CP/VP, comprehensive cache invalidation system, and the optimistic update pattern applied across all game state modifications.

These improvements eliminate the "lag" users experienced when adjusting game state, where changes wouldn't reflect in the UI until the API responded. Now all interactions feel snappy and responsive on mobile and desktop.

## Table of Contents

- [Overview](#overview)
- [Simplified CP/VP Controls](#simplified-cp-vp-controls)
- [Optimistic Update Pattern](#optimistic-update-pattern)
- [Cache Invalidation System](#cache-invalidation-system)
- [Implementation Details](#implementation-details)
- [Mobile Considerations](#mobile-considerations)
- [Error Handling](#error-handling)
- [Related Documentation](#related-documentation)

## Simplified CP/VP Controls

### Click-to-Edit Interface

Users can now click directly on CP and VP numbers to edit them inline, replacing the previous complex button-based system.

**Before:**
- Toggle button (±) to expand controls
- Multiple buttons: -5 VP, -1 VP, +1 VP, +5 VP
- Quick-set buttons: 0, 5, 10, 15, 20, 25, 30
- Two-step interaction (expand, then click button)

**After:**
- Single-click on number to edit
- Inline text input appears
- Type new value
- Press Enter or click outside to save
- Press Escape to cancel

### Features

#### Mobile-Optimized Input
```typescript
<input
  type="text"
  inputMode="numeric"  // Triggers number pad on mobile
  pattern="[0-9]*"     // iOS optimization
  autoFocus            // Immediate typing
/>
```

#### Touch-Friendly Targets
- Minimum 44px tap targets (WCAG 2.5.5 compliant)
- Large clickable area on numbers
- Clear visual feedback on edit mode

#### Validation
- Only numeric input accepted
- Negative values clamped to 0
- No event triggered if value unchanged

### Usage Example

**Player CP:**
```
CP: 7  ← Click here
    ↓
[__7__] ← Edit inline, type new value
    ↓
CP: 3  ← Saved!
```

## Optimistic Update Pattern

All user interactions now follow an optimistic update pattern for instant UI feedback.

### Pattern Overview

```typescript
1. User triggers action (click, tap, edit)
2. Update UI immediately (optimistic)
3. Make API call in background
4. On success: Refresh data
5. On error: Rollback UI + show error
```

### Implemented Interactions

| Interaction | Component | Optimistic? | Debounced? |
|-------------|-----------|-------------|------------|
| CP Adjustment | `GameStateDisplay.tsx` | ✅ | ✅ 100ms |
| VP Adjustment | `GameStateDisplay.tsx` | ✅ | ✅ 100ms |
| Phase Change | `PhaseControl.tsx` | ✅ | ❌ |
| Round Advancement | `app/page.tsx` | ✅ | ❌ |
| Objective Control | `GameStateDisplay.tsx` | ✅ | ❌ |
| Secondary Scoring | `app/page.tsx` | ✅ | ❌ |

### Code Pattern

#### CP/VP Adjustments (Debounced)

```typescript
const handleAdjustCP = useCallback(async (player, amount, absolute) => {
  const currentCP = player === 'player' ? playerCP : opponentCP;
  const newCP = absolute ? Math.max(0, amount) : Math.max(0, currentCP + amount);
  const previousCP = currentCP;
  
  // 1. Optimistic update - instant UI feedback
  if (player === 'player') {
    setPlayerCP(newCP);
  } else {
    setOpponentCP(newCP);
  }
  
  // 2. Store for rollback
  pendingCPUpdateRef.current = { player, value: newCP, previousValue: previousCP };
  
  // 3. Clear existing timeout
  if (cpUpdateTimeoutRef.current) {
    clearTimeout(cpUpdateTimeoutRef.current);
  }
  
  // 4. Debounced API call (100ms)
  cpUpdateTimeoutRef.current = setTimeout(async () => {
    try {
      // Update database
      await fetch(`/api/sessions/${sessionId}`, { /* ... */ });
      
      // Create timeline event
      await fetch(`/api/sessions/${sessionId}/events`, { /* ... */ });
      
      // Invalidate caches
      invalidateCachePattern(`/api/sessions/${sessionId}`);
      
      // Refresh timeline
      await refreshTimeline();
      
      showToast('Success', 'success');
    } catch (error) {
      // 5. Rollback on error
      if (player === 'player') {
        setPlayerCP(previousCP);
      } else {
        setOpponentCP(previousCP);
      }
      showToast('Failed - reverted', 'error');
    }
  }, 100);
}, [currentSessionId, playerCP, opponentCP, refreshTimeline]);
```

#### Phase Changes (Immediate + Callback)

```typescript
// In PhaseControl.tsx
const changePhase = async (newPhase, playerTurn) => {
  const previousPhase = currentPhase;
  const previousTurn = currentPlayerTurn;
  
  // 1. Optimistic update - instant UI
  onPhaseChange(newPhase, playerTurn);
  
  try {
    // 2. API call
    const response = await fetch(`/api/sessions/${sessionId}/manual-action`, {
      method: 'POST',
      body: JSON.stringify({
        toolName: 'change_phase',
        args: { new_phase: newPhase, player_turn: playerTurn }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 3. After API succeeds, refresh timeline
      if (onPhaseChangeComplete) {
        await onPhaseChangeComplete();
      }
      onShowToast(result.message, 'success');
    } else {
      // 4. Rollback on failure
      onPhaseChange(previousPhase, previousTurn);
      onShowToast(result.message, 'error');
    }
  } catch (error) {
    // 5. Rollback on error
    onPhaseChange(previousPhase, previousTurn);
    onShowToast('Failed - reverted', 'error');
  }
};
```

## Cache Invalidation System

### Problem

The app uses a caching system (`lib/requestCache.ts`) to reduce redundant API calls. However, after mutations (CP changes, phase transitions, etc.), cached data becomes stale, causing the UI to show outdated information.

### Solution: Pattern-Based Invalidation

Instead of invalidating individual cache entries, we now use **pattern-based invalidation** to clear all related caches at once.

#### Before (Single Cache Invalidation)

```typescript
invalidateCache(`/api/sessions/${sessionId}`);
// Only clears session cache
// Timeline, units, validations still cached!
```

#### After (Pattern-Based Invalidation)

```typescript
invalidateCachePattern(`/api/sessions/${sessionId}`);
// Clears ALL matching caches:
// - /api/sessions/${sessionId}
// - /api/sessions/${sessionId}/events
// - /api/sessions/${sessionId}/units
// - /api/sessions/${sessionId}/validations
```

### Implementation

The pattern matcher uses regex to find all cache keys matching the pattern:

```typescript
// lib/requestCache.ts
export function invalidateCachePattern(pattern: string | RegExp): void {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  let count = 0;
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      count++;
    }
  }
  
  console.log(`[Cache] Invalidated ${count} entries matching pattern: ${pattern}`);
}
```

### Cache Invalidation Points

Every mutation now invalidates caches:

| Mutation | API Call | Invalidates |
|----------|----------|-------------|
| Adjust CP/VP | `PATCH /api/sessions/[id]` + `POST /api/sessions/[id]/events` | All session caches |
| Change Phase | `POST /api/sessions/[id]/manual-action` | All session caches |
| Advance Round | `PATCH /api/sessions/[id]` + `POST /api/sessions/[id]/events` | All session caches |
| Score Secondary | `POST /api/sessions/[id]/score-secondary` | All session caches |
| Update Objective | `POST /api/sessions/[id]/manual-action` | All session caches |

### Timeline Refresh Timing

**Critical Fix:** Timeline refresh must happen **after** the API creates the event, not immediately during the optimistic update.

#### The Problem

```typescript
// WRONG: Refreshes before event is created
onPhaseChange(newPhase, playerTurn);  // Optimistic
handlePhaseChange() {
  await refreshTimeline();  // ❌ TOO EARLY - event not in DB yet!
}
```

Result: Timeline always shows "one event behind"

#### The Solution

```typescript
// CORRECT: Split into two callbacks
const handlePhaseChange = (phase, playerTurn) => {
  // Optimistic UI update only
  setCurrentPhase(phase);
  setCurrentPlayerTurn(playerTurn);
};

const handlePhaseChangeComplete = async () => {
  // Called AFTER API succeeds
  invalidateCachePattern(`/api/sessions/${sessionId}`);
  await refreshTimeline();  // ✅ Now event exists in DB!
};
```

### Refresh Strategy

After mutations, we use two strategies:

1. **Skip Cache** - Force fresh data
   ```typescript
   const events = await fetchSessionEvents(sessionId, { skipCache: true });
   ```

2. **Pattern Invalidation + Refresh**
   ```typescript
   invalidateCachePattern(`/api/sessions/${sessionId}`);
   await refreshTimeline();
   ```

## Implementation Details

### File Changes

#### 1. `app/page.tsx`

**Added:**
- `handleAdjustCP` - Optimistic CP updates with 100ms debounce
- `handleAdjustVP` - Optimistic VP updates with 100ms debounce
- `handlePhaseChange` - Optimistic phase change (UI only)
- `handlePhaseChangeComplete` - Cache invalidation after API success
- `refreshTimeline` - Force-refresh timeline events (skip cache)
- Debounce refs for CP/VP (`cpUpdateTimeoutRef`, `vpUpdateTimeoutRef`)
- Pending update refs for rollback (`pendingCPUpdateRef`, `pendingVPUpdateRef`)

**Modified:**
- `handleScoreSecondary` - Now calls `refreshGameState` optimistically
- `advanceRound` - Added pattern invalidation and timeline refresh
- `refreshGameState` - Now skips cache for timeline fetch

#### 2. `components/GameStateDisplay.tsx`

**Added:**
- Click-to-edit interface for CP/VP numbers
- `editingField` state - tracks which field is being edited
- `editValue` state - stores temporary edit value
- `startEdit` function - initiates inline editing
- `saveEdit` function - validates and saves changes (no event if unchanged)
- `handleKeyDown` function - Enter to save, Escape to cancel
- `onPhaseChangeComplete` prop - passed through to PhaseControl

**Removed:**
- Complex button arrays for CP/VP
- Quick-set number buttons (0-5 for CP, 0-30 for VP)
- ±1, ±5 increment/decrement buttons
- Toggle expand/collapse controls

**Modified:**
- CP/VP display now clickable spans with `cursor-pointer`
- Conditional rendering: show input or span based on `editingField`
- Objective control - optimistic refresh before API call
- Added `onPhaseChangeComplete` to props interface

#### 3. `components/PhaseControl.tsx`

**Added:**
- `onPhaseChangeComplete` callback prop
- Calls callback after API succeeds
- Stores previous phase/turn for rollback

**Modified:**
- `changePhase` - Optimistic update before API, rollback on error
- Calls `onPhaseChangeComplete()` after success

#### 4. `lib/requestCache.ts`

**No changes needed** - Already had:
- `invalidateCache` - Single entry invalidation
- `invalidateCachePattern` - Pattern-based invalidation (now used everywhere)
- `clearCache` - Clear all caches
- `debounce` - Generic debounce utility

## Mobile Considerations

### Touch Targets

All interactive elements meet WCAG 2.5.5 (Target Size):
- CP/VP numbers: 44px × 44px minimum
- Input fields: 44px minimum height
- Phase buttons: 44px minimum height
- Objective markers: Large click areas

### Input Mode

The `inputMode="numeric"` attribute triggers the **number pad** on mobile devices:

```typescript
<input
  type="text"
  inputMode="numeric"  // iOS/Android number pad
  pattern="[0-9]*"     // iOS optimization
/>
```

This provides a better mobile UX than `type="number"` (which includes +/- spinners).

### Auto-Focus

Inputs auto-focus when opened, allowing immediate typing without additional taps:

```typescript
<input autoFocus />
```

### Blur to Save

On mobile, tapping outside the input automatically saves changes (blur event), reducing the need for an explicit "Save" button.

## Error Handling

### Rollback Strategy

All optimistic updates can be rolled back if the API fails:

#### CP/VP Rollback

```typescript
try {
  // API call
} catch (error) {
  // Rollback optimistic update
  if (player === 'player') {
    setPlayerCP(previousCP);
  } else {
    setOpponentCP(previousCP);
  }
  showToast('Failed - reverted', 'error');
}
```

#### Phase Change Rollback

```typescript
catch (error) {
  // Rollback to previous phase and turn
  onPhaseChange(previousPhase, previousTurn);
  showToast('Failed - reverted', 'error');
}
```

### Validation

#### Client-Side
- CP/VP: Non-negative integers only
- Phase: Must be valid GamePhase enum
- No change: No API call if value unchanged

#### Server-Side
- All validation happens in `lib/validationHelpers.ts`
- Validation errors returned in response
- Client shows warning toast but doesn't rollback

### Error States

| Error Type | Behavior | User Feedback |
|------------|----------|---------------|
| Network Error | Rollback optimistic update | "Failed - reverted" error toast |
| Validation Warning | Keep optimistic update | Warning toast with details |
| Invalid Input | Cancel edit, no API call | Silent (invalid input not saved) |

## Related Documentation

- [Main README](../README.md) - Installation and setup
- [Game State Dashboard Guide](GAME_STATE_DASHBOARD_GUIDE.md) - Dashboard features
- [Manual UI Controls](MANUAL_UI_CONTROLS.md) - Previous implementation (now simplified)
- [Session System](SESSION_SYSTEM.md) - Session management
- [Cache System](../../lib/requestCache.ts) - Request caching implementation

---

**User experience enhanced. Response time optimized. The Machine God approves.** ⚙️

