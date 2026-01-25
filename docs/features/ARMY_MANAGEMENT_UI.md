# Army Management UI

**Last Updated:** 2025-12-13  
**Status:** Complete  
**Version:** 4.26.0

## Overview

The Army Management UI provides a comprehensive interface for managing your Warhammer 40K army lists within Grimlog. It consists of two main screens: the Army List screen for browsing and filtering your armies, and the Army Detail screen for viewing and configuring individual armies.

This feature was completely redesigned in v4.11.0 to improve usability, add sorting/filtering capabilities, and display accurate stratagem information.

## Table of Contents

- [Army List Screen](#army-list-screen)
- [Army Detail Screen](#army-detail-screen)
- [Faction Icons](#faction-icons)
- [Stratagem Display](#stratagem-display)
- [Technical Architecture](#technical-architecture)
- [Related Documentation](#related-documentation)

## Army List Screen

**Location:** `/armies`

### Features

#### Sorting & Filtering Toolbar
- **Sort Options:**
  - **Name:** Alphabetical sorting (A-Z or Z-A)
  - **Points:** Sort by points limit (ascending/descending)
  - **Date:** Sort by last updated timestamp (newest/oldest first)
  - Toggle sort direction with single click

- **Faction Filter:**
  - Dynamic dropdown populated from your armies
  - Shows only factions you have armies for
  - "ALL FACTIONS" option to show everything
  - Updates available options as you add/remove armies

#### Army Cards

Each army is displayed in a card with:

- **Header Section:**
  - Army name (prominent, colored)
  - Faction icon (right side)
  - Faction name and points limit

- **Stats Display:**
  - Unit count in dedicated stat box
  - Stratagem count in dedicated stat box
  - Visual boxes for easy scanning

- **Expandable Stratagems:**
  - Click "Stratagems" to expand/collapse
  - Shows full list of stratagem names
  - Scrollable if list is long (max-height with scroll)
  - Includes both manual and faction/detachment stratagems

- **Actions:**
  - **ACCESS:** Navigate to army detail page
  - **DELETE:** Remove army (with confirmation)

### Visual Design

- Consistent Grimlog color scheme (orange, green, amber, steel)
- Subtle colored header gradient for visual interest
- Hover effects on cards and buttons
- Clean, professional layout with good information hierarchy

## Army Detail Screen

**Location:** `/armies/[id]`

### Sections

#### Header
- Army name (large, prominent)
- Player name and faction
- Points total vs limit
- **TACTICS** quick-glance button (Detachment + Stratagems)

#### Action Bar
- **BACK TO CODEX:** Return to army list
- **⭐ BATTLE READY:** Manage and apply attachment presets (matchup loadouts)
- **SAVE ATTACHMENTS:** Persist current attachments to the army baseline

#### Tactics (Detachment + Stratagems)
- Detachment selection and stratagem reference are consolidated into the **Tactics modal**
- Stratagems are grouped into **Core** and **Detachment** sections
- Searchable quick-glance for in-game scanning

#### Roster
- Roster view shows **all units**, including **Characters**
- Displays totals (Units / Models / Wounds)
- Characters include “Attached To” context when configured
- Non-character units show “Attached Characters” when applicable

> Stratagem browsing is now intended to happen via the **Tactics modal**, rather than a dedicated column/tab.

## Faction Icons

### Supported Factions

High-quality SVG icons for:
- **Space Wolves:** Detailed wolf emblem
- **Space Marines:** Space Marine helmet
- **Tyranids:** Bio-organic alien design
- **Astra Militarum:** Star/shield emblem
- **Chaos:** Chaos star
- **Necrons:** Ankh/tech symbol
- **Aeldari/Drukhari:** Gem/wing design
- **Tau:** Circle/tech design
- **Orks:** Jagged face/glyph
- **Leagues of Votann:** Shield design
- **Adeptus Custodes:** Spear/eagle
- **Adeptus Mechanicus:** Cog/skull

### Implementation

Icons are implemented as inline SVG in `components/FactionIcon.tsx`:
- Supports dynamic coloring via CSS `currentColor`
- Normalized name matching (handles variations)
- Falls back to generic target reticle for unknown factions
- Configurable size via `className` prop

## Stratagem Display

### Accurate Counting

As of v4.11.0, stratagem counts are now accurate:

1. **Manual Stratagems:** User-added stratagems
2. **Faction Stratagems:** Auto-fetched from `StratagemData` table
3. **Detachment Filtering:** Only shows relevant stratagems
4. **Deduplication:** Prevents duplicate entries

### Display Locations

- **Army List Cards:** Count + expandable list of names
- **Army Detail Page:** Full cards with all information

### Data Flow

```
API: GET /api/armies
  ↓
Fetch StratagemData for each army's faction/detachment
  ↓
Merge manual + faction stratagems
  ↓
Deduplicate by name
  ↓
Return { stratagemCount, stratagems: [{ id, name }] }
  ↓
UI displays count and allows expansion
```

## Technical Architecture

### Components

- **`app/armies/page.tsx`:**
  - Army list with sorting/filtering
  - Uses `useMemo` for performance
  - State management for sort/filter/expand

- **`app/armies/[id]/page.tsx`:**
  - Army detail view
  - Roster (all units + wounds totals)
  - Battle Ready presets + attachments editing
  - Tactics modal (detachment + stratagem quick-glance)

- **`components/FactionIcon.tsx`:**
  - SVG icon rendering
  - Faction name normalization
  - Fallback handling

### API Endpoints

- **GET `/api/armies`:**
  - Returns enriched army list
  - Includes full stratagem data
  - Supports sorting via timestamps

- **GET `/api/armies/[id]`:**
  - Returns army with units and stratagems
  - Filters stratagems by detachment
  - Includes faction and detachment info

- **Preset CRUD:**
  - `GET/POST /api/armies/[id]/attachment-presets`
  - `PATCH/DELETE /api/armies/[id]/attachment-presets/[presetId]`

- **PATCH `/api/armies/[id]`:**
  - Update army settings
  - Save character attachments
  - Change detachment

- **DELETE `/api/armies/[id]`:**
  - Remove army and cascade delete units/stratagems

### Database Schema

```prisma
model Army {
  id                   String
  name                 String
  pointsLimit          Int
  detachment           String?
  characterAttachments String?  // JSON
  factionId            String?
  
  units                Unit[]
  stratagems           Stratagem[]
  faction              Faction?
}

model AttachmentPreset {
  id              String
  armyId          String
  name            String
  attachmentsJson String  // JSON
  isDefault       Boolean
}
```

## Related Documentation

- **[Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md)** - How to create armies
- **[Character Attachments Guide](../guides/CHARACTER_ATTACHMENTS_GUIDE.md)** - Attach leaders to units
- **[Feature: Army Register Tactics & Battle Ready](ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md)** - Consolidated tactics + presets behavior
- **[API: Armies Endpoint](../api/ARMIES_ENDPOINT.md)** - Technical API reference
- **[Feature: Stratagem System](STRATAGEM_DETACHMENT_SYSTEM.md)** - How stratagems work

