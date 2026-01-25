# Smart Unit Matching System

**Last Updated:** 2025-10-07  
**Status:** Complete  
**Version:** 2.5.0

## Overview

The Smart Unit Matching System solves the problem of users referring to units by nicknames, abbreviations, or partial names during voice commands. Instead of requiring exact unit name matches, the system uses intelligent fuzzy matching, common nickname recognition, and provides helpful clarifications when matches are ambiguous.

## Problem Solved

**Before:**
```
User says: "My Terminators lost a model"
AI calls: update_unit_health(unit_name="Terminators", ...)
Database has: unitName: "Terminator Squad"
Result: ❌ "Unit 'Terminators' not found"
```

**After:**
```
User says: "My Terminators lost a model"
AI calls: update_unit_health(unit_name="Terminators", ...)
Smart matcher finds: "Terminator Squad" (95% confidence via nickname)
Result: ✅ "Terminator Squad (matched from 'Terminators'): 4/5 models"
```

## Features

### 1. **Multiple Matching Strategies**

The system tries matching in order of confidence:

1. **Exact Match** (100% confidence) - Perfect name match
2. **Common Nicknames** (95% confidence) - Pre-defined abbreviations
3. **Fuzzy Matching** (60-100% confidence) - String similarity algorithm
4. **Partial Containment** (50-99% confidence) - One name contains the other

### 2. **Common Nickname Library**

Built-in recognition for common Warhammer 40K abbreviations:

#### Space Marines
- `"Termies"` → `"Terminator Squad"`
- `"Intercessors"` → `"Intercessor Squad"`
- `"Hellblasters"` → `"Hellblaster Squad"`
- `"Devs"` → `"Devastator Squad"`
- `"Dreads"` → `"Dreadnought"`
- And more...

#### Tyranids
- `"Gaunts"` → `"Termagant"` or `"Hormagaunt"`
- `"Warriors"` → `"Tyranid Warrior"`
- `"Fex"` → `"Carnifex"`
- `"Tyrant"` → `"Hive Tyrant"`
- And more...

### 3. **Ambiguity Detection**

When multiple units could match, the system rejects the match with a helpful error:

```
❌ "Gaunts" is ambiguous. Did you mean: "Termagant Brood" or "Hormagaunt Brood"? 
   Please be more specific.
```

### 4. **Match Feedback**

All tool responses show what was matched:

```json
{
  "success": true,
  "message": "Terminator Squad (matched from 'Terminators'): 4/5 models",
  "data": {
    "unitName": "Terminator Squad",
    "matchedFrom": "Terminators",
    "matchMethod": "nickname",
    "currentModels": 4,
    "startingModels": 5
  }
}
```

### 5. **AI Prompt Enhancement**

The AI now receives a list of available units at the start of each analysis:

```
AVAILABLE UNITS IN THIS BATTLE:

Player's Army:
  - Terminator Squad
  - Intercessor Squad
  - Captain in Terminator Armour

Opponent's Army:
  - Termagant Brood
  - Tyranid Warriors
  - Hive Tyrant

IMPORTANT: When updating unit health, use these EXACT unit names from the list above.
If the player uses a nickname (e.g., "Terminators" for "Terminator Squad"), 
use your best judgment to match it to the correct full name from the list.
```

## Architecture

### Files

**`lib/unitMatching.ts`** - Core matching logic
- `findBestUnitMatch()` - Main matching function
- `getSessionUnitNames()` - Fetch units for a session
- `buildUnitListPrompt()` - Format units for AI prompt
- `COMMON_NICKNAMES` - Nickname dictionary
- `calculateSimilarity()` - Levenshtein distance algorithm

**`lib/toolHandlers.ts`** - Updated tool handlers
- `updateUnitHealth()` - Uses smart matching
- `markUnitDestroyed()` - Uses smart matching
- `updateUnitStatus()` - Uses smart matching

**`app/api/analyze/route.ts`** - AI prompt enhancement
- Fetches unit names from session
- Includes unit list in system prompt

### Matching Algorithm

```typescript
async function findBestUnitMatch(
  searchName: string,
  owner: string,
  sessionId: string,
  strictMode: boolean = true
): Promise<UnitMatchResult>
```

**Steps:**
1. Fetch all active units for owner in session
2. Try exact match (case-insensitive)
3. Try common nickname lookup
4. Calculate similarity scores for all units
5. Pick best match if above threshold (80% in strict mode)
6. Check for ambiguous matches (multiple high scores)
7. Return match result with confidence and metadata

**Strict Mode (enabled by default):**
- Requires 80%+ confidence for fuzzy matches
- Rejects ambiguous matches with helpful errors
- Ensures users learn correct names over time

## User Experience Benefits

### 1. **Natural Speech**
Users can speak naturally without memorizing exact unit names:
- ✅ "My Termies lost a model"
- ✅ "Opponent's Gaunts charged"
- ✅ "Hellblasters fired"

### 2. **Learning Through Use**
When matches aren't exact, users see what the system understood:
- `"Terminator Squad (matched from 'Terminators'): 4/5 models"`
- This teaches users the actual unit names over time

### 3. **Clear Error Messages**
When ambiguous, users get specific guidance:
- `"Gaunts" is ambiguous. Did you mean: "Termagant Brood" or "Hormagaunt Brood"?`
- Helps users be more specific in future commands

### 4. **Extensible Nickname System**
Common nicknames are built-in, and the system can easily be extended to:
- Learn user-specific nicknames
- Support faction-specific abbreviations
- Adapt to local gaming community slang

## Configuration

### Confidence Thresholds

**Strict Mode (default):**
```typescript
const confidenceThreshold = 0.80; // 80% similarity required
```

**Permissive Mode:**
```typescript
const confidenceThreshold = 0.60; // 60% similarity required
```

### Ambiguity Detection

Two matches are considered ambiguous if:
1. Both are above the confidence threshold
2. Their scores are within 15% of each other

```typescript
if (bestMatch.confidence - secondBest.confidence < 0.15) {
  // Too close - ambiguous
}
```

## Future Enhancements

### User-Learned Nicknames
Store user preferences in database:

```typescript
// Future feature
interface UserNickname {
  userId: string;
  nickname: string;
  actualUnitName: string;
  timesUsed: number;
}
```

### Faction-Specific Matching
Improve matching by knowing user's faction:

```typescript
// Future feature
if (playerFaction === 'Space Marines') {
  // Prioritize Space Marine units in matching
}
```

### Context-Aware Matching
Use conversation context to resolve ambiguity:

```typescript
// Future feature
// Last mentioned unit: "Terminators"
// User says: "They lost a model"
// → Match to last mentioned unit
```

## Testing

### Test Cases

**Exact Match:**
```typescript
"Terminator Squad" → Terminator Squad (100% confidence)
```

**Nickname Match:**
```typescript
"Termies" → Terminator Squad (95% confidence, nickname)
"Intercessors" → Intercessor Squad (95% confidence, nickname)
```

**Fuzzy Match:**
```typescript
"Terminators" → Terminator Squad (92% confidence, fuzzy)
"Hellblaster" → Hellblaster Squad (90% confidence, partial)
```

**Ambiguous:**
```typescript
"Gaunts" → Error (matches both Termagants and Hormagaunts)
"Marines" → Error (matches multiple Marine units)
```

**Not Found:**
```typescript
"Banana" → Error (best match <80% confidence)
```

## Related Documentation

- **[Unit Health Tracking](UNIT_HEALTH_TRACKING.md)** - Overall unit health system
- **[AI Tool Calling](AI_TOOL_CALLING.md)** - How AI tools work
- **[Units API Endpoint](../api/UNITS_ENDPOINT.md)** - API reference

## Examples

### Successful Match with Feedback
```
User: "My Terminators lost a model"
AI Tool Call: update_unit_health(unit_name="Terminators", owner="player", models_lost=1)
Matcher: Found "Terminator Squad" via nickname (95% confidence)
Response: ✅ "Terminator Squad (matched from 'Terminators'): 4/5 models"
Timeline: "player's Terminator Squad (matched from 'Terminators'): lost 1 model"
```

### Ambiguous Match with Clarification
```
User: "My Gaunts moved"
AI Tool Call: update_unit_health(unit_name="Gaunts", owner="player", ...)
Matcher: Ambiguous - matches both "Termagant Brood" and "Hormagaunt Brood"
Response: ❌ "Gaunts" is ambiguous. Did you mean: "Termagant Brood" or "Hormagaunt Brood"? 
          Please be more specific.
Timeline: No event created
```

### Low Confidence with Suggestions
```
User: "My Bananas attacked"
AI Tool Call: update_unit_health(unit_name="Bananas", owner="player", ...)
Matcher: No good match (best: "Bladeguard Veterans" at 12% confidence)
Response: ❌ Unit "Bananas" not found for player. Available units: "Terminator Squad", 
          "Intercessor Squad", "Captain in Terminator Armour". 
          (Best match: "Bladeguard Veterans" at 12% confidence)
Timeline: No event created
```
