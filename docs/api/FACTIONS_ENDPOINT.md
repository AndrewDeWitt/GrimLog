# Factions API Endpoint

**Last Updated:** 2024-11-18  
**Status:** Complete  
**Version:** 4.8.0  
**Endpoint:** `GET /api/factions`

## Overview

Returns all available factions that have at least one datasheet in the database. Used by the army import UI to populate the faction selector and show what's supported.

## Request

### Endpoint
```
GET /api/factions
```

### Authentication
None required (public endpoint)

### Parameters
None

## Response

### Success Response (200)

**Format:**
```json
[
  {
    "id": "uuid-string",
    "name": "Space Wolves",
    "datasheetCount": 165,
    "stratagemCount": 25,
    "parentFaction": {
      "id": "uuid-string",
      "name": "Space Marines"
    }
  },
  {
    "id": "uuid-string",
    "name": "Tyranids",
    "datasheetCount": 73,
    "stratagemCount": 13,
    "parentFaction": null
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique faction ID (UUID) |
| `name` | string | Faction name (e.g., "Space Marines") |
| `datasheetCount` | number | Number of datasheets available for this faction |
| `stratagemCount` | number | Number of stratagems available |
| `parentFaction` | object\|null | Parent faction if this is a subfaction |
| `parentFaction.id` | string | Parent faction ID |
| `parentFaction.name` | string | Parent faction name |

### Error Responses

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch factions"
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/factions');
const factions = await response.json();

// Display in dropdown
factions.forEach(faction => {
  console.log(`${faction.name} (${faction.datasheetCount} datasheets)`);
  if (faction.parentFaction) {
    console.log(`  ✓ Includes ${faction.parentFaction.name} units`);
  }
});
```

### React Component

```typescript
const [factions, setFactions] = useState<Faction[]>([]);

useEffect(() => {
  fetch('/api/factions')
    .then(res => res.json())
    .then(data => setFactions(data));
}, []);

return (
  <select>
    {factions.map(f => (
      <option key={f.id} value={f.id}>
        {f.name} ({f.datasheetCount} datasheets)
      </option>
    ))}
  </select>
);
```

## Implementation Details

### Database Query

```typescript
await prisma.faction.findMany({
  where: {
    datasheets: {
      some: {} // Must have at least one datasheet
    }
  },
  include: {
    parentFaction: true,
    _count: {
      select: {
        datasheets: true,
        stratagemData: true
      }
    }
  },
  orderBy: { name: 'asc' }
});
```

### Filtering Logic

- Only returns factions with `datasheets.length > 0`
- This prevents showing factions without game data
- Parent factions are included even if they have no direct datasheets (e.g., if all moved to subfactions)

### Parent-Child Relationships

When a faction has a `parentFactionId`:
- The API returns both the faction and its parent info
- UI can display "✓ Includes [Parent] units"
- Parse endpoint uses both faction IDs for datasheet matching

**Example:**
```
Space Wolves (parentFactionId → Space Marines)
```
When parsing a Space Wolves army, datasheets are loaded from:
- `factionId = Space Wolves` 
- `factionId = Space Marines`

This gives Space Wolves armies access to both specific and shared units.

## Performance

- **Query Time:** ~50ms (indexed on factionId)
- **Response Size:** ~1KB for 4 factions
- **Caching:** Consider adding client-side caching (not implemented yet)

## Related Endpoints

- **[Parse Armies Endpoint](PARSE_ARMIES_ENDPOINT.md)** - Uses factionId for filtering
- **[Datasheets API](DATASHEETS_API.md)** - Returns datasheets filtered by faction

## Related Documentation

- **[Faction System](../features/FACTION_SYSTEM.md)** - Complete faction system overview
- **[Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md)** - User-facing import flow



