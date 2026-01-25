# Manual Action API Endpoint

**Last Updated:** 2025-10-24
**Status:** Complete

## Overview

The Manual Action endpoint provides a unified API for executing game actions through manual UI controls. It reuses the exact same tool execution logic as voice commands, ensuring consistent behavior and validation regardless of input method.

## Endpoint

```
POST /api/sessions/[id]/manual-action
```

## Authentication

**Required:** Yes (Supabase JWT token)

**Header:**
```
Authorization: Bearer <supabase-jwt-token>
```

## Request Format

### Request Body

```typescript
{
  toolName: string;  // Name of the tool/action to execute
  args: object;      // Tool-specific arguments
}
```

### Supported Tools

All tools from `lib/aiTools.ts` are supported:

- `change_phase`
- `advance_battle_round`
- `log_stratagem_use`
- `update_command_points`
- `update_victory_points`
- `update_objective_control`
- `log_unit_action`
- `log_combat_result`
- `set_secondary_objectives`
- `redraw_secondary_objective`
- `update_unit_health`
- `mark_unit_destroyed`
- `update_unit_status`
- `query_game_state`
- `get_strategic_advice`

## Examples

### Change Phase

```http
POST /api/sessions/abc123/manual-action
Content-Type: application/json

{
  "toolName": "change_phase",
  "args": {
    "new_phase": "Shooting",
    "player_turn": "player"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Changed to Shooting phase (player's turn)",
  "data": {
    "phase": "Shooting",
    "playerTurn": "player",
    "inputMethod": "manual"
  },
  "validation": null
}
```

### Update Victory Points

```http
POST /api/sessions/abc123/manual-action
Content-Type: application/json

{
  "toolName": "update_victory_points",
  "args": {
    "player": "player",
    "points": 5,
    "source": "Primary Objective"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "player scored 5 VP from Primary Objective (5 total)",
  "data": {
    "player": "player",
    "points": 5,
    "totalVP": 5,
    "inputMethod": "manual"
  }
}
```

### Set Secondary Objectives

```http
POST /api/sessions/abc123/manual-action
Content-Type: application/json

{
  "toolName": "set_secondary_objectives",
  "args": {
    "player": "player",
    "secondaries": [
      "Assassinate",
      "Behind Enemy Lines",
      "Bring It Down"
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "player secondaries set: Assassinate, Behind Enemy Lines, Bring It Down",
  "data": {
    "secondaries": ["Assassinate", "Behind Enemy Lines", "Bring It Down"],
    "inputMethod": "manual"
  }
}
```

### Log Stratagem Use

```http
POST /api/sessions/abc123/manual-action
Content-Type: application/json

{
  "toolName": "log_stratagem_use",
  "args": {
    "stratagem_name": "Transhuman Physiology",
    "cp_cost": 1,
    "used_by": "player",
    "target_unit": "Terminator Squad",
    "description": "Used during opponent shooting phase"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transhuman Physiology used (-1 CP, 2 CP remaining)",
  "data": {
    "stratagem": "Transhuman Physiology",
    "cpCost": 1,
    "cpRemaining": 2,
    "inputMethod": "manual"
  },
  "validation": {
    "severity": "warning",
    "message": "Transhuman Physiology is typically used during opponent's Shooting phase, but current phase is Movement",
    "rule": "phase_mismatch",
    "suggestion": "Verify this stratagem can be used in Movement phase"
  }
}
```

### Update Objective Control

```http
POST /api/sessions/abc123/manual-action
Content-Type: application/json

{
  "toolName": "update_objective_control",
  "args": {
    "objective_number": 3,
    "controlled_by": "player",
    "controlling_unit": "Intercessor Squad"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Objective 3 controlled by player (Intercessor Squad)",
  "data": {
    "objectiveNumber": 3,
    "controlledBy": "player",
    "inputMethod": "manual"
  }
}
```

## Response Format

### Success Response

```typescript
{
  success: boolean;
  message: string;
  data?: object;
  validation?: ValidationResult;
}
```

**Fields:**
- `success` - Whether the action executed successfully
- `message` - Human-readable result message
- `data` - Action-specific result data (optional)
- `validation` - Validation warnings/errors if any (optional)

### Validation Response

When validation issues are detected:

```typescript
{
  success: true,  // Action still executes
  message: string,
  data: object,
  validation: {
    severity: "info" | "warning" | "error";
    message: string;
    rule: string;
    suggestion: string;
    requiresOverride?: boolean;
  }
}
```

**Severity Levels:**
- `info` - Informational notice
- `warning` - Potential rule violation
- `error` - Serious rule violation (but action still executes)

### Error Response

```json
{
  "error": "Error message",
  "status": 400 | 401 | 404 | 500
}
```

**Status Codes:**
- `400` - Bad request (missing toolName/args)
- `401` - Unauthorized (invalid/missing auth token)
- `404` - Session not found
- `500` - Server error during execution

## Implementation Details

### Code Flow

```
Client Request
    ↓
Authentication Check (requireAuth)
    ↓
Parse toolName and args
    ↓
executeToolCall(toolName, args, sessionId)
    ↓
Tool-specific handler (lib/toolHandlers.ts)
    ↓
Database update + Timeline event creation
    ↓
Return result with inputMethod: "manual"
```

### Backend Code

**File:** `app/api/sessions/[id]/manual-action/route.ts`

**Key Logic:**
```typescript
const result = await executeToolCall(
  toolName,
  args,
  sessionId,
  new Date() // Current timestamp
);

// Mark as manual action
if (result.data) {
  result.data.inputMethod = 'manual';
}
```

### Tool Execution Reuse

The endpoint reuses `executeToolCall` from `lib/toolHandlers.ts`, which:
- Validates game state
- Updates database
- Creates timeline events
- Returns consistent format
- Handles errors gracefully

This ensures **zero duplication** between voice and manual action paths.

## Timeline Event Creation

All manual actions create timeline events with:

```typescript
{
  gameSessionId: string;
  eventType: 'phase' | 'stratagem' | 'objective' | 'custom';
  phase: string;
  description: string;
  metadata: {
    ...actionSpecificData,
    inputMethod: 'manual'  // Distinguishes from voice
  };
  timestamp: Date;
}
```

The `inputMethod: 'manual'` flag allows filtering/analytics on manual vs voice actions.

## Error Handling

### Common Errors

**Missing Tool Name:**
```json
{
  "error": "Missing toolName or args",
  "status": 400
}
```

**Session Not Found:**
```json
{
  "error": "Session not found",
  "status": 404
}
```

**Tool Execution Failure:**
```json
{
  "success": false,
  "message": "Unit \"Terminators\" not found"
}
```

**Note:** Tool execution failures return `success: false` in the response body (not an HTTP error), allowing clients to handle them gracefully.

## Security

- **Authentication required** - All requests validated via `requireAuth()`
- **Session ownership** - Users can only modify their own sessions
- **Input validation** - Tool arguments validated before execution
- **SQL injection protection** - Prisma ORM handles all database queries

## Performance

- **Single database transaction** per action
- **Optimistic UI updates** on client
- **Cache invalidation** triggers refresh
- **Typical response time:** < 200ms

## Related Documentation

- [Manual UI Controls Feature](../features/MANUAL_UI_CONTROLS.md) - Parent feature documentation
- [Voice Commands](../features/VOICE_COMMANDS.md) - Voice automation system
- [Tool Handlers](../features/AI_TOOL_CALLING.md) - Backend tool execution logic
- [Session Management Guide](../guides/SESSION_MANAGEMENT_GUIDE.md) - User-facing guide



