# Army Parser Datasheet System

**Last Updated:** 2025-12-31  
**Status:** Complete  
**Version:** 4.54.0

## Overview

The Army Parser Datasheet System is Grimlog's AI-powered army list import feature that automatically parses Warhammer 40K army lists and matches units to comprehensive datasheets with full weapon profiles and abilities. Built on **multi-provider AI** (OpenAI Responses API or Google Gemini 3 Flash) with Structured Outputs, it provides type-safe parsing with confidence scoring and automatic review flagging.

**NEW v4.54.0:** Added support for `leaderRules` and `leaderAbilities` in the matching schema to support character attachment validation.

**NEW v4.35.0:** Added Gemini 3 Flash as an alternative provider option for faster parsing. Switch via `ARMY_PARSE_PROVIDER=google` environment variable.

**Key Capabilities:**
- Parses text files, PDFs, and images of army lists
- Matches units to full datasheets with stats (M, T, SV, W, LD, OC)
- Extracts weapon profiles (Range, Type, A, S, AP, D, Abilities)
- Matches abilities with descriptions and phase information
- Handles duplicate units (e.g., two Blood Claws squads)
- Provides confidence scores for all matches
- Flags low-confidence matches for manual review
- **NEW v4.30.0:** Improved AI exact-match emphasis preventing similar-name confusion
- **NEW v4.30.0:** Alphabetically sorted datasheets for better AI attention
- **NEW v4.30.0:** Enhanced Langfuse logging with full unit match details
- **NEW v4.30.0:** Fixed wargear review flagging (only flags unmatched/low confidence)
- **v4.24.0:** Enhanced review UI with per-component confidence indicators
- **v4.24.0:** Post-processing weapon matching for profile variants
- **v4.24.0:** Proper wargear classification (Storm Shield, Death Totem)

## Table of Contents

- [Architecture](#architecture)
- [Key Components](#key-components)
- [Data Flow](#data-flow)
- [Matching System](#matching-system)
- [Confidence Scoring](#confidence-scoring)
- [User Interface](#user-interface)
- [API Changes](#api-changes)
- [Database Schema](#database-schema)
- [Migration from UnitTemplate](#migration-from-unittempla)
- [Related Documentation](#related-documentation)

## Architecture

### System Design

```
┌─────────────────┐
│   User Uploads  │
│ Text/PDF/Image  │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────┐
│      Parse Endpoint                      │
│  /api/armies/parse                       │
│                                          │
│  1. Extract text from file               │
│  2. Query datasheets, weapons, abilities │
│  3. Build AI context                     │
│  4. Call Responses API (Structured Out)  │
│  5. Validate matches                     │
└────────┬─────────────────────────────────┘
         │
         v
┌──────────────────────────────────────────┐
│     Parsed Army List                     │
│  - Units with datasheet matches          │
│  - Weapons with full profiles            │
│  - Abilities with descriptions           │
│  - Confidence scores                     │
│  - Review flags                          │
└────────┬──────────────────────────────────┘
         │
         v
┌──────────────────────────────────────────┐
│        Review UI                         │
│  /armies/new                             │
│                                          │
│  - Expandable unit cards                 │
│  - Datasheet stats display               │
│  - Weapon profile tables                 │
│  - Ability descriptions                  │
│  - Manual review for low-confidence      │
└────────┬──────────────────────────────────┘
         │
         v
┌──────────────────────────────────────────┐
│      Save Endpoint                       │
│  /api/armies (POST)                      │
│                                          │
│  1. Validate datasheet IDs               │
│  2. Store weapons as JSON                │
│  3. Store abilities as JSON              │
│  4. Create army with units               │
└──────────────────────────────────────────┘
```

### Technology Stack

- **Multi-Provider AI** - OpenAI Responses API or Google Gemini 3 Flash (v4.35.0)
- **OpenAI**: `gpt-5-mini` - Fast, cost-effective model for parsing
- **Google Gemini**: `gemini-3-flash-preview` - Pro-level intelligence at Flash speed (v4.35.0)
- **Structured Outputs** - JSON Schema validation for type-safe parsing
- **Prisma ORM** - Database access with type safety
- **PostgreSQL** - Datasheet, weapon, and ability storage
- **Next.js 15** - Server-side API routes
- **React** - Interactive review UI
- **TypeScript** - End-to-end type safety

**Provider Selection (v4.35.0):**
- Set `ARMY_PARSE_PROVIDER=google` to use Gemini 3 Flash
- Set `ARMY_PARSE_PROVIDER=openai` or omit to use OpenAI (default)
- Both providers use identical structured output schemas

## Key Components

### 1. Parse Route (`app/api/armies/parse/route.ts`)

**Purpose:** Parses army lists using AI with comprehensive datasheet matching

**Key Features:**
- Multimodal input support (text, PDF, images)
- **Multi-provider support** (OpenAI or Gemini 3 Flash) - v4.35.0
- Structured Outputs with strict JSON schema validation
- Comprehensive AI context (datasheets, weapons, abilities)
- Confidence scoring for all matches
- Duplicate unit detection
- Langfuse tracing for observability (enhanced v4.30.0)

**Provider Configuration (v4.35.0):**
- Provider selected via `ARMY_PARSE_PROVIDER` environment variable
- Gemini 3 Flash uses `thinkingLevel: 'low'` for optimal speed
- Both providers produce identical output format

**Enhanced Logging (v4.30.0):**
The parse endpoint now logs comprehensive debugging data to Langfuse:
- **Input logging:**
  - Full army list content (not just 500 char preview)
  - Complete list of available datasheets (id, name, faction, weapon/ability counts)
- **Output logging:**
  - `unitMatches` - Detailed breakdown: input name → matched datasheet + ID + confidence + unmatched items
  - `problemMatches` - Quick reference to units with issues (confidence < 1.0 or unmatched items)
  - Full `parsedUnits` array for debugging
- **Post-processing logging:**
  - Pre/post state for weapon matching, wargear matching, wound effects
  - `changesDetected` flag to quickly see if processing made changes
- **Error logging:**
  - Full error message, type, and stack trace

**Schema Highlights:**
```typescript
{
  detectedFaction: string | null,
  detectedPointsLimit: number | null,
  units: Array<{
    name: string,
    parsedDatasheet: {
      datasheetId: string | null,
      name: string,
      faction: string | null,
      stats: { /* M, T, SV, W, LD, OC */ },
      leaderRules: string | null,
      leaderAbilities: string | null,
      matchConfidence: number,
      needsReview: boolean
    },
    weapons: Array<{
      weaponId: string | null,
      name: string,
      range: string | null,
      type: string | null,
      /* A, BS, WS, S, AP, D, abilities */
      matchConfidence: number,
      needsReview: boolean
    }>,
    abilities: Array<{
      abilityId: string | null,
      name: string,
      type: string | null,
      description: string | null,
      matchConfidence: number,
      needsReview: boolean
    }>,
    keywords: string[],
    pointsCost: number,
    modelCount: number,
    needsReview: boolean
  }>,
  parsingConfidence: number
}
```

### 2. Import UI (`app/armies/new/page.tsx`)

**Purpose:** Interactive review interface for parsed armies

**Key Features:**
- Two-step wizard (Upload → Review)
- Expandable unit cards with full details
- Color-coded confidence indicators
- Datasheet stats grid display
- Weapon profile tables
- Ability descriptions
- Manual editing before save
- Points total validation

**Enhanced Review UI (v4.24.0, fixed v4.30.0):**
- **Review Summary Banner**: Shows total issues at-a-glance
  - Units needing review count
  - Unmatched weapons count
  - Low confidence weapons count
  - Wargear items with issues (v4.30.0: only unmatched or low confidence, not all wargear)
  - Unmatched abilities count
- **Fixed (v4.30.0):** Review stats no longer flag properly matched wargear as issues
- **Per-Component Confidence**: Each weapon/ability shows individual confidence
  - Green dot (≥80%): Matched successfully
  - Yellow dot (50-80%): Uncertain match
  - Red dot (<50% or null): Not found
- **Inline Issue Display**: Shows specific problems
  - "2 weapons not matched: Axe Morkai, Paired combat blades"
  - "1 wargear item detected: Storm Shield"
- **Mark as Reviewed**: Manual override button to dismiss review flags
- **Delete Buttons**: Remove problematic weapons/abilities inline

**Confidence Colors:**
- 🟢 **Green (≥0.8)** - High confidence, auto-accepted
- 🟡 **Yellow (0.5-0.8)** - Medium confidence, needs review
- 🔴 **Red (<0.5)** - Low confidence, manual verification required

### 3. Save Route (`app/api/armies/route.ts`)

**Purpose:** Validates and saves parsed armies to database

**Key Features:**
- Datasheet ID validation
- Weapons stored as JSON array
- Abilities stored as JSON array
- User authentication integration
- Stats return (total units, needs review count, matched datasheets)

## Data Flow

### 1. Upload Phase

```
User uploads file
   ↓
Extract text/image
   ↓
Query database for context:
  - 200+ datasheets with full stats
  - All 528 weapons with profiles (v4.24.0: removed 200 limit)
  - 100+ abilities with descriptions
   ↓
Build AI system prompt with context
   ↓
Post-process weapon matches (v4.24.0):
  - Base name matching for unmatched weapons
  - Profile variant detection
```

### 2. Parse Phase

```
Call Responses API with:
  - System prompt (datasheets, weapons, abilities)
  - User input (army list text)
  - JSON schema (Structured Outputs)
  - Strict validation enabled
   ↓
AI returns structured JSON:
  - Matched datasheets with IDs
  - Matched weapons with profiles
  - Matched abilities with descriptions
  - Confidence scores (0-1)
  - Review flags
```

### 3. Review Phase

```
Display parsed units:
  - Unit cards (collapsible)
  - Review summary banner (total issues, unmatched weapons, wargear items)
  - Datasheet info (stats, keywords)
  - Weapon profiles with per-component confidence indicators
  - Ability descriptions with wargear items highlighted
  - Color-coded confidence dots (green/yellow/red)
  - Inline issue display showing specific problems
   ↓
Post-processing (v4.24.0):
  - Base name matching for unmatched weapons
  - Profile variant detection (strike/sweep, frag/krak)
  - Automatic stat copying from matched weapons
   ↓
User reviews and edits:
  - Expand units to see detailed weapon/ability confidence
  - Remove problematic weapons/abilities inline
  - Mark units as reviewed after manual verification
  - Edit points/models if needed
  - Remove incorrect units
  - Fill in army metadata
```

### 4. Save Phase

```
Validate datasheet IDs exist
   ↓
✅ NEW v4.6.0: Validate faction matches
   ↓
✅ NEW v4.6.0: Validate name similarity (70% threshold)
   ↓
Create army record
   ↓
Create unit records with:
  - datasheetId (FK to Datasheet, null if validation fails)
  - weapons (JSON array)
  - abilities (JSON array)
  - needsReview flag (true if validation fails)
   ↓
Return stats and success
```

## Matching System

### Datasheet Matching

**Algorithm (v4.30.0 Enhanced):**
1. Datasheets sorted **alphabetically** before sending to AI (improves attention on similar names)
2. Each datasheet formatted with ID prominently in name line:
   ```
   [uuid] DATASHEET: "Logan Grimnar" (110pts)
   ```
3. AI instructed to use **exact name matching first**
4. Explicit warning against similar-sounding name confusion (e.g., "Logan Grimnar" ≠ "Ragnar Blackmane")
5. Returns datasheet ID if found in database
6. Calculates confidence based on match quality
7. Sets `needsReview: true` if confidence < 0.8

**Exact Match Emphasis (v4.30.0):**
The AI prompt now includes explicit instructions:
- "ALWAYS use EXACT name matching first"
- "The datasheets are sorted ALPHABETICALLY - scroll through to find the exact name"
- "Each datasheet line starts with [ID] - use THIS ID for datasheetId"
- "Do NOT match to similar-sounding names"
- Concrete example: `Input "Logan Grimnar" → Find "[0b24550b-...] DATASHEET: "Logan Grimnar"" → Use ID "0b24550b-..."`

**Validation (v4.6.0+):**
When saving the army, the system performs additional validation:
- **Faction Validation**: Verifies the matched datasheet's faction matches the army's faction
  - If mismatch detected: `datasheetId` set to `null`, `needsReview` set to `true`
  - Prevents cross-faction mismatches (e.g., Space Marines unit matched to Tyranids datasheet)
- **Name Similarity Validation**: Uses Levenshtein distance to verify name match
  - Requires 70%+ similarity for acceptance
  - If similarity < 70%: `needsReview` set to `true` (keeps datasheetId but flags for review)
  - Handles minor variations like "Bjorn The Fell-Handed" vs "Bjorn the Fell-Handed"

**Confidence Levels:**
- **1.0** - Exact name and faction match
- **0.8-0.9** - Close match with minor variations
- **0.5-0.7** - Uncertain match, needs verification
- **0.0-0.4** - Poor match or not found

### Weapon Matching

**Algorithm (v4.24.0 Enhanced):**
1. AI receives all 528 weapons with full profiles (removed 200 limit)
2. Matches weapon names from army list using enhanced naming conventions
3. Understands profile variants (strike/sweep, frag/krak, standard/supercharge)
4. Prefers versions with ability suffixes (e.g., "Assault cannon [devastating wounds]")
5. Returns weapon ID if found in database
6. Returns `null` if weapon not in database (custom loadouts)

**Post-Processing (v4.24.0):**
After AI returns, a post-processing step improves matches:
- Groups weapons by base name (removes suffixes like `[ability]`, `— strike`, `– frag`)
- For unmatched weapons, searches by base name
- Prefers "strike", "standard", or "krak" variants when multiple exist
- Copies full weapon stats from matched database entry
- Updates confidence to 0.9 for profile variant matches
- Logs improvements: `Post-process: Matched "Axe Morkai" → "Axe Morkai — strike"`

**Weapon Naming Conventions:**
- **Profile Variants**: Separate entries for different stat profiles
  - "Axe Morkai — strike" / "Axe Morkai — sweep" (melee profiles)
  - "Missile launcher – frag" / "Missile launcher – krak" (ammo types)
  - "Plasma cannon – standard" / "Plasma cannon – supercharge" (firing modes)
- **Ability Suffixes**: Some weapons include abilities in brackets
  - "Assault cannon [devastating wounds]"
  - "Storm bolter [rapid fire 2]"
  - These versions have abilities properly tagged in the database

**Profile Extraction:**
- **Range:** e.g., "24\"", "Melee"
- **Type:** e.g., "Assault 2", "Heavy D6", "Melee"
- **Attacks:** e.g., "1", "D6", "3"
- **BS/WS:** Ballistic Skill or Weapon Skill (if applicable)
- **Strength:** e.g., "4", "8", "User"
- **AP:** e.g., "0", "-1", "-3"
- **Damage:** e.g., "1", "2", "D6"
- **Abilities:** Array of weapon special rules

### Ability Matching

**Algorithm:**
1. AI receives 100+ abilities with descriptions
2. Matches ability names from datasheets
3. Identifies ability type (core, faction, unit, leader, wargear)
4. Returns ability ID if found in database
5. Infers description if mentioned in list

**Wargear Classification (v4.24.0):**
- **Wargear** items (Storm Shield, Death Totem, Jump Pack) are now correctly classified
- Wargear provides passive abilities but has NO attack profile (no Range, S, AP, D)
- Wargear goes in `abilities` array with `type: "wargear"`
- AI prompt explicitly distinguishes weapons (attack items) from wargear (passive equipment)

### Duplicate Unit Handling

**Critical Feature:**
The system explicitly handles duplicate units in army lists. The AI is instructed:

```
CRITICAL: DUPLICATE UNITS ARE VALID
- Army lists frequently contain multiple instances of the same unit type
- Each instance in the list is a SEPARATE unit that must be included in the output
- Do NOT deduplicate or merge units with the same name
- Example: If "Blood Claws (135 Points)" appears twice, return TWO separate entries
```

This ensures proper parsing of armies with multiple squads of the same type.

## Confidence Scoring

### Overall Unit Confidence

```typescript
unit.needsReview = 
  unit.parsedDatasheet.needsReview ||
  unit.weapons.some(w => w.needsReview) ||
  unit.abilities.some(a => a.needsReview);
```

A unit needs review if ANY component has low confidence.

### UI Indicators

- **High Confidence (≥0.8)**: ✓ Green badge, "High (95%)"
- **Medium Confidence (0.5-0.8)**: ⚠️ Yellow badge, "Medium (65%)"
- **Low Confidence (<0.5)**: ⚠️ Red badge, "Low (30%)"

### Review Workflow

1. Units with `needsReview: true` displayed with yellow/red indicators
2. User expands card to view full details
3. User verifies datasheet match is correct
4. User can manually edit if needed
5. System saves with review flag for future reference

## User Interface

### Upload Step

- File picker (drag & drop supported)
- Accepts: JPG, PNG, PDF, TXT
- Max size: 10MB
- Progress indicator during parsing

### Review Step

**Army Metadata Form:**
- Player Name (required)
- Faction (dropdown, required)
- Army Name (required)
- Points Limit (default: 2000)

**Unit Cards:**
```
┌─────────────────────────────────────────┐
│ Blood Claws               🟢 High (100%) │
│ Datasheet: Blood Claws | Battleline     │
│ [+] [-] [×]                             │
├─────────────────────────────────────────┤
│ MODELS: 10  POINTS: 135  WEAPONS: 2     │
└─────────────────────────────────────────┘
   ↓ Click to expand
┌─────────────────────────────────────────┐
│ DATASHEET STATS                         │
│ M: 6"  T: 4  SV: 3+  W: 1  LD: 6  OC: 1│
│ Keywords: [INFANTRY] [BATTLELINE] ...   │
│                                         │
│ WEAPONS                                 │
│ ┌────────────────────────────────────┐ │
│ │ Astartes chainsword    ✓ Matched  │ │
│ │ Range: Melee | A: 2 | S: 4        │ │
│ │ AP: 0 | D: 1                       │ │
│ └────────────────────────────────────┘ │
│                                         │
│ ABILITIES                               │
│ (none parsed)                           │
└─────────────────────────────────────────┘
```

### Points Total

Displays running total vs points limit:
```
TOTAL: 2000 / 2000 PTS
```

### Save Button

- Disabled until metadata complete
- Shows "SAVING..." during save
- Redirects to army detail page on success

## API Changes

### Parse Endpoint

**Before (Chat Completions + JSON Mode):**
```typescript
POST /api/armies/parse

Response: {
  detectedFaction: string,
  units: Array<{
    name: string,
    matchedTemplateId: string | null,
    matchConfidence: number
  }>
}
```

**After (Responses API + Structured Outputs):**
```typescript
POST /api/armies/parse

Response: {
  detectedFaction: string | null,
  detectedPointsLimit: number | null,
  units: Array<{
    name: string,
    parsedDatasheet: { /* full datasheet info */ },
    weapons: [ /* weapon profiles */ ],
    abilities: [ /* ability info */ ],
    keywords: string[],
    pointsCost: number,
    modelCount: number,
    needsReview: boolean
  }>,
  parsingConfidence: number
}
```

### Save Endpoint

**Before:**
```typescript
POST /api/armies
{
  units: [{
    unitTemplateId: string
  }]
}
```

**After:**
```typescript
POST /api/armies
{
  units: [{
    parsedDatasheet: {
      datasheetId: string | null
    },
    weapons: ParsedWeapon[],
    abilities: ParsedAbility[]
  }]
}
```

## Database Schema

### Unit Model Changes

**Before:**
```prisma
model Unit {
  unitTemplateId String?
  unitTemplate   UnitTemplate? @relation(...)
}
```

**After:**
```prisma
model Unit {
  datasheetId   String?
  fullDatasheet Datasheet? @relation(...)
  weapons       String?  // JSON: ParsedWeapon[]
  abilities     String?  // JSON: ParsedAbility[]
}
```

### Removed Models

- `UnitTemplate` - Fully replaced by comprehensive Datasheet system

### New Relations

- `Unit.fullDatasheet` → `Datasheet` (optional FK)
- `UnitInstance.fullDatasheet` → `Datasheet` (optional FK)

## Migration from UnitTemplate

### Why Migrate?

**Old System (UnitTemplate):**
- ❌ Basic stats only (M, T, SV, W, LD, OC)
- ❌ Weapons as JSON strings
- ❌ Abilities as JSON strings
- ❌ No validation
- ❌ No weapon profiles
- ❌ No ability descriptions

**New System (Datasheet):**
- ✅ Full 10th edition datasheets
- ✅ Normalized weapon database with profiles
- ✅ Normalized ability database with descriptions
- ✅ Junction tables for proper relations
- ✅ Comprehensive matching
- ✅ Confidence scoring

### Breaking Changes

1. **Database Schema:**
   - `UnitTemplate` table removed
   - `Unit.unitTemplateId` removed
   - `Unit.datasheetId` added
   - `Unit.weapons` JSON field added
   - `Unit.abilities` JSON field added

2. **API Changes:**
   - Parse endpoint returns different structure
   - Save endpoint expects different structure
   - Session endpoints use `fullDatasheet` instead of `unitTemplate`

3. **Data Loss:**
   - Existing armies with `unitTemplateId` no longer work
   - Must re-import armies to get datasheet matching

### Migration Steps

1. **Update Database:**
   ```bash
   npx prisma db push --accept-data-loss
   npx prisma generate
   ```

2. **Restart Services:**
   - Restart Next.js dev server
   - Restart TypeScript server in editor

3. **Re-import Armies:**
   - Navigate to `/armies/new`
   - Upload army lists again
   - Verify datasheet matching

4. **Verify Sessions:**
   - Old sessions may fail if armies deleted
   - Create new sessions with re-imported armies

## Related Documentation

- [Parse Armies API Reference](../api/PARSE_ARMIES_ENDPOINT.md) - Detailed API documentation
- [Datasheet Integration](./DATASHEET_INTEGRATION.md) - Datasheet system overview
- [Datasheet Import Guide](../guides/DATASHEET_IMPORT_GUIDE.md) - How to import datasheets
- [Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md) - How to import armies (if exists)
- [OpenAI Responses API Migration](https://platform.openai.com/docs/guides/responses) - OpenAI documentation

