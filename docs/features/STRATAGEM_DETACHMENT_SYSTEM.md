# Stratagem & Detachment System

**Last Updated:** 2024-11-20
**Status:** Complete
**Version:** 4.10.0

## Overview

The Stratagem & Detachment System provides a comprehensive, relational database of faction-specific stratagems with proper detachment scoping. This ensures armies only see stratagems relevant to their chosen detachment, improving usability and accuracy during gameplay.

## Table of Contents

- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [User Interface](#user-interface)
- [Scraping & Seeding](#scraping--seeding)
- [Related Documentation](#related-documentation)

## Architecture

### Key Components

1. **StratagemData Model** - Reference data for all stratagems
2. **Faction-Detachment Relationship** - Links stratagems to specific detachments
3. **Army Detachment Selection** - Required field on armies
4. **Dynamic Filtering** - Runtime filtering based on army's detachment

### Design Decisions

- **Separation of Reference vs Instance**: `StratagemData` stores the canonical stratagem rules, while `Stratagem` model (legacy) stores army-specific custom stratagems
- **Detachment-First Design**: Stratagems are scoped to detachments, not just factions
- **Core Stratagems**: Universal stratagems (detachment: "Core") are available to all armies
- **Boarding Actions Exclusion**: Alternative game mode stratagems are excluded from main gameplay

## Data Flow

### Army Import Flow

```
1. User selects Faction → Fetches available datasheets
2. User uploads army list → AI parses and detects detachment
3. Review step shows detachment dropdown → Required field
4. User confirms/selects detachment → Army created with detachment field
5. Army detail page → Stratagems filtered by detachment
```

### Stratagem Filtering

```
GET /api/armies/{id}
  ↓
  Query: army.factionId + army.detachment
  ↓
  Filter StratagemData:
    - WHERE factionId = army.factionId
    - AND (detachment = army.detachment OR detachment = "Core" OR detachment IS NULL)
  ↓
  Return: Filtered stratagems + army.stratagems (manual)
```

### Detachment Change Flow

```
User changes detachment dropdown
  ↓
  handleDetachmentChange() fires
  ↓
  PATCH /api/armies/{id} { detachment: "Saga of the Hunter" }
  ↓
  GET /api/armies/{id} (fetch updated data)
  ↓
  Update stratagems in UI (no page reload)
```

## Database Schema

### StratagemData Table

```prisma
model StratagemData {
  id           String   @id @default(uuid())
  name         String
  faction      String   // "Space Marines", "Space Wolves"
  factionRel   Faction? @relation(fields: [factionId], references: [id])
  factionId    String?
  subfaction   String?
  detachment   String?  // "Saga of the Hunter", "Champions of Fenris", "Core"
  cpCost       Int
  type         String   // "Battle Tactic", "Strategic Ploy", "Epic Deed"
  when         String   // Phase/timing
  target       String   // What can be targeted
  effect       String   // What the stratagem does
  restrictions String?
  keywords     String?  // JSON array
  
  // Metadata
  edition    String   @default("10th")
  sourceBook String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // Relations
  stratagemLogs StratagemLog[]

  @@unique([name, faction, detachment])
  @@index([factionId])
  @@index([detachment])
}
```

### Army Table (Detachment Field)

```prisma
model Army {
  id         String   @id @default(uuid())
  name       String
  factionId  String?
  detachment String?  // ← Required for stratagem filtering
  // ... other fields
}
```

## API Endpoints

### GET /api/factions/[id]/detachments

**Purpose:** Fetch available detachments for a faction

**Response:**
```json
[
  "Saga of the Hunter",
  "Saga of the Bold",
  "Saga of the Beastslayer",
  "Champions of Fenris"
]
```

**Implementation:**
```typescript
// Queries distinct detachment names from StratagemData
const stratagems = await prisma.stratagemData.findMany({
  where: { factionId: id, detachment: { not: null } },
  select: { detachment: true },
  distinct: ['detachment']
});

// Filter out "Core", "Unknown", null
const detachments = stratagems
  .map(s => s.detachment)
  .filter(d => d !== null && d !== 'Core' && d !== 'Unknown')
  .sort();
```

### GET /api/armies/[id]

**Enhanced Response:**
```json
{
  "id": "...",
  "name": "WolvesTestingStuff",
  "detachment": "Saga of the Beastslayer",
  "factionId": "...",
  "stratagems": [
    // Filtered to show only:
    // 1. Detachment-specific stratagems
    // 2. Core/universal stratagems
  ]
}
```

**Filtering Logic:**
```typescript
if (army.detachment) {
  availableStratagems = availableStratagems.filter(s => {
    const sDetachment = (s.detachment || '').toLowerCase().trim();
    return !sDetachment || 
           sDetachment === 'core' || 
           sDetachment === armyDetachment;
  });
} else {
  // No detachment = only Core stratagems
  availableStratagems = availableStratagems.filter(s => {
    const sDetachment = (s.detachment || '').toLowerCase().trim();
    return !sDetachment || sDetachment === 'core';
  });
}
```

### PATCH /api/armies/[id]

**New Field:**
```json
{
  "detachment": "Saga of the Hunter"
}
```

**Updates detachment and triggers stratagem re-filtering**

## User Interface

### Army Import Flow (`app/armies/new/page.tsx`)

**Step 1: Faction Selection**
- Shows faction with stratagem count in Intelligence Report
- Count includes ALL stratagems for that faction

**Step 2: Review & Metadata**
- **New: Detachment Dropdown** (required field)
- Fetches detachments after parsing completes
- Auto-selects if AI detected detachment from list
- Validation: Cannot create army without detachment

```tsx
<select
  value={selectedDetachment}
  onChange={(e) => setSelectedDetachment(e.target.value)}
  required
>
  <option value="">-- Select Detachment --</option>
  {availableDetachments.map((det) => (
    <option key={det} value={det}>{det}</option>
  ))}
</select>
```

### Army Detail Page (`app/armies/[id]/page.tsx`)

**Detachment Selector Section:**
- Shows current detachment
- Allows changing detachment post-creation
- **Live Updates**: Changing detachment immediately:
  1. Saves to database via PATCH
  2. Fetches updated army data
  3. Updates stratagems list (no page reload)

```tsx
const handleDetachmentChange = async (newDetachment: string) => {
  setSelectedDetachment(newDetachment);
  
  // Save detachment
  await fetch(`/api/armies/${army.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ detachment: newDetachment })
  });
  
  // Fetch updated stratagems
  const updatedArmy = await fetch(`/api/armies/${army.id}`).then(r => r.json());
  setArmy(prev => ({ ...prev, stratagems: updatedArmy.stratagems }));
};
```

## Scraping & Seeding

### Scraper: `scripts/scrapeAllStratagems.ts`

**Source:** `https://wahapedia.ru/wh40k10ed/factions/space-marines/`

**Features:**
- Scrapes all Space Marine faction supplements from single page
- Detects faction context switches via header parsing
- Extracts detachment names from stratagem metadata
- Excludes Boarding Actions detachments

**Excluded Game Modes:**
- Boarding Strike
- Pilum Strike Team
- Terminator Assault
- Combat Patrol

**Output:**
- `data/parsed-rules/stratagems-space-wolves.json` (33 stratagems)
- `data/parsed-rules/stratagems-space-marines.json` (84 stratagems)
- `data/parsed-rules/stratagems-blood-angels.json` (24 stratagems)
- `data/parsed-rules/stratagems-dark-angels.json` (30 stratagems)
- `data/parsed-rules/stratagems-black-templars.json` (24 stratagems)
- `data/parsed-rules/stratagems-deathwatch.json` (6 stratagems)

**Usage:**
```bash
npx tsx scripts/scrapeAllStratagems.ts
npx tsx scripts/scrapeAllStratagems.ts --skip-cache  # Force fresh scrape
```

### Seeder: `scripts/seedStratagems.ts`

**Features:**
- Reads JSON files from `data/parsed-rules/`
- Links stratagems to factions via `factionId`
- Filters out Boarding Actions at seed time
- Upserts (updates existing, creates new)

**Boarding Actions Filter:**
```typescript
const boardingActionsDetachments = [
  'Boarding Strike',
  'Pilum Strike Team',
  'Terminator Assault',
  'Combat Patrol'
];

if (s.detachment && boardingActionsDetachments.includes(s.detachment)) {
  continue; // Skip
}
```

**Usage:**
```bash
npx tsx scripts/seedStratagems.ts
```

## Example: Space Wolves Detachments

### Available Detachments
1. **Saga of the Hunter** - 6 stratagems
2. **Saga of the Bold** - 6 stratagems  
3. **Saga of the Beastslayer** - 6 stratagems
4. **Champions of Fenris** - 6 stratagems
5. **Core** - 9 universal stratagems (shared by all)

### Stratagem Count by Detachment

When a Space Wolves army selects "Saga of the Beastslayer":
- **Detachment-Specific**: 6 stratagems
- **Core/Universal**: 9 stratagems
- **Total Shown**: ~15 stratagems

When no detachment selected:
- **Core/Universal Only**: 9 stratagems

## Technical Implementation

### Key Files

**API Routes:**
- `app/api/factions/[id]/detachments/route.ts` - Fetch detachments for faction
- `app/api/armies/[id]/route.ts` - Get/update army with filtered stratagems
- `app/api/armies/route.ts` - Create army with detachment validation

**UI Components:**
- `app/armies/new/page.tsx` - Import flow with detachment selection
- `app/armies/[id]/page.tsx` - Army detail with detachment selector

**Scripts:**
- `scripts/scrapeAllStratagems.ts` - Scrape from Wahapedia
- `scripts/seedStratagems.ts` - Seed database

**Libraries:**
- `lib/factionConstants.ts` - Faction definitions and relationships

### Critical Code Sections

**Detachment Filtering Logic:**

```typescript:app/api/armies/[id]/route.ts
// Filter by Detachment
if (army.detachment) {
  const armyDetachment = army.detachment.toLowerCase().trim();
  
  availableStratagems = availableStratagems.filter(s => {
    const sDetachment = (s.detachment || '').toLowerCase().trim();
    
    return !sDetachment ||        // No restriction
           sDetachment === 'core' || // Universal
           sDetachment === armyDetachment; // Matches
  });
} else {
  // Only Core stratagems if no detachment
  availableStratagems = availableStratagems.filter(s => {
    const sDetachment = (s.detachment || '').toLowerCase().trim();
    return !sDetachment || sDetachment === 'core';
  });
}
```

**Live Detachment Update:**

```typescript:app/armies/[id]/page.tsx
const handleDetachmentChange = async (newDetachment: string) => {
  setSelectedDetachment(newDetachment);
  
  // Save immediately
  await fetch(`/api/armies/${army.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ detachment: newDetachment || null })
  });
  
  // Fetch updated stratagems
  const armyResponse = await fetch(`/api/armies/${army.id}`);
  const updatedArmy = await armyResponse.json();
  
  // Update only stratagems (no full reload)
  setArmy(prev => ({ 
    ...prev, 
    stratagems: updatedArmy.stratagems,
    detachment: newDetachment 
  }));
};
```

## Validation Rules

### During Import
1. Faction must be selected first
2. Detachment dropdown appears after parsing
3. Detachment selection is **required** before army creation
4. If AI detects detachment from list, it's pre-selected

### During Gameplay
1. Only detachment-specific + Core stratagems are shown
2. Changing detachment updates stratagems immediately
3. Character attachments saved separately from detachment

## Common Patterns

### Adding New Faction Stratagems

1. Add faction to Wahapedia URL or scraper logic
2. Run scraper: `npx tsx scripts/scrapeAllStratagems.ts`
3. Verify JSON in `data/parsed-rules/stratagems-{faction}.json`
4. Seed database: `npx tsx scripts/seedStratagems.ts`
5. Verify count: Check faction in import screen

### Updating Existing Stratagems

1. Delete cached HTML: `data/wahapedia-cache/space-marines-full.html`
2. Re-scrape: `npx tsx scripts/scrapeAllStratagems.ts --skip-cache`
3. Re-seed: `npx tsx scripts/seedStratagems.ts`
4. Existing `StratagemData` records will be updated (upsert logic)

## Troubleshooting

### "Stratagems: 0" showing for faction

**Cause:** Faction has no stratagems in database  
**Solution:**
1. Check if JSON exists: `data/parsed-rules/stratagems-{faction}.json`
2. If missing, run scraper for that faction
3. Run seeder to import

### Too many stratagems showing

**Cause:** Army has no detachment selected  
**Solution:**
1. Visit army detail page
2. Select detachment from dropdown
3. Stratagems will auto-filter

### Boarding Actions stratagems appearing

**Cause:** Old data before exclusion logic  
**Solution:**
1. Re-run seeder with latest version
2. Boarding Actions will be skipped during upsert

### Detachment not in dropdown

**Cause:** No stratagems exist for that detachment in database  
**Solution:**
1. Verify detachment name matches Wahapedia exactly
2. Check JSON file for that detachment
3. May need to manually add or re-scrape

## Example Usage

### Creating Army with Detachment

```typescript
const response = await fetch('/api/armies', {
  method: 'POST',
  body: JSON.stringify({
    playerName: "Andrew",
    faction: "Space Wolves",
    armyName: "The Great Company",
    pointsLimit: 2000,
    detachment: "Saga of the Hunter", // ← Required
    units: [...]
  })
});
```

### Fetching Stratagems for Army

```typescript
const army = await fetch('/api/armies/abc-123').then(r => r.json());

// army.stratagems contains:
// - Saga of the Hunter stratagems (6)
// - Core stratagems (9)
// Total: ~15 stratagems
```

### Changing Detachment

```typescript
// User selects "Champions of Fenris" from dropdown
// → handleDetachmentChange() auto-fires
// → PATCH saves detachment
// → GET fetches updated stratagems
// → UI shows new stratagems (6 Champions + 9 Core)
```

## Performance Considerations

### Caching Strategy

- **Scraper**: Caches HTML to `data/wahapedia-cache/` to avoid rate limiting
- **API**: No caching on stratagems (filtered dynamically per request)
- **Frontend**: Stratagems fetched with army data, updated on detachment change

### Query Optimization

- Indexed on `factionId` and `detachment` for fast filtering
- Unique constraint on `[name, faction, detachment]` prevents duplicates
- Distinct query for fetching detachment list

## Migration Notes

### Existing Armies (Pre-4.10.0)

Armies created before this feature will have `detachment: null`. They will:
1. Show only Core stratagems until detachment is selected
2. Display warning: "Select a detachment to see detachment-specific stratagems"
3. Users must manually select detachment on army detail page

### Database Migration

No schema changes required - `detachment` field already existed on Army table. Only changes:
1. Added `factionId` relationship validation
2. Added filtering logic in GET endpoint
3. Made field editable via PATCH endpoint

## Related Documentation

- **[Faction System](FACTION_SYSTEM.md)** - Faction hierarchy and relationships
- **[Army Parser](ARMY_PARSER_DATASHEET_SYSTEM.md)** - How army lists are parsed
- **[Factions Endpoint](../api/FACTIONS_ENDPOINT.md)** - Faction API reference
- **[Database Schema](../../prisma/schema.prisma)** - Full schema reference
- **[CHANGELOG](../../CHANGELOG.md)** - Version history

