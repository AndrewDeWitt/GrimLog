# Unit Management View User Guide (Deprecated)

> **⚠️ DEPRECATED**
> This guide describes the older Unit Management View (v4.5.0) layout.
> The current unit UI is the **Unit Health Sheet** (bottom sheet) and is documented here:
> - [Unit Health Tracking Guide](UNIT_HEALTH_GUIDE.md)
> - [Unit Health Sheet](../features/UNIT_HEALTH_SHEET.md)

**Last Updated:** 2025-12-18  
**Status:** Deprecated  
**Version:** 4.5.0

## Overview

The Unit Management View is Grimlog's streamlined interface for tracking and managing all units in your Warhammer 40K battles. The view features a unified design with expandable inline controls, eliminating the need for separate management screens or complex navigation.

With a single global toggle and click-to-expand unit cards, you can quickly access phase abilities or dive into detailed unit management—all without leaving the main view.

## Table of Contents

- [Opening the Unit View](#opening-the-unit-view)
- [Global Toggle](#global-toggle)
- [Army Health Summary](#army-health-summary)
- [Phase Abilities View](#phase-abilities-view)
- [All Units View](#all-units-view)
- [Expandable Unit Controls](#expandable-unit-controls)
- [Per-Model Health Tracking](#per-model-health-tracking)
- [Manual Health Adjustments](#manual-health-adjustments)
- [Mobile Usage](#mobile-usage)
- [Tips & Tricks](#tips--tricks)
- [Common Workflows](#common-workflows)
- [Related Documentation](#related-documentation)

## Opening the Unit View

Click the **✕ UNIT HEALTH** button at the top of the screen (orange when active).

The view opens showing:
- Side-by-side comparison: Attacker (red) | Defender (green)
- Global toggle: PHASE ABILITIES / ALL UNITS
- Army health statistics for both sides
- Scrollable unit lists for each army

## Global Toggle

A single toggle at the top controls what both armies display:

```
┌─────────────────────────────────────────┐
│   [PHASE ABILITIES]  [ALL UNITS]        │
└─────────────────────────────────────────┘
```

**PHASE ABILITIES Mode:**
- Shows units with abilities relevant to the current game phase
- Displays phase context (e.g., "Round 1 • Command Phase")
- Shows up to 3 units with clickable ability chips
- Best for: Quick reference during active gameplay

**ALL UNITS Mode:**
- Shows complete list of active (non-destroyed) units
- Expandable cards for inline management
- Quick access to all unit controls
- Best for: Damage tracking, unit management

## Army Health Summary

Each column (Attacker/Defender) shows unified army statistics at the top:

**Attacker Column (Red Border):**
```
ATTACKER

ARMY STRENGTH              55 / 55 MODELS
[████████████████████████████] 100%

TOTAL WOUNDS                  225 / 225
[████████████████████████████]

        UNITS   MODELS   WOUNDS
          14      55      225

────────────────────────────────────────
```

**Defender Column (Green Border):**
```
DEFENDER

ARMY STRENGTH              40 / 40 MODELS
[████████████████████████████] 100%

TOTAL WOUNDS                  258 / 258
[████████████████████████████]

        UNITS   MODELS   WOUNDS
          15      40      258

────────────────────────────────────────
```

**Health Bar Colors:**
- **Green:** >66% strength remaining
- **Yellow:** 33-66% strength remaining  
- **Red:** <33% strength remaining

## Phase Abilities View

Toggle to **[PHASE ABILITIES]** to see phase-relevant units.

```
Round 1 • Command Phase

Arjac Rockfist              [Command]
🔮 Mock Ability • Click for details

Bjorn the Fell-Handed       [Command]
🔮 Mock Ability • Click for details

Blood Claws                 [Command]
🔮 Mock Ability • Click for details
```

**Features:**
- Shows current game round and phase context
- Lists units with relevant phase abilities
- Click ability chip for details (modal)
- Empty state: "No units with [Phase] phase abilities"
- *Note: Currently shows mock data; database integration pending*

## All Units View

Toggle to **[ALL UNITS]** for the complete unit management interface.

```
🟢 Arjac Rockfist       ▶    1/1    [✕]

🟢 Bjorn the Fell-Handed ▶    1/1    [✕]

🟢 Blood Claws          ▶   10/10   [✕]

🟡 Gladiator Lancer     ▶    1/1    [✕]

... (scrollable list continues)
```

**Unit Card Header (Collapsed):**
- **Health Icon:** 🟢 healthy / 🟡 damaged / 🔴 critical
- **Unit Name:** Full unit name
- **Expand Indicator:** ▶ collapsed / ▼ expanded
- **Model Count:** Current/starting models
- **Quick Destroy:** [✕] button (always visible)

**Actions:**
- **Click Unit Row** - Expands to show full controls
- **Click [✕]** - Instantly destroys unit (marks destroyed, sets models/wounds to 0)

**Features:**
- Shows all active (non-destroyed) units
- Color-coded health indicators
- Click any unit to expand inline controls
- Scrollable list within each army column

## Expandable Unit Controls

Click any unit row to expand inline management controls:

```
🟢 Blood Claws          ▼   10/10   [✕]
─────────────────────────────────────
│ MODELS              WOUNDS        │
│  [-1]  [+1]         [-1]  [+1]    │
│                                   │
│ [BATTLESHOCK]      [DESTROY]      │
│                                   │
│ [INDIVIDUAL MODELS]         ▶     │
└───────────────────────────────────┘
```

**Quick Controls:**

1. **Models Section:**
   - **[-1]** - Remove 1 model
   - **[+1]** - Add 1 model (restore if destroyed)
   - Disabled when at min (0) or max (starting count)

2. **Wounds Section** (only for multi-wound units):
   - **[-1]** - Remove 1 wound from unit
   - **[+1]** - Add 1 wound to unit
   - Disabled when at min (0) or max (starting wounds)

3. **Status Controls:**
   - **[BATTLESHOCK]** - Toggle battle-shocked status (gray when not shocked)
   - **[✓ SHOCKED]** - Toggle battle-shocked status (red when shocked)
   - **[DESTROY]** - Mark entire unit as destroyed

4. **Individual Models Section** (when available):
   - Expandable section for per-model management
   - Only shown when unit has `modelsArray` data
   - Click to reveal detailed model list

**Features:**
- ✅ Instant updates (changes apply immediately)
- ✅ No screen navigation required
- ✅ All controls in one place
- ✅ Click outside or on another unit to collapse

## Per-Model Health Tracking

For units with individual model data, expand the "INDIVIDUAL MODELS" section:

```
🟢 Blood Claws          ▼   10/10   [✕]
─────────────────────────────────────
│ ...                               │
│                                   │
│ [INDIVIDUAL MODELS]         ▼     │
│                                   │
│ 🟢 ⭐ Leader      [███████] 3/3 [-][+][✕] │
│ 🟢 ◆ Trooper     [███████] 3/3 [-][+][✕] │
│ 🟢 ◆ Trooper     [███████] 3/3 [-][+][✕] │
│ 🟡 ◆ Trooper     [████░░░] 2/3 [-][+][✕] │
│ 🔴 ◆ Trooper     [██░░░░░] 1/3 [-][+][✕] │
│ 🟢 ◆ Trooper     [███████] 3/3 [-][+][✕] │
│ ...                                       │
└───────────────────────────────────────────┘
```

**Per-Model Display:**
- **Status Icon:** 🟢 healthy / 🟡 damaged / 🔴 critical / 💀 dead
- **Role Icon:** ⭐ Leader / 🔫 Heavy Weapon / ⚡ Special Weapon / ◆ Trooper
- **Role Label:** Text description of role
- **Health Bar:** Visual wound representation (green/yellow/red)
- **Wound Count:** Current/max wounds (e.g., "2/3")
- **Controls:** [-] remove wound, [+] add wound, [✕] destroy model

**Role Color Coding:**
- **Amber border:** Leader/Sergeant
- **Red border:** Heavy Weapon
- **Orange border:** Special Weapon  
- **Gray border:** Regular Trooper

**Features:**
- ✅ Shows only alive models (dead models auto-hide)
- ✅ Real-time updates as wounds change
- ✅ Direct per-model control
- ✅ No modal required - all inline

## Manual Health Adjustments

### Quick Unit Adjustments

**For total wounds:**
1. Click unit to expand
2. Use **[-1]** / **[+1]** in WOUNDS section
3. System auto-distributes wounds across models

**For model count:**
1. Click unit to expand
2. Use **[-1]** / **[+1]** in MODELS section
3. Instantly updates unit strength

### Precision Model Control

**For specific model targeting:**
1. Click unit to expand
2. Click **[INDIVIDUAL MODELS]** to expand per-model list
3. Use [-] / [+] / [✕] on specific model
4. Changes apply immediately

**Example Workflow - Taking Casualties:**

Voice: "Blood Claws take 6 wounds"
- AI distributes automatically
- Unit updates in real-time

Manual (same result):
1. Click "Blood Claws" unit
2. Click [-1] in WOUNDS section 6 times
3. System kills 2 regular models (6W ÷ 3W per model)
4. Leader protected by smart distribution

**Example Workflow - Precision Attack:**

Voice: "Precision attack, 2 wounds on the sergeant"
- AI targets sergeant specifically

Manual (same precision):
1. Click "Blood Claws" unit
2. Click **[INDIVIDUAL MODELS]** ▶
3. Find ⭐ Leader row
4. Click [-] twice on that model
5. Sergeant takes 2 wounds specifically

## Mobile Usage

### Touch Optimization
- All buttons are touch-friendly (minimum tap target size)
- Expandable sections prevent accidental taps
- Swipe to scroll unit lists
- Two-column layout collapses to single column on phones

### Best Practices
- **Portrait mode:** Single column view for easier management
- **Landscape mode:** Two-column view for side-by-side comparison
- **Tablets:** Optimal experience with full two-column layout
- **Phones:** Works well, but landscape recommended for 10+ units

### Performance
- Optimized for tablets at 4+ feet viewing distance
- High contrast colors for outdoor/bright room play
- Instant feedback with optimistic updates
- No loading states or delays

## Tips & Tricks

### Fast Damage Entry
1. Click unit card to expand
2. Click [-1] on WOUNDS repeatedly
3. Done! Models auto-calculated

### Precision Attacks
1. Click unit to expand
2. Click [INDIVIDUAL MODELS] ▶
3. Find target model (e.g., Leader)
4. Click [-] on that specific model
5. Wounds applied precisely

### Quick Unit Destruction
- Click [✕] button directly from collapsed view
- No need to expand unit first
- Instant destruction confirmation

### Battle-Shocked Tracking
1. Expand unit card
2. Click [BATTLESHOCK]
3. Button turns red: [✓ SHOCKED]
4. Click again to remove status

### Toggle Between Views
- Use **[PHASE ABILITIES]** during active gameplay for quick reference
- Use **[ALL UNITS]** for damage tracking and management
- Toggle affects both armies simultaneously
- Your preference is remembered within the session

## Common Workflows

### Taking Casualties

**AI Voice Command:**
```
"My Intercessors take 4 wounds"
```
Result: AI distributes automatically, unit updates in real-time

**Manual Process:**
1. Click "Intercessors" unit
2. Click [-1] in WOUNDS section 4 times
3. Watch model count adjust automatically

### Destroying a Unit

**Quick Method:**
- Click [✕] button next to unit name
- Unit immediately marked destroyed

**Expanded Method:**
1. Click unit to expand
2. Click [DESTROY] button
3. Unit marked destroyed with 0 models/wounds

### Restoring Models

**Scenario:** Reanimation Protocol or similar ability

1. Click destroyed/damaged unit to expand
2. Click [+1] in MODELS section
3. Model count increases
4. Click [+1] in WOUNDS section to restore health

### Checking Phase Abilities

1. Click **[PHASE ABILITIES]** at top
2. View units with current phase abilities
3. Click ability chip for details
4. Click **[ALL UNITS]** to return to management

## Troubleshooting

### "Unit won't expand when I click it"
- Ensure you're in **[ALL UNITS]** view
- **[PHASE ABILITIES]** view doesn't have expandable controls
- Try clicking directly on the unit name or expand icon (▶)

### "Individual models section doesn't show"
- Only appears for units with per-model tracking data
- Single-wound units (e.g., Termagants) don't need per-model tracking
- System must have `modelsArray` data for that unit

### "Wound count seems wrong after damage"
- Check if unit has mixed wounds (leader vs regulars)
- Example: Hyperadapted Raveners have 1×6W + 4×3W = 18W total
- Expand [INDIVIDUAL MODELS] to see per-model breakdown

### "Can't see destroyed units"
- Destroyed units are hidden by default
- They don't appear in the unit lists
- Check army strength stats to confirm destruction

### "Global toggle not working"
- Toggle should immediately switch both army views
- If stuck, try refreshing the page
- Check browser console for errors

## Related Documentation

- [Unit Health Tracking](../features/UNIT_HEALTH_TRACKING.md) - System architecture
- [Unit Health View Revamp](../features/UNIT_HEALTH_VIEW_REVAMP.md) - Feature details (v4.5.0)
- [Per-Model Wound Tracking Guide](PER_MODEL_WOUND_TRACKING_GUIDE.md) - Advanced tracking
- [Character Attachments Guide](CHARACTER_ATTACHMENTS_GUIDE.md) - Attached leaders
- [Units API](../api/UNITS_ENDPOINT.md) - Technical reference

---

**Version 4.5.0 - Unified inline management interface** ⚔️
