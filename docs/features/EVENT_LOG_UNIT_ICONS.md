# Event Log Unit Icons

**Last Updated:** 2025-12-22  
**Status:** Complete

## Overview

Enhanced the Timeline component to display visual unit icons alongside unit names in event log entries. Icons provide immediate visual identification of units involved in game events, with contextual action indicators (colored borders and badge overlays) showing what type of action occurred.

## Features

### Unit Icon Display
- **Large Icons (48x48px)** - Prominent unit icons displayed inline with event descriptions
- **Custom Icon Support** - Displays user-uploaded custom icons when available
- **Fallback Icons** - Role-based emoji icons for units without custom icons
- **Batch Icon Resolution** - Efficient batch fetching of icons for all units in events using `useUnitIcons` hook

### Action Category Indicators

**Colored Borders** - Visual categorization by action type:
- **Red Border** - Damage events (units taking wounds, models destroyed)
- **Amber Border** - Stratagem usage
- **Purple Border** - Unit actions (deep strike, charge, advance, etc.)
- **Blue Border** - Status changes (battleshock, effects)
- **Gray Border** - Neutral events (default)

**Badge Overlays** - Small circular badges in bottom-right corner with specific details:
- **Damage Events:**
  - `-1`, `-2`, etc. for models killed
  - `💀` for unit destroyed
  - `⚔` for general damage
- **Stratagem Events:**
  - `-1`, `-2` for CP cost
  - `◆` if no CP specified
- **Unit Actions:**
  - `↓` for deep strike
  - `⚔` for charge
  - `→` for advance
  - `←` for fall back
  - `⚡` for heroic intervention
  - Additional symbols for other actions
- **Status Changes:**
  - `⚡` for battleshock
  - `◈` for other effects

## Technical Implementation

### Component Changes

**`components/Timeline.tsx`:**
- Added `attackerFaction` and `defenderFaction` props for icon resolution
- Created `extractUnitInfoFromEvent()` helper to parse unit metadata from events
- Added `getActionCategoryFromEvent()` helper to determine action type and styling
- Integrated `useUnitIcons` hook for batch icon fetching
- Enhanced event rendering with icon display and action indicators

**`app/page.tsx`:**
- Passes faction information to Timeline component

### Icon Resolution

Icons are resolved using the existing icon infrastructure:
- Checks for custom uploaded icons via `/api/icons/resolve`
- Falls back to role-based emoji icons from `getUnitIcon()` utility
- Batch fetching minimizes API calls for multiple units

### Metadata Parsing

The system extracts unit information from event metadata fields:
- `unitName` - Primary unit name field
- `defendingUnit` / `attackingUnit` - Combat event fields
- `owner` / `defendingPlayer` / `attackingPlayer` - Player identification
- Maps owner to faction for proper icon resolution

### Action Detection

Action categories are determined by analyzing event metadata:
- **Damage:** `woundsLost`, `modelsLost`, `modelsKilled`, `isDestroyed`
- **Stratagem:** `eventType === 'stratagem'`, `stratagemName`, `cpCost`
- **Actions:** `actionType` field with specific action symbols
- **Status:** `isBattleShocked`, `addedEffects`, `removedEffects`

## Visual Design

- **Icon Size:** 48x48px (w-12 h-12) for clear visibility
- **Border Width:** 2px for action categories, 1px for neutral
- **Badge Size:** 20x20px (min-w-5 h-5) circular overlay
- **Badge Position:** Bottom-right corner with -bottom-1 -right-1 offset
- **Styling:** Consistent with existing UnitHealthSheet icon display patterns

## User Experience

- **At-a-Glance Recognition** - Users can quickly identify units involved in events
- **Action Context** - Colored borders and badges provide immediate action type recognition
- **Visual Hierarchy** - Icons make unit-related events stand out in the timeline
- **Consistent Design** - Matches existing icon display patterns throughout the app

## Related Documentation

- [Timeline Animations](TIMELINE_ANIMATIONS.md) - Event log display system
- [Unit Icon Generation](UNIT_ICON_GENERATION.md) - Custom icon creation
- [Icons Resolve Endpoint](../api/ICONS_RESOLVE_ENDPOINT.md) - Icon resolution API

