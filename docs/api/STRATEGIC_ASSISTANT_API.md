# Strategic Assistant API

**Last Updated:** 2025-10-23  
**Status:** Complete

## Overview

REST API endpoint and function reference for the Strategic Assistant feature.

## Table of Contents

- [REST Endpoint](#rest-endpoint)
- [Core Function](#core-function)
- [AI Tool](#ai-tool)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)

---

## REST Endpoint

### POST `/api/strategic-assistant/rules`

Get phase-filtered stratagems and abilities for current game state.

**Authentication:** Required (Supabase auth)

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "currentPhase": "Shooting",
  "currentPlayerTurn": "player"
}
```

**Parameters:**

| Field | Type | Required | Values | Description |
|-------|------|----------|---------|-------------|
| `sessionId` | string | Yes | UUID | Active game session ID |
| `currentPhase` | string | Yes | "Command", "Movement", "Shooting", "Charge", "Fight" | Current game phase |
| `currentPlayerTurn` | string | Yes | "player", "opponent" | Whose turn it is |

**Success Response (200):**
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "name": "PREYTAKER'S EYE",
      "source": "Space Marines - Saga of the Beastslayer",
      "type": "stratagem",
      "cpCost": 1,
      "triggerSubphase": "",
      "fullText": "Long and bloody experience has taught...",
      "requiredKeywords": ["ADEPTUS ASTARTES INFANTRY"],
      "isReactive": false,
      "category": "Strategic Ploy"
    }
  ],
  "threats": [
    {
      "id": "uuid",
      "name": "ARMOUR OF CONTEMPT",
      "source": "Space Marines - Saga of the Beastslayer",
      "type": "stratagem",
      "cpCost": 1,
      "triggerSubphase": "Just after an enemy unit has selected its targets.",
      "fullText": "The belligerence and transhuman...",
      "requiredKeywords": ["ADEPTUS ASTARTES"],
      "isReactive": true,
      "category": "Strategic Ploy"
    }
  ],
  "subphases": [
    "Just after an enemy unit has selected its targets.",
    "End of Phase"
  ]
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing required parameters | Invalid request body |
| 400 | Invalid phase | Phase not one of 5 valid phases |
| 400 | Invalid currentPlayerTurn | Not "player" or "opponent" |
| 401 | Unauthorized | Not authenticated |
| 404 | Game session not found | Invalid sessionId |
| 500 | Failed to fetch strategic rules | Server error |

**Example Error Response (400):**
```json
{
  "error": "Invalid phase. Must be one of: Command, Movement, Shooting, Charge, Fight"
}
```

---

## Core Function

### `getRelevantRules()`

**File:** `lib/strategicAssistant.ts`

**Signature:**
```typescript
async function getRelevantRules(
  sessionId: string,
  currentPhase: string,
  currentPlayerTurn: 'player' | 'opponent'
): Promise<RelevantRulesResult>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Game session UUID |
| `currentPhase` | string | One of: Command, Movement, Shooting, Charge, Fight |
| `currentPlayerTurn` | 'player' \| 'opponent' | Whose turn it is |

**Returns:** `RelevantRulesResult`
```typescript
{
  opportunities: RelevantRule[];  // Rules player can use
  threats: RelevantRule[];        // Opponent's reactive rules
  subphases: string[];            // Available timing windows
}
```

**Process:**
1. Fetches game session with player army
2. Extracts keywords from army units
3. Queries rules tables filtered by phase
4. Filters by keyword matching
5. Categorizes by player turn and reactive status
6. Sorts by priority
7. Returns structured result

**Performance:** ~10-50ms (no AI calls, pure database + logic)

**Example Usage:**
```typescript
import { getRelevantRules } from '@/lib/strategicAssistant';

const rules = await getRelevantRules(
  sessionId,
  'Shooting',
  'player'
);

console.log(`${rules.opportunities.length} opportunities`);
console.log(`${rules.threats.length} threats`);
```

---

## AI Tool

### `get_strategic_advice`

**File:** `lib/aiTools.ts`, `lib/toolHandlers.ts`

**Tool Definition:**
```json
{
  "type": "function",
  "function": {
    "name": "get_strategic_advice",
    "description": "Get relevant stratagems and abilities for the current phase",
    "parameters": {
      "type": "object",
      "properties": {
        "query_type": {
          "type": "string",
          "enum": ["opportunities", "threats", "all"]
        }
      },
      "required": ["query_type"]
    }
  }
}
```

**Arguments:**

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `query_type` | string | "opportunities", "threats", "all" | What advice to provide |

**Handler Response:**
```typescript
{
  toolName: 'get_strategic_advice',
  success: true,
  message: `
    **Your Opportunities** (3):
    • PREYTAKER'S EYE (1 CP) - Space Marines
    • ARMOUR OF CONTEMPT (1 CP) - Space Marines
    ...
  `,
  data: {
    phase: 'Shooting',
    playerTurn: 'player',
    opportunitiesCount: 3,
    threatsCount: 2,
    opportunities: [...],  // Top 10 rules
    threats: [...]         // Top 10 rules
  }
}
```

**AI Integration:**

When user asks strategic questions, the AI calls this tool to get phase-filtered rules, then synthesizes a natural language response.

**Example Prompts:**
- "What can I do in my shooting phase?"
- "What should I watch for during opponent's charge?"
- "Show me movement phase stratagems"

---

## Response Formats

### RelevantRule Type

```typescript
interface RelevantRule {
  id: string;                    // Database ID
  name: string;                  // "FIRE OVERWATCH"
  source: string;                // "Core Stratagem", "Space Marines - Saga of the Beastslayer"
  type: 'stratagem' | 'ability'; // Rule type
  cpCost?: number;               // 0-3 (undefined for abilities)
  triggerSubphase: string;       // "Start of Phase", "During Move", "Any"
  fullText: string;              // Complete rule text
  requiredKeywords: string[];    // ["INFANTRY", "VEHICLE"]
  isReactive: boolean;           // Can interrupt opponent
  category?: string;             // "Battle Tactic", "Strategic Ploy", etc.
}
```

### RelevantRulesResult Type

```typescript
interface RelevantRulesResult {
  opportunities: RelevantRule[];  // Sorted by priority
  threats: RelevantRule[];        // Sorted by priority
  subphases: string[];            // Unique timing windows
}
```

---

## Error Handling

### Client-Side Errors

**Invalid Session:**
```typescript
if (!currentSessionId) {
  showToast('Please create a battle session first', 'warning');
  return;
}
```

**Network Error:**
```typescript
try {
  const response = await fetch('/api/strategic-assistant/rules', {...});
  if (!response.ok) throw new Error('Failed to fetch');
} catch (error) {
  setError('Failed to load strategic rules');
}
```

### Server-Side Errors

**Session Not Found:**
```typescript
const session = await prisma.gameSession.findUnique({...});
if (!session) {
  throw new Error('Session not found'); // Returns 404
}
```

**Database Error:**
```typescript
try {
  const rules = await getRelevantRules(...);
} catch (error) {
  return NextResponse.json(
    { error: 'Failed to fetch strategic rules' },
    { status: 500 }
  );
}
```

---

## Related Documentation

- **Feature Overview**: [STRATEGIC_ASSISTANT.md](../features/STRATEGIC_ASSISTANT.md) - What the feature is
- **User Guide**: [STRATEGIC_ASSISTANT_USER_GUIDE.md](../guides/STRATEGIC_ASSISTANT_USER_GUIDE.md) - How to use it
- **Import Guide**: [PDF_RULES_IMPORT_GUIDE.md](../guides/PDF_RULES_IMPORT_GUIDE.md) - How to import rules

