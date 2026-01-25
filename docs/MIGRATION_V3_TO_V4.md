# Migration Guide: v3.x to v4.0.0

**Last Updated:** 2025-11-02  
**Status:** Complete

## Overview

Version 4.0.0 introduces a breaking change: complete terminology consolidation from "player/opponent" to "attacker/defender". This guide explains how to migrate from v3.x to v4.0.0.

## Table of Contents

- [What Changed](#what-changed)
- [Why This Change](#why-this-change)
- [Migration Steps](#migration-steps)
- [Data Migration SQL](#data-migration-sql)
- [Testing Your Migration](#testing-your-migration)
- [Rollback Plan](#rollback-plan)
- [Related Documentation](#related-documentation)

## What Changed

### Database Schema

**Field Renames in `GameSession` model:**
- `playerArmyId` → `attackerArmyId`
- `opponentName` → `defenderName`
- `opponentFaction` → `defenderFaction`
- `currentPlayerTurn` → `currentTurn`
- `firstPlayer` → `firstTurn`
- `playerCommandPoints` → `attackerCommandPoints`
- `opponentCommandPoints` → `defenderCommandPoints`
- `playerVictoryPoints` → `attackerVictoryPoints`
- `opponentVictoryPoints` → `defenderVictoryPoints`
- `playerSecondaries` → `attackerSecondaries`
- `opponentSecondaries` → `defenderSecondaries`
- `playerSecondaryProgress` → `attackerSecondaryProgress`
- `opponentSecondaryProgress` → `defenderSecondaryProgress`
- `playerDiscardedSecondaries` → `attackerDiscardedSecondaries`
- `opponentDiscardedSecondaries` → `defenderDiscardedSecondaries`
- `playerExtraCPGainedThisTurn` → `attackerExtraCPGainedThisTurn`
- `opponentExtraCPGainedThisTurn` → `defenderExtraCPGainedThisTurn`

**Enum Value Changes:**
- All `'player'` values → `'attacker'`
- All `'opponent'` values → `'defender'`

**Affected Models:**
- `GameSession` - Primary game state
- `UnitInstance` - `owner` field
- `ObjectiveMarker` - `controlledBy` field
- `StratagemLog` - `usedBy` field
- `CombatLog` - `attackingPlayer` and `defendingPlayer` fields

### API Changes

**Request Bodies:**
Old v3.x format:
```json
{
  "playerArmyId": "...",
  "opponentArmyId": "...",
  "firstPlayer": "player"
}
```

New v4.0.0 format:
```json
{
  "attackerArmyId": "...",
  "defenderArmyId": "...",
  "firstTurn": "attacker"
}
```

**Response Bodies:**
All session endpoints now return `attackerX` and `defenderX` fields instead of `playerX` and `opponentX`.

### TypeScript Types

All type definitions updated:
```typescript
// v3.x
owner: 'player' | 'opponent'

// v4.0.0
owner: 'attacker' | 'defender'
```

## Why This Change

### Problem with v3.x Terminology

1. **Ambiguity**: "Player" meant different things in different contexts
2. **Perspective-dependent**: "Your army" doesn't work when both sides use the same interface
3. **Voice Command Confusion**: "My opponent did X" was unclear
4. **Multi-user Limitations**: Can't share sessions easily with perspective-dependent language

### Solution in v4.0.0

1. **Objective Roles**: Attacker and Defender are fixed roles, not perspectives
2. **Consistent Throughout**: Set at session creation, never changes
3. **Clear for AI**: Voice commands use unambiguous terminology
4. **Multi-user Ready**: Both sides can use the same interface with clear role identification

## Migration Steps

### Option 1: Fresh Start (Recommended for Development)

If you don't need to preserve existing session data:

```bash
# 1. Backup your database (just in case)
pg_dump $DATABASE_URL > backup_v3.sql

# 2. Apply schema changes
npx prisma db push

# 3. Regenerate Prisma Client
npx prisma generate

# 4. Build and test
npm run build
npm run dev

# 5. Create a test session to verify everything works
```

### Option 2: Migrate Existing Data

If you have important session data to preserve:

```bash
# 1. CRITICAL: Backup your database
pg_dump $DATABASE_URL > backup_v3_$(date +%Y%m%d).sql

# 2. Apply schema changes
npx prisma db push

# 3. Run data migration SQL (see below)

# 4. Regenerate Prisma Client
npx prisma generate

# 5. Build and test
npm run build

# 6. Verify existing sessions load correctly
```

## Data Migration SQL

**IMPORTANT**: Run these SQL commands AFTER applying schema changes with `prisma db push`.

```sql
-- ============================================
-- ENUM VALUE MIGRATIONS
-- Update all 'player'/'opponent' to 'attacker'/'defender'
-- ============================================

BEGIN;

-- Update GameSession.currentTurn
UPDATE "GameSession" 
SET "currentTurn" = 'attacker' 
WHERE "currentTurn" = 'player';

UPDATE "GameSession" 
SET "currentTurn" = 'defender' 
WHERE "currentTurn" = 'opponent';

-- Update GameSession.firstTurn  
UPDATE "GameSession" 
SET "firstTurn" = 'attacker' 
WHERE "firstTurn" = 'player';

UPDATE "GameSession" 
SET "firstTurn" = 'defender' 
WHERE "firstTurn" = 'opponent';

-- Update UnitInstance.owner
UPDATE "UnitInstance" 
SET "owner" = 'attacker' 
WHERE "owner" = 'player';

UPDATE "UnitInstance" 
SET "owner" = 'defender' 
WHERE "owner" = 'opponent';

-- Update ObjectiveMarker.controlledBy
UPDATE "ObjectiveMarker" 
SET "controlledBy" = 'attacker' 
WHERE "controlledBy" = 'player';

UPDATE "ObjectiveMarker" 
SET "controlledBy" = 'defender' 
WHERE "controlledBy" = 'opponent';

-- Update StratagemLog.usedBy
UPDATE "StratagemLog" 
SET "usedBy" = 'attacker' 
WHERE "usedBy" = 'player';

UPDATE "StratagemLog" 
SET "usedBy" = 'defender' 
WHERE "usedBy" = 'opponent';

-- Update CombatLog.attackingPlayer
UPDATE "CombatLog" 
SET "attackingPlayer" = 'attacker' 
WHERE "attackingPlayer" = 'player';

UPDATE "CombatLog" 
SET "attackingPlayer" = 'defender' 
WHERE "attackingPlayer" = 'opponent';

-- Update CombatLog.defendingPlayer
UPDATE "CombatLog" 
SET "defendingPlayer" = 'attacker' 
WHERE "defendingPlayer" = 'player';

UPDATE "CombatLog" 
SET "defendingPlayer" = 'defender' 
WHERE "defendingPlayer" = 'opponent';

COMMIT;
```

**Verification Query:**
```sql
-- Check that no old enum values remain
SELECT 
  (SELECT COUNT(*) FROM "GameSession" WHERE "currentTurn" IN ('player', 'opponent')) as old_currentTurn,
  (SELECT COUNT(*) FROM "GameSession" WHERE "firstTurn" IN ('player', 'opponent')) as old_firstTurn,
  (SELECT COUNT(*) FROM "UnitInstance" WHERE "owner" IN ('player', 'opponent')) as old_unitOwner,
  (SELECT COUNT(*) FROM "ObjectiveMarker" WHERE "controlledBy" IN ('player', 'opponent')) as old_objective,
  (SELECT COUNT(*) FROM "StratagemLog" WHERE "usedBy" IN ('player', 'opponent')) as old_stratagem,
  (SELECT COUNT(*) FROM "CombatLog" WHERE "attackingPlayer" IN ('player', 'opponent') OR "defendingPlayer" IN ('player', 'opponent')) as old_combat;

-- All counts should be 0
```

## Testing Your Migration

### 1. Verify Database Schema

```bash
npx prisma studio
```

Check that:
- `GameSession` table has `attackerCommandPoints`, `defenderCommandPoints`, etc.
- No `playerCommandPoints` or `opponentCommandPoints` columns exist
- Enum values are 'attacker' and 'defender'

### 2. Test Session Creation

Create a new game session through the UI:
1. Navigate to Sessions → New Session
2. Select attacker army
3. Select defender army
4. Choose who goes first (Attacker or Defender)
5. Verify session creates successfully

### 3. Test Existing Sessions

Load an existing migrated session:
1. Navigate to Sessions list
2. Click on a migrated session
3. Verify all data displays correctly:
   - Command Points show for both sides
   - Victory Points are correct
   - Unit ownership is clear (Attacker units vs Defender units)
   - Secondaries display properly
   - Timeline events are intact

### 4. Test Voice Commands

Try voice commands with new terminology:
- "Attacker moving to Movement phase"
- "Defender's Terminators lost 3 models"
- "Attacker scored Assassination for 4 VP"

Verify the AI correctly processes these commands.

### 5. Test Manual Controls

Test UI interactions:
- Adjust CP using +/- buttons
- Score secondary objectives manually
- Change phases using buttons
- Update unit health manually

All should work with new field names.

## Rollback Plan

If migration fails or you need to rollback:

### Immediate Rollback

```bash
# 1. Restore database from backup
psql $DATABASE_URL < backup_v3_YYYYMMDD.sql

# 2. Checkout v3.x branch
git checkout v3.x

# 3. Reinstall dependencies
npm install

# 4. Regenerate Prisma Client for v3
npx prisma generate

# 5. Restart application
npm run dev
```

### Gradual Rollback

If you need to keep some v4 changes but rollback data:

```sql
BEGIN;

-- Reverse enum migrations
UPDATE "GameSession" SET "currentTurn" = 'player' WHERE "currentTurn" = 'attacker';
UPDATE "GameSession" SET "currentTurn" = 'opponent' WHERE "currentTurn" = 'defender';
UPDATE "GameSession" SET "firstTurn" = 'player' WHERE "firstTurn" = 'attacker';
UPDATE "GameSession" SET "firstTurn" = 'opponent' WHERE "firstTurn" = 'defender';

-- Repeat for other tables...

COMMIT;
```

## Common Issues

### Issue: "Property 'playerCommandPoints' does not exist"

**Cause**: TypeScript still looking for old field names  
**Solution**: Run `npx prisma generate` to regenerate Prisma Client

### Issue: Voice commands not working

**Cause**: AI cache might have old prompts  
**Solution**: Restart the application to reload AI system prompts

### Issue: UI shows undefined for CP/VP

**Cause**: Frontend code still using old field names  
**Solution**: Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: Session creation fails

**Cause**: Request body using old field names  
**Solution**: Update request to use `attackerArmyId` and `defenderArmyId`

## Deployment Checklist

Before deploying to production:

- [ ] Backup production database
- [ ] Test migration on staging environment
- [ ] Run data migration SQL on staging
- [ ] Verify all existing sessions work
- [ ] Test new session creation
- [ ] Test voice commands
- [ ] Verify UI displays correctly
- [ ] Test all critical user flows
- [ ] Monitor logs for errors
- [ ] Have rollback plan ready

## Support

If you encounter issues during migration:

1. Check the [Troubleshooting](#common-issues) section above
2. Review the [Attacker vs Defender Terminology](features/ATTACKER_DEFENDER_TERMINOLOGY.md) documentation
3. Check build logs for specific error messages
4. Verify database schema matches expected structure

## Related Documentation

- [Attacker vs Defender Terminology](features/ATTACKER_DEFENDER_TERMINOLOGY.md) - Complete terminology system documentation
- [Game State Tracking](features/GAME_STATE_TRACKING.md) - Core game state management
- [AI Tool Calling](features/AI_TOOL_CALLING.md) - AI tool system affected by changes
- [Session Setup Guide](guides/SESSION_SETUP_GUIDE.md) - Creating sessions with new terminology

