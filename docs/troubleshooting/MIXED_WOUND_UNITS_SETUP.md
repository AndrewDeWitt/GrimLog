# Mixed Wound Units Setup (Troubleshooting)

**Last Updated:** 2025-12-18  
**Status:** Complete

## Overview

This troubleshooting guide explains how to correctly represent **mixed wound profiles** in Grimlog (units where different models have different wound characteristics). It covers both:
- **composition-based mixed wounds** (encoded in `Datasheet.compositionData`)
- **wargear/loadout-based mixed wounds** (manually edited per model in the Unit Health Sheet)

## Table of Contents

- [When You Need This](#when-you-need-this)
- [How Mixed Wounds Work in Grimlog](#how-mixed-wounds-work-in-grimlog)
- [Fix Path A: Datasheet compositionData](#fix-path-a-datasheet-compositiondata)
- [Fix Path B: Manual MAX WOUNDS edits (wargear)](#fix-path-b-manual-max-wounds-edits-wargear)
- [Fix Path C: Repair with Sync Models](#fix-path-c-repair-with-sync-models)
- [Testing Checklist](#testing-checklist)
- [Related Documentation](#related-documentation)

## When You Need This

You need mixed wound support when a unit’s models do not share the same Wounds characteristic, for example:
- **Hyperadapted Raveners**: 1 Prime (6W) + 4 Raveners (3W) = 18W total
- **Bladeguard Veterans**: leader vs regular models can differ (depending on datasheet encoding)
- **Loadout-based cases**: models with wargear that modifies wounds (e.g., relic shields)

## How Mixed Wounds Work in Grimlog

Grimlog represents per-model health with `UnitInstance.modelsArray` (a JSON string array of models):

```json
[
  { "role": "leader", "currentWounds": 6, "maxWounds": 6 },
  { "role": "regular", "currentWounds": 3, "maxWounds": 3 }
]
```

Important rules:
- `modelsArray` represents **surviving models only**
- `currentWounds` is clamped to `0 < currentWounds <= maxWounds`
- totals (`currentModels`, `currentWounds`) are recalculated from `modelsArray` when it is provided

## Fix Path A: Datasheet compositionData

### What compositionData Does

`Datasheet.compositionData` provides a *baseline* model list (roles, counts, wounds-per-model) so the server can initialize a correct `modelsArray` for mixed wound units.

### Required Format

```json
[
  { "role": "leader", "count": 1, "woundsPerModel": 6, "name": "Ravener Prime" },
  { "role": "regular", "count": 4, "woundsPerModel": 3, "name": "Ravener" }
]
```

### How to Update compositionData

Use one of:
- **Prisma Studio**: edit the `Datasheet` record’s `compositionData`
- **SQL**: set `compositionData` to the JSON string
- **Parsing/seed workflow**: update the datasheet import pipeline (preferred for bulk fixes)

## Fix Path B: Manual MAX WOUNDS edits (wargear)

Some mixed-wound scenarios are not encoded in `compositionData` because they depend on wargear choices (example: **relic shield**).

In the **Unit Health Sheet**:
1. Expand the unit
2. Open **INDIVIDUAL MODELS**
3. On the relevant model tile, use **MAX WOUNDS +** / **MAX WOUNDS −**

This persists to `modelsArray`, allowing “some models 3W, some models 4W” to be tracked correctly.

## Fix Path C: Repair with Sync Models

If you see obvious mismatch symptoms (common with legacy or partial initialization):
- `currentModels` is correct, but the per-model grid has fewer tiles
- `startingWounds` looks too low/high for the unit’s true profile

Use **Sync Models** in the Unit Health Sheet. Sync Models:
- rebuilds a baseline per-model list using `compositionData` (if present)
- fills/truncates to match `currentModels`
- recalculates `startingWounds` for mixed profiles when possible

## Testing Checklist

### 1) Verify Initialization

- Open a mixed-wound unit.
- Ensure the per-model grid shows the correct number of models.
- Ensure leader/regular max wounds match expectations (if `compositionData` is populated).

### 2) Verify Wargear-Based Mixed Wounds

- Pick one model and increase MAX WOUNDS by +1.
- Confirm the model tile shows the updated max.
- Confirm the unit total wounds reflect the change after refresh.

### 3) Verify Damage Distribution

- Apply enough total wound loss to remove regular models.
- Confirm that per-model removals behave as expected for your unit’s roles.

## Related Documentation

- [Unit Health Tracking Guide](../guides/UNIT_HEALTH_GUIDE.md) - How to use the Unit Health UI
- [Unit Health Sheet](../features/UNIT_HEALTH_SHEET.md) - Bottom-sheet UI and repair tooling
- [Per-Model Wound Tracking](../features/PER_MODEL_WOUND_TRACKING.md) - Per-model system details
- [Units API Endpoint](../api/UNITS_ENDPOINT.md) - Unit and per-model update endpoints

