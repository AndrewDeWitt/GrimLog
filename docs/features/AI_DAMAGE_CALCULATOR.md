# AI Damage Calculator (Voice-Activated)

**Last Updated:** 2025-11-26  
**Status:** Complete  
**Version:** 4.15.0

## Overview

The AI Damage Calculator allows players to ask natural voice questions like "How much damage does Logan do to Raveners?" and receive instant, accurate damage calculations. The system uses a Weapon Rules Engine to properly handle phase-aware weapon selection, extra attacks weapons, and weapon profile variants.

## Table of Contents

- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Voice Commands](#voice-commands)
- [Weapon Rules Engine](#weapon-rules-engine)
- [Extra Attacks Handling](#extra-attacks-handling)
- [Damage Results Modal](#damage-results-modal)
- [Timeline Integration](#timeline-integration)
- [Technical Architecture](#technical-architecture)
- [Related Documentation](#related-documentation)

## Key Features

### Voice-Activated Calculations
- Ask damage questions in natural language
- AI extracts unit names, targets, and modifiers
- No need to navigate menus or select weapons manually

### All-Weapon Comparison
- Calculates damage for ALL eligible weapons
- Shows comparison (e.g., strike vs sweep profiles)
- Highlights best weapon choice with ⭐

### Extra Attacks Support
- Properly handles EXTRA ATTACKS weapons (per 10th Edition rules)
- Extra attacks added IN ADDITION to main weapon
- Clear breakdown showing weapon + extra = total

### Phase-Aware Selection
- Fight phase: Uses melee weapons
- Shooting phase: Uses ranged weapons
- Pistols handled separately for engagement range

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Voice Input: "How much damage does Logan do to Raveners?"     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Parameter Extraction                                        │
│  - attacker_name: "Logan Grimnar"                               │
│  - defender_name: "Raveners"                                    │
│  - modifiers: {} (none specified)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Weapon Rules Engine                                            │
│  - Phase: Fight → Filter melee weapons                          │
│  - Primary: Axe Morkai (strike), Axe Morkai (sweep)            │
│  - Extra Attacks: Tyrnak and Fenrir                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Math Engine (per weapon)                                       │
│  - Calculate hits, wounds, saves, damage                        │
│  - Add extra attacks damage to each option                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Results Modal                                                  │
│  - Strike: 8.3 + 1.7 = 10.0 dmg ⭐                             │
│  - Sweep: 4.6 + 1.7 = 6.3 dmg                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Voice Commands

### Basic Damage Query
```
"How much damage does [Attacker] do to [Defender]?"
"What's the damage from [Attacker] against [Defender]?"
"Calculate damage [Attacker] vs [Defender]"
```

### With Modifiers
```
"How much damage does [Attacker] do to [Defender] with reroll 1s to hit?"
"[Attacker] vs [Defender] with cover"
"[Attacker] against [Defender], they charged"
```

### Modifier Mapping
| Voice Command | Modifier |
|--------------|----------|
| "reroll 1s to hit" | `reroll_hits: "ones"` |
| "reroll all hits" | `reroll_hits: "all"` |
| "reroll 1s to wound" | `reroll_wounds: "ones"` |
| "plus 1 to hit" | `plus_to_hit: 1` |
| "minus 1 to hit" | `plus_to_hit: -1` |
| "with cover" | `cover: true` |
| "they charged" / "lance" | `lance: true` |
| "lethal hits" | `lethal_hits: true` |
| "sustained hits 1" | `sustained_hits: 1` |
| "devastating wounds" | `devastating_wounds: true` |

## Weapon Rules Engine

Located in `lib/weaponRulesEngine.ts`, this engine handles:

### Weapon Classification
```typescript
classifyWeaponType(range, type) → 'ranged' | 'melee' | 'pistol'
```

### Phase Filtering
- **Fight Phase:** Returns melee weapons as primary, pistols as secondary
- **Shooting Phase:** Returns ranged weapons as primary

### Profile Groups
Detects weapons with variants:
- "Axe Morkai — strike" and "Axe Morkai — sweep" grouped together
- Allows comparison between profiles

### Extra Attacks Detection
Weapons with `EXTRA ATTACKS` ability are:
1. Identified separately from primary weapons
2. Excluded from "best weapon" selection
3. Added to ALL primary weapon calculations

## Extra Attacks Handling

Per 10th Edition rules, weapons with EXTRA ATTACKS provide additional attacks on top of the main weapon choice:

```
Logan Grimnar in Fight Phase:
├── Choose ONE primary weapon:
│   ├── Axe Morkai — strike (6A, S8, AP-2, D3)
│   └── Axe Morkai — sweep (10A, S6, AP-2, D1)
│
└── ALWAYS adds Extra Attacks weapon:
    └── Tyrnak and Fenrir (6A, S5, AP-1, D1)
```

**Calculation:**
- Strike + Wolves: 8.3 + 1.7 = **10.0 dmg**
- Sweep + Wolves: 4.6 + 1.7 = **6.3 dmg**

## Damage Results Modal

### Summary View (Collapsed)
Shows transparent breakdown:
```
Logan Grimnar → Raveners
┌─────────────────────────────────────────┐
│ Axe Morkai — strike    8.3 dmg         │
│ + Extra Attacks        1.7 dmg         │
│ ────────────────────────────────────── │
│ TOTAL         10.0 dmg    3.3 kills    │
└─────────────────────────────────────────┘
```

### Details View (Expanded)
- Extra Attacks section with weapon stats
- Weapon comparison with all options
- Per-weapon breakdown (weapon only vs total)
- Hit/Wound/Unsaved stats
- Roll rates (Hit %, Wound %, Save %, Crit %)

### Accessing Results
1. **Automatic:** Modal opens when voice calculation completes
2. **Hamburger Menu:** Click "View Damage Results" (shows count badge)
3. **Timeline:** Click any `⚔ DAMAGE` event with 👁 VIEW badge

## Timeline Integration

Damage calculations are saved as timeline events:

```typescript
{
  eventType: 'damage_calc',
  description: 'Damage calc: Logan Grimnar → Raveners (10.0 dmg, 3.3 kills)',
  metadata: {
    attacker: 'Logan Grimnar',
    defender: 'Raveners',
    weapon: 'Axe Morkai — strike',
    stats: { ... },
    allWeapons: [ ... ],
    extraAttacks: [ ... ]
  }
}
```

**Clicking on a damage_calc event:**
1. Opens the Damage Results Modal
2. Displays full calculation data
3. Shows weapon comparison and breakdown

## Technical Architecture

### Files Modified/Created

| File | Purpose |
|------|---------|
| `lib/weaponRulesEngine.ts` | Weapon filtering, classification, extra attacks |
| `lib/toolHandlers.ts` | Refactored `estimateDamage` function |
| `lib/aiTools.ts` | Enhanced tool definition with parameter guidance |
| `lib/contextBuilder.ts` | Added damage calculation rules to system prompt |
| `lib/rulesReference.ts` | `DAMAGE_CALCULATION_RULES` constant |
| `lib/types.ts` | New types: WeaponProfile, EligibleWeaponsResult |
| `components/DamageResultsModal.tsx` | Results display modal |
| `components/Timeline.tsx` | Clickable damage_calc events |
| `components/HamburgerMenu.tsx` | Results count badge |
| `app/page.tsx` | Modal state and click handlers |

### Data Flow

```
Voice → AI Tool Call → Weapon Rules Engine → Math Engine → Results Modal
                                                              ↓
                                                    Timeline Event (saved)
                                                              ↓
                                                    Click to re-view
```

### Key Types

```typescript
interface WeaponProfile {
  id: string;
  name: string;
  type: 'ranged' | 'melee' | 'pistol';
  attacks: string;
  attacksAverage: number;
  strength: number;
  ap: number;
  damage: number;
  abilities: ParsedWeaponAbility[];
  profileGroup?: string;
  profileVariant?: string;
}

interface EligibleWeaponsResult {
  phase: CombatPhase;
  weapons: WeaponProfile[];
  primaryWeapons: WeaponProfile[];
  extraAttackWeapons: WeaponProfile[];
  profileGroups: { [name: string]: WeaponProfile[] };
}
```

## Related Documentation

- **[MathHammer Calculator](MATHHAMMER_CALCULATOR_ENHANCEMENT.md)** - Manual calculator UI with same math engine
- **[AI Tool Calling System](AI_TOOL_CALLING_SETUP.md)** - How AI tools work
- **[Session System](SESSION_SYSTEM.md)** - Timeline events and session management

---

**The Omnissiah calculates. Trust in the numbers.** ⚔️

