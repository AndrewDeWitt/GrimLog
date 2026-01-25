# Unit Health Tracking System

**Last Updated:** 2025-12-18  
**Status:** Complete

## Overview

Grimlog's Unit Health Tracking system provides real-time monitoring and manual correction tools for all unit state in a battle session: model counts, wounds, battleshock status, destruction state, and per-model health. It is designed to work alongside speech-to-text + AI automation, ensuring the UI can always correct or replace automated actions.

The current primary UI for this system is the **Unit Health Sheet** (bottom sheet) (`components/UnitHealthSheet.tsx`).

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Components](#components)
- [Per-Model Data Model](#per-model-data-model)
- [Performance & UX Principles](#performance--ux-principles)
- [Related Documentation](#related-documentation)

## Key Features

### Manual Unit Management (Attacker/Defender)

- **Attacker/Defender tabs** with always-visible army strength summaries
- **Unit grid** optimized for iPad/tablet scanning
- Inline unit controls:
  - model count adjustments
  - wound adjustments (for multi-wound units)
  - battleshock toggle
  - destroy unit

### Per-Model Tracking (Mixed Wounds)

- `modelsArray` supports per-model states: `{ role, currentWounds, maxWounds }`
- Supports mixed `maxWounds` within a unit (composition-based or manual wargear adjustments)
- Per-model controls:
  - adjust wounds
  - destroy model
  - edit **MAX WOUNDS** (for loadout-dependent cases like relic shields)

### Unit Icons (Visual Identification)

- Uses generated icons resolved from faction + datasheet/unit name
- Falls back gracefully (emoji/role-based) when no generated icon exists

## Architecture

### Data Flow (Optimistic UI Pattern)

```
User action
  → optimistic UI update (instant)
  → PATCH API call (server sync)
  → refetch or silent recovery on failure
```

### Persistence Model

All unit state is stored on `UnitInstance` records:
- totals (models/wounds)
- status flags (destroyed, battleshocked)
- per-model `modelsArray` (when present)

## Components

### Core UI

- **`components/UnitHealthSheet.tsx`**
  - bottom-sheet container and UI states
  - attacker/defender tab header with strength indicators
  - global mode toggle (phase abilities / all units)
  - unit card grid + expandable unit controls
  - per-model grid + Sync Models repair workflow

### Supporting Hooks

- **`lib/hooks/useUnits.ts`**
  - fetches unit instances for a session
  - provides `refetch()` for background sync after updates

- **`lib/hooks/useModelUpdate.ts`**
  - per-model PATCH requests (`/model/[modelIndex]`) for wound changes/destroy

- **`lib/hooks/useUnitAbilities.ts`**
  - phase-aware abilities list for the current session/phase

- **`lib/hooks/useUnitIcon.ts`** + **`lib/unitIcons.ts`**
  - resolves generated unit icons by `faction` + `unitName`
  - provides fallbacks when no custom icon exists

## Per-Model Data Model

### UnitInstance Fields (high signal)

- `owner`: `"attacker"` | `"defender"`
- `startingModels`, `currentModels`
- `startingWounds`, `currentWounds`
- `woundsPerModel` (baseline / fallback)
- `modelsArray` (JSON string of `ModelState[]`)
- `datasheetId` + `fullDatasheet.compositionData` (for initialization baseline)

### ModelState (`modelsArray`)

```json
{ "role": "leader", "currentWounds": 3, "maxWounds": 3 }
```

Important invariants:
- `modelsArray` represents **surviving models only**
- each model clamps `0 < currentWounds <= maxWounds`

## Performance & UX Principles

- **Mobile-first / iPad-first**: large touch targets and dense grid layout
- **Instant feedback**: optimistic UI updates, no loading spinners for common actions
- **Always-correctable**: manual overrides exist for all unit state (including per-model max wounds)
- **Repairable state**: Sync Models exists to fix legacy partial `modelsArray` mismatches

## Related Documentation

- **[Unit Health Tracking Guide](../guides/UNIT_HEALTH_GUIDE.md)** - How to use the Unit Health Sheet
- **[Unit Health Sheet](UNIT_HEALTH_SHEET.md)** - Feature doc for the bottom-sheet UI
- **[Units API Endpoint](../api/UNITS_ENDPOINT.md)** - API reference for unit and per-model updates
- **[Mixed Wound Units Setup](../troubleshooting/MIXED_WOUND_UNITS_SETUP.md)** - Mixed wound setup and troubleshooting
- **[Game State Tracking](../features/GAME_STATE_TRACKING.md)** - Overall game state management system