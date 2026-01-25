# Dossier History & Sharing API

**Last Updated:** 2026-01-13 (v4.75.0)
**Status:** Complete

## Overview

API endpoints for managing dossier history, sharing, and public gallery access. All dossier generations are automatically saved after successful analysis, providing permanent URLs and sharing capabilities.

## Endpoints

### GET /api/dossier/[id]

Fetch a single dossier by ID. Respects visibility settings (private, link, public).

**Authentication:** Optional (required for private dossiers)

**Parameters:**
- `id` (path) - Dossier UUID

**Response:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "faction": "Space Wolves",
  "detachment": "Saga of the Great Wolf",
  "totalPoints": 2000,
  "unitCount": 12,
  "modelCount": 50,
  "listName": "The High King's Hammer",
  "visibility": "private" | "link" | "public",
  "shareToken": "abc123..." | null,
  "spiritIconUrl": "https://...",
  "viewCount": 0,
  "localAnalysis": { /* DossierAnalysis object */ },
  "strategicAnalysis": { /* DossierStrategicAnalysis object */ },
  "listSuggestions": [ /* ListSuggestion[] */ ],
  "createdAt": "2026-01-07T...",
  "updatedAt": "2026-01-07T...",
  "isOwner": true | false
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (private dossier, not owner)
- `404` - Dossier not found
- `500` - Server error

### PATCH /api/dossier/[id]

Update dossier visibility or name. Only owner can update.

**Authentication:** Required

**Parameters:**
- `id` (path) - Dossier UUID

**Request Body:**
```json
{
  "visibility": "private" | "link" | "public",  // Optional
  "listName": "My List Name"  // Optional
}
```

**Response:**
```json
{
  "id": "uuid",
  "visibility": "link",
  "shareToken": "abc123...",
  "listName": "My List Name",
  // ... other fields
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid visibility value
- `401` - Unauthorized
- `403` - Access denied (not owner)
- `404` - Dossier not found
- `500` - Server error

**Notes:**
- Setting visibility to `link` or `public` automatically generates a `shareToken` if one doesn't exist.
- Share tokens are unique and permanent.

### DELETE /api/dossier/[id]

Delete user's own dossier.

**Authentication:** Required

**Parameters:**
- `id` (path) - Dossier UUID

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Access denied (not owner)
- `404` - Dossier not found
- `500` - Server error

### GET /api/dossier/list

List user's dossier history with pagination, filtering, and sorting.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional) - Items per page (default: 20, max: 100)
- `offset` (optional) - Pagination offset (default: 0)
- `faction` (optional) - Filter by faction name
- `detachment` (optional) - Filter by detachment name
- `minPoints` (optional) - Minimum points filter (default: 0)
- `maxPoints` (optional) - Maximum points filter (default: 99999)
- `sort` (optional) - Sort order: `recent` (default), `popular`, or `oldest`
- `search` (optional) - Search by listName (case-insensitive)
- `visibility` (optional) - Filter by visibility: `private`, `link`, or `public`

**Response:**
```json
{
  "dossiers": [
    {
      "id": "uuid",
      "faction": "Space Wolves",
      "detachment": "Saga of the Great Wolf",
      "totalPoints": 2000,
      "unitCount": 12,
      "modelCount": 50,
      "listName": "The High King's Hammer",
      "spiritIconUrl": "https://...",
      "visibility": "private",
      "shareToken": "abc123...",
      "viewCount": 0,
      "createdAt": "2026-01-07T...",
      "executiveSummary": "This list...",
      "tagline": "The Invulnerable Avalanche",
      "archetype": "elite",
      "playstyleBlend": { "primary": { "style": "Aggressive", "percentage": 70 } },
      "combatSpectrum": 65,
      "totalWounds": 120
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0,
  "factions": ["Space Wolves", "Necrons"],
  "detachments": ["Saga of the Great Wolf", "Stormlance Task Force"],
  "factionMeta": {
    "Space Wolves": { "iconUrl": "https://..." }
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Server error

### POST /api/dossier/bulk

Perform bulk operations on multiple dossiers.

**Authentication:** Required

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"],
  "action": "delete" | "setVisibility",
  "visibility": "private" | "link" | "public"  // Required for setVisibility
}
```

**Response (delete):**
```json
{
  "success": true,
  "action": "delete",
  "affected": 3
}
```

**Response (setVisibility):**
```json
{
  "success": true,
  "action": "setVisibility",
  "visibility": "public",
  "affected": 3
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (missing ids, invalid action/visibility)
- `401` - Unauthorized
- `403` - Access denied (one or more dossiers not owned by user)
- `500` - Server error

**Notes:**
- Maximum 100 items per request
- For `setVisibility` with `link` or `public`, share tokens are automatically generated for dossiers that don't have one
- All IDs must belong to the authenticated user

### GET /api/dossier/public

Browse public gallery with filtering and sorting.

**Authentication:** Optional

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20, max: 100)
- `faction` (optional) - Filter by faction name
- `sort` (optional) - Sort order: `recent` (default) or `popular`

**Response:**
```json
{
  "dossiers": [
    {
      "id": "uuid",
      "faction": "Space Wolves",
      "detachment": "Saga of the Great Wolf",
      "totalPoints": 2000,
      "unitCount": 12,
      "modelCount": 50,
      "listName": "The High King's Hammer",
      "spiritIconUrl": "https://...",
      "createdAt": "2026-01-07T...",
      "viewCount": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 127,
    "totalPages": 7,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

**Notes:**
- `sort=popular` orders by `viewCount` descending.
- `sort=recent` orders by `createdAt` descending.

### GET /api/dossier/share/[token]

Access shared dossier via token. No authentication required.

**Authentication:** None

**Parameters:**
- `token` (path) - Share token

**Response:**
```json
{
  "id": "uuid",
  "faction": "Space Wolves",
  "detachment": "Saga of the Great Wolf",
  "totalPoints": 2000,
  "unitCount": 12,
  "modelCount": 50,
  "listName": "The High King's Hammer",
  "spiritIconUrl": "https://...",
  "localAnalysis": { /* DossierAnalysis object */ },
  "strategicAnalysis": { /* DossierStrategicAnalysis object */ },
  "listSuggestions": [ /* ListSuggestion[] */ ],
  "createdAt": "2026-01-07T...",
  "viewCount": 15
}
```

**Status Codes:**
- `200` - Success (increments view count)
- `404` - Dossier not found or invalid token
- `500` - Server error

**Notes:**
- View count is incremented on each successful access.
- Token must match a dossier with `visibility` set to `link` or `public`.

## Auto-Save on Generation

The `/api/dossier/submit` endpoint automatically saves dossier data after successful background generation:

**Response Addition:**
```json
{
  "strategicAnalysis": { /* ... */ },
  "listSuggestions": [ /* ... */ ],
  "spiritIconUrl": "https://...",
  "dossierId": "uuid",  // ⭐ NEW - ID of saved dossier
  "generatedAt": "2026-01-07T...",
  "faction": "Space Wolves",
  "detachment": "Saga of the Great Wolf"
}
```

**Notes:**
- Dossier is saved with `visibility: "private"` by default.
- Save failures don't block dossier display (graceful degradation).
- `dossierId` is returned for immediate redirect to permanent URL.

## Database Schema

The `DossierGeneration` model stores dossier data:

**Indexed Metadata Columns:**
- `id`, `userId`, `createdAt`, `updatedAt`
- `faction`, `detachment`, `totalPoints`, `unitCount`, `modelCount`
- `listName`, `visibility`, `shareToken`, `spiritIconUrl`, `viewCount`

**JSONB Columns:**
- `localAnalysis` - Complete `DossierAnalysis` object
- `strategicAnalysis` - Complete `DossierStrategicAnalysis` object
- `listSuggestions` - Array of `ListSuggestion` objects

## Related Documentation

- [Dossier Async Endpoints](DOSSIER_ASYNC_ENDPOINTS.md) - Submit/status/dismiss APIs
- [Tactical Dossier Feature](../features/TACTICAL_DOSSIER.md) - Complete feature documentation
