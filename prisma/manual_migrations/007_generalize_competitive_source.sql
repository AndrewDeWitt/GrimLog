-- Migration: Generalize CompetitiveSource for webpage support
-- Description: Renames YouTube-specific fields to generic names and adds sourceType field
-- Date: 2025-01-27

-- Step 1: Add new columns
ALTER TABLE "CompetitiveSource"
ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'youtube';

-- Step 2: Rename columns (if they exist with old names)
-- Note: These ALTER COLUMN RENAME commands will fail if columns don't exist
-- Run each one individually if needed

-- Rename youtubeUrl -> sourceUrl
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'CompetitiveSource' AND column_name = 'youtubeUrl') THEN
    ALTER TABLE "CompetitiveSource" RENAME COLUMN "youtubeUrl" TO "sourceUrl";
  END IF;
END $$;

-- Rename videoId -> sourceId
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'CompetitiveSource' AND column_name = 'videoId') THEN
    ALTER TABLE "CompetitiveSource" RENAME COLUMN "videoId" TO "sourceId";
  END IF;
END $$;

-- Rename videoTitle -> contentTitle
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'CompetitiveSource' AND column_name = 'videoTitle') THEN
    ALTER TABLE "CompetitiveSource" RENAME COLUMN "videoTitle" TO "contentTitle";
  END IF;
END $$;

-- Rename channelName -> authorName
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'CompetitiveSource' AND column_name = 'channelName') THEN
    ALTER TABLE "CompetitiveSource" RENAME COLUMN "channelName" TO "authorName";
  END IF;
END $$;

-- Rename channelId -> authorId
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'CompetitiveSource' AND column_name = 'channelId') THEN
    ALTER TABLE "CompetitiveSource" RENAME COLUMN "channelId" TO "authorId";
  END IF;
END $$;

-- Step 3: Update existing records to have sourceType = 'youtube'
UPDATE "CompetitiveSource" SET "sourceType" = 'youtube' WHERE "sourceType" IS NULL;

-- Step 4: Make sourceType NOT NULL now that all records have a value
ALTER TABLE "CompetitiveSource" ALTER COLUMN "sourceType" SET NOT NULL;

-- Step 5: Make sourceId nullable (it was required for YouTube but optional for other types)
ALTER TABLE "CompetitiveSource" ALTER COLUMN "sourceId" DROP NOT NULL;

-- Step 6: Update indexes
-- Drop old indexes
DROP INDEX IF EXISTS "CompetitiveSource_channelName_idx";
DROP INDEX IF EXISTS "CompetitiveSource_youtubeUrl_key";
DROP INDEX IF EXISTS "CompetitiveSource_videoId_key";

-- Create new indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitiveSource_sourceUrl_key" ON "CompetitiveSource"("sourceUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitiveSource_sourceId_key" ON "CompetitiveSource"("sourceId");
CREATE INDEX IF NOT EXISTS "CompetitiveSource_sourceType_idx" ON "CompetitiveSource"("sourceType");
CREATE INDEX IF NOT EXISTS "CompetitiveSource_authorName_idx" ON "CompetitiveSource"("authorName");

