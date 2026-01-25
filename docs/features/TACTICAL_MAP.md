# Tactical Map System

**Last Updated:** 2025-12-21
**Status:** Complete
**Version:** 4.42.2

## Overview

The Tactical Map System provides a visual battlefield representation for Warhammer 40K games, allowing players to interactively manage objective marker control states through an immersive tactical interface. The system displays deployment maps in standard horizontal orientation (60"×44") and uses a geometric primitive-based rendering system for accurate zone definitions matching official mission cards. 

In version 4.42.2, the system was refactored into a standardized **Bottom Sheet Modal**, aligning it with the rest of the Grimlog UI while preserving its specialized tactical functionality.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Deployment Types](#deployment-types)
- [Technical Implementation](#technical-implementation)
- [User Interface](#user-interface)
- [Database Schema](#database-schema)
- [Related Documentation](#related-documentation)

## Features

### Standardized Bottom Sheet UI
- **Unified Design** - Matches Secondary Selection, Stratagem Logger, and Mission Selection modals.
- **Slide-Up Animation** - Familiar mobile-first interaction pattern.
- **Backdrop Blur** - Semi-transparent blurred backdrop (`bg-grimlog-black/45 backdrop-blur-[2px]`).
- **Drag Handle** - Visual indicator for sheet interaction.
- **Light Slate Header** - Standardized `grimlog-slate-dark` header with bold typography.

### Interactive Battlefield Visualization
- **SVG-based rendering** - Scalable, crisp graphics at any screen size.
- **Adaptive Layout** - `TacticalMapView` now supports an `isModal` mode to adjust its internal layout (header/legend visibility).
- **Color-coded deployment zones** - Attacker (red), Defender (green), Neutral (gray).
- **Accurate measurements** - All zones and objectives match official dimensions.
- **Center crosshairs** - Horizontal and vertical reference lines on all maps.

### Objective Control Management
- **2×2 Grid Popup** - State selector appears above clicked objective marker.
- **Four states** - Attacker Control, Defender Control, Contested, Unclaimed.
- **Smart positioning** - Popup auto-flips based on available screen space.
- **Optimistic updates** - Instant UI feedback, syncs with database after API completes.

## Technical Implementation

### Component Architecture

The system is now split into two primary components:

1. **`ObjectiveMapModal.tsx`** - Handles the modal state, portal rendering, and bottom-sheet styling.
2. **`TacticalMapView.tsx`** - Pure rendering engine for the SVG map and objective popups.

**Props for ObjectiveMapModal:**
```typescript
interface ObjectiveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  deploymentType: string;
  objectives: ObjectiveMarker[];
  battleRound: number;
  sessionId: string;
  onObjectiveClick: (objNum: number, state: string) => Promise<void>;
}
```

### Adaptive Rendering (`isModal`)

`TacticalMapView` uses the `isModal` prop to conditionally hide elements that are redundant when rendered inside the bottom sheet (like its internal header and legend), allowing the modal wrapper to handle these elements in a standard way.

### Coordinate System
Direct inch-based coordinate system:
- **X coordinate** = inches from left edge (0-60)
- **Y coordinate** = inches from top edge (0-44)
- **ViewBox** = `0 0 60 44`
- **1 SVG unit = 1 inch**

## User Interface

### Accessing the Tactical Map
Tap the **Objective Control Bar** on the main dashboard. The bar features button-style depth and active feedback to indicate it is interactive.

### Using the Map
1. **Click objective marker** - Opens the 2×2 state selector popup.
2. **Select state** - UI updates instantly via optimistic state management.
3. **View History** - Tap the floating "📜 VIEW TIMELINE" button within the map area.
4. **Close Map** - Tap the header 'X', the backdrop, or press ESC.

## Related Documentation

- [Tactical Map User Guide](../guides/TACTICAL_MAP_GUIDE.md) - Step-by-step user instructions
- [Modal Standardization](MODAL_STANDARDIZATION.md) - Details on the bottom sheet design pattern
- [Manual UI Controls](MANUAL_UI_CONTROLS.md) - Parent feature for all manual controls
- [API: Manual Action Endpoint](../api/MANUAL_ACTION_ENDPOINT.md) - API reference for objective updates
