-- Token Economy System Migration
-- Adds token balance, feature pricing, and transaction ledger

-- =============================================
-- 1. Rename briefCredits to tokenBalance on User table
-- =============================================
ALTER TABLE "User" RENAME COLUMN "briefCredits" TO "tokenBalance";

-- Update default value (new users start with 0 tokens instead of 2 free credits)
ALTER TABLE "User" ALTER COLUMN "tokenBalance" SET DEFAULT 0;

-- =============================================
-- 2. Add accessStatus column to User table
-- =============================================
ALTER TABLE "User" ADD COLUMN "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- =============================================
-- 3. Create FeatureCost table (dynamic pricing)
-- =============================================
CREATE TABLE "FeatureCost" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "tokenCost" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureCost_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on featureKey
CREATE UNIQUE INDEX "FeatureCost_featureKey_key" ON "FeatureCost"("featureKey");

-- Index for active features
CREATE INDEX "FeatureCost_isActive_idx" ON "FeatureCost"("isActive");

-- =============================================
-- 4. Create TokenLedger table (transaction history)
-- =============================================
CREATE TABLE "TokenLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionType" TEXT NOT NULL,
    "featureKey" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLedger_pkey" PRIMARY KEY ("id")
);

-- Foreign key to User
ALTER TABLE "TokenLedger" ADD CONSTRAINT "TokenLedger_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key to FeatureCost (nullable)
ALTER TABLE "TokenLedger" ADD CONSTRAINT "TokenLedger_featureKey_fkey" 
    FOREIGN KEY ("featureKey") REFERENCES "FeatureCost"("featureKey") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for efficient queries
CREATE INDEX "TokenLedger_userId_createdAt_idx" ON "TokenLedger"("userId", "createdAt");
CREATE INDEX "TokenLedger_featureKey_idx" ON "TokenLedger"("featureKey");
CREATE INDEX "TokenLedger_transactionType_idx" ON "TokenLedger"("transactionType");

-- =============================================
-- 5. Seed initial feature costs
-- =============================================
INSERT INTO "FeatureCost" ("id", "featureKey", "tokenCost", "displayName", "description", "isActive", "createdAt", "updatedAt")
VALUES 
    (gen_random_uuid()::text, 'generate_brief', 3, 'Deep Tactical Brief', 'AI-powered strategic analysis of your army list with matchup insights and tactical recommendations', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'list_check_quick', 1, 'Quick List Check', 'Fast validation and basic analysis of your army list (future feature)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'matchup_simulator', 5, 'Matchup Simulator', 'Detailed matchup simulation against specific opponent armies (future feature)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'spirit_icon', 2, 'Army Spirit Icon', 'AI-generated custom icon representing your army''s spirit and theme', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =============================================
-- 6. Create legacy balance migration ledger entries
-- =============================================
-- For existing users with tokens, create a GRANT ledger entry to document the migration
INSERT INTO "TokenLedger" ("id", "userId", "amount", "transactionType", "description", "createdAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    "tokenBalance",
    'GRANT',
    'Legacy balance migration from briefCredits',
    CURRENT_TIMESTAMP
FROM "User"
WHERE "tokenBalance" > 0;
