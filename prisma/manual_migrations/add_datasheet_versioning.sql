-- Migration: Add Datasheet Versioning and Sharing
-- Run this SQL manually if prisma migrate is not working due to drift

-- Add new columns to Army table
ALTER TABLE "Army" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "Army" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Army_shareToken_key" ON "Army"("shareToken");
CREATE INDEX IF NOT EXISTS "Army_visibility_idx" ON "Army"("visibility");

-- Add new columns to Datasheet table
ALTER TABLE "Datasheet" ADD COLUMN IF NOT EXISTS "isOfficial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Datasheet" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Datasheet" ADD COLUMN IF NOT EXISTS "forkedFromId" TEXT;
ALTER TABLE "Datasheet" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Datasheet" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "Datasheet" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;

-- Add foreign keys for Datasheet
ALTER TABLE "Datasheet" ADD CONSTRAINT "Datasheet_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Datasheet" ADD CONSTRAINT "Datasheet_forkedFromId_fkey" 
  FOREIGN KEY ("forkedFromId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for Datasheet
CREATE UNIQUE INDEX IF NOT EXISTS "Datasheet_shareToken_key" ON "Datasheet"("shareToken");
CREATE INDEX IF NOT EXISTS "Datasheet_ownerId_idx" ON "Datasheet"("ownerId");
CREATE INDEX IF NOT EXISTS "Datasheet_isOfficial_idx" ON "Datasheet"("isOfficial");
CREATE INDEX IF NOT EXISTS "Datasheet_visibility_idx" ON "Datasheet"("visibility");
CREATE INDEX IF NOT EXISTS "Datasheet_forkedFromId_idx" ON "Datasheet"("forkedFromId");

-- Drop old unique constraint and add new one that includes ownerId
-- Note: You may need to adjust this based on your existing constraint name
ALTER TABLE "Datasheet" DROP CONSTRAINT IF EXISTS "Datasheet_name_faction_subfaction_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Datasheet_name_faction_subfaction_ownerId_key" 
  ON "Datasheet"("name", "faction", "subfaction", "ownerId");

-- Create DatasheetVersion table
CREATE TABLE IF NOT EXISTS "DatasheetVersion" (
  "id" TEXT NOT NULL,
  "datasheetId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionLabel" TEXT,
  "snapshotData" TEXT NOT NULL,
  "changelog" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "DatasheetVersion_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for DatasheetVersion
ALTER TABLE "DatasheetVersion" ADD CONSTRAINT "DatasheetVersion_datasheetId_fkey" 
  FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatasheetVersion" ADD CONSTRAINT "DatasheetVersion_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for DatasheetVersion
CREATE UNIQUE INDEX IF NOT EXISTS "DatasheetVersion_datasheetId_versionNumber_key" 
  ON "DatasheetVersion"("datasheetId", "versionNumber");
CREATE INDEX IF NOT EXISTS "DatasheetVersion_datasheetId_idx" ON "DatasheetVersion"("datasheetId");
CREATE INDEX IF NOT EXISTS "DatasheetVersion_createdById_idx" ON "DatasheetVersion"("createdById");

-- Mark all existing datasheets as official (since they came from admin imports)
UPDATE "Datasheet" SET "isOfficial" = true, "visibility" = 'public' WHERE "ownerId" IS NULL;
