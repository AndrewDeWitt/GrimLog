# Points Tiers for Variable-Size Units

**Last Updated:** 2025-12-14
**Status:** Complete

## Overview

Many Warhammer 40K units have variable model counts with tiered pricing. For example, Wolf Guard Terminators cost 170 points for 5 models, but 340 points for 10 models. Some units have even more complex pricing structures:
- **Composition-based tiers:** Units with multiple model types that affect pricing (e.g., Wolf Guard Headtakers + Hunting Wolves)
- **Add-on models:** Optional models that add flat costs (e.g., Outrider Squad + Invader ATV for +60pts)

This feature implements proper tier-based points calculation with support for simple, composition-based, and add-on pricing patterns.

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Tier Types](#tier-types)
- [Data Structure](#data-structure)
- [How It Works](#how-it-works)
- [Scripts](#scripts)
- [API Changes](#api-changes)
- [Related Documentation](#related-documentation)

## Problem

Previously, the system stored only a single `pointsCost` value per datasheet. When calculating points for variable-size units, it used proportional scaling:

```typescript
// Old approach - incorrect
const extraModels = modelCount - baseModels;
const pointsPerExtraModel = Math.round(datasheet.pointsCost / baseModels);
points += extraModels * pointsPerExtraModel;
```

This caused significant errors. A 2000pt Space Wolves army was showing as 1415pts because units like Wolf Guard Terminators with 10 models were being charged 170pts instead of the correct 340pts.

## Solution

The system now stores an array of points tiers for each datasheet and performs exact tier lookups. The system supports three generic tier patterns that work across all factions:

1. **Simple tiers** - Uniform model units (e.g., 5 models = 170pts, 10 models = 340pts)
2. **Composition tiers** - Multi-model-type units (e.g., 3 Headtakers + 3 Wolves = 110pts)
3. **Add-on tiers** - Optional models with flat costs (e.g., Invader ATV = +60pts)

```typescript
// New approach - correct
const tiers = datasheet.pointsTiers;
const exactMatch = tiers.find(t => t.models === modelCount);
if (exactMatch) {
  return exactMatch.points;
}
```

## Tier Types

### 1. Simple Tiers

For units where all models are the same type and pricing is based on total model count:

```json
{
  "pointsTiers": [
    { "models": 5, "points": 170 },
    { "models": 10, "points": 340 }
  ]
}
```

**Examples:**
- Wolf Guard Terminators: 5 models = 170pts, 10 models = 340pts
- Terminator Squad: 5 models = 170pts, 10 models = 340pts
- Aggressor Squad: 3 models = 100pts, 6 models = 200pts

### 2. Composition Tiers

For units with multiple distinct model types where the combination affects pricing:

```json
{
  "pointsTiers": [
    { "composition": { "Wolf Guard Headtaker": 3 }, "points": 85 },
    { "composition": { "Wolf Guard Headtaker": 3, "Hunting Wolf": 3 }, "points": 110 },
    { "composition": { "Wolf Guard Headtaker": 6 }, "points": 170 },
    { "composition": { "Wolf Guard Headtaker": 6, "Hunting Wolf": 6 }, "points": 220 }
  ]
}
```

**Examples:**
- Wolf Guard Headtakers: Can include 0-6 Hunting Wolves, with pricing based on the exact combination

**HTML Pattern:**
```html
<table>
  <tr><td>3 Wolf Guard Headtakers</td><td><div class="PriceTag">85</div></td></tr>
  <tr><td>3 Wolf Guard Headtakers and 3 Hunting Wolves</td><td><div class="PriceTag">110</div></td></tr>
</table>
```

### 3. Add-On Tiers

For optional models that add a flat cost on top of the base unit:

```json
{
  "pointsTiers": [
    { "models": 3, "points": 80 },
    { "models": 6, "points": 160 },
    { "addOn": "Invader ATV", "addOnPoints": 60 }
  ]
}
```

**Examples:**
- Outrider Squad: Base unit (3 models = 80pts, 6 models = 160pts) + optional Invader ATV (+60pts)

**HTML Pattern:**
```html
<table>
  <tr><td>3 models</td><td><div class="PriceTag">80</div></td></tr>
  <tr><td>6 models</td><td><div class="PriceTag">160</div></td></tr>
  <tr><td>Invader ATV</td><td><div class="PriceTag">+60</div></td></tr>
</table>
```

**Calculation:**
- Base points calculated from simple tiers (3 or 6 models)
- Add-on points added if the add-on model is present in the unit composition
- Final cost = base points + (add-on points × add-on count)

## Data Structure

### Database Schema

```prisma
model Datasheet {
  pointsCost  Int     // Base points cost (minimum unit size)
  pointsTiers String? // JSON array supporting three tier types:
                      // - Simple: [{"models": 5, "points": 170}, {"models": 10, "points": 340}]
                      // - Composition: [{"composition": {"Model A": 3, "Model B": 3}, "points": 110}]
                      // - Add-on: [{"addOn": "Model Name", "addOnPoints": 60}]
}
```

### JSON Format Examples

**Simple Tiers:**
```json
{
  "pointsTiers": [
    { "models": 5, "points": 170 },
    { "models": 10, "points": 340 }
  ]
}
```

**Composition Tiers:**
```json
{
  "pointsTiers": [
    { "composition": { "Wolf Guard Headtaker": 3 }, "points": 85 },
    { "composition": { "Wolf Guard Headtaker": 3, "Hunting Wolf": 3 }, "points": 110 },
    { "composition": { "Wolf Guard Headtaker": 6 }, "points": 170 },
    { "composition": { "Wolf Guard Headtaker": 6, "Hunting Wolf": 6 }, "points": 220 }
  ]
}
```

**Add-On Tiers:**
```json
{
  "pointsTiers": [
    { "models": 3, "points": 80 },
    { "models": 6, "points": 160 },
    { "addOn": "Invader ATV", "addOnPoints": 60 }
  ]
}
```

**Mixed Tiers (Composition + Add-On):**
A unit can have both composition tiers and add-on tiers in the same array. The calculation logic handles both:
```json
{
  "pointsTiers": [
    { "composition": { "Model A": 3 }, "points": 85 },
    { "addOn": "Optional Model", "addOnPoints": 60 }
  ]
}
```

### Source Data

Points tiers are extracted from Wahapedia HTML tables. The parser automatically detects three patterns:

**Simple Pattern:**
```html
<table>
  <tr><td>5 models</td><td><div class="PriceTag">170</div></td></tr>
  <tr><td>10 models</td><td><div class="PriceTag">340</div></td></tr>
</table>
```

**Composition Pattern:**
```html
<table>
  <tr><td>3 Wolf Guard Headtakers and 3 Hunting Wolves</td><td><div class="PriceTag">110</div></td></tr>
</table>
```

**Add-On Pattern:**
```html
<table>
  <tr><td>Invader ATV</td><td><div class="PriceTag">+60</div></td></tr>
</table>
```

The `+` prefix in the price tag indicates an add-on tier.

## How It Works

### 1. Data Extraction

The `patchPointsTiers.ts` script scans cached Wahapedia HTML files and extracts points tiers using cheerio:

```typescript
$('table').find('tr').each((_, tr) => {
  const modelText = $(cells[0]).text().trim();  // "5 models"
  const points = $(cells[1]).find('.PriceTag').text();  // "170"
  tiers.push({ models: parseInt(modelMatch[1]), points: parseInt(points) });
});
```

### 2. Points Calculation

`UnitBuilder.tsx` uses tier-based lookup with support for all three tier types:

**For Simple Tiers:**
1. Find exact match for model count
2. If no exact match, find highest tier that doesn't exceed model count
3. Fall back to base `pointsCost` if no tiers available

**For Composition Tiers:**
1. Build composition map from unit's model types and counts
2. Find exact match for composition (all model types and counts must match)
3. If no match, fall back to simple tier calculation or base cost

**For Add-On Tiers:**
1. Calculate base points from simple or composition tiers
2. Check if any add-on models are present in unit composition
3. Add (add-on points × add-on count) to base points

**Example Calculation (Outrider Squad with Invader ATV):**
- Unit composition: 3 Outriders + 1 Invader ATV
- Base points: 80pts (from simple tier: 3 models)
- Add-on points: 60pts × 1 = 60pts
- **Total: 140pts**

### 3. Army List Parsing

When parsing imported army lists, the AI receives points tier context:

**Simple Tiers:**
```
[DATASHEET] "Wolf Guard Terminators" (5=170pts, 10=340pts)
```

**Composition Tiers:**
```
[DATASHEET] "Wolf Guard Headtakers" 
  - 3 Headtakers = 85pts
  - 3 Headtakers + 3 Wolves = 110pts
  - 6 Headtakers = 170pts
  - 6 Headtakers + 6 Wolves = 220pts
```

**Add-On Tiers:**
```
[DATASHEET] "Outrider Squad" (3=80pts, 6=160pts, +Invader ATV=+60pts)
```

The AI parsing schema includes a `modelType` field in the composition array to explicitly identify different model types, which is crucial for matching against composition-based and add-on tiers.

## Scripts

### patchPointsTiers.ts

Extracts points tiers from cached HTML without API calls.

```bash
# Patch all factions
npx tsx scripts/patchPointsTiers.ts

# Patch specific faction
npx tsx scripts/patchPointsTiers.ts space-marines
```

**Output:**
- Updates JSON files in `data/parsed-datasheets/`
- Logs multi-tier units found with categorization:
  - 🔷 Composition tiers (multi-model-type units)
  - ➕ Add-on tiers (optional models with flat costs)
  - ✅ Multi-tier (variable model count)
- Zero API cost

**Example Output:**
```
🔷 Wolf Guard Headtakers (COMPOSITION): [3 Wolf Guard Headtakers]→85pts, [3 Wolf Guard Headtakers + 3 Hunting Wolves]→110pts, ...
➕ Outrider Squad (ADD-ON): 3→80pts, 6→160pts, [+Invader ATV]+60pts
✅ Terminator Squad: 5→170pts, 10→340pts
```

### parseDatasheets.ts

Updated to extract points tiers during future imports:

- Uses cheerio to extract tiers before LLM parsing
- Overrides LLM-extracted tiers with cheerio data (more reliable)
- Includes tiers in output JSON

### seedDatasheets.ts

Updated to import `pointsTiers` to database:

```typescript
pointsTiers: data.pointsTiers ? JSON.stringify(data.pointsTiers) : null,
```

## API Changes

### GET /api/datasheets

Now returns `pointsTiers` for each datasheet:

```json
{
  "datasheets": [
    {
      "id": "...",
      "name": "Wolf Guard Terminators",
      "pointsCost": 170,
      "pointsTiers": [
        { "models": 5, "points": 170 },
        { "models": 10, "points": 340 }
      ]
    }
  ]
}
```

### GET /api/datasheets/detail/[id]

Includes parsed `pointsTiers` array in response.

## Related Documentation

- [Datasheet Parsing Guide](../guides/DATASHEET_PARSING_GUIDE.md) - How datasheets are parsed from Wahapedia
- [Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md) - How army lists are parsed and imported
- [Seeding Datasheets API](../api/SEED_DATASHEETS.md) - Seeder script documentation

