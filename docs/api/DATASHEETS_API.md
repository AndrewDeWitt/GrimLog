# Datasheets API Reference

**Last Updated:** 2025-11-29  
**Status:** Complete

## Overview

REST API endpoints for querying Warhammer 40K datasheets, weapons, abilities, and stratagems. Includes endpoints for custom datasheet creation, versioning, and sharing.

## Table of Contents

- [Get Single Datasheet](#get-single-datasheet)
- [Search Datasheets](#search-datasheets)
- [List Faction Datasheets](#list-faction-datasheets)
- [Lookup Weapon](#lookup-weapon)
- [Lookup Ability](#lookup-ability)
- [Get Stratagems](#get-stratagems)
- [Custom Datasheets (v4.19.0)](#custom-datasheets-v4190)
  - [Get My Datasheets](#get-my-datasheets)
  - [Create Datasheet](#create-datasheet)
  - [Update Datasheet](#update-datasheet)
  - [Delete Datasheet](#delete-datasheet)
  - [Fork Datasheet](#fork-datasheet)
  - [Share Settings](#share-settings)
  - [Version History](#version-history)
  - [Public Library](#public-library)
  - [Import Shared](#import-shared)
- [Error Codes](#error-codes)

## Get Single Datasheet

Fetch a complete datasheet with all weapons, abilities, and relations.

### Endpoint

```
GET /api/datasheets/[faction]/[name]
```

### Parameters

- `faction` (path) - Faction name (URL-encoded)
- `name` (path) - Unit name (URL-encoded)

### Example Request

```bash
GET /api/datasheets/space-marines/Logan-Grimnar
```

### Example Response

```json
{
  "id": "uuid-here",
  "name": "Logan Grimnar",
  "faction": "Space Marines",
  "subfaction": "Space Wolves",
  "role": "Character",
  "keywords": ["INFANTRY", "CHARACTER", "EPIC HERO", "IMPERIUM", "TERMINATOR"],
  "movement": "6\"",
  "toughness": 5,
  "save": "2+",
  "invulnerableSave": "4+",
  "wounds": 8,
  "leadership": 6,
  "objectiveControl": 1,
  "composition": "1 Logan Grimnar - EPIC HERO",
  "leaderRules": "This model can be attached to: Wolf Guard Terminators",
  "pointsCost": 110,
  "weapons": [
    {
      "name": "Storm bolter",
      "range": "24\"",
      "type": "Ranged",
      "attacks": "2",
      "ballisticSkill": "2+",
      "strength": "4",
      "armorPenetration": "0",
      "damage": "1",
      "abilities": ["RAPID FIRE 2"]
    }
  ],
  "abilities": [
    {
      "name": "Deep Strike",
      "type": "core",
      "description": "Unit can be set up in Strategic Reserves"
    },
    {
      "name": "Oath of Moment",
      "type": "faction",
      "description": "If your Army Faction is ADEPTUS ASTARTES..."
    }
  ]
}
```

### Error Responses

```json
// 404 Not Found
{
  "error": "Datasheet not found"
}

// 500 Internal Server Error
{
  "error": "Internal server error"
}
```

## Search Datasheets

Search for datasheets using various filters.

### Endpoint

```
GET /api/datasheets/search
```

### Query Parameters

- `q` (string, optional) - Search query (name or keyword)
- `faction` (string, optional) - Filter by faction
- `subfaction` (string, optional) - Filter by subfaction
- `role` (string, optional) - Filter by role
- `keyword` (string, optional) - Filter by keyword
- `limit` (number, optional) - Limit results (default: 50)

### Example Requests

```bash
# Search by name
GET /api/datasheets/search?q=Logan

# Filter by faction and role
GET /api/datasheets/search?faction=Space%20Marines&role=Character

# Search with limit
GET /api/datasheets/search?q=Terminator&limit=10
```

### Example Response

```json
{
  "count": 2,
  "datasheets": [
    {
      "id": "uuid-1",
      "name": "Logan Grimnar",
      "faction": "Space Marines",
      "subfaction": "Space Wolves",
      "role": "Character",
      "pointsCost": 110,
      "keywords": ["INFANTRY", "CHARACTER", "EPIC HERO"]
    },
    {
      "id": "uuid-2",
      "name": "Arjac Rockfist",
      "faction": "Space Marines",
      "subfaction": "Space Wolves",
      "role": "Character",
      "pointsCost": 95,
      "keywords": ["INFANTRY", "CHARACTER", "EPIC HERO"]
    }
  ]
}
```

## List Faction Datasheets

Get all datasheets for a faction, optionally filtered by subfaction.

### Endpoint

```
GET /api/datasheets/faction/[faction]
```

### Query Parameters

- `subfaction` (string, optional) - Filter by subfaction

### Example Requests

```bash
# All Space Marines
GET /api/datasheets/faction/space-marines

# Only Space Wolves
GET /api/datasheets/faction/space-marines?subfaction=space-wolves
```

### Example Response

```json
{
  "faction": "Space Marines",
  "subfaction": "Space Wolves",
  "count": 96,
  "datasheets": [...],
  "byRole": {
    "Character": [
      { "id": "...", "name": "Logan Grimnar", ... },
      { "id": "...", "name": "Arjac Rockfist", ... }
    ],
    "Battleline": [
      { "id": "...", "name": "Grey Hunters", ... },
      { "id": "...", "name": "Blood Claws", ... }
    ],
    "Other": [...]
  }
}
```

## Lookup Weapon

Get weapon profile by name (cross-unit lookup).

### Endpoint

```
GET /api/weapons/lookup
```

### Query Parameters

- `name` (string, required) - Weapon name

### Example Request

```bash
GET /api/weapons/lookup?name=Storm%20bolter
```

### Example Response

```json
{
  "name": "Storm bolter",
  "range": "24\"",
  "type": "Ranged",
  "attacks": "2",
  "ballisticSkill": "2+",
  "weaponSkill": null,
  "strength": "4",
  "armorPenetration": "0",
  "damage": "1",
  "abilities": ["RAPID FIRE 2"]
}
```

### Error Responses

```json
// 400 Bad Request
{
  "error": "Weapon name is required"
}

// 404 Not Found
{
  "error": "Weapon not found"
}
```

## Lookup Ability

Get ability description by name.

### Endpoint

```
GET /api/abilities/lookup
```

### Query Parameters

- `name` (string, required) - Ability name

### Example Request

```bash
GET /api/abilities/lookup?name=Oath%20of%20Moment
```

### Example Response

```json
{
  "name": "Oath of Moment",
  "description": "If your Army Faction is ADEPTUS ASTARTES, at the start of your Command phase, select one unit from your opponent's army. Until the start of your next Command phase, each time a model from your army with this ability makes an attack that targets that enemy unit, you can re-roll the Hit roll."
}
```

## Get Stratagems

Get all stratagems for a faction, optionally filtered by detachment.

### Endpoint

```
GET /api/stratagems/[faction]
```

### Query Parameters

- `detachment` (string, optional) - Filter by detachment
- `subfaction` (string, optional) - Filter by subfaction

### Example Requests

```bash
# All Space Marine stratagems
GET /api/stratagems/space-marines

# Only Gladius Task Force stratagems
GET /api/stratagems/space-marines?detachment=Gladius%20Task%20Force

# Space Wolves specific
GET /api/stratagems/space-marines?subfaction=space-wolves
```

### Example Response

```json
{
  "faction": "Space Marines",
  "subfaction": null,
  "detachment": null,
  "count": 45,
  "stratagems": [
    {
      "id": "uuid",
      "name": "Armour of Contempt",
      "faction": "Space Marines",
      "cpCost": 1,
      "type": "Battle Tactic",
      "when": "Your opponent's Shooting phase or Fight phase",
      "target": "One ADEPTUS ASTARTES unit from your army",
      "effect": "Until the end of the phase, each time an attack targets that unit, worsen the Armour Penetration characteristic of that attack by 1.",
      "restrictions": [],
      "keywords": ["ADEPTUS ASTARTES"]
    }
  ],
  "byCost": {
    "1CP": [...],
    "2CP": [...]
  }
}
```

## Custom Datasheets (v4.19.0)

Endpoints for creating, editing, versioning, and sharing custom datasheets.

### Get My Datasheets

Fetch all datasheets owned by the authenticated user.

```
GET /api/datasheets/mine
```

**Authentication:** Required

**Response:**
```json
{
  "datasheets": [
    {
      "id": "uuid",
      "name": "Custom Terminator",
      "faction": "Space Marines",
      "isOfficial": false,
      "ownerId": "user-uuid",
      "forkedFromId": "original-uuid",
      "currentVersion": 2,
      "visibility": "private",
      // ... full datasheet fields
    }
  ],
  "count": 5
}
```

### Create Datasheet

Create a new custom datasheet.

```
POST /api/datasheets
```

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Custom Terminator",
  "faction": "Space Marines",
  "factionId": "faction-uuid",
  "role": "Infantry",
  "keywords": ["INFANTRY", "TERMINATOR"],
  "movement": "5\"",
  "toughness": 5,
  "save": "2+",
  "wounds": 3,
  "leadership": 6,
  "objectiveControl": 1,
  "pointsCost": 200,
  "composition": "5 models",
  "weapons": [
    {
      "name": "Storm Bolter",
      "type": "ranged",
      "range": "24\"",
      "attacks": "2",
      "ballisticSkill": "3+",
      "strength": "4",
      "armorPenetration": "0",
      "damage": "1"
    }
  ],
  "abilities": [
    {
      "name": "Deep Strike",
      "description": "Can deploy from reserves",
      "abilityType": "core"
    }
  ]
}
```

**Response:**
```json
{
  "datasheet": { /* created datasheet */ },
  "version": { "versionNumber": 1, "id": "version-uuid" }
}
```

### Update Datasheet

Update an existing custom datasheet (creates new version).

```
PUT /api/datasheets/detail/[id]
```

**Authentication:** Required (must be owner)

**Request Body:** Same as Create

**Response:**
```json
{
  "datasheet": { /* updated datasheet */ },
  "version": { "versionNumber": 2, "changelog": "Updated stats" }
}
```

### Delete Datasheet

Delete a custom datasheet (cannot delete official datasheets).

```
DELETE /api/datasheets/detail/[id]
```

**Authentication:** Required (must be owner)

**Response:**
```json
{
  "success": true,
  "message": "Datasheet deleted"
}
```

### Fork Datasheet

Create a copy of any datasheet as your own editable version.

```
POST /api/datasheets/detail/[id]/fork
```

**Authentication:** Required

**Request Body (optional):**
```json
{
  "visibility": "private"
}
```

**Response:**
```json
{
  "datasheet": {
    "id": "new-uuid",
    "name": "Custom Terminator (Copy)",
    "forkedFromId": "original-uuid",
    "isOfficial": false,
    "ownerId": "user-uuid"
  }
}
```

### Share Settings

Get or update sharing settings for a datasheet.

**Get Settings:**
```
GET /api/datasheets/detail/[id]/share
```

**Response:**
```json
{
  "visibility": "link",
  "shareToken": "abc123",
  "shareUrl": "https://app.com/datasheets/import/abc123"
}
```

**Update Settings:**
```
POST /api/datasheets/detail/[id]/share
```

**Request Body:**
```json
{
  "visibility": "public"  // "private" | "link" | "public"
}
```

### Version History

**List Versions:**
```
GET /api/datasheets/detail/[id]/versions
```

**Response:**
```json
{
  "versions": [
    {
      "id": "version-uuid",
      "versionNumber": 2,
      "versionLabel": "Balance Update Q4",
      "changelog": "Reduced points cost",
      "createdAt": "2025-11-29T12:00:00Z",
      "createdBy": { "name": "User Name" }
    },
    {
      "id": "version-uuid-1",
      "versionNumber": 1,
      "createdAt": "2025-11-28T10:00:00Z"
    }
  ]
}
```

**Get Version Snapshot:**
```
GET /api/datasheets/detail/[id]/versions/[versionId]
```

**Response:**
```json
{
  "version": { /* version metadata */ },
  "snapshotData": {
    "datasheet": { /* full datasheet at that version */ },
    "weapons": [ /* weapons array */ ],
    "abilities": [ /* abilities array */ ],
    "wargearOptions": [ /* wargear array */ ]
  }
}
```

### Public Library

Browse public and community datasheets.

```
GET /api/datasheets/public
```

**Query Parameters:**
- `search` - Search by name
- `faction` - Filter by faction
- `role` - Filter by role
- `type` - `official` | `community`
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `sortBy` - `name` | `points` | `createdAt`
- `sortOrder` - `asc` | `desc`

**Response:**
```json
{
  "datasheets": [ /* array of datasheets */ ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

### Import Shared

Preview and import a shared datasheet.

**Preview:**
```
GET /api/datasheets/import/[shareToken]
```

**Import:**
```
POST /api/datasheets/import/[shareToken]
```

**Authentication:** Required for import

**Response:**
```json
{
  "datasheet": {
    "id": "new-uuid",
    "name": "Imported Datasheet",
    "forkedFromId": "original-uuid"
  }
}
```

---

## Error Codes

### 400 Bad Request

Missing or invalid parameters.

**Example:**
```json
{
  "error": "Weapon name is required"
}
```

### 404 Not Found

Resource not found in database.

**Example:**
```json
{
  "error": "Datasheet not found"
}
```

### 500 Internal Server Error

Server-side error.

**Example:**
```json
{
  "error": "Internal server error"
}
```

**Note:** Check server logs for details.

## Response Times

All endpoints optimized for sub-1 second response:

- Single datasheet: ~100-300ms
- Search: ~200-500ms  
- List faction: ~300-800ms
- Lookups: ~50-150ms

## Related Documentation

- **User Guide:** [Datasheet Import Guide](../guides/DATASHEET_IMPORT_GUIDE.md) - How to import datasheets
- **Feature Overview:** [Datasheet Integration](../features/DATASHEET_INTEGRATION.md) - Architecture details
- **Custom Datasheets:** [Datasheet Versioning System](../features/DATASHEET_VERSIONING_SYSTEM.md) - Create, edit, version, and share custom datasheets
- **Validation Schemas:** See `lib/datasheetValidation.ts` for Zod schemas
- **Helper Functions:** See `lib/datasheetHelpers.ts` for TypeScript usage

---

**All endpoints use fuzzy matching to handle voice recognition errors and spelling variations.**

