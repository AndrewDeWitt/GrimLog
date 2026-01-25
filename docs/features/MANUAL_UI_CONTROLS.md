# Manual UI Controls

**Last Updated:** 2025-10-25
**Status:** Complete

## Overview

The Manual UI Controls system provides comprehensive manual alternatives for all voice-automated game actions. Every action that can be performed via voice commands now has a corresponding UI control, ensuring users always have manual override capability regardless of voice recognition availability or AI accuracy.

This feature ensures that voice automation and manual UI controls are equal citizens in the application, with both methods creating identical timeline events and database updates.

## Table of Contents

- [Overview](#overview)
- [Core Principle](#core-principle)
- [Manual Controls Available](#manual-controls-available)
- [Components](#components)
- [API Integration](#api-integration)
- [User Experience](#user-experience)
- [Technical Architecture](#technical-architecture)
- [Known Issues](#known-issues)
- [Related Documentation](#related-documentation)

## Core Principle

**Design Philosophy:** Every automated action must have a manual override.

Voice automation is powerful, but users need the ability to:
- Correct AI mistakes immediately
- Perform actions when voice recognition fails
- Manually track game state during technical issues
- Have full control over their game tracking experience

## Manual Controls Available

### ✅ Phase Transitions
**Component:** `PhaseControl.tsx` (integrated in GameStateDisplay header)

**Controls:**
- **Phase Dropdown** - Select any phase directly (Command, Movement, Shooting, Charge, Fight)
- **Next Phase Button** - Cycle through phases sequentially
- **Turn Toggle** - Switch between player/opponent turn

**Location:** Top of GameStateDisplay, visible at all times

**API:** Calls `/api/sessions/[id]/manual-action` with `change_phase` tool

### ✅ Victory Points
**Enhancement:** Extended GameStateDisplay component

**Controls:**
- **± Button** - Opens VP adjustment panel
- **Quick Buttons:** -5 VP, -1 VP, +1 VP, +5 VP
- Separate controls for player and opponent

**Location:** Next to VP display in each player panel

**API:** Updates session VP and creates timeline event

### ✅ Command Points
**Status:** Already existed (enhanced for consistency)

**Controls:**
- **± Button** - Opens CP adjustment panel
- **Quick Buttons:** -1 CP, +1 CP

**Location:** Next to CP display in each player panel

**API:** Updates session CP and creates timeline event

### ✅ Secondary Objectives
**Component:** `SecondaryObjectivesModal.tsx`

**Controls:**
- **Tabbed Interface** - Switch between player/opponent secondaries
- **3 Text Inputs** per player (max 3 secondaries)
- **Save/Clear Buttons** - Persist or reset secondaries

**Location:** "EDIT" button in Secondaries section of GameStateDisplay

**API:** Calls `set_secondary_objectives` tool format

### ✅ Objective Markers
**Component:** `TacticalMapView.tsx` (full-screen modal)

**Controls:**
- **Interactive Tactical Map** - Visual battlefield representation with 10 deployment types
- **Objective Markers** - Click to open state selection popup
- **State Selection Popup** - 4 buttons: Your Control, Opponent Control, Contested, Unclaimed
- **Deployment Zones** - Color-coded visual representation of deployment areas
- **Always Horizontal** - Standard 60×44 orientation

**Location:** "ADJUST" button next to Objectives in GameStateDisplay

**API:** Calls `update_objective_control` for each objective (single log entry per selection)

**Interaction:** Click objective → Popup opens → Select desired state → Confirms and logs once

### ✅ Stratagem Logging
**Component:** `StratagemLoggerModal.tsx`

**Controls:**
- **Player/Opponent Toggle** - Select who used the stratagem
- **Stratagem Name Input** - Free text entry
- **CP Cost Buttons** - Select 1, 2, or 3 CP
- **Target Unit Input** - Optional target specification
- **Description Field** - Optional context
- **CP Validation** - Prevents submission if insufficient CP

**Location:** "LOG STRATAGEM" button in HamburgerMenu

**API:** Calls `log_stratagem_use` tool, deducts CP, creates log entry

### ✅ Battle Round
**Status:** Already existed

**Controls:**
- **ROUND Button** in HamburgerMenu

**API:** Advances battle round and resets to Command phase

### ✅ Unit Health
**Status:** Active - Unit Health Sheet (bottom sheet)

**Controls:**
- Unit-level model/wound adjustments (inline)
- Per-model wound tracking (grid)
- Per-model max-wounds edits for mixed wound profiles (e.g., relic shields)
- Battle-shock toggling and unit destruction
- Generated unit icon display (datasheet-linked)

**Location:** Battle screen **⚔ Unit Health** FAB (opens bottom sheet)

## Components

### PhaseControl.tsx
Inline component for phase management integrated into GameStateDisplay header.

**Features:**
- Dropdown with all 5 phases
- Next button for sequential progression
- Turn indicator button
- Optimistic UI updates with server sync

### SecondaryObjectivesModal.tsx
Modal dialog for setting and editing secondary objectives.

**Features:**
- Tabbed interface (player/opponent)
- Up to 3 secondaries per player
- Validation (minimum 1 secondary required)
- Clear button to reset
- Auto-close on save

### StratagemLoggerModal.tsx
Form-based modal for logging stratagem usage.

**Features:**
- Player selection with current CP display
- CP cost validation
- Optional target and description fields
- Disabled state when insufficient CP
- Auto-close on successful submission

### TacticalMapView.tsx
Visual battlefield representation with deployment zones and objectives.

**Features:**
- SVG-based rendering with proper aspect ratios
- 3 deployment types (Crucible of Battle, Hammer and Anvil, Dawn of War)
- Separate portrait/landscape configurations
- Interactive objective markers with hover states
- Pulsing glow animation on objectives
- Color-coded deployment zones

### ObjectiveMarkersControl.tsx
Legacy grid-based objective control (superseded by TacticalMapView but still functional).

**Features:**
- 6-button grid layout
- Click to cycle control states
- Visual legend

**Note:** This component is currently used by TacticalMapView but can function standalone.

## API Integration

### Manual Action Endpoint

**Route:** `POST /api/sessions/[id]/manual-action`

**Purpose:** Unified endpoint for all manual UI actions, reusing the same tool execution logic as voice commands.

**Request Format:**
```json
{
  "toolName": "change_phase",
  "args": {
    "new_phase": "Shooting",
    "player_turn": "player"
  }
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "Changed to Shooting phase (player's turn)",
  "data": {
    "phase": "Shooting",
    "playerTurn": "player",
    "inputMethod": "manual"
  },
  "validation": null
}
```

**Implementation:**
- Requires authentication
- Reuses `executeToolCall` from `lib/toolHandlers.ts`
- Marks events with `inputMethod: "manual"` metadata
- Returns validation warnings if rule violations detected
- Creates timeline events identical to voice commands

## User Experience

### Before Manual Controls

❌ Users must use voice or wait for AI detection
❌ No way to correct AI mistakes manually  
❌ Limited control during technical issues
❌ Voice failures block game tracking

### After Manual Controls

✅ Every voice action has manual alternative
✅ UI and voice are equal citizens
✅ Easy corrections and manual override
✅ Consistent event logging regardless of input method
✅ Full game tracking even without microphone

## Technical Architecture

### Design Pattern: Command Reuse

All manual actions use the **same backend logic** as voice commands:

```typescript
// Voice path
analyzeAPI → executeToolCall(toolName, args) → database update

// Manual path
manualActionAPI → executeToolCall(toolName, args) → database update
```

This ensures:
- Consistent validation
- Identical database updates
- Same timeline event format
- No duplicate code

### State Management Flow

1. **User Action** - Click button/submit form
2. **API Call** - POST to `/api/sessions/[id]/manual-action`
3. **Tool Execution** - Reuse voice command handlers
4. **Database Update** - Update session/create events
5. **Cache Invalidation** - Clear stale cached data
6. **UI Refresh** - Re-fetch session state
7. **Toast Notification** - Show success/error feedback

### Event Logging

All manual actions create timeline events with:
- Standard tool format (same as voice)
- `inputMethod: "manual"` metadata flag
- Timestamp
- Phase context
- Complete action details

## Known Issues

### Tactical Map Alignment (In Progress)

**Issue:** Crucible of Battle deployment zones and objective positions need refinement.

**Status:** Core functionality works, visual alignment being polished.

**Workaround:** Users can still click objectives to change control states; visual representation is approximate.

**Tracking:** Will be addressed in future iteration.

### Database Migration Pending

**Issue:** `deploymentType` field added to schema but migration not yet applied to production database.

**Status:** Schema change ready, requires `npx prisma db push` when database is accessible.

**Workaround:** Application defaults to 'crucible-of-battle' if field is missing.

## Related Documentation

- [Tactical Map Feature](TACTICAL_MAP.md) - Visual battlefield system details
- [Game State Tracking](GAME_STATE_TRACKING.md) - Overall state management
- [Voice Commands](VOICE_COMMANDS.md) - Voice automation system
- [API: Manual Action Endpoint](../api/MANUAL_ACTION_ENDPOINT.md) - API reference
- [Guide: Session Management](../guides/SESSION_MANAGEMENT_GUIDE.md) - User guide for sessions



