# Datasheet Parser Guide

**Last Updated:** 2025-12-13  
**Status:** Complete

## Overview

The enhanced datasheet parser (`scripts/parseDatasheets.ts`) uses GPT-5-mini with OpenAI's Responses API to parse Wahapedia HTML into normalized database records. This guide covers how to use the parser efficiently with its parallel processing, caching, progress tracking, and advanced composition/wargear extraction features.

## Table of Contents

- [Quick Start](#quick-start)
- [Parser Modes](#parser-modes)
- [Command-Line Usage](#command-line-usage)
- [Composition Data](#composition-data)
- [Wargear Effects](#wargear-effects)
- [Understanding Output](#understanding-output)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Quick Start

### Prerequisites

1. **Scrape HTML first**: Run the scraper to download HTML from Wahapedia
   ```bash
   npx tsx scripts/scrapeWahapedia.ts "space-marines"
   ```

2. **Set API key**: Ensure your OpenAI API key is set
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

### Basic Usage

Parse a faction (smart cache mode - skips already-parsed datasheets):

```bash
npx tsx scripts/parseDatasheets.ts "space-marines"
```

**Output:**
```
🎯 Parsing datasheets for space-marines
   Mode: Smart cache (skip already parsed)

📊 Total datasheets: 96
   To parse: 28
   Skipped: 68

📦 Batch 1/6: Repulsor, Rhino, Scout Squad, Sternguard, Storm Speeder
Parsing |████████████░░░░░░░░| 60% | 17/28 | Success: 15 | Failed: 2 | Skipped: 68

============================================================
📊 Parse Summary for space-marines
============================================================
✅ Success: 26
❌ Failed: 2
⏭️  Skipped: 68
📝 Total: 96
```

## Parser Modes

### Smart Cache (Default)

Automatically skips already-parsed datasheets. Perfect for continuing interrupted runs or adding new units.

```bash
npx tsx scripts/parseDatasheets.ts "space-marines"
```

**When to use:**
- Continuing an interrupted parse
- Adding new scraped datasheets
- Running parser again after updates
- Daily/regular parsing runs

**Behavior:**
- Checks if output JSON exists in `data/parsed-datasheets/[faction]/`
- Skips files that already have valid JSON
- Only parses missing or new datasheets
- **Performance**: Near-instant if all cached (0-2 seconds)

### Override All

Re-parse everything, ignoring cache. Use when you want to regenerate all datasheets.

```bash
npx tsx scripts/parseDatasheets.ts "space-marines" --override-all
```

**When to use:**
- Parser logic has been updated
- Want fresh parses with improved prompts
- Fixing systematic parsing issues
- Initial testing of parser changes

**Behavior:**
- Ignores all existing parsed JSON files
- Re-parses every datasheet from scratch
- Overwrites existing output files
- **Performance**: ~20 seconds for 96 datasheets

### Retry Failed

Only re-attempt datasheets that previously failed. Ideal for fixing errors without re-parsing successes.

```bash
npx tsx scripts/parseDatasheets.ts "space-marines" --retry-failed
```

**When to use:**
- Previous run had connection errors
- Fixing specific failed datasheets
- After temporary API issues resolved
- Completing partial imports

**Behavior:**
- Reads `parse-summary.json` for error list
- Only parses files in the `errors` array
- Skips all previously successful datasheets
- **Performance**: Depends on failure count (e.g., 28 failures = ~6 seconds)

## Command-Line Usage

### Basic Syntax

```bash
npx tsx scripts/parseDatasheets.ts <faction> [subfaction] [flags]
```

### Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `faction` | ✅ Yes | Faction slug (lowercase, hyphenated) | `"space-marines"`, `"tyranids"` |
| `subfaction` | ❌ No | Subfaction if applicable | `"space-wolves"`, `"blood-angels"` |

### Flags

| Flag | Description | Use Case |
|------|-------------|----------|
| `--override-all` | Re-parse all datasheets | Parser improvements, fresh data |
| `--retry-failed` | Only retry failed datasheets | Fix errors without full reparse |
| `--start-from=N` | Start from index N (1-based) | Resume after crash |
| `--help` / `-h` | Show help message | Learn usage |

### Examples

**Parse Tyranids (smart cache):**
```bash
npx tsx scripts/parseDatasheets.ts "tyranids"
```

**Parse Space Marines with subfaction:**
```bash
npx tsx scripts/parseDatasheets.ts "space-marines" "space-wolves"
```

**Re-parse everything:**
```bash
npx tsx scripts/parseDatasheets.ts "space-marines" --override-all
```

**Retry only failures:**
```bash
npx tsx scripts/parseDatasheets.ts "space-marines" --retry-failed
```

**Multiple factions:**
```bash
npx tsx scripts/parseDatasheets.ts "space-marines"
npx tsx scripts/parseDatasheets.ts "tyranids"
npx tsx scripts/parseDatasheets.ts "necrons"
```

**Resume from index (after crash):**
```bash
# Parser crashed at index 43? Resume from there:
npx tsx scripts/parseDatasheets.ts "space-marines" --override-all --start-from=43
```

## Composition Data

The parser extracts structured `compositionData` for accurate wound calculations on units with mixed model types.

### Schema

```typescript
interface CompositionEntry {
  name: string;           // Model type name (e.g., "Ravener Prime", "Terminator")
  role: "leader" | "regular";  // leader = characters/primes/sergeants
  count: number;          // Number of models of this type
  woundsPerModel: number; // Wounds characteristic for this model type
}
```

### Examples

**Mixed Leader Unit (Hyperadapted Raveners):**
```json
{
  "compositionData": [
    { "name": "Ravener Prime", "role": "leader", "count": 1, "woundsPerModel": 6 },
    { "name": "Ravener", "role": "regular", "count": 4, "woundsPerModel": 3 }
  ]
}
// Total wounds: 6 + (4 × 3) = 18
```

**Single Monster (Maleceptor):**
```json
{
  "compositionData": [
    { "name": "Maleceptor", "role": "regular", "count": 1, "woundsPerModel": 14 }
  ]
}
// Total wounds: 14
```

**Standard Squad with Leader (Terminator Squad):**
```json
{
  "compositionData": [
    { "name": "Terminator Sergeant", "role": "leader", "count": 1, "woundsPerModel": 3 },
    { "name": "Terminator", "role": "regular", "count": 4, "woundsPerModel": 3 }
  ]
}
// Total wounds: 5 × 3 = 15
```

### Calculating Total Wounds

```typescript
const totalWounds = compositionData.reduce(
  (sum, entry) => sum + (entry.count * entry.woundsPerModel), 
  0
);
```

## Wargear Effects

The parser extracts structured `effects` for wargear abilities that modify model stats.

### Schema

```typescript
interface WargearEffect {
  wounds: number | null;          // Modified wounds (e.g., Relic Shield → 6)
  toughness: number | null;       // Modified toughness
  save: string | null;            // Modified save (e.g., "2+")
  invulnerableSave: string | null; // Granted invuln (e.g., "4+")
  movement: string | null;        // Modified movement (e.g., "12\"")
}
```

### Example: Relic Shield

```json
{
  "name": "Relic Shield",
  "type": "wargear",
  "description": "The bearer has a Wounds characteristic of 6.",
  "effects": {
    "wounds": 6,
    "toughness": null,
    "save": null,
    "invulnerableSave": null,
    "movement": null
  }
}
```

**Usage:** When a Captain equips a Relic Shield, the UI can show:
- Base wounds: 5
- With Relic Shield: 6 (from `effects.wounds`)

### Example: Storm Shield

```json
{
  "name": "Storm Shield",
  "type": "wargear", 
  "description": "The bearer has a 4+ invulnerable save.",
  "effects": {
    "wounds": null,
    "toughness": null,
    "save": null,
    "invulnerableSave": "4+",
    "movement": null
  }
}
```

## Understanding Output

### Console Output

#### Header
```
🎯 Parsing datasheets for space-marines
   Mode: Smart cache (skip already parsed)

📊 Total datasheets: 96
   To parse: 28
   Skipped: 68
```

- **Mode**: Which mode is active (Smart cache/Override all/Retry failed)
- **Total datasheets**: Total HTML files found
- **To parse**: Number that will be processed
- **Skipped**: Number skipped due to cache

#### Progress Bar
```
Parsing |████████████░░░░░░░░| 60% | 17/28 | Success: 15 | Failed: 2 | Skipped: 68
```

- **Progress bar**: Visual indicator of completion
- **Percentage**: % complete of datasheets to parse
- **17/28**: Current count / total to parse
- **Success**: Successfully parsed count
- **Failed**: Failed parse count
- **Skipped**: Cached count (constant)

#### Batch Logging
```
📦 Batch 1/6: Repulsor, Rhino, Scout Squad, Sternguard Veteran Squad, Storm Speeder
```

- **Batch N/Total**: Current batch number
- **Unit names**: 5 units being processed concurrently
- Updates every ~1-2 seconds

#### Summary
```
============================================================
📊 Parse Summary for space-marines
============================================================
✅ Success: 26
❌ Failed: 2
⏭️  Skipped: 68
📝 Total: 96
```

- **Success**: Total successfully parsed
- **Failed**: Total failures (see errors below)
- **Skipped**: Total skipped from cache
- **Total**: Grand total datasheets

#### Error Details
```
⚠️  Errors:
   - Repulsor.html: Connection error.
   - Rhino.html: Connection error.
```

Lists all failed datasheets with error messages.

### File Output

#### Parsed JSON Files

Location: `data/parsed-datasheets/[faction]/[unit-name].json`

Example: `data/parsed-datasheets/space-marines/Intercessor_Squad.json`

```json
{
  "name": "Intercessor Squad",
  "faction": "Space Marines",
  "subfaction": "",
  "role": "Battleline",
  "keywords": ["INFANTRY", "BATTLELINE", "IMPERIUM", "ADEPTUS ASTARTES"],
  "stats": {
    "movement": "6\"",
    "toughness": 4,
    "save": "3+",
    "invulnerableSave": "",
    "wounds": 2,
    "leadership": 6,
    "objectiveControl": 2
  },
  "weapons": [...],
  "abilities": [...],
  "wargearOptions": [...],
  "pointsCost": 90
}
```

#### Parse Summary

Location: `data/parsed-datasheets/[faction]/parse-summary.json`

```json
{
  "total": 96,
  "success": 68,
  "failed": 28,
  "skipped": 0,
  "errors": [
    {
      "file": "Repulsor.html",
      "error": "Connection error."
    }
  ],
  "faction": "space-marines",
  "subfaction": null,
  "completedAt": "2025-10-17T01:07:38.630Z"
}
```

Used by `--retry-failed` mode to determine which files need re-parsing.

## Performance

### Benchmarks

| Scenario | Old Parser | New Parser | Improvement |
|----------|-----------|-----------|-------------|
| Full parse (96 units) | 96+ seconds | ~20 seconds | 80% faster |
| Cached run (all parsed) | 96+ seconds | 0-2 seconds | 98% faster |
| Retry 28 failures | 28+ seconds | ~6 seconds | 79% faster |
| Single datasheet | 1 second | 1 second | Same |

### Why It's Faster

1. **Parallel Processing**
   - Processes 5 datasheets simultaneously
   - ~20 batches for 96 datasheets instead of 96 sequential calls

2. **Smart Caching**
   - Skips already-parsed datasheets
   - Only parses new or failed units
   - Near-instant for cached runs

3. **Batch Delay**
   - 100ms delay between batches
   - Respects API rate limits
   - Minimal impact on total time

### Cost

- **Per datasheet**: ~$0.001-0.002 (same as before)
- **Full faction**: ~$0.10-0.20 (same as before)
- **Time savings**: 80% reduction but same API cost

OpenAI Responses API provides 40-80% better cache utilization over time, so costs may decrease with repeated parses.

## Troubleshooting

### Common Issues

#### npm Cache Permission Error

**Error:**
```
npm ERR! errno -1
npm ERR! Your cache folder contains root-owned files
```

**Solution:**
```bash
sudo chown -R $(whoami) "$HOME/.npm"
npm install
```

#### Module Not Found: cli-progress

**Error:**
```
Cannot find module 'cli-progress'
```

**Solution:**
```bash
npm install cli-progress @types/cli-progress
```

#### No Cached Data Found

**Error:**
```
Error: No cached data found for space-marines. Run scraper first.
```

**Solution:**
```bash
# Run scraper first to download HTML
npx tsx scripts/scrapeWahapedia.ts "space-marines"
```

#### OpenAI API Key Missing

**Error:**
```
OpenAIError: Missing credentials
```

**Solution:**
```bash
# Set API key
export OPENAI_API_KEY="sk-..."

# Or use .env file
echo 'OPENAI_API_KEY="sk-..."' >> .env
source .env
```

#### Connection Errors During Parse

**Issue:** Some datasheets fail with "Connection error."

**Solutions:**
1. **Wait and retry**
   ```bash
   # Wait a minute, then retry failures
   npx tsx scripts/parseDatasheets.ts "space-marines" --retry-failed
   ```

2. **Check API limits**
   - Verify you haven't hit OpenAI rate limits
   - Wait 60 seconds and retry

3. **Check internet connection**
   - Ensure stable connection to OpenAI API
   - Try from different network if persistent

#### All Datasheets Already Parsed

**Output:**
```
✨ All datasheets already parsed! Use --override-all to re-parse.
```

**Solutions:**
- This is normal! It means everything is cached
- Use `--override-all` if you want to force re-parse
- Use `--retry-failed` if there were previous errors

### Debug Mode

To see detailed logs and API responses, you can add console logs:

```typescript
// In scripts/parseDatasheets.ts, around line 310
console.log('Response:', JSON.stringify(response, null, 2));
```

## Related Documentation

- **[Datasheet Import Guide](DATASHEET_IMPORT_GUIDE.md)** - Complete workflow for scraping, parsing, and seeding
- **[Datasheet Integration](../features/DATASHEET_INTEGRATION.md)** - Feature overview and architecture
- **[Datasheets API](../api/DATASHEETS_API.md)** - Query the imported datasheets
- **[Scripts README](../../scripts/README.md)** - All available scripts

---

**Built with the blessing of the Omnissiah** ⚙️

