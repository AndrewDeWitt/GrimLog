# Round/Phase Controls Redesign

**Last Updated:** 2025-12-21  
**Status:** Complete  
**Version:** 4.42.1

## Overview

The Round/Turn and Phase controls were redesigned to match Grimlog's lighter grimdark aesthetic while optimizing for iPad-first mobile interaction. The redesign removes visual clutter, improves readability, and ensures critical game state information (round, turn, phase) is always visible without requiring dropdown interaction.

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Summary](#solution-summary)
- [Design Decisions](#design-decisions)
- [Component Changes](#component-changes)
- [Technical Implementation](#technical-implementation)
- [Mobile Optimization](#mobile-optimization)
- [Related Documentation](#related-documentation)

## Problem Statement

### Issue 1: Dark Controls on Light Background
The Round/Turn and Phase dropdown controls used dark translucent backgrounds (`bg-grimlog-black`, `bg-orange-900/25`) that didn't match the light slate header theme introduced in v4.33.0. This created visual inconsistency and made the controls feel disconnected from the rest of the UI.

### Issue 2: Text Truncation
Fixed-width controls (`min-w-[240px]`) caused text truncation with ellipses, forcing users to open dropdowns just to see the current round or phase. This violated the principle that critical game state should be immediately visible.

### Issue 3: Visual Clutter
- Time/clock icon consumed horizontal space without adding value
- "(1st)/(2nd)" turn order text was redundant (ATT/DEF already indicates whose turn)
- Attacker/defender color tinting on entire button surfaces was too subtle and hard to distinguish

### Issue 4: Mobile Unfriendly
Large fixed widths and excessive padding made controls dominate the header on iPad/phone screens, reducing available space for other UI elements.

## Solution Summary

### 1. Light Slate Control Surfaces
- Replaced dark backgrounds with **neutral white/slate** (`bg-white`, `bg-grimlog-slate-light`)
- Removed all attacker/defender background tinting from button surfaces
- Maintained industrial depth via existing `btn-depth-sm` and `hover-lift` utilities

### 2. Turn Indication (Minimal)
- **Round/Turn control** uses styled **ATTACKER/DEFENDER labels**:
  - Attacker: `bg-grimlog-red` with white text
  - Defender: `bg-grimlog-defender-border` with white text
- **Phase control** uses a **small turn-colored marker** near the chevron (no chip, no extra text) to avoid redundancy while still signaling whose turn it is.

### 3. Always-Visible Context with Visual "Pop"
- **Two-line label layout** prevents truncation:
  - Top line: "ROUND X" or "PHASE" (smaller, uppercase). Round number is highlighted in **Grimlog Orange**.
  - Bottom line: "ATTACKER" / "DEFENDER" or phase name (larger, bold).
- **Orange Readout:** Phase names ("Command", "Movement", etc.) are rendered in **Grimlog Orange** with wider letter spacing (`tracking-widest`) to draw the eye to the current game state.
- **Increased font sizes** (`text-sm sm:text-base`) for primary values to improve scannability on small screens.
- Text wraps naturally instead of truncating.
- No ellipses - full context always visible.

### 4. SVG Visual Aids
- **Round/Turn control**: Round dial icon + gladius (attacker) / shield (defender) icons
- **Phase control**: Per-phase icon (Command sun, Movement arrow, Shooting target, Charge lightning, Fight X)
- Icons sized at 16px (`w-4 h-4`) for mobile readability
- Neutral steel color (`text-grimlog-steel`) maintains grimdark aesthetic

### 5. Space Optimization
- **Removed time/clock icon** (freed ~20px horizontal space)
- **Removed "(1st)/(2nd)" text** (redundant, saved ~40px)
- Responsive widths: full-width on mobile, fixed (`sm:w-[20rem]` / `sm:w-[14rem]`) on tablet+

### 6. Compact Mobile Layout & Tap Targets
- Fixed height: **44px** (`h-11`) for consistent thumb-friendly targets.
- **Large Dropdown Items:** Padding increased to `py-3` (12px) to ensure each menu item meets the **48px touch target** standard.
- Reduced padding: `px-3` (was `px-4`) for header buttons.
- Flex layout allows natural wrapping on small screens.

## Design Decisions

### Why Remove Background Tinting?
**Decision:** Remove attacker/defender color tinting from entire button surfaces.

**Rationale:**
- Subtle tints (`bg-grimlog-attacker-bg/10`) were hard to distinguish on light slate backgrounds
- Created visual noise without adding clarity
- ATT/DEF chip provides sufficient turn identification

**Result:** Cleaner, more scannable controls with clear visual hierarchy.

### Why Remove Turn Order Text?
**Decision:** Remove "(1st)/(2nd)" labels entirely.

**Rationale:**
- Redundant information - ATT/DEF already indicates whose turn
- Round number provides sufficient context for turn sequence
- Freed horizontal space for more important information
- Simplified mental model (fewer labels to parse)

**Result:** Cleaner labels, better mobile space utilization.

### Why Gladius Over Chainsword?
**Decision:** Use gladius-style sword icon (not chainsword) for attacker.

**Rationale:**
- Gladius silhouette is cleaner and more recognizable at 16px
- Better handle-to-blade ratio for small icon sizes
- Chainsword details (teeth) become noise at mobile icon sizes
- Maintains Warhammer 40K aesthetic without complexity

**Result:** Clear, scannable icon that works across all screen sizes.

## Component Changes

### `components/RoundTurnSelector.tsx`
**Before:**
- Dark translucent backgrounds (`bg-orange-900/25`, `bg-green-900/25`)
- Fixed width (`min-w-[240px]`)
- Truncated text with ellipses
- Time icon + "(1st)/(2nd)" text
- Full background tinting

**After:**
- Neutral white background (`bg-white`)
- Responsive width (`w-full sm:w-[20rem]`)
- Two-line label (no truncation)
- Round dial + turn icon only
- ATT/DEF chip as sole color indicator

### `components/PhaseControl.tsx`
**Before:**
- Dark translucent backgrounds
- Fixed width (`min-w-[120px]`)
- Single-line label (truncated)
- Turn-colored left rail

**After:**
- Neutral white background
- Responsive width (`w-full sm:w-[14rem]`)
- Two-line label (no truncation)
- Phase icon + turn icon
- ATT/DEF chip as sole color indicator

### `components/ControlIcons.tsx` (NEW)
**Created:** Shared SVG icon component library

**Icons:**
- `RoundDialIcon` - Clock face for round indicator
- `SwordIcon` - Gladius-style sword for attacker
- `ShieldIcon` - Shield for defender
- `PhaseIcon` - Wrapper that returns appropriate phase icon
  - `CommandIcon` - Sun/starburst
  - `MovementIcon` - Right arrow
  - `ShootingIcon` - Target/crosshairs
  - `ChargeIcon` - Lightning bolt
  - `FightIcon` - Crossed swords/X

**Design:**
- 24x24 viewBox for consistent scaling
- `stroke="currentColor"` for theme integration
- `strokeWidth={2}` for mobile readability
- Accessible (`aria-label`, `role` attributes)

## Technical Implementation

### Styling System
Uses existing Grimlog depth utilities:
- `btn-depth-sm` - Subtle shadow for tactile feel
- `hover-lift` - 1px lift on hover with enhanced shadow
- `dropdown-shadow` - Deep shadow for floating menus

### Color Tokens
**Attacker:**
- Chip: `bg-grimlog-red` (`#b84a4a`)
- Text: `text-white`

**Defender:**
- Chip: `bg-grimlog-defender-border` (`#3a5a3a`)
- Text: `text-white`

**Neutral:**
- Background: `bg-white` / `bg-grimlog-slate-light`
- Borders: `border-grimlog-steel`
- Text: `text-grimlog-black`
- Icons: `text-grimlog-steel`

### Responsive Breakpoints
- **Mobile (< 640px):** Full-width controls, stacked layout
- **Tablet+ (≥ 640px):** Fixed widths, side-by-side layout

### Accessibility
- Proper `aria-label` attributes on buttons
- `aria-hidden` on decorative icons
- Keyboard navigation support (focus rings)
- Screen reader friendly labels

## Mobile Optimization

### iPad-First Design
- **44px height** matches iOS touch target guidelines
- **Full-width on mobile** prevents horizontal overflow
- **Natural text wrapping** prevents truncation
- **Flexible layout** adapts to available space

### Thumb-Friendly Targets
- Minimum 44px height for easy tapping
- Adequate spacing between controls (`gap-2`)
- Large dropdown hit areas (full button width)

### Space Efficiency
- Removed redundant icons/text saved ~60px horizontal space
- Two-line labels maximize information density
- Responsive widths prevent header domination

## Related Documentation

- **[UI Color System](UI_COLOR_SYSTEM.md)** - Light slate theme and color tokens
- **[Manual UI Controls](MANUAL_UI_CONTROLS.md)** - Phase and turn control functionality
- **[UI Prominence Enhancement v3.8.2](../UI_PROMINENCE_ENHANCEMENT_V3.8.2.md)** - Button depth system
