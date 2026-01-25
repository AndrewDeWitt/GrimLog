# Faction Data Import Guide

**Last Updated:** 2025-12-14  
**Status:** Complete

## Overview

This guide covers how to import, export, and manage faction data in Grimlog. The system supports importing data from Wahapedia (automated scraping) or manual JSON files.

## Table of Contents

- [Quick Start](#quick-start)
- [Adding a Single Detachment](#adding-a-single-detachment)
- [Import Methods](#import-methods)
- [JSON Schema](#json-schema)
- [Command-Line Tools](#command-line-tools)
- [Admin UI](#admin-ui)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Import a Single Faction from Wahapedia

```bash
npx tsx scripts/scrapeWahapediaComplete.ts tyranids
npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json
```

### Import All Factions

```bash
# Scrape all factions (takes ~5 minutes)
npx tsx scripts/scrapeWahapediaComplete.ts --all

# Import each faction JSON
for f in data/wahapedia-import/*.json; do
  npx tsx scripts/importFaction.ts "$f"
done
```

### Reset and Reimport

```bash
# Clear existing faction data (preserves user data)
npx tsx scripts/resetGameData.ts --confirm

# Re-import all factions
npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json
# ... repeat for each faction
```

---

## Adding a Single Detachment

When Games Workshop releases new content (e.g., a new detachment), follow these steps:

### Step 1: Edit the Faction JSON

Open `data/wahapedia-import/<faction>.json` and add the detachment to the `detachments` array:

```json
{
  "name": "New Detachment Name",
  "abilityName": "Detachment Rule Name",
  "abilityDescription": "Full rule text including sub-rules and restrictions...",
  "abilityFlavorText": "Optional flavor text...",
  "stratagems": [
    {
      "name": "STRATAGEM NAME",
      "cpCost": 1,
      "type": "Strategic Ploy",
      "when": "When this can be used...",
      "target": "What you can target...",
      "effect": "What happens...",
      "restrictions": null,
      "triggerPhase": ["Shooting", "Fight"],
      "isReactive": true
    }
  ],
  "enhancements": [
    {
      "name": "Enhancement Name",
      "pointsCost": 20,
      "description": "KEYWORD model only. Effect text...",
      "flavorText": "Optional flavor...",
      "restrictions": ["KEYWORD"]
    }
  ]
}
```

### Step 2: Update Detachment List (Optional)

Add the detachment name to `data/parsed-rules/detachments-<faction>.json` (alphabetically):

```json
{
  "faction": "space-wolves",
  "detachments": [
    "Existing Detachment",
    "New Detachment Name",
    "Other Detachment"
  ]
}
```

### Step 3: Import to Database

```bash
npx tsx scripts/importFaction.ts data/wahapedia-import/<faction>.json --update
```

The `--update` flag ensures:
- New detachments are created
- Existing detachments are updated (if rules changed)
- All stratagems and enhancements are synced

### Step 4: Verify

1. Hard refresh the app (Ctrl+Shift+R)
2. Create/edit an army with the faction
3. Check the detachment dropdown includes the new option

### Example: Adding Space Wolves "Saga of the Great Wolf"

```bash
# 1. Edit data/wahapedia-import/space-wolves.json (add detachment)
# 2. Edit data/parsed-rules/detachments-space-wolves.json (add name)
# 3. Import
npx tsx scripts/importFaction.ts data/wahapedia-import/space-wolves.json --update

# Output shows:
#   Detachments:  1 created, 4 updated
#   Stratagems:   6 created
#   Enhancements: 4 created
```

---

## Import Methods

### Method 1: Wahapedia Scraper (Automated)

The scraper extracts complete faction data from Wahapedia:

```bash
npx tsx scripts/scrapeWahapediaComplete.ts <faction-slug> [options]
```

**Options:**
- `--skip-cache` - Force fresh download (ignore cached HTML)
- `--all` - Scrape all configured factions

**Supported Factions:**

| Slug | Faction Name |
|------|--------------|
| `tyranids` | Tyranids |
| `space-marines` | Space Marines (combined) |
| `astra-militarum` | Astra Militarum |
| `orks` | Orks |
| `necrons` | Necrons |
| `aeldari` | Aeldari |
| `chaos-space-marines` | Chaos Space Marines |
| `t-au-empire` | T'au Empire |
| `adeptus-custodes` | Adeptus Custodes |
| `grey-knights` | Grey Knights |
| `adepta-sororitas` | Adepta Sororitas |
| `death-guard` | Death Guard |
| `thousand-sons` | Thousand Sons |
| `world-eaters` | World Eaters |
| `drukhari` | Drukhari |
| `chaos-daemons` | Chaos Daemons |
| `genestealer-cults` | Genestealer Cults |
| `leagues-of-votann` | Leagues of Votann |
| `adeptus-mechanicus` | Adeptus Mechanicus |
| `imperial-knights` | Imperial Knights |
| `chaos-knights` | Chaos Knights |
| `imperial-agents` | Imperial Agents |

**What Gets Scraped:**
- **Army Rules** - Faction-level abilities (e.g., Synapse, Oath of Moment)
- **Detachments** - All detachments with their core abilities
- **Stratagems** - Complete stratagem data (CP cost, type, when/target/effect)
- **Enhancements** - All enhancements with points costs

### Method 2: Manual JSON Import

Create or edit a JSON file following the schema, then import:

```bash
npx tsx scripts/importFaction.ts path/to/faction.json [options]
```

**Options:**
- `--dry-run` - Validate without writing to database
- `--update` - Update existing records (default: skip existing)

### Method 3: Admin UI

1. Navigate to `/admin/factions`
2. Click "Import Data" button
3. Choose:
   - **From Wahapedia**: Select faction from dropdown, click Import
   - **From JSON**: Upload a JSON file

---

## JSON Schema

### Basic Structure

```json
{
  "faction": {
    "name": "Tyranids",
    "keywords": ["TYRANIDS"],
    "parentFaction": null
  },
  "armyRules": [
    {
      "name": "Synapse",
      "description": "While a TYRANIDS unit is within 6\" of a SYNAPSE model...",
      "flavorText": "The Hive Mind's psychic presence..."
    }
  ],
  "detachments": [
    {
      "name": "Invasion Fleet",
      "description": "The classic Tyranid army structure.",
      "abilityName": "Hyper-Adaptations",
      "abilityDescription": "At the start of the first battle round...",
      "stratagems": [...],
      "enhancements": [...]
    }
  ]
}
```

### Stratagem Schema

```json
{
  "name": "Rapid Regeneration",
  "cpCost": 1,
  "type": "Battle Tactic",
  "when": "Your opponent's Shooting phase or the Fight phase",
  "target": "One TYRANIDS unit from your army",
  "effect": "Until the end of the phase, each time a model in your unit would lose a wound...",
  "restrictions": "You cannot use this Stratagem more than once per phase."
}
```

### Enhancement Schema

```json
{
  "name": "Adaptive Biology",
  "pointsCost": 25,
  "description": "MONSTER model only. Each time an attack is allocated to the bearer...",
  "flavorText": "This creature's alien physiology...",
  "restrictions": "MONSTER model only"
}
```

### Full Schema Reference

See `data/import-schema.json` for the complete JSON Schema definition.

---

## Command-Line Tools

### scrapeWahapediaComplete.ts

Scrapes faction data from Wahapedia and saves as JSON.

```bash
# Scrape single faction
npx tsx scripts/scrapeWahapediaComplete.ts tyranids

# Force fresh scrape (skip cache)
npx tsx scripts/scrapeWahapediaComplete.ts tyranids --skip-cache

# List all supported factions
npx tsx scripts/scrapeWahapediaComplete.ts --help
```

**Output:** `data/wahapedia-import/<faction-slug>.json`

### importFaction.ts

Imports a JSON file into the database.

```bash
# Validate only (dry run)
npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json --dry-run

# Import (skip existing records)
npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json

# Import with updates (upsert existing records)
npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json --update
```

### resetGameData.ts

Safely clears game data tables while preserving user data.

```bash
# Preview what will be deleted
npx tsx scripts/resetGameData.ts

# Actually delete (requires --confirm)
npx tsx scripts/resetGameData.ts --confirm
```

**Preserved Data:**
- Users
- Players
- Armies
- Units (in armies)
- Game Sessions
- User Datasheets
- Unit Icons

**Deleted Data:**
- Factions
- Detachments
- Stratagems
- Enhancements
- Army Rules
- Datasheets (official)
- Weapons
- Abilities

### splitSpaceMarineChapters.ts

Splits combined Space Marines data into separate chapter factions.

```bash
npx tsx scripts/splitSpaceMarineChapters.ts
```

**Creates:**
- `space-marines-core.json` - Core Space Marines (18 detachments)
- `blood-angels.json` - Blood Angels (3 detachments)
- `dark-angels.json` - Dark Angels (5 detachments)
- `space-wolves.json` - Space Wolves (4 detachments)
- `deathwatch.json` - Deathwatch (2 detachments)

---

## Admin UI

### Importing Data

1. Go to `/admin/factions`
2. Click **"Import Data"** button
3. **From Wahapedia:**
   - Select faction from dropdown
   - Click "Import from Wahapedia"
   - Wait for scraping and import (may take 30-60 seconds)
4. **From JSON:**
   - Click "Choose File" and select a JSON file
   - Click "Import JSON"

### Exporting Data

1. Go to `/admin/factions`
2. Find the faction row
3. Click **"Export"** button on that row
4. JSON file will download

### Bulk Export

1. Go to `/admin/factions`
2. Click **"Export All JSON"** link
3. Complete database export will download

---

## Troubleshooting

### "Validation failed" Error

The JSON file doesn't match the expected schema. Check:
- All required fields are present (`name`, `keywords` for faction)
- Stratagems have all required fields (`name`, `cpCost`, `type`, `when`, `target`, `effect`)
- Data types are correct (numbers vs strings)

### "Faction already exists" Warning

Use `--update` flag to update existing records:

```bash
npx tsx scripts/importFaction.ts data.json --update
```

### Scraper Returns 0 Items

1. Check if the faction slug is correct
2. Try `--skip-cache` to force fresh download
3. Check if Wahapedia structure changed (may need scraper updates)

### Character Encoding Issues

Some faction names have special characters (e.g., Lion's Blade uses curly apostrophe `'` not `'`). The scraper handles this automatically, but manual JSON files may need Unicode escapes:

```json
"name": "Lion\u2019s Blade Task Force"
```

### Database Connection Errors

Ensure your database is running and `DATABASE_URL` is set correctly in `.env`.

---

## Related Documentation

- [Faction System](../features/FACTION_SYSTEM.md) - How factions are structured
- [Admin Panel](../features/ADMIN_PANEL.md) - Admin UI documentation
- [Wahapedia Scraping Guide](WAHAPEDIA_SCRAPING_GUIDE.md) - General scraping documentation

