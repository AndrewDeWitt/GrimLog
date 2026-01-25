-- Migration: Add GlobalUnitIcon for globally shared unit icons
-- Purpose: Store global unit icon mappings (faction+unitName) pointing to Supabase Storage objects.
-- Notes:
-- - Uses text IDs (Prisma generates UUIDs in app code).
-- - Bucket defaults to 'unit-icons'.

CREATE TABLE IF NOT EXISTS "GlobalUnitIcon" (
  "id" TEXT NOT NULL,
  "datasheetId" TEXT,
  "unitName" TEXT NOT NULL,
  "faction" TEXT NOT NULL,
  "bucket" TEXT NOT NULL DEFAULT 'unit-icons',
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GlobalUnitIcon_pkey" PRIMARY KEY ("id")
);

-- Foreign key to Datasheet
DO $$
BEGIN
  ALTER TABLE "GlobalUnitIcon"
    ADD CONSTRAINT "GlobalUnitIcon_datasheetId_fkey"
    FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Unique mapping per unit identity (global)
CREATE UNIQUE INDEX IF NOT EXISTS "GlobalUnitIcon_faction_unitName_key"
  ON "GlobalUnitIcon"("faction", "unitName");

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "GlobalUnitIcon_datasheetId_idx" ON "GlobalUnitIcon"("datasheetId");
CREATE INDEX IF NOT EXISTS "GlobalUnitIcon_faction_idx" ON "GlobalUnitIcon"("faction");


