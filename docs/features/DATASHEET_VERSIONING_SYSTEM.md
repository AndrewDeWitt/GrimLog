# Datasheet Versioning & Custom Datasheets System

**Last Updated:** 2025-11-29  
**Status:** Complete  
**Version:** 4.19.0

## Overview

The Datasheet Versioning System enables users to create, edit, fork, and share custom datasheets while maintaining a complete version history. This supports both official Games Workshop datasheets (managed by admins) and user-created homebrew content, with a "wayback machine" feature to access any historical version.

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [User Workflows](#user-workflows)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [UI Components](#ui-components)
- [Sharing System](#sharing-system)
- [Related Documentation](#related-documentation)

## Key Features

### 1. Custom Datasheets
- **Create from Scratch**: Full multi-step editor for building new datasheets
- **Fork/Copy**: Clone any existing datasheet to create your own editable version
- **Full Editing**: Modify stats, weapons, abilities, wargear options, leader rules, transport capacity
- **Ownership**: Each custom datasheet belongs to the user who created it

### 2. Version History (Wayback Machine)
- **Immutable Snapshots**: Every edit creates a new version with complete JSON snapshot
- **Version Labels**: Optional labels for tracking balance updates (e.g., "Q4 2024 Balance")
- **Changelogs**: Document what changed in each version
- **Full Restore**: Access any historical version's complete data

### 3. Sharing
- **Visibility Levels**: Private (default), Link-only, Public
- **Share Tokens**: Unique URLs for private sharing
- **Import**: Users can import shared datasheets into their collection
- **Public Library**: Browse community-created datasheets

### 4. Library UI
- **Source Tabs**: Filter by ALL / OFFICIAL / MY DATASHEETS
- **Action Menu**: Hover any card to access Fork, Edit, Share, Delete, View Details
- **Visual Badges**: CUSTOM (purple), FORK (cyan), version number indicators

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Datasheet Library Page                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [ALL] [OFFICIAL] [MY DATASHEETS]    [+ CREATE CUSTOM]       ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ ⋮ Datasheet │ │ ⋮ Datasheet │ │ ⋮ Datasheet │             │
│  │   Card      │ │   Card      │ │   Card      │             │
│  │  [CUSTOM]   │ │  [FORK][v2] │ │  Official   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘

Action Menu (⋮):
├── 📋 Copy/Fork     → Creates user's own copy
├── ✏️ Edit          → Opens editor (own datasheets only)
├── 🔗 Share         → Opens share modal (own datasheets only)
├── 🗑️ Delete        → Deletes datasheet (own datasheets only)
└── 📜 View Details  → Navigate to detail page with version history
```

## User Workflows

### Creating a Custom Datasheet

1. Click "+ CREATE CUSTOM" button (requires login)
2. Multi-step editor opens with tabs:
   - **Basic Info**: Name, faction, role, keywords
   - **Stats**: Movement, toughness, save, wounds, etc.
   - **Weapons**: Add ranged/melee weapons with profiles
   - **Abilities**: Add core and special abilities
   - **Extras**: Leader rules, transport capacity, source
3. Submit creates datasheet + initial version (v1)

### Forking an Existing Datasheet

1. Hover any datasheet card → click ⋮ menu
2. Select "📋 Copy/Fork"
3. System creates new datasheet with:
   - All data copied from original
   - `forkedFromId` reference to source
   - Ownership assigned to current user
   - `isOfficial: false`, `visibility: private`
4. User can now edit their copy freely

### Viewing Version History

1. Navigate to datasheet detail page (`/datasheets/[id]`)
2. Version History Panel shows all versions
3. Each version displays:
   - Version number and optional label
   - Changelog (what changed)
   - Creation date and creator
4. Click to expand and view snapshot preview

### Sharing a Datasheet

1. Click ⋮ → "🔗 Share" on your custom datasheet
2. Share Modal opens with options:
   - **Private**: Only you can see it
   - **Link**: Anyone with the link can view/import
   - **Public**: Listed in public library
3. If "Link" selected, share URL is generated
4. Recipients can preview and import to their collection

## Database Schema

### Datasheet Model (Updated)

```prisma
model Datasheet {
  id               String   @id @default(uuid())
  name             String
  faction          String
  // ... existing fields ...
  
  // Versioning & Ownership
  isOfficial       Boolean  @default(false)
  ownerId          String?
  owner            User?    @relation("DatasheetOwner")
  forkedFromId     String?
  forkedFrom       Datasheet? @relation("DatasheetFork")
  forks            Datasheet[] @relation("DatasheetFork")
  currentVersion   Int      @default(1)
  versions         DatasheetVersion[]
  
  // Sharing
  visibility       String   @default("private") // private, link, public
  shareToken       String?  @unique
  
  @@unique([name, faction, subfaction, ownerId])
}
```

### DatasheetVersion Model (New)

```prisma
model DatasheetVersion {
  id            String    @id @default(uuid())
  datasheetId   String
  datasheet     Datasheet @relation(fields: [datasheetId])
  versionNumber Int       // Sequential: 1, 2, 3...
  versionLabel  String?   // Optional: "Q4 2024 Balance"
  snapshotData  String    @db.Text // Full JSON snapshot
  changelog     String?   @db.Text // What changed
  createdAt     DateTime  @default(now())
  createdById   String?
  createdBy     User?     @relation("DatasheetVersionCreator")
  
  @@unique([datasheetId, versionNumber])
}
```

### Snapshot Data Structure

Each version stores a complete JSON snapshot:

```json
{
  "datasheet": {
    "name": "Custom Terminator",
    "faction": "Space Marines",
    "role": "Infantry",
    "movement": "5\"",
    "toughness": 5,
    "save": "2+",
    "wounds": 3,
    // ... all datasheet fields
  },
  "weapons": [
    {
      "name": "Storm Bolter",
      "type": "ranged",
      "range": "24\"",
      "attacks": "2",
      // ... weapon fields
    }
  ],
  "abilities": [
    {
      "name": "Teleport Strike",
      "description": "...",
      "abilityType": "unit"
    }
  ],
  "wargearOptions": []
}
```

## API Endpoints

### User's Datasheets

**GET `/api/datasheets/mine`**
```typescript
// Response
{
  datasheets: Datasheet[],
  count: number
}
```

### Create Datasheet

**POST `/api/datasheets`**
```typescript
// Request body: CreateDatasheetSchema
// Creates datasheet + version 1
// Returns: { datasheet, version }
```

### Update Datasheet

**PUT `/api/datasheets/detail/[id]`**
```typescript
// Request body: UpdateDatasheetSchema
// Creates new version automatically
// Returns: { datasheet, version }
```

### Fork Datasheet

**POST `/api/datasheets/detail/[id]/fork`**
```typescript
// Request body: { visibility?: string }
// Returns: { datasheet } (forked copy)
```

### Share Settings

**GET/POST `/api/datasheets/detail/[id]/share`**
```typescript
// GET returns: { visibility, shareToken, shareUrl }
// POST body: { visibility: 'private' | 'link' | 'public' }
```

### Version History

**GET `/api/datasheets/detail/[id]/versions`**
```typescript
// Returns: { versions: DatasheetVersion[] }
```

**GET `/api/datasheets/detail/[id]/versions/[versionId]`**
```typescript
// Returns: { version: DatasheetVersion, snapshotData: object }
```

## UI Components

### DatasheetEditorModal

Multi-step form for creating/editing datasheets:

```typescript
interface DatasheetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateDatasheetInput) => Promise<void>;
  initialData?: Partial<CreateDatasheetInput>;
  mode: 'create' | 'edit';
  factions: Faction[];
}
```

Steps:
1. Basic Info (name, faction, role, keywords)
2. Stats (M, T, SV, W, LD, OC, points)
3. Weapons (add/remove weapon entries)
4. Abilities (add/remove ability entries)
5. Extras (leader rules, transport, source)

### ShareModal

Generic sharing UI for datasheets and armies:

```typescript
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'datasheet' | 'army';
  itemId: string;
  itemName: string;
}
```

### VersionHistoryPanel

Displays version timeline with expandable details:

```typescript
interface VersionHistoryPanelProps {
  datasheetId: string;
  currentVersion: number;
}
```

## Sharing System

### Visibility Levels

| Level | Description | Who Can See | Listed in Library |
|-------|-------------|-------------|-------------------|
| `private` | Only owner | Owner only | No |
| `link` | Anyone with URL | Link holders | No |
| `public` | Everyone | All users | Yes |

### Share Token Generation

When visibility is set to `link`:
- Unique token generated: `crypto.randomUUID()`
- Share URL format: `{origin}/datasheets/import/{shareToken}`
- Token can be regenerated by setting visibility back to `private` then `link`

### Import Flow

1. User visits share URL
2. Preview shows datasheet details
3. "Import" button creates forked copy
4. Imported datasheet added to user's collection

## Related Documentation

- **[Datasheets API](../api/DATASHEETS_API.md)** - Full API reference
- **[Army Management UI](ARMY_MANAGEMENT_UI.md)** - Related army features
- **[Faction System](FACTION_SYSTEM.md)** - Faction hierarchy and validation
- **[Database Schema](../../prisma/schema.prisma)** - Full Prisma schema
