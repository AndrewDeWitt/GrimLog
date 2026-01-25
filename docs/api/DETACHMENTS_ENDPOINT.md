# Detachments API Endpoint

**Last Updated:** 2025-11-20
**Status:** Complete
**Version:** 4.10.0
**Endpoint:** `GET /api/factions/[id]/detachments`

## Overview

Returns all available detachments for a specific faction by querying the `StratagemData` table. This is used to populate the detachment selector during army creation and editing.

## Request

### Endpoint
```
GET /api/factions/[id]/detachments
```

### Authentication
None required (public endpoint)

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The Faction ID (UUID) to fetch detachments for |

## Response

### Success Response (200)

**Format:**
```json
[
  "Gladius Task Force",
  "Anvil Siege Force",
  "Firestorm Assault Force",
  "Ironstorm Spearhead",
  "Stormlance Task Force",
  "Vanguard Spearhead",
  "1st Company Task Force"
]
```

Returns a sorted array of unique detachment names (strings).

### Filtering Logic
The endpoint automatically filters out:
- `null` values
- "Core" (reserved for universal stratagems)
- "Unknown" (placeholder data)

### Error Responses

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch detachments"
}
```

## Usage Examples

### Fetching Detachments in React

```typescript
const fetchDetachments = async (factionId: string) => {
  const response = await fetch(`/api/factions/${factionId}/detachments`);
  if (response.ok) {
    const detachments = await response.json();
    setAvailableDetachments(detachments);
  }
};
```

## Implementation Details

### Database Query

```typescript
await prisma.stratagemData.findMany({
  where: {
    factionId: id,
    detachment: { not: null }
  },
  select: { detachment: true },
  distinct: ['detachment']
});
```

It queries the `StratagemData` table because detachments are currently defined by the stratagems available to them. There is no separate `Detachment` table.

## Related Documentation

- **[Factions API Endpoint](FACTIONS_ENDPOINT.md)** - Parent resource
- **[Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md)** - Usage context

