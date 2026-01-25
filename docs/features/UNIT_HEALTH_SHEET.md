# Unit Health Sheet (Bottom Sheet UI)

**Last Updated:** 2025-12-18  
**Status:** Complete

## Overview

Grimlog's Unit Health Sheet is the mobile-first (iPad-optimized) unit tracking interface. It replaces the older full-page unit health view with a bottom-sheet layout that keeps you in context while you make fast manual corrections for the speech-to-text / AI workflow.

The sheet supports:
- Attacker/Defender tab switching with **always-visible army strength**
- A dense **unit card grid** with generated unit icons
- Inline unit controls (models, wounds, battleshock, destroy)
- **Per-model tracking** with mixed wound support and manual max-wounds edits (e.g., relic shields)
- Repair tooling for legacy/partial `modelsArray` data via **Sync Models**

## Table of Contents

- [UX Summary](#ux-summary)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Per-Model Tracking & Mixed Wounds](#per-model-tracking--mixed-wounds)
- [Repair & Sync (modelsArray mismatches)](#repair--sync-modelsarray-mismatches)
- [API Touchpoints](#api-touchpoints)
- [Key Files](#key-files)
- [Known Limitations](#known-limitations)
- [Related Documentation](#related-documentation)

## UX Summary

### Entry Points

- **Battle screen FAB** opens the Unit Health Sheet (bottom-right).
- The sheet can be closed via the close button (and supports standard modal dismissal behaviors).

### Core Layout

- **Top tabs**: Attacker / Defender (army strength and summary stats remain visible here)
- **Mode toggle**: PHASE ABILITIES / ALL UNITS
- **All Units**: 2-column+ grid of unit cards (scales up on larger viewports)
- **Expanded unit card**: touch-friendly controls for manual corrections
- **Individual Models**: per-model tiles in a responsive grid

## Architecture

### High-Level Flow

```
Battle Screen
  └─ UnitHealthSheet (bottom sheet)
      ├─ Attacker/Defender tabs + army strength
      ├─ Phase Abilities (useUnitAbilities)
      └─ All Units (useUnits)
          └─ Expand unit → inline manual controls
              └─ Individual models → per-model grid + per-model API calls
```

### Component Responsibilities

- **`components/UnitHealthSheet.tsx`**
  - Bottom-sheet UI and gestures
  - Tabs, global view toggle, and unit grid rendering
  - Expanded unit controls
  - Per-model UI (grid) and “Sync Models” repair workflow

## Data Model

### UnitInstance (high-signal fields)

- `owner`: `"attacker"` | `"defender"`
- `startingModels` / `currentModels`
- `startingWounds` / `currentWounds`
- `woundsPerModel` (baseline)
- `modelsArray` (JSON string of per-model states)
- `faction` (used for generated icon lookup)
- `datasheetId` + `fullDatasheet` (used for composition and wounds baseline)

### ModelState (`modelsArray`)

Each surviving model is represented as:

```json
{ "role": "regular", "currentWounds": 3, "maxWounds": 3 }
```

`maxWounds` enables mixed profiles (e.g., “relic shield = 4W”) in the same unit.

## Per-Model Tracking & Mixed Wounds

### Mixed Wounds From Datasheets

If `Datasheet.compositionData` is present, the backend can initialize per-model tracking with mixed `maxWounds` values (e.g., leader models vs regular models).

### Mixed Wounds From Wargear (Manual)

Many mixed-wound cases are *loadout-dependent* and may not be encoded in `compositionData`.

The sheet therefore supports **manual per-model `maxWounds` adjustments**:
- Increase/decrease a model’s `maxWounds` (clamped)
- Keeps `currentWounds` valid
- Persists via a unit-level `PATCH` using `modelsArray`

This is how you represent cases like **Wolf Guard Terminators where some models are 3W and relic-shield models are 4W**.

## Repair & Sync (modelsArray mismatches)

Older/partial data can produce mismatches like:
- `currentModels = 6` but `modelsArray` only has 3 entries
- `startingWounds` computed from baseline wounds-per-model, not from mixed profiles

The sheet exposes **Sync Models** which:
- Rebuilds a baseline `modelsArray` using `compositionData` (or fallback to `woundsPerModel`)
- Fills/truncates to match the unit’s `currentModels`
- Recomputes and corrects `startingWounds` for mixed profiles
- Persists via unit-level `PATCH` with `modelsArray`

## API Touchpoints

### Unit Patch (unit-level)

The UI uses:
- `PATCH /api/sessions/[id]/units/[unitId]` for unit-level updates and repairs (`modelsArray`, `startingWounds`, etc.)

### Model Patch (per-model)

The per-model grid uses:
- `PATCH /api/sessions/[id]/units/[unitId]/model/[modelIndex]` for per-model wound changes and destroy

## Key Files

- `components/UnitHealthSheet.tsx` - Sheet UI + per-model grid + repair
- `app/api/sessions/[id]/units/[unitId]/route.ts` - Unit patch logic (now supports `modelsArray`)
- `app/api/sessions/[id]/units/[unitId]/model/[modelIndex]/route.ts` - Per-model patch logic
- `lib/hooks/useUnits.ts` - UnitInstance typing and fetch
- `lib/hooks/useUnitIcon.ts` / `lib/unitIcons.ts` - Generated icon resolution
- `lib/hooks/useUnitAbilities.ts` - Phase-aware abilities for the sheet

## Known Limitations

- **Wargear-aware auto-mixed wounds** are not inferred automatically (needs explicit datasheet encoding or manual `maxWounds` edits).
- **`compositionData` often encodes minimum unit size**, so the UI repair logic fills missing models using a baseline template.

## Related Documentation

- [Unit Health Tracking Guide](../guides/UNIT_HEALTH_GUIDE.md) - How to use the Unit Health UI
- [Unit Health Tracking System](UNIT_HEALTH_TRACKING.md) - System architecture overview
- [Units API Endpoint](../api/UNITS_ENDPOINT.md) - API reference for unit + per-model updates
- [Mixed Wound Units Setup](../troubleshooting/MIXED_WOUND_UNITS_SETUP.md) - Troubleshooting mixed-wound initialization


