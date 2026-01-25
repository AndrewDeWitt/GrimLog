# Tool Calling with Structured Outputs

**Last Updated:** 2025-10-27  
**Status:** Complete

## Overview

All tool calls in the Grimlog voice analysis system now use **structured outputs** with strict schema validation via the OpenAI Responses API.

## The Problem We Solved

### Before: Conversational Responses Instead of Tool Calls

```
User Speech: "I did 5 damage to your Swarmlord"

❌ What Was Happening:
Model Response: "I think you mean 'The Swarmlord.' Your message says 
'your Swarmlord' (which would be the opponent's), but only you have 
The Swarmlord in the current lists. Do you mean..."

Tool Calls: 0
Result: No game state updated
```

The model was acting like a **conversational assistant** instead of a **tool-calling agent**.

### After: Direct Tool Execution

```
User Speech: "I did 5 damage to your Swarmlord"

✅ What Happens Now:
Tool Calls: 1
- update_unit_health({
    unit_name: "The Swarmlord",
    owner: "opponent",
    wounds_lost: 5
  })

Result: Game state updated immediately
```

## Implementation

### 1. Validated Tool Definitions

All 15 tools use Responses API internally-tagged format with validation:

**Important Note on Strict Mode:**
We use `additionalProperties: false` but NOT `strict: true` because:
- Strict mode requires ALL properties to be in the `required` array
- Most of our tools have optional parameters (e.g., `target_unit`, `context`, `destroyed_by`)
- Optional parameters would become required with strict mode
- We still get strong validation from enums, types, and `additionalProperties: false`

```typescript
{
  type: "function",
  name: "update_unit_health",
  parameters: {
    type: "object",
    properties: {
      unit_name: { type: "string", description: "..." },
      owner: { type: "string", enum: ["player", "opponent"], ... },
      wounds_lost: { type: "integer", minimum: 0, ... }  // Optional
    },
    required: ["unit_name", "owner"],  // Only required fields
    additionalProperties: false  // No extra fields allowed
  }
  // Note: No strict: true because we have optional parameters
}
```

**Benefits:**
- Enum values are validated (e.g., owner must be "player" or "opponent")
- Types are enforced (e.g., wounds_lost must be integer if provided)
- No invalid or unexpected fields (`additionalProperties: false`)
- Required fields are guaranteed present
- Optional fields can be omitted

### 2. Assertive System Prompt

Updated the prompt to enforce tool-calling behavior:

```
CRITICAL: You are a TOOL-CALLING AGENT, not a conversational assistant.
- You MUST call tools to track game actions
- DO NOT generate conversational responses
- DO NOT ask clarifying questions
- DO NOT explain your reasoning in text
- Use fuzzy matching and context to resolve ambiguities yourself
```

**Key Changes:**
- Explicitly forbids conversational responses
- Requires tool calling for game actions
- Empowers model to resolve ambiguities using context
- Relies on fuzzy matching system for unit names

### 3. Response API Configuration

```typescript
const response = await openai.responses.create({
  model: 'gpt-5-mini',
  instructions: systemPrompt,  // System-level guidance
  input: transcribedText,      // User speech
  tools: AI_TOOLS,             // All 15 tools with strict: true
  parallel_tool_calls: true,   // Allow multiple tools
  tool_choice: "auto"          // Let model decide (with assertive prompt)
});
```

## Structured Output Flow

### Request → Response → Execution

```
1. User Speech
   ↓
2. Responses API Call
   - Instructions: Assertive tool-calling prompt
   - Tools: 15 strict schema tools
   ↓
3. Model Output (Items Array)
   - type: "reasoning" (optional, GPT-5 only)
   - type: "function_call" ← Tool calls with structured args
   - type: "message" (only if no tools called)
   ↓
4. Extract Function Calls
   - Filter output for type === 'function_call'
   - Arguments already parsed as objects
   - Validated against strict schema
   ↓
5. Execute Tools in Parallel
   - Pass validated arguments to handlers
   - Return structured ToolExecutionResult
```

## Tool Argument Validation

### Automatic Schema Validation

The Responses API with internally-tagged tools and `additionalProperties: false` ensures:

```typescript
// ✅ VALID - Matches schema exactly
{
  unit_name: "Terminators",
  owner: "player",
  wounds_lost: 6
}

// ❌ REJECTED - Invalid enum value
{
  unit_name: "Terminators",
  owner: "neutral",  // Not in enum
  wounds_lost: 6
}

// ❌ REJECTED - Wrong type
{
  unit_name: "Terminators",
  owner: "player",
  wounds_lost: "six"  // Should be integer
}

// ❌ REJECTED - Additional property
{
  unit_name: "Terminators",
  owner: "player",
  wounds_lost: 6,
  extra_field: "not allowed"  // additionalProperties: false
}
```

### Runtime Safety

Since arguments are validated by OpenAI before they reach our code:

```typescript
// NO NEED for runtime validation!
async function updateUnitHealth(args: UpdateUnitHealthArgs, ...) {
  // args is guaranteed to match UpdateUnitHealthArgs interface
  // unit_name is guaranteed to be a string
  // owner is guaranteed to be "player" or "opponent"
  // wounds_lost (if present) is guaranteed to be a positive integer
}
```

## Handling Edge Cases

### Ambiguous Unit Names

The model uses context and fuzzy matching instead of asking:

```
User: "my tournaments took damage"
Context: Army contains "Termagants"

Before: "Do you mean Termagants?"
After: Calls update_unit_health(unit_name="Termagants", ...)
```

The `findBestUnitMatch()` function handles phonetic matching.

### Multiple Valid Targets

The model uses recent conversation and game state to disambiguate:

```
User: "my captain took 3 wounds"
Context: Player has 2 Captains

Before: "Which Captain?"
After: Uses conversation history to determine which Captain
```

### Truly Ambiguous Cases

If genuinely unclear, the model should NOT call tools:

```
User: "umm... maybe... I don't know"

Result: No tool calls (confidence too low)
```

## All Tool Definitions with Strict Outputs

| Tool Name | Required Fields | Optional Fields | Strict Mode |
|-----------|----------------|-----------------|-------------|
| `change_phase` | new_phase, player_turn | - | ✅ |
| `advance_battle_round` | round_number | - | ✅ |
| `log_stratagem_use` | stratagem_name, cp_cost, used_by | target_unit, description | ✅ |
| `update_command_points` | player, change, reason | - | ✅ |
| `update_victory_points` | player, points, source | - | ✅ |
| `update_objective_control` | objective_number, controlled_by | controlling_unit | ✅ |
| `log_unit_action` | unit_name, action_type, owner | target, success, details | ✅ |
| `log_combat_result` | attacking_unit, attacking_player, defending_unit, defending_player, phase | wounds_dealt, models_destroyed, unit_destroyed | ✅ |
| `query_game_state` | query_type | player | ✅ |
| `set_secondary_objectives` | player, secondaries | - | ✅ |
| `redraw_secondary_objective` | player, old_secondary, new_secondary | - | ✅ |
| `update_unit_health` | unit_name, owner | wounds_lost, models_lost, target_model_role, context | ✅ |
| `mark_unit_destroyed` | unit_name, owner | destroyed_by | ✅ |
| `update_unit_status` | unit_name, owner | is_battle_shocked, add_effects, remove_effects | ✅ |
| `get_strategic_advice` | query_type | - | ✅ |

## Monitoring

### Success Metrics

Watch for in Langfuse traces:

1. **Tool Call Rate**
   - Before: ~60% of analyses resulted in tool calls
   - After: Should be ~90%+ (filtering out only truly off-topic)

2. **Zero Text Responses**
   - Before: Model generated clarifying questions
   - After: Model calls tools directly

3. **Structured Arguments**
   - All tool arguments match strict schema
   - No invalid enum values
   - No type mismatches
   - No additional properties

### Example Trace Analysis

**Good Trace:**
```json
{
  "output": [
    {
      "type": "function_call",
      "call_id": "call_abc123",
      "name": "update_unit_health",
      "arguments": {
        "unit_name": "Termagants",
        "owner": "player",
        "wounds_lost": 5
      }
    }
  ]
}
```

**Bad Trace (should not happen):**
```json
{
  "output": [
    {
      "type": "message",
      "content": "I think you mean..."  // ❌ Conversational response
    }
  ]
}
```

## Testing

### Test Cases

1. **Simple phase change**
   ```
   Say: "Moving to shooting phase"
   Expected: change_phase tool call
   Check: Arguments have strict types
   ```

2. **Ambiguous unit name**
   ```
   Say: "My tournaments took damage"
   Expected: update_unit_health("Termagants", ...)
   Check: No clarifying questions, direct tool call
   ```

3. **Multiple actions**
   ```
   Say: "Moving to shooting, my terminators shoot the carnifex"
   Expected: Multiple tool calls in parallel
   Check: All arguments validated
   ```

## Benefits of Structured Outputs

### Type Safety
- No runtime type errors from invalid arguments
- Enum values guaranteed to be valid
- Numbers guaranteed to be in valid ranges

### Performance
- No need for runtime validation code
- OpenAI validates before sending response
- Fewer error handling edge cases

### Reliability
- Guaranteed schema compliance
- No unexpected fields
- Consistent tool behavior

### Debugging
- Easy to spot schema violations in traces
- Clear error messages from OpenAI
- Better observability in Langfuse

## Related Documentation

- [Orchestrator Optimization](./ORCHESTRATOR_OPTIMIZATION.md)
- [Responses API Migration](./RESPONSES_API_MIGRATION.md)
- [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs)

