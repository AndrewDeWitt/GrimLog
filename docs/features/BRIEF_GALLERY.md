# Dossier Gallery

**Last Updated:** 2026-01-12
**Status:** Complete
**Version:** 4.74.0

## Overview

The Dossier Gallery (`/dossier/gallery`) is the public showcase for generated tactical dossiers. It displays army analyses with a CRT terminal aesthetic, featuring spirit icons as hero images, archetype-coded borders, and a fixed header with scrollable card grid.

## Table of Contents

- [Features](#features)
- [Filter System](#filter-system)
- [Mobile Filter Panel](#mobile-filter-panel)
- [Layout Structure](#layout-structure)
- [Card Design](#card-design)
- [API Response](#api-response)
- [Component Reference](#component-reference)
- [Styling Details](#styling-details)
- [Admin: Faction Icons](#admin-faction-icons)
- [Related Documentation](#related-documentation)

## Features

### CRT Terminal Header
- **Green terminal aesthetic** with scanlines overlay
- **Corner bracket accents** matching Warhammer 40K tech-priest style
- **Title:** "Dossier Gallery" with green glow text effect
- **Subtitle:** "++ TACTICAL INTELLIGENCE ARCHIVE ++"
- **Generate button:** Orange CTA with hover glow

### Filter System
- **Faction filter:** Icon-rich dropdown with custom faction icons
- **Detachment filter:** Context-aware, only shows when faction selected
- **Points filter:** Predefined ranges (All, 1000, 1500, 2000)
- **Sort options:** Newest, Popular (views), Oldest

### Showcase Cards
- **Spirit icon as hero** - Full square image with zoom on hover
- **Color-coded borders** based on archetype:
  - Purple: Elite
  - Green: Horde
  - Blue: Balanced
  - Orange: Skew
  - Gray: Castle
  - Red: Alpha Strike
  - Amber: Attrition
- **Points badge** (top-left, orange)
- **View count badge** (top-right)
- **Archetype badge** with emoji icon
- **Title** with gradient overlay for readability
- **Tagline** in footer section

### Fixed Layout
- Header section stays visible at all times
- Only the card grid area scrolls
- Clean separation between navigation and content

### Visual Effects
- **Page-wide scanlines** (3% opacity CRT effect)
- **Atmospheric gradients** (green at top, orange at bottom-right)
- **Card hover:** Scale 1.02, orange border, shadow glow

## Filter System

### Desktop Layout
All filters displayed inline in a single row:
```
[Faction ▼] [Detachment ▼] [Points ▼] [Sort ▼]
```

### Filter Components

| Component | Purpose | Options |
|-----------|---------|---------|
| `GalleryFilterDropdown` | Generic icon-rich dropdown | Faction, Detachment, Sort |
| `PointsRangeDropdown` | Predefined points ranges | All, 1000, 1500, 2000 |

### Filter Behavior

**Faction Filter:**
- Always visible on all screen sizes
- Shows custom faction icons (from admin) or fallback SVG
- Selecting a faction enables the Detachment filter

**Detachment Filter:**
- Hidden when "All Factions" is selected
- Clears automatically when faction changes
- Shows detachments specific to the selected faction

**Points Filter:**
- Predefined ranges for common game sizes:
  - All Points (0-99999)
  - 1000 pts (0-1000)
  - 1500 pts (0-1500)
  - 2000 pts (0-2000)

**Sort Options:**
- Newest (default) - Most recently created
- Popular - Most views
- Oldest - Oldest first

## Mobile Filter Panel

On mobile screens (`< 640px`), filters are optimized for touch:

### Layout
```
┌────────────────────────────────────┐
│ [Faction Dropdown ▼]    [≡ Filter] │  ← Always visible row
└────────────────────────────────────┘
```

### Slide-Up Panel
Triggered by the filter icon button, displays:
- **Detachment:** Scrollable list (only when faction selected)
- **Points:** Chip selection (All, 1000, 1500, 2000)
- **Sort:** Chip selection (Newest, Popular, Oldest)

```
┌─────────────────────────────────────┐
│ FILTERS                    [Clear] X│
├─────────────────────────────────────┤
│ DETACHMENT                          │
│ ┌─────────────────────────────────┐ │
│ │ ○ All Detachments              ✓│ │
│ │ ○ Champions of Russ             │ │
│ │ ○ Stormlance Task Force         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ POINTS                              │
│ [All] [1000] [1500] [2000]          │
│                                     │
│ SORT BY                             │
│ [Newest] [Popular] [Oldest]         │
├─────────────────────────────────────┤
│         [APPLY]                     │
└─────────────────────────────────────┘
```

### Panel Features
- **Backdrop:** 85% opacity black overlay
- **Animation:** Slide up from bottom (0.2s ease-out)
- **Escape key:** Closes panel
- **Body scroll lock:** Prevents background scrolling when open
- **Clear button:** Resets all filters to defaults

## Layout Structure

```
┌─────────────────────────────────────────────────┐
│ GlobalHeader (sticky, h-12)                      │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ Gallery Header (fixed, flex-shrink-0)       │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ DOSSIER GALLERY      [+ Generate]       │ │ │
│ │ │ ++ TACTICAL INTELLIGENCE ARCHIVE ++     │ │ │
│ │ ├─────────────────────────────────────────┤ │ │
│ │ │ [Faction▼] [Detach▼] [Pts▼] [Sort▼]     │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Scrollable Content (flex-1, overflow-auto)  │ │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│ │
│ │ │  Card  │ │  Card  │ │  Card  │ │  Card  ││ │
│ │ └────────┘ └────────┘ └────────┘ └────────┘│ │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│ │
│ │ │  Card  │ │  Card  │ │  Card  │ │  Card  ││ │
│ │ └────────┘ └────────┘ └────────┘ └────────┘│ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Card Design

```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │ ← Archetype-coded border
│ │ 2000         👁 12       │ │ ← Points + Views
│ │                          │ │
│ │      [Spirit Icon]       │ │ ← Hero image (aspect-square)
│ │                          │ │
│ │ ──────────────────────── │ │ ← Gradient overlay
│ │ 👑 Elite                 │ │ ← Archetype badge
│ │ Space Wolves             │ │ ← Title
│ └──────────────────────────┘ │
│ "The Double-Saga Terminator  │ ← Tagline
│  Wall"                       │
│                      Jan 11  │ ← Date
└──────────────────────────────┘
```

## API Response

**Endpoint:** `GET /api/dossier/public`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `faction` | string | Filter by faction name |
| `detachment` | string | Filter by detachment name |
| `minPoints` | number | Minimum points (default: 0) |
| `maxPoints` | number | Maximum points (default: 99999) |
| `sortBy` | string | Sort order: `recent`, `popular`, `oldest` |
| `limit` | number | Results per page (default: 20) |
| `offset` | number | Pagination offset |

**Response fields:**
```typescript
interface PublicGalleryResponse {
  dossiers: PublicDossier[];
  total: number;
  factions: string[];
  detachments: string[];  // v4.74.0
  factionMeta: Record<string, { iconUrl?: string }>;  // v4.74.0
}

interface PublicDossier {
  id: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
  executiveSummary: string | null;
  tagline: string | null;
  archetype: string | null;
  playstyleBlend: PlaystyleBlend | null;
  combatSpectrum: number | null;
  totalWounds: number | null;
}
```

## Component Reference

### GalleryFilterDropdown

Icon-rich dropdown with portal-based rendering for escaping scroll containers.

```typescript
interface GalleryFilterDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: GalleryFilterOption[];
  placeholder: string;
  searchable?: boolean;  // Default: true
  className?: string;
}

interface GalleryFilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  iconUrl?: string;
  factionName?: string;  // For FactionIconImage fallback
}
```

**Features:**
- Portal rendering (escapes scroll containers)
- Automatic position calculation (opens up or down based on viewport)
- Search/filter capability (when > 5 options)
- Keyboard navigation (Arrow keys, Enter, Escape)
- Clear button to reset selection

### FactionIconImage

Renders faction icon from custom URL with SVG fallback.

```typescript
interface FactionIconImageProps {
  factionName: string;
  iconUrl?: string | null;
  className?: string;  // Default: 'w-5 h-5'
}
```

**Behavior:**
1. If `iconUrl` provided, renders `<img>` tag
2. On error or no URL, falls back to `<FactionIcon>` SVG
3. Fallback has `text-green-400` and drop-shadow for visibility

### PointsRangeDropdown

Wrapper around GalleryFilterDropdown for points ranges.

```typescript
interface PointsRangeDropdownProps {
  value: { min: number; max: number };
  onChange: (range: { min: number; max: number }) => void;
  className?: string;
}
```

**Predefined Ranges:**
- All Points: 0-99999
- 1000 pts: 0-1000
- 1500 pts: 0-1500
- 2000 pts: 0-2000

### MobileFilterPanel

Slide-up panel for mobile filter controls.

```typescript
interface MobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFaction: string;
  selectedDetachment: string;
  onDetachmentChange: (detachment: string) => void;
  detachmentOptions: GalleryFilterOption[];
  pointsRange: { min: number; max: number };
  onPointsRangeChange: (range: { min: number; max: number }) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  activeFilterCount: number;
}
```

**Features:**
- Portal rendering to document.body
- Backdrop with 85% black overlay
- Escape key handling
- Body scroll lock when open
- Clear all button

## Styling Details

### Color Palette
- **Header:** Green terminal theme (`green-400`, `green-500`, `green-600`)
- **Buttons:** Orange theme (`grimlog-orange`, `grimlog-amber`)
- **Cards:** Dark background (`grimlog-darkGray/80`)
- **Text:** White titles, amber taglines, steel dates

### Dropdown Styling
```css
/* Trigger button */
border-green-500/30 → hover:border-green-500/50 → focus:border-green-400
bg-black/50
text-green-400 (selected) / text-green-600 (placeholder)
shadow-[0_0_10px_rgba(34,197,94,0.2)] (on focus)

/* Dropdown panel */
border-green-500/50
bg-black/95
backdrop-blur-sm
shadow-[0_0_20px_rgba(34,197,94,0.15)]

/* Options */
text-green-400 → hover:bg-green-500/10
bg-green-500/15 (active/keyboard focus)
```

### Archetype Colors
| Archetype | Border Color | Text Color | Icon |
|-----------|--------------|------------|------|
| Elite | `purple-500/60` | `purple-400` | 👑 |
| Horde | `green-500/60` | `green-400` | 🐺 |
| Balanced | `blue-500/60` | `blue-400` | ⚖️ |
| Skew | `orange-500/60` | `orange-400` | 🎯 |
| Castle | `gray-500/60` | `gray-400` | 🏰 |
| Alpha Strike | `red-500/60` | `red-400` | ⚡ |
| Attrition | `amber-500/60` | `amber-400` | 🛡️ |

### Responsive Breakpoints
- **Mobile (< 640px):** Faction dropdown + filter button
- **Desktop (>= 640px):** All filters inline

### Card Grid
- **Mobile:** 2 columns
- **Tablet (sm):** 3 columns
- **Desktop (lg):** 4 columns

## Admin: Faction Icons

Custom faction icons can be uploaded via the faction admin page (`/admin/factions/[id]`).

### Icon URL Input
Located in the faction edit form, above the raw metadata editor:

```
┌──────────────────────────────────────┐
│ Faction Icon                         │
│ ┌────────────┐                       │
│ │            │ Custom icon           │
│ │  [Icon]    │ (or "Using default    │
│ │            │  SVG icon")           │
│ └────────────┘                       │
│ [https://example.com/icon.png     ]  │
│ Paste URL to an AI-generated icon    │
└──────────────────────────────────────┘
```

### Storage
Icon URLs are stored in the faction's `metaData` JSON field:
```json
{
  "iconUrl": "https://example.com/faction-icon.png"
}
```

### Recommendations
- **Size:** 128x128 pixels
- **Format:** PNG with transparent background
- **Source:** AI-generated faction emblems work well

## Related Documentation

- [Tactical Dossier](./TACTICAL_DOSSIER.md) - Dossier generation system
- [Dossier Credits System](./DOSSIER_CREDITS_SYSTEM.md) - Credit consumption
- [Faction System](./FACTION_SYSTEM.md) - Faction management
- [UI Color System](./UI_COLOR_SYSTEM.md) - Grimlog color palette
