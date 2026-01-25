# Competitive Context Guide

**Last Updated:** 2026-01-10
**Status:** Complete
**Version:** 4.67.0

## Overview

This guide explains how to populate competitive context (tier rankings, best targets, counters, synergies) for your faction's units using the competitive context pipeline. The pipeline extracts insights from YouTube videos, Goonhammer articles, Reddit discussions, and other competitive content.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step 1: Add Sources](#step-1-add-sources)
- [Step 2: Run Pipeline](#step-2-run-pipeline)
- [Step 3: Aggregate Results](#step-3-aggregate-results)
- [Viewing Results](#viewing-results)
- [Adding More Sources](#adding-more-sources)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Prerequisites

1. **Python Dependencies:**
   ```bash
   pip install psycopg2-binary beautifulsoup4 yt-dlp
   ```

2. **ffmpeg** (for YouTube audio processing):
   ```bash
   # Windows
   winget install ffmpeg

   # macOS
   brew install ffmpeg
   ```

3. **Environment Variables** (in `.env.local`):
   - `DATABASE_URL` - Supabase PostgreSQL connection string
   - `GOOGLE_API_KEY` - For Gemini AI extraction
   - `OPENAI_API_KEY` - For Whisper transcription (optional fallback)

4. **Admin Access:**
   - Must be logged into admin panel to add sources via UI

## Quick Start

```bash
# 1. Add sources via Admin UI at /admin/factions/[faction-id]

# 2. Run full pipeline (fetch -> curate -> extract)
python scripts/youtube_transcribe.py --process-all

# 3. Aggregate into final competitive profiles
python scripts/youtube_transcribe.py --aggregate-all --faction-name "Space Wolves"
```

## Step 1: Add Sources

### Via Admin UI (Recommended)

1. Navigate to your faction's admin page:
   ```
   http://localhost:3000/admin/factions/[faction-id]
   ```

2. Scroll to **Competitive Sources** section

3. Click **Add Source**

4. Enter:
   - **Source URL**: YouTube link, Goonhammer article, Reddit post
   - **Source Type**: youtube, article, reddit, forum
   - **Detachment** (optional): For detachment-specific content

### Good Source Types

| Source | Example | Quality |
|--------|---------|---------|
| **Auspex Tactics** | Faction tier lists | High - detailed analysis |
| **Art of War 40k** | Tournament breakdowns | High - competitive focus |
| **Goonhammer** | Faction reviews, Competitive Focus articles | High - comprehensive |
| **Reddit** | r/WarhammerCompetitive discussions | Medium - community consensus |

### Example URLs

```
# YouTube
https://www.youtube.com/watch?v=X3n6jxgRs58

# Goonhammer
https://www.goonhammer.com/competitive-faction-focus-space-wolves/

# Reddit
https://www.reddit.com/r/WarhammerCompetitive/comments/xyz/space_wolves_guide/
```

## Step 2: Run Pipeline

### Full Pipeline (Recommended)

Runs all three stages automatically:

```bash
python scripts/youtube_transcribe.py --process-all
```

### Individual Stages

Run stages separately for debugging:

```bash
# Stage 1: Download content
python scripts/youtube_transcribe.py --fetch-pending

# Stage 2: Identify mentioned units
python scripts/youtube_transcribe.py --curate-pending

# Stage 3: Extract unit-specific context
python scripts/youtube_transcribe.py --extract-pending
```

### Pipeline Output

```
FETCH PENDING SOURCES (Step 1: Fetch)
==================================================
Found 3 pending source(s)

[1/3] Fetching source
   Faction: Space Wolves
   Type: youtube
   URL: https://www.youtube.com/watch?v=X3n6jxgRs58
   Title: Top Ten Strongest Space Wolves Units
   Channel: Auspex Tactics
   Fetched via captions (12,450 chars)

CURATE PENDING SOURCES (Step 2: Curate)
==================================================
   Found 15 units mentioned

EXTRACT PENDING LINKS (Step 3: Extract)
==================================================
[1/15] Extracting: Logan Grimnar
   Extracted (confidence: 95%)
```

## Step 3: Aggregate Results

After extraction, synthesize all sources into final competitive profiles:

```bash
# For a specific faction
python scripts/youtube_transcribe.py --aggregate-all --faction-name "Space Wolves"

# For a single unit
python scripts/youtube_transcribe.py --aggregate --datasheet-name "Logan Grimnar"
```

### Aggregation Output

```
AGGREGATE ALL UNITS FOR FACTION
==================================================
Faction: Space Wolves
Found 36 units with extracted context

[1/36] Aggregating: Logan Grimnar
   Sources: 3
   Calling Gemini to synthesize...
   Tier: S - Auto-include staple

AGGREGATION COMPLETE
   Success: 36/36
```

## Viewing Results

### In Database

Query the `DatasheetCompetitiveContext` table:

```sql
SELECT
  d.name,
  dcc."competitiveTier",
  dcc."tierReasoning",
  dcc."sourceCount"
FROM "DatasheetCompetitiveContext" dcc
JOIN "Datasheet" d ON dcc."datasheetId" = d.id
WHERE dcc."factionId" = 'your-faction-id'
ORDER BY dcc."competitiveTier", d.name;
```

### In Admin UI

Competitive context appears on datasheet detail pages in the admin panel.

## Adding More Sources

The pipeline is **incremental**:

1. **Add new sources** via admin UI (they start as `pending`)
2. **Run `--process-all`** again - only new sources are processed
3. **Run `--aggregate-all`** again - synthesizes ALL sources (old + new)

### Data Preservation

**Nothing is lost** when you add more sources:

```
DatasheetSource Table (PRESERVED)
---------------------------------
Source: "Auspex Tactics Video"  -> Bjorn = S tier
Source: "Goonhammer Article"    -> Bjorn = A tier
Source: "Reddit Discussion"     -> Bjorn = A tier
(Each source's opinion is kept forever)

                    |
                    v  --aggregate-all

DatasheetCompetitiveContext (SYNTHESIZED)
-----------------------------------------
competitiveTier: "A"
tierReasoning: "2 of 3 sources rate A, video rates S..."
conflicts: [{
  field: "tier",
  disagreement: "Auspex says S, others say A",
  resolution: "Rated A - majority consensus, S was pre-nerf"
}]
```

## Troubleshooting

### YouTube Captions Not Available

```
Captions failed, trying Whisper...
```

This is normal - many videos don't have captions. The script falls back to Whisper transcription automatically.

### yt-dlp Fragment Errors

```
[download] fragment not found; Skipping fragment 1 ...
```

**Fix:** Update yt-dlp:
```bash
pip install --upgrade yt-dlp
```

### SQL Column Error

```
column ds.sourceId does not exist
```

**Fix:** The column was renamed to `competitiveSourceId`. Update to latest script version.

### Whisper API Timeout

For long videos (> 15 minutes), the script automatically chunks audio. If still timing out:

```bash
# Skip Whisper, only process articles
python scripts/youtube_transcribe.py --process-all --no-whisper
```

## Pipeline Status Reference

| Status | Meaning | Next Step |
|--------|---------|-----------|
| pending | Just added | --fetch-pending |
| fetched | Content downloaded | --curate-pending |
| curated | Units identified | --extract-pending |
| extracted | Context extracted | --aggregate-all |
| error | Processing failed | Check error, retry |

## Related Documentation

- **[Competitive Context Pipeline](../features/COMPETITIVE_CONTEXT_PIPELINE.md)** - Technical architecture
- **[Competitive Context Database](../features/COMPETITIVE_CONTEXT_DATABASE.md)** - Data model
- **[Admin Panel](../features/ADMIN_PANEL.md)** - Admin UI features
- **[Faction Data Import Guide](FACTION_DATA_IMPORT_GUIDE.md)** - Importing faction data
