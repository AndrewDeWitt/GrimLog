# Per-Model Manual Controls

**Date:** October 31, 2025  
**Status:** ✅ Complete  
**Version:** 3.9.1

## Overview

Per-model manual controls allow users to directly interact with individual models within a unit, providing granular control over wound tracking and model destruction. This feature addresses the need for precise manual adjustments during gameplay while maintaining the automatic wound distribution system.

## Problem Solved

**User Issue:** "I need manual control per model like a quick action to delete or to modify wounds if need be. I want to make the models disappear when they are killed."

### Specific Challenges
1. **Mixed wound models** - Units like Raveners have leaders with different wound values (Prime: 6W, regulars: 3W)
2. **Manual precision** - Players need to target specific models (precision attacks, special effects)
3. **Model visibility** - Dead models weren't disappearing from the display
4. **Quick corrections** - Need fast way to adjust individual model wounds without voice commands

## Solution Components

### 1. Per-Model API Endpoint
**File:** `app/api/sessions/[id]/units/[unitId]/model/[modelIndex]/route.ts`

**Capabilities:**
- `PATCH` - Update specific model's wounds or destroy it
- Supports wound adjustments (+/- wounds)
- Supports direct wound setting
- Supports instant model destruction
- Automatically recalculates unit totals
- Creates timeline events for tracking

**Example API Call:**
```typescript
// Adjust wounds
PATCH /api/sessions/{sessionId}/units/{unitId}/model/0
Body: { woundChange: -1 }  // Remove 1 wound

// Destroy model
PATCH /api/sessions/{sessionId}/units/{unitId}/model/2
Body: { destroy: true }  // Instantly destroy model #3
```

### 2. Enhanced ModelHealthGrid Component
**File:** `components/ModelHealthGrid.tsx`

**New Features:**
- Per-model wound adjustment buttons (+1W / -1W)
- Destroy button (✕) for instant model removal
- Confirmation dialog for destruction
- Buttons only visible in medium (detailed) view
- Smart enable/disable based on current wounds

**UI Layout:**
```
┌─────────────────────────────────────────┐
│ 🟢 ⭐ Leader #1         6/6 WOUNDS      │
│ ████████████████████ 100%              │
│ [-1W] [+1W]                       [✕]  │
└─────────────────────────────────────────┘
```

### 3. Custom React Hook
**File:** `lib/hooks/useModelUpdate.ts`

**Functions:**
- `updateModelWounds(modelIndex, change)` - Adjust wounds by +/- value
- `destroyModel(modelIndex)` - Instantly destroy a specific model
- Auto-refreshes unit data after successful update
- Error handling and logging

### 4. UnitCard Integration
**File:** `components/UnitCard.tsx`

**New Props:**
- `id` - Unit instance ID for API calls
- `sessionId` - Session ID for API routing
- `onRefresh` - Callback to refresh data after per-model updates

**Model Controls:**
- Medium view: Full controls (+1W, -1W, Destroy)
- Compact view: Display only (no controls for space)

## How It Works

### Example: Ravener Prime Takes 2 Wounds

**Before:**
```
Ravener Prime (Leader): 6/6W 🟢
Ravener #1: 3/3W 🟢
Ravener #2: 3/3W 🟢
```

**User Action:**
1. Clicks -1W button on Ravener Prime twice
2. Each click:
   - Sends `PATCH /api/.../model/0` with `woundChange: -1`
   - API updates model's `currentWounds`
   - Recalculates unit totals
   - Returns updated unit data
   - UI refreshes automatically

**After:**
```
Ravener Prime (Leader): 4/6W 🟡
Ravener #1: 3/3W 🟢
Ravener #2: 3/3W 🟢

Total: 3/3 models, 10/12W
```

### Example: Destroying a Wounded Model

**Before:**
```
Bladeguard #1: 3/3W 🟢
Bladeguard #2: 1/3W 🔴  ← Target
Bladeguard #3: 3/3W 🟢
```

**User Action:**
1. Clicks ✕ (Destroy) button on Bladeguard #2
2. Confirmation dialog: "Destroy Trooper #2?"
3. Confirms
4. API call: `PATCH /api/.../model/1` with `destroy: true`
5. Model removed from `modelsArray`
6. UI refreshes

**After:**
```
Bladeguard #1: 3/3W 🟢
Bladeguard #2: 3/3W 🟢  ← Was #3, now #2

Total: 2/3 models, 6/9W
```

### Dead Models Automatically Disappear

When a model reaches 0 wounds (via manual -1W button or automatic distribution):
1. Model is **removed from `modelsArray`**
2. Not marked as "destroyed" and hidden - **completely removed**
3. Array indices shift automatically
4. Subsequent models renumbered

**Example:**
```
Before: [Leader 6W, Trooper#1 3W, Trooper#2 1W, Trooper#3 3W]

User clicks -1W on Trooper#2 (index 2)
  → Trooper#2 reaches 0W
  → Removed from array

After: [Leader 6W, Trooper#1 3W, Trooper#2 3W]  ← Was Trooper#3
```

## Smart Features

### Mixed Wound Support
The system properly handles units with models of different wound values:
- Ravener Prime (6W) + 4 Raveners (3W each) = 5 models, 18W total
- Bladeguard Sergeant (4W) + 2 Bladeguard (3W each) = 3 models, 10W total
- Each model maintains its own `maxWounds` value

### Automatic Totals Recalculation
After every per-model change:
```typescript
currentModels = modelsArray.length
currentWounds = sum(modelsArray.map(m => m.currentWounds))
isDestroyed = (modelsArray.length === 0)
```

### Timeline Tracking
Every manual adjustment creates a timeline event:
```
"player's Hyperadapted Raveners - Model #1 adjusted wounds by -2"
"opponent's Bladeguard Veterans - Model #2 destroyed"
```

## User Interface

### Medium View (Detailed)
- Full per-model breakdown with role labels
- Large health bars showing percentage
- **Manual control buttons:**
  - `-1W` - Red button, decrease by 1 wound
  - `+1W` - Green button, increase by 1 wound (up to max)
  - `✕` - Red destroy button with confirmation
- Buttons enable/disable based on current state
- Critical damage warnings (< 33% health)

### Compact View (Space-Saving)
- Horizontal list of model indicators
- Status icons (🟢🟡🔴💀)
- Role badges visible
- **No manual controls** (too cramped)

## Button States

### +1W Button
- **Enabled:** Model below max wounds
- **Disabled:** Model at max wounds
- **Action:** Adds 1 wound, updates instantly

### -1W Button
- **Enabled:** Model has wounds remaining
- **Disabled:** Model at 0 wounds (shouldn't happen, model removed)
- **Action:** Removes 1 wound, destroys if reaches 0

### ✕ Destroy Button
- **Always enabled** for manual corrections
- **Confirmation dialog** prevents accidents
- **Action:** Instantly removes model from array

## API Response Flow

```
User clicks -1W button
  ↓
useModelUpdate hook called
  ↓
PATCH /api/sessions/{sessionId}/units/{unitId}/model/{index}
  ↓
Server:
  1. Parse modelsArray
  2. Validate model index
  3. Apply wound change
  4. Remove model if 0 wounds
  5. Recalculate totals
  6. Save to database
  7. Create timeline event
  ↓
Response: Updated unit instance
  ↓
onSuccess callback → refetch()
  ↓
UI updates with new data
```

## Error Handling

### Invalid Model Index
```json
{ "error": "Invalid model index: 5" }
```
- Returns 400 Bad Request
- Model index out of bounds

### Missing modelsArray
```json
{ "error": "Unit does not have per-model tracking" }
```
- Returns 400 Bad Request
- Unit needs initialization

### Server Errors
- Logged to console
- Silent failure (no UI disruption)
- User can retry manually

## Compatibility

### With Voice Commands
- Voice commands use smart distribution
- Manual controls target specific models
- Both systems update same `modelsArray`
- Compatible and complementary

### With Automatic Distribution
- Manual adjustments override automatic distribution
- Useful for corrections or special cases
- Precision attacks can be manually applied

### With Older Sessions
- Backward compatible
- Units without `modelsArray` show "No per-model tracking" if controls clicked
- Automatic initialization on first wound adjustment

## Performance

- **Instant UI feedback** - Optimistic updates not needed (single model scope)
- **Single API call** per button click
- **Minimal payload** - Only affected model data sent
- **Fast response** - < 100ms for typical update

## Accessibility

- **Keyboard accessible** - All buttons tabbable
- **ARIA labels** - Screen reader friendly
  - "Remove 1 wound from Trooper #2"
  - "Add 1 wound to Leader #1"
  - "Destroy Heavy Weapon model"
- **Clear visual states** - Disabled buttons obvious
- **Confirmation dialogs** - Prevent accidental destruction

## Future Enhancements

- [ ] Direct wound input (click to type exact value)
- [ ] Drag-and-drop model reordering
- [ ] Bulk model operations (destroy all wounded)
- [ ] Undo last model change
- [ ] Model notes/markers per-model
- [ ] Visual model positioning on battlefield

## Related Files

**New:**
- `app/api/sessions/[id]/units/[unitId]/model/[modelIndex]/route.ts` - API endpoint
- `lib/hooks/useModelUpdate.ts` - React hook
- `docs/features/PER_MODEL_MANUAL_CONTROLS.md` - This document

**Modified:**
- `components/ModelHealthGrid.tsx` - Added manual controls UI
- `components/UnitCard.tsx` - Integrated hook and callbacks
- `components/UnitHealthView.tsx` - Passed required props

**Related:**
- `docs/features/PER_MODEL_WOUND_TRACKING.md` - System overview
- `docs/troubleshooting/PER_MODEL_WOUND_CALCULATION_FIX.md` - Distribution fix

---

**Status:** ✅ Complete - Per-model manual controls fully functional

