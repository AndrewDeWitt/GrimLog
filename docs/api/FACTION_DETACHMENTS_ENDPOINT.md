# Faction Detachments API Endpoint

**Last Updated:** 2025-12-10
**Status:** Complete
**Version:** 4.24.0
**Endpoint:** `GET /api/factions/[id]/detachments`

## Overview

Fetches available detachments for a specific faction based on stratagems in the database. Used in army import flow and army detail page to populate detachment selection dropdowns.

**New in v4.24.0:** Subfactions (e.g., Space Wolves) now include detachments from their parent faction (e.g., Space Marines). This allows Space Wolves to use generic Space Marine detachments like "Gladius Task Force" in addition to Space Wolves-specific detachments.

## Table of Contents

- [Request](#request)
- [Response](#response)
- [Implementation](#implementation)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Related Documentation](#related-documentation)

## Request

### HTTP Method
```
GET /api/factions/[id]/detachments
```

### URL Parameters

| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| `id`      | string | Yes      | UUID of the faction (from Faction table) |

### Headers
```
Content-Type: application/json
```

### Authentication
No authentication required (read-only endpoint)

## Response

### Success (200 OK)

**Response Type:** `string[]`

Returns array of detachment names sorted alphabetically.

```json
[
  "Champions of Fenris",
  "Saga of the Beastslayer",
  "Saga of the Bold",
  "Saga of the Hunter"
]
```

### Response Fields

Array of strings representing unique detachment names for the faction.

**Filtering Applied:**
- Excludes `null` detachments
- Excludes `"Core"` (universal stratagems)
- Excludes `"Unknown"` (parsing artifacts)
- Sorted alphabetically

## Implementation

### Query Logic

```typescript
// Get the faction to check for parent faction (e.g., Space Wolves -> Space Marines)
const faction = await prisma.faction.findUnique({
  where: { id },
  select: { parentFactionId: true }
});

// Build list of faction IDs to query (this faction + parent if exists)
const factionIds = [id];
if (faction?.parentFactionId) {
  factionIds.push(faction.parentFactionId);
}

// Get unique detachments for this faction AND parent faction from StratagemData
const stratagems = await prisma.stratagemData.findMany({
  where: {
    factionId: { in: factionIds },
    detachment: {
      not: null
    }
  },
  select: {
    detachment: true
  },
  distinct: ['detachment']
});

// Extract and filter
const detachments = stratagems
  .map(s => s.detachment)
  .filter((d): d is string => 
    d !== null && 
    d !== 'Core' && 
    d !== 'Unknown'
  )
  .sort();

return NextResponse.json(detachments);
```

### Database Query

**Models Used:**
- `StratagemData` - Source of detachment names

**Indexes Used:**
- `@@index([factionId])` - Fast faction filtering
- `@@index([detachment])` - Fast distinct query

## Examples

### Example 1: Space Wolves Detachments

**Request:**
```http
GET /api/factions/c2e73d04-278d-4429-b4fd-c5d0526b3a3a/detachments
```

**Response (v4.24.0+):**
```json
[
  "1st Company Task Force",
  "Anvil Siege Force",
  "Blade of Ultramar",
  "Champions of Fenris",
  "Companions of Vehemence",
  "Firestorm Assault Force",
  "Forgefather's Seekers",
  "Gladius Task Force",
  "Godhammer Assault Force",
  "Hammer of Avernii",
  "Ironstorm Spearhead",
  "Liberator Assault Group",
  "Librarius Conclave",
  "Saga of the Beastslayer",
  "Saga of the Bold",
  "Saga of the Hunter",
  "Spearpoint Task Force",
  "Stormlance Task Force",
  "Vanguard Spearhead",
  "Vindication Task Force",
  "Wrathful Procession"
]
```

**Note:** Space Wolves now includes 17 Space Marine detachments + 4 Space Wolves-specific detachments (21 total).

### Example 2: Space Marines Detachments

**Request:**
```http
GET /api/factions/550e8400-e29b-41d4-a716-446655440000/detachments
```

**Response:**
```json
[
  "1st Company Task Force",
  "Anvil Siege Force",
  "Blade of Ultramar",
  "Emperor's Shield",
  "Firestorm Assault Force",
  "Forgefather's Seekers",
  "Gladius Task Force",
  "Hammer of Avernii",
  "Ironstorm Spearhead",
  "Librarius Conclave",
  "Shadowmark Talon",
  "Spearpoint Task Force",
  "Stormlance Task Force",
  "Vanguard Spearhead"
]
```

### Example 3: Faction with No Stratagems

**Request:**
```http
GET /api/factions/new-faction-id/detachments
```

**Response:**
```json
[]
```

## Error Handling

### 500 Internal Server Error

**Cause:** Database query failed or invalid faction ID

**Response:**
```json
{
  "error": "Failed to fetch detachments"
}
```

**Debug Steps:**
1. Verify faction ID exists in database
2. Check database connection
3. Review server logs for Prisma errors

## Usage in Application

### Army Import Flow

```typescript
// After parsing completes and faction is known
const response = await fetch(`/api/factions/${selectedFaction.id}/detachments`);
const detachments = await response.json();
setAvailableDetachments(detachments);

// Auto-select if AI detected one
if (parsedData.detectedDetachment && detachments.includes(parsedData.detectedDetachment)) {
  setSelectedDetachment(parsedData.detectedDetachment);
}
```

### Army Detail Page

```typescript
// On page load after fetching army
if (army.factionId) {
  const response = await fetch(`/api/factions/${army.factionId}/detachments`);
  const detachments = await response.json();
  setAvailableDetachments(detachments);
}
```

## Performance

**Query Complexity:** O(log n) - Uses index on `factionId`

**Typical Response Time:** < 50ms

**Caching:** No caching implemented (detachments rarely change)

## Future Enhancements

### Potential Improvements

1. **Detachment Metadata**: Return stratagem count per detachment
   ```json
   [
     { "name": "Saga of the Hunter", "stratagemCount": 6 },
     { "name": "Champions of Fenris", "stratagemCount": 6 }
   ]
   ```

2. **Include Descriptions**: Add detachment rule descriptions
3. **Cache Response**: Add Redis/memory caching for faster repeated calls

## Related Documentation

- **[Stratagem & Detachment System](../features/STRATAGEM_DETACHMENT_SYSTEM.md)** - Full feature overview
- **[Factions Endpoint](FACTIONS_ENDPOINT.md)** - Faction API
- **[Armies Endpoint](PARSE_ARMIES_ENDPOINT.md)** - Army creation/parsing API
- **[Database Schema](../../prisma/schema.prisma)** - StratagemData model

