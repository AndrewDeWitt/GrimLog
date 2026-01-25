# Icons Resolve Endpoint

**Last Updated:** 2025-12-20  
**Status:** Complete

## Overview
Grimlog uses `/api/icons/resolve` to resolve unit icon URLs for UI surfaces like armies, datasheet lists, and admin icon dashboards. The endpoint supports single lookups (GET) and batch lookups (POST), and applies consistent fallback logic.

**v4.37.0 Update:** Icon URLs now include cache busting via `?v={timestamp}` query parameter to ensure regenerated icons display immediately without browser cache issues.

## Table of Contents
- [GET /api/icons/resolve](#get-apiiconsresolve)
- [POST /api/icons/resolve](#post-apiiconsresolve)
- [Resolution Priority](#resolution-priority)
- [Related Documentation](#related-documentation)

## GET /api/icons/resolve

### Query Parameters
- `unitName` (required): Unit/datasheet name (e.g., `Intercessor Squad`)
- `faction` (required): Faction string (e.g., `Space Marines`)
- `datasheetId` (optional): Datasheet ID to allow an exact global match when available

### Response
```json
{
  "iconUrl": "https://<project>.supabase.co/storage/v1/object/public/unit-icons/icons/<faction>/<unit>.png?v=1703097600000"
}
```

The `?v={timestamp}` query parameter is derived from the icon's `updatedAt` field for cache busting.

If no icon exists, `iconUrl` is `null`.

## POST /api/icons/resolve

### Request Body
```json
{
  "units": [
    { "faction": "Space Marines", "unitName": "Intercessor Squad" },
    { "faction": "Space Marines", "unitName": "Scout Squad" }
  ]
}
```

### Response
```json
{
  "icons": {
    "Space Marines:Intercessor Squad": "https://<project>.supabase.co/storage/v1/object/public/unit-icons/icons/space_marines/Intercessor_Squad.png?v=1703097600000",
    "Space Marines:Scout Squad": null
  }
}
```

Each icon URL includes cache busting via `?v={timestamp}` from the icon's `updatedAt` field.

## Resolution Priority
1. **Global icons**: `GlobalUnitIcon` mapping → Supabase Storage public URL
2. **User icons** (optional override support): `UnitIcon` (per-user) blob URL
3. **Filesystem fallback**: `public/icons/<faction>/<unit>.png`
4. **No icon**: `null` (UI falls back to role-based emoji)

## Related Documentation
- [Unit Icon Generation](../features/UNIT_ICON_GENERATION.md)
- [Admin Icons Generate Endpoint](ADMIN_ICONS_GENERATE_ENDPOINT.md)
- [Admin Icons Delete Endpoint](ADMIN_ICONS_DELETE_ENDPOINT.md)
- [Datasheets API](DATASHEETS_API.md)


