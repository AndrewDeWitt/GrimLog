# Tactical Map User Guide

**Last Updated:** 2025-12-21
**Status:** Complete

## Overview

This guide explains how to use the Tactical Map system to visually track objective control during your Warhammer 40K games. The tactical map provides a clear battlefield visualization matching official mission deployment cards, with comprehensive timeline tracking and optimistic UI updates for instant feedback.

## Table of Contents

- [Overview](#overview)
- [Opening the Tactical Map](#opening-the-tactical-map)
- [Understanding the Map](#understanding-the-map)
- [Controlling Objectives](#controlling-objectives)
- [Deployment Types](#deployment-types)
- [Mobile Usage](#mobile-usage)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Opening the Tactical Map

### From Active Session

**Primary Method (v4.42.2+):**
1. Navigate to your active game session (main page)
2. Locate the **Objective Control** section (between Round header and player panels)
3. **Tap the split bar chart** - The large colored bar showing objective breakdown
4. The **Tactical Map Bottom Sheet** slides up from the bottom of the screen.

**Visual Cues:**
- Split bar has 3D shadow depth (looks like a button)
- Tapping provides active feedback (slight scale down)
- The modal uses a light slate header with a drag handle, matching other system controls.

### Keyboard Shortcuts

- **ESC** - Close the tactical map and return to session
- **ESC** - Close objective timeline panel (if open)

## Understanding the Map

### Map Elements

**Deployment Zones** (Colored Areas)
- **Green (Defender)** - Your deployment zone with dashed green border
- **Red (Attacker)** - Opponent deployment zone with dashed red border
- **Gray (Neutral)** - No man's land areas

**Reference Lines**
- **Center Crosshairs** - Subtle dashed lines at 30" horizontal and 22" vertical
- **Outer Border** - Thin gray line defining the 60×44 battlefield edge
- **Custom Dividers** - Deployment-specific lines (e.g., attacker connection in Search and Destroy)

**Objective Markers**
- **Numbers 1-5** - White numbers identify each objective
- **Circle Colors** - Current control state:
  - Red = Attacker control (`grimlog-red`)
  - Green = Defender control (`grimlog-green`)
  - Amber = Contested (`grimlog-amber`)
  - Gray = Unclaimed (`grimlog-steel`)
- **Pulsing Glow** - Subtle animation for visibility
- **Orange Highlight** - Appears when selecting

**Map Header**
- **Deployment Name** - Shows which deployment map you're using (e.g., "HAMMER AND ANVIL")
- **Round Indicators** - Circular badges showing rounds 1-5 integrated into the slate header
  - Current round: Orange with glowing ring
  - Past rounds: Steel gray
  - Future rounds: White with border
- **Close Button** - Standard 'X' in the top right of the header

**Legend** (Footer)
- Located in the light slate footer area
- Provides a clear key for Attacker, Defender, Contested, and Unclaimed states

**Timeline Button** (In-Map)
- **Location** - Floating button in the top right of the map area
- **Content** - Chronological list of objective changes
- **Each Entry Shows:**
  - Objective number
  - Round and phase (e.g., "R3 • Shooting")
  - State transition ("Defender → Attacker")
  - Timestamp
- **Close** - Click X or toggle button again

## Controlling Objectives

### Changing Objective Control

1. **Click any objective marker** - A popup appears directly above the objective
2. **Select the control state:**
   - **Attacker** (Red button) - Attacker controls this objective
   - **Defender** (Green button) - Defender controls this objective
   - **Contested** (Amber button) - Both players have units nearby
   - **Unclaimed** (Gray button) - No player controls it
3. **Confirmation** - Map updates immediately, timeline event logged, toast notification appears

### Popup Features

- **2×2 Grid Layout** - Four buttons in compact arrangement (260-320px width)
- **Mobile-Optimized** - 48px minimum button height, improved spacing (`gap-3`), larger text (`text-sm`)
- **Grim Dark Colors** - Uses Grimlog color palette for consistent theming
- **Better Contrast** - White text on dark backgrounds, black text on amber
- **Touch-Friendly** - Generous padding (`px-4 py-3`), active scale feedback
- **Smart Positioning** - Always appears above the objective you clicked, auto-flips near edges
- **Easy Dismissal** - Click outside popup or on the backdrop to close

## Mobile Usage

### Touch-Optimized Features

- **Bottom Sheet Pattern** - Natural mobile gesture interaction with drag handle
- **Larger Objective Markers** - 3.2" radius circles for easy tapping
- **Generous Tap Targets** - 5.5" radius hit area around each objective
- **Button Sizing** - Standardized 48px targets for reliable touch interaction
- **Split Bar** - Large 48px height dashboard trigger
- **Portal Modal** - Renders correctly over all UI elements

## Related Documentation

- [Tactical Map Feature Doc](../features/TACTICAL_MAP.md) - Technical implementation details
- [Modal Standardization](../features/MODAL_STANDARDIZATION.md) - UI design patterns
- [Manual UI Controls](../features/MANUAL_UI_CONTROLS.md) - All manual control systems
- [API: Manual Action Endpoint](../api/MANUAL_ACTION_ENDPOINT.md) - API reference for objective updates
