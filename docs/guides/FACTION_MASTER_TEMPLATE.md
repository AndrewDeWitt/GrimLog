# Faction Master Template

**Last Updated:** 2025-12-30  
**Status:** Complete

## Overview

This document serves as the master template for adding new factions to Grimlog. Follow this checklist and workflow to ensure complete faction data import from Wahapedia, including datasheets, faction rules, detachments, stratagems, enhancements, and icons.

## Table of Contents

- [Faction Data Checklist](#faction-data-checklist)
- [Complete Pipeline Workflow](#complete-pipeline-workflow)
- [Step-by-Step Commands](#step-by-step-commands)
- [Validation Steps](#validation-steps)
- [Icon Upload Guide](#icon-upload-guide)
- [Competitive Context Guide](#competitive-context-guide)
- [Troubleshooting](#troubleshooting)

---

## Faction Data Checklist

Use this checklist to track progress for each new faction:

### Faction: ________________________

| Component | Status | Count | Notes |
|-----------|--------|-------|-------|
| **Faction Record** | ☐ | 1 | Faction name, keywords, parent faction |
| **Army Rules** | ☐ | ___ | Faction-wide abilities (e.g., Voice of Command) |
| **Detachments** | ☐ | ___ | Each with ability name and description |
| **Stratagems** | ☐ | ___ | 6 per detachment typically |
| **Enhancements** | ☐ | ___ | 4 per detachment typically |
| **Datasheets** | ☐ | ___ | All tournament-legal units |
| **Weapons** | ☐ | ___ | Auto-created during datasheet import |
| **Abilities** | ☐ | ___ | Auto-created during datasheet import |
| **Icons** | ☐ | ___ | Manual upload required |
| **Competitive Sources** | ☐ | ___ | YouTube, Reddit, articles (5+ recommended) |
| **Competitive Context** | ☐ | ___ | Tier rankings and meta analysis per unit |

---

## Complete Pipeline Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FACTION IMPORT PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 1: FACTION DATA (Rules, Detachments, Stratagems)          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Step 1: SCRAPE FACTION RULES                                           │
│  ─────────────────────────────                                          │
│  npx tsx scripts/scrapeWahapediaComplete.ts <faction-slug>              │
│  Output: data/wahapedia-import/<faction>.json                           │
│                                                                          │
│  Step 2: IMPORT TO DATABASE                                             │
│  ─────────────────────────────                                          │
│  npx tsx scripts/importFaction.ts data/wahapedia-import/<faction>.json  │
│  Creates: Faction, FactionRules, Detachments, Stratagems, Enhancements  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 2: DATASHEETS (Unit Profiles, Weapons, Abilities)         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Step 3: SCRAPE DATASHEETS                                              │
│  ─────────────────────────────                                          │
│  npx tsx scripts/scrapeWahapedia.ts "<faction-slug>"                    │
│  Output: data/wahapedia-cache/<faction>/*.html                          │
│                                                                          │
│  Step 4: PARSE DATASHEETS (GPT-5-mini)                                  │
│  ──────────────────────────────────────                                 │
│  npx tsx scripts/parseDatasheets.ts "<faction-slug>"                    │
│  Output: data/parsed-datasheets/<faction>/*.json                        │
│  Cost: ~$1-3 per faction                                                │
│                                                                          │
│  Step 5: SEED DATASHEETS TO DATABASE                                    │
│  ─────────────────────────────────────                                  │
│  npx tsx scripts/seedDatasheets.ts "<faction-slug>"                     │
│  Creates: Datasheets, Weapons, Abilities with relationships             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 3: VALIDATION & ICONS                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Step 6: VALIDATE IMPORT                                                │
│  ─────────────────────────────                                          │
│  npx tsx scripts/validateImport.ts "<faction-slug>"                     │
│  Checks: Data integrity, stat ranges, relationships                     │
│                                                                          │
│  Step 7: UPLOAD ICONS (Manual)                                          │
│  ─────────────────────────────                                          │
│  Admin UI: /admin/icons                                                 │
│  Upload PNG icons for each unit                                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 4: COMPETITIVE CONTEXT (Expert Meta Analysis)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Step 8: ADD COMPETITIVE SOURCES (Admin UI)                             │
│  ───────────────────────────────────────────                            │
│  Admin UI: /admin/factions → Select Faction → Add Source                │
│  Add YouTube videos, Reddit posts, articles about faction meta          │
│                                                                          │
│  Step 9: PROCESS PIPELINE (Python)                                      │
│  ─────────────────────────────────                                      │
│  python3 scripts/youtube_transcribe.py --process-all                    │
│  Fetches content, identifies units, extracts context                    │
│                                                                          │
│  Step 10: AGGREGATE CONTEXT (Python)                                    │
│  ───────────────────────────────────                                    │
│  python3 scripts/youtube_transcribe.py --aggregate-all \                │
│    --faction-name "<Faction Name>"                                      │
│  Synthesizes all sources into tier rankings per unit                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Commands

### Prerequisites

Ensure you have:
- Node.js installed
- PostgreSQL database running
- `DATABASE_URL` configured in `.env`
- `OPENAI_API_KEY` configured in `.env`
- Database schema up to date: `npx prisma db push`

### Phase 1: Faction Data

#### Step 1: Scrape Faction Rules from Wahapedia

```bash
# Replace <faction-slug> with the faction name (lowercase, hyphenated)
# Examples: tyranids, space-marines, astra-militarum, orks

npx tsx scripts/scrapeWahapediaComplete.ts <faction-slug>
```

**Expected Output:**
```
✅ Scraped Astra Militarum
   Army Rules: 1
   Detachments: 7
   Stratagems: 42
   Enhancements: 28
📁 Saved to: data/wahapedia-import/astra-militarum.json
```

#### Step 2: Import Faction to Database

```bash
# Dry run first to validate
npx tsx scripts/importFaction.ts data/wahapedia-import/<faction>.json --dry-run

# If validation passes, import for real
npx tsx scripts/importFaction.ts data/wahapedia-import/<faction>.json --update
```

**Expected Output:**
```
📊 IMPORT SUMMARY
   Faction: Astra Militarum (created)
   Army Rules:   1 created, 0 updated, 0 skipped
   Detachments:  7 created, 0 updated, 0 skipped
   Stratagems:   42 created, 0 updated, 0 skipped
   Enhancements: 28 created, 0 updated, 0 skipped
✅ Import completed successfully!
```

### Phase 2: Datasheets

#### Step 3: Scrape Unit Datasheets

```bash
npx tsx scripts/scrapeWahapedia.ts "<faction-slug>"

# Force fresh download (skip cache)
npx tsx scripts/scrapeWahapedia.ts "<faction-slug>" --skip-cache
```

**Expected Output:**
```
📊 Found 65 tournament-legal datasheets
✅ Success: 65
❌ Failed: 0
✨ Scrape complete!
```

#### Step 4: Parse Datasheets with AI

```bash
npx tsx scripts/parseDatasheets.ts "<faction-slug>"

# Resume from a specific datasheet if interrupted
npx tsx scripts/parseDatasheets.ts "<faction-slug>" --start-from=30
```

**Expected Output:**
```
📊 Found 65 datasheets to parse

[1/65] Parsing Ursula_Creed...
   Original HTML size: 2518 KB
   Cleaned content size: 12 KB (100% reduction)
✅ Parsed and validated Ursula Creed

...

==================================================
📊 Parse Summary for astra-militarum
==================================================
✅ Success: 65
❌ Failed: 0
```

**Cost:** ~$0.01-0.03 per datasheet = $1-3 total per faction

#### Step 5: Seed Datasheets to Database

```bash
npx tsx scripts/seedDatasheets.ts "<faction-slug>"
```

**Expected Output:**
```
📊 Found 65 datasheets to import

✅ Imported Ursula Creed with 3 weapons, 5 abilities
✅ Imported Lord Solar Leontus with 4 weapons, 6 abilities
...

==================================================
📊 Seed Summary for astra-militarum
==================================================
✅ Success: 65
❌ Failed: 0
```

### Phase 3: Validation & Icons

#### Step 6: Validate Import

```bash
npx tsx scripts/validateImport.ts "<faction-slug>"
```

**Expected Output:**
```
📊 Validation Report for astra-militarum
Total Datasheets: 65
Valid: 65 (100%)
Issues Found: 0

✅ All datasheets passed validation!

🎯 Spot Check: Testing specific units
Checking Ursula Creed...
  ✅ Found
  Stats: M 6" | T 3 | Sv 4+ | W 4 | Ld 6 | OC 1
  Weapons: 3
  Abilities: 5
  Points: 55
```

#### Step 7: Upload Icons

1. Navigate to `/admin/icons` in the admin panel
2. Select the faction from the dropdown
3. For each unit:
   - Search for reference images
   - Upload a PNG icon (recommended: 256x256px)
   - Verify the icon displays correctly

---

## Validation Steps

After completing all imports, verify:

### Database Verification

```sql
-- Check faction exists
SELECT name, "metaData" FROM "Faction" WHERE name = 'Astra Militarum';

-- Count detachments
SELECT COUNT(*) FROM "Detachment" WHERE faction = 'Astra Militarum';

-- Count stratagems
SELECT COUNT(*) FROM "StratagemData" WHERE faction = 'Astra Militarum';

-- Count enhancements
SELECT COUNT(*) FROM "Enhancement" WHERE faction = 'Astra Militarum';

-- Count datasheets
SELECT COUNT(*) FROM "Datasheet" WHERE faction = 'Astra Militarum';
```

### UI Verification

1. **Army Builder**: Create a new army with the faction
   - ☐ Faction appears in dropdown
   - ☐ Detachments load correctly
   - ☐ Units are available for selection

2. **Datasheet Library**: Browse `/datasheets`
   - ☐ Filter by new faction works
   - ☐ Unit details display correctly
   - ☐ Weapons and abilities show

3. **Session Creation**: Start a battle
   - ☐ Faction armies can be selected
   - ☐ Units initialize correctly
   - ☐ Stratagems are available

---

## Icon Upload Guide

### Requirements

- **Format:** PNG (transparent background preferred)
- **Size:** 256x256 pixels recommended
- **Style:** Consistent with existing icons

### Upload Process

1. Go to `/admin/icons`
2. Select the faction
3. For each unit without an icon:
   - Click the unit row
   - Use the search to find reference images
   - Click "Upload" and select your PNG file
   - Verify the icon appears correctly

### Batch Upload Tips

- Prepare all icons in advance in a folder
- Name files to match unit names (e.g., `Ursula_Creed.png`)
- Use consistent styling across all icons

---

## Competitive Context Guide

Competitive context provides expert meta analysis including tier rankings (S/A/B/C/D/F), best targets, counters, synergies, and tactical advice for each unit.

### Step 8: Add Competitive Sources

1. Navigate to `/admin/factions` in the admin panel
2. Click on the faction (e.g., "Astra Militarum")
3. In the "📚 Competitive Sources" section, click "Add Source"
4. Enter details:
   - **URL**: YouTube video, Reddit post, or article URL
   - **Source Type**: "youtube", "reddit", "article", or "forum"
   - **Detachment** (optional): Select if content is detachment-specific

**Recommended Sources for New Factions:**
- YouTube: "Art of War 40k" faction tier lists
- YouTube: "Auspex Tactics" faction breakdowns
- YouTube: Competitive player faction guides
- Reddit: r/WarhammerCompetitive faction threads
- Articles: Goonhammer faction reviews

### Step 9: Process Pipeline

After adding sources, run the Python pipeline to process them:

```bash
# Ensure environment variables are set
export GOOGLE_API_KEY="your-gemini-key"

# DEPRECATED: The Python script is deprecated for production use.
# Use the Admin UI at /admin for all data management operations.
# The script can still be used for local development against dev database.

# Process all pending sources (fetch → curate → extract)
python3 scripts/youtube_transcribe.py --process-all
```

**Pipeline Stages:**
1. **Fetch**: Downloads YouTube transcripts, Reddit JSON, article HTML
2. **Curate**: AI identifies which units are mentioned in each source
3. **Extract**: AI extracts unit-specific competitive insights

### Step 10: Aggregate Context

After extraction, synthesize all sources into final competitive context:

```bash
# Aggregate all units for a faction
python3 scripts/youtube_transcribe.py --aggregate-all --faction-name "Astra Militarum"

# Or aggregate a specific unit
python3 scripts/youtube_transcribe.py --aggregate --datasheet-name "Leman Russ Battle Tank"
```

**What This Creates:**
- `competitiveTier`: S/A/B/C/D/F ranking
- `tierReasoning`: Explanation for the tier
- `bestTargets`: Ideal targets for the unit
- `counters`: Threats to watch out for
- `synergies`: Units that work well together
- `playstyleNotes`: How to use the unit effectively
- `deploymentTips`: Deployment advice

### Verification

```sql
-- Check competitive context was created
SELECT d.name, dcc."competitiveTier", dcc."tierReasoning"
FROM "DatasheetCompetitiveContext" dcc
JOIN "Datasheet" d ON d.id = dcc."datasheetId"
JOIN "Faction" f ON f.id = dcc."factionId"
WHERE f.name = 'Astra Militarum'
ORDER BY d.name
LIMIT 10;
```

---

## Troubleshooting

### "No cached data found"

**Solution:** Run the scraper first
```bash
npx tsx scripts/scrapeWahapedia.ts "<faction-slug>"
```

### "No parsed data found"

**Solution:** Run the parser first
```bash
npx tsx scripts/parseDatasheets.ts "<faction-slug>"
```

### "Faction already exists"

**Solution:** Use `--update` flag to update existing records
```bash
npx tsx scripts/importFaction.ts data/wahapedia-import/<faction>.json --update
```

### Parser crashes mid-way

**Solution:** Resume from where it stopped
```bash
npx tsx scripts/parseDatasheets.ts "<faction-slug>" --start-from=30
```

### Database connection errors

**Solution:** Verify database is running and connection string is correct
```bash
npx prisma db pull
```

### Character encoding issues

**Solution:** The scripts handle UTF-8 normalization automatically. If you see issues, ensure your JSON files are saved with UTF-8 encoding.

---

## Supported Factions

| Slug | Faction Name | Status |
|------|--------------|--------|
| `tyranids` | Tyranids | ✅ Complete |
| `space-marines` | Space Marines | ✅ Complete |
| `astra-militarum` | Astra Militarum | ✅ Complete |
| `orks` | Orks | Available |
| `necrons` | Necrons | Available |
| `aeldari` | Aeldari | Available |
| `chaos-space-marines` | Chaos Space Marines | Available |
| `t-au-empire` | T'au Empire | Available |
| `adeptus-custodes` | Adeptus Custodes | Available |
| `grey-knights` | Grey Knights | Available |
| `adepta-sororitas` | Adepta Sororitas | Available |
| `death-guard` | Death Guard | Available |
| `thousand-sons` | Thousand Sons | Available |
| `world-eaters` | World Eaters | Available |
| `drukhari` | Drukhari | Available |
| `chaos-daemons` | Chaos Daemons | Available |
| `genestealer-cults` | Genestealer Cults | Available |
| `leagues-of-votann` | Leagues of Votann | Available |
| `adeptus-mechanicus` | Adeptus Mechanicus | Available |
| `imperial-knights` | Imperial Knights | Available |
| `chaos-knights` | Chaos Knights | Available |
| `imperial-agents` | Imperial Agents | Available |

---

## Related Documentation

- [Faction Data Import Guide](FACTION_DATA_IMPORT_GUIDE.md) - Detailed import guide
- [Datasheet Import Guide](DATASHEET_IMPORT_GUIDE.md) - Datasheet-specific details
- [Wahapedia Scraping Guide](WAHAPEDIA_SCRAPING_GUIDE.md) - Scraping troubleshooting
- [Competitive Context Database](../features/COMPETITIVE_CONTEXT_DATABASE.md) - Full competitive context system docs
- [Admin Panel](../features/ADMIN_PANEL.md) - Admin UI documentation

