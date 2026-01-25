# Datasheet Import Guide

**Last Updated:** 2025-10-17  
**Status:** Complete

## Overview

This guide walks you through importing Warhammer 40K datasheets from Wahapedia into Grimlog. After following these steps, your AI assistant will have access to complete unit profiles, weapons, and abilities for accurate rules clarification.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Scrape Datasheets](#step-1-scrape-datasheets)
- [Step 2: Parse with GPT-5-mini](#step-2-parse-with-gpt-5-mini)
- [Step 3: Import to Database](#step-3-import-to-database)
- [Step 4: Validate Import](#step-4-validate-import)
- [Troubleshooting](#troubleshooting)
- [Expanding to Other Factions](#expanding-to-other-factions)

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js installed
- ✅ PostgreSQL database running
- ✅ `OPENAI_API_KEY` in your `.env` file
- ✅ Database schema up to date (`npx prisma db push`)
- ✅ ~$1-3 USD OpenAI credit available

**Verify prerequisites:**
```bash
# Check Node.js
node --version

# Check database connection
npx prisma db pull

# Check OpenAI key
echo $env:OPENAI_API_KEY  # Should show sk-...
```

## Step 1: Scrape Datasheets

Download HTML files from Wahapedia (free, takes ~2-3 minutes).

```bash
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"
```

**What happens:**
- Downloads ~96 tournament-legal unit pages
- Filters out Forge World and Legends units automatically
- Saves HTML to `data/wahapedia-cache/space-marines/`
- Creates metadata JSON for each unit
- Rate limited to 1.5 seconds between requests (respectful to Wahapedia)

**Expected output:**
```
📊 Found 96 tournament-legal datasheets
✅ Success: 96
❌ Failed: 0
✨ Scrape complete!
```

**Verify:**
```bash
# Should show ~192 files (96 HTML + 96 JSON + index + summary)
dir data\wahapedia-cache\space-marines
```

## Step 2: Parse with GPT-5-mini

Convert HTML to structured JSON (~5-10 minutes, ~$1-3 cost).

```bash
npx tsx scripts/parseDatasheets.ts "space-marines"
```

**What happens:**
- Reads each HTML file
- Strips out scripts/CSS/ads (99% size reduction)
- Sends clean content to GPT-5-mini
- GPT extracts stats, weapons, abilities
- Validates with Zod schemas
- Saves JSON to `data/parsed-datasheets/space-marines/`

**Expected output:**
```
📊 Found 96 datasheets to parse

[1/96] Parsing Logan_Grimnar...
   Original HTML size: 2518 KB
   Cleaned content size: 12 KB (100% reduction)
✅ Parsed and validated Logan Grimnar

[2/96] Parsing Arjac_Rockfist...
...

==================================================
📊 Parse Summary for space-marines
==================================================
✅ Success: 96
❌ Failed: 0
```

**Verify:**
```bash
# Should show 96 JSON files + parse-summary.json
dir data\parsed-datasheets\space-marines\*.json
```

**Cost:** This step costs money (~$0.01-0.03 per datasheet = $1-3 total)

## Step 3: Import to Database

Load parsed JSON into PostgreSQL (~30 seconds).

```bash
npx tsx scripts/seedDatasheets.ts "space-marines"
```

**What happens:**
- Reads all JSON files
- Creates Datasheet records
- Creates/deduplicates Weapon records
- Creates/deduplicates Ability records
- Sets up all relationships
- Uses transactions (all-or-nothing)

**Expected output:**
```
📊 Found 96 datasheets to import

✅ Imported Logan Grimnar with 5 weapons, 7 abilities
✅ Imported Arjac Rockfist with 3 weapons, 5 abilities
...

==================================================
📊 Seed Summary for space-marines
==================================================
✅ Success: 96
❌ Failed: 0
```

**Verify in database:**
```sql
SELECT COUNT(*) FROM "Datasheet" WHERE faction = 'Space Marines';
-- Should return: 96

SELECT COUNT(*) FROM "Weapon";
-- Should return: ~80-100 (deduplicated)

SELECT COUNT(*) FROM "Ability";
-- Should return: ~30-50 (deduplicated)
```

## Step 4: Validate Import

Verify data quality (~10 seconds).

```bash
npx tsx scripts/validateImport.ts "space-marines" "space-wolves"
```

**What happens:**
- Checks all datasheets are in database
- Validates stats are in correct ranges
- Verifies weapons and abilities present
- Spot checks famous units (Logan Grimnar, Arjac Rockfist, etc.)

**Expected output:**
```
📊 Validation Report for space-marines
Total Datasheets: 96
Valid: 96 (100%)
Issues Found: 0

✅ All datasheets passed validation!

🎯 Spot Check: Testing specific units
Checking Logan Grimnar...
  ✅ Found
  Stats: M 6" | T 5 | Sv 2+ | W 8 | Ld 6 | OC 1
  Weapons: 5
  Abilities: 7
  Points: 110
```

## Testing the Integration

### Test API Endpoints

```bash
# Get Logan Grimnar's datasheet
curl http://localhost:3000/api/datasheets/space-marines/Logan-Grimnar

# Search for units
curl http://localhost:3000/api/datasheets/search?q=Grey%20Hunters

# List all Space Wolves
curl "http://localhost:3000/api/datasheets/faction/space-marines?subfaction=space-wolves"
```

### Test in Game Session

1. Start Grimlog and create a new game session
2. Add Space Wolves units to your army
3. Test voice command: **"What's Logan Grimnar's toughness?"**
4. AI should respond: **"Logan Grimnar has Toughness 5"**
5. Test combat: **"Can Grey Hunters wound a Dreadnought?"**
6. AI should calculate wound rolls accurately

## Troubleshooting

### "No cached data found"

**Problem:** Parser can't find HTML files

**Solution:** Run the scraper first
```bash
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"
```

### "No parsed data found"

**Problem:** Seeder can't find JSON files

**Solution:** Run the parser first
```bash
npx tsx scripts/parseDatasheets.ts "space-marines"
```

### "OpenAI API error"

**Problem:** Missing or invalid API key

**Solution:** 
1. Check `.env` file has `OPENAI_API_KEY=sk-...`
2. Verify API credits: https://platform.openai.com/usage
3. Check OpenAI status: https://status.openai.com

### "Invalid schema" errors during parsing

**Problem:** Structured outputs schema mismatch

**Solution:** This is already fixed in the latest code. Ensure you're using:
- All optional fields as required with empty strings
- No custom temperature values with gpt-5-mini

### Validation errors

**Problem:** Some datasheets incomplete

**Solution:**
1. Review `data/parsed-datasheets/<faction>/parse-summary.json`
2. Check individual JSON files for missing data
3. Re-run parser if needed
4. Manually fix critical datasheets

### Got 170 datasheets instead of 96

**Problem:** Old Forge World/Legends files in cache

**Solution:** Clean cache and re-scrape
```bash
Remove-Item -Recurse -Force data\wahapedia-cache\space-marines
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"
```

### "invalid byte sequence for encoding UTF8: 0x00"

**Problem:** Null bytes (`\x00`) in weapon/ability names causing PostgreSQL errors

**Solution:** ✅ **Fixed in v3.1.1!** The seed script now automatically:
- Strips null bytes from all text fields before insertion
- Cleans UTF-8 invalid sequences
- No manual intervention required

**If you're using an older version:**
```bash
# Update to latest code
git pull

# Re-run seeding
npx dotenv-cli -e .env npx tsx scripts/seedDatasheets.ts "space-marines"
```

### "Unique constraint failed on datasheetId, weaponId"

**Problem:** Same weapon appears multiple times on one datasheet (e.g., Arjac Rockfist's ranged & melee Foehammer profiles)

**Solution:** ✅ **Fixed in v3.1.1!** The seed script now:
- Tracks added weapons per datasheet using `Set`
- Prevents duplicate weapon relationships
- Preserves distinct weapon profiles with different stats

### "Argument subfaction must not be null"

**Problem:** Empty string (`""`) for subfaction causing Prisma unique constraint validation errors

**Solution:** ✅ **Fixed in v3.1.1!** The seed script now:
- Normalizes empty strings to `null` for database fields
- Properly handles optional subfaction values
- Compatible with Prisma's composite unique keys

### "Can't reach database server"

**Problem:** Database connection issues during seeding (transient)

**Solution:** 
1. Check database is running
2. Verify `DATABASE_URL` in `.env` file
3. Test connection: `npx prisma db pull`
4. Re-run seeding (script is idempotent)

### Import succeeded but some abilities missing descriptions

**Problem:** Core faction abilities like "Oath of Moment" show warnings about missing descriptions

**Solution:** This is **expected behavior**:
- Common abilities are referenced by name only
- Full descriptions would be duplicated 96+ times
- They're stored as separate records in the `Ability` table
- AI can still look them up via name reference
- No action needed - this is by design for data normalization

## Expanding to Other Factions

### Other Space Marine Subfactions

```bash
# Blood Angels
npx tsx scripts/scrapeWahapedia.ts "space-marines" "blood-angels"
npx tsx scripts/parseDatasheets.ts "space-marines"
npx tsx scripts/seedDatasheets.ts "space-marines"

# Dark Angels
npx tsx scripts/scrapeWahapedia.ts "space-marines" "dark-angels"
npx tsx scripts/parseDatasheets.ts "space-marines"
npx tsx scripts/seedDatasheets.ts "space-marines"
```

### Other Factions

```bash
# Tyranids
npx tsx scripts/scrapeWahapedia.ts "tyranids"
npx tsx scripts/parseDatasheets.ts "tyranids"
npx tsx scripts/seedDatasheets.ts "tyranids"

# Necrons
npx tsx scripts/scrapeWahapedia.ts "necrons"
npx tsx scripts/parseDatasheets.ts "necrons"
npx tsx scripts/seedDatasheets.ts "necrons"
```

## Quarterly Updates

When GW releases errata or balance dataslate updates:

```bash
# Re-scrape (skip cache to get fresh data)
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves" --skip-cache

# Re-parse
npx tsx scripts/parseDatasheets.ts "space-marines"

# Re-seed (upserts will update existing records)
npx tsx scripts/seedDatasheets.ts "space-marines"
```

## Advanced Options

### Include Forge World Units

```bash
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves" --include-forge-world
```

### Include Legends Units

```bash
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves" --include-legends
```

### Include Everything

```bash
npx tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves" --include-forge-world --include-legends
```

## Related Documentation

- **Feature Overview:** [Datasheet Integration](../features/DATASHEET_INTEGRATION.md) - Architecture and design
- **API Reference:** [Datasheets API](../api/DATASHEETS_API.md) - REST endpoint documentation
- **Scripts README:** `scripts/README.md` - Detailed script options
- **Quick Start:** `QUICK_START_DATASHEETS.md` - 4-step quick reference

---

**Need help?** Check the troubleshooting section or review the scripts README for detailed options.

