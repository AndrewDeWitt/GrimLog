# Cache Invalidation Fix

## Problem Identified ✅

After creating a new session, navigating back to the sessions list showed the old cached data without the new session.

**Root Cause:** Cache was not being invalidated after mutations (create/update/delete operations).

## Solution Implemented

Added strategic cache invalidation at all mutation points to ensure data stays fresh.

## Where Cache is Now Invalidated

### 1. **Creating a New Session** ✅
**File:** `app/sessions/new/page.tsx` (Line 92)

```typescript
// After successfully creating session
invalidateCache('/api/sessions');
```

**Why:** The sessions list cache needs to be cleared so the new session appears in the list.

---

### 2. **Deleting a Session** ✅
**File:** `app/sessions/page.tsx` (Line 107)

```typescript
// After successfully deleting session
invalidateCache('/api/sessions');
```

**Why:** The sessions list cache needs to be cleared so the deleted session disappears from the list.

**Note:** This was already implemented in the original optimization!

---

### 3. **Ending a Session** ✅
**File:** `app/page.tsx` (Line 506)

```typescript
// After marking session as ended
invalidateCache('/api/sessions');
```

**Why:** The sessions list cache needs updating to reflect the session is no longer active.

---

### 4. **Adjusting Command Points (CP)** ✅
**File:** `app/page.tsx` (Line 666)

```typescript
// After updating CP in database
invalidateCache(`/api/sessions/${currentSessionId}`);
```

**Why:** Individual session cache needs clearing so fresh data is fetched if navigating away and back.

---

### 5. **Advancing Battle Round** ✅
**File:** `app/page.tsx` (Line 727)

```typescript
// After updating round in database
invalidateCache(`/api/sessions/${currentSessionId}`);
```

**Why:** Individual session cache needs clearing to reflect the round change.

---

### 6. **Updating Units** ✅
**File:** `lib/hooks/useUnits.ts` (Line 95)

```typescript
// After successful unit update
invalidateCache(`/api/sessions/${sessionId}/units`);
```

**Why:** Units cache needs clearing so next fetch gets updated unit data.

**Note:** This was already implemented in the useUnits hook!

---

## Cache Invalidation Strategy

### When to Invalidate

**Rule of Thumb:** Invalidate cache after ANY mutation (CREATE, UPDATE, DELETE) that affects the cached data.

### Two Types of Invalidation

1. **List Cache** - `/api/sessions`
   - Invalidate when: Creating, Deleting, or Ending sessions
   - Affects: Sessions list page
   
2. **Detail Cache** - `/api/sessions/{id}`
   - Invalidate when: Updating session properties (CP, round, phase, etc.)
   - Affects: Dashboard and detail views

## Testing the Fix

### Test Case 1: Create New Session
```
1. Go to /sessions
2. Note the sessions shown
3. Click "NEW BATTLE"
4. Create a new session
5. Navigate back to /sessions
✅ Expected: New session appears in the list immediately
```

### Test Case 2: End Session
```
1. On dashboard with active session
2. Click "End Game"
3. Confirm
4. Navigate to /sessions
✅ Expected: Session shows as ended/inactive immediately
```

### Test Case 3: Delete Session
```
1. On /sessions page
2. Delete a session
✅ Expected: Session disappears from list immediately
```

### Test Case 4: Update Session Data
```
1. On dashboard, adjust CP or advance round
2. Open browser DevTools → Application → Cache
3. Check that session cache was cleared
✅ Expected: Next navigation refetches fresh data
```

## Cache Flow Diagram

```
User Action → Mutation API Call → Success → Invalidate Cache
                                         ↓
                               Next Fetch = Fresh Data
```

### Example: Creating a Session

```
User clicks "Start Battle"
     ↓
POST /api/sessions (create new session)
     ↓
Success response
     ↓
invalidateCache('/api/sessions') ← Clears cached list
     ↓
Navigate to /sessions
     ↓
Fetch /api/sessions ← Cache MISS (we just cleared it)
     ↓
Fresh data with new session!
```

## What Changed vs Original Implementation

### Before This Fix
```typescript
// app/sessions/new/page.tsx
if (response.ok) {
  const data = await response.json();
  localStorage.setItem('taclog-current-session', data.session.id);
  showToast('Battle initialized successfully!', 'success');
  setTimeout(() => router.push('/'), 500);
}
// ❌ No cache invalidation - stale data on sessions page
```

### After This Fix
```typescript
// app/sessions/new/page.tsx
if (response.ok) {
  const data = await response.json();
  localStorage.setItem('taclog-current-session', data.session.id);
  
  // ✅ Invalidate cache so list shows new session
  invalidateCache('/api/sessions');
  
  showToast('Battle initialized successfully!', 'success');
  setTimeout(() => router.push('/'), 500);
}
```

## Performance Impact

**Cache invalidation is intentionally lightweight:**
- Only clears specific cache entries (not all caches)
- Next fetch will cache the fresh data
- No performance penalty - just ensures data freshness

**Time Complexity:** O(1) - Direct map deletion
**Memory Impact:** Negligible - just removes one cache entry

## Debugging Cache Issues

### Check if cache was invalidated:
```javascript
// Look for this in console:
[Cache] Invalidated: GET:/api/sessions
```

### Check cache status:
```javascript
import { getCacheStats } from '@/lib/requestCache';
getCacheStats();
// Shows all cached entries and their age
```

### Force cache refresh manually:
```javascript
import { invalidateCache } from '@/lib/requestCache';
invalidateCache('/api/sessions'); // Clear sessions list
invalidateCache('/api/sessions/abc123'); // Clear specific session
```

## Common Patterns

### Pattern 1: List Mutations
```typescript
// After create/delete operations that affect a list:
await fetch('/api/resource', { method: 'POST', ... });
invalidateCache('/api/resource'); // ← Clear list cache
```

### Pattern 2: Detail Mutations
```typescript
// After update operations on a specific item:
await fetch(`/api/resource/${id}`, { method: 'PATCH', ... });
invalidateCache(`/api/resource/${id}`); // ← Clear detail cache
```

### Pattern 3: Related Data
```typescript
// If updating affects multiple caches:
await fetch(`/api/sessions/${id}`, { method: 'PATCH', ... });
invalidateCache(`/api/sessions/${id}`); // Detail cache
invalidateCache('/api/sessions'); // List cache (if it affects list)
```

## Future Considerations

If you notice similar issues with other data:

1. **Armies not updating?** Add invalidation after army create/update/delete
2. **Units not refreshing?** Check if invalidation is called after mutations
3. **Timeline events stale?** Consider invalidating events cache after new events

**General Rule:** If you mutate data (POST/PATCH/DELETE), invalidate the relevant cache!

## Files Modified

1. `app/sessions/new/page.tsx` - Added invalidation after session creation
2. `app/page.tsx` - Added invalidation after CP updates, round advances, and session end
3. No breaking changes - only additions

## Status

✅ **Fixed** - Cache invalidation now works correctly for all session mutations
✅ **Tested** - New sessions appear immediately in sessions list
✅ **No performance impact** - Invalidation is lightweight and fast

---

**The issue is now resolved!** Your new sessions will appear immediately when you navigate back to the sessions page.

