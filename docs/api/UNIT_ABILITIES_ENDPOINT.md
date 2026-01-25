# Unit Abilities API Endpoint

**Last Updated:** 2025-01-XX  
**Status:** Complete  
**Version:** 4.6.0

## Overview

The Unit Abilities endpoint retrieves phase-aware ability data for all units in a game session. It supports optional phase filtering to show only abilities relevant to the current game phase, enabling contextual ability display in the UI.

## Table of Contents

- [Endpoint Details](#endpoint-details)
- [Request](#request)
- [Response](#response)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Implementation Notes](#implementation-notes)
- [Related Documentation](#related-documentation)

---

## Endpoint Details

**URL:** `/api/sessions/[id]/units/abilities`  
**Method:** `GET`  
**Authentication:** Required (via session)  
**Rate Limit:** Standard API limits apply

---

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | ✅ Yes | Game session ID |

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `phase` | string | ❌ No | Filter abilities by game phase | `Command`, `Movement`, `Shooting`, `Charge`, `Fight` |

### Valid Phase Values

- `Command`
- `Movement`
- `Shooting`
- `Charge`
- `Fight`

**Note:** Abilities marked with `triggerPhase: ["Any"]` are returned regardless of phase filter.

---

## Response

### Success Response (200 OK)

**Note:** As of v4.6.0, the response structure has been updated to separate attacker and defender data, with pre-computed army vs unit abilities.

```json
{
  "sessionId": "abc-123-def-456",
  "currentPhase": "Shooting",
  "attacker": {
    "armyAbilities": [
      {
        "name": "Oath of Moment",
        "type": "faction",
        "description": "Oath of Moment",
        "triggerPhase": ["Any"],
        "triggerSubphase": null,
        "isReactive": false,
        "requiredKeywords": [],
        "source": "faction"
      }
    ],
    "units": [
      {
        "unitId": "unit-001",
        "unitName": "Lieutenant With Combi-weapon",
        "datasheet": "Lieutenant With Combi-weapon",
        "abilities": [
          {
            "name": "EVADE AND SURVIVE",
            "type": "faction",
            "description": "Once per turn, when an enemy unit ends a Normal, Advance or Fall Back move within 9\" of this unit, if this unit is not within Engagement Range of one or more enemy units, it can make a Normal move.",
            "triggerPhase": ["Movement"],
            "triggerSubphase": "During Action",
            "isReactive": true,
            "requiredKeywords": [],
            "source": "faction"
          }
        ]
      }
    ]
  },
  "defender": {
    "armyAbilities": [
      {
        "name": "Synapse",
        "type": "faction",
        "description": "Synapse",
        "triggerPhase": ["Any"],
        "triggerSubphase": null,
        "isReactive": false,
        "requiredKeywords": ["TYRANIDS"],
        "source": "faction"
      }
    ],
    "units": [
      {
        "unitId": "unit-002",
        "unitName": "The Swarmlord",
        "datasheet": "The Swarmlord",
        "abilities": [
          {
            "name": "DEADLY DEMISE D3",
            "type": "core",
            "description": "Deadly Demise D3",
            "triggerPhase": ["Any"],
            "triggerSubphase": null,
            "isReactive": true,
            "requiredKeywords": [],
            "source": "core"
          }
        ]
      }
    ]
  }
}
```

### Response Fields

#### Root Object

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Game session ID |
| `currentPhase` | string? | Current phase if filter was applied |
| `attacker` | object | Attacker army abilities data |
| `defender` | object | Defender army abilities data |

#### Owner Abilities Data Object

| Field | Type | Description |
|-------|------|-------------|
| `armyAbilities` | array | Deduplicated abilities appearing on multiple units (army-wide abilities) |
| `units` | array | Array of units with their unit-specific abilities only |

#### Unit Object

| Field | Type | Description |
|-------|------|-------------|
| `unitId` | string | Unique unit instance ID |
| `unitName` | string | Display name of the unit |
| `datasheet` | string | Datasheet reference name |
| `abilities` | array | Array of unit-specific ability objects (abilities appearing only on this unit or with unit-specific language) |

#### Ability Object

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Ability name |
| `type` | string | `"core"`, `"faction"`, `"unit"`, `"leader"`, or `"wargear"` |
| `description` | string | Full ability rules text |
| `triggerPhase` | string[] | Phases when ability can be used. `["Any"]` for passive auras |
| `triggerSubphase` | string\|null | Specific timing: `"Start of Phase"`, `"During Action"`, `"End of Phase"`, or `null` |
| `isReactive` | boolean | `true` if usable during opponent's turn |
| `requiredKeywords` | string[] | Keywords required for ability to apply |
| `source` | string | Where the ability comes from: `"core"`, `"faction"`, `"unit"`, `"leader"` |

---

## Examples

### Example 1: Get All Abilities (No Filter)

**Request:**
```http
GET /api/sessions/abc-123-def-456/units/abilities
```

**Response:**
```json
{
  "sessionId": "abc-123-def-456",
  "attacker": {
    "armyAbilities": [
      {
        "name": "Oath of Moment",
        "type": "faction",
        "description": "Oath of Moment",
        "triggerPhase": ["Any"],
        "triggerSubphase": null,
        "isReactive": false,
        "requiredKeywords": [],
        "source": "faction"
      }
    ],
    "units": [
      {
        "unitId": "unit-001",
        "unitName": "Captain in Terminator Armour",
        "datasheet": "Captain in Terminator Armour",
        "abilities": [
          {
            "name": "Leader",
            "type": "core",
            "description": "This model can be attached to certain units.",
            "triggerPhase": ["Any"],
            "triggerSubphase": null,
            "isReactive": false,
            "requiredKeywords": [],
            "source": "core"
          },
          {
            "name": "Rites of Battle",
            "type": "leader",
            "description": "While this model is leading a unit, weapons equipped by models in that unit have the [LETHAL HITS] ability.",
            "triggerPhase": ["Shooting", "Fight"],
            "triggerSubphase": "During Action",
            "isReactive": false,
            "requiredKeywords": [],
            "source": "leader"
          }
        ]
      }
    ]
  },
  "defender": {
    "armyAbilities": [],
    "units": []
  }
}
```

### Example 2: Filter by Shooting Phase

**Request:**
```http
GET /api/sessions/abc-123-def-456/units/abilities?phase=Shooting
```

**Response:**
```json
{
  "sessionId": "abc-123-def-456",
  "currentPhase": "Shooting",
  "attacker": {
    "armyAbilities": [
      {
        "name": "Oath of Moment",
        "type": "faction",
        "description": "Oath of Moment",
        "triggerPhase": ["Any"],
        "triggerSubphase": null,
        "isReactive": false,
        "requiredKeywords": [],
        "source": "faction"
      }
    ],
    "units": [
      {
        "unitId": "unit-001",
        "unitName": "Hellblaster Squad",
        "datasheet": "Hellblaster Squad",
        "abilities": [
          {
            "name": "Hellblasters",
            "type": "unit",
            "description": "Each time this unit shoots, you can choose normal or supercharge mode for all plasma incinerators.",
            "triggerPhase": ["Shooting"],
            "triggerSubphase": "Start of Phase",
            "isReactive": false,
            "requiredKeywords": [],
            "source": "unit"
          }
        ]
      }
    ]
  },
  "defender": {
    "armyAbilities": [],
    "units": []
  }
}
```

### Example 3: Units with No Phase-Relevant Abilities

**Request:**
```http
GET /api/sessions/abc-123-def-456/units/abilities?phase=Command
```

**Response (No units have Command phase abilities):**
```json
{
  "sessionId": "abc-123-def-456",
  "currentPhase": "Command",
  "attacker": {
    "armyAbilities": [],
    "units": []
  },
  "defender": {
    "armyAbilities": [],
    "units": []
  }
}
```

---

## Error Handling

### 404 - Session Not Found

**Response:**
```json
{
  "error": "Session not found"
}
```

**Cause:** Invalid or non-existent session ID

**Solution:** Verify session ID exists and user has access

### 500 - Internal Server Error

**Response:**
```json
{
  "error": "Failed to fetch unit abilities"
}
```

**Cause:** Database connection error or query failure

**Solution:** Check server logs, verify database connectivity

---

## Implementation Notes

### Caching

- Abilities data is cached with 5-minute TTL (recommended)
- Cache is automatically invalidated when datasheets are re-seeded
- Use the `useUnitAbilities` hook for client-side caching

### Performance

- Query includes JOIN with `Datasheet`, `DatasheetAbility`, and `Ability` tables
- Only fetches abilities for non-destroyed units
- Phase filtering reduces response payload size
- Recommended to use phase filter when displaying contextual abilities

### Phase Filtering Logic

```typescript
// Abilities are included if:
// 1. triggerPhase includes the requested phase, OR
// 2. triggerPhase includes "Any"

const isRelevant = ability.triggerPhase.includes(requestedPhase) || 
                   ability.triggerPhase.includes('Any');
```

### Data Flow

1. API validates session exists
2. Fetches all `UnitInstance` records for session (where `isDestroyed = false`)
3. Includes related `Datasheet` → `DatasheetAbility` → `Ability`
4. Parses JSON fields (`triggerPhase`, `requiredKeywords`)
5. **Validates abilities match datasheet faction/keywords** (v4.6.0+)
6. Applies phase filter if provided
7. **Groups units by owner (attacker/defender)** (v4.6.0+)
8. **Computes army abilities** (abilities appearing on multiple units) (v4.6.0+)
9. **Computes unit abilities** (abilities appearing on one unit or with unit-specific language) (v4.6.0+)
10. Returns structured response with pre-computed army/unit separation

### Ability Categorization Logic (v4.6.0+)

The API automatically categorizes abilities as either **army abilities** or **unit abilities**:

- **Army Abilities**: Abilities that appear on multiple units for the same owner (e.g., "Oath of Moment" appearing on all Space Marines units)
- **Unit Abilities**: Abilities that:
  - Appear on only one unit, OR
  - Contain unit-specific language ("this unit", "this model", "models in this unit", etc.)

This ensures abilities like "EVADE AND SURVIVE" (which says "this unit") are correctly shown as unit abilities even if they're marked as faction type in the database.

---

## Related Documentation

- [Phase-Aware Abilities Feature](../features/PHASE_AWARE_ABILITIES.md) - Feature overview and architecture
- [Units Endpoint](UNITS_ENDPOINT.md) - Main units API reference
- [Datasheets API](DATASHEETS_API.md) - Datasheet system overview
- [Army Parser Datasheet System](../features/ARMY_PARSER_DATASHEET_SYSTEM.md) - Army import and validation system
- [Game State Guide](../guides/GAME_STATE_GUIDE.md) - How game state is managed
- [Project Architecture](../ARCHITECTURE.md) - Overall system design

