# Wahapedia Scraping Guide

**Last Updated:** 2026-01-10
**Status:** Complete

## Overview

This guide explains how to scrape Warhammer 40K 10th Edition rules data from Wahapedia using the Grimlog scraping scripts. The scraping system is designed to be respectful (rate-limited, cached), maintainable (modular, error-handled), and accurate (multi-signal Legends detection, quality scoring).

## Table of Contents

- [Available Scrapers](#available-scrapers)
- [Prerequisites](#prerequisites)
- [Scraping Datasheets](#scraping-datasheets)
- [Legends/Forge World Detection](#legendsforge-world-detection)
- [Quality Scoring System](#quality-scoring-system)
- [Scraping Stratagems](#scraping-stratagems)
- [Scraping Detachments](#scraping-detachments)
- [Caching System](#caching-system)
- [Seeding Database](#seeding-database)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Available Scrapers

| Script | Purpose | Output |
|--------|---------|--------|
| `scripts/scrapeWahapedia.ts` | Unit datasheets | `data/wahapedia-cache/{faction}/` |
| `scripts/scrapeStratagems.ts` | Stratagem rules | `data/parsed-rules/stratagems-{faction}.json` |
| `scripts/scrapeDetachments.ts` | Detachment lists | `data/parsed-rules/detachments-{faction}.json` |

## Prerequisites

**Required:**
- Node.js 18+
- TypeScript (`tsx` CLI)
- Internet connection
- `cheerio` package (for HTML parsing)

**Install dependencies:**
```bash
npm install
```

## Scraping Datasheets

### Purpose
Scrapes unit datasheets (stats, weapons, abilities) for army list matching.

### Usage

```bash
# Space Marines (base faction)
npx tsx scripts/scrapeWahapedia.ts "space-marines"

# Space Wolves (subfaction)
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"

# Tyranids
npx tsx scripts/scrapeWahapedia.ts "tyranids"
```

### Options

```bash
--skip-cache          # Re-fetch all pages (ignore cache)
--include-legends     # Include Legends units (default: skip)
--include-forge-world # Include Forge World units (default: skip)
```

### Output

Cached HTML files:
```
data/wahapedia-cache/
  └── space-marines/
      ├── index.html
      ├── Intercessor_Squad.html
      ├── Intercessor_Squad.json (metadata)
      └── scrape-summary.json
```

### Next Step

After scraping, run the datasheet parser and seeder:
```bash
npx tsx scripts/parseDatasheets.ts "space-marines"
npx tsx scripts/seedDatasheets.ts
```

## Legends/Forge World Detection

The scraper uses a **multi-signal weighted detection system** to accurately identify Legends and Forge World units.

### Detection Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| `css_class` | 10 | `.sLegendary` or `.sForgeWorld` CSS class on link element or parent |
| `url_pattern` | 5 | `/legends/`, `_legends`, `/fw/` in URL path |
| `name_pattern` | 3 | Known patterns: "(Legendary)", "Relic", "Sicaran", "Terrax", etc. |
| `hardcoded_fallback` | 2 | Known unit names list (edge case validation) |

### How It Works

1. **Index Page Detection:** When parsing the faction index, the scraper checks each link's parent element (`.ArmyType_line`) for the `.sLegendary` CSS class
2. **Score Calculation:** Each detected signal adds its weight to the score
3. **Threshold:** Units with score >= 3 are classified as Legends/Forge World
4. **Confidence Levels:**
   - `high` (score >= 10): CSS class detected - most reliable
   - `medium` (score >= 5): URL or multiple signals
   - `low` (score < 5): Name pattern only

### Detection Functions

```typescript
// For index page links (with DOM element context)
detectLegendsFromElement(name, $, linkEl, url)

// For standalone detection (no DOM context)
detectLegendsFromNameAndUrl(name, url)

// For individual datasheet pages (scoped to .dsOuterFrame)
detectClassificationFromPage($, url, name)
```

### Example Output

```
⏭️ Skipping Legends: Relic Razorback (css_class, name_pattern)
⏭️ Skipping Forge World: Astraeus (css_class, name_pattern)
⏭️ Skipping Legends: Land Speeder Storm (css_class)
```

## Quality Scoring System

Each scraped datasheet receives a quality score (0-100) based on data completeness.

### Scoring Criteria

| Component | Points | Condition |
|-----------|--------|-----------|
| Stats | 20 | Extracted M/T/Sv/W/Ld/OC values |
| Weapons | 20 | At least one weapon found |
| Keywords | 20 | At least one keyword found |
| Abilities | 20 | At least one ability found |
| Name | 10 | Unit name matches expected |
| Points | 10 | Points cost extracted |

### Quality Thresholds

- **80+**: Excellent - all major data extracted
- **60-79**: Good - core data present
- **40-59**: Fair - some data missing
- **< 40**: Poor - needs investigation

### Metadata Files

Each datasheet generates a `.meta.json` file:

```json
{
  "url": "https://wahapedia.ru/wh40k10ed/factions/space-marines/Captain",
  "scrapedAt": "2026-01-10T10:30:00.000Z",
  "contentHash": "abc123...",
  "qualityScore": 75,
  "classification": {
    "isLegends": false,
    "isForgeWorld": false,
    "confidence": "high",
    "signals": []
  },
  "preParsed": {
    "statsFound": true,
    "weaponsCount": 4,
    "abilitiesCount": 3,
    "keywordsCount": 8
  }
}
```

### Cache Freshness

The `contentHash` (SHA-256 of HTML) enables detection of changed content:
- If hash matches, content unchanged - use cache
- If hash differs, Wahapedia was updated - consider re-scraping

## Scraping Stratagems

### Purpose
Scrapes stratagem rules (name, CP cost, effect, detachment) for gameplay assistance.

### Usage

```bash
npx tsx scripts/scrapeStratagems.ts "space-marines"
npx tsx scripts/scrapeStratagems.ts "tyranids"
```

### How It Works

1. **URL Strategy**: Tries multiple URLs to find stratagems
   - Unit pages (e.g., `/Intercessor-Squad`) contain all faction stratagems
   - Falls back to faction index if needed

2. **Parsing Logic**: Extracts from `.s10Wrap` elements
   - Name from `.s10Name`
   - Type from `.s10Type` (e.g., "Gladius Task Force – Battle Tactic")
   - CP cost from `.s10NameWrapCP`
   - Rule text from `.str10Text`

3. **Detachment Detection**: Parses type field to extract detachment
   - Format: `"Detachment Name – Stratagem Type"`
   - Example: `"Gladius Task Force – Battle Tactic"` → detachment = "Gladius Task Force"

### Output Format

```json
{
  "stratagems": [
    {
      "name": "ADAPTIVE STRATEGY",
      "type": "Strategic Ploy",
      "cpCost": "1",
      "phase": "Any",
      "fluff": "",
      "when": "",
      "target": "",
      "effect": "",
      "restrictions": "",
      "detachment": "Gladius Task Force",
      "faction": "space-marines",
      "source": "Wahapedia"
    }
  ]
}
```

**Saved to:** `data/parsed-rules/stratagems-{faction}.json`

### Seeding

Import scraped stratagems into the database:

```bash
npx tsx scripts/seedStratagems.ts
```

This will:
- Read all `stratagems-*.json` files
- Upsert into `StratagemData` table
- Link by `name + faction + detachment`

**Verification:**
```sql
SELECT COUNT(*) FROM "StratagemData";
-- Should show 130+ for Space Marines
```

## Scraping Detachments

### Purpose
Extracts valid detachment names for each faction to aid in army list parsing.

### Usage

```bash
npx tsx scripts/scrapeDetachments.ts
```

This scrapes all supported factions:
- `space-marines`
- `space-wolves`
- `tyranids`

### How It Works

1. Fetches unit pages (same as stratagem scraper)
2. Parses all `.s10Type` fields from stratagems
3. Extracts unique detachment names
4. Filters out "Core" and "Boarding Actions" (not army detachments)
5. Saves sorted list

### Output Format

```json
{
  "faction": "space-marines",
  "detachments": [
    "1st Company Task Force",
    "Gladius Task Force",
    "Saga of the Beastslayer",
    "Firestorm Assault Force",
    ...
  ],
  "updatedAt": "2025-11-18T..."
}
```

**Saved to:** `data/parsed-rules/detachments-{faction}.json`

### Usage in Parser

The army list parser (`/api/armies/parse`) loads these files to:
- Provide known detachment names to the LLM
- Validate detected detachment against known list
- Distinguish detachments from battle sizes (Strike Force, Incursion, etc.)

## Caching System

### How Caching Works

All scrapers use a file-based cache in `data/wahapedia-cache/`:

1. **Cache Key**: `{faction}/{page-name}`
2. **Cache File**: `{cache-key}.html`
3. **Cache Check**: Before fetching, checks if file exists
4. **Skip Cache**: Use `--skip-cache` flag to force re-fetch

### Cache Benefits

- **Respectful**: Reduces load on Wahapedia servers
- **Fast**: Instant access after first fetch
- **Offline**: Can re-run parsers without internet
- **Debugging**: Can inspect raw HTML when parsing fails

### Cache Management

**Clear cache for specific faction:**
```bash
rm -rf data/wahapedia-cache/space-marines/
```

**Clear all caches:**
```bash
rm -rf data/wahapedia-cache/
```

**Re-scrape with fresh data:**
```bash
npx tsx scripts/scrapeStratagems.ts "space-marines" --skip-cache
```

## Seeding Database

### Stratagem Seeding

**Script:** `scripts/seedStratagems.ts`

**Process:**
1. Scans `data/parsed-rules/` for `stratagems-*.json` files
2. For each stratagem:
   - Parses CP cost to integer
   - Checks for existing entry (by name + faction + detachment)
   - Upserts to `StratagemData` table
3. Reports statistics

**Example Output:**
```
🌱 Seeding Stratagems...

📦 Processing stratagems-space-marines.json...
  ✅ Added: 130, ↻ Updated: 0, ❌ Errors: 0

✨ Stratagem seeding complete!
```

### Datasheet Seeding

**Script:** `scripts/seedDatasheets.ts`

Similar process for unit datasheets (see existing datasheet documentation).

## Troubleshooting

### Problem: All units detected as Legends

**Cause:** Detection checking wrong element (e.g., page body instead of link parent)

**Solution:**
1. Verify detection is using `detectLegendsFromElement()` with actual link element
2. Check that it's looking at `.ArmyType_line` parent, not `$('body')`
3. Run with `--verbose` to see detection signals:
   ```bash
   npx tsx scripts/scrapeWahapedia.ts space-marines space-wolves --dry-run --verbose
   ```
4. Signals should show `css_class` only for actual Legends units

### Problem: Legends units not being skipped

**Cause:** CSS selector not matching Wahapedia's current HTML structure

**Solution:**
1. Inspect cached index HTML: `data/wahapedia-cache/{faction}/index.html`
2. Search for `sLegendary` to find the class pattern
3. Update `NAV_SELECTORS` in `wahapediaTypes.ts` if structure changed

### Problem: "Found 0 stratagems"

**Cause:** Wrong URL or HTML structure changed

**Solution:**
1. Check cache file: `data/wahapedia-cache/{faction}/{page}.html`
2. Verify `.s10Wrap` elements exist in HTML
3. Try different unit page:
   ```bash
   # Edit scripts/scrapeStratagems.ts
   # Change the URL in urlsToTry array
   ```

### Problem: "HTTP 404: Not Found"

**Cause:** Invalid faction name or URL

**Solutions:**
- ✅ Use lowercase faction names: `"space-marines"` not `"Space Marines"`
- ✅ Check Wahapedia URL manually in browser
- ✅ For subfactions, use the parent faction path:
  - Space Wolves: Use `"space-marines"` faction, will find SW-specific stratagems

### Problem: Detachment parsing incorrect

**Cause:** Type field format changed on Wahapedia

**Solution:**
1. Inspect scraped JSON in `data/parsed-rules/stratagems-*.json`
2. Check the `type` and `detachment` fields
3. Update parsing logic in `scripts/scrapeStratagems.ts`:
   ```typescript
   const parts = typeText.split('–').map(s => s.trim());
   ```

### Problem: Rate limiting or timeouts

**Cause:** Too many requests too quickly

**Solution:**
- The scraper has built-in rate limiting (1.5s between requests)
- If still timing out, increase `RATE_LIMIT_MS` in the script
- Use cache to avoid re-fetching: remove `--skip-cache` flag

## Best Practices

1. **Always use cache first**: Only use `--skip-cache` when Wahapedia data has changed
2. **Scrape in batches**: Don't scrape all factions at once on first run
3. **Verify output**: Check JSON files before seeding to database
4. **Keep scrapers updated**: Wahapedia layout may change with new editions
5. **Document changes**: If you update parsing logic, note it in CHANGELOG

## Related Documentation

- [Stratagem Tracking Feature](../features/STRATAGEM_TRACKING.md) - Overall system architecture
- [Datasheet Integration](../features/DATASHEET_INTEGRATION.md) - Unit data structure
- [Database Schema](../ARCHITECTURE.md#database-schema) - Table structures
- [Datasheet Import Guide](DATASHEET_IMPORT_GUIDE.md) - Importing parsed datasheets
- [Faction Data Import Guide](FACTION_DATA_IMPORT_GUIDE.md) - Importing faction data

## Source Files

| File | Purpose |
|------|---------|
| `scripts/scrapeWahapedia.ts` | Main scraping logic |
| `scripts/wahapediaTypes.ts` | Type definitions and selectors |
| `scripts/wahapediaValidation.ts` | Zod validation schemas |

