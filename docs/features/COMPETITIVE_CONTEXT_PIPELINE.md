# Competitive Context Pipeline

**Last Updated:** 2026-01-10
**Status:** Complete
**Version:** 4.67.0

## Overview

The Competitive Context Pipeline extracts, aggregates, and synthesizes competitive insights for Warhammer 40K units from multiple sources (YouTube videos, articles, Reddit discussions). It uses AI (Gemini 3 Flash) to parse content, identify mentioned units, extract tier rankings, and synthesize conflicting opinions into actionable competitive context.

## Table of Contents

- [Architecture](#architecture)
- [Data Model](#data-model)
- [Pipeline Stages](#pipeline-stages)
- [Aggregation Logic](#aggregation-logic)
- [Key Components](#key-components)
- [Related Documentation](#related-documentation)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADMIN UI                                        │
│                   /admin/factions/[id]                                  │
│         Add sources: YouTube URLs, Goonhammer articles                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CompetitiveSource Table                              │
│   sourceUrl, sourceType, factionId, status: "pending"                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ --fetch-pending
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 1: FETCH                                        │
│   YouTube → Captions or Whisper transcription                           │
│   Articles → Web scraping with BeautifulSoup                            │
│   Status: "pending" → "fetched"                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ --curate-pending
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: CURATE                                       │
│   Gemini identifies which units are mentioned                           │
│   Creates DatasheetSource links for each unit                           │
│   Status: "fetched" → "curated"                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ --extract-pending
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: EXTRACT                                      │
│   For each DatasheetSource link:                                        │
│   Gemini extracts unit-specific tier, targets, counters, synergies      │
│   DatasheetSource.status: "pending" → "extracted"                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ --aggregate-all
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 4: AGGREGATE                                    │
│   Collect all extracted contexts per unit                               │
│   Gemini synthesizes into single competitive profile                    │
│   Saves to DatasheetCompetitiveContext table                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Model

### CompetitiveSource Table
Stores source metadata and content.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| sourceUrl | String | Unique URL of the source |
| sourceType | Enum | youtube, reddit, article, forum, other |
| factionId | UUID | Faction this source applies to |
| detachmentId | UUID? | Optional detachment scope |
| status | Enum | pending, fetched, curated, extracted, error |
| contentTitle | String? | Title extracted from source |
| authorName | String? | Author/channel name |
| contentText | String? | Full transcript/article text |
| fetchedAt | DateTime? | When content was fetched |

### DatasheetSource Table
Links sources to units with extracted context (preserved forever).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| datasheetId | UUID | Unit this context applies to |
| competitiveSourceId | UUID | Source this came from |
| relevanceScore | Int? | How relevant the source is to this unit |
| mentionCount | Int? | How many times unit is mentioned |
| status | Enum | pending, extracted, error |
| extractedContext | JSON | Tier, targets, counters, synergies |
| confidence | Int | 0-100 confidence score |
| isOutdated | Boolean | Marked outdated after meta changes |

### DatasheetCompetitiveContext Table
Synthesized competitive profile (updated on aggregation).

| Column | Type | Description |
|--------|------|-------------|
| datasheetId | UUID | Unit this applies to |
| factionId | UUID | Faction context |
| detachmentId | UUID? | Optional detachment scope |
| competitiveTier | Enum | S, A, B, C, D, F |
| tierReasoning | String | Why this tier was assigned |
| bestTargets | JSON | Array of ideal targets |
| counters | JSON | Array of counters/threats |
| synergies | JSON | Array of {unit, why} objects |
| playstyleNotes | String | How to play the unit |
| deploymentTips | String | Positioning advice |
| competitiveNotes | String | Meta position notes |
| conflicts | JSON | Array of disagreements and resolutions |
| sourceCount | Int | Number of sources synthesized |
| lastAggregated | DateTime | When last synthesized |

## Pipeline Stages

### Stage 1: Fetch (`--fetch-pending`)

Downloads content from sources:
- **YouTube**: Tries captions first, falls back to Whisper transcription
- **Articles**: Web scraping with HTML-to-text conversion
- **Reddit**: API access for posts and comments

```bash
python scripts/youtube_transcribe.py --fetch-pending
```

### Stage 2: Curate (`--curate-pending`)

AI identifies which units are mentioned in each source:
- Sends full transcript to Gemini
- Returns list of unit names with faction context
- Creates `DatasheetSource` links for each mentioned unit

```bash
python scripts/youtube_transcribe.py --curate-pending
```

### Stage 3: Extract (`--extract-pending`)

For each `DatasheetSource` link, extracts unit-specific context:
- Tier ranking (S/A/B/C/D/F)
- Best targets, counters, synergies
- Playstyle notes, deployment tips
- Confidence score (0-100)

```bash
python scripts/youtube_transcribe.py --extract-pending
```

### Stage 4: Aggregate (`--aggregate-all`)

Synthesizes all sources for each unit into final profile:
- Collects all `DatasheetSource` records for a unit
- Sends to Gemini with aggregation prompt
- Handles conflicts with reasoned resolution
- Saves to `DatasheetCompetitiveContext`

```bash
python scripts/youtube_transcribe.py --aggregate-all --faction-name "Space Wolves"
```

## Aggregation Logic

### Conflict Resolution

When sources disagree, the AI:
1. Notes the disagreement in `conflicts` array
2. Provides reasoned resolution based on:
   - Recency (newer analysis weighted higher)
   - Source quality (tournament data > casual opinion)
   - Consensus (majority view)
3. Explains the resolution in `tierReasoning`

### Example Conflict

```json
{
  "conflicts": [
    {
      "field": "competitiveTier",
      "disagreement": "Auspex rates S-tier, Goonhammer rates A-tier",
      "resolution": "Rated A - majority consensus, S rating was pre-points-nerf"
    }
  ]
}
```

### Tier Definitions

| Tier | Description | Example |
|------|-------------|---------|
| S | Auto-include, meta-defining | Thunderwolf Cavalry |
| A | Competitive staple, very strong | Bjorn, Arjac |
| B | Solid, viable choice | Ragnar, Vindicator |
| C | Situational, niche uses | Iron Priest, Njal |
| D | Below average, rarely worth it | Grey Hunters |
| F | Avoid, actively bad | - |

## Key Components

### Python Script
`scripts/youtube_transcribe.py` - Main pipeline script with:
- Direct PostgreSQL connection to Supabase
- Whisper transcription with audio chunking
- Gemini API integration for extraction/aggregation
- Retry logic with exponential backoff

### API Routes
- `POST /api/admin/factions/[id]/sources` - Add source via admin UI
- `GET /api/admin/factions/[id]/sources` - List sources with status

### Database Functions
```python
db_get_pending_sources(status)      # Get sources by status
db_update_source_status(id, status) # Update source status
db_create_datasheet_links(id, links) # Create DatasheetSource records
db_get_datasheet_sources_for_aggregation(id) # Get all sources for unit
db_upsert_competitive_context(...)  # Save aggregated context
```

## Related Documentation

- **[Competitive Context Guide](../guides/COMPETITIVE_CONTEXT_GUIDE.md)** - How to use the pipeline
- **[Datasheet Integration](DATASHEET_INTEGRATION.md)** - Unit data system
- **[Admin Panel](ADMIN_PANEL.md)** - Admin UI for source management
- **[Faction Data Import Guide](../guides/FACTION_DATA_IMPORT_GUIDE.md)** - Importing faction data
