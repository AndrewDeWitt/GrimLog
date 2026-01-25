# Sessions Endpoint

**Last Updated:** 2025-12-13  
**Status:** Complete

## Overview

The Sessions endpoint creates and lists game sessions. Session creation initializes unit instances for both armies (attacker and defender), including per-model wound tracking and optional battle-ready character attachments.

## Table of Contents

- [List Sessions](#list-sessions)
- [Create Session](#create-session)
- [Battle Ready Attachments](#battle-ready-attachments)
- [Related Documentation](#related-documentation)

## List Sessions

**Route:** `GET /api/sessions`

### Notes

- Returns the last 20 sessions owned by the authenticated user.

## Create Session

**Route:** `POST /api/sessions`

### Body

```json
{
  "attackerArmyId": "uuid",
  "defenderArmyId": "uuid",
  "deploymentType": "crucible-of-battle",
  "firstTurn": "attacker",
  "attackerAttachments": {
    "characterUnitId": "Target Unit Name"
  }
}
```

### Response (200)

```json
{
  "session": {
    "id": "uuid",
    "attackerArmyId": "uuid",
    "defenderName": "Defender",
    "defenderFaction": "Unknown",
    "currentPhase": "Command",
    "currentTurn": "attacker",
    "battleRound": 1,
    "deploymentType": "crucible-of-battle",
    "firstTurn": "attacker",
    "isActive": true
  },
  "unitsInitialized": {
    "attacker": 8,
    "defender": 10
  }
}
```

## Battle Ready Attachments

### `attackerAttachments` (optional)

If provided, Grimlog applies the mapping at session initialization:

- Each **character** unit instance gets `UnitInstance.attachedToUnit` set to the chosen target unit name.
- If omitted, Grimlog falls back to the attacker army’s saved `Army.characterAttachments`.

### Sanitization

The server will drop invalid mappings:

- Unknown character unit IDs
- Empty targets
- Targets that don’t match an existing attacker unit name

## Related Documentation

- [Session Setup Guide](../guides/SESSION_SETUP_GUIDE.md)
- [Character Attachments Guide](../guides/CHARACTER_ATTACHMENTS_GUIDE.md)
- [Army Attachment Presets Endpoint](ARMY_ATTACHMENT_PRESETS_ENDPOINT.md)


