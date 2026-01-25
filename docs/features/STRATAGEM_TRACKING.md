# Stratagem Tracking System

**Last Updated:** 2025-11-18  
**Status:** Complete

## Overview

The Stratagem Tracking System provides comprehensive logging, visualization, and data analysis for stratagem usage during Warhammer 40K games. It tracks who used each stratagem, the CP cost, links to the official rule data, and displays this information prominently in the Event Timeline.

This feature integrates with the Event Timeline, CP tracking system, and the Wahapedia-sourced Stratagem Database to provide real-time feedback and historical analysis.

## Table of Contents

- [Architecture](#architecture)
- [Key Components](#key-components)
- [Database Schema](#database-schema)
- [Stratagem Data Pipeline](#stratagem-data-pipeline)
- [UI Components](#ui-components)
- [Usage](#usage)
- [Related Documentation](#related-documentation)

## Architecture

### Data Flow

1. **Data Collection** (Wahapedia Scraping)
   - `scripts/scrapeStratagems.ts` scrapes stratagem rules from Wahapedia
   - Captures name, CP cost, type, phase timing, detachment, and full rule text
   - Outputs to `data/parsed-rules/stratagems-{faction}.json`

2. **Data Seeding** (Database Population)
   - `scripts/seedStratagems.ts` imports scraped data into `StratagemData` table
   - Handles updates and deduplication
   - Links stratagems to factions and detachments

3. **Runtime Logging** (Game Session)
   - AI tool `log_stratagem_use` or Manual UI (`StratagemLoggerModal`)
   - Creates `StratagemLog` entry linked to game session
   - Attempts to link to `StratagemData` for full rule information
   - Deducts CP from appropriate player
   - Creates timeline event

4. **Visualization** (Timeline Display)
   - Timeline component displays stratagem events with badges
   - Shows Attacker/Defender indicator
   - Shows CP cost
   - Supports filtering and revert functionality

### Component Diagram

```
┌─────────────────────┐
│   Wahapedia.ru      │
└──────────┬──────────┘
           │ (scrape)
           ▼
┌─────────────────────┐
│ StratagemData       │ ◄──┐
│ (Database Table)    │    │
└──────────┬──────────┘    │ (link)
           │                │
           │ (reference)    │
           ▼                │
┌─────────────────────┐    │
│  StratagemLog       │────┘
│  (Usage History)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Timeline UI        │
│  (Event Display)    │
└─────────────────────┘
```

## Key Components

### 1. Scraping Scripts

#### `scripts/scrapeStratagems.ts`
Scrapes stratagem rules from Wahapedia unit pages (which contain all faction stratagems).

**Key Features:**
- Parses `.s10Wrap` elements containing stratagem cards
- Extracts detachment names from type field (e.g., "Gladius Task Force – Battle Tactic")
- Handles multiple detachments per faction
- Rate-limited and cached for respectful scraping

**Usage:**
```bash
npx tsx scripts/scrapeStratagems.ts "space-marines"
npx tsx scripts/scrapeStratagems.ts "tyranids"
```

**Output Format:**
```json
{
  "stratagems": [
    {
      "name": "ADAPTIVE STRATEGY",
      "type": "Strategic Ploy",
      "cpCost": "1",
      "phase": "Any",
      "when": "...",
      "target": "...",
      "effect": "...",
      "restrictions": "...",
      "detachment": "Gladius Task Force",
      "faction": "space-marines",
      "source": "Wahapedia"
    }
  ]
}
```

#### `scripts/scrapeDetachments.ts`
Scrapes valid detachment names for supported factions.

**Output:**
```json
{
  "faction": "space-marines",
  "detachments": [
    "Gladius Task Force",
    "Firestorm Assault Force",
    "Saga of the Beastslayer",
    ...
  ],
  "updatedAt": "2025-11-18T..."
}
```

### 2. Database Seeding

#### `scripts/seedStratagems.ts`
Imports scraped stratagems into the database.

**Features:**
- Upserts based on `name + faction + detachment`
- Converts CP cost to integer
- Links to `StratagemData` table
- Handles updates to existing data

**Usage:**
```bash
npx tsx scripts/seedStratagems.ts
```

### 3. Backend Logic

#### `lib/toolHandlers.ts` - `logStratagemUse()`

Handles stratagem usage logging with the following workflow:

1. **Validation**
   - Checks if player has sufficient CP
   - Validates stratagem usage restrictions (once per battle/turn/phase)
   - Returns validation warnings if issues detected

2. **CP Deduction**
   - Updates `attackerCommandPoints` or `defenderCommandPoints`
   - Creates `CPTransaction` record for audit trail

3. **Data Linking**
   - Attempts exact match on stratagem name
   - Falls back to fuzzy match (contains)
   - Links `StratagemLog` to `StratagemData` via `stratagemDataId`

4. **Timeline Event Creation**
   - Creates event with type `stratagem`
   - Stores metadata: `usedBy`, `cpCost`, `targetUnit`, `cpRemaining`

**Code Reference:**
```typescript:612:710:lib/toolHandlers.ts
async function logStratagemUse(args: LogStratagemArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Get current session to check CP
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Fetch context and validate stratagem use
  const context = await fetchGameContext(sessionId);
  const validation = validateStratagemUse(
    args.stratagem_name,
    args.used_by,
    session.currentPhase,
    context
  );

  const cpField = args.used_by === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
  const currentCP = args.used_by === 'attacker' ? session.attackerCommandPoints : session.defenderCommandPoints;
  const newCP = Math.max(0, currentCP - args.cp_cost);

  // Check if insufficient CP - add additional validation
  if (currentCP < args.cp_cost) {
    // Invalidate session cache (CP changed even with error)
    invalidateSessionCaches(sessionId, false);
    
    return {
      toolName: 'log_stratagem_use',
      success: true, // Execute anyway, but flag it
      message: `${args.stratagem_name} used (-${args.cp_cost} CP, ${newCP} CP remaining)`,
      data: { stratagem: args.stratagem_name, cpCost: args.cp_cost, cpRemaining: newCP },
      validation: {
        severity: 'error',
        message: `Insufficient CP: ${args.used_by} has ${currentCP} CP but stratagem costs ${args.cp_cost} CP`,
        rule: 'insufficient_cp',
        suggestion: 'Verify CP cost or current CP total',
        requiresOverride: true,
      },
    };
  }

  // Update session CP
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      [cpField]: newCP
    }
  });

  // Try to find matching StratagemData to link
  let stratagemDataId: string | null = null;
  
  try {
    // 1. Try exact match first
    const exactMatch = await prisma.stratagemData.findFirst({
      where: {
        name: {
          equals: args.stratagem_name,
          mode: 'insensitive'
        }
      }
    });
    
    if (exactMatch) {
      stratagemDataId = exactMatch.id;
    } else {
      // 2. Try contains match
      const containsMatch = await prisma.stratagemData.findFirst({
        where: {
          name: {
            contains: args.stratagem_name,
            mode: 'insensitive'
          }
        }
      });
      
      if (containsMatch) {
        stratagemDataId = containsMatch.id;
      }
    }
  } catch (error) {
    console.warn('Failed to lookup stratagem data:', error);
  }

  // Log the stratagem use
  await prisma.stratagemLog.create({
    data: {
      gameSessionId: sessionId,
      stratagemName: args.stratagem_name,
      cpCost: args.cp_cost,
      usedBy: args.used_by,
      phase: session.currentPhase,
      targetUnit: args.target_unit,
      description: args.description,
      stratagemDataId: stratagemDataId
    }
  });
```

#### `lib/cpTracking.ts` - CP Spent Calculation

Tracks CP expenditure from both `StratagemLog` and manual CP adjustments.

**Key Fix Applied:**
- Now handles both `attacker`/`defender` (new) and `player`/`opponent` (legacy) values
- Ensures accurate CP tracking across all use cases

```typescript:68:84:lib/cpTracking.ts
  // Count stratagem CP costs
  for (const stratagem of allStratagems) {
    const cost = stratagem.cpCost || 0;
    
    // Map 'attacker' to 'player' and 'defender' to 'opponent' for the return object
    if (stratagem.usedBy === 'attacker' || stratagem.usedBy === 'player') {
      playerTotal += cost;
      if (stratagem.timestamp >= roundStartTime) {
        playerRound += cost;
      }
    } else if (stratagem.usedBy === 'defender' || stratagem.usedBy === 'opponent') {
      opponentTotal += cost;
      if (stratagem.timestamp >= roundStartTime) {
        opponentRound += cost;
      }
    }
  }
```

### 4. Frontend Components

#### `components/Timeline.tsx` - Event Display

Enhanced to show stratagem-specific information:

**Badges Added:**
- **User Badge**: Shows "ATTACKER" (green) or "DEFENDER" (red)
- **CP Cost Badge**: Shows "-X CP" in amber color

**Implementation:**
```typescript:385:478:components/Timeline.tsx
    // Parse metadata safely for stratagem details
    const stratagemInfo = event.eventType === 'stratagem' ? (() => {
      try {
        const m = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata || {};
        return { usedBy: m.usedBy, cpCost: m.cpCost };
      } catch { return {}; }
    })() : null;
    
    // ... rendering logic ...
    
    {/* Stratagem Badges */}
    {stratagemInfo?.usedBy && (
      <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 ${
        stratagemInfo.usedBy === 'attacker'
          ? 'bg-grimlog-green text-grimlog-black border-grimlog-green'
          : 'bg-grimlog-red text-grimlog-black border-grimlog-red'
      }`}>
        {stratagemInfo.usedBy}
      </span>
    )}
    {stratagemInfo?.cpCost !== undefined && (
      <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 text-grimlog-amber border-grimlog-amber bg-amber-950">
        -{stratagemInfo.cpCost} CP
      </span>
    )}
```

#### `components/StratagemLoggerModal.tsx` - Manual Entry

Modal for manually logging stratagems with:
- Player selection (Attacker/Defender)
- CP cost selector (1-3 CP)
- CP availability validation
- Target unit field (optional)
- Description field (optional)

## Database Schema

### StratagemData Table

Stores the official stratagem rules from Wahapedia.

```sql
CREATE TABLE "StratagemData" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  faction TEXT NOT NULL,
  subfaction TEXT,
  detachment TEXT,  -- e.g., "Gladius Task Force"
  cpCost INTEGER NOT NULL,
  type TEXT NOT NULL,  -- "Battle Tactic", "Strategic Ploy", "Epic Deed"
  when TEXT NOT NULL,  -- Phase/timing
  target TEXT NOT NULL,
  effect TEXT NOT NULL,
  restrictions TEXT,
  keywords TEXT,  -- JSON array
  -- Phase-aware metadata
  triggerPhase TEXT,  -- JSON array
  triggerSubphase TEXT,
  isReactive BOOLEAN DEFAULT false,
  requiredKeywords TEXT,  -- JSON array
  usageRestriction TEXT,  -- "once_per_battle", "once_per_turn", "once_per_phase"
  -- Metadata
  edition TEXT DEFAULT '10th',
  sourceBook TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP,
  
  UNIQUE(name, faction, detachment)
);
```

**Indexes:**
- `(faction, subfaction)`
- `(detachment)`
- `(name)`

### StratagemLog Table

Tracks stratagem usage during game sessions.

```sql
CREATE TABLE "StratagemLog" (
  id TEXT PRIMARY KEY,
  gameSessionId TEXT NOT NULL REFERENCES "GameSession"(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  stratagemName TEXT NOT NULL,
  cpCost INTEGER NOT NULL,
  usedBy TEXT NOT NULL,  -- "attacker" or "defender"
  phase TEXT NOT NULL,
  targetUnit TEXT,
  description TEXT,
  
  -- Link to stratagem data
  stratagemDataId TEXT REFERENCES "StratagemData"(id),
  
  INDEX (gameSessionId, timestamp),
  INDEX (stratagemDataId)
);
```

## Stratagem Data Pipeline

### Step 1: Scraping

Run the scraper for each faction:

```bash
npx tsx scripts/scrapeStratagems.ts "space-marines"
npx tsx scripts/scrapeStratagems.ts "tyranids"
```

The scraper:
- Fetches Wahapedia HTML pages (with rate limiting and caching)
- Parses `.s10Wrap` elements containing stratagem cards
- Extracts structured data (name, type, CP cost, rule text)
- Identifies detachment from type field parsing

### Step 2: Seeding

Import scraped data into the database:

```bash
npx tsx scripts/seedStratagems.ts
```

This will:
- Read all `stratagems-*.json` files from `data/parsed-rules/`
- Upsert into `StratagemData` table
- Report statistics (added, updated, errors)

**Current Data:**
- **Space Marines:** 130 stratagems across 31 detachments
- **Tyranids:** (to be scraped)
- **Total in DB:** 149 stratagems (as of 2025-11-18)

### Step 3: Usage Tracking

During a game session, stratagems are logged via:

**Voice Command:**
```
"I'm using Transhuman Physiology on the Intercessors"
```
→ AI calls `log_stratagem_use` tool

**Manual UI:**
- Click "LOG STRATAGEM" button
- Fill in stratagem name, select player, choose CP cost
- Submit → Creates log entry + timeline event

### Step 4: Data Linking

When a stratagem is logged:
1. System searches `StratagemData` for matching name
2. If found, links via `stratagemDataId` foreign key
3. This enables:
   - Full rule text lookup
   - Usage analytics by detachment
   - Validation of CP costs
   - Strategic Assistant recommendations

## UI Components

### Timeline Event Card (Stratagem)

**Visual Elements:**
- 📍 Icon: `◆` (diamond)
- 🎨 Color: Amber/orange theme
- 🏷️ Badges:
  - Event Type: "STRATAGEM"
  - User: "ATTACKER" (green) or "DEFENDER" (red)
  - CP Cost: "-X CP" (amber)
  - Phase: Current game phase

**Example:**
```
┌─────────────────────────────────────────────┐
│ ◆  [STRATAGEM] [ATTACKER] [-1 CP] [SHOOTING]│
│                                   6:45:23 PM │
│                                              │
│  attacker used Transhuman Physiology (1 CP) │
│  on Intercessor Squad                        │
│                                              │
│  [⎌ UNDO]                                    │
└─────────────────────────────────────────────┘
```

### Stratagem Logger Modal

Manual entry interface with:
- **Used By**: Toggle between ATTACKER/DEFENDER (shows available CP)
- **Stratagem Name**: Text input (required)
- **CP Cost**: Button selector (1/2/3 CP)
- **Target Unit**: Optional text input
- **Description**: Optional textarea
- **Validation**: Prevents submission if insufficient CP

**Location:** `components/StratagemLoggerModal.tsx`

## Usage

### For Players

1. **Voice Logging** (Recommended)
   ```
   "Using Armour of Contempt on the Terminators"
   "I'll use Fire Overwatch, costs 1 CP"
   ```

2. **Manual Logging**
   - Open Strategic Assistant or Stratagem menu
   - Click "LOG STRATAGEM"
   - Fill in details
   - Submit

### For Developers

**Query Stratagem Usage:**
```typescript
const logs = await prisma.stratagemLog.findMany({
  where: { gameSessionId: sessionId },
  include: {
    stratagemData: true  // Get full rule text
  },
  orderBy: { timestamp: 'desc' }
});
```

**Get Available Stratagems for Detachment:**
```typescript
const stratagems = await prisma.stratagemData.findMany({
  where: {
    faction: 'space-marines',
    detachment: 'Gladius Task Force'
  }
});
```

**Calculate CP Spent:**
```typescript
import { calculateCPSpent } from '@/lib/cpTracking';

const cpSpent = await calculateCPSpent(sessionId, battleRound);
// Returns: { player: { round: 2, total: 5 }, opponent: { round: 1, total: 3 } }
```

## Detachment Integration

### Army Model

The `Army` model now includes a `detachment` field:

```typescript
model Army {
  id String @id
  name String
  detachment String?  // e.g., "Gladius Task Force", "Saga of the Beastslayer"
  // ... other fields
}
```

### Army List Parser

The AI-powered army list parser (`/api/armies/parse`) now:
- Loads known detachment lists from `data/parsed-rules/detachments-*.json`
- Includes detachment names in the LLM prompt
- Explicitly instructs to distinguish detachments from battle sizes
- Returns `detectedDetachment` in the parsed result

**Key Distinction:**
- ❌ "Strike Force" = Battle size (2000 points)
- ✅ "Saga of the Beastslayer" = Detachment (rules choice)

### Linking Strategy (Current)

**String-based matching** (no FK constraint to Detachment table):
- `Army.detachment` → free text field
- `StratagemData.detachment` → free text field
- Matching done via string comparison in queries
- Validated against scraped detachment lists during parsing

**Rationale:**
- Flexibility for new codex releases
- Simpler maintenance
- Existing pattern works well for `StratagemData`
- No complex migration needed when detachments are added/renamed

**Future Consideration:**
If strict validation becomes necessary, could add a `Detachment` reference table with FK constraint, but current approach is sufficient for game tracking needs.

## Related Documentation

- [Event Timeline Feature](TIMELINE_EVENTS.md) - Timeline visualization system
- [AI Tool Calling](AI_TOOL_CALLING.md) - How stratagems are logged via voice
- [CP Tracking](../api/CP_SPENT_ENDPOINT.md) - CP calculation and tracking
- [Manual UI Controls](MANUAL_UI_CONTROLS.md) - Stratagem logger modal
- [Army List Parsing](ARMY_LIST_PARSING.md) - How detachments are extracted
- [Wahapedia Scraping Guide](../guides/WAHAPEDIA_SCRAPING_GUIDE.md) - Data collection process

