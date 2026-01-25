# Attacker vs Defender Terminology System

**Last Updated:** 2025-11-02  
**Status:** Complete  
**Version:** 4.0.0

## Overview

Grimlog uses consistent "Attacker" vs "Defender" terminology throughout the entire system instead of variable terms like "Your/Opponent" or "Player/Enemy". This provides clear, objective identification of both sides in the game without perspective-dependent language.

The Attacker/Defender designation is determined at session creation and remains consistent throughout the entire game, regardless of whose turn it is.

## Table of Contents

- [Why This Matters](#why-this-matters)
- [Terminology Rules](#terminology-rules)
- [Database Schema](#database-schema)
- [AI System Integration](#ai-system-integration)
- [UI Display](#ui-display)
- [Migration from Previous System](#migration-from-previous-system)
- [Related Documentation](#related-documentation)

## Why This Matters

### Problem with Previous System
The old system used "player/opponent" which was ambiguous:
- "Player" could mean "the person speaking" or "the app user"
- "Opponent" changed meaning based on whose turn it was
- UI said "Your army" which doesn't work when both sides use the same app
- Voice commands were unclear: "my opponent" vs "the opponent"

### Solution: Attacker vs Defender
- **Attacker**: Designated at session start, remains consistent
- **Defender**: The other side, also consistent
- **No "Your/Their"**: Eliminates possessive language
- **Clear for AI**: Voice commands use objective terminology
- **Multi-user Ready**: Both sides can use the same interface

## Terminology Rules

### Core Principle
**Attacker and Defender are roles, not positions.** They're assigned at game start based on who the user designates as the attacking force.

### Usage Examples

**✅ Correct:**
- "Attacker's Terminators lost 3 models"
- "Defender controls objective 2"
- "Attacker phase - Movement"
- "Defender's turn"

**❌ Incorrect:**
- ~~"Your Terminators"~~
- ~~"Opponent controls objective 2"~~
- ~~"My phase"~~
- ~~"Their turn"~~

### Special Cases

#### Exception: User Ownership
The word "your" is still appropriate for user-specific data:
- "Your session"
- "Your army list"
- "Your settings"

These refer to the authenticated user's data, not game roles.

## Database Schema

### GameSession Model

All primary game state fields use Attacker/Defender prefixes:

```typescript
model GameSession {
  // Army assignment
  attackerArmyId: String?
  attackerArmy: Army?
  defenderName: String?
  defenderFaction: String?
  
  // Turn management
  currentTurn: String  // "attacker" or "defender"
  firstTurn: String    // Who goes first each round
  
  // Resources
  attackerCommandPoints: Int
  defenderCommandPoints: Int
  attackerVictoryPoints: Int
  defenderVictoryPoints: Int
  
  // Secondary Objectives
  attackerSecondaries: String?
  defenderSecondaries: String?
  attackerSecondaryProgress: String?
  defenderSecondaryProgress: String?
  attackerDiscardedSecondaries: String?
  defenderDiscardedSecondaries: String?
  attackerExtraCPGainedThisTurn: Boolean
  defenderExtraCPGainedThisTurn: Boolean
}
```

### Related Models

**UnitInstance:**
```typescript
owner: String  // "attacker" or "defender"
```

**ObjectiveMarker:**
```typescript
controlledBy: String  // "attacker", "defender", "contested", or "none"
```

**StratagemLog:**
```typescript
usedBy: String  // "attacker" or "defender"
```

**CombatLog:**
```typescript
attackingPlayer: String  // "attacker" or "defender"
defendingPlayer: String  // "attacker" or "defender"
```

## AI System Integration

### Tool Definitions

All 20+ AI tools use the new terminology:

```typescript
// Example: change_phase tool
player_turn: {
  type: "string",
  enum: ["attacker", "defender"],
  description: "Whose turn it is (attacker or defender)"
}
```

### System Prompts

AI prompts instruct the model to use neutral language:

```
IMPORTANT RULES:
- Determine from context whether actions apply to "attacker" or "defender"
- Listen for contextual cues to identify which side is performing actions
- Never use "your" or "their" in responses
```

### Example Voice Commands

**Speech Input → Tool Call:**
- "Attacker's Terminators took 6 wounds" → `update_unit_health(owner="attacker", ...)`
- "Defender scored Assassination" → `score_assassination(player="defender", ...)`
- "Moving to Shooting phase, Attacker's turn" → `change_phase(new_phase="Shooting", player_turn="attacker")`

## UI Display

### Component Props

All components receive explicit attacker/defender props:

```typescript
interface GameStateDisplayProps {
  // Attacker state
  playerCP: number;
  playerVP: number;
  attackerSecondaries: string[];
  attackerSecondaryProgress?: SecondaryProgressMap;
  
  // Defender state  
  opponentCP: number;
  opponentVP: number;
  defenderSecondaries: string[];
  defenderSecondaryProgress?: SecondaryProgressMap;
  
  currentTurn: 'attacker' | 'defender';
  firstTurn: 'attacker' | 'defender';
}
```

### Display Text

**Headers and Labels:**
- Command Points: "Attacker CP" / "Defender CP"
- Victory Points: "Attacker VP" / "Defender VP"
- Secondary tabs: "ATTACKER SECONDARIES (2/2)" / "DEFENDER SECONDARIES (2/2)"
- Turn indicator: "Attacker's Turn - Movement Phase"

**Color Coding:**
- Attacker: Green theme (`grimlog-player-green`)
- Defender: Red theme (`grimlog-opponent-red`)

## Migration from Previous System

### Breaking Changes

This is a **major version bump (4.0.0)** because:
1. Database schema changes are not backward compatible
2. API responses have different field names
3. Enum values changed throughout system

### Migration Steps

**For Development:**
```bash
npx prisma db push  # Apply schema changes
npx prisma generate  # Regenerate client
npm run build        # Verify TypeScript compilation
```

**For Production:**
```bash
# 1. Backup database
# 2. Run migration
npx prisma migrate deploy
# 3. Data migration needed: Update all enum values 'player'→'attacker', 'opponent'→'defender'
# 4. Restart application
```

### Data Migration SQL

If you have existing data, you'll need to update enum values:

```sql
-- Update GameSession
UPDATE "GameSession" 
SET "currentTurn" = 'attacker' 
WHERE "currentTurn" = 'player';

UPDATE "GameSession" 
SET "currentTurn" = 'defender' 
WHERE "currentTurn" = 'opponent';

UPDATE "GameSession" 
SET "firstTurn" = 'attacker' 
WHERE "firstTurn" = 'player';

UPDATE "GameSession" 
SET "firstTurn" = 'defender' 
WHERE "firstTurn" = 'opponent';

-- Update UnitInstance
UPDATE "UnitInstance" 
SET "owner" = 'attacker' 
WHERE "owner" = 'player';

UPDATE "UnitInstance" 
SET "owner" = 'defender' 
WHERE "owner" = 'opponent';

-- Update ObjectiveMarker
UPDATE "ObjectiveMarker" 
SET "controlledBy" = 'attacker' 
WHERE "controlledBy" = 'player';

UPDATE "ObjectiveMarker" 
SET "controlledBy" = 'defender' 
WHERE "controlledBy" = 'opponent';

-- Update StratagemLog
UPDATE "StratagemLog" 
SET "usedBy" = 'attacker' 
WHERE "usedBy" = 'player';

UPDATE "StratagemLog" 
SET "usedBy" = 'defender' 
WHERE "usedBy" = 'opponent';

-- Update CombatLog
UPDATE "CombatLog" 
SET "attackingPlayer" = 'attacker' 
WHERE "attackingPlayer" = 'player';

UPDATE "CombatLog" 
SET "attackingPlayer" = 'defender' 
WHERE "attackingPlayer" = 'opponent';

UPDATE "CombatLog" 
SET "defendingPlayer" = 'attacker' 
WHERE "defendingPlayer" = 'player';

UPDATE "CombatLog" 
SET "defendingPlayer" = 'defender' 
WHERE "defendingPlayer" = 'opponent';
```

## Implementation Details

### Files Modified (50+)

**Core Infrastructure:**
- `prisma/schema.prisma` - Database schema
- `lib/types.ts` - Type definitions
- `lib/aiTools.ts` - AI tool definitions (20+ tools)

**AI System:**
- `lib/contextBuilder.ts` - AI prompt construction
- `lib/intentOrchestrator.ts` - Intent classification
- `lib/strategicAssistant.ts` - Strategic guidance
- `lib/toolHandlers.ts` - Tool execution logic (2000+ lines)

**API Routes (9 files):**
- `app/api/sessions/route.ts`
- `app/api/sessions/[id]/route.ts`
- `app/api/sessions/[id]/units/route.ts`
- `app/api/sessions/[id]/cp-spent/route.ts`
- `app/api/sessions/[id]/score-secondary/route.ts`
- `app/api/sessions/[id]/discard-secondary/route.ts`
- `app/api/sessions/[id]/restore-secondary/route.ts`
- `app/api/sessions/[id]/manual-action/route.ts`
- `app/api/analyze/route.ts`

**UI Components (22 files):**
- All game state display components
- All secondary objective components  
- All unit management components
- All phase control components

**Library Utilities:**
- `lib/validationHelpers.ts`
- `lib/turnHelpers.ts`
- `lib/unitMatching.ts`
- `lib/hooks/useSession.ts`
- `lib/hooks/useUnits.ts`

## Testing

### Verification Checklist

✅ **Build Status:**
- TypeScript compilation passes
- No type errors
- Only preexisting ESLint warnings

✅ **Database:**
- Schema synced with `prisma db push`
- Prisma Client regenerated successfully

⚠️ **Manual Testing Required:**
- [ ] Create new game session with attacker/defender armies
- [ ] Test voice commands with new terminology
- [ ] Verify UI displays correct labels
- [ ] Test secondary objectives system
- [ ] Test unit health tracking
- [ ] Verify turn management works correctly
- [ ] Check all API endpoints return correct field names

## Related Documentation

- [Game State Tracking](./GAME_STATE_TRACKING.md) - Core game state management
- [AI Tool Calling](./AI_TOOL_CALLING.md) - AI tool system architecture  
- [Turn Order System](./TURN_ORDER_SYSTEM.md) - Turn management logic
- [Secondary Objectives](./SECONDARY_OBJECTIVES_COMPLETE.md) - Secondary objectives system
- [API Documentation](../api/) - All API endpoint documentation

## Future Considerations

### Potential Enhancements
1. **Session Role Assignment UI**: Add clear UI during session creation to designate Attacker/Defender
2. **Role Swap**: Allow swapping Attacker/Defender roles mid-game if needed
3. **Documentation Updates**: Update all 13 documentation files that still reference old terminology
4. **Script Updates**: Fix seed scripts and utility scripts to use new terminology

### Backward Compatibility
This is a **breaking change**. No backward compatibility with v3.x sessions. If you need to maintain old sessions, keep a separate v3 branch or migrate data using the SQL scripts above.

