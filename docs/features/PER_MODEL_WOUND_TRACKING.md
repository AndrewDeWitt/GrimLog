# Per-Model Wound Tracking System

**Last Updated:** 2025-12-18  
**Status:** Complete

## Overview

The per-model wound tracking system provides granular health management for Warhammer 40K units, tracking individual models within squads with role awareness, smart damage distribution, and character attachment support. This system enables precise battlefield state tracking while maintaining compatibility with voice-to-text input through intelligent AI-driven damage allocation.

Key capabilities include tracking sergeants separately from regular troops, protecting special weapon bearers during automatic damage distribution, and managing attached characters as distinct entities within their parent units.

## Table of Contents

- [Core Components](#core-components)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Smart Damage Distribution](#smart-damage-distribution)
- [Character Attachments](#character-attachments)
- [Voice Command Integration](#voice-command-integration)
- [UI Components](#ui-components)
- [Related Documentation](#related-documentation)

## Core Components

### Database Schema

**UnitInstance Model** (`prisma/schema.prisma`):
- `modelsArray` (String/JSON): Individual model states `[{role, currentWounds, maxWounds}]`
- `woundsPerModel` (Int): Base wounds per model from datasheet
- `attachedToUnit` (String): Parent unit name for attached characters
- `currentModels`, `currentWounds`: Legacy fields maintained for backward compatibility

**Army Model**:
- `characterAttachments` (String/JSON): Pre-configured character-to-unit mappings `{"unit-id": "target-unit-name"}`

**Unit Model**:
- `composition` (String/JSON): Per-model composition from army lists `[{role, count, weapons, woundsPerModel}]`

**Datasheet Model**:
- `compositionData` (String/JSON): Unit composition structure from datasheet

### Smart Distribution Algorithm

**Location:** `lib/toolHandlers.ts`

**Core Functions:**
- `initializeModelsArray()`: Creates model array from unit data and composition
- `distributeWoundsSmartly()`: Allocates damage using priority system
- `targetSpecificRole()`: Applies damage to specific model roles

**Distribution Priority:**
1. Already-wounded models (finish them off)
2. Regular models
3. Special weapon models
4. Heavy weapon models
5. Sergeant/leader models (most protected)

### AI Integration

**Tool Definition** (`lib/aiTools.ts`):
- Enhanced `update_unit_health` with `target_model_role` parameter
- Role types: sergeant, leader, heavy_weapon, special_weapon, regular

**System Prompt** (`app/api/analyze/route.ts`):
- Wound distribution algorithm documentation
- Role-based targeting examples
- Character attachment handling instructions

## Architecture

### Data Flow

```
Army List Parsing
└── Extracts composition (sergeant, heavy weapon, etc.)
    └── Stores in Unit.composition

Army Builder
└── User configures character attachments
    └── Stores in Army.characterAttachments (using unit IDs)

Session Creation
└── Loads Army with attachments
    └── Creates UnitInstance for each unit
        ├── Initializes modelsArray from composition
        ├── Sets attachedToUnit for characters
        └── Sets woundsPerModel from datasheet

During Game
└── Voice: "My Terminators took 6 wounds"
    └── AI calls update_unit_health(wounds_lost=6)
        └── distributeWoundsSmartly()
            ├── Damages wounded models first
            ├── Targets regulars before special
            └── Returns distribution log
        └── Updates modelsArray in database
        └── UI refreshes with new model states
```

### Component Hierarchy

```
UnitHealthSheet (bottom sheet)
├── Fetches unit instances from API (useUnits)
├── Shows Attacker/Defender tabs and army strength summary
└── Unit card (expandable)
    ├── Unit-level controls (models/wounds/battleshock/destroy)
    └── Individual Models (per-model grid)
        ├── Wound +/- per model
        ├── Destroy model
        └── MAX WOUNDS edits (for loadout-based mixed wounds)
```

## Data Model

### Model State Structure

```typescript
interface ModelState {
  role: "sergeant" | "leader" | "heavy_weapon" | "special_weapon" | "regular";
  currentWounds: number;
  maxWounds: number;
}
```

### Unit Composition (from Army List)

```json
{
  "composition": [
    {
      "role": "sergeant",
      "count": 1,
      "weapons": ["plasma pistol"],
      "woundsPerModel": 2
    },
    {
      "role": "heavy_weapon",
      "count": 1,
      "weapons": ["heavy bolter"],
      "woundsPerModel": 2
    },
    {
      "role": "regular",
      "count": 8,
      "weapons": ["bolt rifle"],
      "woundsPerModel": 2
    }
  ]
}
```

### Character Attachments (Army Configuration)

```json
{
  "characterAttachments": {
    "abc-123-unit-id": "Intercessor Squad Alpha",
    "def-456-unit-id": "Tactical Squad Bravo"
  }
}
```

**Note:** Uses unit IDs as keys to support duplicate characters (e.g., 2 Neurotyrants).

## Smart Damage Distribution

### Algorithm Details

**Priority System:**
```typescript
roleRankings = {
  'sergeant': 4,    // Highest protection
  'leader': 4,
  'heavy_weapon': 3,
  'special_weapon': 2,
  'regular': 1      // Lowest protection (targeted first)
}
```

**Sorting Logic:**
1. Sort by wound status (wounded models first)
2. Sort by role rank (regulars before special)
3. Apply wounds in sorted order

### Example Scenarios

**Scenario 1: Mixed Health States**
```
Unit: 5 Intercessors (2W each)
State: [2/2, 2/2, 1/2, 1/2, 2/2]
Damage: 4 wounds

Result:
- Model 3: 1→0 (destroyed, already wounded)
- Model 4: 1→0 (destroyed, already wounded)
- Model 1: 2→0 (destroyed, was healthy)
- Final: [2/2, 2/2]
```

**Scenario 2: Role Protection**
```
Unit: 10 Tactical Marines
Composition: 1 Sergeant, 1 Heavy Bolter, 8 Regular
Damage: 3 wounds (1W per model)

Result:
- 3 regular models destroyed
- Sergeant and heavy bolter untouched
```

## Character Attachments

### Configuration Flow

1. **Army Builder** (`app/armies/[id]/page.tsx`):
   - Character units detected via CHARACTER keyword
   - Dropdown selector for attachment target
   - Save to Army.characterAttachments using unit ID as key

2. **Session Creation** (`app/api/sessions/[id]/units/route.ts`):
   - Parse characterAttachments from army
   - Create UnitInstance for each unit
   - Set `attachedToUnit` field for characters

3. **Display** (`components/UnitHealthSheet.tsx`):
   - Filter characters from main unit list
   - Query attached characters for each unit
   - Display characters with parent unit

### Voice Command Handling

**Unit Targeting:**
```
"My Intercessors took 6 wounds"
→ Targets Intercessor models only (not attached Captain)
```

**Character Targeting:**
```
"Captain took 3 wounds"
→ Targets Captain unit specifically
```

**System Behavior:**
- Characters and parent units are separate UnitInstance records
- Damage applies independently
- Player specifies which receives wounds (realistic 10th Ed rules)

## Voice Command Integration

### Supported Commands

**Generic Distribution:**
- "My Terminators took 6 wounds" → Smart auto-distribution
- "Opponent's Tyrant Guard lost 3 models" → Model removal

**Role-Specific:**
- "Terminator Sergeant took 3 wounds" → Targets sergeant only
- "Lost my heavy bolter guy" → Removes heavy_weapon model
- "Plasma gun marine died" → Removes special_weapon model

**Character Targeting:**
- "Captain took 4 wounds" → Targets character unit
- "Librarian is destroyed" → Marks character destroyed

### AI Processing

**Tool:** `update_unit_health`

**Parameters:**
- `unit_name`: Unit or character name (fuzzy matching)
- `owner`: "player" or "opponent"
- `wounds_lost`: Wounds to distribute (optional)
- `models_lost`: Entire models to remove (optional)
- `target_model_role`: Specific role to target (optional)

**Returns:**
- Distribution log showing which models were affected
- Updated unit state
- Half-strength warnings if applicable

## UI Components

### ModelHealthGrid Component

**File:** `components/ModelHealthGrid.tsx`

**Display Modes:**
- **Compact:** Small icons in row, color-fill indicates health
- **Grid:** Large grid for 5+ identical models (numbered squares)
- **List:** Grouped by role with individual health bars

**Visual Indicators:**
- Role icons: ⭐ sergeant, 🔫 heavy weapon, ⚡ special weapon, ◆ regular
- Health colors: Green (>66%), Amber (33-66%), Red (<33%), Grey (destroyed)
- Border colors match role importance

### UnitCard Enhancements

**File:** `components/UnitCard.tsx`

**New Features:**
- Per-model breakdown section below health bars
- Attached character display below unit name
- Character health shown separately (e.g., "⭐ Captain 5/5W")
- Compact view shows "+1⭐" indicator for attached characters

### UnitHealthSheet Updates (Current)

**File:** `components/UnitHealthSheet.tsx`

**Key Changes:**
- Per-model UI is rendered as a responsive grid (better iPad horizontal usage)
- Per-model controls: wound +/- and destroy
- Manual mixed-wound support via per-model **MAX WOUNDS** edits
- “Sync Models” repair tool for `modelsArray` length mismatches

## Backward Compatibility

### Auto-Initialization

**Existing Units:**
- Units without `modelsArray` automatically initialize on first damage
- Creates simple array of "regular" models
- Preserves current health state
- No data migration required

**Legacy Fields:**
- `currentModels` and `currentWounds` maintained
- Updated alongside `modelsArray`
- Ensures compatibility with old code paths

### Session Compatibility

**Old Sessions:**
- Continue to work normally
- Per-model tracking initializes on first damage
- No character attachments (attachments only apply to new sessions)

**New Sessions:**
- Full per-model tracking from start
- Character attachments applied if configured
- Composition data used if available from army list

## Performance Considerations

### JSON Parsing

**Strategy:**
- modelsArray parsed only when rendering UnitCard
- Cached in component state (not re-parsed on every render)
- Typical unit (10 models): ~500 bytes JSON, negligible parse time

### Large Units

**Optimization:**
- Grid view uses CSS grid (hardware accelerated)
- Compact view limits to essential info
- Role grouping reduces visual complexity

**Tested Sizes:**
- 1-10 models: Excellent performance
- 10-20 models: Good performance
- 20+ models: Acceptable (consider compact view)

## Error Handling

### Missing Data

**No modelsArray:**
- Auto-initializes from currentModels and woundsPerModel
- Logs initialization to console
- Defaults to "regular" role for all models

**No woundsPerModel:**
- Fetches from fullDatasheet if linked
- Defaults to 1 if unavailable
- Warns in console

**Invalid JSON:**
- Catches parse errors
- Falls back to initialization
- Logs warning to console

### Invalid Role Targets

**Unknown Role:**
- Warning in distribution log
- Returns models unchanged
- AI tool succeeds but reports no changes

## Related Documentation

- [User Guide: Per-Model Wound Tracking](../guides/PER_MODEL_WOUND_TRACKING_GUIDE.md) - How to use the feature
- [User Guide: Character Attachments](../guides/CHARACTER_ATTACHMENTS_GUIDE.md) - How to configure characters
- [API: Sessions Unit Endpoints](../api/UNITS_ENDPOINT.md) - Unit instance API reference
- [Feature: AI Tool Calling System](AI_TOOL_CALLING.md) - AI integration details
- [Architecture](../ARCHITECTURE.md) - Overall system design

