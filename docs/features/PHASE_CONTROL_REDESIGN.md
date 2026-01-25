# Phase Control Redesign & Player Turn Management

**Version:** 3.9.0  
**Date:** October 30, 2025  
**Status:** Completed

## Overview

Redesigned the phase control interface to be more streamlined and intuitive by consolidating the player turn toggle into the round counter header and implementing proper event logging for turn changes.

## Problems Addressed

1. **Clunky UI**: The original phase control had three separate buttons (Phase dropdown, Player toggle, Next button) that felt cramped and confusing
2. **Focus/Blur Shifting**: Phase dropdown button had visual shifting issues when gaining/losing focus
3. **Missing Turn Change Events**: Player turn changes weren't creating proper timeline events
4. **Phase Logic**: Turn changes needed to always reset to Command phase (to match Warhammer 40K game flow)
5. **Excessive Notifications**: Toast notifications were redundant with event log animations
6. **Timeline UI Issues**: "NEW" badge and horizontal scrolling were jarring

## Changes Implemented

### 1. Phase Control Simplification

**Files Modified:**
- `components/PhaseControl.tsx`
- `components/GameStateDisplay.tsx`

**Changes:**
- **Removed** the separate "YOU/OPP" player toggle button
- **Removed** the "NEXT →" button
- **Kept** only the phase dropdown for phase selection
- **Removed** `onShowToast` prop and all toast notifications
- **Fixed** focus/blur visual shifting by:
  - Adding `focus:outline-none` to remove default browser outline
  - Adding custom focus ring: `focus:ring-2 focus:ring-grimlog-orange`
  - Using inline `boxShadow` style instead of CSS classes that could conflict

**Result:** Cleaner, single-purpose component focused only on phase selection.

### 2. Player Turn Toggle in Round Header

**Files Modified:**
- `components/GameStateDisplay.tsx`

**Changes:**
- Converted "ROUND 1" text to clickable button
- Now displays: `ROUND {number} (YOU)` or `ROUND {number} (OPPONENT)`
- Color-coded based on current player:
  - **Green** for player's turn (`text-grimlog-player-green-text`)
  - **Red** for opponent's turn (`text-grimlog-opponent-red-text`)
- Added hover effects: `hover:scale-105` and color brightening
- Clicking the round header toggles between player and opponent turn

**Code:**
```typescript
<button
  onClick={handleTogglePlayerTurn}
  className={`text-sm font-bold tracking-wider uppercase transition-all hover:scale-105 cursor-pointer ${
    currentPlayerTurn === 'player'
      ? 'text-grimlog-player-green-text hover:text-grimlog-player-green'
      : 'text-grimlog-opponent-red-text hover:text-grimlog-opponent-red'
  }`}
  title="Click to toggle player turn"
>
  ROUND {battleRound} ({currentPlayerTurn === 'player' ? 'YOU' : 'OPPONENT'})
</button>
```

### 3. New AI Tool: `change_player_turn`

**Files Modified:**
- `lib/aiTools.ts`
- `lib/toolHandlers.ts`

**New Tool Definition:**
```typescript
{
  type: "function",
  name: "change_player_turn",
  description: "Change whose turn it is. Always resets phase to Command. Use when a player finishes their turn and passes to opponent.",
  parameters: {
    type: "object",
    properties: {
      player_turn: {
        type: "string",
        enum: ["player", "opponent"],
        description: "Whose turn it is now (player = the person speaking)"
      }
    },
    required: ["player_turn"],
    additionalProperties: false
  }
}
```

**Handler Implementation:**
```typescript
async function changePlayerTurn(args: ChangePlayerTurnArgs, sessionId: string, customTimestamp?: Date): Promise<ToolExecutionResult> {
  // Always reset to Command phase when changing player turn
  const newPhase = 'Command';
  
  // Update session with new turn and reset phase
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      currentPhase: newPhase,
      currentPlayerTurn: args.player_turn
    }
  });

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'phase',
      phase: newPhase,
      description: `Phase changed to ${newPhase} (${args.player_turn}'s turn)`,
      metadata: JSON.stringify({ playerTurn: args.player_turn, turnChange: true }),
      timestamp: customTimestamp || new Date()
    }
  });

  // Invalidate session cache
  invalidateSessionCaches(sessionId, false);

  return {
    toolName: 'change_player_turn',
    success: true,
    message: `Changed to ${args.player_turn}'s turn (Command phase)`,
    data: { phase: newPhase, playerTurn: args.player_turn },
  };
}
```

**Why This Matters:**
- Supports AI voice command workflow
- Creates proper event log entries
- Always resets to Command phase (matches game rules - when you finish your turn, opponent starts at Command)
- Consistent with other manual actions in the system

### 4. Event Logging for Turn Changes

**Timeline Event Format:**
```
Phase changed to Command (player's turn)
Phase changed to Command (opponent's turn)
```

**Event Metadata:**
```json
{
  "playerTurn": "player|opponent",
  "turnChange": true
}
```

The `turnChange: true` flag in metadata distinguishes turn changes from regular phase changes.

### 5. Removed Toast Notifications

**Rationale:** Event log animations provide sufficient visual feedback. Toast notifications were:
- Redundant with event log
- Created visual clutter
- Competing for user attention

**Changes:**
- Removed `onShowToast` calls from phase change handlers
- Kept `onShowToast` prop in GameStateDisplay for other features (objectives, etc.)
- Errors now logged to console for debugging

### 6. Timeline Visual Improvements

**Files Modified:**
- `components/Timeline.tsx`

**Changes:**
1. **Removed "NEW" Badge:**
   - Eliminated the orange "NEW" badge that appeared on new events
   - Badge was jarring and unnecessary with animation effects
   - Events still animate with slide-down bounce and glow pulse

2. **Fixed Horizontal Scrolling:**
   - Added `overflow-x-hidden` to timeline container
   - Prevents animations from triggering horizontal scrollbar
   - Container class: `flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2`

**Remaining Visual Feedback:**
- Slide-down bounce animation on new events
- Glow pulse effect (3 cycles, 1.5s each)
- Thicker left border on new events (6px vs 4px)
- All animations contained within the timeline panel

## User Workflow

### Changing Phases
1. Click the phase dropdown (shows current phase)
2. Select desired phase from dropdown
3. Phase changes with dropdown closing automatically
4. Event log updates with animation

### Changing Player Turn
1. Click the round header (e.g., "ROUND 1 (YOU)")
2. Automatically switches to opposite player
3. Phase automatically resets to Command
4. Round header updates color and text
5. Event log shows "Phase changed to Command ([player]'s turn)"

### AI Voice Commands
The system now supports:
- "It's my opponent's turn" → triggers `change_player_turn`
- "I'm done, your turn" → triggers `change_player_turn`
- "Moving to Shooting phase" → triggers `change_phase` (keeps same player)

## Technical Details

### Optimistic Updates
Both phase and turn changes use optimistic UI updates:
1. UI updates immediately on button click
2. API call made in background
3. On success: timeline refreshes
4. On failure: UI rolls back to previous state

### Cache Invalidation
Turn changes invalidate session cache patterns:
- `/api/sessions/${sessionId}`
- `/api/sessions/${sessionId}/events`

### Component Props Changes

**PhaseControl.tsx:**
```typescript
// REMOVED
onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;

// KEPT
currentPhase: GamePhase;
currentPlayerTurn: 'player' | 'opponent';
battleRound: number;
sessionId: string;
onPhaseChange: (phase: GamePhase, playerTurn: 'player' | 'opponent') => void;
onPhaseChangeComplete?: () => void;
```

## Benefits

1. **Cleaner UI**: Reduced from 3 buttons to 1 dropdown
2. **Better UX**: Natural location for turn indicator (round header)
3. **Visual Clarity**: Color-coding makes current player immediately obvious
4. **Proper Events**: Turn changes now create timeline entries
5. **Game Logic**: Automatic Command phase reset matches game rules
6. **Less Clutter**: No redundant toast notifications
7. **Smooth Animations**: No jarring badges or scrolling issues

## Testing Checklist

- [x] Phase dropdown opens/closes smoothly
- [x] No visual shifting on focus/blur
- [x] Click-outside closes dropdown
- [x] Round header shows correct player with color coding
- [x] Clicking round header toggles turn and resets to Command
- [x] Turn changes create timeline events
- [x] No toast notifications on phase/turn changes
- [x] No horizontal scrolling in timeline
- [x] No "NEW" badge appears
- [x] Event animations stay contained
- [x] Optimistic updates work correctly
- [x] Error rollback works on API failure

## Future Considerations

1. **Keyboard Navigation**: Add keyboard shortcuts for phase changes
2. **Touch Gestures**: Consider swipe gestures for mobile
3. **Confirmation Dialog**: Optional confirmation for turn changes in competitive play
4. **Turn Timer**: Visual timer showing turn duration
5. **Phase Presets**: Quick-select common phase sequences

## Related Documentation

- [UI Prominence Enhancement](../UI_PROMINENCE_ENHANCEMENT_V3.8.2.md)
- [Architecture Overview](../ARCHITECTURE.md)
- [API Documentation](../api/manual-action.md)
- [Code Standards](../../.cursor/rules/code-standards.mdc)

## Migration Notes

No database migrations required. The changes are purely UI and business logic updates. Existing sessions will work without modification.

## Performance Impact

- **Minimal**: Removed toast notifications reduce DOM manipulation
- **Cache**: Proper invalidation ensures data consistency
- **Animations**: CSS-based animations are GPU-accelerated
- **Network**: One API call per turn change (same as before)

