# Enable Row Level Security (RLS)

## Overview

Row Level Security ensures users can only access their own data. This is critical for production security.

## Tables to Secure

- `Army` - Users should only see their own armies
- `GameSession` - Users should only see their own sessions (or shared ones)
- `UnitIcon` - Users should only see their own icons
- `Unit` - Users should only see units in their own armies
- `Stratagem` - Users should only see stratagems in their own armies

## Enable RLS

Run these SQL commands in Supabase SQL Editor for **PRODUCTION** database:

```sql
-- Enable RLS on Army table
ALTER TABLE "Army" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own armies"
  ON "Army" FOR SELECT
  USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create their own armies"
  ON "Army" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own armies"
  ON "Army" FOR UPDATE
  USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete their own armies"
  ON "Army" FOR DELETE
  USING (auth.uid()::text = "userId");

-- Enable RLS on GameSession table
ALTER TABLE "GameSession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON "GameSession" FOR SELECT
  USING (
    auth.uid()::text = "userId" 
    OR "userId" = ANY(SELECT jsonb_array_elements_text("sharedWith"::jsonb))
  );

CREATE POLICY "Users can create their own sessions"
  ON "GameSession" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own sessions"
  ON "GameSession" FOR UPDATE
  USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete their own sessions"
  ON "GameSession" FOR DELETE
  USING (auth.uid()::text = "userId");

-- Enable RLS on UnitIcon table
ALTER TABLE "UnitIcon" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own icons"
  ON "UnitIcon" FOR SELECT
  USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create their own icons"
  ON "UnitIcon" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own icons"
  ON "UnitIcon" FOR UPDATE
  USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete their own icons"
  ON "UnitIcon" FOR DELETE
  USING (auth.uid()::text = "userId");

-- Enable RLS on Unit table (via Army relationship)
ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view units in their armies"
  ON "Unit" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Army" 
      WHERE "Army".id = "Unit"."armyId" 
      AND "Army"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can create units in their armies"
  ON "Unit" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Army" 
      WHERE "Army".id = "Unit"."armyId" 
      AND "Army"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update units in their armies"
  ON "Unit" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Army" 
      WHERE "Army".id = "Unit"."armyId" 
      AND "Army"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete units in their armies"
  ON "Unit" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "Army" 
      WHERE "Army".id = "Unit"."armyId" 
      AND "Army"."userId" = auth.uid()::text
    )
  );

-- Enable RLS on Stratagem table (via Army relationship)
ALTER TABLE "Stratagem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stratagems in their armies"
  ON "Stratagem" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Army" 
      WHERE "Army".id = "Stratagem"."armyId" 
      AND "Army"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can manage stratagems in their armies"
  ON "Stratagem" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Army" 
      WHERE "Army".id = "Stratagem"."armyId" 
      AND "Army"."userId" = auth.uid()::text
    )
  );
```

## Verify RLS is Working

After enabling RLS, test that:
1. Users can only see their own armies
2. Users can only see their own game sessions
3. Users cannot access other users' data
4. Shared sessions work correctly (if `sharedWith` contains user ID)

## Important Notes

- RLS policies use `auth.uid()::text` because Supabase Auth UUIDs are stored as text in Prisma
- The `sharedWith` field in GameSession is a JSON array, so we use `jsonb_array_elements_text` to check membership
- Reference data tables (Faction, Weapon, Datasheet, etc.) do NOT need RLS - they're public read-only data


