# Tactical Advisor API

**Last Updated:** 2025-12-20  
**Status:** Complete

## Overview

`POST /api/tactical-advisor` returns AI-generated tactical suggestions for the current game state. The response includes a compact context summary and (optionally) additional metadata to support richer UI surfaces like unit icons and mission/objective chips.

## Table of Contents

- [Endpoint](#endpoint)
- [Authentication](#authentication)
- [Request](#request)
- [Response](#response)
- [Example Request](#example-request)
- [Example Response](#example-response)
- [Error Responses](#error-responses)
- [Implementation Details](#implementation-details)
- [Performance](#performance)
- [Rate Limiting](#rate-limiting)
- [Related Documentation](#related-documentation)

## Endpoint

`POST /api/tactical-advisor`

Returns AI-generated tactical advice for the current game state using Gemini 3 Flash.

## Authentication

Requires authenticated user session (via `requireAuth()` middleware).

## Request

### Headers

```
Content-Type: application/json
```

### Body

```typescript
{
  sessionId: string;           // Required: Current game session ID
  perspective: 'attacker' | 'defender';  // Required: Whose perspective to analyze
  detailLevel: 'quick' | 'detailed';    // Required: Detail level of suggestions
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | UUID of the active game session |
| `perspective` | 'attacker' \| 'defender' | Yes | Player perspective for analysis |
| `detailLevel` | 'quick' \| 'detailed' | Yes | 'quick' for 3-5 tips, 'detailed' for 5-10 suggestions |

## Response

### Success Response (200 OK)

```typescript
{
  suggestions: TacticalSuggestion[];
  context: {
    cpAvailable: number;        // Current CP for the perspective player
    vpDifferential: number;     // VP difference (positive = ahead)
    unitsAnalyzed: number;      // Number of units considered
    objectivesHeld: number;     // Objectives currently controlled
  };
  generatedAt: string;          // ISO timestamp
  detailLevel: 'quick' | 'detailed';

  // Optional (UI support)
  meta?: {
    attackerFaction?: string;
    defenderFaction?: string;
    primaryMission?: {
      id: string;
      name: string;
      deploymentType: string;
      scoringPhase: string;
      scoringTiming: string;
      scoringFormula: string;
      maxVP: number;
      specialRules?: string | null;
    } | null;
    objectiveMarkers?: Array<{
      objectiveNumber: number;
      controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
      controllingUnit?: string | null;
    }>;
  };

  // Optional (UI support): Active unit directory keyed by UnitInstance ID
  unitDirectory?: Record<string, {
    id: string;
    name: string;
    owner: 'attacker' | 'defender';
    datasheet?: string;
    iconUrl?: string | null;
    datasheetId?: string | null;
  }>;
}
```

### TacticalSuggestion Type

```typescript
{
  id: string;                   // Unique suggestion ID
  priority: 'high' | 'medium' | 'low';
  category: 'ability' | 'stratagem' | 'positioning' | 'objective' | 'resource' | 'threat';
  title: string;                // Short action title
  description: string;           // Detailed description
  cpCost?: number;              // CP cost if stratagem-related
  reasoning?: string;            // Explanation (detailed mode only)
  relatedUnits?: string[];       // Unit names relevant to suggestion
  relatedUnitIds?: string[];     // Best-effort UnitInstance IDs matched from relatedUnits
  relatedRules?: string[];       // Rule/ability names referenced
}
```

## Example Request

```bash
curl -X POST http://localhost:3000/api/tactical-advisor \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "2bea0154-bfa4-4187-a468-daa584b980b9",
    "perspective": "attacker",
    "detailLevel": "quick"
  }'
```

## Example Response

```json
{
  "suggestions": [
    {
      "id": "sug-1",
      "priority": "high",
      "category": "ability",
      "title": "Activate Encircling Jaws Hunting Pack",
      "description": "Select 'Encircling Jaws' as your active Hunting Pack for the Master of Wolves detachment ability. Re-rolling Advance and Charge rolls is critical in Battle Round 2.",
      "cpCost": 0,
      "reasoning": "This ability is crucial for ensuring your key melee units can get into position and make successful charges, maximizing their impact in the early game.",
      "relatedUnits": ["Thunderwolf Cavalry", "Wolf Guard Terminators"],
      "relatedUnitIds": ["<unit-instance-id-1>", "<unit-instance-id-2>"],
      "relatedRules": ["Master of Wolves", "Encircling Jaws"]
    },
    {
      "id": "sug-2",
      "priority": "high",
      "category": "threat",
      "title": "Target Land Raider Redeemer with Oath of Moment",
      "description": "Place your Oath of Moment on the Land Raider Redeemer. Its Flamestorm cannons are a massive Overwatch threat to your charging infantry.",
      "cpCost": 0,
      "reasoning": "Neutralizing this threat early prevents significant damage to your charging units and opens up avenues for objective control.",
      "relatedUnits": ["Land Raider Redeemer"],
      "relatedRules": ["Oath of Moment"]
    },
    {
      "id": "sug-3",
      "priority": "medium",
      "category": "resource",
      "title": "Confirm Bjorn's CP Generation",
      "description": "Ensure you trigger Bjorn's Ancient Tactician ability now to gain +1 CP, bringing your total to 4.",
      "cpCost": 0,
      "reasoning": "Proactive CP generation is vital for maintaining tactical flexibility and enabling key stratagems throughout the battle.",
      "relatedUnits": ["Bjorn the Fell-Handed"],
      "relatedRules": ["Ancient Tactician"]
    }
  ],
  "context": {
    "cpAvailable": 3,
    "vpDifferential": 0,
    "unitsAnalyzed": 12,
    "objectivesHeld": 0
  },
  "generatedAt": "2025-01-18T21:46:37.000Z",
  "detailLevel": "detailed"
}
```

## Error Responses

### 400 Bad Request

**Missing Parameters**:
```json
{
  "error": "Missing required parameters: sessionId, perspective, detailLevel"
}
```

**Invalid Phase**:
```json
{
  "error": "Invalid phase. Must be one of: Command, Movement, Shooting, Charge, Fight"
}
```

**Invalid Perspective**:
```json
{
  "error": "Invalid playerPerspective. Must be \"attacker\" or \"defender\""
}
```

**Invalid Detail Level**:
```json
{
  "error": "Invalid detailLevel. Must be \"quick\" or \"detailed\""
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found

```json
{
  "error": "Game session not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to generate tactical advice"
}
```

## Implementation Details

### Context Building

The API builds comprehensive game context including:

1. **Session State**: Battle round, current phase, current turn, CP/VP
2. **Unit Instances**: All units with health, models, wounds, status effects
3. **Objective Markers**: Current control and positioning
4. **Stratagem Logs**: Last 5 stratagem uses for pattern detection
5. **Army Data**: Faction rules, detachment abilities, unit datasheets
6. **Abilities**: Phase-relevant abilities filtered by trigger phase

### LLM Configuration

- **Model**: `gemini-3-flash-preview`
- **Temperature**: 0.7
- **Max Output Tokens**: 2000 (quick) / 4000 (detailed)
- **Response Format**: JSON (`responseMimeType: 'application/json'`)

### Prompt Structure

1. **System Instruction**: Defines Warhammer 40k tactical advisor persona
2. **User Prompt**: 
   - Current game state context
   - Phase, turn, perspective
   - Formatted unit and objective data
   - Instructions for response format

### Response Parsing

The API handles:
- Markdown code fence stripping (` ```json `)
- JSON extraction from mixed text responses
- Fallback error handling for malformed responses

## Performance

- **Context Building**: ~800ms (database queries)
- **LLM Analysis**: ~6-7s (Gemini 3 Flash)
- **Total Response Time**: ~8-10s

## Rate Limiting

No explicit rate limiting, but consider:
- Each request uses ~2000-4000 tokens
- Gemini 3 Flash rate limits apply
- Consider caching for identical game states

## Related Documentation

- [Tactical Advisor Feature](../features/TACTICAL_ADVISOR.md) - Complete feature documentation
- [Icons Resolve Endpoint](ICONS_RESOLVE_ENDPOINT.md) - Icon resolution used for Quick Tips unit icon strips
- [Missions API](MISSIONS_API.md) - Primary mission selection and tracking
- [Strategic Assistant API](STRATEGIC_ASSISTANT_API.md) - Previous static rules API (deprecated)
- [Google Gemini Integration](../features/GOOGLE_GEMINI_INTEGRATION.md) - Multi-provider AI support

