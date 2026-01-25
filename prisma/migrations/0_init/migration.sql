-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitIcon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datasheetId" TEXT,
    "unitName" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitIcon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalUnitIcon" (
    "id" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "datasheetId" TEXT,
    "bucket" TEXT NOT NULL DEFAULT 'unit-icons',
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalUnitIcon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaData" TEXT,
    "parentFactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Detachment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "factionId" TEXT,
    "subfaction" TEXT,
    "description" TEXT,
    "abilityName" TEXT,
    "abilityDescription" TEXT,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Detachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Army" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "playerId" TEXT,
    "userId" TEXT,
    "factionId" TEXT,
    "pointsLimit" INTEGER NOT NULL DEFAULT 2000,
    "characterAttachments" TEXT DEFAULT '{}',
    "detachment" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Army_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentPreset" (
    "id" TEXT NOT NULL,
    "armyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attachmentsJson" TEXT NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttachmentPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Datasheet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "factionId" TEXT,
    "subfaction" TEXT,
    "role" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "movement" TEXT NOT NULL,
    "toughness" INTEGER NOT NULL,
    "save" TEXT NOT NULL,
    "invulnerableSave" TEXT,
    "wounds" INTEGER NOT NULL,
    "leadership" INTEGER NOT NULL,
    "objectiveControl" INTEGER NOT NULL,
    "composition" TEXT NOT NULL,
    "compositionData" TEXT,
    "unitSize" TEXT,
    "leaderRules" TEXT,
    "leaderAbilities" TEXT,
    "transportCapacity" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "pointsTiers" TEXT,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "competitiveTier" TEXT,
    "tierReasoning" TEXT,
    "bestTargets" TEXT,
    "counters" TEXT,
    "synergies" TEXT,
    "playstyleNotes" TEXT,
    "deploymentTips" TEXT,
    "competitiveNotes" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "forkedFromId" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "shareToken" TEXT,

    CONSTRAINT "Datasheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasheetVersion" (
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

-- CreateTable
CREATE TABLE "Weapon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "attacks" TEXT NOT NULL,
    "ballisticSkill" TEXT,
    "weaponSkill" TEXT,
    "strength" TEXT NOT NULL,
    "armorPenetration" TEXT NOT NULL,
    "damage" TEXT NOT NULL,
    "abilities" TEXT NOT NULL,
    "strengthValue" INTEGER,
    "strengthFormula" TEXT,
    "damageValue" INTEGER,
    "damageFormula" TEXT,
    "apValue" INTEGER,
    "structuredAbilities" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Weapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasheetWeapon" (
    "id" TEXT NOT NULL,
    "datasheetId" TEXT NOT NULL,
    "weaponId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "quantity" TEXT,
    "notes" TEXT,

    CONSTRAINT "DatasheetWeapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT,
    "phase" TEXT,
    "triggerPhase" TEXT,
    "triggerSubphase" TEXT,
    "isReactive" BOOLEAN NOT NULL DEFAULT false,
    "requiredKeywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasheetAbility" (
    "id" TEXT NOT NULL,
    "datasheetId" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'unit',

    CONSTRAINT "DatasheetAbility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WargearOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WargearOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasheetWargear" (
    "id" TEXT NOT NULL,
    "datasheetId" TEXT NOT NULL,
    "wargearOptionId" TEXT NOT NULL,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "group" TEXT,

    CONSTRAINT "DatasheetWargear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "factionId" TEXT,
    "subfaction" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "abilityId" TEXT,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetachmentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "subfaction" TEXT,
    "detachmentName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pointsCost" INTEGER,
    "restrictions" TEXT,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetachmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StratagemData" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "factionId" TEXT,
    "subfaction" TEXT,
    "detachment" TEXT,
    "detachmentId" TEXT,
    "cpCost" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "restrictions" TEXT,
    "keywords" TEXT,
    "triggerPhase" TEXT,
    "triggerSubphase" TEXT,
    "isReactive" BOOLEAN NOT NULL DEFAULT false,
    "requiredKeywords" TEXT,
    "usageRestriction" TEXT,
    "calculatorEffect" JSONB,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StratagemData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoreStratagem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpCost" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "triggerPhase" TEXT,
    "triggerSubphase" TEXT,
    "isReactive" BOOLEAN NOT NULL DEFAULT false,
    "requiredKeywords" TEXT,
    "usageRestriction" TEXT,
    "isCalculatorRelevant" BOOLEAN NOT NULL DEFAULT false,
    "calculatorEffect" JSONB,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoreStratagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enhancement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "factionId" TEXT,
    "subfaction" TEXT,
    "detachment" TEXT,
    "detachmentId" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "restrictions" TEXT NOT NULL,
    "keywords" TEXT,
    "edition" TEXT NOT NULL DEFAULT '10th',
    "sourceBook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enhancement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "datasheet" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "goal" TEXT,
    "armyId" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "modelCount" INTEGER NOT NULL DEFAULT 1,
    "composition" TEXT,
    "wargear" TEXT,
    "enhancements" TEXT,
    "weapons" TEXT,
    "abilities" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "datasheetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stratagem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpCost" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "armyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stratagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "attackerArmyId" TEXT,
    "defenderArmyId" TEXT,
    "userId" TEXT,
    "sharedWith" TEXT DEFAULT '[]',
    "defenderName" TEXT,
    "defenderFaction" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "currentPhase" TEXT NOT NULL DEFAULT 'Command',
    "currentTurn" TEXT NOT NULL DEFAULT 'attacker',
    "battleRound" INTEGER NOT NULL DEFAULT 1,
    "deploymentType" TEXT NOT NULL DEFAULT 'crucible-of-battle',
    "firstTurn" TEXT NOT NULL DEFAULT 'attacker',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "attackerCommandPoints" INTEGER NOT NULL DEFAULT 0,
    "defenderCommandPoints" INTEGER NOT NULL DEFAULT 0,
    "attackerVictoryPoints" INTEGER NOT NULL DEFAULT 0,
    "defenderVictoryPoints" INTEGER NOT NULL DEFAULT 0,
    "attackerSecondaries" TEXT,
    "defenderSecondaries" TEXT,
    "attackerSecondaryProgress" TEXT,
    "defenderSecondaryProgress" TEXT,
    "attackerDiscardedSecondaries" TEXT DEFAULT '[]',
    "defenderDiscardedSecondaries" TEXT DEFAULT '[]',
    "attackerDeckHistory" TEXT DEFAULT '[]',
    "defenderDeckHistory" TEXT DEFAULT '[]',
    "attackerMissionMode" TEXT DEFAULT 'tactical',
    "defenderMissionMode" TEXT DEFAULT 'tactical',
    "attackerTargetSelections" TEXT,
    "defenderTargetSelections" TEXT,
    "attackerExtraCPGainedThisTurn" BOOLEAN NOT NULL DEFAULT false,
    "defenderExtraCPGainedThisTurn" BOOLEAN NOT NULL DEFAULT false,
    "primaryMissionId" TEXT,
    "primaryVPScored" JSONB,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "phase" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "isReverted" BOOLEAN NOT NULL DEFAULT false,
    "revertedAt" TIMESTAMP(3),
    "revertedBy" TEXT,
    "revertReason" TEXT,
    "revertedEventId" TEXT,
    "cascadedFrom" TEXT,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptHistory" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "audioLength" DOUBLE PRECISION,
    "segments" TEXT,
    "wasAnalyzed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TranscriptHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveMarker" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "objectiveNumber" INTEGER NOT NULL,
    "controlledBy" TEXT NOT NULL,
    "controllingUnit" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectiveMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitInstance" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "datasheet" TEXT NOT NULL,
    "iconUrl" TEXT,
    "datasheetId" TEXT,
    "startingModels" INTEGER NOT NULL,
    "currentModels" INTEGER NOT NULL,
    "startingWounds" INTEGER,
    "currentWounds" INTEGER,
    "woundsPerModel" INTEGER,
    "modelsArray" TEXT,
    "isDestroyed" BOOLEAN NOT NULL DEFAULT false,
    "isBattleShocked" BOOLEAN NOT NULL DEFAULT false,
    "activeEffects" TEXT,
    "attachedToUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StratagemLog" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stratagemName" TEXT NOT NULL,
    "cpCost" INTEGER NOT NULL,
    "usedBy" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "targetUnit" TEXT,
    "description" TEXT,
    "stratagemDataId" TEXT,

    CONSTRAINT "StratagemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatLog" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battleRound" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "attackingUnit" TEXT NOT NULL,
    "attackingPlayer" TEXT NOT NULL,
    "defendingUnit" TEXT NOT NULL,
    "defendingPlayer" TEXT NOT NULL,
    "hitsScored" INTEGER,
    "woundsDealt" INTEGER,
    "savesSucceeded" INTEGER,
    "damageInflicted" INTEGER,
    "modelsDestroyed" INTEGER,
    "unitDestroyed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "CombatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationEvent" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toolName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rule" TEXT,
    "suggestion" TEXT,
    "wasOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overriddenAt" TIMESTAMP(3),
    "battleRound" INTEGER,
    "phase" TEXT,
    "toolArgs" TEXT,
    "toolResult" TEXT,

    CONSTRAINT "ValidationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRule" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ruleData" JSONB NOT NULL,
    "applicablePhases" TEXT[],
    "applicableTiers" TEXT[],
    "requiredKeywords" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondaryObjective" (
    "id" TEXT NOT NULL,
    "gameRuleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scoringType" TEXT NOT NULL,
    "vpCalculation" JSONB NOT NULL,
    "maxVPPerTurn" INTEGER,
    "maxVPTotal" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "scoringTrigger" TEXT NOT NULL,
    "requiredKeywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondaryObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrimaryMission" (
    "id" TEXT NOT NULL,
    "gameRuleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deploymentType" TEXT NOT NULL,
    "scoringPhase" TEXT NOT NULL,
    "scoringTiming" TEXT NOT NULL,
    "scoringFormula" TEXT NOT NULL,
    "maxVP" INTEGER NOT NULL,
    "specialRules" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrimaryMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CPTransaction" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "stratagemName" TEXT,
    "battleRound" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "playerTurn" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondaryProgress" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "secondaryObjectiveId" TEXT,
    "player" TEXT NOT NULL,
    "secondaryName" TEXT NOT NULL,
    "vpScored" INTEGER NOT NULL DEFAULT 0,
    "maxVP" INTEGER NOT NULL DEFAULT 20,
    "progressData" JSONB,
    "lastScoredRound" INTEGER,
    "lastScoredPhase" TEXT,

    CONSTRAINT "SecondaryProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevertAction" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetEventId" TEXT NOT NULL,
    "targetEventType" TEXT NOT NULL,
    "targetDescription" TEXT NOT NULL,
    "revertType" TEXT NOT NULL,
    "triggerMethod" TEXT NOT NULL,
    "reason" TEXT,
    "affectedEventIds" TEXT NOT NULL,
    "stateBefore" TEXT,
    "stateAfter" TEXT,

    CONSTRAINT "RevertAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasheetSource" (
    "id" TEXT NOT NULL,
    "datasheetId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "channelName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transcript" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "extractedContext" TEXT,
    "confidence" INTEGER,
    "competitiveSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasheetSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitiveSource" (
    "id" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "videoTitle" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "transcript" TEXT,
    "transcriptLang" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "parsedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "gameVersion" TEXT,
    "gameVersionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitiveSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitCompetitiveContext" (
    "id" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "subfaction" TEXT,
    "datasheetId" TEXT,
    "tierRank" TEXT,
    "tierReasoning" TEXT,
    "tierContext" TEXT,
    "bestTargets" TEXT,
    "counters" TEXT,
    "avoidTargets" TEXT,
    "synergies" TEXT,
    "synergyNotes" TEXT,
    "playstyleNotes" TEXT,
    "deploymentTips" TEXT,
    "phasePriority" TEXT,
    "pointsEfficiency" TEXT,
    "pointsNotes" TEXT,
    "sourceId" TEXT NOT NULL,
    "timestamp" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "clarifyingQuestions" TEXT,
    "gameVersion" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "staleSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitCompetitiveContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionCompetitiveContext" (
    "id" TEXT NOT NULL,
    "factionName" TEXT NOT NULL,
    "subfaction" TEXT,
    "metaTier" TEXT,
    "metaTierReasoning" TEXT,
    "metaPosition" TEXT,
    "playstyleArchetype" TEXT,
    "playstyleNotes" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "recommendedDetachments" TEXT,
    "detachmentNotes" TEXT,
    "favorableMatchups" TEXT,
    "unfavorableMatchups" TEXT,
    "matchupNotes" TEXT,
    "mustTakeUnits" TEXT,
    "avoidUnits" TEXT,
    "sleepHitUnits" TEXT,
    "sourceId" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "clarifyingQuestions" TEXT,
    "gameVersion" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "staleSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactionCompetitiveContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UnitIcon_userId_idx" ON "UnitIcon"("userId");

-- CreateIndex
CREATE INDEX "UnitIcon_datasheetId_idx" ON "UnitIcon"("datasheetId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitIcon_userId_unitName_faction_key" ON "UnitIcon"("userId", "unitName", "faction");

-- CreateIndex
CREATE INDEX "GlobalUnitIcon_datasheetId_idx" ON "GlobalUnitIcon"("datasheetId");

-- CreateIndex
CREATE INDEX "GlobalUnitIcon_faction_idx" ON "GlobalUnitIcon"("faction");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalUnitIcon_faction_unitName_key" ON "GlobalUnitIcon"("faction", "unitName");

-- CreateIndex
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_name_key" ON "Faction"("name");

-- CreateIndex
CREATE INDEX "Faction_parentFactionId_idx" ON "Faction"("parentFactionId");

-- CreateIndex
CREATE INDEX "Detachment_factionId_idx" ON "Detachment"("factionId");

-- CreateIndex
CREATE INDEX "Detachment_faction_subfaction_idx" ON "Detachment"("faction", "subfaction");

-- CreateIndex
CREATE UNIQUE INDEX "Detachment_name_faction_key" ON "Detachment"("name", "faction");

-- CreateIndex
CREATE UNIQUE INDEX "Army_shareToken_key" ON "Army"("shareToken");

-- CreateIndex
CREATE INDEX "Army_userId_idx" ON "Army"("userId");

-- CreateIndex
CREATE INDEX "Army_playerId_idx" ON "Army"("playerId");

-- CreateIndex
CREATE INDEX "Army_visibility_idx" ON "Army"("visibility");

-- CreateIndex
CREATE INDEX "AttachmentPreset_armyId_idx" ON "AttachmentPreset"("armyId");

-- CreateIndex
CREATE INDEX "AttachmentPreset_armyId_isDefault_idx" ON "AttachmentPreset"("armyId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentPreset_armyId_name_key" ON "AttachmentPreset"("armyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Datasheet_shareToken_key" ON "Datasheet"("shareToken");

-- CreateIndex
CREATE INDEX "Datasheet_faction_subfaction_idx" ON "Datasheet"("faction", "subfaction");

-- CreateIndex
CREATE INDEX "Datasheet_name_idx" ON "Datasheet"("name");

-- CreateIndex
CREATE INDEX "Datasheet_ownerId_idx" ON "Datasheet"("ownerId");

-- CreateIndex
CREATE INDEX "Datasheet_isOfficial_idx" ON "Datasheet"("isOfficial");

-- CreateIndex
CREATE INDEX "Datasheet_isEnabled_idx" ON "Datasheet"("isEnabled");

-- CreateIndex
CREATE INDEX "Datasheet_visibility_idx" ON "Datasheet"("visibility");

-- CreateIndex
CREATE INDEX "Datasheet_forkedFromId_idx" ON "Datasheet"("forkedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "Datasheet_name_faction_subfaction_ownerId_key" ON "Datasheet"("name", "faction", "subfaction", "ownerId");

-- CreateIndex
CREATE INDEX "DatasheetVersion_datasheetId_idx" ON "DatasheetVersion"("datasheetId");

-- CreateIndex
CREATE INDEX "DatasheetVersion_createdById_idx" ON "DatasheetVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DatasheetVersion_datasheetId_versionNumber_key" ON "DatasheetVersion"("datasheetId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Weapon_name_key" ON "Weapon"("name");

-- CreateIndex
CREATE INDEX "Weapon_name_idx" ON "Weapon"("name");

-- CreateIndex
CREATE INDEX "DatasheetWeapon_datasheetId_idx" ON "DatasheetWeapon"("datasheetId");

-- CreateIndex
CREATE INDEX "DatasheetWeapon_weaponId_idx" ON "DatasheetWeapon"("weaponId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasheetWeapon_datasheetId_weaponId_key" ON "DatasheetWeapon"("datasheetId", "weaponId");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_name_key" ON "Ability"("name");

-- CreateIndex
CREATE INDEX "Ability_name_idx" ON "Ability"("name");

-- CreateIndex
CREATE INDEX "Ability_type_idx" ON "Ability"("type");

-- CreateIndex
CREATE INDEX "DatasheetAbility_datasheetId_idx" ON "DatasheetAbility"("datasheetId");

-- CreateIndex
CREATE INDEX "DatasheetAbility_abilityId_idx" ON "DatasheetAbility"("abilityId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasheetAbility_datasheetId_abilityId_key" ON "DatasheetAbility"("datasheetId", "abilityId");

-- CreateIndex
CREATE INDEX "WargearOption_name_idx" ON "WargearOption"("name");

-- CreateIndex
CREATE INDEX "DatasheetWargear_datasheetId_idx" ON "DatasheetWargear"("datasheetId");

-- CreateIndex
CREATE INDEX "DatasheetWargear_wargearOptionId_idx" ON "DatasheetWargear"("wargearOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasheetWargear_datasheetId_wargearOptionId_key" ON "DatasheetWargear"("datasheetId", "wargearOptionId");

-- CreateIndex
CREATE INDEX "FactionRule_faction_subfaction_idx" ON "FactionRule"("faction", "subfaction");

-- CreateIndex
CREATE INDEX "FactionRule_type_idx" ON "FactionRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FactionRule_name_faction_subfaction_key" ON "FactionRule"("name", "faction", "subfaction");

-- CreateIndex
CREATE INDEX "DetachmentRule_faction_detachmentName_idx" ON "DetachmentRule"("faction", "detachmentName");

-- CreateIndex
CREATE INDEX "DetachmentRule_type_idx" ON "DetachmentRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "DetachmentRule_name_faction_detachmentName_key" ON "DetachmentRule"("name", "faction", "detachmentName");

-- CreateIndex
CREATE INDEX "StratagemData_faction_subfaction_idx" ON "StratagemData"("faction", "subfaction");

-- CreateIndex
CREATE INDEX "StratagemData_detachment_idx" ON "StratagemData"("detachment");

-- CreateIndex
CREATE INDEX "StratagemData_detachmentId_idx" ON "StratagemData"("detachmentId");

-- CreateIndex
CREATE INDEX "StratagemData_name_idx" ON "StratagemData"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StratagemData_name_faction_detachment_key" ON "StratagemData"("name", "faction", "detachment");

-- CreateIndex
CREATE UNIQUE INDEX "CoreStratagem_name_key" ON "CoreStratagem"("name");

-- CreateIndex
CREATE INDEX "CoreStratagem_name_idx" ON "CoreStratagem"("name");

-- CreateIndex
CREATE INDEX "Enhancement_faction_subfaction_idx" ON "Enhancement"("faction", "subfaction");

-- CreateIndex
CREATE INDEX "Enhancement_detachment_idx" ON "Enhancement"("detachment");

-- CreateIndex
CREATE INDEX "Enhancement_detachmentId_idx" ON "Enhancement"("detachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enhancement_name_faction_detachment_key" ON "Enhancement"("name", "faction", "detachment");

-- CreateIndex
CREATE INDEX "Unit_armyId_idx" ON "Unit"("armyId");

-- CreateIndex
CREATE INDEX "Unit_datasheetId_idx" ON "Unit"("datasheetId");

-- CreateIndex
CREATE INDEX "GameSession_userId_idx" ON "GameSession"("userId");

-- CreateIndex
CREATE INDEX "GameSession_primaryMissionId_idx" ON "GameSession"("primaryMissionId");

-- CreateIndex
CREATE INDEX "TimelineEvent_gameSessionId_timestamp_idx" ON "TimelineEvent"("gameSessionId", "timestamp");

-- CreateIndex
CREATE INDEX "TimelineEvent_gameSessionId_isReverted_idx" ON "TimelineEvent"("gameSessionId", "isReverted");

-- CreateIndex
CREATE INDEX "TranscriptHistory_gameSessionId_sequenceOrder_idx" ON "TranscriptHistory"("gameSessionId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "TranscriptHistory_gameSessionId_wasAnalyzed_idx" ON "TranscriptHistory"("gameSessionId", "wasAnalyzed");

-- CreateIndex
CREATE INDEX "ObjectiveMarker_gameSessionId_idx" ON "ObjectiveMarker"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveMarker_gameSessionId_objectiveNumber_key" ON "ObjectiveMarker"("gameSessionId", "objectiveNumber");

-- CreateIndex
CREATE INDEX "UnitInstance_gameSessionId_owner_idx" ON "UnitInstance"("gameSessionId", "owner");

-- CreateIndex
CREATE INDEX "UnitInstance_datasheetId_idx" ON "UnitInstance"("datasheetId");

-- CreateIndex
CREATE INDEX "StratagemLog_gameSessionId_timestamp_idx" ON "StratagemLog"("gameSessionId", "timestamp");

-- CreateIndex
CREATE INDEX "StratagemLog_stratagemDataId_idx" ON "StratagemLog"("stratagemDataId");

-- CreateIndex
CREATE INDEX "CombatLog_gameSessionId_timestamp_idx" ON "CombatLog"("gameSessionId", "timestamp");

-- CreateIndex
CREATE INDEX "ValidationEvent_gameSessionId_timestamp_idx" ON "ValidationEvent"("gameSessionId", "timestamp");

-- CreateIndex
CREATE INDEX "ValidationEvent_severity_wasOverridden_idx" ON "ValidationEvent"("severity", "wasOverridden");

-- CreateIndex
CREATE INDEX "ValidationEvent_rule_idx" ON "ValidationEvent"("rule");

-- CreateIndex
CREATE INDEX "GameRule_category_isActive_idx" ON "GameRule"("category", "isActive");

-- CreateIndex
CREATE INDEX "GameRule_ruleType_name_idx" ON "GameRule"("ruleType", "name");

-- CreateIndex
CREATE INDEX "GameRule_sourceId_sourceVersion_idx" ON "GameRule"("sourceId", "sourceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SecondaryObjective_gameRuleId_key" ON "SecondaryObjective"("gameRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "SecondaryObjective_name_key" ON "SecondaryObjective"("name");

-- CreateIndex
CREATE INDEX "SecondaryObjective_name_idx" ON "SecondaryObjective"("name");

-- CreateIndex
CREATE INDEX "SecondaryObjective_category_idx" ON "SecondaryObjective"("category");

-- CreateIndex
CREATE INDEX "SecondaryObjective_type_idx" ON "SecondaryObjective"("type");

-- CreateIndex
CREATE UNIQUE INDEX "PrimaryMission_gameRuleId_key" ON "PrimaryMission"("gameRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "PrimaryMission_name_key" ON "PrimaryMission"("name");

-- CreateIndex
CREATE INDEX "PrimaryMission_name_idx" ON "PrimaryMission"("name");

-- CreateIndex
CREATE INDEX "CPTransaction_gameSessionId_battleRound_playerTurn_idx" ON "CPTransaction"("gameSessionId", "battleRound", "playerTurn");

-- CreateIndex
CREATE INDEX "CPTransaction_gameSessionId_idx" ON "CPTransaction"("gameSessionId");

-- CreateIndex
CREATE INDEX "SecondaryProgress_gameSessionId_idx" ON "SecondaryProgress"("gameSessionId");

-- CreateIndex
CREATE INDEX "SecondaryProgress_secondaryObjectiveId_idx" ON "SecondaryProgress"("secondaryObjectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "SecondaryProgress_gameSessionId_player_secondaryName_key" ON "SecondaryProgress"("gameSessionId", "player", "secondaryName");

-- CreateIndex
CREATE INDEX "RevertAction_gameSessionId_timestamp_idx" ON "RevertAction"("gameSessionId", "timestamp");

-- CreateIndex
CREATE INDEX "DatasheetSource_datasheetId_idx" ON "DatasheetSource"("datasheetId");

-- CreateIndex
CREATE INDEX "DatasheetSource_status_idx" ON "DatasheetSource"("status");

-- CreateIndex
CREATE INDEX "DatasheetSource_competitiveSourceId_idx" ON "DatasheetSource"("competitiveSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasheetSource_datasheetId_sourceUrl_key" ON "DatasheetSource"("datasheetId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitiveSource_youtubeUrl_key" ON "CompetitiveSource"("youtubeUrl");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitiveSource_videoId_key" ON "CompetitiveSource"("videoId");

-- CreateIndex
CREATE INDEX "CompetitiveSource_channelName_idx" ON "CompetitiveSource"("channelName");

-- CreateIndex
CREATE INDEX "CompetitiveSource_status_idx" ON "CompetitiveSource"("status");

-- CreateIndex
CREATE INDEX "CompetitiveSource_gameVersion_idx" ON "CompetitiveSource"("gameVersion");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_unitName_faction_idx" ON "UnitCompetitiveContext"("unitName", "faction");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_faction_idx" ON "UnitCompetitiveContext"("faction");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_tierRank_idx" ON "UnitCompetitiveContext"("tierRank");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_sourceId_idx" ON "UnitCompetitiveContext"("sourceId");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_datasheetId_idx" ON "UnitCompetitiveContext"("datasheetId");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_gameVersion_idx" ON "UnitCompetitiveContext"("gameVersion");

-- CreateIndex
CREATE INDEX "UnitCompetitiveContext_needsReview_idx" ON "UnitCompetitiveContext"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "UnitCompetitiveContext_unitName_faction_sourceId_key" ON "UnitCompetitiveContext"("unitName", "faction", "sourceId");

-- CreateIndex
CREATE INDEX "FactionCompetitiveContext_factionName_idx" ON "FactionCompetitiveContext"("factionName");

-- CreateIndex
CREATE INDEX "FactionCompetitiveContext_metaTier_idx" ON "FactionCompetitiveContext"("metaTier");

-- CreateIndex
CREATE INDEX "FactionCompetitiveContext_sourceId_idx" ON "FactionCompetitiveContext"("sourceId");

-- CreateIndex
CREATE INDEX "FactionCompetitiveContext_gameVersion_idx" ON "FactionCompetitiveContext"("gameVersion");

-- CreateIndex
CREATE INDEX "FactionCompetitiveContext_needsReview_idx" ON "FactionCompetitiveContext"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "FactionCompetitiveContext_factionName_subfaction_sourceId_key" ON "FactionCompetitiveContext"("factionName", "subfaction", "sourceId");

-- AddForeignKey
ALTER TABLE "UnitIcon" ADD CONSTRAINT "UnitIcon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitIcon" ADD CONSTRAINT "UnitIcon_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalUnitIcon" ADD CONSTRAINT "GlobalUnitIcon_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_parentFactionId_fkey" FOREIGN KEY ("parentFactionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Detachment" ADD CONSTRAINT "Detachment_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Army" ADD CONSTRAINT "Army_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Army" ADD CONSTRAINT "Army_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Army" ADD CONSTRAINT "Army_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentPreset" ADD CONSTRAINT "AttachmentPreset_armyId_fkey" FOREIGN KEY ("armyId") REFERENCES "Army"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Datasheet" ADD CONSTRAINT "Datasheet_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Datasheet" ADD CONSTRAINT "Datasheet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Datasheet" ADD CONSTRAINT "Datasheet_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetVersion" ADD CONSTRAINT "DatasheetVersion_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetVersion" ADD CONSTRAINT "DatasheetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetWeapon" ADD CONSTRAINT "DatasheetWeapon_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetWeapon" ADD CONSTRAINT "DatasheetWeapon_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "Weapon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetAbility" ADD CONSTRAINT "DatasheetAbility_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetAbility" ADD CONSTRAINT "DatasheetAbility_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetWargear" ADD CONSTRAINT "DatasheetWargear_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetWargear" ADD CONSTRAINT "DatasheetWargear_wargearOptionId_fkey" FOREIGN KEY ("wargearOptionId") REFERENCES "WargearOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionRule" ADD CONSTRAINT "FactionRule_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionRule" ADD CONSTRAINT "FactionRule_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StratagemData" ADD CONSTRAINT "StratagemData_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StratagemData" ADD CONSTRAINT "StratagemData_detachmentId_fkey" FOREIGN KEY ("detachmentId") REFERENCES "Detachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_detachmentId_fkey" FOREIGN KEY ("detachmentId") REFERENCES "Detachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_armyId_fkey" FOREIGN KEY ("armyId") REFERENCES "Army"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stratagem" ADD CONSTRAINT "Stratagem_armyId_fkey" FOREIGN KEY ("armyId") REFERENCES "Army"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_attackerArmyId_fkey" FOREIGN KEY ("attackerArmyId") REFERENCES "Army"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_defenderArmyId_fkey" FOREIGN KEY ("defenderArmyId") REFERENCES "Army"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_primaryMissionId_fkey" FOREIGN KEY ("primaryMissionId") REFERENCES "PrimaryMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptHistory" ADD CONSTRAINT "TranscriptHistory_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveMarker" ADD CONSTRAINT "ObjectiveMarker_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitInstance" ADD CONSTRAINT "UnitInstance_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitInstance" ADD CONSTRAINT "UnitInstance_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StratagemLog" ADD CONSTRAINT "StratagemLog_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StratagemLog" ADD CONSTRAINT "StratagemLog_stratagemDataId_fkey" FOREIGN KEY ("stratagemDataId") REFERENCES "StratagemData"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombatLog" ADD CONSTRAINT "CombatLog_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationEvent" ADD CONSTRAINT "ValidationEvent_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondaryObjective" ADD CONSTRAINT "SecondaryObjective_gameRuleId_fkey" FOREIGN KEY ("gameRuleId") REFERENCES "GameRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrimaryMission" ADD CONSTRAINT "PrimaryMission_gameRuleId_fkey" FOREIGN KEY ("gameRuleId") REFERENCES "GameRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CPTransaction" ADD CONSTRAINT "CPTransaction_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondaryProgress" ADD CONSTRAINT "SecondaryProgress_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondaryProgress" ADD CONSTRAINT "SecondaryProgress_secondaryObjectiveId_fkey" FOREIGN KEY ("secondaryObjectiveId") REFERENCES "SecondaryObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevertAction" ADD CONSTRAINT "RevertAction_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetSource" ADD CONSTRAINT "DatasheetSource_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasheetSource" ADD CONSTRAINT "DatasheetSource_competitiveSourceId_fkey" FOREIGN KEY ("competitiveSourceId") REFERENCES "CompetitiveSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCompetitiveContext" ADD CONSTRAINT "UnitCompetitiveContext_datasheetId_fkey" FOREIGN KEY ("datasheetId") REFERENCES "Datasheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCompetitiveContext" ADD CONSTRAINT "UnitCompetitiveContext_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitiveSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionCompetitiveContext" ADD CONSTRAINT "FactionCompetitiveContext_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitiveSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

