-- ============================================================================
-- Additional Composite Indexes for Query Optimization
-- ============================================================================
-- These indexes optimize common query patterns identified in API routes.
-- Applied: 2024-12-22

-- GameSession: Common query for user's active sessions
-- Used in: /api/sessions (GET) - list active sessions for user
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GameSession_userId_isActive_idx" 
  ON "GameSession" ("userId", "isActive")
  WHERE "isActive" = true;

-- UnitInstance: Common query for alive units in a session
-- Used in: /api/sessions/[id]/units - get active units
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UnitInstance_gameSessionId_isDestroyed_idx" 
  ON "UnitInstance" ("gameSessionId", "isDestroyed")
  WHERE "isDestroyed" = false;

-- StratagemData: Faction + Detachment lookup (very common for army building)
-- Used in: /api/armies/[id], /api/stratagems/[faction]
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StratagemData_factionId_detachment_idx" 
  ON "StratagemData" ("factionId", "detachment");

-- Enhancement: Faction + Detachment lookup
-- Used in: /api/factions/[id]/detachments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Enhancement_factionId_detachment_idx" 
  ON "Enhancement" ("factionId", "detachment");

-- GlobalUnitIcon: Fast lookup by faction + unitName (used in icon resolution)
-- Used in: /api/datasheets (icon resolution loop)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GlobalUnitIcon_faction_unitName_idx" 
  ON "GlobalUnitIcon" ("faction", "unitName");

-- Datasheet: Faction + role lookup (common in army builder)
-- Used in: /api/datasheets?factionId=X&role=Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Datasheet_factionId_role_idx" 
  ON "Datasheet" ("factionId", "role");

-- Update statistics for query planner
ANALYZE "GameSession";
ANALYZE "UnitInstance";
ANALYZE "StratagemData";
ANALYZE "Enhancement";
ANALYZE "GlobalUnitIcon";
ANALYZE "Datasheet";

-- ============================================================================
-- Migration Complete
-- ============================================================================



