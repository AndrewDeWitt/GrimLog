-- Migration: Add AttachmentPreset for battle-ready attachment loadouts
-- Purpose:
-- - Persist multiple named attachment presets per Army (e.g., "vs_elite", "vs_horde")
-- - Allow selecting a default preset and applying/tweaking before a session
--
-- Notes:
-- - Uses text IDs (Prisma generates UUIDs in app code).
-- - attachmentsJson stores a JSON object mapping { "<characterUnitId>": "<targetUnitName>" }.

CREATE TABLE IF NOT EXISTS "AttachmentPreset" (
  "id" TEXT NOT NULL,
  "armyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "attachmentsJson" TEXT NOT NULL DEFAULT '{}',
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AttachmentPreset_pkey" PRIMARY KEY ("id")
);

-- Foreign key to Army
DO $$
BEGIN
  ALTER TABLE "AttachmentPreset"
    ADD CONSTRAINT "AttachmentPreset_armyId_fkey"
    FOREIGN KEY ("armyId") REFERENCES "Army"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One preset name per army
CREATE UNIQUE INDEX IF NOT EXISTS "AttachmentPreset_armyId_name_key"
  ON "AttachmentPreset"("armyId", "name");

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "AttachmentPreset_armyId_idx" ON "AttachmentPreset"("armyId");
CREATE INDEX IF NOT EXISTS "AttachmentPreset_armyId_isDefault_idx" ON "AttachmentPreset"("armyId", "isDefault");


