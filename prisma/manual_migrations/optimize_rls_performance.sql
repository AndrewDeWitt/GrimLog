-- ============================================================================
-- RLS Performance Optimization Migration
-- ============================================================================
-- This migration fixes two types of Supabase RLS performance issues:
-- 1. auth_rls_initplan: Wraps auth.uid() in (select ...) for per-query caching
-- 2. multiple_permissive_policies: Removes overlapping SELECT policies
-- ============================================================================

-- ============================================================================
-- CATEGORY A: Reference Data Tables
-- Remove "Only admins can modify X" ALL policies (qual=false blocks everything
-- but causes overhead since ALL includes SELECT, creating duplicate policies)
-- Keep the "Anyone can view X" SELECT policies (no changes needed)
-- ============================================================================

DROP POLICY IF EXISTS "Only admins can modify abilities" ON "Ability";
DROP POLICY IF EXISTS "Only admins can modify core stratagems" ON "CoreStratagem";
DROP POLICY IF EXISTS "Only admins can modify datasheets" ON "Datasheet";
DROP POLICY IF EXISTS "Only admins can modify datasheet abilities" ON "DatasheetAbility";
DROP POLICY IF EXISTS "Only admins can modify datasheet versions" ON "DatasheetVersion";
DROP POLICY IF EXISTS "Only admins can modify datasheet wargear" ON "DatasheetWargear";
DROP POLICY IF EXISTS "Only admins can modify datasheet weapons" ON "DatasheetWeapon";
DROP POLICY IF EXISTS "Only admins can modify detachments" ON "Detachment";
DROP POLICY IF EXISTS "Only admins can modify detachment rules" ON "DetachmentRule";
DROP POLICY IF EXISTS "Only admins can modify enhancements" ON "Enhancement";
DROP POLICY IF EXISTS "Only admins can modify factions" ON "Faction";
DROP POLICY IF EXISTS "Only admins can modify faction rules" ON "FactionRule";
DROP POLICY IF EXISTS "Only admins can modify game rules" ON "GameRule";
DROP POLICY IF EXISTS "Only admins can modify global unit icons" ON "GlobalUnitIcon";
DROP POLICY IF EXISTS "Only admins can modify primary missions" ON "PrimaryMission";
DROP POLICY IF EXISTS "Only admins can modify secondary objectives" ON "SecondaryObjective";
DROP POLICY IF EXISTS "Only admins can modify stratagem data" ON "StratagemData";
DROP POLICY IF EXISTS "Only admins can modify wargear options" ON "WargearOption";
DROP POLICY IF EXISTS "Only admins can modify weapons" ON "Weapon";

-- ============================================================================
-- CATEGORY B: Direct User Tables
-- Recreate policies with (select auth.uid()) instead of auth.uid()
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Army Table
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own armies" ON "Army";
DROP POLICY IF EXISTS "Users can create their own armies" ON "Army";
DROP POLICY IF EXISTS "Users can update their own armies" ON "Army";
DROP POLICY IF EXISTS "Users can delete their own armies" ON "Army";

CREATE POLICY "Users can view their own armies" ON "Army"
  FOR SELECT USING (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can create their own armies" ON "Army"
  FOR INSERT WITH CHECK (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can update their own armies" ON "Army"
  FOR UPDATE USING (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can delete their own armies" ON "Army"
  FOR DELETE USING (((select auth.uid()))::text = "userId");

-- ----------------------------------------------------------------------------
-- GameSession Table
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own sessions" ON "GameSession";
DROP POLICY IF EXISTS "Users can create their own sessions" ON "GameSession";
DROP POLICY IF EXISTS "Users can update their own sessions" ON "GameSession";
DROP POLICY IF EXISTS "Users can delete their own sessions" ON "GameSession";

CREATE POLICY "Users can view their own sessions" ON "GameSession"
  FOR SELECT USING (
    (((select auth.uid()))::text = "userId") 
    OR ("userId" IN (SELECT jsonb_array_elements_text("sharedWith"::jsonb)))
  );

CREATE POLICY "Users can create their own sessions" ON "GameSession"
  FOR INSERT WITH CHECK (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can update their own sessions" ON "GameSession"
  FOR UPDATE USING (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can delete their own sessions" ON "GameSession"
  FOR DELETE USING (((select auth.uid()))::text = "userId");

-- ----------------------------------------------------------------------------
-- UnitIcon Table
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own icons" ON "UnitIcon";
DROP POLICY IF EXISTS "Users can create their own icons" ON "UnitIcon";
DROP POLICY IF EXISTS "Users can update their own icons" ON "UnitIcon";
DROP POLICY IF EXISTS "Users can delete their own icons" ON "UnitIcon";

CREATE POLICY "Users can view their own icons" ON "UnitIcon"
  FOR SELECT USING (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can create their own icons" ON "UnitIcon"
  FOR INSERT WITH CHECK (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can update their own icons" ON "UnitIcon"
  FOR UPDATE USING (((select auth.uid()))::text = "userId");

CREATE POLICY "Users can delete their own icons" ON "UnitIcon"
  FOR DELETE USING (((select auth.uid()))::text = "userId");

-- ----------------------------------------------------------------------------
-- User Table
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own user record" ON "User";
DROP POLICY IF EXISTS "Users can update their own user record" ON "User";

CREATE POLICY "Users can view their own user record" ON "User"
  FOR SELECT USING (((select auth.uid()))::text = id);

CREATE POLICY "Users can update their own user record" ON "User"
  FOR UPDATE USING (((select auth.uid()))::text = id);

-- ----------------------------------------------------------------------------
-- Player Table
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own players" ON "Player";
DROP POLICY IF EXISTS "Users can create their own players" ON "Player";
DROP POLICY IF EXISTS "Users can update their own players" ON "Player";
DROP POLICY IF EXISTS "Users can delete their own players" ON "Player";

CREATE POLICY "Users can view their own players" ON "Player"
  FOR SELECT USING ((((select auth.uid()))::text = "userId") OR ("userId" IS NULL));

CREATE POLICY "Users can create their own players" ON "Player"
  FOR INSERT WITH CHECK ((((select auth.uid()))::text = "userId") OR ("userId" IS NULL));

CREATE POLICY "Users can update their own players" ON "Player"
  FOR UPDATE USING ((((select auth.uid()))::text = "userId") OR ("userId" IS NULL));

CREATE POLICY "Users can delete their own players" ON "Player"
  FOR DELETE USING ((((select auth.uid()))::text = "userId") OR ("userId" IS NULL));

-- ============================================================================
-- CATEGORY C: Child Tables with Subqueries
-- Fix auth.uid() wrapping in subqueries
-- Fix policy overlap by changing "manage ALL" to specific INSERT/UPDATE/DELETE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Unit Table (child of Army)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view units in their armies" ON "Unit";
DROP POLICY IF EXISTS "Users can create units in their armies" ON "Unit";
DROP POLICY IF EXISTS "Users can update units in their armies" ON "Unit";
DROP POLICY IF EXISTS "Users can delete units in their armies" ON "Unit";

CREATE POLICY "Users can view units in their armies" ON "Unit"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Unit"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can create units in their armies" ON "Unit"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Unit"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update units in their armies" ON "Unit"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Unit"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete units in their armies" ON "Unit"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Unit"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- Stratagem Table (child of Army)
-- Has overlapping "view SELECT" + "manage ALL" policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view stratagems in their armies" ON "Stratagem";
DROP POLICY IF EXISTS "Users can manage stratagems in their armies" ON "Stratagem";

CREATE POLICY "Users can view stratagems in their armies" ON "Stratagem"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Stratagem"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can insert stratagems in their armies" ON "Stratagem"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Stratagem"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update stratagems in their armies" ON "Stratagem"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Stratagem"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete stratagems in their armies" ON "Stratagem"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "Stratagem"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- AttachmentPreset Table (child of Army)
-- Has overlapping "view SELECT" + "manage ALL" policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view attachment presets in their armies" ON "AttachmentPreset";
DROP POLICY IF EXISTS "Users can manage attachment presets in their armies" ON "AttachmentPreset";

CREATE POLICY "Users can view attachment presets in their armies" ON "AttachmentPreset"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "AttachmentPreset"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can insert attachment presets in their armies" ON "AttachmentPreset"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "AttachmentPreset"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update attachment presets in their armies" ON "AttachmentPreset"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "AttachmentPreset"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete attachment presets in their armies" ON "AttachmentPreset"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "Army"
      WHERE "Army".id = "AttachmentPreset"."armyId"
      AND "Army"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- TimelineEvent Table (child of GameSession)
-- Has overlapping "view SELECT" + "manage ALL" policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view timeline events in their sessions" ON "TimelineEvent";
DROP POLICY IF EXISTS "Users can manage timeline events in their sessions" ON "TimelineEvent";

CREATE POLICY "Users can view timeline events in their sessions" ON "TimelineEvent"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "TimelineEvent"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can insert timeline events in their sessions" ON "TimelineEvent"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "TimelineEvent"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update timeline events in their sessions" ON "TimelineEvent"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "TimelineEvent"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete timeline events in their sessions" ON "TimelineEvent"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "TimelineEvent"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- TranscriptHistory Table (child of GameSession)
-- Only has SELECT + INSERT policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view transcripts in their sessions" ON "TranscriptHistory";
DROP POLICY IF EXISTS "Users can create transcripts in their sessions" ON "TranscriptHistory";

CREATE POLICY "Users can view transcripts in their sessions" ON "TranscriptHistory"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "TranscriptHistory"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can create transcripts in their sessions" ON "TranscriptHistory"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "TranscriptHistory"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- ObjectiveMarker Table (child of GameSession)
-- Has overlapping "view SELECT" + "manage ALL" policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view objective markers in their sessions" ON "ObjectiveMarker";
DROP POLICY IF EXISTS "Users can manage objective markers in their sessions" ON "ObjectiveMarker";

CREATE POLICY "Users can view objective markers in their sessions" ON "ObjectiveMarker"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "ObjectiveMarker"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can insert objective markers in their sessions" ON "ObjectiveMarker"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "ObjectiveMarker"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update objective markers in their sessions" ON "ObjectiveMarker"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "ObjectiveMarker"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete objective markers in their sessions" ON "ObjectiveMarker"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "ObjectiveMarker"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- UnitInstance Table (child of GameSession)
-- Has overlapping "view SELECT" + "manage ALL" policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view unit instances in their sessions" ON "UnitInstance";
DROP POLICY IF EXISTS "Users can manage unit instances in their sessions" ON "UnitInstance";

CREATE POLICY "Users can view unit instances in their sessions" ON "UnitInstance"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "UnitInstance"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can insert unit instances in their sessions" ON "UnitInstance"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "UnitInstance"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update unit instances in their sessions" ON "UnitInstance"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "UnitInstance"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete unit instances in their sessions" ON "UnitInstance"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "UnitInstance"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- ValidationEvent Table (child of GameSession)
-- Only has SELECT + INSERT policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view validation events in their sessions" ON "ValidationEvent";
DROP POLICY IF EXISTS "Users can create validation events in their sessions" ON "ValidationEvent";

CREATE POLICY "Users can view validation events in their sessions" ON "ValidationEvent"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "ValidationEvent"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can create validation events in their sessions" ON "ValidationEvent"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "ValidationEvent"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- StratagemLog Table (child of GameSession)
-- Only has SELECT + INSERT policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view stratagem logs in their sessions" ON "StratagemLog";
DROP POLICY IF EXISTS "Users can create stratagem logs in their sessions" ON "StratagemLog";

CREATE POLICY "Users can view stratagem logs in their sessions" ON "StratagemLog"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "StratagemLog"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can create stratagem logs in their sessions" ON "StratagemLog"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "StratagemLog"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- CombatLog Table (child of GameSession)
-- Only has SELECT + INSERT policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view combat logs in their sessions" ON "CombatLog";
DROP POLICY IF EXISTS "Users can create combat logs in their sessions" ON "CombatLog";

CREATE POLICY "Users can view combat logs in their sessions" ON "CombatLog"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "CombatLog"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can create combat logs in their sessions" ON "CombatLog"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "CombatLog"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- CPTransaction Table (child of GameSession)
-- Only has SELECT + INSERT policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view CP transactions in their sessions" ON "CPTransaction";
DROP POLICY IF EXISTS "Users can create CP transactions in their sessions" ON "CPTransaction";

CREATE POLICY "Users can view CP transactions in their sessions" ON "CPTransaction"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "CPTransaction"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can create CP transactions in their sessions" ON "CPTransaction"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "CPTransaction"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- SecondaryProgress Table (child of GameSession)
-- Has overlapping "view SELECT" + "manage ALL" policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view secondary progress in their sessions" ON "SecondaryProgress";
DROP POLICY IF EXISTS "Users can manage secondary progress in their sessions" ON "SecondaryProgress";

CREATE POLICY "Users can view secondary progress in their sessions" ON "SecondaryProgress"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "SecondaryProgress"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can insert secondary progress in their sessions" ON "SecondaryProgress"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "SecondaryProgress"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can update secondary progress in their sessions" ON "SecondaryProgress"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "SecondaryProgress"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

CREATE POLICY "Users can delete secondary progress in their sessions" ON "SecondaryProgress"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "SecondaryProgress"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ----------------------------------------------------------------------------
-- RevertAction Table (child of GameSession)
-- Only has SELECT + INSERT policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view revert actions in their sessions" ON "RevertAction";
DROP POLICY IF EXISTS "Users can create revert actions in their sessions" ON "RevertAction";

CREATE POLICY "Users can view revert actions in their sessions" ON "RevertAction"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "RevertAction"."gameSessionId"
      AND (
        "GameSession"."userId" = ((select auth.uid()))::text
        OR "GameSession"."userId" IN (SELECT jsonb_array_elements_text("GameSession"."sharedWith"::jsonb))
      )
    )
  );

CREATE POLICY "Users can create revert actions in their sessions" ON "RevertAction"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "GameSession"
      WHERE "GameSession".id = "RevertAction"."gameSessionId"
      AND "GameSession"."userId" = ((select auth.uid()))::text
    )
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================



