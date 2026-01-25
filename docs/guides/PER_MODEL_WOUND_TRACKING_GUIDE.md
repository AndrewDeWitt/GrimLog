# Per-Model Wound Tracking Guide

**Last Updated:** 2025-10-22  
**Status:** Complete

## Overview

This guide explains how to use Grimlog's per-model wound tracking system to manage individual models within your units, track special model roles (sergeants, heavy weapons), and leverage smart damage distribution during gameplay.

## Table of Contents

- [What is Per-Model Tracking?](#what-is-per-model-tracking)
- [Getting Started](#getting-started)
- [Using Voice Commands](#using-voice-commands)
- [Understanding the UI](#understanding-the-ui)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## What is Per-Model Tracking?

Per-model wound tracking allows you to see the health state of every individual model in a unit, not just the total. This is especially useful for:

- **Multi-wound models** (Terminators with 3W each)
- **Mixed loadouts** (Sergeant with plasma pistol, heavy bolter marine, regular troops)
- **Precise casualty tracking** (Which specific models were destroyed)
- **Tactical decisions** (Knowing which models are wounded vs healthy)

### Example

**Without Per-Model Tracking:**
```
Terminators: 15/18 wounds remaining
```
You know total wounds but not which models are damaged.

**With Per-Model Tracking:**
```
Terminators: 6 models
├── ⭐ Sergeant: 3/3W (healthy)
├── 🔫 Heavy Weapon: 0/3W (destroyed)
├── ◆ Regular: 3/3W (healthy)
├── ◆ Regular: 2/3W (wounded)
├── ◆ Regular: 1/3W (critical)
└── ◆ Regular: 3/3W (healthy)
```
You see exactly which models are damaged and can make informed decisions.

## Getting Started

### Step 1: Ensure Army List Has Composition

When parsing your army list, the system attempts to extract model roles automatically.

**Supported Formats:**
- "1 Sergeant + 9 Intercessors"
- "Terminator Squad (1 Heavy Flamer)"
- "10 Tactical Marines (Sergeant, Heavy Bolter)"

**Manual Entry:**
If auto-detection fails, units default to all "regular" models (still functional).

### Step 2: Create Game Session

1. Start new game session
2. Select your army
3. Units automatically initialize with per-model tracking

### Step 3: Open the Unit Health Sheet

1. Tap the **⚔ Unit Health** floating action button (bottom-right)
2. Switch to **ALL UNITS**
3. Expand any unit and open **INDIVIDUAL MODELS**

## Using Voice Commands

### Basic Damage (Smart Distribution)

**Generic Wound Allocation:**
```
"My Terminators took 6 wounds"
```

**What Happens:**
1. AI calls `update_unit_health` with 6 wounds
2. System distributes damage smartly:
   - Finishes off already-wounded models first
   - Targets regular models before sergeant
   - Protects special weapon and heavy weapon models
3. Timeline shows: "regular model destroyed, regular model destroyed"
4. UI updates to show new model states

**Example Result:**
- 2 regular Terminators destroyed (6 wounds total)
- Sergeant and heavy weapon untouched

### Role-Specific Targeting

**Target Sergeant:**
```
"Terminator Sergeant took 3 wounds"
```
→ AI adds `target_model_role="sergeant"` parameter  
→ Only sergeant takes damage

**Remove Special Model:**
```
"Lost my heavy bolter guy"
```
→ AI interprets as `models_lost=1, target_model_role="heavy_weapon"`  
→ Heavy weapon model removed

**Target Regular Models:**
```
"Regular marine died"
```
→ AI targets regular role specifically

### Model Loss vs Wound Loss

**Entire Models Removed:**
```
"My Intercessors lost 3 models"
```
→ Removes 3 complete models (regulars first)

**Wounds Distributed:**
```
"My Intercessors took 6 wounds"
```
→ Distributes 6 wounds across models (may destroy multiple if 1W each)

**Combined:**
```
"My Terminators lost 2 models and the sergeant took 3 wounds"
```
→ AI calls tool twice or uses both parameters

## Understanding the UI

### Model Health Grid

**Visual Elements:**

**Role Badges:**
- ⭐ **Sergeant/Leader** - Squad leader (orange border)
- 🔫 **Heavy Weapon** - Lascannon, heavy bolter, etc. (red border)
- ⚡ **Special Weapon** - Plasma gun, meltagun, etc. (amber border)
- ◆ **Regular** - Standard troops (grey border)

**Health Colors:**
- **Green (█)**: Healthy (>66% wounds)
- **Amber (▓)**: Wounded (33-66% wounds)
- **Red (▒)**: Critical (<33% wounds)
- **Grey (░)**: Destroyed (0 wounds)

### Display Modes

**Compact View:**
```
[█][█][▓][▓][█][█] 6 models
```
Small icons in a row, quick overview.

**Medium View (Default):**
```
SQUAD COMPOSITION:
⭐ SERGEANT (1)
┌──┐
│█ │ 3/3W
└──┘

◆ REGULAR (5)
┌──┐┌──┐┌──┐┌──┐┌──┐
│█ ││█ ││▓ ││▓ ││█ │
└──┘└──┘└──┘└──┘└──┘
```
Grouped by role with individual health bars.

**Grid View (Many Models):**
```
┌─┐┌─┐┌─┐┌─┐┌─┐
│1││2││3││4││5│
└─┘└─┘└─┘└─┘└─┘
┌─┐┌─┐┌─┐┌─┐┌─┐
│6││7││8││9││10│
└─┘└─┘└─┘└─┘└─┘
```
Large grid for many identical models.

### Unit Card Sections

**Header:**
- Unit name
- Attached characters (if any): "⭐ Captain 5/5W"
- Status badges (half strength, battle-shocked)

**Health Bars:**
- Primary metric (models or wounds)
- Secondary metric if applicable

**Model Breakdown:**
- Only shown for multi-model units
- Grouped by role
- Color-coded health states

## Advanced Features

### Protecting Specific Models

The smart distribution algorithm automatically protects:
1. Sergeant (highest priority)
2. Heavy weapon bearer
3. Special weapon bearer

**Why?** In practice, players often preserve special models as long as possible.

**Override:** Use role-specific voice commands to target protected models directly.

### Tracking Damaged Models

**Scenario:** Terminators have taken damage over multiple rounds.

**System Behavior:**
- Remembers which models are wounded
- Finishes off wounded models before damaging healthy ones
- Realistic casualty simulation

**Example:**
```
Round 1: "Terminators took 4 wounds"
→ Model 1: 3→0 (destroyed), Model 2: 3→2 (wounded)

Round 2: "Terminators took 3 wounds"
→ Model 2: 2→0 (destroyed, was already wounded)
→ Model 3: 3→2 (now wounded)
```

### Multiple Models of Same Type

**Supported:** Duplicate units (e.g., 2 Blood Claws squads)

**Voice Targeting:**
```
"My first Blood Claws took damage"
→ AI uses context to disambiguate

"Blood Claws Alpha took 6 wounds"
→ Name distinction helps
```

**Best Practice:** Give units unique names in army builder (e.g., "Blood Claws Alpha", "Blood Claws Bravo")

## Troubleshooting

### Models Not Showing

**Problem:** Unit card doesn't show model breakdown.

**Solutions:**
1. **Check model count**: Single-model units don't show grid
2. **Apply damage**: Some units initialize modelsArray on first damage
3. **Create new session**: Existing sessions may use legacy tracking
4. **Verify army parsing**: Check if composition was extracted from list

### Damage Distribution Seems Wrong

**Problem:** Wrong models were damaged.

**Check:**
1. **Review timeline**: Shows distribution log ("regular model destroyed, sergeant took 2 wounds")
2. **Verify voice command**: Did you specify a role?
3. **Check model states**: UI shows current health of each model

**Common Cause:** AI interpreted ambiguous command differently.

**Solution:** Be specific with voice commands or manually adjust in UI.

### Casualty Section Shows Healthy Units

**Problem:** All units appear in casualty list.

**Solution:** This was a bug - fixed in latest version. Refresh page to see fix.

### Character Attachments Not Showing

**Problem:** Configured attachments but characters don't show with units.

**Cause:** Viewing old session created before attachments were configured.

**Solution:** Create NEW game session. Attachments only apply to new sessions.

### Multiple Characters of Same Name

**Problem:** Two Neurotyrants both set to attach to same unit, one disappears.

**Solution:** This was a bug - fixed. System now uses unit IDs, not names. Each character configures independently.

## Best Practices

### Voice Command Clarity

**Good:**
- "My Terminators took 6 wounds" (clear, specific)
- "Sergeant took 3 wounds" (role specified)
- "Lost the heavy bolter marine" (role specified)

**Avoid:**
- "Took damage" (too vague - which unit?)
- "Lost 3" (3 models or 3 wounds?)
- "Damaged" (who? how much?)

### Army List Organization

**Recommended:**
- Use unique names for duplicate units ("Blood Claws Alpha", "Blood Claws Bravo")
- Include model loadouts in list (helps parser detect roles)
- Configure character attachments before first game

### UI Usage

**Compact View:**
- Quick overview of many units
- Good for large armies (10+ units)
- Less detail but faster scanning

**Medium View:**
- Full model breakdown
- See individual health states
- Best for tactical detail

## Related Documentation

- [Feature: Per-Model Wound Tracking](../features/PER_MODEL_WOUND_TRACKING.md) - Technical architecture
- [Guide: Character Attachments](CHARACTER_ATTACHMENTS_GUIDE.md) - Character attachment system
- [API: Update Unit Health](../api/UNITS_ENDPOINT.md) - API reference for unit updates
- [Quick Start](../QUICKSTART.md) - General Grimlog usage

