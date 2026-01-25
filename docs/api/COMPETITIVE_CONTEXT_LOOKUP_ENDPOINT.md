# Competitive Context Lookup Endpoint

**Last Updated:** 2025-12-29
**Status:** Complete

## Overview

Retrieves synthesized competitive context for a datasheet with intelligent fallback across scope levels (detachment → faction → generic).

## Table of Contents
- [Endpoint](#endpoint)
- [Query Parameters](#query-parameters)
- [Response Format](#response-format)
- [Fallback Logic](#fallback-logic)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Endpoint

```
GET /api/datasheets/detail/[id]/competitive-context
```

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Datasheet UUID |

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `factionId` | string | No | Filter to faction-specific context |
| `detachmentId` | string | No | Filter to detachment-specific context |

## Response Format

### Success Response (200)

```json
{
  "datasheet": {
    "id": "abc123",
    "name": "Wolf Guard Terminators"
  },
  "context": {
    "id": "ctx-456",
    "competitiveTier": "S",
    "tierReasoning": "Wolf Guard Terminators are widely considered an auto-include...",
    "bestTargets": ["Medium infantry", "Vehicles (with Arjac)"],
    "counters": ["Massed anti-tank", "Mortal wound spam"],
    "synergies": ["Logan Grimnar", "Arjac Rockfist", "Murderfang"],
    "playstyleNotes": "Deploy via Logan Grimnar's Turn 1 reserve ability...",
    "deploymentTips": "Use 10-man brick with Storm Shields for maximum durability.",
    "sourceCount": 5,
    "lastAggregated": "2025-12-29T13:13:42.424Z"
  },
  "matchType": "faction",
  "requestedScope": {
    "factionId": "eef01ca6-...",
    "detachmentId": null
  }
}
```

### No Context Found (200)

```json
{
  "datasheet": {
    "id": "abc123",
    "name": "Some Unit"
  },
  "context": null,
  "matchType": "none",
  "requestedScope": {
    "factionId": null,
    "detachmentId": null
  }
}
```

### Error Response (404)

```json
{
  "error": "Datasheet not found"
}
```

## Fallback Logic

The endpoint searches for context in this order:

1. **Detachment-Specific** (if `detachmentId` provided)
   - Matches: `factionId` AND `detachmentId`
   - Returns `matchType: "detachment"`

2. **Faction-Specific** (if `factionId` provided)
   - Matches: `factionId` AND `detachmentId IS NULL`
   - Returns `matchType: "faction"`

3. **Generic**
   - Matches: `factionId IS NULL` AND `detachmentId IS NULL`
   - Returns `matchType: "generic"`

4. **None Found**
   - Returns `context: null, matchType: "none"`

## Examples

### Lookup generic context for any army

```bash
curl "http://localhost:3000/api/datasheets/detail/abc123/competitive-context"
```

### Lookup faction-specific context

```bash
curl "http://localhost:3000/api/datasheets/detail/abc123/competitive-context?factionId=eef01ca6-..."
```

### Lookup detachment-specific context with fallback

```bash
curl "http://localhost:3000/api/datasheets/detail/abc123/competitive-context?factionId=eef01ca6-...&detachmentId=det-789"
```

If no detachment-specific context exists, will fall back to faction-specific, then generic.

## Error Handling

| Status | Condition | Response |
|--------|-----------|----------|
| 200 | Success (even if no context) | Full response with `matchType` |
| 404 | Datasheet not found | `{ "error": "Datasheet not found" }` |
| 500 | Database error | `{ "error": "..." }` |

## Use Cases

### In Public Datasheet View (v4.50.0)
```typescript
// Fetch context using the datasheet's linked faction
const factionIdForContext = datasheet.factionDetails?.id || datasheet.factionId;
const contextUrl = `/api/datasheets/detail/${datasheetId}/competitive-context?factionId=${factionIdForContext}`;
const res = await fetch(contextUrl);
const { context, matchType } = await res.json();

// Display competitive insights section if context exists
if (context) {
  // Show tier badge, reasoning, targets, counters, synergies, playstyle notes
}
```

### In Tactical Dossier
```typescript
// Fetch context for user's army faction
const res = await fetch(`/api/datasheets/detail/${datasheetId}/competitive-context?factionId=${army.factionId}&detachmentId=${army.detachmentId}`);
const { context, matchType } = await res.json();

if (context) {
  console.log(`Using ${matchType} context: ${context.competitiveTier}`);
}
```

### In Army List Display
```typescript
// Show competitive tier badge if context exists
const context = await getCompetitiveContext(unit.datasheetId, army.factionId);
if (context?.competitiveTier) {
  return <Badge>{context.competitiveTier}-Tier</Badge>;
}
```

## Related Documentation
- [Competitive Context Database](../features/COMPETITIVE_CONTEXT_DATABASE.md) - Full system documentation
- [Tactical Dossier](../features/TACTICAL_DOSSIER.md) - Uses this endpoint for analysis

