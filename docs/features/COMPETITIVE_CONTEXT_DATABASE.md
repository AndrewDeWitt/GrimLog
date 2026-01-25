# Competitive Context Database & Faction-Level Pipeline

**Last Updated:** 2026-01-09
**Status:** Complete (v4.65.0)

## Overview

The Competitive Context System enables the association of external sources (YouTube videos, Reddit posts, articles, forums) with faction datasheets. Sources are added at the **faction level** and then AI automatically identifies which units are discussed, linking them to specific datasheets. The pipeline extracts unit-specific insights and aggregates them into synthesized competitive context.

**Key Feature (v4.49.0):** Context can now be scoped to specific factions and detachments. A generic unit like "Intercessors" can have different competitive context when played in Space Wolves vs. Blood Angels, or in different detachments.

## Table of Contents
- [Data Model](#data-model)
- [Context Scoping](#context-scoping)
- [Source Lifecycle (Pipeline)](#source-lifecycle-pipeline)
- [Admin Management UI](#admin-management-ui)
- [Offline Processing (Python)](#offline-processing-python)
- [Context Aggregation](#context-aggregation)
- [API Reference](#api-reference)

## Data Model

The system uses three main tables:

### CompetitiveSource Table (Faction-Level)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Unique identifier |
| `factionId` | String | Foreign key to `Faction` |
| `detachmentId` | String? | Optional foreign key to `Detachment` (for detachment-specific sources) |
| `sourceUrl` | String | The URL of the content |
| `sourceType` | String | "youtube", "reddit", "article", "forum" |
| `content` | Text | Raw content (transcript, post text, article) |
| `contentTitle` | String | Title of the source |
| `authorName` | String | Creator/author name |
| `status` | String | Pipeline stage: "pending", "fetched", "curated", "extracted", "error" |
| `mentionedUnitsJson` | Text | JSON array of units identified by AI during curation |

### DatasheetSource Table (Junction)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Unique identifier |
| `datasheetId` | String | Foreign key to `Datasheet` |
| `competitiveSourceId` | String | Foreign key to `CompetitiveSource` |
| `extractedContext` | Text (JSON) | Unit-specific insights extracted by AI |
| `confidence` | Integer | AI confidence score (0-100) |
| `status` | String | "pending", "extracted", "error" |
| `mentionCount` | Integer | How many times unit was mentioned |
| `relevanceScore` | Integer | AI-determined relevance (0-100) |
| `isOutdated` | Boolean | Manual flag to exclude from aggregation |

### DatasheetCompetitiveContext Table (Scoped Context)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Unique identifier |
| `datasheetId` | String | Foreign key to `Datasheet` |
| `factionId` | String? | Optional faction for faction-specific context |
| `detachmentId` | String? | Optional detachment for detachment-specific context |
| `competitiveTier` | String | S/A/B/C/D/F ranking |
| `tierReasoning` | Text | Explanation for the tier |
| `bestTargets` | Text (JSON) | Array of ideal targets |
| `counters` | Text (JSON) | Array of threats/counters |
| `synergies` | Text (JSON) | Array of synergistic units |
| `playstyleNotes` | Text | How to use the unit |
| `deploymentTips` | Text | Deployment advice |
| `competitiveNotes` | Text | General competitive insights |
| `sourceCount` | Integer | Number of sources aggregated |
| `conflicts` | Text (JSON) | Source disagreements |
| `lastAggregated` | DateTime | When context was last synthesized |

## Context Scoping

Competitive context is stored at three levels of specificity:

| Scope | factionId | detachmentId | Use Case |
|-------|-----------|--------------|----------|
| **Generic** | null | null | Applies to all armies using this datasheet |
| **Faction-Specific** | set | null | Context specific to a faction (e.g., Space Wolves) |
| **Detachment-Specific** | set | set | Context specific to a detachment (e.g., Champions of Russ) |

### Fallback Logic

When looking up context for a unit in an army, the system uses fallback:

1. Try **detachment-specific** context (if playing a specific detachment)
2. Fall back to **faction-specific** context (if available)
3. Fall back to **generic** context (universal context)

### API Endpoint

```
GET /api/datasheets/detail/[id]/competitive-context?factionId=xxx&detachmentId=yyy
```

Returns the best matching context with `matchType`: "detachment", "faction", "generic", or "none".

## Source Lifecycle (Pipeline)

```
1. ADD SOURCE (UI)
   └─→ CompetitiveSource created with status: "pending"
   └─→ Optional: Tag with detachmentId for detachment-specific content

2. FETCH (--fetch-pending)
   └─→ Download content (YouTube transcript, Reddit JSON, article HTML)
   └─→ Update status: "fetched"

3. CURATE (--curate-pending)
   └─→ AI identifies mentioned units from content
   └─→ Create DatasheetSource links for each mentioned unit
   └─→ Update status: "curated"

4. EXTRACT (--extract-pending)
   └─→ AI extracts unit-specific context for each DatasheetSource
   └─→ Update DatasheetSource.status: "extracted"
   └─→ Update CompetitiveSource.status: "extracted"

5. AGGREGATE (--aggregate or --aggregate-all)
   └─→ Collect all "extracted" sources for a datasheet
   └─→ AI synthesizes final competitive context
   └─→ Store in DatasheetCompetitiveContext with scope
```

## Admin Management UI

### Faction Page (`/admin/factions/[id]`)
The "📚 Competitive Sources" section allows:
- **Add Source**: Enter URL, select source type, optionally select detachment
- **Detachment Selector**: Dropdown appears when faction has detachments
- **View Sources**: See all sources with status badges, detachment tags, and linked datasheet counts
- **Pipeline Status**: Visual indicators for each pipeline stage

### Datasheet Editor Modal (`/admin/datasheets` → Edit)
The "5. Competitive" tab shows:
- **Linked Sources**: Read-only list of sources linked to this datasheet
- **Source Status**: "extracted" badge when context is ready
- **Editable Scoped Contexts**: View and edit all competitive contexts for this datasheet
  - Scope badge shows faction/detachment or "Generic"
  - Tier badge with color coding (S=amber, A=green, B=blue, etc.)
  - Click "Edit" to toggle inline editing mode
  - Edit: tier, reasoning, targets, counters, synergies, playstyle notes, deployment tips, additional notes
  - Saves directly to `DatasheetCompetitiveContext` table

### Public Datasheet View (`/datasheets/[id]`)
Displays competitive insights from the `DatasheetCompetitiveContext` table:
- **Automatic Scope**: Fetches context using the datasheet's linked faction ID
- **Tier Badge**: Color-coded S/A/B/C/D/F badge in section header
- **Tier Reasoning**: Highlighted callout with explanation
- **Best Targets**: Green tags showing ideal targets
- **Countered By**: Red tags showing threats
- **Synergizes With**: Blue tags showing unit synergies
- **Playstyle Notes**: How to play the unit effectively
- **Deployment Tips**: (if present) Deployment advice
- **Additional Notes**: (if present) Extra competitive notes
- **Source Count**: Shows how many sources contributed to the context
- **Scope Indicator**: Shows if context is Generic, Faction-specific, or Detachment-specific

## Offline Processing (Python)

The `scripts/youtube_transcribe.py` script processes sources through the pipeline using **direct database connection** (v4.65.0+).

### Direct Database Connection (v4.65.0+)

The script now connects directly to Supabase PostgreSQL, eliminating the dependency on the Next.js server:

```python
# Connection uses DATABASE_URL from .env.local
# Automatically strips connection pooler params for direct connection
psycopg2.connect(DATABASE_URL)
```

**Benefits:**
- No need to run Next.js dev server during pipeline processing
- Faster execution without HTTP overhead
- More reliable for long-running batch operations
- Simpler error handling and transaction management

### Pipeline Commands

```bash
# Run complete pipeline (fetch → curate → extract)
python3 scripts/youtube_transcribe.py --process-all

# Run individual stages
python3 scripts/youtube_transcribe.py --fetch-pending    # Download content
python3 scripts/youtube_transcribe.py --curate-pending   # AI identifies units
python3 scripts/youtube_transcribe.py --extract-pending  # Extract unit context

# Aggregate for specific datasheet
python3 scripts/youtube_transcribe.py --aggregate --datasheet-name "Wulfen with Storm Shields"
python3 scripts/youtube_transcribe.py --aggregate --datasheet-id "uuid-here"

# Aggregate with faction/detachment scope
python3 scripts/youtube_transcribe.py --aggregate --datasheet-name "Intercessors" \
  --faction-id "eef01ca6-..." --detachment-id "abc123..."

# Aggregate ALL units for a faction (batch mode)
python3 scripts/youtube_transcribe.py --aggregate-all --faction-name "Space Wolves"
python3 scripts/youtube_transcribe.py --aggregate-all --faction-id "eef01ca6-..."
```

### Environment Variables
```bash
GOOGLE_API_KEY=your-gemini-key        # Required for AI extraction (Gemini)
OPENAI_API_KEY=your-openai-key        # Required for Whisper transcription
DATABASE_URL=postgresql://...          # Direct PostgreSQL connection (from .env.local)

# NOTE: The script reads DATABASE_URL from .env.local automatically.
# API_URL is no longer required as the script uses direct database access.
```

### Source Type Support
| Type | Method | Notes |
|------|--------|-------|
| YouTube | yt-dlp | Captions preferred, Whisper fallback |
| Reddit | JSON API | Uses `.json` endpoint for reliability |
| Article | BeautifulSoup | Extracts main content, strips nav/ads |
| Forum | BeautifulSoup | Thread content extraction |

### Audio Processing (v4.65.0+)

For YouTube videos without captions, the script uses Whisper for transcription:

| Feature | Details |
|---------|---------|
| **Audio Chunking** | Splits files > 20MB or > 15 minutes into 10-minute chunks |
| **Compression** | Uses ffmpeg to compress with opus codec at 48kbps |
| **Whisper API Limit** | 25MB max file size (chunking prevents 413 errors) |
| **Transcript Merging** | Chunks merged with paragraph breaks |

### Retry Logic (v4.65.0+)

All Gemini API calls use exponential backoff retry:

| Setting | Value | Purpose |
|---------|-------|---------|
| Max Retries | 3 | Total attempts before failure |
| Backoff | 1s → 2s → 4s | Exponential delay between retries |
| Retry Errors | `ConnectionError`, `RemoteDisconnected`, `ChunkedEncodingError` | Transient network errors |

### Configuration
| Setting | Value | Purpose |
|---------|-------|---------|
| `maxOutputTokens` | 65536 | Maximum Gemini output (prevents truncation) |
| API Timeout | 600s | 10-minute timeout for large transcripts |
| JSON Repair | Enabled | Salvages truncated responses |

### Dependencies

Required system tools:
- **ffmpeg** - Audio processing (compression, splitting)
- **yt-dlp** - YouTube download

Python packages:
- **psycopg2** - PostgreSQL direct connection
- **requests** - HTTP client with retry wrapper
- **pydub** - Audio duration detection

## Context Aggregation

When running `--aggregate` or `--aggregate-all`, the system:

1. **Collects Sources**: Finds all `DatasheetSource` entries with `status: "extracted"` and `isOutdated: false`
2. **Builds Context**: Combines all `extractedContext` JSON into a single prompt
3. **AI Synthesis**: Gemini-3-Flash analyzes all sources and generates:
   - `competitiveTier`: S/A/B/C/D/F ranking
   - `tierReasoning`: Explanation for the tier
   - `bestTargets`: Array of ideal targets
   - `counters`: Array of threats/counters
   - `synergies`: Array of synergistic units
   - `playstyleNotes`: How to use the unit
   - `deploymentTips`: Deployment advice
   - `competitiveNotes`: General competitive insights
4. **Conflict Detection**: Identifies disagreements between sources
5. **Database Update**: Saves synthesized context to `DatasheetCompetitiveContext` with appropriate scope

## API Reference

### Faction Sources
- `GET /api/admin/factions/[id]/sources` - List faction's competitive sources (includes detachment info)
- `POST /api/admin/factions/[id]/sources` - Add new source to faction (accepts `detachmentId`)

### Pipeline Processing
- `GET /api/admin/competitive-sources/pending?status=pending` - Get sources by status
- `PATCH /api/admin/competitive-sources/[id]` - Update source (content, status, detachmentId)
- `POST /api/admin/competitive-sources/[id]/datasheet-links` - Create DatasheetSource links

### Extraction
- `PATCH /api/admin/datasheet-sources/[id]/extract` - Update extraction results

### Aggregation
- `PATCH /api/admin/datasheets/[id]/aggregate` - Save aggregated context (accepts `factionId`, `detachmentId`)
- `GET /api/admin/datasheets/[id]/aggregate` - Get all contexts for a datasheet

### Context Lookup
- `GET /api/datasheets/detail/[id]/competitive-context` - Get best matching context with fallback
  - Query params: `factionId`, `detachmentId`
  - Returns: `{ datasheet, context, matchType, requestedScope }`

### Datasheet Sources
- `GET /api/admin/datasheets/[id]/sources` - Get linked sources for a datasheet

## Related Documentation
- [Competitive Context Lookup API](../api/COMPETITIVE_CONTEXT_LOOKUP_ENDPOINT.md) - Public API for context lookup with fallback
- [Tactical Dossier](./TACTICAL_DOSSIER.md) - Uses competitive context in analysis
- [Competitive Context Paste](./COMPETITIVE_CONTEXT_PASTE.md) - Legacy manual paste workflow
- [Admin Datasheet Sources API](../api/ADMIN_DATASHEET_SOURCES_API.md)
