# Turn Order System

**Last Updated:** 2025-10-31  
**Status:** Complete  
**Version:** 3.11.0

## Overview

The Turn Order System implements proper Warhammer 40,000 10th Edition turn tracking with attacker/defender roles. Each battle round consists of two turns: the attacker (first player) goes first, followed by the defender (second player). The system handles automatic round progression, manual turn navigation, and contextual AI voice understanding.

This system replaces the previous simple player/opponent toggle with a comprehensive turn tracking solution that properly represents game flow and supports both manual controls and AI voice commands.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Architecture](#architecture)
- [Key Components](#key-components)
- [Turn Progression Logic](#turn-progression-logic)
- [User Interface](#user-interface)
- [AI Integration](#ai-integration)
- [Database Schema](#database-schema)
- [Related Documentation](#related-documentation)

---

## Core Concepts

### Attacker/Defender Roles

In Warhammer 40K, turn order is determined by a roll-off after deployment:
- **Attacker** - The player who goes first each round (determined by roll-off)
- **Defender** - The player who goes second each round

These roles remain consistent throughout the entire game.

### Turn Progression

Each battle round consists of exactly two turns:

```
Round 1 → Attacker Turn (1st turn) → Defender Turn (2nd turn) → Round 2 → ...
```

When the defender completes their turn, the round automatically advances and the attacker goes first again.

### Key Principles

1. **Same player goes first every round** - Determined by initial roll-off
2. **Two turns per round** - Attacker always goes 1st, defender always goes 2nd
3. **Automatic round advancement** - System handles progression automatically
4. **Command phase reset** - Every turn change resets to Command phase
5. **Role-based color coding** - Green for attacker, red for defender

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Turn Order System                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  Turn Helpers    │───▶│  Tool Handlers   │              │
│  │ (lib/turnHelpers │    │ (lib/toolHandlers│              │
│  │      .ts)        │    │      .ts)        │              │
│  └──────────────────┘    └──────────────────┘              │
│           │                       │                          │
│           ▼                       ▼                          │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ RoundTurnSelector│    │  AI Context      │              │
│  │   Component      │    │  Builder         │              │
│  └──────────────────┘    └──────────────────┘              │
│           │                       │                          │
│           └───────┬───────────────┘                          │
│                   ▼                                          │
│          ┌──────────────────┐                               │
│          │  GameSession DB  │                               │
│          │  (firstPlayer)   │                               │
│          └──────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Game Setup** → User selects first player → Stored in `GameSession.firstPlayer`
2. **Turn Navigation** → User selects turn from dropdown → Tool handler updates session
3. **Voice Commands** → AI analyzes "end of my turn" → Contextually advances turn/round
4. **UI Updates** → Optimistic updates → Background API call → Rollback on error

---

## Key Components

### 1. RoundTurnSelector Component

**File:** `components/RoundTurnSelector.tsx`

**Purpose:** Dropdown UI for selecting any round/turn combination

**Features:**
- Dropdown menu with all 10 options (5 rounds × 2 turns)
- Role-based backgrounds (green for attacker, red for defender)
- Turn position indicators: "(1st)" and "(2nd)"
- Amber border highlights current selection
- Optimistic UI updates for instant feedback
- Player turn indicated by background brightness

**Usage:**
```tsx
<RoundTurnSelector
  battleRound={1}
  currentPlayerTurn="player"
  firstPlayer="player"
  sessionId={sessionId}
  onTurnChange={handleTurnChange}
/>
```

### 2. Turn Helper Library

**File:** `lib/turnHelpers.ts`

**Purpose:** Pure functions for turn order calculations

**Key Functions:**

```typescript
// Determine who goes first/second
getFirstPlayer(session) → 'player' | 'opponent'
getSecondPlayer(session) → 'player' | 'opponent'

// Turn position checks
isFirstTurn(session) → boolean
isSecondTurn(session) → boolean
getTurnPosition(session) → 1 | 2

// Turn progression
getNextTurn(session) → TurnState
getPreviousTurn(session) → TurnState
getSpecificTurn(round, playerTurn) → TurnState

// Display formatting
formatTurnDisplay(session) → { text, isPlayerTurn, isAttacker, turnPosition }
formatTurnContext(session) → string (for AI)

// Round advancement check
willAdvanceRound(session) → boolean
```

### 3. Turn Navigation Tool Handler

**File:** `lib/toolHandlers.ts`

**Function:** `changeTurn(args, sessionId, timestamp)`

**Purpose:** Handles manual and AI-driven turn changes

**Modes:**
- `next` - Advance to next turn (auto-advances round if needed)
- `previous` - Go back one turn (for error correction)
- `specific` - Jump to any round/turn combination

**Automatic Behaviors:**
- Resets phase to Command on turn change
- Advances round when defender's turn ends
- Resets CP extra gain flags on round advancement
- Creates timeline events with proper descriptions

---

## Turn Progression Logic

### Normal Turn Flow

```
Round 1, Attacker (1st turn)
  ↓ (change_player_turn to opponent)
Round 1, Defender (2nd turn)
  ↓ (change_player_turn to player - AUTO ADVANCES)
Round 2, Attacker (1st turn)
  ↓ (change_player_turn to opponent)
Round 2, Defender (2nd turn)
  ↓ (AUTO ADVANCES)
Round 3, Attacker (1st turn)
...
```

### Voice Command Handling

The AI understands turn context:

```typescript
Current: Round 1, Attacker
Player says: "End of my turn"
→ AI calls: change_player_turn(opponent)
→ Result: Round 1, Defender

Current: Round 1, Defender  
Player says: "End of my turn"
→ AI calls: change_player_turn(player)
→ Result: Round 2, Attacker (auto-advanced!)
```

### Manual Navigation

Users can jump to any turn via dropdown:

```
Current: Round 1, Attacker
User selects: "Round 3 - Defender"
→ Tool calls: change_turn('specific', round: 3, player_turn: second_player)
→ Result: Round 3, Defender
```

---

## User Interface

### Round/Turn Selector

**Visual Design:**
- **Attacker turns** - Green background (`bg-grimlog-green`)
- **Defender turns** - Red background (`bg-grimlog-red`)
- **Current player** - Brighter/more opaque background
- **Selected item** - Amber border with subtle glow
- **Turn position** - Inline text: "(1st)" or "(2nd)"

**Interaction:**
1. Click dropdown to see all 10 options
2. Select any round/turn
3. UI updates instantly (optimistic)
4. API call happens in background
5. Dropdown closes immediately for responsiveness

**Example Display:**
```
┌────────────────────────────────────┐
│ ROUND 1 - ATTACKER (1ST)      ▼   │  ← Green background (your turn)
└────────────────────────────────────┘

Dropdown shows:
┌────────────────────────────────────┐
│ Round 1 - Attacker (1st)      🟡   │  ← Amber border (current)
│ Round 1 - Defender (2nd)           │
│ Round 2 - Attacker (1st)           │
│ Round 2 - Defender (2nd)           │
│ ...                                │
└────────────────────────────────────┘
```

### Color Coding

| Role | Background | Text | Border (selected) |
|------|------------|------|-------------------|
| Attacker | Green (15-30% opacity) | Black | Amber |
| Defender | Red (15-30% opacity) | Black | Amber |

**Background brightness indicates whose turn:**
- Your turn → Brighter background
- Opponent's turn → Same color but different player context

---

## AI Integration

### System Prompt Context

The AI receives turn order context in every analysis:

```
Battle Round: 1
Current Phase: Command
Current Turn: Player as Attacker (1st turn of round)

TURN ORDER RULES (Attacker/Defender System):
- Player (Attacker) goes first each round (determined by roll-off at game start)
- Each round has TWO turns: Attacker goes first, then Defender
- Attacker = the player who goes first each round
- Defender = the player who goes second each round
- When Defender ends their turn, the round advances to the next round
- "End of my turn" should switch to the other player's turn OR advance the round (if this is Defender's turn)
- Always reset to Command phase when turns change
```

### Voice Command Examples

| Player Says | Current State | AI Action | Result |
|-------------|---------------|-----------|--------|
| "End of my turn" | Round 1, Attacker | `change_player_turn('opponent')` | Round 1, Defender |
| "End of my turn" | Round 1, Defender | `change_player_turn('player')` | Round 2, Attacker |
| "Start round 3" | Any state | `advance_battle_round(3)` | Round 3, Attacker |
| "Your turn now" | Round 2, Attacker | `change_player_turn('opponent')` | Round 2, Defender |

### Tool Descriptions

**change_player_turn:**
```
Change whose turn it is. Always resets phase to Command. 
Use when a player finishes their turn and passes to opponent. 
IMPORTANT: This tool automatically advances the round when 
the 2nd player ends their turn. You don't need to manually 
check or advance rounds.
```

**advance_battle_round:**
```
Move to the next battle round. Automatically resets to 
Command phase and sets turn to whoever goes first each round. 
Use when player explicitly says 'next round', 'round 2', 
'starting round X', etc. NOTE: You usually don't need this - 
change_player_turn automatically advances rounds.
```

---

## Database Schema

### GameSession Table

**New Field:**

```prisma
model GameSession {
  // ... existing fields ...
  
  firstPlayer       String    @default("player") // "player" or "opponent" - who goes first each round
  
  // ... existing fields ...
}
```

**Purpose:** Stores which player won the roll-off and goes first each round

**Values:**
- `"player"` - User goes first each round
- `"opponent"` - Opponent goes first each round

**Default:** `"player"` for backward compatibility

---

## Related Documentation

- [Session Setup Guide](../guides/SESSION_SETUP_GUIDE.md) - How to create games with first player selection
- [Phase Control Redesign](PHASE_CONTROL_REDESIGN.md) - Related phase management system
- [AI Tool Calling](AI_TOOL_CALLING.md) - How AI interprets turn commands
- [Main README](../README.md) - Project overview
- [CHANGELOG](../../CHANGELOG.md) - Version history and changes

