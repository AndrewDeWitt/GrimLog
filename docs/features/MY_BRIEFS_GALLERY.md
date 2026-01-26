# My Dossiers Gallery

**Last Updated:** 2026-01-13
**Status:** Complete
**Version:** 4.75.0

## Overview

The My Dossiers page (`/dossier/history`) is the authenticated user's private gallery for managing their generated tactical dossiers. It mirrors the Public Gallery's CRT terminal aesthetic but with an orange theme and adds owner-specific features: bulk actions, inline rename, visibility management, and visual distinction for private dossiers.

## Table of Contents

- [Features](#features)
- [Visual Design](#visual-design)
- [Filter System](#filter-system)
- [Bulk Actions](#bulk-actions)
- [Inline Rename](#inline-rename)
- [Private Dossier Distinction](#private-dossier-distinction)
- [Mobile Experience](#mobile-experience)
- [Component Reference](#component-reference)
- [API Reference](#api-reference)
- [Related Documentation](#related-documentation)

## Features

### Gallery-Style Layout
- **Grid layout** matching Public Gallery (2→3→4 columns responsive)
- **Card design** with spirit icon hero, archetype borders, visibility badges
- **CRT terminal aesthetic** with orange theme (vs green for public)
- **Fixed header** with scrollable content area
- **Scanlines overlay** and atmospheric gradients

### Owner-Specific Features
- **Bulk selection mode** - Select multiple dossiers for batch operations
- **Bulk delete** - Delete multiple dossiers at once with confirmation
- **Bulk visibility change** - Set visibility for multiple dossiers (Private/Link/Public)
- **Inline rename** - Click title to edit dossier name directly
- **Visibility filter** - Filter by Private/Link/Public status
- **Search** - Search by name or tagline (300ms debounced)

### Visual Distinction
- **Private dossiers** appear dimmer with grayscale effect and lock icon
- **Public/Link dossiers** display with full color and archetype borders
- **Selection mode** shows checkbox overlays and green selection glow

## Visual Design

### Color Theme
Unlike the Public Gallery's green terminal theme, My Dossiers uses orange:
- **Header:** Orange accents (`grimlog-orange`)
- **Corner brackets:** Orange border (`border-grimlog-orange`)
- **Glow effects:** Orange (`rgba(255,107,0,...)`)
- **Filter panel:** Orange theme for mobile slide-up panel

### Layout Structure
```
┌─────────────────────────────────────────────────┐
│ GlobalHeader (sticky, h-12)                      │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ My Dossiers Header (fixed)                  │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ [←] MY DOSSIERS    [Select] [+ New]     │ │ │
│ │ │     26 dossiers in archive              │ │ │
│ │ ├─────────────────────────────────────────┤ │ │
│ │ │ [Search] [Faction▼] [Pts▼] [Vis▼] [Sort]│ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Scrollable Grid (flex-1, overflow-auto)    │ │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│ │
│ │ │ Card   │ │ Card   │ │ Card   │ │ Card   ││ │
│ │ │ 🔒dim  │ │ Public │ │ 🔗Link │ │ 🔒dim  ││ │
│ │ └────────┘ └────────┘ └────────┘ └────────┘│ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Bulk Actions Toolbar (when items selected)  │ │
│ │ [3 of 26 selected] [All] [Clear] [Vis▼] [🗑]│ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Filter System

### Available Filters

| Filter | Description | API Parameter |
|--------|-------------|---------------|
| Search | Text search in name/tagline | `search` |
| Faction | Filter by faction | `faction` |
| Detachment | Filter by detachment (when faction selected) | `detachment` |
| Points | Range filter (All, 1000, 1500, 2000) | `minPoints`, `maxPoints` |
| Visibility | Filter by Private/Link/Public | `visibility` |
| Sort | Newest/Most Views/Oldest | `sort` |

### Desktop Layout
All filters displayed inline:
```
[🔍 Search...] [Faction ▼] [Detachment ▼] [Points ▼] [Visibility ▼] [Sort ▼]
```

### Filter Behavior
- **Search:** 300ms debounce before API call
- **Detachment:** Only visible when faction is selected
- **All filters:** Reset pagination to page 1 when changed
- **Active count:** Badge shows number of active filters (mobile)

## Bulk Actions

### Entering Selection Mode
1. Click "Select" button in header to enable selection mode
2. Or click checkbox on any card to auto-enable selection mode

### Selection UI
- Cards show checkbox overlay in top-left corner
- Selected cards have green border glow and checkmark
- Header shows "Cancel" button to exit selection mode

### Bulk Actions Toolbar
Appears fixed at bottom when items are selected:
```
┌────────────────────────────────────────────────────────┐
│ 3 of 26 selected | [Select All] [Clear] | [Vis ▼] [🗑] │
└────────────────────────────────────────────────────────┘
```

**Actions:**
- **Select All:** Select all dossiers on current page
- **Clear:** Deselect all items
- **Visibility:** Dropdown to set visibility (Private/Link/Public)
- **Delete:** Delete selected dossiers (with confirmation)

### API Endpoint
```http
POST /api/dossier/bulk
Content-Type: application/json

{
  "ids": ["uuid1", "uuid2", "uuid3"],
  "action": "delete" | "setVisibility",
  "visibility": "private" | "link" | "public"  // for setVisibility
}
```

## Inline Rename

### How to Use
1. Click on the dossier title (in the card overlay)
2. Title transforms into an editable input field
3. Type the new name
4. Press **Enter** or click away to save
5. Press **Escape** to cancel

### Behavior
- **Auto-focus:** Input is focused and text is selected
- **Loading state:** Shows spinner during save
- **Optimistic update:** UI updates immediately, rolls back on error
- **Empty handling:** Empty name clears the custom name (shows faction as title)

### API Endpoint
```http
PATCH /api/dossier/{id}
Content-Type: application/json

{
  "listName": "My Custom Name"
}
```

## Private Dossier Distinction

Private dossiers have visual differences to distinguish them from shared/public dossiers:

| Aspect | Private | Link/Public |
|--------|---------|-------------|
| Opacity | 80% | 100% |
| Image filter | 30% grayscale | None |
| Border color | Steel (`grimlog-steel/40`) | Archetype color |
| Lock icon | Visible (top-left) | Hidden |
| Visibility badge | Steel "PRIVATE" | Amber "LINK" or Green "PUBLIC" |

### CSS Classes Applied
```css
/* Private dossiers */
.opacity-80
.grayscale-[30%]
.border-grimlog-steel/40

/* Public/Link dossiers */
.border-{archetype-color}/60
```

## Mobile Experience

### Mobile Filter Panel
On mobile (`< 640px`), filters are accessed via slide-up panel:

```
┌────────────────────────────────────────┐
│ [Faction ▼]                      [≡ 3] │  ← Badge shows active count
└────────────────────────────────────────┘
```

Tapping the filter button opens the panel:
```
┌─────────────────────────────────────┐
│ FILTERS                  [Clear All] X│
├─────────────────────────────────────┤
│ SEARCH                               │
│ [🔍 Search by name or tagline...   ] │
│                                      │
│ VISIBILITY                           │
│ [All] [🔒 Private] [🔗 Link] [🌐 Pub]│
│                                      │
│ DETACHMENT (if faction selected)     │
│ ┌──────────────────────────────────┐ │
│ │ ○ All Detachments             ✓ │ │
│ │ ○ Stormlance Task Force         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ POINTS                               │
│ [All] [1000] [1500] [2000]           │
│                                      │
│ SORT BY                              │
│ [Newest] [Popular] [Oldest]          │
├─────────────────────────────────────┤
│         [APPLY FILTERS]              │
└─────────────────────────────────────┘
```

### Mobile Selection Mode
- **Long-press** (future) or checkbox to select first item
- **Tap** cards to toggle selection after first
- **Bulk toolbar** appears at bottom above safe area

## Component Reference

### DossierCard
Reusable gallery card with owner-specific features.

```typescript
interface DossierCardProps {
  dossier: DossierSummary;
  isSelectable?: boolean;      // Show checkbox overlay
  isSelected?: boolean;        // Checkbox checked state
  onSelect?: (id: string) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
  showOwnerActions?: boolean;  // Show visibility badge + enable rename
}
```

### BulkActionsToolbar
Fixed bottom toolbar for bulk operations.

```typescript
interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkVisibilityChange: (visibility: 'private' | 'link' | 'public') => void;
  isLoading: boolean;
}
```

### MyDossiersMobileFilterPanel
Extended mobile filter panel with search and visibility filter.

```typescript
interface MyDossiersMobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  visibilityFilter: string;
  onVisibilityFilterChange: (visibility: string) => void;
  // ... other filter props from MobileFilterPanel
}
```

## API Reference

### GET /api/dossier/list
List user's dossiers with filtering and sorting.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Items per page (max 100) |
| `offset` | number | 0 | Pagination offset |
| `faction` | string | - | Filter by faction |
| `detachment` | string | - | Filter by detachment |
| `minPoints` | number | 0 | Minimum points |
| `maxPoints` | number | 99999 | Maximum points |
| `sort` | string | "recent" | Sort: recent, popular, oldest |
| `search` | string | - | Search listName |
| `visibility` | string | - | Filter: private, link, public |

**Response:**
```typescript
{
  dossiers: DossierSummary[];
  total: number;
  limit: number;
  offset: number;
  factions: string[];
  detachments: string[];
  factionMeta: Record<string, { iconUrl?: string }>;
}
```

### POST /api/dossier/bulk
Bulk operations on multiple dossiers.

**Request:**
```json
{
  "ids": ["uuid1", "uuid2"],
  "action": "delete" | "setVisibility",
  "visibility": "private" | "link" | "public"
}
```

**Response:**
```json
{
  "success": true,
  "action": "delete",
  "affected": 2
}
```

## Related Documentation

- [Dossier Gallery](./DOSSIER_GALLERY.md) - Public gallery feature
- [Tactical Dossier](./TACTICAL_DOSSIER.md) - Dossier generation system
- [Dossier History API](../api/DOSSIER_HISTORY_API.md) - Complete API reference
- [UI Color System](./UI_COLOR_SYSTEM.md) - Grimlog color palette
