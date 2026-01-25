# Secondary Objectives System

**Last Updated:** 2025-11-15  
**Status:** Complete  
**Version:** 4.6.0

## Overview

Comprehensive secondary objectives tracking system for Warhammer 40K 10th Edition. Features 19 missions from Chapter Approved 2025-26 with new GameRule-based schema, database storage, voice command scoring, manual UI scoring, VP calculation, and revert support.

**Key Change in v4.6.0:** Migrated from legacy schema to extensible GameRule-based schema with proper `vpCalculation` structure for accurate scoring and AI integration.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Schema Migration](#schema-migration)
- [Frontend Components](#frontend-components)
- [UI Redesign (v4.6.1)](#ui-redesign-v461)
- [API Endpoints](#api-endpoints)
- [Scoring & Revert](#scoring--revert)
- [Related Documentation](#related-documentation)

---

## Features

### Core Capabilities

- **19 Secondary Missions** - All Chapter Approved 2025-26 v1.2 missions
- **2 Secondaries Per Player** - Official competitive format
- **Manual Scoring** - Click scoring options generated from `vpCalculation` structure
- **Voice Command Scoring** - AI tools with automatic VP calculation
- **Total VP Integration** - Scoring updates both secondary progress and total VP counter
- **Revert Support** - Undo scoring with full VP and progress restoration
- **Turn Cap Enforcement** - Automatic limits (e.g., 5VP/turn for tactical missions)
- **Scoring History** - Track when and how VP was scored each turn

### Supported Mission Types

**Tactical Missions** (13):
- Behind Enemy Lines, Storm Hostile Objective, Engage on All Fronts, Establish Locus, Defend Stronghold, Marked for Death, Secure No Man's Land, Sabotage, Area Denial, Recover Assets, A Tempting Target, Extend Battle Lines, Display of Might

**Both (Fixed/Tactical)** (6):
- Assassination, Bring It Down, Cleanse, Cull the Horde, No Prisoners, Overwhelming Force

---

## Architecture

### Database Schema (v4.6.0)

```typescript
// New GameRule-based schema
model SecondaryObjective {
  id              String   @id @default(uuid())
  gameRuleId      String   @unique
  gameRule        GameRule @relation(...)
  
  // Core fields
  name            String   @unique
  category        String   // "Fixed", "Tactical", or "Both"
  type            String   // "Unit Destruction", "Objective Control", etc.
  scoringType     String   // "automatic", "per_turn", "end_of_game"
  
  // VP Calculation (structured)
  vpCalculation   Json     // { type, thresholds, vpPerUnit, fixedVP }
  
  // Limits
  maxVPPerTurn    Int?     // e.g., 5 for tactical missions
  maxVPTotal      Int      // Usually 20
  
  // Rules
  description     String   @db.Text
  scoringTrigger  String   // When/how it scores
  requiredKeywords String[] // ["CHARACTER"], ["MONSTER", "VEHICLE"]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### VP Calculation Structure

```typescript
interface VPCalculation {
  type: 'threshold' | 'per_unit' | 'fixed';
  thresholds: Array<{
    condition: string;  // Human-readable condition
    vp: number;         // VP awarded
  }>;
  vpPerUnit: number | null;  // For per-unit scoring
  fixedVP: number | null;    // For fixed scoring
}

// Example: Area Denial
{
  "type": "threshold",
  "thresholds": [
    {
      "condition": "Your units within 3\" of center, no enemy within 3\" of center",
      "vp": 2
    },
    {
      "condition": "Your units within 3\" of center, no enemy within 6\" of center",
      "vp": 5
    }
  ],
  "vpPerUnit": null,
  "fixedVP": null
}
```

---

## Schema Migration

### What Changed

**Old Schema → New Schema:**
- `missionType` → `category` ("fixed"/"tactical"/"both" → "Fixed"/"Tactical"/"Both")
- `maxVP` → `maxVPTotal` (always 20)
- `vpPerTurnCap` → `maxVPPerTurn` (5, 4, 6, etc.)
- `vpStructure` → `vpCalculation` (structured thresholds)
- `scoringType` → Simplified to "automatic", "per_turn", "end_of_game"
- Removed `fullRules`, `hasDrawCondition`, `requiresTargetSelection`, etc.

**Why:**
- Extensible GameRule-based architecture
- Better AI integration with structured data
- Cleaner VP calculation logic
- Supports future rules additions

### Migration Process

1. **Parse Source Data:**
   - Script: `scripts/parseSecondariesManual.ts`
   - Source: [Wahapedia Chapter Approved 2025-26](https://wahapedia.ru/wh40k10ed/the-rules/chapter-approved-2025-26/#Secondary-Mission-deck)
   - Output: `data/parsed-rules/secondary-objectives.json`

2. **Seed Database:**
   ```bash
   npx tsx scripts/parseSecondariesManual.ts
   npx tsx scripts/seedGameplayRules.ts --category secondary-objectives
   ```

3. **Update Components:**
   - Updated `SecondaryCard.tsx` to use new schema fields
   - Updated `SecondaryMiniCard.tsx` to use new schema fields
   - Fixed `generateScoringOptions()` to parse `vpCalculation.thresholds`

4. **Update API:**
   - Updated `app/api/secondaries/route.ts` to query new fields
   - Updated `lib/types.ts` TypeScript interfaces
   - Fixed validation in `app/api/sessions/[id]/score-secondary/route.ts`

---

## Frontend Components

### Current Components (v4.6.1+)

**Main Components:**
- `SecondaryModal.tsx` - Full-screen modal with player tabs and card display
- `SecondaryCardLarge.tsx` - Large, high-contrast card component with grim dark styling
- `ScoringBottomSheet.tsx` - Bottom sheet overlay for scoring options

**Key Features:**
- Full-screen modal with dynamic player-colored backgrounds
- High-contrast white text on dark backgrounds for readability
- Mobile-first responsive design (stacked on phones, side-by-side on tablets)
- Unified interface replacing 6+ legacy components
- Player color theming (green for defender, red for attacker)

**See:** [Secondary Selection Modal Redesign](./SECONDARY_SELECTION_MODAL_REDESIGN.md) for complete UI documentation.

### Legacy Components (Deprecated in v4.6.1)

**Note:** These components were replaced with the unified redesign:

- `SecondaryCard.tsx` - Full-screen card display
- `SecondaryMiniCard.tsx` - Compact inline card
- `SecondaryObjectivesModal.tsx` - Old modal (3 slots)
- `SecondaryObjectivesModalNew.tsx` - Old modal (2 slots)
- `SecondarySelectionModal.tsx` - Selection-only modal
- `SecondaryDiscardModal.tsx` - Discard-only modal
- `SecondaryHistory.tsx` - History panel component

---

## UI Redesign (v4.6.1)

**Major UI overhaul** with grim dark aesthetic, improved readability, and mobile-first design.

### Key Changes

- **Unified Modal** - Single full-screen modal replaces 6+ legacy components
- **Grim Dark Theme** - Dark industrial backgrounds with muted player colors
- **High Contrast** - White text on dark backgrounds for maximum readability
- **Player Color Theming** - Dynamic backgrounds based on active player tab
- **Mobile Optimized** - Full-screen layout with large touch targets
- **Bottom Sheet Pattern** - Native mobile pattern for scoring options

### Component Architecture

```
SecondaryModal (Full-screen container)
├── Header (Title, VP total, Close button)
├── Player Tabs (Defender/Attacker switcher)
├── Main Content
│   ├── SecondaryCardLarge (x2) - Side-by-side on tablet, stacked on mobile
│   └── Selection List (when adding secondary)
└── Footer (Mission mode, History button, Add button)

ScoringBottomSheet (Overlay when card tapped)
├── Header (Secondary name, VP display)
├── Scoring Options (VP buttons)
├── Full Rules (Collapsible)
└── Actions (Discard, Close)
```

**Full Documentation:** See [Secondary Selection Modal Redesign](./SECONDARY_SELECTION_MODAL_REDESIGN.md)

---

## API Endpoints

### GET /api/secondaries

Fetch all available secondary objectives.

**Response:**
```json
{
  "success": true,
  "count": 19,
  "secondaries": [
    {
      "id": "fb94b201-db8e-47a4-ab10-cf6d67986df8",
      "name": "Area Denial",
      "description": "It is critical that this area is dominated...",
      "category": "Tactical",
      "type": "Area Control",
      "scoringType": "per_turn",
      "vpCalculation": {
        "type": "threshold",
        "thresholds": [...],
        "fixedVP": null,
        "vpPerUnit": null
      },
      "maxVPPerTurn": 5,
      "maxVPTotal": 20,
      "scoringTrigger": "End of your turn",
      "requiredKeywords": [],
      "createdAt": "2025-11-15T16:11:15.670Z",
      "updatedAt": "2025-11-15T16:11:15.670Z"
    }
  ]
}
```

### POST /api/sessions/[id]/score-secondary

Score VP for a secondary objective.

**Request:**
```json
{
  "player": "attacker",
  "secondaryName": "Area Denial",
  "vpAmount": 2,
  "details": "Your units within 3\" of center, no enemy within 3\" of center",
  "option": "2VP option"
}
```

**What It Does:**
1. Validates secondary is active for player
2. Checks turn cap (tactical missions can only score once per turn)
3. Checks maxVPPerTurn limit
4. **Updates secondary progress** (adds VP, tracks scoring history)
5. **Updates total VP counter** (adds to `attackerVictoryPoints` or `defenderVictoryPoints`)
6. Creates timeline event

**Response:**
```json
{
  "success": true,
  "message": "Scored 2 VP for Area Denial",
  "newVP": 2
}
```

---

## Scoring & Revert

### Manual Scoring Flow

1. **User clicks secondary card** → Modal opens
2. **User clicks scoring option** → "+2VP" button
3. **API updates:**
   - Secondary progress: `{ "Area Denial": { vp: 2, scoringHistory: [...] } }`
   - Total VP: `attackerVictoryPoints: 2`
4. **Timeline event created:** "attacker manually scored 2 VP for Area Denial"
5. **UI updates:** VP counter shows 2, secondary card shows 2/20 VP

### Revert Flow

When user clicks "⎌ UNDO" on a VP event:

1. **API identifies event type:** `eventType: "vp"`
2. **Extracts metadata:**
   ```json
   {
     "player": "attacker",
     "secondary": "Area Denial",
     "vp": 2,
     "details": "...",
     "manual": true
   }
   ```
3. **Reverses changes:**
   - **Subtracts total VP:** `attackerVictoryPoints: 2 → 0`
   - **Subtracts secondary VP:** `Area Denial.vp: 2 → 0`
   - **Removes scoring history entry** (by timestamp match)
4. **Marks event as reverted:** `isReverted: true`
5. **Creates revert action event:** "⎌ REVERTED (Manual): attacker manually scored 2 VP for Area Denial"

**Key Code:**
```typescript
// app/api/sessions/[id]/events/[eventId]/route.ts
case 'vp':
  const vpAmount = metadata.vp || metadata.points;
  if (vpAmount && metadata.player) {
    // Subtract from total VP
    const vpField = metadata.player === 'attacker' 
      ? 'attackerVictoryPoints' 
      : 'defenderVictoryPoints';
    await prisma.gameSession.update({
      data: { [vpField]: Math.max(0, session[vpField] - vpAmount) }
    });
    
    // Subtract from secondary progress
    if (metadata.secondary) {
      currentProgress[secondaryName].vp -= vpAmount;
      // Remove scoring history entry
      currentProgress[secondaryName].scoringHistory = 
        currentProgress[secondaryName].scoringHistory.filter(...);
    }
  }
```

---

## Related Documentation

### UI & Components
- **[Secondary Selection Modal Redesign](./SECONDARY_SELECTION_MODAL_REDESIGN.md)** - Complete UI redesign documentation (v4.6.1)

### Core Systems
- **[Revert System](./REVERT_SYSTEM.md)** - How reverts work across all event types
- **[AI Tool Calling](./AI_TOOL_CALLING.md)** - Voice command integration
- **[Game State Tracking](./GAME_STATE_TRACKING.md)** - VP and CP tracking
- **[Manual UI Controls](./MANUAL_UI_CONTROLS.md)** - Manual override patterns

### API Reference
- **[Score Secondary API](../api/SCORE_SECONDARY.md)** - Detailed endpoint documentation (if exists)
- **[Revert Events API](../api/REVERT_EVENTS.md)** - Revert endpoint documentation (if exists)

### Troubleshooting
- **[Secondary Scoring Issues](../troubleshooting/SECONDARY_SCORING_ISSUES.md)** - Common problems and fixes (if exists)

### Scripts
- `scripts/parseSecondariesManual.ts` - Parse source data to new schema
- `scripts/seedGameplayRules.ts` - Import parsed rules to database
- `scripts/seedSecondaries.ts` - Legacy script (deprecated)

---

**Related Files:**
- `components/SecondaryCard.tsx` - Full secondary card component
- `components/SecondaryMiniCard.tsx` - Compact secondary card
- `app/api/secondaries/route.ts` - Fetch secondaries endpoint
- `app/api/sessions/[id]/score-secondary/route.ts` - Score VP endpoint
- `app/api/sessions/[id]/events/[eventId]/route.ts` - Revert endpoint
- `lib/types.ts` - TypeScript interfaces
- `data/parsed-rules/secondary-objectives.json` - Source data

---

**Version History:**
- **4.6.0** (2025-11-15) - New GameRule schema, VP integration, revert support
- **3.8.0** (2025-10-28) - Initial secondary objectives system

