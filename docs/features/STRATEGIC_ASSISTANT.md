# Strategic Assistant

**Last Updated:** 2025-10-23  
**Status:** Complete

## Overview

The Strategic Assistant is a phase-aware rules filtering system that helps Warhammer 40K players track available stratagems and abilities during gameplay. It automatically shows only relevant rules based on current game phase, player turn, and army composition, reducing cognitive load and preventing missed opportunities.

## Core Problem

During a Warhammer 40K game, players must simultaneously track:
- Their own faction's stratagems (6-15 per detachment)
- Universal core stratagems (8+ available to all armies)
- Detachment-specific rules
- Unit abilities from their army composition
- Opponent's reactive abilities (counterplay options)

This creates significant mental overhead, leading to missed opportunities and slower gameplay. The Strategic Assistant solves this by providing instant, phase-filtered access to all relevant rules.

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
- [Key Components](#key-components)
- [Database Schema](#database-schema)
- [Access Methods](#access-methods)
- [Filtering Logic](#filtering-logic)
- [Import Pipeline](#import-pipeline)
- [Related Documentation](#related-documentation)

---

## Core Architecture

The Strategic Assistant uses a tool-calling architecture where a single filtering engine powers both UI and AI interactions:

```
┌─────────────────┐
│  Rules Database │ (CoreStratagem, StratagemData, Ability)
└────────┬────────┘
         │
         ├──> getRelevantRules() ←── Core Filtering Engine
         │                               │
         ├──────────────────┬────────────┴─────────┐
         │                  │                      │
    ┌────▼────┐      ┌──────▼──────┐      ┌───────▼────────┐
    │ UI Modal│      │ REST API    │      │ AI Tool        │
    │(Shift+S)│      │/api/.../rules│     │get_strategic.. │
    └─────────┘      └─────────────┘      └────────────────┘
```

### Design Philosophy

1. **Deterministic Filtering** - Fast, local logic (no AI calls for UI)
2. **Smart Categorization** - Rules grouped by player turn and reactive status
3. **Keyword Matching** - Only shows rules applicable to your army composition
4. **Progressive Enhancement** - Works offline after initial data import

## Key Components

### 1. Core Filtering Engine (`lib/strategicAssistant.ts`)

**Function:** `getRelevantRules(sessionId, currentPhase, currentPlayerTurn)`

**Process:**
1. Fetches game session with player army data
2. Extracts keywords from army units (INFANTRY, VEHICLE, CHARACTER, etc.)
3. Queries CoreStratagem, StratagemData, and Ability tables
4. Filters by phase (triggerPhase contains currentPhase)
5. Filters by keywords (requiredKeywords match army keywords)
6. Categorizes by turn and isReactive flag
7. Sorts by priority (Stratagems > Detachment > Phase-Specific > Universal)
8. Returns opportunities (your options) and threats (opponent's reactive abilities)

**Performance:** ~10-50ms for typical army (deterministic, no AI calls)

### 2. UI Modal Component (`components/StrategicAssistantModal.tsx`)

- Two-column responsive layout (Opportunities | Threats)
- Search bar for real-time filtering
- Toggle: "Stratagems Only" (default) vs "Show All Abilities"
- Dynamic subphase tabs (extracted from rule metadata)
- Rule detail modals with full text
- Mobile-optimized (iPad/phone friendly)
- Keyboard accessible (ARIA attributes)

### 3. REST API Endpoint (`app/api/strategic-assistant/rules/route.ts`)

**POST** `/api/strategic-assistant/rules`

- Requires authentication
- Calls `getRelevantRules()` with session context
- Returns JSON with opportunities, threats, and subphases

### 4. AI Tool Integration (`lib/aiTools.ts`, `lib/toolHandlers.ts`)

**Tool:** `get_strategic_advice`

- Query types: opportunities, threats, all
- Returns top 5-10 rules formatted for AI synthesis
- Enables conversational strategic guidance

---

## Database Schema

### CoreStratagem (Universal Stratagems)

```typescript
{
  name: string             // "Fire Overwatch"
  cpCost: number           // 1-3 CP
  category: string         // "Battle Tactic", "Strategic Ploy", "Epic Deed"
  when: string             // Phase/timing description
  target: string           // What can be targeted
  effect: string           // Full rule text
  triggerPhase: string     // JSON: ["Movement", "Charge"]
  triggerSubphase: string  // "Start of Phase", "After enemy charges"
  isReactive: boolean      // Can interrupt opponent's turn
  requiredKeywords: string // JSON: ["INFANTRY", "VEHICLE"]
  usageRestriction: string // "once_per_turn", "once_per_battle", ""
}
```

### StratagemData (Faction/Detachment Stratagems)

Extends existing model with:
- `triggerPhase`, `triggerSubphase`, `isReactive`, `requiredKeywords`, `usageRestriction`

### Ability (Unit/Faction Abilities)

Extends existing model with:
- `triggerPhase`, `triggerSubphase`, `isReactive`, `requiredKeywords`

---

## Access Methods

### 1. Keyboard Shortcut
**Shift+S** - Instant access from any game screen

### 2. Menu Button  
Hamburger menu → "STRATEGIC (Shift+S)"

### 3. Voice Commands
- "What can I do?"
- "What should I watch for?"
- "Open strategic assistant"
- "What stratagems are available?"

### 4. AI Conversational
- "Grimlog, what can I do in my shooting phase?"
- "What should I watch for during opponent's charge?"

---

## Filtering Logic

### Phase Filtering
```sql
WHERE triggerPhase LIKE '%{currentPhase}%' OR triggerPhase IS NULL
```

### Keyword Filtering (V1)
```typescript
requiredKeywords.some(keyword => playerArmyKeywords.has(keyword))
```

### Turn-Based Categorization

**On Player's Turn:**
- Non-reactive rules → Opportunities (your actions)
- Reactive rules → Threats (opponent can interrupt)

**On Opponent's Turn:**
- Reactive rules → Opportunities (your interrupts)  
- Non-reactive rules → Threats (opponent's actions)

### Smart Filtering (Default)

By default, only shows:
- ✅ All Stratagems (Core + Faction/Detachment)
- ✅ Faction-type abilities (Detachment rules)
- ❌ Unit abilities (hidden - toggle "Show All" to see)

This reduces clutter from passive abilities like "Deadly Demise" or "Damaged" conditions.

---

## Import Pipeline

### Two-Step Process

**Step 1: PDF Extraction** (`scripts/parsePdfWithVision.py`)
- Uses PyMuPDF to render PDF pages at 2x resolution
- Sends to GPT-5-mini Vision API for text extraction
- Preserves exact wording and structure
- Outputs raw markdown files

**Step 2: AI Parsing** (`scripts/importStrategicRules.ts`)
- Reads markdown files
- GPT-5-mini extracts structured metadata (phase, timing, keywords)
- Validates with Zod schemas
- Imports to Supabase database

### Import Commands

```bash
# Extract from PDF
python scripts/parsePdfWithVision.py \
  --input data/pdf-source/your-codex.pdf \
  --faction "Your Faction" \
  --detachment "Your Detachment"

# Import to database
npx tsx scripts/importStrategicRules.ts \
  --file your-codex.md \
  --faction "Your Faction" \
  --detachment "Your Detachment"
```

---

### Opening the Strategic Assistant

**Method 1: Keyboard Shortcut**
```
Press Shift+S
```

**Method 2: Hamburger Menu**
1. Click the ☰ menu button
2. Click "STRATEGIC (Shift+S)"

**Method 3: Voice Command**
```
Say: "Open strategic assistant"
     "What can I do?"
     "What should I watch for?"
```

### Reading the Interface

#### Header
- Shows current phase and whose turn it is
- Example: "Shooting Phase - Your Turn"

#### Subphase Tabs
- Dynamically appear based on available rules
- Filter rules by specific timing
- "All Timing" shows everything

#### Rule Cards
Each rule card shows:
- **Name**: Stratagem or ability name
- **Source**: Core, Faction, or Detachment
- **CP Cost**: Command Points required (if applicable)
- **Timing**: Specific subphase (if not "Any")

#### Rule Details
Click any rule card to see:
- Full rule text
- Source information
- Timing details
- Required keywords
- Reactive indicator (⚡ for interrupt abilities)

---

## Examples

### Example 1: Your Command Phase
**Opportunities Column:**
- Insane Bravery (1 CP) - Core Stratagem
- Tactical Doctrine - Space Marines
- Oath of Moment - Gladius Detachment

**Threats Column:**
- (Empty - No reactive abilities in Command Phase)

### Example 2: Opponent's Charge Phase
**Opportunities Column:**
- Fire Overwatch (2 CP) [During Charge] - Core Stratagem
- Auspex Scan (1 CP) [Start of Phase] - Space Marines
- Counter-Offensive (2 CP) [After Enemy Charges] - Core Stratagem

**Threats Column:**
- Heroic Intervention [After Charge] - Universal
- Devastating Charge - Tyranids
- Unstoppable Advance - Core

---

## Voice Commands Reference

### Opening the Modal
- "Open strategic assistant"
- "Show strategic panel"
- "What can I do?"
- "What stratagems are available?"

### Asking the AI
The AI can provide strategic advice without opening the modal:

```
You: "Grimlog, what can I do in my shooting phase?"
AI: "In Shooting Phase, you have 3 opportunities:
     • Transhuman Physiology (2 CP) - Reduce damage
     • Rapid Fire (1 CP) - Extra attacks at half range
     • Fire and Fade (1 CP) - Shoot and move"
```

```
You: "What should I watch for during opponent's movement?"
AI: "Watch for 2 threats:
     • Encircling Maneuver (1 CP) - Opponent redeploys units
     • Advance and Charge (2 CP) - Opponent moves twice"
```

---

## Technical Details

### How Filtering Works

1. **Phase Filtering**: Only rules for current phase are shown
2. **Keyword Matching**: Rules requiring specific keywords (INFANTRY, VEHICLE) are only shown if your army has units with those keywords
3. **Turn-Based Categorization**:
   - **Your Turn**: Non-reactive rules → Opportunities, Reactive rules → Threats
   - **Opponent's Turn**: Reactive rules → Opportunities, Non-reactive rules → Threats

### Data Sources

The Strategic Assistant pulls from:
- **CoreStratagem table**: Universal stratagems (Overwatch, Heroic Intervention, etc.)
- **StratagemData table**: Faction and detachment-specific stratagems
- **Ability table**: Unit abilities from your army's datasheets

### Import System

Rules are imported using the AI-powered import script:

```bash
# Import core stratagems
npx tsx scripts/importStrategicRules.ts --file core-stratagems.txt

# Import faction stratagems
npx tsx scripts/importStrategicRules.ts --file space-marines-gladius.txt --faction "Space Marines" --detachment "Gladius"
```

See `data/rules-source/README.md` for details on formatting rule files.

---

## Limitations (V1)

1. **Keyword Filtering**: Basic keyword matching only. Doesn't understand complex interactions.
2. **No Usage Tracking**: Doesn't track if a stratagem was already used (once per turn, etc.)
3. **No CP Validation**: Doesn't check if you have enough CP before showing stratagem
4. **Manual Import**: Rules must be manually imported from text files

### Planned Enhancements (V2+)
- [ ] Usage tracking (mark stratagems as used)
- [ ] CP validation (gray out stratagems you can't afford)
- [ ] Combo detection (highlight common stratagem combinations)
- [ ] Unit proximity awareness (only show abilities for units in range)
- [ ] "What-if" scenario analysis

## Related Documentation

- **User Guide**: [STRATEGIC_ASSISTANT_USER_GUIDE.md](../guides/STRATEGIC_ASSISTANT_USER_GUIDE.md) - Step-by-step usage instructions
- **API Reference**: [STRATEGIC_ASSISTANT_API.md](../api/STRATEGIC_ASSISTANT_API.md) - REST endpoint documentation
- **Import Guide**: [PDF_RULES_IMPORT_GUIDE.md](../guides/PDF_RULES_IMPORT_GUIDE.md) - How to import rules from PDFs
- **Troubleshooting**: See user guide troubleshooting section
- **Architecture**: [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall system architecture
- **Project Status**: [PROJECT_STATUS.md](../PROJECT_STATUS.md) - Current feature status

