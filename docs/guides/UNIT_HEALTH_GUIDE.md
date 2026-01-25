# Unit Health Tracking Guide

**Last Updated:** 2025-12-18  
**Status:** Complete  
**Version:** 4.32.4

## Overview

This guide explains how to use Grimlog's **Unit Health Sheet** (bottom sheet) to manually track and correct unit health during a game. This UI is designed for fast, touch-friendly corrections that complement voice-driven tracking.

## Table of Contents

- [Getting Started](#getting-started)
- [Attacker/Defender Tabs (Army Strength)](#attackerdefender-tabs-army-strength)
- [Modes: Phase Abilities vs All Units](#modes-phase-abilities-vs-all-units)
- [Managing Unit Health (Unit-Level)](#managing-unit-health-unit-level)
- [Individual Models (Per-Model)](#individual-models-per-model)
- [Mixed Wounds & Wargear (Max Wounds)](#mixed-wounds--wargear-max-wounds)
- [Repair: Sync Models](#repair-sync-models)
- [iPad Usage Tips](#ipad-usage-tips)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Getting Started

### Open the Unit Health Sheet

1. Start or join a game session.
2. Tap the **⚔ Unit Health** floating action button (bottom-right).

### What You’ll See

- **Top tabs**: **ATTACKER** / **DEFENDER** with army strength always visible.
- **Mode toggle**: **PHASE ABILITIES** / **ALL UNITS**
- A **unit grid** showing icon + health summary per unit.

## Attacker/Defender Tabs (Army Strength)

The Attacker/Defender tab header is designed to remain visible so you always have:
- **Army strength %**
- **Units / Models / Wounds** summary

Tap **ATTACKER** or **DEFENDER** to switch which army’s unit list and phase abilities you’re viewing.

## Modes: Phase Abilities vs All Units

### PHASE ABILITIES

Use this to see abilities relevant to the current phase. Abilities are filtered and labeled by:
- phase (e.g. `Command`, `Shooting`, `Fight`)
- timing notes (when available)
- reactive marker (opponent’s turn)

### ALL UNITS

Use this to manage unit health. Units render in a **dense grid** for iPad/tablet scanning.

## Managing Unit Health (Unit-Level)

### Expand a Unit

1. Tap a unit card to expand it.
2. Use the large buttons to adjust:
   - **MODELS**: `-1` / `+1`
   - **WOUNDS** (when applicable): `-1` / `+1`
   - **BATTLESHOCK** toggle
   - **DESTROY** (marks unit destroyed and sets totals to 0)

### Notes

- Updates are designed to feel **instant** (optimistic UI) with background server sync.
- Buttons auto-disable at bounds (can’t exceed starting values, can’t go below 0).

## Individual Models (Per-Model)

If the unit has per-model tracking (`modelsArray`), expanding a unit exposes **INDIVIDUAL MODELS**.

### Per-Model Grid

Models display as tiles in a responsive grid (uses horizontal space on iPad):
- role indicator (leader / special / regular)
- health bar + `current/max`
- **- / +** wound controls
- **✕** destroy model

## Mixed Wounds & Wargear (Max Wounds)

Some units can have mixed wound profiles due to wargear (example: **Wolf Guard Terminators** where a relic shield increases wounds).

Use **MAX WOUNDS** on a model tile:
- **MAX WOUNDS +** increases that model’s `maxWounds`
- **MAX WOUNDS −** decreases it (clamped to ≥ 1)

This updates `modelsArray` so the unit can correctly represent mixed wound profiles.

## Repair: Sync Models

If you see mismatches like:
- The unit says `6 models` but Individual Models shows fewer tiles
- Per-model tracking looks “wrong” after session creation/import

Tap **Sync Models** (shown when a mismatch is detected).

Sync Models:
- rebuilds a correct `modelsArray` baseline
- aligns it to the unit’s `currentModels`
- recalculates `startingWounds` for mixed profiles when possible

## iPad Usage Tips

- **Landscape**: best for scanning the unit grid and working in the per-model grid.
- **Portrait**: great for quick unit-level adjustments.
- Keep **ALL UNITS** open during active combat phases; switch to **PHASE ABILITIES** between actions.

## Troubleshooting

### “No units visible”

- Ensure armies were imported/selected for the session.
- Ensure you’re in an active session.

### “Individual Models is missing or shows the wrong number of models”

- Expand the unit → open **INDIVIDUAL MODELS** → tap **Sync Models** (if shown).

### “Mixed wounds are wrong (some models should have more wounds)”

- Use **MAX WOUNDS +** on the specific model tile(s) to represent wargear-based wound increases.

### “Buttons feel unresponsive”

- Expand the unit first (controls only exist inside expanded area).
- Refresh the page if network sync fails repeatedly.

## Related Documentation

- **[Unit Health Sheet](../features/UNIT_HEALTH_SHEET.md)** - Feature overview + architecture
- **[Unit Health Tracking System](../features/UNIT_HEALTH_TRACKING.md)** - System architecture
- **[Units API Endpoint](../api/UNITS_ENDPOINT.md)** - API reference for unit and per-model updates
- **[Mixed Wound Units Setup](../troubleshooting/MIXED_WOUND_UNITS_SETUP.md)** - Mixed wound troubleshooting and setup
