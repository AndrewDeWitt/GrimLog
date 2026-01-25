# Secondary Selection Modal Redesign

**Last Updated:** 2025-01-27  
**Status:** Complete  
**Version:** 4.34.0

## Overview

Complete redesign of the secondary objectives selection and management modal with a grim dark aesthetic, improved readability, and mobile-first responsive design. The modal consolidates multiple legacy components into a unified, full-screen interface that dynamically adapts to the active player with proper color theming.

**Key Improvements:**
- **Grim Dark Aesthetic** - Dark industrial theme with muted player colors
- **Improved Readability** - High-contrast white text on dark backgrounds
- **Mobile-First Design** - Full-screen modal optimized for touch interactions
- **Unified Interface** - Single modal replaces 6+ legacy components
- **Player Color Theming** - Dynamic background colors based on active player tab

## Table of Contents

- [Architecture](#architecture)
- [Component Structure](#component-structure)
- [Design System](#design-system)
- [User Experience](#user-experience)
- [Technical Implementation](#technical-implementation)
- [Related Documentation](#related-documentation)

---

## Architecture

### Component Consolidation

The redesign consolidates multiple legacy components into three focused components:

**Before (Legacy):**
- `SecondaryObjectivesModal.tsx` (3 slots, deprecated)
- `SecondaryObjectivesModalNew.tsx` (2 slots, deprecated)
- `SecondarySelectionModal.tsx` (selection only)
- `SecondaryDiscardModal.tsx` (discard only)
- `SecondaryCard.tsx` (full-screen card)
- `SecondaryMiniCard.tsx` (inline card)
- `SecondaryHistory.tsx` (history panel)

**After (Current v4.34.0):**
- `SecondaryModal.tsx` - Main full-screen modal with player tabs (management hub)
- `SecondaryDetailModal.tsx` - Unified compact modal for viewing and scoring (replaces ScoringBottomSheet)
- `SecondarySelectionModal.tsx` - Compact bottom-sheet modal for selecting new secondaries
- `SecondaryCardLarge.tsx` - Large card component for displaying secondaries in full modal
- `SecondaryMiniCard.tsx` - Simplified inline mini card (triggers detail modal directly)

### Component Hierarchy (v4.34.0)

```
SecondaryModal (Full-screen container - Management Hub)
├── Header (Title, VP total, Close button)
├── Player Tabs (Defender/Attacker switcher)
├── Main Content
│   ├── SecondaryCardLarge (x2) - Side-by-side on tablet, stacked on mobile
│   └── Selection List (when adding secondary)
└── Footer (Mission mode, History button, Add button)
    └── Opens SecondaryDetailModal when card tapped

SecondaryDetailModal (Unified Compact Modal - Scoring & Viewing)
├── Header (Secondary name, VP badge, badges, close button)
├── Scoring Options (VP buttons with turn cap logic)
├── Full Rules (Collapsible details section)
└── Actions (Discard, Close)
    └── Bottom-sheet on mobile, centered on tablet/desktop

SecondarySelectionModal (Compact Selection Modal)
├── Header (Title, player/mission info, close button)
├── Random Draw Button (Tactical mode only)
├── Selection List (Available secondaries)
└── Footer (Cancel button)
    └── Bottom-sheet on mobile, centered on tablet/desktop

SecondaryMiniCard (Inline Mini Card)
└── Triggers SecondaryDetailModal (if filled) or SecondarySelectionModal (if empty)
```

**Key Changes in v4.34.0:**
- `ScoringBottomSheet` deleted - functionality merged into `SecondaryDetailModal`
- `SecondaryMiniCard` simplified - removed inline expanded modal (180+ lines removed)
- New `SecondarySelectionModal` for compact secondary selection
- Consistent modal experience across all entry points

---

## Component Structure

### SecondaryModal.tsx

**Purpose:** Main container for secondary objectives management

**Key Features:**
- Full-screen modal overlay
- Dynamic player-colored background (`bg-grimlog-defender-bg-dark` / `bg-grimlog-attacker-bg-dark`)
- Player tab switching (Defender left, Attacker right)
- Selection list for adding secondaries
- History panel (collapsible in footer)
- Mission mode display (Fixed/Tactical)

**Props:**
```typescript
interface SecondaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  attackerSecondaries: string[];
  defenderSecondaries: string[];
  attackerProgress: SecondaryProgressMap;
  defenderProgress: SecondaryProgressMap;
  allSecondaries: SecondaryObjective[];
  missionMode: MissionMode;
  currentRound: number;
  currentTurn: string;
  onScore: (player, secondaryName, vp, details) => void;
  onAddSecondary: (player, secondaryName) => void;
  onRemoveSecondary: (player, secondaryName) => void;
  onShowToast: (message, type) => void;
  initialTab?: 'attacker' | 'defender';
}
```

**State Management:**
- `activeTab` - Current player tab ('attacker' | 'defender')
- `detailModalOpen` - Controls SecondaryDetailModal visibility (replaces scoringSheetOpen)
- `selectedSecondary` - Currently selected secondary for scoring/viewing
- `showSelectionList` - Toggles selection list view
- `showHistory` - Toggles history panel

### SecondaryCardLarge.tsx

**Purpose:** Large, high-contrast card for displaying secondary objectives

**Key Features:**
- Dark industrial gray background (`bg-grimlog-gray`)
- Player-colored border (green for defender, red for attacker)
- Circular VP progress indicator with player-colored fill
- White text for maximum readability
- Empty state with "Add Secondary" button
- Category badge (TAC/FIX) in top-right corner
- Turn cap indicator when applicable

**Design Principles:**
- **Grim Dark Aesthetic** - Dark backgrounds with muted accents
- **High Contrast** - White text on dark gray for readability
- **Player Identity** - Colored borders and progress rings
- **Visual Hierarchy** - Large VP numbers, clear secondary names

**Props:**
```typescript
interface SecondaryCardLargeProps {
  secondary: SecondaryObjective | null;
  progress: SecondaryProgress | null;
  player: 'attacker' | 'defender';
  onTap: () => void;
  onAdd: () => void;
}
```

### SecondaryDetailModal.tsx (v4.34.0)

**Purpose:** Unified compact modal for viewing and scoring secondary objectives

**Key Features:**
- Bottom-sheet style on mobile, centered modal on tablet/desktop
- Compact header with secondary name and VP badge (only shows when VP > 0)
- High-contrast design: light muted backgrounds (`#d4918f` red, `#a8c4a8` green) with dark text
- Displays scoring options from rules engine
- Turn cap enforcement and warnings
- Tactical mission scoring restrictions
- Collapsible full rules section
- Discard functionality

**Props:**
```typescript
interface SecondaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  secondary: SecondaryObjective | null;
  progress: SecondaryProgress | null;
  player: 'attacker' | 'defender';
  missionMode: MissionMode;
  currentRound: number;
  currentTurn: string;
  onScore: (vpAmount, details, optionIndex) => void;
  onDiscard: () => void;
}
```

### SecondarySelectionModal.tsx (v4.34.0)

**Purpose:** Compact bottom-sheet modal for selecting new secondary objectives

**Key Features:**
- Bottom-sheet style on mobile, centered modal on tablet/desktop
- Random draw button for Tactical missions
- Scrollable list of available secondaries
- Filters out already-used secondaries
- Mission mode compatibility checking
- High-contrast design matching SecondaryDetailModal

**Props:**
```typescript
interface SecondarySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: 'attacker' | 'defender';
  missionMode: MissionMode;
  availableSecondaries: SecondaryObjective[];
  onSelect: (secondaryName: string) => void;
  onShowToast: (message, type) => void;
}
```

### SecondaryMiniCard.tsx (v4.34.0)

**Purpose:** Simplified inline mini card for main game view

**Key Features:**
- Compact 48px height for consistency
- Shows VP badge only when scored (no "/20" display)
- High-contrast dark text (`text-gray-900`) for readability
- Triggers `SecondaryDetailModal` when tapped (if filled)
- Triggers `SecondarySelectionModal` when tapped (if empty)
- Removed inline expanded modal (180+ lines of code removed)

**Props:**
```typescript
interface SecondaryMiniCardProps {
  secondary: SecondaryObjective | null;
  progress: SecondaryProgress | null;
  player: 'attacker' | 'defender';
  battleRound: number;
  currentTurn: 'attacker' | 'defender';
  onOpenDetail: (secondary, player) => void;
  onAddSecondary: (player) => void;
}
```

---

## Design System

### Color Palette

**Modal Backgrounds (v4.34.0):**
- Full Modal (SecondaryModal): Active Defender `bg-grimlog-defender-bg-dark`, Active Attacker `bg-grimlog-attacker-bg-dark`
- Compact Modals (Detail/Selection): Light muted backgrounds (`#d4918f` red, `#a8c4a8` green) for high contrast
- Inactive Tab: `bg-grimlog-darkGray` (`#1a1a1a` - very dark gray)

**Card Backgrounds:**
- Filled Cards: `bg-gray-50` (`#f9fafb` - light background for better text contrast)
- Empty Cards: `bg-gray-100` (`#f3f4f6` - slightly darker light gray)
- Compact Modals: `bg-white` with colored borders

**Text Colors (v4.34.0 - High Contrast):**
- Primary Text: `text-gray-900` (`#111827` - near-black) for maximum readability
- Secondary Text: `text-gray-600` / `text-gray-700` - Medium gray for secondary info
- Modal Headers: `text-gray-900` on light muted backgrounds
- Scoring Buttons: `text-gray-800` on white backgrounds
- Player Accents: Colored borders (`border-grimlog-red` / `border-grimlog-green`) for visual identity

**Borders:**
- Defender: `border-grimlog-green` (`#a8c5a0`)
- Attacker: `border-grimlog-red` (`#b84a4a`)
- Progress Ring Track: `text-grimlog-steel` (`#4a4a4a`)

### Typography (v4.34.0)

- **Card Titles:** Bold/black, uppercase, dark gray text (`text-gray-900`)
- **VP Numbers:** Large (3xl/4xl), bold, dark gray (only shown when VP > 0, no "/20" display)
- **Modal Titles:** Extra bold (`font-black`), uppercase, dark gray (`text-gray-900`)
- **Hint Text:** Small, uppercase, medium gray
- **Tab Labels:** Bold, uppercase, dark text (active) or colored (inactive)
- **Scoring Options:** Medium weight, dark text on white backgrounds

### Spacing & Layout

- **Card Padding:** `p-4 sm:p-5` (responsive)
- **Card Gap:** `gap-4` between cards
- **Modal Padding:** `p-4 sm:p-6` (responsive)
- **Border Width:** `border-[3px]` for cards, `border-b-4` for active tabs

### Shadows & Depth

- **Card Shadows:** `shadow-lg shadow-black/60` - Strong shadows for depth
- **Hover Shadows:** `shadow-xl shadow-black/40` - Enhanced on hover

---

## User Experience

### Workflow (v4.34.0)

**Primary Entry Points:**
1. **From Main Game View (Mini Cards):**
   - Tap filled secondary → Opens `SecondaryDetailModal` (scoring/viewing)
   - Tap empty slot (+) → Opens `SecondarySelectionModal` (selection)
   
2. **From Full Modal (SecondaryModal):**
   - Tap filled card → Opens `SecondaryDetailModal` (scoring/viewing)
   - Tap empty card → Shows selection list inline

**Consistent Experience:**
- Both entry points use the same `SecondaryDetailModal` for scoring
- Same `SecondarySelectionModal` for selection
- Unified styling and behavior across all access points

### UX Improvements (v4.34.0)

**Accessibility & Readability:**
- High-contrast text colors (`text-gray-900`) meet WCAG standards
- Light modal backgrounds with dark text for maximum readability
- Simplified VP display (no "/20" clutter)
- Larger, bolder fonts for better visibility from distance

**Mobile-First Design:**
- Bottom-sheet animations on mobile devices
- Drag handle indicators for better UX
- Responsive sizing optimized for iPad (`md:max-w-xl`)
- Touch-friendly button sizes and spacing

**Performance:**
- Removed duplicate modal code (180+ lines from SecondaryMiniCard)
- Consolidated three modal layers into two focused components
- Faster interaction with fewer layers to navigate

### Workflow (Legacy)

1. **Opening Modal**
   - User taps secondary objectives button
   - Modal opens full-screen with Defender tab active (default)
   - Background color matches active player

2. **Switching Players**
   - Tap Defender/Attacker tab
   - Modal background transitions to player color
   - Tab text changes to white for readability
   - Cards update to show that player's secondaries

3. **Adding Secondary**
   - Tap empty card slot or "+ Add" button
   - Selection list appears with available secondaries
   - Filtered by mission mode compatibility
   - Random draw button for Tactical mode
   - Tap secondary to add

4. **Scoring Secondary (v4.34.0)**
   - Tap filled secondary card (mini card or large card)
   - `SecondaryDetailModal` opens (bottom-sheet on mobile, centered on tablet)
   - Compact header shows secondary name and VP badge (if scored)
   - Scoring options displayed with turn cap logic
   - Options generated from rules engine (`getScoringOptions`)
   - Turn cap warnings displayed inline
   - Tap VP amount to score
   - Modal closes automatically, UI refreshes with updated VP

5. **Selecting New Secondary (v4.34.0)**
   - Tap empty slot (+) in mini card view
   - `SecondarySelectionModal` opens (bottom-sheet on mobile, centered on tablet)
   - Shows available secondaries (filtered by mission mode, excludes used)
   - Random draw button for Tactical missions
   - Tap secondary to select
   - Modal closes, secondary added, UI refreshes

6. **Viewing History**
   - Tap "History" button in footer (full modal only)
   - Collapsible panel shows scoring history
   - Lists round, secondary name, and VP scored

### Mobile Optimizations

- **Full-Screen Modal** - Uses entire viewport
- **Large Touch Targets** - Minimum 44px height for buttons
- **Stacked Cards** - Cards stack vertically on phones
- **Side-by-Side** - Cards display horizontally on tablets
- **Bottom Sheet** - Native mobile pattern for scoring
- **Rounded Buttons** - Consistent with app standards

### Accessibility (v4.34.0)

- **High Contrast** - Dark text (`text-gray-900`) on light backgrounds (WCAG AAA compliant)
- **Clear Labels** - Descriptive button text and aria-labels
- **Keyboard Navigation** - Escape key closes modals, click outside to dismiss
- **Focus States** - Visible focus indicators on all interactive elements
- **Screen Reader Support** - Semantic HTML and ARIA labels
- **Readable Fonts** - Bold/black weights, appropriate sizing for distance viewing
- **Touch Targets** - Minimum 48px height for buttons, adequate spacing

---

## Technical Implementation

### State Management (v4.34.0)

**SecondaryModal (Full Modal):**
```typescript
const [activeTab, setActiveTab] = useState<'attacker' | 'defender'>(initialTab);
const [detailModalOpen, setDetailModalOpen] = useState(false); // Replaces scoringSheetOpen
const [selectedSecondary, setSelectedSecondary] = useState<SecondaryObjective | null>(null);
const [showSelectionList, setShowSelectionList] = useState(false);
const [showHistory, setShowHistory] = useState(false);
```

**GameStateDisplay (Main View):**
```typescript
// Detail modal state
const [detailModalOpen, setDetailModalOpen] = useState(false);
const [selectedSecondary, setSelectedSecondary] = useState<SecondaryObjective | null>(null);
const [selectedPlayer, setSelectedPlayer] = useState<'attacker' | 'defender'>('attacker');

// Selection modal state
const [selectionModalOpen, setSelectionModalOpen] = useState(false);
const [selectionPlayer, setSelectionPlayer] = useState<'attacker' | 'defender'>('attacker');
```

### Dynamic Color Theming

Colors update based on active player:

```typescript
const isAttackerActive = activeTab === 'attacker';
const playerBg = isAttackerActive 
  ? 'bg-grimlog-attacker-bg-dark' 
  : 'bg-grimlog-defender-bg-dark';
const playerAccent = isAttackerActive 
  ? 'border-grimlog-red' 
  : 'border-grimlog-green';
const playerText = isAttackerActive 
  ? 'text-grimlog-red' 
  : 'text-grimlog-green';
```

### Responsive Layout

Cards use flexbox with responsive direction:

```typescript
<div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch">
  {/* Cards stack on mobile, side-by-side on tablet+ */}
</div>
```

### Integration Points

**Parent Component (`app/page.tsx`):**
- Manages modal open/close state
- Provides session data and callbacks
- Handles toast notifications

**API Integration:**
- `/api/sessions/[id]/score-secondary` - Scoring endpoint (with cache invalidation)
- `/api/sessions/[id]/manual-action` - Add/remove secondary
- `/api/sessions/[id]/discard-secondary` - Discard secondary endpoint
- `/api/sessions/[id]/events/[eventId]` - Undo/revert endpoint (PATCH)
- `/api/secondaries` - Fetch available secondaries

**Refresh & Cache Management (v4.34.0):**
- `refreshGameState()` called AFTER API calls complete (not before)
- Cache invalidation via `invalidateCachePattern()` before refresh
- Proper await/async flow ensures UI updates with latest data
- Undo functionality properly refreshes secondary progress

---

## Related Documentation

- [Secondary Objectives System](../features/SECONDARY_OBJECTIVES_SYSTEM.md) - Core system architecture and API
- [UI Color System](../features/UI_COLOR_SYSTEM.md) - Grimlog color conventions
- [Secondary Objectives Auto Calculation](../features/SECONDARY_OBJECTIVES_AUTO_CALCULATION.md) - Voice command scoring
- [Manual UI Controls](../features/MANUAL_UI_CONTROLS.md) - Manual override patterns

---

**This redesign prioritizes readability, mobile usability, and the grim dark aesthetic while maintaining full functionality for secondary objectives management.**

