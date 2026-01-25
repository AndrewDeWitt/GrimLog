# Admin Datasheets Management

**Last Updated:** 2025-12-04
**Status:** Complete
**Version:** 4.23.0

## Overview

The Admin Datasheets Management feature provides full CRUD (Create, Read, Update, Delete) capabilities for unit datasheets in the Grimlog admin panel. Administrators can view, filter, edit, and manage datasheets across all factions from two locations:

1. **Dedicated Datasheets Admin Page** (`/admin/datasheets`) - Global view with advanced filtering
2. **Faction Detail Page** (`/admin/factions/[id]`) - Faction-scoped view with quick actions

The feature integrates with the existing Icon Generator, displaying unit icons that have been generated via the `/admin/icons` workflow.

## Table of Contents

- [Features](#features)
- [Datasheets Admin Page](#datasheets-admin-page)
- [Faction Detail Integration](#faction-detail-integration)
- [Creating and Editing Datasheets](#creating-and-editing-datasheets)
- [Icon Integration](#icon-integration)
- [API Reference](#api-reference)
- [Related Documentation](#related-documentation)

## Features

### Core Capabilities

- **View Datasheets** - Browse all datasheets with key stats (points, T, W, Sv)
- **Filter & Search** - Filter by faction, role, enabled status; search by name/keywords
- **Sort** - Sort by name, faction, role, or points cost
- **Enable/Disable** - Toggle datasheet availability in army builder
- **Create** - Add new datasheets with full stats, weapons, and abilities
- **Edit** - Modify existing datasheets (creates version snapshot)
- **Delete** - Remove datasheets with cascade warnings
- **Bulk Actions** - Select multiple datasheets for batch enable/disable

### Visual Enhancements

- **Unit Icons** - Displays icons generated via Icon Generator
- **Role-Based Fallbacks** - Emoji indicators when no icon exists
- **Weapon/Ability Counts** - Quick view of datasheet complexity
- **Enabled Status Toggle** - Visual on/off switch per datasheet

## Datasheets Admin Page

Located at `/admin/datasheets`, this page provides a comprehensive datasheet management interface.

### Interface Components

```
┌─────────────────────────────────────────────────────────────┐
│ Datasheets                              [+ Create Datasheet] │
│ Manage unit datasheets across all factions                   │
├─────────────────────────────────────────────────────────────┤
│ [Search...] [Faction ▼] [Role ▼] [Status ▼]                 │
├─────────────────────────────────────────────────────────────┤
│ Showing 1 - 25 of 209 datasheets                            │
├─────────────────────────────────────────────────────────────┤
│ ☐ │ NAME ↑      │ FACTION  │ ROLE     │ PTS │ STATS │ ⚡ │  │
├───┼─────────────┼──────────┼──────────┼─────┼───────┼────┼──┤
│ ☐ │ 🐉 Carnifex │ Tyranids │ Monster  │ 115 │ T9... │ 🟢 │ ⋮│
│ ☐ │ 👤 Broodlord│ Tyranids │ Character│  80 │ T5... │ 🟢 │ ⋮│
└───┴─────────────┴──────────┴──────────┴─────┴───────┴────┴──┘
```

### Filters

| Filter | Options | Description |
|--------|---------|-------------|
| Search | Free text | Searches name and keywords |
| Faction | All factions | Filter by specific faction |
| Role | Character, Battleline, Elites, etc. | Filter by battlefield role |
| Status | All, Enabled, Disabled | Filter by availability |

### Bulk Actions

When datasheets are selected via checkboxes:

- **Enable Selected** - Set `isEnabled: true` for all selected
- **Disable Selected** - Set `isEnabled: false` for all selected
- **Clear Selection** - Deselect all

### Pagination

- Default page size: 25 datasheets
- Navigate with Previous/Next buttons
- Page number indicators for quick navigation

## Faction Detail Integration

The faction detail page (`/admin/factions/[id]`) now includes an expandable datasheets section.

### Accessing Datasheets

1. Navigate to `/admin/factions`
2. Click on a faction to view details
3. Click the **Datasheets** stat card to expand the section

### Section Features

- **Inline Table** - View datasheets without leaving the page
- **Quick Filters** - Search and role filter
- **Toggle Switch** - Enable/disable directly in the table
- **Edit Button** - Opens DatasheetEditorModal
- **Delete Button** - Removes datasheet with confirmation
- **Full Admin Link** - Navigate to `/admin/datasheets?factionId=...`

## Creating and Editing Datasheets

The DatasheetEditorModal provides a multi-step wizard for datasheet management.

### Steps

1. **Basic Info** - Name, faction, subfaction, role, points, composition, keywords
2. **Stats** - Movement, Toughness, Save, Wounds, Leadership, OC, Invulnerable Save
3. **Weapons** - Add/remove weapons with full profiles (Range, Type, A, BS/WS, S, AP, D)
4. **Abilities** - Add/remove abilities with descriptions and phase triggers
5. **Extras** - Leader rules, transport capacity, source book

### Validation

- **Required Fields** - Name, faction, role, keywords, composition, stats
- **Save Format** - Must be "X+" format (e.g., "3+", "4+")
- **Keywords** - At least one keyword required
- **Points** - Must be non-negative integer

### Version Tracking

Each save creates a version snapshot:

```json
{
  "versionNumber": 2,
  "versionLabel": "Update: Fixed points cost",
  "changelog": "Fixed points cost",
  "snapshotData": { /* full datasheet state */ }
}
```

## Icon Integration

Datasheets display icons that match by **unit name** and **faction** from the Icon Generator.

### How Matching Works

```typescript
// Icons are stored in UnitIcon table with:
// - unitName: "Broodlord"
// - faction: "Tyranids"
// - blobUrl: "https://..."

// Datasheet lookup:
const key = `${datasheet.faction}:${datasheet.name}`;
iconMap.get(key); // Returns icon URL if exists
```

### Fallback Icons

When no generated icon exists, role-based emojis are displayed:

| Role | Emoji |
|------|-------|
| Character | 👤 |
| Battleline | ⚔️ |
| Monster | 🐉 |
| Vehicle | 🚗 |
| Other | 📋 |

### Generating Icons

1. Navigate to `/admin/icons`
2. Find the unit by name
3. Click "Generate Icon"
4. Refresh datasheets page to see new icon

## API Reference

### List Datasheets

```http
GET /api/admin/datasheets?factionId=xxx&role=Character&isEnabled=true&search=brood&page=1&limit=25&sortBy=name&sortOrder=asc
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| factionId | UUID | Filter by faction ID |
| faction | string | Filter by faction name |
| role | string | Filter by battlefield role |
| isEnabled | boolean | Filter by enabled status |
| isOfficial | boolean | Filter by official status |
| search | string | Search name and keywords |
| page | number | Page number (default: 1) |
| limit | number | Results per page (max: 100) |
| sortBy | string | Sort field (name, faction, role, pointsCost) |
| sortOrder | asc/desc | Sort direction |

**Response:**

```json
{
  "datasheets": [
    {
      "id": "uuid",
      "name": "Broodlord",
      "faction": "Tyranids",
      "role": "Character",
      "pointsCost": 80,
      "toughness": 5,
      "wounds": 6,
      "save": "4+",
      "invulnerableSave": "4+",
      "isEnabled": true,
      "iconUrl": "https://blob.vercel.com/...",
      "_count": { "weapons": 1, "abilities": 8 }
    }
  ],
  "pagination": {
    "total": 48,
    "page": 1,
    "limit": 25,
    "totalPages": 2
  }
}
```

### Get Single Datasheet

```http
GET /api/admin/datasheets/[id]
```

Returns full datasheet with weapons, abilities, wargear options, and recent versions.

### Create Datasheet

```http
POST /api/admin/datasheets
Content-Type: application/json

{
  "name": "New Unit",
  "faction": "Tyranids",
  "factionId": "uuid",
  "role": "Elites",
  "keywords": ["TYRANIDS", "INFANTRY"],
  "movement": "8\"",
  "toughness": 5,
  "save": "4+",
  "wounds": 3,
  "leadership": 7,
  "objectiveControl": 1,
  "composition": "3-6 Models",
  "pointsCost": 100,
  "weapons": [...],
  "abilities": [...]
}
```

### Update Datasheet

```http
PUT /api/admin/datasheets/[id]
Content-Type: application/json

{
  "pointsCost": 110,
  "changelog": "Adjusted points for balance"
}
```

Creates a new version snapshot with the changes.

### Toggle Enabled

```http
PATCH /api/admin/datasheets/[id]
Content-Type: application/json

{ "isEnabled": false }
```

Or toggle current state:

```json
{ "toggle": "isEnabled" }
```

### Delete Datasheet

```http
DELETE /api/admin/datasheets/[id]?force=true
```

Without `force=true`, returns warnings about related data that will be cascade deleted.

## Related Documentation

- **[Admin Panel](ADMIN_PANEL.md)** - Overview of admin panel features
- **[Datasheet Versioning System](DATASHEET_VERSIONING_SYSTEM.md)** - Version history and custom datasheets
- **[Unit Icon Generation](UNIT_ICON_GENERATION.md)** - How icons are generated and stored
- **[Admin API](../api/ADMIN_API.md)** - Complete admin API reference
- **[Faction System](FACTION_SYSTEM.md)** - Faction data structure and relationships
