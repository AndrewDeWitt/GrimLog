# Data Migration Guide

## Overview

Migrate data between TacLog databases using PostgreSQL's `dblink` extension via the Supabase MCP tools or SQL Editor.

**Databases:**
- **Dev (TacLog)**: `lelfaceyultzvztdndzs` (us-east-2)
- **Prod (TacLogProd)**: `qzpsnwhjztydbbgcufrk` (us-west-2)

## Quick Start: Prod → Dev Migration

The recommended method uses PostgreSQL's `dblink` extension to copy data directly between databases via SQL. This is executed through Supabase's SQL Editor or MCP tools.

### Step 1: Enable dblink (one-time setup)

Run in the **destination** database (e.g., dev for prod→dev migration):

```sql
CREATE EXTENSION IF NOT EXISTS dblink;
```

### Step 2: Clear destination database

```sql
-- Clear all tables (CASCADE handles foreign keys)
TRUNCATE TABLE 
  "DatasheetVersion",
  "FactionCompetitiveContext",
  "UnitCompetitiveContext", 
  "DatasheetCompetitiveContext",
  "DatasheetSource",
  "CompetitiveSource",
  "RevertAction",
  "SecondaryProgress",
  "CPTransaction",
  "ValidationEvent",
  "CombatLog",
  "StratagemLog",
  "UnitInstance",
  "ObjectiveMarker",
  "TranscriptHistory",
  "TimelineEvent",
  "GameSession",
  "SecondaryObjective",
  "PrimaryMission",
  "GameRule",
  "Stratagem",
  "Unit",
  "AttachmentPreset",
  "Army",
  "Player",
  "DatasheetWargear",
  "DatasheetAbility",
  "DatasheetWeapon",
  "GlobalUnitIcon",
  "UnitIcon",
  "FactionRule",
  "Enhancement",
  "StratagemData",
  "DetachmentRule",
  "Datasheet",
  "Detachment",
  "CoreStratagem",
  "WargearOption",
  "Ability",
  "Weapon",
  "Faction",
  "User"
CASCADE;
```

### Step 3: Copy tables using dblink

Run these SQL statements in the **destination** database. Replace `[PASSWORD]` with the source database password.

**Connection string format:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Copy base tables first (no foreign keys):**

```sql
-- User
INSERT INTO "User" 
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, email, name, avatar, "isAdmin", "dossierCredits", "createdAt", "updatedAt" FROM "User"'
) AS t(id TEXT, email TEXT, name TEXT, avatar TEXT, "isAdmin" BOOLEAN, "dossierCredits" INTEGER, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- Faction
INSERT INTO "Faction"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, name, "metaData", "parentFactionId", "createdAt", "updatedAt" FROM "Faction"'
) AS t(id TEXT, name TEXT, "metaData" TEXT, "parentFactionId" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- Weapon
INSERT INTO "Weapon"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, name, range, type, attacks, "ballisticSkill", "weaponSkill", strength, "armorPenetration", damage, abilities, "strengthValue", "strengthFormula", "damageValue", "damageFormula", "apValue", "structuredAbilities", "createdAt", "updatedAt" FROM "Weapon"'
) AS t(id TEXT, name TEXT, range TEXT, type TEXT, attacks TEXT, "ballisticSkill" TEXT, "weaponSkill" TEXT, strength TEXT, "armorPenetration" TEXT, damage TEXT, abilities TEXT, "strengthValue" INT, "strengthFormula" TEXT, "damageValue" INT, "damageFormula" TEXT, "apValue" INT, "structuredAbilities" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- Ability
INSERT INTO "Ability"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, name, type, description, keywords, phase, "triggerPhase", "triggerSubphase", "isReactive", "requiredKeywords", "createdAt", "updatedAt" FROM "Ability"'
) AS t(id TEXT, name TEXT, type TEXT, description TEXT, keywords TEXT, phase TEXT, "triggerPhase" TEXT, "triggerSubphase" TEXT, "isReactive" BOOLEAN, "requiredKeywords" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- WargearOption
INSERT INTO "WargearOption"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, name, description, "pointsCost", type, "createdAt", "updatedAt" FROM "WargearOption"'
) AS t(id TEXT, name TEXT, description TEXT, "pointsCost" INT, type TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- CoreStratagem
INSERT INTO "CoreStratagem"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, name, "cpCost", category, "when", target, effect, "triggerPhase", "triggerSubphase", "isReactive", "requiredKeywords", "usageRestriction", "isCalculatorRelevant", "calculatorEffect", edition, "sourceBook", "createdAt", "updatedAt" FROM "CoreStratagem"'
) AS t(id TEXT, name TEXT, "cpCost" INT, category TEXT, "when" TEXT, target TEXT, effect TEXT, "triggerPhase" TEXT, "triggerSubphase" TEXT, "isReactive" BOOLEAN, "requiredKeywords" TEXT, "usageRestriction" TEXT, "isCalculatorRelevant" BOOLEAN, "calculatorEffect" JSONB, edition TEXT, "sourceBook" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);
```

**Copy tables with foreign keys:**

```sql
-- Detachment (references Faction)
INSERT INTO "Detachment"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  'SELECT id, name, faction, "factionId", subfaction, description, "abilityName", "abilityDescription", edition, "sourceBook", "createdAt", "updatedAt" FROM "Detachment"'
) AS t(id TEXT, name TEXT, faction TEXT, "factionId" TEXT, subfaction TEXT, description TEXT, "abilityName" TEXT, "abilityDescription" TEXT, edition TEXT, "sourceBook" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- Datasheet (references Faction) - Note: boolean columns need casting
INSERT INTO "Datasheet" (id, name, faction, "factionId", subfaction, role, keywords, movement, toughness, save, "invulnerableSave", wounds, leadership, "objectiveControl", composition, "compositionData", "unitSize", "leaderRules", "leaderAbilities", "transportCapacity", "pointsCost", "pointsTiers", edition, "sourceBook", version, "lastUpdated", "createdAt", "competitiveTier", "tierReasoning", "bestTargets", counters, synergies, "playstyleNotes", "deploymentTips", "competitiveNotes", "contextLastAggregated", "contextSourceCount", "contextConflicts", "isOfficial", "ownerId", "forkedFromId", "currentVersion", visibility, "shareToken", "isEnabled")
SELECT id, name, faction, "factionId", subfaction, role, keywords, movement, toughness, save, "invulnerableSave", wounds, leadership, "objectiveControl", composition, "compositionData", "unitSize", "leaderRules", "leaderAbilities", "transportCapacity", "pointsCost", "pointsTiers", edition, "sourceBook", version, "lastUpdated", "createdAt", "competitiveTier", "tierReasoning", "bestTargets", counters, synergies, "playstyleNotes", "deploymentTips", "competitiveNotes", "contextLastAggregated", "contextSourceCount", "contextConflicts", 
  CASE WHEN "isOfficial" = 'true' THEN true ELSE false END,
  "ownerId", "forkedFromId", "currentVersion", visibility, "shareToken",
  CASE WHEN "isEnabled" = 'true' THEN true ELSE false END
FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, name, faction, "factionId", subfaction, role, keywords, movement, toughness, save, "invulnerableSave", wounds, leadership, "objectiveControl", composition, "compositionData", "unitSize", "leaderRules", "leaderAbilities", "transportCapacity", "pointsCost", "pointsTiers", edition, "sourceBook", version, "lastUpdated", "createdAt", "competitiveTier", "tierReasoning", "bestTargets", counters, synergies, "playstyleNotes", "deploymentTips", "competitiveNotes", "contextLastAggregated", "contextSourceCount", "contextConflicts", "isOfficial"::text, "ownerId", "forkedFromId", "currentVersion", visibility, "shareToken", "isEnabled"::text FROM "Datasheet"$$
) AS t(id TEXT, name TEXT, faction TEXT, "factionId" TEXT, subfaction TEXT, role TEXT, keywords TEXT, movement TEXT, toughness INT, save TEXT, "invulnerableSave" TEXT, wounds INT, leadership INT, "objectiveControl" INT, composition TEXT, "compositionData" TEXT, "unitSize" TEXT, "leaderRules" TEXT, "leaderAbilities" TEXT, "transportCapacity" TEXT, "pointsCost" INT, "pointsTiers" TEXT, edition TEXT, "sourceBook" TEXT, version TEXT, "lastUpdated" TIMESTAMP, "createdAt" TIMESTAMP, "competitiveTier" TEXT, "tierReasoning" TEXT, "bestTargets" TEXT, counters TEXT, synergies TEXT, "playstyleNotes" TEXT, "deploymentTips" TEXT, "competitiveNotes" TEXT, "contextLastAggregated" TIMESTAMP, "contextSourceCount" INT, "contextConflicts" TEXT, "isOfficial" TEXT, "ownerId" TEXT, "forkedFromId" TEXT, "currentVersion" INT, visibility TEXT, "shareToken" TEXT, "isEnabled" TEXT);
```

**Copy junction tables:**

```sql
-- DatasheetWeapon
INSERT INTO "DatasheetWeapon"
SELECT id, "datasheetId", "weaponId", 
  CASE WHEN "isDefault" = 'true' THEN true ELSE false END,
  quantity, notes
FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, "datasheetId", "weaponId", "isDefault"::text, quantity, notes FROM "DatasheetWeapon"$$
) AS t(id TEXT, "datasheetId" TEXT, "weaponId" TEXT, "isDefault" TEXT, quantity TEXT, notes TEXT);

-- DatasheetAbility
INSERT INTO "DatasheetAbility"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, "datasheetId", "abilityId", source FROM "DatasheetAbility"$$
) AS t(id TEXT, "datasheetId" TEXT, "abilityId" TEXT, source TEXT);

-- DatasheetWargear
INSERT INTO "DatasheetWargear"
SELECT id, "datasheetId", "wargearOptionId",
  CASE WHEN "isExclusive" = 'true' THEN true ELSE false END,
  "group"
FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, "datasheetId", "wargearOptionId", "isExclusive"::text, "group" FROM "DatasheetWargear"$$
) AS t(id TEXT, "datasheetId" TEXT, "wargearOptionId" TEXT, "isExclusive" TEXT, "group" TEXT);

-- StratagemData
INSERT INTO "StratagemData"
SELECT id, name, faction, "factionId", subfaction, detachment, "detachmentId", "cpCost", type, "when", target, effect, restrictions, keywords, "triggerPhase", "triggerSubphase",
  CASE WHEN "isReactive" = 'true' THEN true ELSE false END,
  "requiredKeywords", "usageRestriction", "calculatorEffect", edition, "sourceBook", "createdAt", "updatedAt"
FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, name, faction, "factionId", subfaction, detachment, "detachmentId", "cpCost", type, "when", target, effect, restrictions, keywords, "triggerPhase", "triggerSubphase", "isReactive"::text, "requiredKeywords", "usageRestriction", "calculatorEffect", edition, "sourceBook", "createdAt", "updatedAt" FROM "StratagemData"$$
) AS t(id TEXT, name TEXT, faction TEXT, "factionId" TEXT, subfaction TEXT, detachment TEXT, "detachmentId" TEXT, "cpCost" INT, type TEXT, "when" TEXT, target TEXT, effect TEXT, restrictions TEXT, keywords TEXT, "triggerPhase" TEXT, "triggerSubphase" TEXT, "isReactive" TEXT, "requiredKeywords" TEXT, "usageRestriction" TEXT, "calculatorEffect" JSONB, edition TEXT, "sourceBook" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- Enhancement
INSERT INTO "Enhancement"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, name, faction, "factionId", subfaction, detachment, "detachmentId", "pointsCost", description, restrictions, keywords, edition, "sourceBook", "createdAt", "updatedAt" FROM "Enhancement"$$
) AS t(id TEXT, name TEXT, faction TEXT, "factionId" TEXT, subfaction TEXT, detachment TEXT, "detachmentId" TEXT, "pointsCost" INT, description TEXT, restrictions TEXT, keywords TEXT, edition TEXT, "sourceBook" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- FactionRule
INSERT INTO "FactionRule"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, name, faction, "factionId", subfaction, type, description, "abilityId", edition, "sourceBook", "createdAt", "updatedAt" FROM "FactionRule"$$
) AS t(id TEXT, name TEXT, faction TEXT, "factionId" TEXT, subfaction TEXT, type TEXT, description TEXT, "abilityId" TEXT, edition TEXT, "sourceBook" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);

-- GlobalUnitIcon
INSERT INTO "GlobalUnitIcon"
SELECT * FROM dblink(
  'postgresql://postgres.qzpsnwhjztydbbgcufrk:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  $$SELECT id, "unitName", faction, "datasheetId", bucket, path, "createdAt", "updatedAt" FROM "GlobalUnitIcon"$$
) AS t(id TEXT, "unitName" TEXT, faction TEXT, "datasheetId" TEXT, bucket TEXT, path TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP);
```

### Step 4: Verify migration

```sql
SELECT 
  'User' as tbl, COUNT(*) as cnt FROM "User"
UNION ALL SELECT 'Faction', COUNT(*) FROM "Faction"
UNION ALL SELECT 'Weapon', COUNT(*) FROM "Weapon"
UNION ALL SELECT 'Ability', COUNT(*) FROM "Ability"
UNION ALL SELECT 'WargearOption', COUNT(*) FROM "WargearOption"
UNION ALL SELECT 'CoreStratagem', COUNT(*) FROM "CoreStratagem"
UNION ALL SELECT 'Detachment', COUNT(*) FROM "Detachment"
UNION ALL SELECT 'Datasheet', COUNT(*) FROM "Datasheet"
UNION ALL SELECT 'DatasheetWeapon', COUNT(*) FROM "DatasheetWeapon"
UNION ALL SELECT 'DatasheetAbility', COUNT(*) FROM "DatasheetAbility"
UNION ALL SELECT 'DatasheetWargear', COUNT(*) FROM "DatasheetWargear"
UNION ALL SELECT 'StratagemData', COUNT(*) FROM "StratagemData"
UNION ALL SELECT 'Enhancement', COUNT(*) FROM "Enhancement"
UNION ALL SELECT 'FactionRule', COUNT(*) FROM "FactionRule"
UNION ALL SELECT 'GlobalUnitIcon', COUNT(*) FROM "GlobalUnitIcon"
ORDER BY tbl;
```

**Expected counts (as of Jan 2026):**
| Table | Rows |
|-------|------|
| User | 1 |
| Faction | 26 |
| Weapon | 643 |
| Ability | 563 |
| WargearOption | 2039 |
| CoreStratagem | 11 |
| Detachment | 167 |
| Datasheet | 222 |
| DatasheetWeapon | 1191 |
| DatasheetAbility | 907 |
| DatasheetWargear | 486 |
| StratagemData | 982 |
| Enhancement | 662 |
| FactionRule | 40 |
| GlobalUnitIcon | 62 |

## Why dblink Instead of Prisma Scripts?

Previous attempts to use Prisma-based TypeScript scripts failed due to:

1. **Direct connection blocked**: Supabase blocks direct database connections (port 5432) from external networks
2. **Pooler authentication issues**: The transaction pooler (port 6543) returned "Tenant or user not found" errors with Prisma

The `dblink` approach works because:
- It runs **inside** PostgreSQL, bypassing external network restrictions
- It uses the pooler connection which is accessible from within Supabase's network
- It's executed via Supabase's SQL Editor or MCP tools which have proper authentication

## Using Cursor's Supabase MCP Tools

If you have Cursor with Supabase MCP configured, you can run these migrations directly:

1. Use `mcp_Supabase_execute_sql` to run the TRUNCATE command on dev
2. Use `mcp_Supabase_execute_sql` to run each INSERT...dblink command on dev
3. Use `mcp_Supabase_execute_sql` to verify counts

This is the fastest method as it doesn't require manual copy-paste in the SQL Editor.

## Notes

- **Boolean columns**: PostgreSQL's dblink returns booleans as text, so use `CASE WHEN col = 'true' THEN true ELSE false END` for boolean columns
- **Order matters**: Copy base tables (User, Faction, Weapon, etc.) before tables with foreign keys
- **User authentication**: Copying the `User` table copies the database record, but the user won't be able to authenticate unless they also exist in the destination project's Supabase Auth
