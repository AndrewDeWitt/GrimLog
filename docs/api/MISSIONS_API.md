# Missions API

**Last Updated:** 2024-11-12  
**Status:** Complete

## Overview

API endpoints for managing primary missions in game sessions. Provides mission lookup, selection, and tracking.

---

## Endpoints

### GET /api/missions

Fetch all available primary missions.

**Authentication:** Required

**Request:**
```http
GET /api/missions
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "missions": [
    {
      "id": "uuid",
      "name": "Take and Hold",
      "deploymentType": "Tipping Point",
      "scoringPhase": "Command",
      "scoringTiming": "End of your Command phase",
      "scoringFormula": "objectives_controlled * 5",
      "maxVP": 50,
      "specialRules": null,
      "description": "Control objectives to score VP..."
    }
  ]
}
```

**Error Responses:**

`401 Unauthorized`
```json
{
  "error": "Unauthorized"
}
```

`500 Internal Server Error`
```json
{
  "error": "Failed to fetch missions"
}
```

---

### POST /api/missions

Set primary mission for a game session.

**Authentication:** Required

**Request:**
```http
POST /api/missions
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "uuid",
  "missionId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "mission": {
    "id": "uuid",
    "name": "Take and Hold",
    "deploymentType": "Tipping Point",
    "scoringFormula": "objectives_controlled * 5"
  }
}
```

**Error Responses:**

`400 Bad Request`
```json
{
  "error": "Missing sessionId or missionId"
}
```

`404 Not Found`
```json
{
  "error": "Mission not found"
}
```

`401 Unauthorized`
```json
{
  "error": "Unauthorized"
}
```

---

## Mission Object

```typescript
interface PrimaryMission {
  id: string;
  name: string;
  deploymentType: string;
  scoringPhase: string;
  scoringTiming: string;
  scoringFormula: string;
  maxVP: number;
  specialRules: string | null;
  description: string;
}
```

**Fields:**
- `id` - Unique mission identifier
- `name` - Mission name (e.g., "Take and Hold")
- `deploymentType` - Deployment map (e.g., "Hammer and Anvil")
- `scoringPhase` - When to score (e.g., "Command", "End of Turn")
- `scoringTiming` - Specific timing (e.g., "End of your Command phase")
- `scoringFormula` - VP calculation (e.g., "objectives_controlled * 5")
- `maxVP` - Maximum VP (usually 50)
- `specialRules` - Additional rules (null if none)
- `description` - Full mission description

---

## Usage Examples

### Fetch All Missions

```typescript
const response = await fetch('/api/missions', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log(`${data.missions.length} missions available`);
```

### Set Mission for Session

```typescript
const response = await fetch('/api/missions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionId: session.id,
    missionId: selectedMission.id
  })
});

const data = await response.json();
if (data.success) {
  console.log(`Mission set: ${data.mission.name}`);
}
```

---

## Related Documentation

- [Mission System Feature](../features/MISSION_SYSTEM.md) - How missions work
- [Rules System Guide](../guides/RULES_SYSTEM_GUIDE.md) - Using the rules system
- [Rules Extensibility](../guides/RULES_EXTENSIBILITY_GUIDE.md) - Adding new missions


