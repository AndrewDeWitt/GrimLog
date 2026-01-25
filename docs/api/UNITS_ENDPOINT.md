# Units API Endpoint

**Last Updated:** 2025-12-18  
**Status:** Complete  
**Base Path:** `/api/sessions/[id]/units`

## Overview

The Units API provides endpoints for managing unit instances within game sessions. Unit instances represent the live state of units on the battlefield, tracking models, wounds, battleshock status, and active effects.

## Table of Contents

- [Endpoints](#endpoints)
  - [GET - Fetch Unit Instances](#get-fetch-unit-instances)
  - [POST - Initialize Units](#post-initialize-units)
  - [PATCH - Update Unit](#patch-update-unit)
  - [PATCH - Update Model (Per-Model)](#patch---update-model-per-model)
  - [DELETE - Remove Unit](#delete-remove-unit)
- [Data Models](#data-models)
- [Examples](#examples)
- [Error Handling](#error-handling)

---

## Endpoints

### GET - Fetch Unit Instances

**Endpoint:** `GET /api/sessions/[id]/units`

Retrieves all unit instances for a game session, including both attacker and defender units.

#### Request

**Path Parameters:**
- `id` (string, required) - Game session ID

**Example:**
```http
GET /api/sessions/abc123/units
```

#### Response

**Success (200):**
```json
{
  "sessionId": "abc123",
  "attackerArmyId": "attacker-army-123",
  "unitInstances": [
    {
      "id": "unit-instance-1",
      "gameSessionId": "abc123",
      "unitName": "Terminator Squad",
      "owner": "attacker",
      "datasheet": "Terminator Squad",
      "datasheetId": "datasheet-uuid",
      "faction": "Space Marines",
      "startingModels": 5,
      "currentModels": 3,
      "startingWounds": 15,
      "currentWounds": 10,
      "woundsPerModel": 3,
      "modelsArray": "[{\"role\":\"leader\",\"currentWounds\":3,\"maxWounds\":3},{\"role\":\"regular\",\"currentWounds\":3,\"maxWounds\":3}]",
      "isDestroyed": false,
      "isBattleShocked": false,
      "activeEffects": ["cover"],
      "createdAt": "2025-10-06T12:00:00Z",
      "updatedAt": "2025-10-06T12:30:00Z"
    }
  ]
}
```

**Error (404):**
```json
{
  "error": "Session not found"
}
```

---

### POST - Initialize Units

**Endpoint:** `POST /api/sessions/[id]/units`

Creates unit instances from army lists. Called automatically during session creation.

#### Request

**Path Parameters:**
- `id` (string, required) - Game session ID

**Body:**
```json
{
  "attackerArmyId": "army-uuid",
  "opponentUnits": [
    {
      "name": "Tactical Squad",
      "datasheet": "Tactical Squad",
      "modelCount": 10,
      "woundsPerModel": 2
    }
  ]
}
```

**Parameters:**
- `attackerArmyId` (string, optional) - Initialize from attacker's saved army
- `opponentUnits` (array, optional) - Manually specify defender/opponent units (quick setup)

#### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Initialized 15 units",
  "unitInstances": [
    {
      "id": "unit-1",
      "unitName": "Terminator Squad",
      "owner": "attacker",
      "startingModels": 5,
      "currentModels": 5,
      "startingWounds": 15,
      "currentWounds": 15,
      "isDestroyed": false
    }
  ]
}
```

**Notes:**
- Automatically fetches units from army lists if `attackerArmyId` provided
- Calculates total wounds from unit templates (models × wounds-per-model)
- Creates timeline event for battle initialization
- All units start at full health

---

### PATCH - Update Unit

**Endpoint:** `PATCH /api/sessions/[id]/units/[unitId]`

Manually update a unit instance. Used by UI controls for manual adjustments.

#### Request

**Path Parameters:**
- `id` (string, required) - Game session ID
- `unitId` (string, required) - Unit instance ID

**Body:**
```json
{
  "currentModels": 3,
  "currentWounds": 8,
  "isBattleShocked": true,
  "activeEffects": ["cover", "transhuman"],
  "modelsArray": [
    { "role": "leader", "currentWounds": 3, "maxWounds": 3 },
    { "role": "regular", "currentWounds": 3, "maxWounds": 3 },
    { "role": "regular", "currentWounds": 2, "maxWounds": 3 }
  ],
  "startingWounds": 15,
  "woundsPerModel": 3
}
```

**Parameters (all optional):**
- `currentModels` (int) - New model count
- `currentWounds` (int) - New wound total
- `isDestroyed` (boolean) - Mark as destroyed
- `isBattleShocked` (boolean) - Battleshock status
- `activeEffects` (string[]) - Array of active effects
- `modelsArray` (ModelState[] or JSON string) - Advanced per-model state override (recalculates totals)
- `startingWounds` (int) - Override starting wound total (used by repair tooling)
- `woundsPerModel` (int) - Override baseline wounds-per-model (display/compatibility)

#### Response

**Success (200):**
```json
{
  "success": true,
  "unitInstance": {
    "id": "unit-123",
    "unitName": "Terminator Squad",
    "owner": "attacker",
    "currentModels": 3,
    "currentWounds": 8,
    "isBattleShocked": true,
    "activeEffects": ["cover", "transhuman"]
  }
}
```

**Notes:**
- Auto-destroys unit if `currentModels` set to 0
- If `modelsArray` is provided, it takes precedence and the server recalculates `currentModels`/`currentWounds`
- Creates timeline event for manual update
- Updates `updatedAt` timestamp

---

### PATCH - Update Model (Per-Model)

**Endpoint:** `PATCH /api/sessions/[id]/units/[unitId]/model/[modelIndex]`

Updates a specific model’s wounds (or destroys it) when a unit has per-model tracking enabled (`modelsArray`).

#### Request

**Path Parameters:**
- `id` (string, required) - Game session ID
- `unitId` (string, required) - Unit instance ID
- `modelIndex` (int, required) - Index in the `modelsArray` list

**Body (one of):**

```json
{ "woundChange": -1 }
```

```json
{ "destroy": true }
```

#### Response

**Success (200):**

```json
{
  "success": true,
  "unitInstance": {
    "id": "unit-123",
    "currentModels": 2,
    "currentWounds": 6,
    "modelsArray": "[{\"role\":\"leader\",\"currentWounds\":3,\"maxWounds\":3},{\"role\":\"regular\",\"currentWounds\":3,\"maxWounds\":3}]"
  }
}
```

**Notes:**
- When a model reaches 0 wounds, it is removed from `modelsArray` (and totals are recalculated).
- Returns `400` if the unit does not have per-model tracking enabled.

### DELETE - Remove Unit

**Endpoint:** `DELETE /api/sessions/[id]/units/[unitId]`

Remove a unit instance (for corrections/mistakes).

#### Request

**Path Parameters:**
- `id` (string, required) - Game session ID
- `unitId` (string, required) - Unit instance ID

#### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Unit Terminator Squad removed"
}
```

**Notes:**
- Permanently deletes unit instance
- Creates timeline event for removal
- Use carefully - cannot be undone

---

## Data Models

### UnitInstance

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Unique identifier |
| `gameSessionId` | string | Parent session ID |
| `unitName` | string | Display name of unit |
| `owner` | "attacker" \| "defender" | Who owns this unit |
| `datasheet` | string | Datasheet reference |
| `datasheetId` | string? | Datasheet identifier (if linked) |
| `faction` | string? | Faction name (used for icon resolution) |
| `woundsPerModel` | int? | Baseline wounds per model (fallback display) |
| `modelsArray` | string? | JSON array of per-model `{ role, currentWounds, maxWounds }` |
| `startingModels` | int | Initial model count |
| `currentModels` | int | Current models remaining |
| `startingWounds` | int? | Total starting wounds |
| `currentWounds` | int? | Current wounds remaining |
| `isDestroyed` | boolean | If unit is wiped out |
| `isBattleShocked` | boolean | If battle-shocked |
| `activeEffects` | string (JSON) | Array of effects |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### ActiveEffects Examples

Common effect strings stored in `activeEffects` JSON array:
- Movement: `"advance"`, `"fell_back"`, `"remained_stationary"`
- Combat: `"shot"`, `"charged"`, `"fought"`
- Buffs: `"cover"`, `"transhuman"`, `"lethal_hits"`, `"sustained_hits"`
- Debuffs: `"exposed"`, `"wounded"`, `"disrupted"`

---

## Examples

### Full Workflow Example

**1. Initialize Units at Session Start:**
```javascript
// POST /api/sessions
{
  "playerArmyId": "army-123",
  "opponentArmyId": "army-456"
}

// Response includes unitsInitialized
{
  "session": { "id": "session-abc" },
  "unitsInitialized": {
    "attacker": 8,
    "defender": 10
  }
}
```

**2. Fetch All Units:**
```javascript
// GET /api/sessions/session-abc/units
{
  "unitInstances": [
    { "unitName": "Terminator Squad", "currentModels": 5, "startingModels": 5 },
    { "unitName": "Captain", "currentModels": 1, "startingModels": 1 }
  ]
}
```

**3. Voice Update via AI:**
```
User says: "My Terminators lost 2 models"

AI calls: update_unit_health(
  unit_name="Terminator Squad",
  owner="attacker",
  models_lost=2
)

Tool handler:
1. Finds unit: "Terminator Squad" (attacker)
2. Updates: currentModels = 5 - 2 = 3
3. Checks: 3 ≤ 5/2 = 2.5 → Half-strength warning!
4. Creates timeline event
5. Returns: "Terminator Squad: 3/5 models (⚠ HALF STRENGTH)"
```

**4. Manual Update via UI:**
```javascript
// PATCH /api/sessions/session-abc/units/unit-123
{
  "currentModels": 3,
  "isBattleShocked": true
}

// Response
{
  "success": true,
  "unitInstance": { "currentModels": 3, "isBattleShocked": true }
}
```

---

## Error Handling

### Common Errors

**404 - Session Not Found:**
```json
{
  "error": "Session not found"
}
```

**404 - Unit Not Found:**
```json
{
  "error": "Unit 'Terminator Squad' not found for attacker. Has it been initialized?"
}
```

**400 - Invalid Request:**
```json
{
  "error": "Invalid unit ID"
}
```

**500 - Server Error:**
```json
{
  "error": "Failed to update unit",
  "message": "Database connection failed"
}
```

### Validation

The tool handlers perform validation:
- Unit must exist in session
- Unit must not already be destroyed (unless updating to destroyed)
- Models cannot be negative
- Models cannot exceed starting count

---

## Related Documentation

- **[Unit Health Tracking Feature](../features/UNIT_HEALTH_TRACKING.md)** - Feature overview and architecture
- **[Session Management](../features/SESSION_MANAGEMENT.md)** - How sessions work
- **[AI Tool Calling](../features/AI_TOOL_CALLING.md)** - AI tool system
- **[Sessions API](SESSIONS_ENDPOINT.md)** - Session endpoints


