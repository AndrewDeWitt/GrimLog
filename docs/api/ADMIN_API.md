# Admin API Reference

**Last Updated:** 2025-12-04  
**Status:** Complete  
**Version:** 4.23.0

## Overview

The Admin API provides RESTful endpoints for managing Factions, Detachments, Stratagems, and Datasheets. All endpoints require admin authentication and return JSON responses.

## Table of Contents

- [Authentication](#authentication)
- [Icons Endpoints](#icons-endpoints)
- [Factions Endpoints](#factions-endpoints)
- [Detachments Endpoints](#detachments-endpoints)
- [Stratagems Endpoints](#stratagems-endpoints)
- [Datasheets Endpoints](#datasheets-endpoints)
- [Bulk Operations](#bulk-operations)
- [Error Responses](#error-responses)
- [Related Documentation](#related-documentation)

## Authentication

All admin endpoints are protected by `requireAdminAuth()`. Requests must include a valid Supabase session cookie, and the authenticated user must have `isAdmin: true`.

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | No valid session |
| 403 | Forbidden | User is not an admin |

---

## Icons Endpoints

### Generate Unit Icon (Global)

```
POST /api/admin/icons/generate
```

Generates a 256×256 unit icon via Gemini and persists it globally (Supabase Storage + `GlobalUnitIcon` mapping).

See: [Admin Icons Generate Endpoint](ADMIN_ICONS_GENERATE_ENDPOINT.md)

---

## Factions Endpoints

### List All Factions

```
GET /api/admin/factions
```

Returns all factions with counts of associated detachments and stratagems.

**Response:**

```json
{
  "factions": [
    {
      "id": "cm4...",
      "name": "Space Marines",
      "description": "The Emperor's finest warriors...",
      "wahapediaUrl": "https://wahapedia.ru/wh40k10ed/factions/space-marines",
      "createdAt": "2025-11-01T00:00:00.000Z",
      "updatedAt": "2025-11-30T00:00:00.000Z",
      "_count": {
        "detachments": 8,
        "stratagemData": 45
      }
    }
  ]
}
```

### Create Faction

```
POST /api/admin/factions
```

**Request Body:**

```json
{
  "name": "Adeptus Custodes",
  "description": "The Emperor's personal bodyguard",
  "wahapediaUrl": "https://wahapedia.ru/wh40k10ed/factions/adeptus-custodes"
}
```

**Response:** `201 Created`

```json
{
  "id": "cm4...",
  "name": "Adeptus Custodes",
  "description": "The Emperor's personal bodyguard",
  "wahapediaUrl": "https://wahapedia.ru/wh40k10ed/factions/adeptus-custodes",
  "createdAt": "2025-11-30T12:00:00.000Z",
  "updatedAt": "2025-11-30T12:00:00.000Z"
}
```

### Get Single Faction

```
GET /api/admin/factions/[id]
```

Returns faction with its detachments and stratagem counts.

**Response:**

```json
{
  "id": "cm4...",
  "name": "Space Marines",
  "description": "The Emperor's finest warriors...",
  "wahapediaUrl": "https://wahapedia.ru/wh40k10ed/factions/space-marines",
  "detachments": [
    {
      "id": "det-uuid",
      "name": "Gladius Task Force",
      "description": "The standard Space Marine detachment",
      "_count": {
        "stratagemData": 6
      }
    }
  ]
}
```

### Update Faction

```
PUT /api/admin/factions/[id]
```

**Request Body:**

```json
{
  "name": "Space Marines",
  "description": "Updated description..."
}
```

**Response:** `200 OK` with updated faction object

### Delete Faction

```
DELETE /api/admin/factions/[id]
```

**Response:** `200 OK`

```json
{
  "message": "Faction deleted successfully"
}
```

⚠️ **Warning:** Deleting a faction may cascade to related detachments and stratagems depending on database constraints.

---

## Detachments Endpoints

### List Detachments for Faction

```
GET /api/admin/factions/[id]/detachments
```

**Response:**

```json
{
  "detachments": [
    {
      "id": "det-uuid",
      "name": "Gladius Task Force",
      "faction": "Space Marines",
      "factionId": "cm4...",
      "description": "The standard Space Marine detachment",
      "detachmentAbility": "Combat Doctrines: ...",
      "sourceBook": "Codex: Space Marines",
      "edition": "10th",
      "_count": {
        "stratagemData": 6,
        "enhancements": 4
      }
    }
  ]
}
```

### Create Detachment

```
POST /api/admin/factions/[id]/detachments
```

**Request Body:**

```json
{
  "name": "Firestorm Assault Force",
  "description": "Aggressive close-combat focused detachment",
  "detachmentAbility": "Firestorm Assault: Units gain +1 to charge rolls...",
  "sourceBook": "Codex: Space Marines",
  "edition": "10th"
}
```

**Response:** `201 Created` with new detachment object

### Get Single Detachment

```
GET /api/admin/detachments/[id]
```

Returns detachment with its stratagems and enhancements.

**Response:**

```json
{
  "id": "det-uuid",
  "name": "Gladius Task Force",
  "faction": "Space Marines",
  "factionId": "cm4...",
  "factionRel": {
    "id": "cm4...",
    "name": "Space Marines"
  },
  "description": "The standard Space Marine detachment",
  "detachmentAbility": "Combat Doctrines: ...",
  "stratagemData": [
    {
      "id": "strat-uuid",
      "name": "Armour of Contempt",
      "cost": "1",
      "type": "Battle Tactic"
    }
  ],
  "enhancements": [
    {
      "id": "enh-uuid",
      "name": "Artificer Armour",
      "cost": "10"
    }
  ]
}
```

### Update Detachment

```
PUT /api/admin/detachments/[id]
```

**Request Body:**

```json
{
  "name": "Gladius Task Force",
  "description": "Updated description...",
  "detachmentAbility": "Updated ability text..."
}
```

**Response:** `200 OK` with updated detachment object

### Delete Detachment

```
DELETE /api/admin/detachments/[id]
```

**Response:** `200 OK`

```json
{
  "message": "Detachment deleted successfully"
}
```

---

## Stratagems Endpoints

### List Stratagems for Detachment

```
GET /api/admin/detachments/[id]/stratagems
```

**Response:**

```json
{
  "stratagems": [
    {
      "id": "strat-uuid",
      "name": "Armour of Contempt",
      "faction": "Space Marines",
      "detachment": "Gladius Task Force",
      "detachmentId": "det-uuid",
      "cost": "1",
      "type": "Battle Tactic",
      "when": "Your opponent's Shooting phase or the Fight phase...",
      "target": "One ADEPTUS ASTARTES unit from your army...",
      "effect": "Until the end of the phase, each time an attack...",
      "restrictions": null,
      "phase": "opponent_shooting,fight"
    }
  ]
}
```

### Create Stratagem

```
POST /api/admin/detachments/[id]/stratagems
```

**Request Body:**

```json
{
  "name": "New Stratagem",
  "cost": "1",
  "type": "Battle Tactic",
  "when": "Your Shooting phase.",
  "target": "One unit from your army.",
  "effect": "That unit can re-roll hit rolls of 1.",
  "phase": "shooting"
}
```

**Response:** `201 Created` with new stratagem object

### Get Single Stratagem

```
GET /api/admin/stratagems/[id]
```

**Response:**

```json
{
  "id": "strat-uuid",
  "name": "Armour of Contempt",
  "faction": "Space Marines",
  "subfaction": null,
  "detachment": "Gladius Task Force",
  "detachmentId": "det-uuid",
  "detachmentRel": {
    "id": "det-uuid",
    "name": "Gladius Task Force",
    "factionRel": {
      "name": "Space Marines"
    }
  },
  "cost": "1",
  "type": "Battle Tactic",
  "when": "Your opponent's Shooting phase or the Fight phase...",
  "target": "One ADEPTUS ASTARTES unit from your army...",
  "effect": "Until the end of the phase, each time an attack...",
  "restrictions": null,
  "phase": "opponent_shooting,fight",
  "sourceBook": "Codex: Space Marines",
  "edition": "10th",
  "createdAt": "2025-11-01T00:00:00.000Z",
  "updatedAt": "2025-11-30T00:00:00.000Z"
}
```

### Update Stratagem

```
PUT /api/admin/stratagems/[id]
```

**Request Body:**

```json
{
  "name": "Armour of Contempt",
  "cost": "2",
  "effect": "Updated effect text..."
}
```

**Response:** `200 OK` with updated stratagem object

### Delete Stratagem

```
DELETE /api/admin/stratagems/[id]
```

**Response:** `200 OK`

```json
{
  "message": "Stratagem deleted successfully"
}
```

---

## Datasheets Endpoints

### List Datasheets

```
GET /api/admin/datasheets
```

Returns paginated datasheets with filtering, search, and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| factionId | UUID | - | Filter by faction ID |
| faction | string | - | Filter by faction name |
| role | string | - | Filter by role (Character, Battleline, etc.) |
| isEnabled | boolean | - | Filter by enabled status |
| isOfficial | boolean | - | Filter by official status |
| search | string | - | Search name and keywords |
| page | number | 1 | Page number |
| limit | number | 50 | Results per page (max: 100) |
| sortBy | string | name | Sort field (name, faction, role, pointsCost, lastUpdated) |
| sortOrder | asc/desc | asc | Sort direction |

**Response:**

```json
{
  "datasheets": [
    {
      "id": "uuid",
      "name": "Broodlord",
      "faction": "Tyranids",
      "factionId": "faction-uuid",
      "subfaction": null,
      "role": "Character",
      "keywords": ["TYRANIDS", "GREAT DEVOURER", "SYNAPSE", "PSYKER", "CHARACTER", "INFANTRY", "BROODLORD"],
      "movement": "8\"",
      "toughness": 5,
      "save": "4+",
      "invulnerableSave": "4+",
      "wounds": 6,
      "leadership": 7,
      "objectiveControl": 1,
      "pointsCost": 80,
      "isEnabled": true,
      "isOfficial": true,
      "edition": "10th",
      "createdAt": "2025-11-01T00:00:00.000Z",
      "lastUpdated": "2025-12-01T00:00:00.000Z",
      "iconUrl": "https://blob.vercel-storage.com/icons/tyranids/broodlord.png",
      "_count": {
        "weapons": 1,
        "abilities": 8,
        "wargearOptions": 0
      }
    }
  ],
  "pagination": {
    "total": 48,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### Create Datasheet

```
POST /api/admin/datasheets
```

Creates a new datasheet with associated weapons, abilities, and wargear options.

**Request Body:**

```json
{
  "name": "New Unit",
  "faction": "Tyranids",
  "factionId": "faction-uuid",
  "subfaction": null,
  "role": "Elites",
  "keywords": ["TYRANIDS", "INFANTRY"],
  "movement": "8\"",
  "toughness": 5,
  "save": "4+",
  "invulnerableSave": null,
  "wounds": 3,
  "leadership": 7,
  "objectiveControl": 1,
  "composition": "3-6 Models",
  "compositionData": null,
  "unitSize": null,
  "leaderRules": null,
  "leaderAbilities": null,
  "transportCapacity": null,
  "pointsCost": 100,
  "edition": "10th",
  "sourceBook": "Codex: Tyranids",
  "weapons": [
    {
      "name": "Scything Talons",
      "range": "Melee",
      "type": "Melee",
      "attacks": "4",
      "weaponSkill": "3+",
      "strength": 5,
      "armorPenetration": -1,
      "damage": "1",
      "abilities": ["TWIN-LINKED"],
      "isDefault": true,
      "quantity": 1
    }
  ],
  "abilities": [
    {
      "name": "Synapse",
      "type": "Core",
      "description": "If your army contains one or more models with this ability...",
      "triggerPhase": ["command"],
      "triggerSubphase": null,
      "isReactive": false,
      "requiredKeywords": null
    }
  ],
  "wargearOptions": [
    {
      "name": "Adrenal Glands",
      "description": "+1\" to Move and Advance",
      "pointsCost": 10,
      "type": "upgrade"
    }
  ]
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "datasheet": {
    "id": "new-uuid",
    "name": "New Unit"
  }
}
```

### Get Single Datasheet

```
GET /api/admin/datasheets/[id]
```

Returns complete datasheet with weapons, abilities, wargear options, and recent versions.

**Response:**

```json
{
  "id": "uuid",
  "name": "Broodlord",
  "faction": "Tyranids",
  "factionId": "faction-uuid",
  "factionRel": {
    "id": "faction-uuid",
    "name": "Tyranids"
  },
  "role": "Character",
  "keywords": ["TYRANIDS", "CHARACTER", "PSYKER", "BROODLORD"],
  "movement": "8\"",
  "toughness": 5,
  "save": "4+",
  "invulnerableSave": "4+",
  "wounds": 6,
  "leadership": 7,
  "objectiveControl": 1,
  "composition": "1 Model",
  "pointsCost": 80,
  "isEnabled": true,
  "isOfficial": true,
  "weapons": [
    {
      "id": "dw-uuid",
      "isDefault": true,
      "quantity": 1,
      "weapon": {
        "id": "w-uuid",
        "name": "Broodlord claws and talons",
        "range": "Melee",
        "type": "Melee",
        "attacks": "6",
        "weaponSkill": "2+",
        "strength": 6,
        "armorPenetration": -2,
        "damage": "2",
        "abilities": "[\"DEVASTATING WOUNDS\"]"
      }
    }
  ],
  "abilities": [
    {
      "id": "da-uuid",
      "source": "Core",
      "ability": {
        "id": "a-uuid",
        "name": "Leader",
        "type": "Core",
        "description": "This model can be attached to...",
        "triggerPhase": null,
        "isReactive": false
      }
    }
  ],
  "wargearOptions": [],
  "versions": [
    {
      "id": "v-uuid",
      "versionNumber": 1,
      "versionLabel": "Initial version",
      "changelog": "Created datasheet",
      "createdAt": "2025-11-01T00:00:00.000Z"
    }
  ]
}
```

### Update Datasheet

```
PUT /api/admin/datasheets/[id]
```

Updates datasheet and creates a new version snapshot. Replaces weapons, abilities, and wargear if provided.

**Request Body:**

```json
{
  "pointsCost": 85,
  "changelog": "Points adjustment for balance"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "datasheet": {
    "id": "uuid",
    "name": "Broodlord"
  }
}
```

### Toggle Enabled Status

```
PATCH /api/admin/datasheets/[id]
```

Toggles or sets the enabled status of a datasheet.

**Request Body (set explicit value):**

```json
{
  "isEnabled": false
}
```

**Request Body (toggle current):**

```json
{
  "toggle": "isEnabled"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "datasheet": {
    "id": "uuid",
    "name": "Broodlord",
    "isEnabled": false
  }
}
```

### Delete Datasheet

```
DELETE /api/admin/datasheets/[id]?force=true
```

Deletes a datasheet. Without `force=true`, returns warnings about related data.

**Response (without force, has relations):** `400 Bad Request`

```json
{
  "error": "This datasheet has related data. Use force=true to delete anyway.",
  "relations": {
    "unitInstances": 2,
    "units": 1
  }
}
```

**Response (with force or no relations):** `200 OK`

```json
{
  "success": true,
  "message": "Datasheet deleted successfully"
}
```

---

## Bulk Operations

### Export All Data

```
GET /api/admin/bulk/export
```

Exports all factions, detachments, and stratagems as a single JSON file.

**Response:**

```json
{
  "exportedAt": "2025-11-30T12:00:00.000Z",
  "version": "4.20.0",
  "factions": [
    {
      "id": "cm4...",
      "name": "Space Marines",
      "description": "...",
      "detachments": [
        {
          "id": "det-uuid",
          "name": "Gladius Task Force",
          "stratagems": [
            {
              "id": "strat-uuid",
              "name": "Armour of Contempt",
              "cost": "1",
              "type": "Battle Tactic",
              "when": "...",
              "target": "...",
              "effect": "..."
            }
          ],
          "enhancements": [...]
        }
      ]
    }
  ]
}
```

### Import Data

```
POST /api/admin/bulk/import
```

Imports factions, detachments, and stratagems from JSON.

**Request Body:**

```json
{
  "factions": [
    {
      "name": "New Faction",
      "description": "...",
      "detachments": [
        {
          "name": "New Detachment",
          "stratagems": [
            {
              "name": "New Stratagem",
              "cost": "1",
              "effect": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

**Response:**

```json
{
  "message": "Import completed",
  "stats": {
    "factionsCreated": 1,
    "factionsUpdated": 0,
    "detachmentsCreated": 1,
    "detachmentsUpdated": 0,
    "stratagemsCreated": 1,
    "stratagemsUpdated": 0
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request

```json
{
  "error": "Missing required field: name"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized: No active session"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden: User is not an administrator"
}
```

### 404 Not Found

```json
{
  "error": "Faction not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to fetch factions"
}
```

---

## Related Documentation

- [Admin Panel Feature](../features/ADMIN_PANEL.md) - UI and feature overview
- [Admin Datasheets Management](../features/ADMIN_DATASHEETS_MANAGEMENT.md) - Datasheet CRUD UI and features
- [Stratagem Detachment System](../features/STRATAGEM_DETACHMENT_SYSTEM.md) - Detachment-stratagem linking
- [Faction System](../features/FACTION_SYSTEM.md) - Faction architecture
- [Datasheets API](DATASHEETS_API.md) - Related data queries
- [Unit Icon Generation](../features/UNIT_ICON_GENERATION.md) - Icon system for datasheets

