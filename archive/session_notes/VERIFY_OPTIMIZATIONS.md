# Quick Verification Guide

## 🚀 Quick Start

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open Browser DevTools:**
   - Press F12
   - Go to "Network" tab
   - Filter by "Fetch/XHR"

3. **Run the tests below:**

## ✅ Test 1: Initial Load (Most Important)

**Steps:**
1. Clear your browser cache (Ctrl+Shift+Del)
2. Navigate to `http://localhost:3000`
3. Watch the Network tab

**Expected Result:**
```
✅ 1 request to /api/sessions/{id}
✅ 1 request to /api/sessions/{id}/events
❌ NO duplicate calls (even with React StrictMode)
```

**Look for in console:**
```
[Cache MISS] Fetching: GET:/api/sessions/{id}
Loaded X timeline events from cache/database
```

## ✅ Test 2: Tab Switching (The Big Win)

**Steps:**
1. From Dashboard, click "UNIT HEALTH" tab
2. Wait for units to load
3. Click "DASHBOARD" tab
4. Click "UNIT HEALTH" tab again
5. Watch the Network tab

**Expected Result:**
```
First switch to Unit Health:
✅ 1 request to /api/sessions/{id}/units

Switch back to Dashboard:
✅ 0 requests (cached!)

Switch to Unit Health again (if < 60s):
✅ 0 requests (cached!)
```

**Look for in console:**
```
[Cache HIT] GET:/api/sessions/{id}/units
```

## ✅ Test 3: Rapid Tab Switching

**Steps:**
1. Click Dashboard → Unit Health → Dashboard → Unit Health rapidly 10 times
2. Watch the Network tab

**Expected Result:**
```
✅ Only 1 request to /api/sessions/{id}/units (the first time)
✅ All subsequent switches served from cache
✅ NO loading spinners after first load
✅ UI remains smooth and responsive
```

## ✅ Test 4: Optimistic Updates

**Steps:**
1. Go to Unit Health tab
2. Click the "-1" button to damage a unit
3. Watch how fast the UI updates
4. Check Network tab

**Expected Result:**
```
✅ UI updates INSTANTLY (no delay)
✅ 1 PATCH request to /api/sessions/{id}/units/{unitId} (background)
✅ NO refetch of all units after update
```

## ✅ Test 5: Deduplication in Dev Mode

**Steps:**
1. Ensure you're in dev mode (npm run dev)
2. Refresh the page (F5)
3. Watch Network tab closely
4. React will double-mount components (this is normal)

**Expected Result:**
```
✅ Only 1 network request per endpoint
✅ Despite React StrictMode double-mounting
```

**Look for in console:**
```
[Dedup] Request already in-flight: GET:/api/sessions/{id}
```

## ✅ Test 6: Sessions List Caching

**Steps:**
1. Navigate to `/sessions`
2. Note the request in Network tab
3. Click "BACK"
4. Navigate to `/sessions` again (within 30 seconds)
5. Watch Network tab

**Expected Result:**
```
First visit:
✅ 1 request to /api/sessions

Second visit (within 30s):
✅ 0 requests (cached!)
```

## 🐛 Common Issues

### "I'm still seeing duplicate calls"

**Check these:**
1. Look at the URL - are they actually the same endpoint?
2. Look at the request body - POST requests with different bodies are NOT duplicates
3. Check if 30+ seconds passed (cache expired)
4. Open console and look for "[Cache HIT]" or "[Cache MISS]" logs

### "Data doesn't update after I make a change"

**This means:**
- Cache invalidation might not be working
- Check console for "Invalidated cache" message
- Try clicking the refresh icon (if available)
- As a workaround, switch tabs and back

### "Getting 'undefined' errors"

**First steps:**
1. Check browser console for actual error
2. Ensure you have a valid session ID
3. Try creating a new session from `/sessions/new`

## 📊 Performance Comparison

### Before Optimization
```
Initial Load: 4-8 API calls
Tab Switch: 2 API calls
Switch Back: 2 API calls
Rapid Switching (10x): 20 API calls
Unit Update: 2 API calls (refetch all)

Total per minute: ~30-50 API calls
```

### After Optimization
```
Initial Load: 1-3 API calls ✅ (75% reduction)
Tab Switch: 0 API calls ✅ (cached)
Switch Back: 0 API calls ✅ (cached)
Rapid Switching (10x): 0 API calls ✅ (cached)
Unit Update: 1 API call ✅ (optimistic)

Total per minute: ~3-10 API calls ✅ (80% reduction)
```

## 🎯 Success Criteria

Your optimization is working if:

- [ ] Initial load shows ≤3 API calls in Network tab
- [ ] Tab switching after first load shows 0 API calls
- [ ] Console shows "[Cache HIT]" messages for subsequent requests
- [ ] Console shows "[Dedup]" messages in dev mode
- [ ] UI updates feel instant and responsive
- [ ] No loading spinners on tab switches (after first load)
- [ ] Unit updates apply immediately (optimistic)

## 🔍 Debug Commands

Open browser console and run these:

```javascript
// View cache statistics
import { getCacheStats } from '@/lib/requestCache';
getCacheStats();

// Clear all cache (nuclear option)
import { clearCache } from '@/lib/requestCache';
clearCache();

// Check what's cached
localStorage.getItem('taclog-current-session'); // Current session ID
```

## 📈 Advanced: Performance Profiling

1. **Open Chrome DevTools**
2. **Go to "Performance" tab**
3. **Click Record**
4. **Switch tabs 5 times**
5. **Stop recording**
6. **Look for:**
   - Minimal scripting time
   - No long tasks
   - No layout thrashing

## 💡 Tips

1. **Clear cache between tests** to get accurate "cold start" measurements
2. **Use incognito mode** to avoid browser extensions interfering
3. **Throttle network** (DevTools > Network > Throttling) to see optimizations better
4. **Watch console logs** - they tell you exactly what's happening with the cache

## 🎉 Expected Feel

After these optimizations, the app should feel:

- **Snappy**: Tab switches are instant
- **Responsive**: Updates apply immediately
- **Smooth**: No loading flickers or spinners
- **Fast**: Everything loads quickly
- **Reliable**: No race conditions or weird states

If it feels sluggish or you see loading spinners when switching tabs, something isn't working correctly.

---

**Need Help?** Check the console logs - they're very verbose and will tell you exactly what's happening with requests and caching.

