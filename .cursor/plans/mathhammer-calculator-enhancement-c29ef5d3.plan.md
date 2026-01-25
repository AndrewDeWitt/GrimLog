<!-- c29ef5d3-4fe9-402e-8a3d-9d233b70e907 96fef23e-7e29-4793-80b9-05b3dae0b5ee -->
# MathHammer Calculator Enhancement Plan

## Confirmed 10th Edition Rules Reference

These rules were clarified and will be used as the source of truth:

| Rule | Confirmed Behavior |

|------|-------------------|

| **Lethal Hits** | Triggers on ANY 6 to hit (including rerolled 6s) |

| **Anti-X Y+** | Unmodified wound roll of Y+ = Critical Wound (only vs targets with the keyword) |

| **Sustained Hits** | Extra hits do NOT benefit from Lethal Hits |

| **Devastating Wounds** | Critical wounds become mortal wounds equal to damage characteristic, bypass all saves |

| **Feel No Pain** | Works against ALL damage including mortal wounds |

| **Modifiers Cap** | Hit/wound modifiers capped at +1/-1 |

---

## Phase 1: Math Audit and Corrections

### 1.1 Audit Current Calculations (`lib/damageCalculation.ts`)

**Issues to Fix Based on Clarified Rules:**

1. **Lethal Hits** (lines 134-150)

   - Current: May incorrectly handle rerolls
   - Fix: ANY 6 (including rerolled) triggers Lethal Hits

2. **Anti-X Logic** (lines 171-181)

   - Current: May confuse wound target with crit threshold
   - Fix: Anti-X only changes critical wound threshold (unmodified X+ = crit), base wound target still from S vs T

3. **Sustained Hits + Lethal Hits Combo** (lines 130-150)

   - Current: May apply Lethal to sustained hits
   - Fix: Extra hits from Sustained do NOT benefit from Lethal Hits

4. **Devastating Wounds Damage** (lines 211-217)

   - Current: Correctly applies damage value as mortals
   - Verify: Mortals bypass saves entirely (confirmed correct)

5. **Feel No Pain** (lines 266-270)

   - Current: Applies to total damage
   - Verify: FNP works against mortals too (confirmed correct)

### 1.2 Corrected Math Implementation

Update calculations to match verified rules exactly.

---

## Phase 2: Probability Distribution Calculations

### 2.1 Add Probability Functions

New functions in `lib/damageCalculation.ts`:

```typescript
interface ProbabilityResult {
  expected: number;             // Average value
  probabilities: number[];      // [P(0), P(1), P(2), ...]
  probabilityAtLeast: number[]; // [P(>=0), P(>=1), P(>=2), ...]
  variance: number;
}

function calculateKillProbabilities(
  attacks: number,
  hitChance: number,
  woundChance: number,
  failSaveChance: number,
  damagePerWound: number,
  woundsPerModel: number,
  maxModels: number
): ProbabilityResult
```

### 2.2 Update DamageResult Interface

```typescript
interface DamageResult {
  // Existing fields...
  probability_to_kill: {
    atLeast1: number;    // "74% chance to kill at least 1"
    exactly: number[];   // [P(0 kills), P(1 kill), P(2 kills), P(3+ kills)]
  }
}
```

---

## Phase 3: Core Stratagems Integration

### 3.1 Complete Core Stratagems List (11 Total)

**Calculator-Relevant (7):**

| Stratagem | CP | Type | Effect | Keywords |

|-----------|----|----|--------|----------|

| **Command Re-roll** | 1 | Battle Tactic | Reroll one hit/wound/damage/save/attacks die | Any |

| **Fire Overwatch** | 1 | Strategic Ploy | Hits only on unmodified 6s | Not TITANIC |

| **Go to Ground** | 1 | Battle Tactic | 6+ invuln + Benefit of Cover | INFANTRY only |

| **Smokescreen** | 1 | Wargear | Benefit of Cover + Stealth (-1 to hit) | SMOKE only |

| **Epic Challenge** | 1 | Epic Deed | [PRECISION] on melee attacks | CHARACTER only |

| **Grenade** | 1 | Wargear | Roll 6D6, each 4+ = 1 MW | GRENADES only |

| **Tank Shock** | 1 | Strategic Ploy | Roll Toughness D6s, each 5+ = 1 MW (max 6) | VEHICLE only |

**Not Calculator-Relevant (4):**

- Counter-Offensive (2CP) - Fight sequence timing
- Insane Bravery (1CP) - Battle-shock auto-pass
- Rapid Ingress (1CP) - Reserves arrival
- Heroic Intervention (1CP) - Charge phase reaction

### 3.2 Seed Core Stratagems to Database

Create `data/parsed-rules/core-stratagems.json` and `scripts/seedCoreStratagems.ts`:

```json
{
  "name": "Fire Overwatch",
  "cpCost": 1,
  "category": "Strategic Ploy",
  "when": "Opponent's Movement or Charge phase",
  "target": "One unit within 24\" of enemy unit",
  "effect": "Shoot that enemy unit, but hits only on unmodified 6s",
  "calculatorEffect": {
    "type": "attacker_modifier",
    "hit_on_6_only": true,
    "restrictions": { "not_keyword": ["TITANIC"] }
  }
}
```

### 3.3 Parse Detachment Stratagem Effects

Add `calculatorEffect` field to existing `StratagemData` records:

**Example Effects from Existing Data:**

- **Armour of Contempt** → `{ "defender_modifier": { "ap_reduction": 1 } }`
- **Unforgiven Fury** → `{ "attacker_modifier": { "lethal_hits": true, "crit_hit_on": 5 } }`
- **Hellfire Rounds** → `{ "attacker_modifier": { "plus_to_wound": 1, "vs_keyword": "MONSTER" } }`

---

## Phase 4: Calculator UI Enhancement

### 4.1 Stratagem Toggles Section

```
CORE STRATAGEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Attacker]
□ Command Re-roll (1CP) - Reroll one die
□ Fire Overwatch (1CP) - Hits on 6s only
□ Grenade (1CP) - 6D6, 4+ = MW [requires GRENADES]
□ Tank Shock (1CP) - T×D6, 5+ = MW [requires VEHICLE]

[Defender]
□ Command Re-roll (1CP) - Reroll one save
□ Go to Ground (1CP) - 6+ invuln + cover [requires INFANTRY]
□ Smokescreen (1CP) - Cover + Stealth [requires SMOKE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DETACHMENT STRATAGEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Gladius Task Force - Attacker]
□ Armour of Contempt (1CP) - Worsen AP by 1
□ Honour the Chapter (1CP) - ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.2 Probability Display Component

```
KILL PROBABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kill 0 models: ████░░░░░░ 12%
Kill 1 model:  ██████░░░░ 38%  
Kill 2 models: ████████░░ 35%
Kill 3+ models:███░░░░░░░ 15%

→ 88% chance to kill at least 1 model
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.3 Trust Indicators

- Tooltip on each result explaining the calculation
- Show assumptions (e.g., "Heavy: assumes unit remained stationary")
- Highlight when stratagems are active

---

## Files to Modify

| File | Changes |

|------|---------|

| `lib/damageCalculation.ts` | Fix math per clarified rules, add probability functions |

| `app/calculator/page.tsx` | Add stratagem toggles, probability display |

| `components/tools/DamageCalculatorModal.tsx` | Mirror calculator page changes |

| `prisma/schema.prisma` | Add `calculatorEffect Json?` to StratagemData |

| `scripts/seedCoreStratagems.ts` | New - seed all 11 core stratagems |

| `data/parsed-rules/core-stratagems.json` | New - core stratagem definitions with effects |

---

## Implementation Order

1. **Math Audit** - Review damageCalculation.ts against clarified rules
2. **Math Fixes** - Update Lethal/Sustained/Anti-X logic
3. **Probability Functions** - Add binomial distribution calculations
4. **Probability UI** - Add kill probability display
5. **Core Stratagems Data** - Create JSON and seed script
6. **Stratagem UI** - Add toggle section to calculator
7. **Detachment Stratagems** - Parse effects from existing data

### To-dos

- [ ] Audit damageCalculation.ts math against 10th Edition rules
- [ ] Fix identified calculation issues (rerolls, Anti-X, Sustained Hits)
- [ ] Add binomial probability distribution calculations
- [ ] Add kill probability display with visual breakdown
- [ ] Create and seed CoreStratagem table with calculator effects
- [ ] Parse detachment stratagem effects into structured format
- [ ] Add stratagem toggle section to calculator UI