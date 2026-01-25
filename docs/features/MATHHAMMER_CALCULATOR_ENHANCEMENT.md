# MathHammer Calculator Enhancement

**Last Updated:** 2025-11-25  
**Status:** Complete  
**Version:** 4.14.0

## Overview

Major enhancement to the MathHammer damage calculator with corrected 10th Edition math, probability distribution calculations, and core stratagems integration. This update ensures calculations match official rules and provides statistical insights for better tactical decision-making.

## Table of Contents

- [Rule Corrections](#rule-corrections)
- [Probability Distributions](#probability-distributions)
- [Core Stratagems](#core-stratagems)
- [UI Enhancements](#ui-enhancements)
- [Technical Implementation](#technical-implementation)
- [Usage Examples](#usage-examples)
- [Related Documentation](#related-documentation)

## Rule Corrections

### Confirmed 10th Edition Rules

| Rule | Confirmed Behavior |
|------|-------------------|
| **Lethal Hits** | Triggers on ANY 6 to hit (including rerolled 6s) |
| **Anti-X Y+** | Unmodified wound roll of Y+ = Critical Wound (only vs targets with the keyword) |
| **Sustained Hits** | Extra hits do NOT benefit from Lethal Hits |
| **Devastating Wounds** | Critical wounds become mortal wounds equal to damage characteristic, bypass all saves |
| **Feel No Pain** | Works against ALL damage including mortal wounds |
| **Modifiers Cap** | Hit/wound modifiers capped at +1/-1 |

### Fixed Calculations

1. **Lethal Hits (lines 134-150)**
   - **Before:** May incorrectly handle rerolls
   - **After:** ANY 6 (including rerolled) triggers Lethal Hits

2. **Anti-X Logic (lines 171-181)**
   - **Before:** Confused wound target with crit threshold
   - **After:** Anti-X only changes critical wound threshold, base wound target still from S vs T

3. **Sustained Hits + Lethal Hits Combo (lines 130-150)**
   - **Before:** May apply Lethal to sustained hits
   - **After:** Extra hits from Sustained do NOT benefit from Lethal Hits

## Probability Distributions

### New Interfaces

```typescript
interface ProbabilityResult {
  expected: number;             // Average value
  probabilities: number[];      // [P(0), P(1), P(2), ...]
  probabilityAtLeast: number[]; // [P(>=0), P(>=1), P(>=2), ...]
  variance: number;
}
```

### DamageResult Updates

```typescript
interface DamageResult {
  // Existing fields...
  mortal_wounds: number;        // Track mortals separately
  probability_to_kill?: {
    atLeast1: number;           // "74% chance to kill at least 1"
    exactly: number[];          // [P(0 kills), P(1 kill), P(2 kills), P(3+ kills)]
  }
}
```

### New Functions

- `binomialPMF(n, k, p)` - Binomial probability mass function
- `calculateKillProbabilities(...)` - Kill probability distributions
- `calculateDamageWithProbabilities(...)` - Full calculation with probability data

## Core Stratagems

### Calculator-Relevant Stratagems (7)

| Stratagem | CP | Type | Effect | Restrictions |
|-----------|----|----|--------|--------------|
| **Command Re-roll** | 1 | Battle Tactic | Reroll one hit/wound/damage/save/attacks die | Any |
| **Fire Overwatch** | 1 | Strategic Ploy | Hits only on unmodified 6s | Not TITANIC |
| **Go to Ground** | 1 | Battle Tactic | 6+ invuln + Benefit of Cover | INFANTRY only |
| **Smokescreen** | 1 | Wargear | Benefit of Cover + Stealth (-1 to hit) | SMOKE only |
| **Epic Challenge** | 1 | Epic Deed | [PRECISION] on melee attacks | CHARACTER only |
| **Grenade** | 1 | Wargear | Roll 6D6, each 4+ = 1 MW | GRENADES only |
| **Tank Shock** | 1 | Strategic Ploy | Roll Toughness D6s, each 5+ = 1 MW (max 6) | VEHICLE only |

### Non-Calculator Stratagems (4)

- Counter-Offensive (2CP) - Fight sequence timing
- Insane Bravery (1CP) - Battle-shock auto-pass
- Rapid Ingress (1CP) - Reserves arrival
- Heroic Intervention (2CP) - Charge phase reaction

### Data Structure

```json
{
  "name": "Fire Overwatch",
  "cpCost": 1,
  "category": "Strategic Ploy",
  "when": "Opponent's Movement or Charge phase",
  "target": "One unit within 24\" of enemy unit",
  "effect": "Shoot that enemy unit, hits only on unmodified 6s",
  "isCalculatorRelevant": true,
  "calculatorEffect": {
    "type": "attacker_modifier",
    "hit_on_6_only": true,
    "description": "Hits only on unmodified 6s"
  }
}
```

## UI Enhancements

### Stratagem Toggles Section

```
CORE STRATAGEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Attacker]                    -2 CP
☑ Command Re-roll (1CP) - Reroll one die
☑ Fire Overwatch (1CP) - Hits on 6s only
☐ Grenade (1CP) - 6D6, 4+ = MW [requires GRENADES]
☐ Tank Shock (1CP) - T×D6, 5+ = MW [requires VEHICLE]

[Defender]                    -1 CP
☐ Command Re-roll (1CP) - Reroll one save
☑ Go to Ground (1CP) - 6+ invuln + cover [requires INFANTRY]
☐ Smokescreen (1CP) - Cover + Stealth [requires SMOKE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Kill Probability Display

```
🎯 KILL PROBABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kill 0:   ████░░░░░░ 12%
Kill 1:   ██████░░░░ 38%
Kill 2:   ████████░░ 35%
Kill 3+:  ███░░░░░░░ 15%

→ 88% chance to kill at least 1 model
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Results Display Updates

- **Mortal Wounds:** Displayed separately in red when > 0
- **Active Stratagems:** Listed in summary section
- **Probability Data:** Visual bars with percentage labels

## Technical Implementation

### Files Modified

| File | Changes |
|------|---------|
| `lib/damageCalculation.ts` | Complete rewrite - fixed math, added probability functions |
| `app/calculator/page.tsx` | Added stratagem toggles, probability display |
| `components/tools/DamageCalculatorModal.tsx` | Mirrored calculator page changes |
| `prisma/schema.prisma` | Added `calculatorEffect Json?` to StratagemData and CoreStratagem |

### Files Created

| File | Purpose |
|------|---------|
| `data/parsed-rules/core-stratagems.json` | All 11 core stratagem definitions with effects |
| `scripts/seedCoreStratagems.ts` | Database seeding script for core stratagems |

### Database Schema Changes

```prisma
model StratagemData {
  // ... existing fields
  calculatorEffect Json? // e.g., { "type": "attacker_modifier", "lethal_hits": true }
}

model CoreStratagem {
  // ... existing fields
  isCalculatorRelevant Boolean @default(false)
  calculatorEffect     Json?
}
```

## Usage Examples

### Basic Calculation

1. Select attacker unit from session
2. Select weapon
3. Select defender unit
4. Toggle any active stratagems
5. Adjust modifiers (rerolls, cover, etc.)
6. Click "Calculate Damage"

### With Fire Overwatch

1. Enable "Fire Overwatch" stratagem (attacker)
2. Calculator automatically applies "hits on 6s only"
3. Results show reduced hit rate and expected damage

### With Go to Ground

1. Enable "Go to Ground" stratagem (defender)
2. Calculator applies 6+ invuln save and cover
3. Results show improved save rate

## Seeding Core Stratagems

Run the seed script after database migration:

```bash
npx tsx scripts/seedCoreStratagems.ts
```

Expected output:
```
🎲 Seeding Core Stratagems...

  📊 Command Re-roll (1CP) - Battle Tactic
  📊 Fire Overwatch (1CP) - Strategic Ploy
  📊 Go to Ground (1CP) - Battle Tactic
  📊 Smokescreen (1CP) - Wargear
  📊 Epic Challenge (1CP) - Epic Deed
  📊 Grenade (1CP) - Wargear
  📊 Tank Shock (1CP) - Strategic Ploy
  📋 Counter-Offensive (2CP) - Strategic Ploy
  📋 Insane Bravery (1CP) - Battle Tactic
  📋 Rapid Ingress (1CP) - Strategic Ploy
  📋 Heroic Intervention (2CP) - Strategic Ploy

✅ Core stratagems seeded successfully!

📊 Summary:
   Total core stratagems: 11
   Calculator-relevant: 7
```

## Related Documentation

- **[Damage Calculator (MathHammer)](DAMAGE_CALCULATOR.md)** - Original damage calculator feature (v4.13.0)
- **[Stratagem & Detachment System](STRATAGEM_DETACHMENT_SYSTEM.md)** - Detachment-based stratagem filtering
- **[Stratagem Tracking System](STRATAGEM_TRACKING.md)** - Timeline visualization and logging
- **[CHANGELOG](../../CHANGELOG.md)** - Version history with upgrade guides

