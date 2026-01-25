# Unit Health Sync Issues

**Last Updated:** 2025-12-22  
**Status:** Complete

## Overview

This document covers common issues where unit health data becomes out of sync, causing incorrect model counts, wound totals, or UI display problems. These issues typically occur when `modelsArray` doesn't match `currentModels`, or when the UI doesn't refresh after voice commands.

## Table of Contents

- [Symptoms](#symptoms)
- [Root Causes](#root-causes)
- [Solutions](#solutions)
- [Prevention](#prevention)
- [Related Documentation](#related-documentation)

## Symptoms

### Symptom 1: Unit Shows Wrong Model Count

**Example:**
- Unit shows "6/6 models" but Individual Models section only has 3 models
- "Sync Models (3/6)" button appears
- Total wounds show 9W instead of 18W (for 6 models × 3 wounds each)

**What's happening:**
The `modelsArray` in the database has fewer entries than `currentModels` indicates. This happens when units are initialized from `compositionData` templates that don't match the actual model count.

### Symptom 2: UI Doesn't Update After Voice Commands

**Example:**
- You say "Bjorn killed 2 Eradicators"
- API response shows success: `"5/6 models remaining"`
- But Unit Health Sheet still shows 6/6 models

**What's happening:**
The backend updated the database correctly, but the frontend cache wasn't invalidated, so React is showing stale data.

### Symptom 3: Damage Applied Incorrectly

**Example:**
- Unit has 6 models, you say "kill 2 models"
- System says "unit destroyed" even though 4 models should remain

**What's happening:**
The `modelsArray` only had 3 entries, so killing 2-3 models emptied the array, triggering the "destroyed" state incorrectly.

## Root Causes

### Cause 1: Composition Template Mismatch

**When it happens:**
- Units initialized from army lists with `compositionData`
- Template defines minimum composition (e.g., 1 leader + 2 troopers = 3 models)
- But actual unit has more models (e.g., 6 models total)

**Why:**
The initialization code built `modelsArray` from the template without scaling to match `unit.modelCount`.

**Fixed in:** v4.41.0

### Cause 2: Frontend Cache Not Invalidated

**When it happens:**
- After voice commands that update unit health
- When Unit Health Sheet is already open
- After tool calls complete successfully

**Why:**
`refreshGameState()` only updated session data (phase, CP, VP) but didn't invalidate the units cache or trigger a refetch.

**Fixed in:** v4.41.0

### Cause 3: Legacy Data Without modelsArray

**When it happens:**
- Units created before per-model tracking was implemented
- Units imported from old sessions
- Manual unit additions without proper initialization

**Why:**
Older units may not have `modelsArray` populated, causing the system to initialize it lazily on first damage application, potentially with incorrect counts.

**Fixed in:** v4.41.0 (runtime reconciliation added)

## Solutions

### Solution 1: Use Sync Models Button (Immediate Fix)

**For Symptom 1 (Wrong Model Count):**

1. Open Unit Health Sheet
2. Expand the affected unit
3. Expand "INDIVIDUAL MODELS" section
4. Click **"Sync Models (X/Y)"** button
5. System will rebuild `modelsArray` to match `currentModels`

**What it does:**
- Reads `currentModels` from database
- Builds correct `modelsArray` with proper model count
- Updates `startingWounds` and `currentWounds` to match
- Saves corrected data

### Solution 2: Refresh Page (Quick Fix)

**For Symptom 2 (UI Not Updating):**

1. Refresh the browser page (F5 or Cmd+R)
2. Unit Health Sheet will reload with fresh data

**Note:** This is a temporary workaround. The system should auto-refresh now (v4.41.0+).

### Solution 3: Re-initialize Unit (Nuclear Option)

**For severe sync issues:**

1. Note the unit's current state (models, wounds)
2. Delete the unit from the session
3. Re-add it with correct model count
4. Manually adjust wounds to match previous state

**Warning:** This loses per-model wound tracking history.

### Solution 4: Manual Database Correction (Advanced)

**For developers/debugging:**

```sql
-- Check unit state
SELECT id, unitName, currentModels, 
       LENGTH(modelsArray) - LENGTH(REPLACE(modelsArray, '{', '')) as modelCountInArray
FROM "UnitInstance"
WHERE gameSessionId = 'your-session-id';

-- Fix modelsArray if needed (example for 6-model unit with 3W each)
UPDATE "UnitInstance"
SET modelsArray = '[
  {"role":"leader","currentWounds":3,"maxWounds":3},
  {"role":"regular","currentWounds":3,"maxWounds":3},
  {"role":"regular","currentWounds":3,"maxWounds":3},
  {"role":"regular","currentWounds":3,"maxWounds":3},
  {"role":"regular","currentWounds":3,"maxWounds":3},
  {"role":"regular","currentWounds":3,"maxWounds":3}
]'
WHERE id = 'unit-id' AND currentModels = 6;
```

## Prevention

### For Users

1. **Verify unit initialization:**
   - After creating a session, check that all units show correct model counts
   - Use "Sync Models" button if you see mismatches

2. **Check after voice commands:**
   - If unit health seems wrong after a voice command, refresh the Unit Health Sheet
   - The system should auto-refresh now, but manual refresh is always safe

3. **Report issues:**
   - If you see persistent sync issues, report them with:
     - Unit name and model count
     - What voice command you used
     - What the UI showed vs. what you expected

### For Developers

1. **Always validate modelsArray length:**
   ```typescript
   if (modelsArray.length !== unitInstance.currentModels) {
     // Reconcile before applying damage
   }
   ```

2. **Invalidate cache after tool calls:**
   ```typescript
   invalidateCachePattern(`/api/sessions/${sessionId}/units`);
   setUnitsRefreshKey(prev => prev + 1); // Force React remount
   ```

3. **Test with compositionData:**
   - Test units with templates smaller than actual model count
   - Verify modelsArray is scaled correctly on initialization

## Related Documentation

- [Unit Health Tracking](../features/UNIT_HEALTH_TRACKING.md) - System architecture
- [Unit Health Guide](../guides/UNIT_HEALTH_GUIDE.md) - User guide for Unit Health Sheet
- [Per-Model Wound Tracking Guide](../guides/PER_MODEL_WOUND_TRACKING_GUIDE.md) - Per-model tracking details
- [Units Endpoint](../api/UNITS_ENDPOINT.md) - API reference

