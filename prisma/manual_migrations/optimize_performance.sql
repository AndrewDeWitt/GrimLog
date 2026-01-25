-- ============================================================================
-- Database Performance Optimization Migration
-- ============================================================================
-- This migration addresses three types of performance issues:
-- 1. Missing indexes on foreign keys (affects JOIN performance)
-- 2. Cleanup of truly unused/redundant indexes (reduces write overhead)
-- 3. General query performance improvements
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add Missing Foreign Key Indexes
-- ============================================================================
-- These foreign keys lack covering indexes, which impacts JOIN performance
-- and can cause slow cascading deletes.

-- Army.factionId - Used in faction lookups and JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Army_factionId_idx" 
  ON "Army" ("factionId");

-- Datasheet.factionId - Critical for faction-based filtering (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Datasheet_factionId_idx" 
  ON "Datasheet" ("factionId");

-- Enhancement.factionId - Used for faction enhancement lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Enhancement_factionId_idx" 
  ON "Enhancement" ("factionId");

-- FactionRule.abilityId - Used for ability lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FactionRule_abilityId_idx" 
  ON "FactionRule" ("abilityId");

-- FactionRule.factionId - Used for faction rule queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FactionRule_factionId_idx" 
  ON "FactionRule" ("factionId");

-- GameSession.attackerArmyId - Used for session->army JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GameSession_attackerArmyId_idx" 
  ON "GameSession" ("attackerArmyId");

-- Stratagem.armyId - Used for army->stratagems lookups (common in army list)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Stratagem_armyId_idx" 
  ON "Stratagem" ("armyId");

-- StratagemData.factionId - Used for faction stratagem queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StratagemData_factionId_idx" 
  ON "StratagemData" ("factionId");

-- Datasheet.forkedFromId - Self-reference for forked datasheets
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Datasheet_forkedFromId_idx" 
  ON "Datasheet" ("forkedFromId");

-- Datasheet.ownerId - For user ownership lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Datasheet_ownerId_idx" 
  ON "Datasheet" ("ownerId");

-- DatasheetVersion.createdById - For version creator lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DatasheetVersion_createdById_idx" 
  ON "DatasheetVersion" ("createdById");

-- GameSession.defenderArmyId - For defender army JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GameSession_defenderArmyId_idx" 
  ON "GameSession" ("defenderArmyId");

-- ============================================================================
-- SECTION 2: Drop Redundant/Low-Value Indexes
-- ============================================================================
-- These indexes are marked as unused and provide little value:
-- - Low-cardinality columns (visibility, type, category)
-- - Compound indexes superseded by simpler ones
-- - Indexes on rarely-queried columns
--
-- NOTE: We're being conservative - keeping indexes that support:
-- - RLS policy lookups (userId, armyId, gameSessionId)
-- - Primary foreign key relationships
-- - Common search patterns

-- Low-cardinality indexes (few distinct values = index not useful)
DROP INDEX CONCURRENTLY IF EXISTS "Army_visibility_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Datasheet_visibility_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Datasheet_isOfficial_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Datasheet_isEnabled_idx";
DROP INDEX CONCURRENTLY IF EXISTS "FactionRule_type_idx";
DROP INDEX CONCURRENTLY IF EXISTS "DetachmentRule_type_idx";
DROP INDEX CONCURRENTLY IF EXISTS "SecondaryObjective_type_idx";
DROP INDEX CONCURRENTLY IF EXISTS "SecondaryObjective_category_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Ability_type_idx";
DROP INDEX CONCURRENTLY IF EXISTS "ValidationEvent_severity_wasOverridden_idx";

-- Redundant compound indexes (covered by simpler indexes or FK constraints)
DROP INDEX CONCURRENTLY IF EXISTS "AttachmentPreset_armyId_isDefault_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Detachment_faction_subfaction_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Datasheet_faction_subfaction_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Enhancement_faction_subfaction_idx";
DROP INDEX CONCURRENTLY IF EXISTS "StratagemData_faction_subfaction_idx";
DROP INDEX CONCURRENTLY IF EXISTS "FactionRule_faction_subfaction_idx";
DROP INDEX CONCURRENTLY IF EXISTS "DetachmentRule_faction_detachmentName_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GameRule_ruleType_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GameRule_sourceId_sourceVersion_idx";

-- Unused name lookup indexes (text search on these is rare)
DROP INDEX CONCURRENTLY IF EXISTS "Datasheet_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "SecondaryObjective_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Weapon_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Ability_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "StratagemData_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "CoreStratagem_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "PrimaryMission_name_idx";

-- NOTE: Do NOT drop these - they're needed for FK performance
-- Datasheet_ownerId_idx - Covers Datasheet_ownerId_fkey
-- Datasheet_forkedFromId_idx - Covers Datasheet_forkedFromId_fkey
-- DatasheetVersion_createdById_idx - Covers DatasheetVersion_createdById_fkey

-- GlobalUnitIcon indexes (rarely queried by these columns)
DROP INDEX CONCURRENTLY IF EXISTS "GlobalUnitIcon_faction_idx";

-- ============================================================================
-- SECTION 3: Keep Critical Indexes
-- ============================================================================
-- The following indexes are marked as "unused" by the linter but are
-- CRITICAL for RLS policy performance and should NOT be dropped:
--
-- - Army_userId_idx: RLS policy uses userId for access control
-- - Army_playerId_idx: Army->Player relationship
-- - Player_userId_idx: RLS policy uses userId
-- - UnitIcon_userId_idx: RLS policy uses userId
-- - ObjectiveMarker_gameSessionId_idx: RLS policy uses gameSessionId
-- - SecondaryProgress_gameSessionId_idx: RLS policy uses gameSessionId
-- - AttachmentPreset_armyId_idx: RLS policy uses armyId
-- - Unit_armyId_idx: RLS policy uses armyId
-- - GameSession_userId_idx: RLS policy uses userId
--
-- These may show as "unused" because:
-- 1. PostgreSQL stats haven't recorded enough queries yet
-- 2. Table sizes are small enough that seq scans are faster
-- 3. RLS uses EXISTS subqueries which may not register in pg_stat_user_indexes
--
-- As the database grows, these indexes become critical.

-- ============================================================================
-- SECTION 4: Analyze Tables for Query Planner
-- ============================================================================
-- Update table statistics so the query planner makes optimal decisions

ANALYZE "Army";
ANALYZE "Unit";
ANALYZE "GameSession";
ANALYZE "UnitInstance";
ANALYZE "TimelineEvent";
ANALYZE "Datasheet";
ANALYZE "Faction";
ANALYZE "Stratagem";
ANALYZE "StratagemData";
ANALYZE "Enhancement";
ANALYZE "FactionRule";
ANALYZE "DetachmentRule";
ANALYZE "Player";
ANALYZE "AttachmentPreset";
ANALYZE "ObjectiveMarker";
ANALYZE "SecondaryProgress";
ANALYZE "TranscriptHistory";
ANALYZE "ValidationEvent";
ANALYZE "StratagemLog";
ANALYZE "CombatLog";
ANALYZE "CPTransaction";
ANALYZE "RevertAction";

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Summary of changes:
-- + 12 new indexes added for unindexed foreign keys
-- - ~22 redundant/low-value indexes removed
-- = Net reduction in write overhead while improving JOIN performance
-- ============================================================================

