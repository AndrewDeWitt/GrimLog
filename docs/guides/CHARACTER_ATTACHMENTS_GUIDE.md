# Character Attachments Guide

**Last Updated:** 2025-12-14  
**Status:** Complete

## Overview

This guide explains how to configure and use character attachments in Grimlog. Character attachments allow you to pre-configure which characters attach to which units (following Warhammer 40K 10th Edition rules), apply matchup-specific presets during session setup, and have characters display with the right context during gameplay while maintaining separate tracking.

**New in v4.31.0:** Full-page attachment editor with improved UX, squad numbering for duplicate units, and ID-based storage for reliable differentiation.

## Table of Contents

- [What are Character Attachments?](#what-are-character-attachments)
- [Configuring Attachments](#configuring-attachments)
- [Handling Duplicate Units](#handling-duplicate-units)
- [Battle Ready Presets](#battle-ready-presets)
- [Using Attachments in Game](#using-attachments-in-game)
- [Voice Commands](#voice-commands)
- [Visual Indicators](#visual-indicators)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## What are Character Attachments?

In Warhammer 40K 10th Edition, CHARACTER units can attach to other units. Grimlog's character attachment system allows you to:

- **Pre-configure** which characters attach to which units in your army builder
- **Display together** during gameplay (character shown with parent unit)
- **Track separately** for wounds and destruction
- **Target independently** with voice commands

### Benefits

✅ **Cleaner UI** - Characters don't clutter the unit list  
✅ **Easier Tracking** - See character health alongside their unit  
✅ **Realistic Gameplay** - Matches 10th Edition rules  
✅ **Voice Clarity** - System understands "Captain took 3 wounds" vs "Intercessors took 3 wounds"

### Example

**Without Attachments:**
```
YOUR FORCES:
├── Captain (1 model)
├── Librarian (1 model)
├── Intercessor Squad Alpha (10 models)
├── Intercessor Squad Bravo (10 models)
└── Tactical Squad (10 models)
```
5 separate unit cards, harder to scan.

**With Attachments:**
```
YOUR FORCES:
├── Intercessor Squad Alpha (10 models) + ⭐ Captain 5/5W
├── Intercessor Squad Bravo (10 models) + ⭐ Librarian 4/4W
└── Tactical Squad (10 models)
```
Characters shown with their units, cleaner display.

## Configuring Attachments

### Step 1: Navigate to Attachments Page

1. Go to **Armies** page from main menu
2. Select the army you want to configure
3. Click the **"⭐ ATTACHMENTS"** button in the toolbar
4. You'll be taken to the full-page attachment editor (`/armies/[id]/attachments`)

**Page Layout:**
- **Sticky Header:** Army name, faction, and back navigation
- **Content:** Character cards with unit selectors
- **Sticky Footer:** Save state indicator and action buttons

### Step 2: Identify Character Units

The attachment page shows all CHARACTER units in your army:

**Character card display:**
- Unit icon and name
- Points cost badge
- Model count
- "ATTACH TO UNIT" dropdown

**Examples:**
- ⭐ Captain
- ⭐ Lieutenant  
- ⭐ Librarian
- ⭐ Chaplain
- ⭐ Hive Tyrant
- ⭐ Neurotyrant

### Step 3: Select Attachment Target

**For each character unit:**

1. Find the **"ATTACH TO UNIT"** dropdown
2. Click to open the searchable dropdown
3. Select target unit from the list
   - Only shows non-character units
   - Includes model count and points for each option
   - Duplicate units show squad numbers (see [Handling Duplicate Units](#handling-duplicate-units))
4. Click **"CLEAR"** to remove an attachment

**Example Card:**
```
┌─────────────────────────────────────────┐
│ ◆ Arjac Rockfist                 105pts │
│   Arjac Rockfist • 1 models             │
│   ───────────────────────────────────── │
│   ATTACH TO UNIT                [CLEAR] │
│   ┌──────────────────────────────────┐  │
│   │ ◆ Wolf Guard Terminators (Squad 1) ▼│
│   └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Step 4: Save Attachments

**Option 1: Save only**
1. Click **"SAVE"** button in the sticky footer
2. Wait for confirmation message
3. Continue editing if needed

**Option 2: Save and return**
1. Click **"SAVE & CLOSE"** button
2. Attachments are saved and you return to army detail page

**Footer indicators:**
- 🟠 "Unsaved changes" - You have pending changes
- "All changes saved" - No pending changes

### Step 5: Verify Configuration

**On the attachments page:**
- Each character card shows the currently selected target unit
- "Attached to: [Unit Name]" confirmation below dropdown

**On the army detail page:**
- Character units show "Attached To: ⭐ [Unit Name]"
- Target units show "Attached Characters: ⭐ [Character Name]"

## Handling Duplicate Units

### The Problem

Many army lists include multiple units with the same datasheet:
- 2x Wolf Guard Terminators
- 3x Intercessor Squad
- 2x Hive Tyrant

Without differentiation, it's impossible to know which specific unit a character is attached to.

### The Solution: Squad Numbering

Grimlog automatically assigns squad numbers to duplicate units:

```
Wolf Guard Terminators (Squad 1) - 10 models • 170pts
Wolf Guard Terminators (Squad 2) - 5 models • 170pts
```

**How it works:**
- Units sharing the same datasheet get numbered sequentially
- Numbers are based on the order units appear in your roster
- Only units with duplicates show squad numbers
- Unique units display without numbers

### Dropdown Display

When selecting attachment targets, the dropdown shows:

```
┌────────────────────────────────────────┐
│ Search units...                        │
├────────────────────────────────────────┤
│ ◆ Intercessor Squad (Squad 1)          │
│   10 models • 200pts                   │
│ ◆ Intercessor Squad (Squad 2)          │
│   5 models • 100pts                    │
│ ◆ Tactical Squad                       │
│   10 models • 150pts               ✓   │
└────────────────────────────────────────┘
```

### ID-Based Storage

**Under the hood (v4.31.0+):**
- Attachments are now stored by unit ID instead of name
- This ensures correct linking even with duplicate unit names
- Legacy name-based attachments are auto-migrated on load

**Benefits:**
- ✅ Reliable differentiation of duplicate units
- ✅ No accidental attachment swaps
- ✅ Consistent behavior across presets

## Using Attachments in Game

### Creating Session with Attachments

**Important:** Attachments only apply to **new sessions**.

1. **End current session** if active (hamburger menu → End Game)
2. **Create new session** (hamburger menu → New Game)
3. **Select your army** (the one with configured attachments)
4. (Optional) choose a **Battle Ready preset** and tweak attachments
5. System applies attachments during initialization

## Battle Ready Presets

Grimlog supports matchup-driven attachment loadouts via **Attachment Presets**:

- **Army-saved attachments**: your baseline mapping stored on the army.
- **Presets**: named mappings you can select and tweak per battle (e.g., `vs_elite`, `vs_horde`).

### Where to use presets

- **Army Detail (`/armies/[id]`)**: use **⭐ BATTLE READY** to create/edit presets and set a default.
- **Session Setup (`/sessions/new`)**: select a preset (or use army-saved attachments) and tweak before starting the battle.

### Viewing Attached Characters

**Navigate to Unit Health Tab:**

1. Click **"⚔ UNIT HEALTH"** tab
2. Find the parent unit
3. Character displays below unit name

**Example Display:**
```
┌────────────────────────────────────┐
│ ⚔ INTERCESSOR SQUAD ALPHA         │
│   ⭐ Captain Aethon 5/5W           │ ← Attached character
│                                    │
│ ⚠ HALF STRENGTH                   │
│                                    │
│ MODELS: ████░░░░░░ 5/10           │
│ TOTAL WOUNDS: 10/20                │
│                                    │
│ SQUAD COMPOSITION:                 │
│ ◆ REGULAR (5)                     │
│ [█][█][█][█][█]                   │
└────────────────────────────────────┘
```

**Key Points:**
- Character health is tracked separately (5/5W)
- Unit models are tracked independently
- Character attachments are applied at session start (from battle-ready selection or army-saved)

### Character Health States

**Healthy:**
```
⭐ Captain Aethon 5/5W
```
Green text, full wounds.

**Wounded:**
```
⭐ Captain Aethon 2/5W
```
Amber text, reduced wounds.

**Destroyed:**
```
⭐ Captain Aethon ✕
```
Red text, cross indicator, greyed out.

## Voice Commands

### Targeting the Unit

**Damage Unit Models Only:**
```
"My Intercessors took 6 wounds"
```

**What Happens:**
- AI recognizes "Intercessors" as the unit
- Damage applies to Intercessor models only
- Captain (if attached) is NOT damaged
- Smart distribution across models

**Timeline Shows:**
```
"Intercessors: 3 regular models destroyed - 7/10 models remaining"
```

### Targeting the Character

**Damage Character Only:**
```
"Captain took 3 wounds"
```

**What Happens:**
- AI recognizes "Captain" as separate unit
- Damage applies to Captain only
- Intercessors are NOT damaged

**Timeline Shows:**
```
"Captain: took 3 wounds (2/5 remaining)"
```

### Specific Targeting

**Be Explicit:**
```
"Captain Aethon took 4 wounds"
```
Uses character's full name for clarity.

**Attachment Context:**
```
"Captain attached to Intercessors took 3 wounds"
```
AI understands this targets the Captain, not the unit.

### Destruction

**Character Destroyed:**
```
"Lost the Captain"
or
"Captain is destroyed"
```

**Result:**
- Captain marked as destroyed
- Still shows with parent unit (greyed out)
- Intercessors unaffected

## Visual Indicators

### Army Builder

**Character Unit Appearance:**
- Gold/brass border (different from regular units)
- ⭐ Star badge before name
- "ATTACH TO UNIT:" dropdown visible
- Shows current attachment below dropdown

**Target Unit Appearance:**
- Standard border
- "ATTACHED CHARACTERS:" section shows attached characters
- Lists all characters attached to this unit

### In-Game Display

**Compact View:**
```
┌──────────────────────────────┐
│ ⚔ Intercessors +1⭐         │ ← Indicator
└──────────────────────────────┘
```

**Medium View:**
```
┌────────────────────────────────────┐
│ ⚔ INTERCESSORS ALPHA              │
│ ┌──────────────────────────────┐  │
│ │ ⭐ Captain Aethon 5/5W        │  │ ← Full character display
│ └──────────────────────────────┘  │
└────────────────────────────────────┘
```

## Troubleshooting

### Character Attachments Not Showing in Game

**Problem:** Configured attachments in army builder, but characters don't appear with units in game.

**Solution:**
1. Verify you clicked "💾 SAVE CHARACTER ATTACHMENTS"
2. **Create NEW game session** (attachments only apply to new sessions)
3. Old sessions will NOT retroactively apply attachments

**Why?** Attachments are set during session creation, not updated afterward.

### Duplicate Characters Overwriting Each Other

**Problem:** Have 2 Neurotyrants, both trying to attach to different units, but only one saves.

**Solution:** Fixed in v4.31.0. System now uses unique unit IDs for both characters and target units.

**To verify fix:**
1. Navigate to attachments page (`/armies/[id]/attachments`)
2. Each duplicate character shows independently with squad numbers
3. Configure each to different targets
4. Save - all attachments persist correctly

### Can't Tell Which Duplicate Unit is Selected

**Problem:** Have multiple Wolf Guard Terminators, can't tell which one the character is attached to.

**Solution:** v4.31.0 adds squad numbering for duplicate units.

**What you'll see:**
- Dropdown shows "Wolf Guard Terminators (Squad 1)", "(Squad 2)", etc.
- Each squad includes model count and points for additional differentiation
- Selected unit displays with squad number in the attachment confirmation

### Character Still Appears in Main Unit List

**Problem:** Character shows both attached AND as separate unit card.

**Cause:** Viewing old session created before attachments were configured.

**Solution:** Create new session with the army that has configured attachments.

### Can't Find Character Dropdown

**Problem:** Unit doesn't show "ATTACH TO UNIT:" dropdown.

**Possible Causes:**
1. **Not a character**: Unit must have CHARACTER keyword
2. **No target units**: Need at least one non-character unit in army
3. **Parsing issue**: Character keyword may not have been extracted

**Check:**
- Look for ⭐ star badge on unit
- Verify unit has CHARACTER keyword in parsed data
- Re-parse army list if needed

### Wrong Unit Receives Damage

**Problem:** Said "Intercessors took damage" but Captain was damaged instead.

**Unlikely:** AI is trained to distinguish unit vs character.

**If it happens:**
1. Check timeline for what AI interpreted
2. Be more specific: "Intercessor models took 6 wounds"
3. Report for AI training improvement

## Best Practices

### Army Configuration

**DO:**
- ✅ Configure all character attachments before first game
- ✅ Use descriptive unit names (e.g., "Intercessor Squad Alpha")
- ✅ Save attachments after each change
- ✅ Verify attachments show on both character and target unit

**DON'T:**
- ❌ Leave characters unattached if you intend to attach them
- ❌ Forget to save after configuration
- ❌ Assume old sessions will update automatically

### During Gameplay

**DO:**
- ✅ Be specific when targeting: "Captain took 3 wounds" or "Intercessors took 6 wounds"
- ✅ Check unit card to verify which unit was affected
- ✅ Use character names for clarity

**DON'T:**
- ❌ Say "unit took damage" without specifying which unit
- ❌ Assume damage to unit includes character (they're separate)

### Session Management

**DO:**
- ✅ Create new session when you change character attachments
- ✅ End session before creating new one with same army

**DON'T:**
- ❌ Expect old sessions to reflect new attachment configuration
- ❌ Manually move characters during game (configure in army builder)

## Advanced Use Cases

### Multiple Characters on One Unit

**Supported:** Yes! Multiple characters can attach to same unit.

**Example:**
```
Captain → Intercessor Squad
Apothecary → Intercessor Squad
```

**Display:**
```
┌────────────────────────────────────┐
│ ⚔ INTERCESSOR SQUAD               │
│   ⭐ Captain 5/5W                  │
│   ⭐ Apothecary 4/4W               │
│                                    │
│ MODELS: ██████████ 10/10          │
└────────────────────────────────────┘
```

### Changing Attachments Mid-Campaign

**Scenario:** Want to re-attach Captain to different unit.

**Steps:**
1. Go to army builder
2. Change Captain's attachment dropdown
3. Save
4. **Important:** Create NEW session for change to apply

**Note:** Cannot change attachments during active session.

### Detaching Characters

**To remove attachment:**
1. Open army builder
2. Set character dropdown to "-- No Attachment --"
3. Save

**Result:** Character will appear as separate unit in new sessions.

## Related Documentation

- [Feature: Army Register Tactics & Battle Ready](../features/ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md) - High-level behavior and data flow
- [Feature: Per-Model Wound Tracking](../features/PER_MODEL_WOUND_TRACKING.md) - Overall system architecture
- [Guide: Per-Model Wound Tracking](PER_MODEL_WOUND_TRACKING_GUIDE.md) - Using per-model features
- [Quick Start: Per-Model + Characters](../../QUICK_START_PER_MODEL_CHARACTERS.md) - Quick reference
- [API: Sessions Unit Endpoints](../api/UNITS_ENDPOINT.md) - Technical API details
- [API: Sessions Endpoint](../api/SESSIONS_ENDPOINT.md) - Session creation with optional `attackerAttachments`
- [API: Army Attachment Presets Endpoint](../api/ARMY_ATTACHMENT_PRESETS_ENDPOINT.md) - Preset CRUD API

