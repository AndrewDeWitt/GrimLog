# Session Stratagems Endpoint

**Last Updated:** 2025-12-20
**Status:** Complete

## Overview

The Session Stratagems endpoint provides phase-filtered access to available stratagems for a game session. It returns both Core stratagems (universal) and Faction/Detachment stratagems based on the session's army configuration.

> **Note:** As of v4.39.1, the client pre-fetches stratagems once on session load and computes availability client-side. The API is still called, but only once per session instead of on every modal open or phase change.

## Table of Contents

- [Endpoint](#endpoint)
- [Query Parameters](#query-parameters)
- [Response Format](#response-format)
- [Filtering Logic](#filtering-logic)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Related Documentation](#related-documentation)

## Endpoint

```
GET /api/sessions/[id]/stratagems
```

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `phase` | string | No | `"Command"` | Current game phase: Command, Movement, Shooting, Charge, Fight |
| `turn` | string | No | `"attacker"` | Whose turn it is: `attacker` or `defender` |
| `player` | string | No | `"attacker"` | Which player is viewing: `attacker` or `defender` |

## Response Format

### Success Response (200)

```json
{
  "sessionId": "abc123",
  "currentPhase": "Shooting",
  "currentTurn": "attacker",
  "viewingPlayer": "attacker",
  "targetFaction": "Space Wolves",
  "targetDetachment": "Champions of Russ",
  "core": {
    "stratagems": [
      {
        "id": "strat-001",
        "name": "Overwatch",
        "cpCost": 2,
        "type": "Strategic Ploy",
        "when": "Your opponent's Movement or Charge phase...",
        "target": "One unit from your army...",
        "effect": "Your unit can shoot that enemy unit...",
        "triggerPhase": ["Movement", "Charge"],
        "isReactive": true,
        "source": "core",
        "availableNow": false
      }
    ],
    "total": 11,
    "available": 3
  },
  "faction": {
    "stratagems": [
      {
        "id": "strat-100",
        "name": "Warrior Pride",
        "cpCost": 1,
        "type": "Battle Tactic",
        "when": "Fight phase",
        "target": "One Space Wolves unit...",
        "effect": "Until the end of the phase...",
        "triggerPhase": ["Fight"],
        "isReactive": false,
        "source": "faction",
        "faction": "Space Wolves",
        "detachment": "Champions of Russ",
        "availableNow": false
      }
    ],
    "total": 6,
    "available": 0
  },
  "totalAvailable": 3
}
```

### Stratagem Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique stratagem ID |
| `name` | string | Stratagem name |
| `cpCost` | number | Command Point cost (1-3) |
| `type` | string | Category: Battle Tactic, Strategic Ploy, Epic Deed |
| `when` | string | Timing description |
| `target` | string | Valid targets |
| `effect` | string | What the stratagem does |
| `triggerPhase` | string[] | Phases when usable: `["Shooting"]`, `["Any"]` |
| `isReactive` | boolean | Can be used during opponent's turn |
| `source` | string | `"core"` or `"faction"` |
| `faction` | string? | Faction name (faction stratagems only) |
| `detachment` | string? | Detachment name (faction stratagems only) |
| `availableNow` | boolean | Whether stratagem can be used right now |

## Filtering Logic

### Phase Matching

A stratagem is available in a phase if:
- `triggerPhase` includes the current phase, OR
- `triggerPhase` includes `"Any"`

### Turn Matching

- **Regular stratagems**: Available on player's own turn
- **Reactive stratagems** (`isReactive: true`): Available on opponent's turn

### Faction Resolution

For the attacker:
1. Gets faction from `attackerArmy.faction.name` or `attackerArmy.player.faction`
2. Gets detachment from `attackerArmy.detachment`
3. If faction is a Space Marines subfaction (Space Wolves, Blood Angels, etc.), also loads Space Marines stratagems

For the defender:
1. Gets faction from `defenderArmy.faction.name` or `defenderArmy.player.faction` (fallback: `session.defenderFaction`)
2. Gets detachment from `defenderArmy.detachment`
3. Same Space Marines subfaction handling as attacker

### Detachment Filtering

When a detachment is specified:
- Only stratagems matching that exact detachment are returned
- Example: "Forgefather's Seekers" returns only those 6 stratagems

When no detachment is specified:
- All faction stratagems are returned
- Deduplication by name prevents duplicates across detachments

### Sorting

Stratagems are sorted by:
1. Availability (available first)
2. CP cost (ascending)
3. Name (alphabetical)

## Examples

### Get Stratagems for Shooting Phase

**Request:**
```
GET /api/sessions/abc123/stratagems?phase=Shooting&turn=attacker&player=attacker
```

**Response:**
```json
{
  "currentPhase": "Shooting",
  "currentTurn": "attacker",
  "viewingPlayer": "attacker",
  "core": {
    "available": 4,
    "stratagems": [...]
  },
  "faction": {
    "available": 2,
    "stratagems": [...]
  },
  "totalAvailable": 6
}
```

### Get Reactive Stratagems During Opponent's Turn

**Request:**
```
GET /api/sessions/abc123/stratagems?phase=Charge&turn=defender&player=attacker
```

Returns stratagems where `isReactive: true` as `availableNow: true`.

## Error Handling

### 404 Not Found

```json
{
  "error": "Session not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to fetch stratagems"
}
```

## Related Documentation

- **[Stratagem Quick Reference](../features/STRATAGEM_QUICK_REFERENCE.md)** - Feature overview and UI guide
- **[Stratagem Tracking System](../features/STRATAGEM_TRACKING.md)** - How stratagems are logged
- **[Manual Action Endpoint](MANUAL_ACTION_ENDPOINT.md)** - Logging stratagem usage via `log_stratagem_use` tool

