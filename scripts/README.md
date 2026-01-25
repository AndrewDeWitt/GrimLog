# Datasheet Scraping & Import Scripts

This directory contains scripts to scrape Warhammer 40K datasheets from Wahapedia and import them into the TacLog database.

## Quick Start - Space Wolves Example

```bash
# 1. Scrape HTML from Wahapedia (takes ~2-3 minutes)
tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"

# 2. Parse HTML to JSON using GPT-5-mini (takes ~5-10 minutes, costs ~$0.50-$1.50)
tsx scripts/parseDatasheets.ts "space-marines"

# 3. Import parsed data to database (takes ~30 seconds)
tsx scripts/seedDatasheets.ts "space-marines"

# 4. Validate the import
tsx scripts/validateImport.ts "space-marines" "space-wolves"
```

## Script Overview

### 1. scrapeWahapedia.ts

Scrapes raw HTML from Wahapedia.ru with rate limiting and caching.

**Usage:**
```bash
tsx scripts/scrapeWahapedia.ts <faction> [subfaction] [--skip-cache]
```

**Examples:**
```bash
# Space Wolves (Space Marines subfaction)
tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"

# All Tyranids
tsx scripts/scrapeWahapedia.ts "tyranids"

# Force re-scrape (skip cache)
tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves" --skip-cache
```

**Output:**
- Cached HTML files: `data/wahapedia-cache/<faction>/*.html`
- Metadata JSON: `data/wahapedia-cache/<faction>/*.json`
- Summary: `data/wahapedia-cache/<faction>/scrape-summary.json`

**Features:**
- 1.5 second rate limiting (respectful to Wahapedia)
- Automatic retry with exponential backoff
- Caches HTML to avoid re-scraping
- Progress tracking and error reporting

### 2. parseDatasheets.ts

Uses GPT-5-mini with structured outputs to parse HTML into structured JSON matching the database schema.

**Usage:**
```bash
tsx scripts/parseDatasheets.ts <faction> [subfaction]
```

**Examples:**
```bash
tsx scripts/parseDatasheets.ts "space-marines" "space-wolves"
tsx scripts/parseDatasheets.ts "tyranids"
```

**Output:**
- Parsed JSON files: `data/parsed-datasheets/<faction>/*.json`
- Summary: `data/parsed-datasheets/<faction>/parse-summary.json`

**Features:**
- Uses GPT-5-mini (faster, cheaper than GPT-4)
- Structured outputs with JSON schema validation
- Strict mode ensures guaranteed schema compliance
- Validates all data with Zod schemas for double-checking
- 1 second rate limiting for OpenAI API
- Comprehensive error handling

**Cost Estimate:**
- ~$0.01-0.03 per datasheet (cheaper than GPT-4)
- ~$0.50-$1.50 for 40-50 datasheets (Space Wolves)

### 3. seedDatasheets.ts

Imports parsed JSON data into PostgreSQL via Prisma.

**Usage:**
```bash
tsx scripts/seedDatasheets.ts <faction>
```

**Examples:**
```bash
tsx scripts/seedDatasheets.ts "space-marines"
tsx scripts/seedDatasheets.ts "tyranids"
```

**Features:**
- Transaction-based imports (all-or-nothing)
- Deduplicates weapons and abilities across units
- Upsert logic (safe to re-run for updates)
- Creates proper junction table relationships
- **Data cleaning pipeline** (v3.1.1+)
  - Strips null bytes (`\x00`) from all text fields
  - Normalizes empty strings to `null` for database
  - Prevents duplicate weapon/ability relationships per datasheet
  - Handles optional fields properly (subfaction, invuln saves, etc.)

**What it imports:**
- Datasheets with full stats
- Weapons with profiles (deduplicated)
- Abilities with descriptions (deduplicated)
- Wargear options
- All relationships via junction tables

**Robustness (v3.1.1):**
- 100% success rate on Space Marines (96/96 datasheets)
- Handles UTF-8 encoding issues automatically
- Prevents constraint violations
- Idempotent - safe to re-run

### 4. validateImport.ts

Validates imported datasheets against known data.

**Usage:**
```bash
tsx scripts/validateImport.ts <faction> [subfaction]
```

**Examples:**
```bash
tsx scripts/validateImport.ts "space-marines" "space-wolves"
```

**Checks:**
- Database records exist
- Required fields populated
- Stats in valid ranges (T: 1-12, etc.)
- Weapons have proper profiles
- Abilities have descriptions

## Data Flow

```
Wahapedia.ru
    ↓
[1. scrapeWahapedia.ts]
    ↓
HTML Cache (data/wahapedia-cache/)
    ↓
[2. parseDatasheets.ts + GPT-4]
    ↓
JSON Files (data/parsed-datasheets/)
    ↓
[3. seedDatasheets.ts]
    ↓
PostgreSQL Database (via Prisma)
    ↓
[AI uses in game sessions]
```

## Folder Structure

```
data/
├── wahapedia-cache/
│   └── space-marines/
│       ├── index.html
│       ├── Logan_Grimnar.html
│       ├── Logan_Grimnar.json
│       ├── Arjac_Rockfist.html
│       ├── Arjac_Rockfist.json
│       └── scrape-summary.json
│
└── parsed-datasheets/
    └── space-marines/
        ├── Logan_Grimnar.json
        ├── Arjac_Rockfist.json
        └── parse-summary.json
```

## Expanding to Other Factions

Once Space Wolves is validated, expand to other factions:

### All Space Marines Subfactions
```bash
tsx scripts/scrapeWahapedia.ts "space-marines" "blood-angels"
tsx scripts/scrapeWahapedia.ts "space-marines" "dark-angels"
tsx scripts/scrapeWahapedia.ts "space-marines" "ultramarines"
# etc...
```

### Other Factions
```bash
tsx scripts/scrapeWahapedia.ts "tyranids"
tsx scripts/scrapeWahapedia.ts "necrons"
tsx scripts/scrapeWahapedia.ts "orks"
# etc...
```

## Maintenance & Updates

When GW releases errata or balance updates:

```bash
# Re-scrape (skip cache) and re-import
tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves" --skip-cache
tsx scripts/parseDatasheets.ts "space-marines" "space-wolves"
tsx scripts/seedDatasheets.ts "space-marines"
```

The seeder uses upsert logic, so it will update existing records.

## Troubleshooting

### "No cached data found"
Run the scraper first: `tsx scripts/scrapeWahapedia.ts ...`

### "No parsed data found"
Run the parser first: `tsx scripts/parseDatasheets.ts ...`

### GPT-4 parsing errors
- Check OpenAI API key is set: `OPENAI_API_KEY`
- Check API quota/limits
- Review parse-summary.json for error details

### Database errors
- Ensure database is running
- Check DATABASE_URL in .env
- Run `npx prisma db push` to sync schema

### Validation errors
- Check data/parsed-datasheets/<faction>/ for JSON files
- Review individual JSON files for incomplete data
- Re-run parser with `--skip-cache` if needed

## API Endpoints

Once datasheets are imported, they're available via API:

### Get Single Datasheet
```
GET /api/datasheets/space-marines/Logan-Grimnar
```

### Search Datasheets
```
GET /api/datasheets/search?q=Logan&faction=Space%20Marines
```

### List Faction Datasheets
```
GET /api/datasheets/faction/space-marines?subfaction=space-wolves
```

### Lookup Weapon
```
GET /api/weapons/lookup?name=Foehammer
```

### Lookup Ability
```
GET /api/abilities/lookup?name=Oath%20of%20Moment
```

## Cost Estimates

### Initial Import (Space Wolves ~40-50 datasheets)
- Scraping: Free (just bandwidth)
- Parsing with GPT-5-mini: $0.50-$1.50 USD (cheaper than GPT-4!)
- Database storage: Negligible (~5-10 MB)

### Full Game Import (all factions ~2000 datasheets)
- Scraping: Free
- Parsing with GPT-5-mini: $20-$60 USD (half the cost of GPT-4!)
- Database storage: ~200-400 MB

### AI Context Usage (per game session)
- With datasheets: +500-1000 tokens per analysis
- Cost increase: ~$0.001-0.002 per analysis
- Benefit: Much better rules accuracy and validation

## Best Practices

1. **Always scrape first** - Ensures you have fresh HTML
2. **Parse in batches** - Don't parse all factions at once (API rate limits)
3. **Validate before expanding** - Get 1 faction working perfectly first
4. **Keep cache** - Don't use --skip-cache unless necessary
5. **Check summaries** - Review scrape-summary.json and parse-summary.json for errors
6. **Test after import** - Use validateImport.ts to verify data quality

## Next Steps

See `wahapedia-datasheet-integration.plan.md` for the complete implementation plan and next phases.

