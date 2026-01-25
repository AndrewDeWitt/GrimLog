# Session Setup Guide

**Last Updated:** 2025-12-13  
**Status:** Complete  
**Version:** 4.26.0

## Overview

This guide explains how to create and set up game sessions in Grimlog. Session creation includes first player selection (roll-off winner), deployment type configuration, both armies, and optional **Battle Ready** attachment configuration for the attacker. The system automatically initializes all units with full health tracking and proper turn order for the entire battle.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup](#step-by-step-setup)
- [What Happens During Initialization](#what-happens-during-initialization)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

---

## Quick Start

**TL;DR:** Navigate to Sessions → NEW BATTLE → Select both armies → START BATTLE

```
1. Click SESSIONS from main dashboard
2. Click "⚔ NEW BATTLE" button
3. Select Attacker army from dropdown (red theme)
4. Select Defender army from dropdown (green theme)
5. (Optional) Configure Battle Ready attachments (preset + tweaks)
6. Choose deployment type
7. Set turn order (who goes first)
8. Click "⚔ START BATTLE"
9. Redirected to main dashboard with session active
```

---

## Prerequisites

### Required Before Creating a Session

**Minimum: 2 Armies**
You need at least 2 armies created in the system:
- One for Attacker
- One for Defender

**How to Create Armies:**
1. Go to `/armies` page
2. Click "NEW ARMY"
3. Upload army list (image, PDF, or text)
4. Review and save

**Note:** Each army should have units with model counts for proper health tracking.

---

## Step-by-Step Setup

### 1. Navigate to Sessions Page

From the main dashboard, click the **SESSIONS** button in the top-right corner.

### 2. Start New Battle

Click the **"⚔ NEW BATTLE"** button to open the session setup page.

### 3. Select Attacker Army

**Army Selection:**
- Click the dropdown under "ATTACKER" (red border and text)
- Select the attacker army from the list
- Each army shows: Name - Player - (Faction) - Points
- Section uses red theme (borders, text, accents)

**Army Preview:**
After selection, you'll see:
```
Army: Blood Angels 1st Company
Commander: John Doe
Faction: Space Marines
Points: 1000
Units: 8
```

### 3b. (Optional) Battle Ready (Attachments)

If your attacker army contains CHARACTER units, the setup page will show a **BATTLE READY (ATTACHMENTS)** section:

- Select an **Attachment Preset** (or keep “Use army saved attachments”)
- Optionally tweak each character’s attachment target for this specific battle

These choices are applied **at session initialization**.

### 4. Select Defender Army

**Army Selection:**
- Click the dropdown under "DEFENDER" (green border and text)
- Select the defender army from the list
- Same army cannot be selected twice (validation)
- Section uses green theme (borders, text, accents)

**Army Preview:**
After selection, you'll see defender army details.

### 5. Select Deployment Type

**Battlefield Configuration:**
- Choose your deployment map from the dropdown
- Options: Crucible of Battle, Hammer and Anvil, Dawn of War, etc.
- Determines objective placement and deployment zones

### 6. Set Turn Order (Roll-Off Result)

**First Player Selection:**

After deployment, you perform a roll-off to determine who goes first. Record the result:

- **"ATTACKER GOES FIRST"** (red theme) - Select if attacker won the roll-off
- **"DEFENDER GOES FIRST"** (green theme) - Select if defender won the roll-off

**Important:** This determines who takes the first turn each round for the entire game. The same player goes first every round.

```
🎲 TURN ORDER (ROLL-OFF)

● ATTACKER GOES FIRST    (red highlight)
  Attacker won the roll-off or chose to go first

○ DEFENDER GOES FIRST    (green theme)
  Defender won the roll-off or chose to go first

Note: Determines who takes the first turn each round. 
The same player goes first every round.
```

### 7. Review Battle Setup

Before creating, verify:
- ✅ Both armies selected
- ✅ Correct factions
- ✅ Unit counts shown
- ✅ Points match your mission

**Note:** Once both armies are selected, you're ready to start the battle. The system will automatically initialize all units with full health tracking.

### 8. Start Battle

Click **"⚔ START BATTLE"** button.

**What Happens:**
1. Session created in database with first player setting
2. All player units initialized with full health
3. All opponent units initialized with full health
4. Unit instances linked to session
5. Timeline event created
6. Session ID saved to localStorage
7. Redirect to main dashboard

**Success Message:**
```
✓ Battle initialized successfully!
  Player: 8 units | Opponent: 10 units
```

### 9. Begin Playing

You're now on the main dashboard with an active session:
- Click **START** to begin audio capture
- Click **UNIT HEALTH** tab to see all units
- Say "My Terminators lost 2 models" to track damage via voice
- Or use manual controls on unit cards

### 10. Using Turn Order Controls

**Round/Turn Selector:**

The dashboard displays current round and turn in the header:

```
┌────────────────────────────────────┐
│ ROUND 1 - ATTACKER (1ST)      ▼   │  ← Click to open dropdown
└────────────────────────────────────┘
```

**How to Use:**
1. Click the round selector to open dropdown
2. All 10 options shown (Rounds 1-5, Attacker and Defender)
3. Select any round/turn to jump directly to it
4. UI updates instantly (optimistic)

**Color Coding:**
- **Red theme** - Attacker role (borders, text, accents)
- **Green theme** - Defender role (borders, text, accents)
- **Brighter color** - Current turn
- **Amber border** - Currently selected

**Voice Commands:**
- Say "End of my turn" - AI automatically switches turns
- Say "Start round 3" - Jumps to Round 3, Attacker
- System automatically advances rounds when defender finishes

**Turn Position:**
- **(1st)** - Top of round, attacker goes first
- **(2nd)** - Bottom of round, defender goes second

---

## What Happens During Initialization

### Automatic Unit Instance Creation

For each unit in both armies:

```javascript
// For a Terminator Squad with 5 models, 3 wounds each
{
  unitName: "Terminator Squad",
  owner: "player",
  datasheet: "Terminator Squad",
  startingModels: 5,
  currentModels: 5,
  startingWounds: 15,    // 5 models × 3 wounds
  currentWounds: 15,
  isDestroyed: false,
  isBattleShocked: false,
  activeEffects: []
}
```

### Character Attachments (Battle Ready)

During initialization, Grimlog optionally sets attachments for **character** unit instances:

- If the session creation request includes `attackerAttachments`, those are applied.
- Otherwise Grimlog falls back to the army's saved `characterAttachments`.

Character unit instances receive:

- `attachedToUnit: "<Target Unit Name>"` (or `null`)

### Timeline Event

Initial event created:
```
Battle initialized: Blood Angels 1st Company vs Hive Fleet Leviathan
```

### Database Operations

Performed in sequence:
1. Create `GameSession` record
2. Fetch both army lists with units
3. Fetch unit templates for wound calculations
4. Create `UnitInstance` for each player unit
5. Create `UnitInstance` for each opponent unit
6. Create `TimelineEvent` for initialization
7. Return session + statistics

**Time:** ~500-1000ms depending on unit count

---

## Troubleshooting

### "Insufficient Armies" Error

**Problem:** You see "You need at least 2 armies to start a battle"

**Solution:**
1. Go to `/armies` page
2. Create at least 2 armies
3. Return to `/sessions/new`

### "Failed to create session" Error

**Possible Causes:**
- Selected same army for both players
- Army has no units
- Database connection issue

**Solution:**
1. Verify armies are different
2. Check armies have units (go to army detail page)
3. Check console for detailed error
4. Try refreshing the page

### Units Not Showing in Unit Health View

**Problem:** Unit Health tab shows "NO UNITS INITIALIZED"

**Possible Causes:**
- Session created before v2.4.0 (units not auto-initialized)
- Armies had no units when session created

**Solution:**
1. End current session
2. Add units to armies
3. Create new session with armies
4. Units will auto-initialize

### Session Not Resuming

**Problem:** Main dashboard doesn't show active session

**Possible Causes:**
- LocalStorage cleared
- Session expired/deleted
- Browser changed

**Solution:**
1. Go to `/sessions` page
2. Find your session
3. Click "CONTINUE" button
4. Or create a new session

---

## Best Practices

### Before Battle
- ✅ Create both armies with full unit lists
- ✅ Verify unit model counts are accurate
- ✅ Test army import with a sample list first

### During Setup
- ✅ Double-check army selection
- ✅ Review unit counts in preview
- ✅ Ensure correct factions selected

### During Battle
- ✅ Use voice commands for quick updates
- ✅ Switch to Unit Health view to see full state
- ✅ Manually correct if voice misunderstood
- ✅ Check for half-strength warnings in Command Phase

---

## Related Documentation

- **[Unit Health Tracking Feature](../features/UNIT_HEALTH_TRACKING.md)** - Unit health system overview
- **[Session Management Feature](../features/SESSION_MANAGEMENT.md)** - How sessions work
- **[Units API](../api/UNITS_ENDPOINT.md)** - Technical API reference
- **[Sessions API](../api/SESSIONS_ENDPOINT.md)** - Session endpoints (includes `attackerAttachments`)


