# Mission System

## Overview

The Mission System provides primary mission tracking, automatic VP calculation, and mission-aware gameplay assistance for Warhammer 40K games.

**Version:** 4.0.0  
**Last Updated:** November 11, 2024

---

## Features

✅ **20 Tournament Missions** - Full Chapter Approved mission pool  
✅ **Automatic VP Calculation** - AI calculates VP based on objectives held  
✅ **Mission Context** - AI understands scoring rules for each mission  
✅ **Deployment Types** - Hammer and Anvil, Dawn of War, Sweeping Engagement  
✅ **Scoring Reminders** - Proactive reminders when scoring is available  
✅ **Progress Tracking** - Track primary VP by round

---

## How It Works

### 1. Mission Selection

At the start of a game, players can select a primary mission:

**UI Flow:**
```
Game Start → Mission Selection Modal → Select Mission → Game Begins
```

**Mission Information Displayed:**
- Mission name
- Deployment type
- Scoring phase (when to score)
- Scoring formula (how VP is calculated)
- Max VP (usually 50)
- Special rules (if any)

### 2. Mission Context in AI

Once selected, the mission becomes part of the AI's context:

**System Prompt Includes:**
```
=== PRIMARY MISSION ===
Mission: Surround and Destroy
Deployment: Hammer and Anvil

Scoring Rules:
- When: End of your Command phase
- Formula: objectives_controlled * 5
- Max VP: 50

Use check_primary_scoring tool to calculate available VP based on objectives held.
```

### 3. Automatic VP Calculation

The AI can calculate primary VP on demand:

**Voice Command Examples:**
- "Check primary scoring" → AI calculates VP based on objectives held
- "How much primary can I score?" → AI explains scoring opportunity
- "End of Command phase" → AI reminds about primary scoring

---

## AI Tools

### `check_primary_scoring`

**Description:** Check if current phase allows primary mission scoring and calculate available VP.

**Parameters:**
- `player` (required): "attacker" | "defender"

**Returns:**
```typescript
{
  canScore: boolean;
  vp: number;
  formula: string;
  explanation: string;
  objectivesHeld: number;
  missionName: string;
  maxVP: number;
}
```

**Examples:**

1. **Scoring Available:**
```
Input: check_primary_scoring(player="attacker")
Output: "Primary Scoring Available: 4 objectives controlled → 20 VP (objectives_controlled * 5)"
```

2. **Wrong Phase:**
```
Input: check_primary_scoring(player="attacker")  [in Movement phase]
Output: "Primary scoring not available in Movement phase. Surround and Destroy scores during End of your Command phase."
```

3. **No Mission Selected:**
```
Input: check_primary_scoring(player="attacker")
Output: "No primary mission selected for this game. Primary VP must be tracked manually."
```

---

## Database Schema

### PrimaryMission Model

```prisma
model PrimaryMission {
  id              String   @id
  gameRuleId      String   @unique
  name            String   @unique
  deploymentType  String
  scoringPhase    String
  scoringTiming   String
  scoringFormula  String
  maxVP           Int
  specialRules    String?
  description     String
  
  gameSessions    GameSession[]
}
```

### GameSession Updates

```prisma
model GameSession {
  // ... existing fields ...
  
  primaryMissionId  String?
  primaryMission    PrimaryMission?
  primaryVPScored   Json?  // { "1": 10, "2": 20, "3": 25 }
}
```

---

## Mission Formula Types

### Multiplication Formula
```
"objectives_controlled * 5"
```
- 1 objective = 5 VP
- 2 objectives = 10 VP
- 3 objectives = 15 VP
- etc.

### Conditional Formula
```
"10 VP if 3+"
```
- ≥3 objectives = 10 VP
- <3 objectives = 0 VP

### Range-Based Formula
```
"5 VP for 1-2, 10 VP for 3-4, 15 VP for 5-6"
```
- 1-2 objectives = 5 VP
- 3-4 objectives = 10 VP
- 5-6 objectives = 15 VP

### Complex Formulas
Some missions have complex conditions that are evaluated by the AI.

---

## API Endpoints

### GET /api/missions

Fetch all available primary missions.

**Response:**
```json
{
  "missions": [
    {
      "id": "uuid",
      "name": "Surround and Destroy",
      "deploymentType": "Hammer and Anvil",
      "scoringPhase": "Command",
      "scoringTiming": "End of your Command phase",
      "scoringFormula": "objectives_controlled * 5",
      "maxVP": 50,
      "specialRules": null,
      "description": "Control objectives to score VP"
    }
  ]
}
```

### POST /api/missions

Set primary mission for a game session.

**Request:**
```json
{
  "sessionId": "uuid",
  "missionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "mission": {
    "id": "uuid",
    "name": "Surround and Destroy",
    "deploymentType": "Hammer and Anvil",
    "scoringFormula": "objectives_controlled * 5"
  }
}
```

---

## Usage Examples

### Example 1: Basic Scoring Check

**User:** "How much primary can I score?"

**AI Flow:**
1. Calls `check_primary_scoring(player="attacker")`
2. System calculates: 3 objectives × 5 VP = 15 VP
3. Returns: "Primary Scoring Available: 3 objectives controlled → 15 VP (objectives_controlled * 5)"

### Example 2: Phase Transition Reminder

**User:** "Moving to end of Command phase"

**AI Flow:**
1. Detects phase timing
2. Checks mission scoring phase
3. Calls `check_primary_scoring(player="attacker")`
4. Reminds: "End of Command Phase. Primary scoring available: 15 VP for 3 objectives."

### Example 3: Mission Selection

**User Interaction:**
1. Opens session creation
2. Clicks "Select Mission"
3. Browses 20 tournament missions
4. Selects "Surround and Destroy"
5. Mission saved to session
6. AI now aware of scoring rules

---

## Configuration

### Adding New Missions

Missions are added via the rules parsing and seeding system:

**Step 1: Parse from PDF**
```bash
npx tsx scripts/parseGameplayRules.ts --source chapter-approved-2024 --category primary-missions
```

**Step 2: Seed to Database**
```bash
npx tsx scripts/seedGameplayRules.ts --category primary-missions
```

**Step 3: Missions Automatically Available**
- Appear in MissionSelectionModal
- Available for AI tools
- Included in context

### Updating Mission Rules

When GW releases updated missions:
1. Update PDF in `data/pdf-source/`
2. Re-parse with new version
3. Seeding script handles versioning automatically

---

## Best Practices

### For Players

1. **Select Mission Early** - Choose mission before deployment for best tracking
2. **Use Voice Commands** - "Check primary scoring" gets current VP calculation
3. **Trust Auto-Calculation** - System calculates VP accurately based on objectives
4. **Review at Command Phase** - Primary typically scores in Command phase

### For Developers

1. **Formula Parsing** - Keep formulas simple and machine-readable
2. **Special Rules** - Document complex conditions in `specialRules` field
3. **Testing** - Verify formula evaluation with various objective counts
4. **Versioning** - Track mission version in `gameRule.sourceVersion`

---

## Troubleshooting

### Mission Not Appearing in AI Context

**Cause:** Session doesn't have `primaryMissionId` set  
**Fix:** Use MissionSelectionModal to select mission, or manually update session

### VP Calculation Incorrect

**Cause:** Formula not parsing correctly  
**Fix:** Check `scoringFormula` format, verify in `evaluateScoringFormula()` function

### Scoring Not Available

**Cause:** Current phase doesn't match mission's `scoringPhase`  
**Fix:** Wait for correct phase, or verify mission's scoring timing

---

## Related Documentation

- [Secondary Objectives](./SECONDARY_OBJECTIVES.md) - Secondary scoring system
- [Strategic Assistant API](../api/STRATEGIC_ASSISTANT_API.md) - Strategic guidance
- [Validation Guide](../guides/VALIDATION_GUIDE.md) - Rules validation

---

## Changelog

### v4.0.0 (November 2024)
- Initial mission system implementation
- 20 tournament missions from Chapter Approved
- Automatic VP calculation
- Mission selection UI
- AI integration with check_primary_scoring tool


