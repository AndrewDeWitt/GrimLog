# Admin Panel for Factions, Detachments & Stratagems

**Last Updated:** 2025-11-30  
**Status:** Complete  
**Version:** 4.20.0

## Overview

The Admin Panel provides administrators with full visibility and CRUD control over the game's hierarchical data structure: Factions → Detachments → Stratagems. This is essential for spot-checking data after mass imports and maintaining data integrity.

## Table of Contents

- [Key Features](#key-features)
- [Access Control](#access-control)
- [Data Hierarchy](#data-hierarchy)
- [User Interface](#user-interface)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Bulk Operations](#bulk-operations)
- [Technical Architecture](#technical-architecture)
- [Related Documentation](#related-documentation)

## Key Features

### Hierarchical Data View
- Browse Factions with their associated Detachments
- Expand Detachments to view their Stratagems
- Quick stats showing counts at each level
- Collapsible sections for easy navigation

### Full CRUD Operations
- **Create:** Add new factions, detachments, or stratagems
- **Read:** View detailed information for any entity
- **Update:** Edit names, descriptions, abilities, and metadata
- **Delete:** Remove entities with cascade warnings

### Admin-Only Access
- Protected by `isAdmin` flag on User model
- Automatic 401/403 responses for unauthorized users
- Admin link only visible in navigation for admin users

## Access Control

### Granting Admin Access

Admin status is controlled via the `isAdmin` field on the User model:

```sql
-- Grant admin access via Supabase SQL Editor
UPDATE "User" SET "isAdmin" = true WHERE email = 'admin@example.com';
```

### Authorization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User navigates to /admin/*                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  requireAdminAuth() checks:                                     │
│  1. Valid Supabase session exists                               │
│  2. User record has isAdmin = true                              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        ┌──────────┐                   ┌──────────────┐
        │  PASS    │                   │   FAIL       │
        │  Access  │                   │   401/403    │
        │  granted │                   │   Redirect   │
        └──────────┘                   └──────────────┘
```

## Data Hierarchy

The admin panel manages three interconnected entity types:

```
Faction (e.g., "Space Marines")
    │
    ├── Detachment (e.g., "Gladius Task Force")
    │       │
    │       ├── Stratagem: "Armour of Contempt"
    │       ├── Stratagem: "Only in Death..."
    │       └── Stratagem: "Honour the Chapter"
    │
    └── Detachment (e.g., "Firestorm Assault Force")
            │
            ├── Stratagem: "Burning Vengeance"
            └── Stratagem: "Crucible of Battle"
```

### Relationships

| Parent | Child | Relationship |
|--------|-------|--------------|
| Faction | Detachment | One-to-Many via `factionId` |
| Detachment | StratagemData | One-to-Many via `detachmentId` |
| Detachment | Enhancement | One-to-Many via `detachmentId` |

## User Interface

### Main Dashboard (`/admin/factions`)

The main admin page displays:
- List of all factions with detachment counts
- Expandable rows to view detachments
- Nested expansion for stratagems
- Action buttons for Create, Edit, Delete

### Navigation

Admin link appears in the hamburger menu only for users with `isAdmin: true`:

```
⚙ SYSTEM MENU
├── SESSIONS
├── ARMIES
├── DATASHEETS
└── ⚙ ADMIN PANEL  ← Only visible to admins
```

### Detail Pages

| Route | Purpose |
|-------|---------|
| `/admin/factions` | Main dashboard with hierarchical view |
| `/admin/factions/[id]` | Edit faction, view its detachments |
| `/admin/detachments/[id]` | Edit detachment, view its stratagems |
| `/admin/stratagems/[id]` | Edit stratagem details |

## API Endpoints

All admin endpoints are protected by `requireAdminAuth()`.

### Factions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/factions` | List all factions |
| POST | `/api/admin/factions` | Create new faction |
| GET | `/api/admin/factions/[id]` | Get single faction |
| PUT | `/api/admin/factions/[id]` | Update faction |
| DELETE | `/api/admin/factions/[id]` | Delete faction |

### Detachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/factions/[id]/detachments` | List detachments for faction |
| POST | `/api/admin/factions/[id]/detachments` | Create detachment under faction |
| GET | `/api/admin/detachments/[id]` | Get single detachment |
| PUT | `/api/admin/detachments/[id]` | Update detachment |
| DELETE | `/api/admin/detachments/[id]` | Delete detachment |

### Stratagems

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/detachments/[id]/stratagems` | List stratagems for detachment |
| POST | `/api/admin/detachments/[id]/stratagems` | Create stratagem under detachment |
| GET | `/api/admin/stratagems/[id]` | Get single stratagem |
| PUT | `/api/admin/stratagems/[id]` | Update stratagem |
| DELETE | `/api/admin/stratagems/[id]` | Delete stratagem |

### Bulk Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/bulk/export` | Export all data as JSON |
| POST | `/api/admin/bulk/import` | Import data from JSON |

See [Admin API Documentation](../api/ADMIN_API.md) for full request/response formats.

## Database Schema

### User Model (Updated)

```prisma
model User {
  id        String   @id
  email     String   @unique
  name      String?
  avatar    String?
  isAdmin   Boolean  @default(false)  // NEW
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // ... relations
}
```

### Detachment Model (New)

```prisma
model Detachment {
  id                String          @id @default(uuid())
  name              String          @unique
  faction           String
  factionRel        Faction?        @relation(fields: [factionId], references: [id])
  factionId         String?
  description       String?         @db.Text
  detachmentAbility String?         @db.Text
  sourceBook        String?
  edition           String          @default("10th")
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  stratagemData     StratagemData[]
  enhancements      Enhancement[]

  @@unique([name, factionId])
  @@index([factionId])
}
```

### StratagemData Model (Updated)

```prisma
model StratagemData {
  // ... existing fields
  detachment    String?      // Legacy string field (preserved)
  detachmentId  String?      // NEW: Foreign key to Detachment
  detachmentRel Detachment?  @relation(fields: [detachmentId], references: [id])
  // ... rest of fields
}
```

## Bulk Operations

### Export Format

```json
{
  "exportedAt": "2025-11-30T12:00:00.000Z",
  "factions": [
    {
      "id": "faction-uuid",
      "name": "Space Marines",
      "detachments": [
        {
          "id": "detachment-uuid",
          "name": "Gladius Task Force",
          "stratagems": [
            {
              "id": "stratagem-uuid",
              "name": "Armour of Contempt",
              "cost": "1",
              "effect": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

### Import Behavior

- **Merge mode:** Updates existing records, creates missing ones
- **Validation:** Checks for required fields before import
- **Preview:** Shows changes before applying (future enhancement)

## Technical Architecture

### Key Files

| File | Purpose |
|------|---------|
| `lib/auth/adminAuth.ts` | Admin authorization middleware |
| `app/admin/layout.tsx` | Admin section layout with auth check |
| `app/admin/factions/page.tsx` | Main dashboard |
| `app/api/admin/factions/route.ts` | Faction CRUD API |
| `app/api/admin/detachments/[id]/route.ts` | Detachment CRUD API |
| `app/api/admin/stratagems/[id]/route.ts` | Stratagem CRUD API |
| `components/HamburgerMenu.tsx` | Navigation with admin link |

### Admin Auth Helper

```typescript
// lib/auth/adminAuth.ts
export async function requireAdminAuth(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized: No active session');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true }
  });

  if (!dbUser?.isAdmin) {
    throw new Error('Forbidden: User is not an administrator');
  }

  return user;
}
```

## Related Documentation

- [Admin API Reference](../api/ADMIN_API.md) - Full API documentation
- [Stratagem Detachment System](STRATAGEM_DETACHMENT_SYSTEM.md) - Original detachment-stratagem linking
- [Faction System](FACTION_SYSTEM.md) - Faction architecture overview
- [Database Schema](../ARCHITECTURE.md#database-schema) - Full Prisma schema reference

