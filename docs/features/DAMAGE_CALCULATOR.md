# Damage Calculator (MathHammer)

**Last Updated:** 2025-11-24  
**Status:** Complete  
**Version:** 4.13.0

## Overview

The Damage Calculator (also known as MathHammer) is a statistical damage calculation tool that allows players to simulate combat scenarios and predict expected outcomes. It uses the same calculation engine that powers the AI's `estimate_damage` voice command, providing consistent results across both manual and voice-driven workflows.

The calculator supports all Warhammer 40k 10th Edition combat mechanics including hit rolls, wound rolls, saves, Feel No Pain, critical hits, and weapon abilities (Lethal Hits, Sustained Hits, Devastating Wounds, etc.).

## Table of Contents

- [Features](#features)
- [Access Methods](#access-methods)
- [How It Works](#how-it-works)
- [Calculation Engine](#calculation-engine)
- [User Interfaces](#user-interfaces)
- [Voice Integration](#voice-integration)
- [Technical Architecture](#technical-architecture)
- [Related Documentation](#related-documentation)

## Features

### Core Capabilities

- **Statistical Damage Calculation:** Computes expected hits, wounds, saves, damage, and models killed
- **Game-Aware Unit Selection:** Automatically loads units from the current battle session
- **Full Weapon Support:** Accesses complete datasheet weapons with stats and abilities
- **Modifier System:** Supports all common combat modifiers:
  - Reroll hits/wounds (1s or all)
  - +1/-1 to hit/wound modifiers
  - Cover and Stealth
  - Lethal Hits, Sustained Hits, Devastating Wounds
  - Lance and other weapon keywords
- **Live Results:** Real-time calculation with detailed probability breakdown
- **Dual Interface:** Quick modal popup OR full-page calculator for detailed theory-crafting

### Supported Modifiers

**Hit Modifiers:**
- Reroll 1s to Hit
- Reroll All Hits
- +1/-1 to Hit
- Stealth (-1 to hit against this unit)
- Sustained Hits X (additional hits on 6s)
- Lethal Hits (auto-wound on 6s)

**Wound Modifiers:**
- Reroll 1s to Wound
- Reroll All Wounds
- +1/-1 to Wound
- Lance (+1 to wound on charge)
- Devastating Wounds (mortal wounds on 6s)

**Save Modifiers:**
- Cover (+1 to save)
- Ignores Cover (built into weapon)

**Defensive Abilities:**
- Invulnerable Saves
- Feel No Pain (auto-loaded from datasheet)

## Access Methods

### 1. Quick Calculator (Modal)

Access via Hamburger Menu → **"MATHHAMMER CALC (QUICK)"**

- Popup overlay for fast calculations during gameplay
- Minimal interface with essential controls
- Results displayed alongside inputs
- Quick close/recalculate workflow

### 2. Full-Page Calculator

Access via:
- Hamburger Menu → **"MATHHAMMER CALC (FULL)"**
- Direct URL: `/calculator`

- Dedicated full-screen interface for detailed analysis
- Larger input fields and results display
- Better for pre-game planning and list-building
- Persistent URL for bookmarking

### 3. Voice Commands

Use natural language during gameplay:

```
"How much damage would my Intercessors do to his Terminators?"
"Estimate damage for a Lascannon against a Land Raider"
"What's the mathhammer for 10 Guardsmen shooting at a Dreadnought?"
```

The AI will call the `estimate_damage` tool using the same calculation engine.

## How It Works

### Step-by-Step Usage

1. **Select Attacker Unit**
   - Choose from your army units currently in the battle
   - Only units with full datasheet information appear
   - Displays current model count

2. **Select Weapon**
   - Dropdown shows all weapons available to the attacker
   - Weapon stats displayed: Range, Attacks, Strength, AP, Damage
   - Abilities automatically loaded

3. **Select Defender Unit**
   - Choose from opponent's units
   - Shows Toughness, Save, Wounds per model
   - Invulnerable saves automatically included

4. **Configure Modifiers**
   - Toggle rerolls, modifiers, and special rules
   - Abilities from the weapon are auto-applied
   - Additional battlefield effects can be added

5. **Calculate**
   - Click "Calculate Damage" button
   - Results appear instantly with full breakdown

### Results Display

The calculator shows:

```
SUMMARY
- Attacker: Intercessors (10 models)
- Weapon: Bolt Rifle
- Defender: Terminators
- Total Attacks: 20

BREAKDOWN
- Expected Hits: 13.33
- Expected Wounds: 8.89
- Unsaved Wounds: 2.96
- Total Damage: 2.96
- Models Killed: 0.99

PROBABILITIES
- Hit Rate: 66.7%
- Wound Rate: 66.7%
- Save Rate: 66.7%
```

## Calculation Engine

### Core Formula

The damage calculator follows the standard 40k attack sequence:

```
1. HIT ROLL
   - Base hit chance from BS/WS (e.g., 3+ = 4/6 = 66.7%)
   - Apply modifiers (±1, capped at 2+/6+)
   - Apply rerolls (increases hit chance)
   - Calculate Sustained Hits bonus (extra hits on 6s)
   - Separate Lethal Hits (auto-wound on 6s)

2. WOUND ROLL
   - Calculate wound target from S vs T comparison
   - Apply modifiers (±1, capped at 2+/6+)
   - Apply rerolls
   - Check for Anti-X abilities (easier crit wounds)
   - Separate Devastating Wounds (mortal on 6s)

3. SAVE ROLL
   - Start with defender's save value
   - Apply AP modifier
   - Apply Cover (+1 save if applicable)
   - Compare to Invulnerable save (use better)
   - Calculate save chance
   - Mortal wounds bypass saves

4. DAMAGE
   - Multiply unsaved wounds by damage value
   - Add mortal wounds
   - Apply Feel No Pain (reduces all damage)
   - Calculate models killed (damage / wounds per model)
```

### Special Rules Handling

**Lethal Hits:**
- Identifies critical hits (6s)
- Auto-wounds without rolling
- Counts as normal wounds (not mortals)

**Sustained Hits X:**
- Each 6 to hit generates X additional hits
- Additional hits roll to wound normally

**Devastating Wounds:**
- Critical wounds (usually 6s) become mortal wounds
- Mortals = number of crits × damage value
- Bypasses saves and invulns

**Anti-X Y+:**
- Changes critical wound threshold against keyword
- Easier to score devastating/mortal wounds

**Twin-Linked:**
- Functions as full hit reroll
- Stacks mathematically with other rerolls

### Implementation

**File:** `lib/damageCalculation.ts`

Key exports:
- `calculateDamage(attacker, defender, modifiers)` - Main calculation function
- `parseDiceAverage(formula)` - Converts "D6", "2D6+3", etc. to averages
- `AttackerProfile` - Type for attacking unit stats
- `DefenderProfile` - Type for defending unit stats
- `Modifiers` - Type for battlefield modifiers
- `DamageResult` - Type for calculation results

## User Interfaces

### Modal Interface

**File:** `components/tools/DamageCalculatorModal.tsx`

Features:
- Compact two-column layout (inputs | results)
- Quick access from any game screen
- Auto-fetches units from current session
- Backdrop click to close
- Keyboard shortcuts (ESC to close)

**State Management:**
- Fetches units via `/api/sessions/[id]/units`
- Filters units with full datasheet + weapons
- Stores attacker/defender/weapon selections
- Maintains modifier state
- Calculates on-demand (not live)

### Full-Page Interface

**File:** `app/calculator/page.tsx`

Features:
- Larger form fields for easier input
- Side-by-side comparison layout
- Prominent results display
- Back navigation to battle screen
- Shareable URL

**Differences from Modal:**
- Reads session from localStorage
- Larger spacing and text sizes
- Better for screenshots/streaming
- Dedicated route for bookmarking

## Voice Integration

### AI Tool: `estimate_damage`

The voice command `"estimate damage..."` calls the same calculation engine.

**Tool Definition:** `lib/aiTools.ts`

```typescript
{
  name: "estimate_damage",
  description: "Calculate estimated damage between an attacker and a defender",
  parameters: {
    attacker_name: string,
    defender_name: string,
    attacker_owner: "attacker" | "defender",
    weapon_name?: string,  // Optional, picks best if omitted
    modifiers?: {
      reroll_hits, reroll_wounds, plus_to_hit,
      plus_to_wound, cover, stealth, lethal_hits,
      sustained_hits, devastating_wounds, lance
    }
  }
}
```

**Tool Handler:** `lib/toolHandlers.ts` → `estimateDamage()`

The handler:
1. Finds attacker and defender units via fuzzy matching
2. Selects weapon (by name or "best" heuristic)
3. Constructs AttackerProfile and DefenderProfile
4. Calls `calculateDamage()` from the engine
5. Returns formatted results to AI

**Voice Response Example:**

```
User: "How much damage would my Terminators do to his Rhino?"

AI: **Terminators** (5 models) vs **Rhino**
    Weapon: Storm Bolter (S:4, AP:0, D:1)
    Attacks: 10 (3+ to hit)

    Results:
    • Hits: 6.7
    • Wounds: 3.3
    • Unsaved: 0.6
    • **Damage: 0.6**
    • **Kills: 0.1 models**
```

## Technical Architecture

### Data Flow

```
1. USER ACTION
   - Clicks "MathHammer Calc" in menu
   - OR navigates to /calculator
   - OR speaks "estimate damage..."

2. UNIT LOADING
   - Fetch /api/sessions/[id]/units
   - Include fullDatasheet with weapons relation
   - Filter units with valid datasheets
   - Populate dropdowns

3. SELECTION
   - User selects attacker, weapon, defender
   - User toggles modifiers
   - State updates

4. CALCULATION
   - Extract weapon stats (S, AP, D, abilities)
   - Build AttackerProfile from unit + weapon
   - Build DefenderProfile from unit datasheet
   - Call calculateDamage(attacker, defender, modifiers)

5. RESULTS
   - Display expected hits, wounds, damage, kills
   - Show probability breakdown
   - Format for readability
```

### API Integration

**Units Endpoint:** `app/api/sessions/[id]/units/route.ts`

**Enhancement (v4.13.0):** Added weapon relation to unit fetch

```typescript
const unitInstances = await prisma.unitInstance.findMany({
  where: { gameSessionId: sessionId },
  include: {
    fullDatasheet: {
      include: {
        weapons: {
          include: {
            weapon: true  // ← ADDED: Full weapon data
          }
        }
      }
    }
  }
});
```

This eliminated the need for separate datasheet fetches per unit.

### Calculation Performance

- **Instant:** All calculations are pure math (no API calls)
- **Client-side:** No server round-trip after unit data loaded
- **Deterministic:** Same inputs always produce same outputs
- **Accurate:** Matches official 40k probability math

## Related Documentation

### User Guides
- **[Strategic Assistant Guide](../guides/STRATEGIC_ASSISTANT_USER_GUIDE.md)** - AI-powered tactical advice (uses damage calculator)
- **[Unit Management Guide](../guides/UNIT_MANAGEMENT_VIEW_GUIDE.md)** - Managing unit health and status

### Features
- **[AI Tool Calling](AI_TOOL_CALLING.md)** - How AI voice commands work (including estimate_damage)
- **[Datasheet System](DATASHEET_SYSTEM.md)** - How unit stats and weapons are stored

### API Reference
- **[Sessions API](../api/SESSIONS_API.md)** - Session and unit endpoints
- **[Units Endpoint](../api/SESSIONS_API.md#get-units)** - Fetching unit instances with datasheets

### Troubleshooting
- **[Calculator Issues](../troubleshooting/CALCULATOR_ISSUES.md)** - Common problems and solutions *(To be created)*

## Version History

**v4.13.0 (2025-11-24):**
- ✅ Initial release
- ✅ Modal and full-page interfaces
- ✅ Complete modifier support
- ✅ Voice command integration
- ✅ Game-aware unit loading

**Future Enhancements:**
- Weapon comparison mode (compare multiple weapons side-by-side)
- Save calculations (bookmark specific matchups)
- Monte Carlo simulation (show probability distribution)
- Multi-turn projections (sustained combat over multiple rounds)

