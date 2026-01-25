-- Add dossierCredits field to User model
-- This migration adds a credits system for dossier generation
-- New users get 2 free credits by default

-- Add the column with default value
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "dossierCredits" INTEGER NOT NULL DEFAULT 2;

-- Comment explaining the field
COMMENT ON COLUMN "User"."dossierCredits" IS 'Number of dossier generations remaining. Default is 2 for new users. Admins bypass this check.';

