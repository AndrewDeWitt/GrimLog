# Per-Model Wound Calculation Fix

**Date:** October 31, 2025  
**Issue:** Units not calculating model deaths from wound loss  
**Status:** ✅ Fixed

## Problem Description

### Reported Issue
User reported: "Hyperadapted Raveners unit with 5 models × 3 wounds each (15 total) took 6 wounds of damage. The UI showed 24/30 wounds but still showed 5/5 models when it should calculate 2 dead models (6 wounds ÷ 3 per model) and display 3/5 models."

### Root Cause
The manual UI update endpoint (`/api/sessions/[id]/units/[unitId]`) was updating the legacy `currentWounds` field directly without:
1. Distributing wounds across the `modelsArray` (per-model tracking)
2. Calculating how many models should die from those wounds
3. Updating `currentModels` based on surviving models in the array

### Technical Details
- Database has two systems:
  - **Legacy fields:** `currentModels`, `currentWounds` (simple totals)
  - **Per-model tracking:** `modelsArray` (JSON array of individual model states)
- The AI voice command system uses `modelsArray` correctly
- But manual UI button adjustments (+1/-1 wounds) only updated legacy fields
- Result: Desync between total wounds and actual model count

## Solution Implemented

### File Modified
`app/api/sessions/[id]/units/[unitId]/route.ts`

### Changes Made

#### 1. Added Wound Distribution Logic
```typescript
function distributeWoundsAcrossModels(
  models: ModelState[],
  totalWoundsRemaining: number
): ModelState[] {
  // Distributes wounds smartly:
  // - Wounded models first
  // - Regular models before special roles
  // - Removes models with 0 wounds (dead)
  // Returns only surviving models
}
```

#### 2. Automatic `modelsArray` Initialization
- If unit doesn't have `modelsArray`, it's initialized from current state
- Creates array of models with proper wounds per model
- Maintains backward compatibility with older sessions

#### 3. Wound Adjustment Now Calculates Model Deaths
**Before:**
```typescript
if (body.currentWounds !== undefined) {
  updateData.currentWounds = Math.max(0, body.currentWounds);
}
// ❌ currentModels not updated!
```

**After:**
```typescript
if (body.currentWounds !== undefined) {
  const newTotalWounds = Math.max(0, body.currentWounds);
  
  // Distribute wounds across models
  const updatedModels = distributeWoundsAcrossModels(modelsArray, newTotalWounds);
  
  // ✅ Update currentModels based on survivors
  updateData.currentModels = updatedModels.length;
  updateData.modelsArray = JSON.stringify(updatedModels);
  updateData.currentWounds = newTotalWounds;
}
```

#### 4. Model Adjustment Updates Wounds
When manually adjusting model count, wounds are recalculated proportionally.

#### 5. Datasheet Integration
```typescript
const woundsPerModel = unitInstance.woundsPerModel || 
                       unitInstance.fullDatasheet?.wounds || 
                       1;
```
Falls back to datasheet's wounds characteristic if not set.

## How It Works Now

### Example: Hyperadapted Raveners
**Initial State:**
- 5 models × 3 wounds = 15 total wounds
- `modelsArray`: `[{role: 'regular', currentWounds: 3, maxWounds: 3}, ...]` (5 models)
- Display: 5/5 models, 15/15 wounds

**Takes 6 Wounds Damage:**
1. User clicks "-1 wound" button 6 times (or adjusts to 9 wounds remaining)
2. API receives: `currentWounds: 9` (15 - 6 = 9)
3. **New logic kicks in:**
   ```
   distributeWoundsAcrossModels(5 models, 9 wounds remaining)
   → 9 wounds ÷ 3 per model = 3 full models
   → Returns: [{3W}, {3W}, {3W}]  (3 models survive)
   ```
4. Update database:
   ```
   currentModels: 3 (was 5)
   currentWounds: 9 (was 15)
   modelsArray: "[{...}, {...}, {...}]"  (3 models)
   ```
5. Display: **3/5 models, 9/15 wounds** ✅

### Smart Distribution
- **Wounded models targeted first:** If a unit has mixed health, wounded models die before healthy ones
- **Role protection:** Regular troops die before specialists (sergeants, heavy weapons)
- **Fractional wounds:** Extra wounds carry over to next model

**Example with mixed wounds:**
```
Unit: 5 Bladeguard (3W each)
State: [3/3, 3/3, 2/3, 1/3, 3/3]
Takes 6 wounds damage:

1. Model with 1/3W takes 1 wound → dies
2. Model with 2/3W takes 2 wounds → dies  
3. Healthy model takes 3 wounds → dies
4. Result: [3/3, 3/3] (2 survivors) ✅
```

## Testing Scenarios

### Test 1: Multi-Wound Unit (Raveners)
```
Initial: 5 models × 3W = 15W
Lose 6W → Should show 3/5 models, 9W remaining
Lose 3W more → Should show 2/5 models, 6W remaining
Lose 6W more → Should show 0/5 models, destroyed
```

### Test 2: Single-Wound Unit (Termagants)
```
Initial: 10 models × 1W = 10W
Lose 3W → Should show 7/10 models
Lose 7W more → Should show 0/10 models, destroyed
```

### Test 3: Character with Attached Unit
```
Captain (4W) + 5 Bladeguard (3W each) = 19W total
Precision attack: 2W on Captain
→ Captain: 2/4W
→ Bladeguard: 5/5 models, all at 3/3W
```

## Database Fields

### UnitInstance Schema
```prisma
model UnitInstance {
  // Legacy fields (maintained for compatibility)
  currentModels   Int     // Total models alive (auto-calculated)
  currentWounds   Int?    // Total wounds remaining (user input)
  startingModels  Int     // Initial model count
  startingWounds  Int?    // Initial total wounds
  
  // Per-model tracking (source of truth)
  woundsPerModel  Int?    // Wounds per model from datasheet
  modelsArray     String? // JSON: [{role, currentWounds, maxWounds}]
  
  // Relations
  fullDatasheet   Datasheet? // Link to datasheet for wounds characteristic
}
```

### Data Flow
```
User Action (UI -1 wound button)
  ↓
PATCH /api/sessions/[id]/units/[unitId]
  ↓
1. Fetch unit + datasheet
2. Get woundsPerModel from datasheet
3. Initialize modelsArray if needed
4. Distribute wounds across models
5. Calculate surviving models
6. Update database:
   - modelsArray (per-model states)
   - currentModels (count of survivors)
   - currentWounds (total remaining)
  ↓
UI updates with correct model count ✅
```

## Backward Compatibility

### Older Sessions Without modelsArray
1. Endpoint detects missing `modelsArray`
2. Initializes from `currentModels` and `woundsPerModel`
3. Future updates use per-model tracking
4. No data loss or breaking changes

### Units Without Datasheet Link
1. Falls back to `woundsPerModel` field
2. Falls back to `startingWounds / startingModels` ratio
3. Defaults to 1 wound per model if all else fails

## Related Files

**Modified:**
- `app/api/sessions/[id]/units/[unitId]/route.ts` - Manual UI update endpoint

**Related (unchanged):**
- `lib/toolHandlers.ts` - AI voice command system (already correct)
- `components/UnitHealthView.tsx` - UI display
- `components/ModelHealthGrid.tsx` - Per-model visualization
- `docs/features/PER_MODEL_WOUND_TRACKING.md` - System documentation

## Known Limitations

1. **Manual adjustments don't target specific models:** When manually adjusting wounds, the system uses smart distribution. For precision attacks (e.g., "2 wounds on sergeant"), use voice commands.

2. **Rounding on fractional wounds:** If a unit has unusual wound distributions, rounding may occur. This matches tabletop rules.

3. **No model resurrection:** Once `modelsArray` is populated, removing models is permanent unless manually adjusted back up.

## Future Enhancements

- [ ] UI button to target specific model roles
- [ ] Visual per-model health in card preview
- [ ] Undo/redo for manual adjustments
- [ ] Import/export modelsArray for battle app integration

---

**Fix Status:** ✅ Complete and deployed  
**Impact:** All multi-wound units now correctly calculate model deaths from wound loss

