# Dossier Editing & Versioning System

**Last Updated:** 2026-01-18
**Status:** Complete
**Version:** 4.87.0

## Overview

The Dossier Editing & Versioning system allows users to refine AI-generated tactical dossiers with their own knowledge before sharing. Every edit creates a version snapshot, enabling users to track changes and restore previous versions if needed.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [User Flow](#user-flow)
- [Components](#components)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Auto-Save & Recovery](#auto-save--recovery)
- [Related Documentation](#related-documentation)

## Features

### Inline Editing

All AI-generated content can be edited inline:

| Section | Editable Fields |
|---------|----------------|
| **Army Quirks** | Emoji, name, value, description; Add/remove quirks |
| **Unit Profiles** | Tactical summary, role assignment (dropdown) |
| **List Modifications** | Title, reasoning, tradeoffs; Add/remove units |
| **Matchup Guide** | Archetype, rating, win condition (dropdowns); Battle plan, reasoning, tips |

### Version History

- **Automatic versioning:** Every save creates a version snapshot
- **Optional labels:** Add memorable names like "Pre-tournament tweaks"
- **Changelog:** Document what changed in each version
- **Restore:** Revert to any previous version (creates a new version with restored content)
- **v1 preservation:** Original AI-generated content always preserved as v1

### Kebab Menu Actions

The kebab menu (⋮) consolidates all dossier actions:
- **Edit:** Toggle edit mode
- **History:** Open version history panel
- **Share:** Open sharing modal (owners only)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dossier View Page                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              DossierEditToolbar                      │   │
│  │  [✎ EDITING]  [● Unsaved]    [SAVE] [DISCARD] [DONE]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │ Actions Menu │  │         DossierReport               │ │
│  │  ⋮           │  │  ┌─────────────────────────────┐   │ │
│  │  • Edit      │  │  │ ArmyQuirksGrid (editable)   │   │ │
│  │  • History   │  │  └─────────────────────────────┘   │ │
│  │  • Share     │  │  ┌─────────────────────────────┐   │ │
│  └──────────────┘  │  │ UnitRoleGroup (editable)    │   │ │
│                    │  └─────────────────────────────┘   │ │
│                    │  ┌─────────────────────────────┐   │ │
│                    │  │ MatchupGuide (editable)     │   │ │
│                    │  └─────────────────────────────┘   │ │
│                    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## User Flow

### Editing a Dossier

1. Click kebab menu (⋮) → **Edit**
2. Edit toolbar appears with Save, Discard, Done buttons
3. Click any editable field to modify
4. Changes auto-save to localStorage every 30 seconds
5. Click **Save** → Modal for optional label/changelog → Creates version
6. Click **Done** to exit edit mode

### Restoring a Version

1. Click kebab menu (⋮) → **History**
2. Version history panel slides in from right
3. Click **Restore** on any previous version
4. New version created with restored content
5. Original versions preserved (no history deleted)

### Recovering Unsaved Work

1. If browser closes with unsaved edits, localStorage preserves WIP
2. On next page load, recovery modal appears
3. Choose **Restore** to continue editing or **Discard** to start fresh

## Components

### Core Edit Components

| Component | Purpose |
|-----------|---------|
| `EditableText` | Inline text editing with view/edit toggle |
| `EditableSelect` | Dropdown for enum fields (roles, ratings, archetypes) |
| `DossierEditToolbar` | Sticky toolbar with Save, Discard, Done buttons |
| `DossierActionsMenu` | Kebab menu with Edit, History, Share options |

### Version Management

| Component | Purpose |
|-----------|---------|
| `SaveVersionModal` | Modal for version label and changelog |
| `DossierVersionHistoryPanel` | Slide-out panel showing all versions |
| `WIPRecoveryModal` | Prompt to restore unsaved localStorage edits |

### Section Components (Modified for Edit Mode)

| Component | Edit Mode Features |
|-----------|-------------------|
| `ArmyQuirksGrid` | Edit emoji, name, value, description; Add/remove quirks |
| `UnitRoleGroup` | Edit tactical summary; Role dropdown |
| `ListSuggestionsSection` | Edit title, reasoning; Add/remove units |
| `MatchupGuide` | Edit battle plan, tips; Archetype/rating/win condition dropdowns |

## API Endpoints

### Content Editing

```
PATCH /api/dossier/[id]
```

**Body:**
```json
{
  "strategicAnalysis": { /* partial updates merged with existing */ },
  "listSuggestions": [ /* full replacement if provided */ ],
  "createVersion": true,
  "versionLabel": "Pre-tournament tweaks",
  "changelog": "Updated matchup guide for local meta"
}
```

### Version Management

```
GET /api/dossier/[id]/versions
```
Returns all versions with metadata.

```
POST /api/dossier/[id]/versions/[versionNumber]/restore
```
Restores specified version (creates new version with restored content).

## Database Schema

### DossierVersion Model

```prisma
model DossierVersion {
  id            String   @id @default(uuid())
  dossierId     String
  dossier       DossierGeneration @relation(...)
  versionNumber Int
  versionLabel  String?
  snapshotData  String   @db.Text  // JSON of strategicAnalysis + listSuggestions
  changelog     String?  @db.Text
  createdAt     DateTime @default(now())
  createdById   String?
  createdBy     User?    @relation(...)

  @@unique([dossierId, versionNumber])
}
```

### DossierGeneration Updates

```prisma
model DossierGeneration {
  // ... existing fields ...
  currentVersion    Int       @default(1)
  isEdited          Boolean   @default(false)
  lastEditedAt      DateTime?
  versions          DossierVersion[]
}
```

## Auto-Save & Recovery

### localStorage Structure

```typescript
const DOSSIER_WIP_KEY = (id: string) => `grimlog_dossier_wip_${id}`;

interface DossierWIPData {
  dossierId: string;
  savedAt: string;  // ISO timestamp
  baseVersion: number;
  edits: {
    strategicAnalysis: Partial<DossierStrategicAnalysis>;
    listSuggestions: ListSuggestion[];
  };
}
```

### Auto-Save Behavior

- Saves every 30 seconds while `hasUnsavedChanges` is true
- Clears on successful save or explicit discard
- `beforeunload` warning prevents accidental navigation

### Recovery Flow

1. On page load, check for WIP data in localStorage
2. If found and dossier is owned by user, show recovery modal
3. User can restore (populates edit state) or discard (clears localStorage)

## Related Documentation

- **[Dossier System](./DOSSIER_SYSTEM.md)** - Overview of tactical dossier generation
- **[Dossier Share Modal](./DOSSIER_SHARE_MODAL.md)** - Sharing and visibility settings
- **[API: Dossier Endpoints](../api/DOSSIER_ENDPOINT.md)** - Full API reference
