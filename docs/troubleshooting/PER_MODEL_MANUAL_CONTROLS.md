# Per-Model Manual Controls - Implementation

**Date:** October 31, 2025  
**Issue:** Dead models showing in UI, no manual per-model control  
**Status:** ✅ Fixed

## Problems Solved

### 1. Dead Models Still Showing
**Problem:** When models reached 0 wounds, they remained visible in the per-model status display with a skull icon instead of being removed.

**Solution:** Filter out dead models (0 wounds) from display:
```typescript
const aliveModels = models.filter(m => m.currentWounds > 0);
```

Models with 0 wounds are now completely hidden from the UI, making it clearer which models are still fighting.

### 2. No Manual Per-Model Control
**Problem:** Users could only adjust total wounds, which distributed damage automatically. They couldn't:
- Quickly destroy individual models
- Adjust wounds on specific models
- Handle precision attacks or targeted damage

**Solution:** Added per-model control buttons to `ModelHealthGrid`:

**Compact View:**
```
Per-Model Status (3 Models)
🟢 ◆ Trooper #1: [====] 3/3W  [-][+][✕]
🟡 ◆ Trooper #2: [==--] 2/3W  [-][+][✕]
🟢 ◆ Trooper #3: [====] 3/3W  [-][+][✕]
```

**Medium View:**
```
🟢 ⭐ Leader: 6/6W
████████████ 100%
[-1 WOUND] [+1 WOUND] [DESTROY]
```

### 3. Mixed Wound Values Support
**Problem:** Units like Hyperadapted Raveners have 1 leader with 6 wounds and 4 regular models with 3 wounds each.

**Solution:** The `modelsArray` already supports this! Each model has its own `maxWounds`:
```json
{
  "modelsArray": [
    {"role": "leader", "currentWounds": 6, "maxWounds": 6},
    {"role": "regular", "currentWounds": 3, "maxWounds": 3},
    {"role": "regular", "currentWounds": 3, "maxWounds": 3},
    {"role": "regular", "currentWounds": 3, "maxWounds": 3},
    {"role": "regular", "currentWounds": 3, "maxWounds": 3}
  ]
}
```

## How It Works

### Per-Model API Endpoint
```
PATCH /api/sessions/{sessionId}/units/{unitId}/model/{modelIndex}
```

**Body Options:**
```json
// Adjust wounds
{ "woundChange": -1 }  // Remove 1 wound
{ "woundChange": 1 }   // Add 1 wound

// Destroy model
{ "destroy": true }
```

**What Happens:**
1. Model's wounds are adjusted
2. If wounds reach 0, model is removed from `modelsArray`
3. `currentModels` and `currentWounds` totals are recalculated
4. UI refreshes to show updated state

### UI Flow

```
User clicks [-] button on Trooper #2
  ↓
useModelUpdate hook calls API
  ↓
PATCH /api/sessions/.../model/1
  Body: { "woundChange": -1 }
  ↓
API updates modelsArray:
  Trooper #2: 2W → 1W
  ↓
API recalculates totals:
  currentWounds: 9W → 8W
  currentModels: 3 (unchanged)
  ↓
onRefresh() callback
  ↓
UI refetches unit data
  ↓
ModelHealthGrid filters aliveModels
  ↓
Display shows Trooper #2 at 1/3W (red/critical)
```

### Model Death Flow

```
User clicks [DESTROY] on Trooper #2
  ↓
destroyModel(1) called
  ↓
PATCH /api/sessions/.../model/1
  Body: { "destroy": true }
  ↓
API removes model from array:
  modelsArray.length: 3 → 2
  ↓
API recalculates:
  currentModels: 3 → 2
  currentWounds: 9W → 6W
  ↓
UI refreshes
  ↓
ModelHealthGrid filters out dead models
  ↓
Display shows only 2 alive models
```

## Modified Components

### ModelHealthGrid.tsx
**Changes:**
1. **Filter dead models:** `const aliveModels = models.filter(m => m.currentWounds > 0)`
2. **Added control buttons:**
   - `-` / `+` buttons for wound adjustment
   - `✕` button to destroy model
3. **Both views supported:**
   - Compact: Small inline buttons
   - Medium: Full-width control bar

### UnitCard.tsx (Already Wired)
**Existing Features:**
- `useModelUpdate` hook for per-model API calls
- `onRefresh` callback to update UI after changes
- `id` and `sessionId` props for API routing
- Callbacks passed to `ModelHealthGrid`

### API Endpoint (Already Exists)
`app/api/sessions/[id]/units/[unitId]/model/[modelIndex]/route.ts`

## Usage Examples

### Example 1: Precision Attack on Leader
```
Raveners: 1 Leader (6W) + 4 Troopers (3W each) = 18W total

Precision attack: 4 wounds on leader
  → Click [-] four times on leader model
  → Leader: 6W → 2W (critical)
  → Total: 18W → 14W
  → Models: Still 5 alive
```

### Example 2: Regular Damage Distribution
```
Take 6 wounds on unit
  Option A: Click [-] on total wounds 6 times
    → System distributes smartly
    → 2 troopers die, leader protected
  
  Option B: Manual per-model
    → Click [DESTROY] on Trooper #1
    → Click [DESTROY] on Trooper #2
    → Same result, manual control
```

### Example 3: Mixed Health Unit
```
Current state:
  Leader: 2/6W (critical 🔴)
  Trooper #1: 3/3W (healthy 🟢)
  Trooper #2: 1/3W (critical 🔴)
  
Take 3 more wounds:
  Smart: Kills Trooper #2, damages Trooper #1
  Manual: User decides which models take damage
```

## Features

### Automatic Features
✅ Dead models (0W) removed from display  
✅ Per-model wound tracking with mixed max wounds  
✅ Smart distribution still available (total wounds adjustment)  
✅ Model count auto-updates when models die  

### Manual Controls
✅ **+/- Wound Buttons:** Adjust individual model wounds  
✅ **Destroy Button:** Instantly kill a model  
✅ **Compact View:** Small inline buttons for quick adjustments  
✅ **Medium View:** Full control bar for detailed management  
✅ **Visual Feedback:** Disabled states, hover effects, color coding  

### Visual Indicators
✅ 🟢 Healthy (100%)  
✅ 🟡 Damaged (34-99%)  
✅ 🔴 Critical (1-33%)  
✅ 💀 Dead (0%) - **Now hidden from display**  

## Benefits

### For Users
- **Precision Control:** Handle precision attacks, targeted damage, sniper fire
- **Quick Corrections:** Fix mistakes without recalculating totals
- **Clear Visibility:** Dead models disappear, no clutter
- **Mixed Units:** Properly handles leaders with different wound values

### For Gameplay
- **Accurate Tracking:** Matches tabletop casualty removal
- **Flexible Input:** Choose smart distribution OR manual control
- **Error Recovery:** Easy to fix accidental button clicks
- **Tournament Ready:** Precise enough for competitive play

## Known Behaviors

### Model Indexes
- Model indexes are based on array position
- When a model is destroyed, indexes shift down
- Example: Destroy model #1 → model #2 becomes new #1

### Wound Caps
- Can't reduce below 0 wounds (button disabled)
- Can't increase above max wounds (button disabled)
- Destroying sets wounds to 0 and removes from array

### Total Wound Adjustments
- Using the main +/- wounds buttons still uses smart distribution
- Per-model buttons give you precise control
- Both methods keep `modelsArray` and totals in sync

## Future Enhancements

- [ ] Direct wound input (type number instead of clicking)
- [ ] Bulk model operations (select multiple, apply action)
- [ ] Model reordering (drag models to change display order)
- [ ] Model notes (add text annotations per model)
- [ ] Undo/redo for manual adjustments

---

**Status:** ✅ Complete - Per-model manual controls now available in both compact and medium views

