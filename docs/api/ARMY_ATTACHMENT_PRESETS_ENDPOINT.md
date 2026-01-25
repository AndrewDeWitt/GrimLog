# Army Attachment Presets Endpoint

**Last Updated:** 2025-12-13  
**Status:** Complete

## Overview

Attachment Presets provide **named, per-army character attachment loadouts** (e.g., `vs_elite`, `vs_horde`) so you can pivot attachments during session setup without permanently rewriting your army.

Presets map:

```json
{
  "<characterUnitId>": "<targetUnitName>"
}
```

## Table of Contents

- [List Presets](#list-presets)
- [Create Preset](#create-preset)
- [Update Preset](#update-preset)
- [Delete Preset](#delete-preset)
- [Auth & Authorization](#auth--authorization)
- [Related Documentation](#related-documentation)

## List Presets

**Route:** `GET /api/armies/[id]/attachment-presets`

### Response (200)

```json
{
  "success": true,
  "data": {
    "presets": [
      {
        "id": "uuid",
        "armyId": "uuid",
        "name": "vs_elite",
        "attachmentsJson": "{\"charUnitId\":\"Wolf Guard Terminators (10)\"}",
        "isDefault": true,
        "createdAt": "2025-12-13T00:00:00.000Z",
        "updatedAt": "2025-12-13T00:00:00.000Z"
      }
    ]
  }
}
```

## Create Preset

**Route:** `POST /api/armies/[id]/attachment-presets`

### Body

```json
{
  "name": "vs_elite",
  "attachments": {
    "charUnitId": "Wolf Guard Terminators (10)"
  },
  "isDefault": false
}
```

### Response (201)

```json
{
  "success": true,
  "data": {
    "preset": {
      "id": "uuid",
      "armyId": "uuid",
      "name": "vs_elite",
      "attachmentsJson": "{\"charUnitId\":\"Wolf Guard Terminators (10)\"}",
      "isDefault": false
    }
  }
}
```

### Errors

- `400`: missing/invalid `name` or invalid `attachments`
- `403`: not authorized for this army
- `409`: duplicate preset name for the army

## Update Preset

**Route:** `PATCH /api/armies/[id]/attachment-presets/[presetId]`

### Body (partial)

```json
{
  "name": "vs_horde",
  "attachments": {
    "charUnitId": "Blood Claws"
  },
  "isDefault": true
}
```

### Notes

- Setting `isDefault: true` will clear the default flag from other presets for the same army.

### Response (200)

```json
{
  "success": true,
  "data": {
    "preset": {
      "id": "uuid",
      "armyId": "uuid",
      "name": "vs_horde",
      "attachmentsJson": "{\"charUnitId\":\"Blood Claws\"}",
      "isDefault": true
    }
  }
}
```

## Delete Preset

**Route:** `DELETE /api/armies/[id]/attachment-presets/[presetId]`

### Response (200)

```json
{ "success": true }
```

### Notes

- If the deleted preset was the default, the server will promote the most recently updated remaining preset (if any) to default.

## Auth & Authorization

- Requires authentication (`requireAuth()`).
- The authenticated user must own the army (`Army.userId` must match).

## Related Documentation

- [Feature: Army Register Tactics & Battle Ready](../features/ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md)
- [Character Attachments Guide](../guides/CHARACTER_ATTACHMENTS_GUIDE.md)


