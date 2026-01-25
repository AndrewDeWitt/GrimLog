# Admin Icons Generate Endpoint

**Last Updated:** 2025-12-20  
**Status:** Complete

## Overview
`POST /api/admin/icons/generate` generates a 256×256 PNG unit icon using Google Gemini image generation, uploads it to Supabase Storage, and persists a global mapping so all users see the same icon.

**v4.37.0 Update:** Prompt switched from anime style to bold comic book illustration with waist-up framing for better weapon/armor visibility at icon sizes.

This endpoint is **admin-only**.

## Table of Contents
- [POST /api/admin/icons/generate](#post-apiadminiconsgenerate)
- [Permissions](#permissions)
- [Storage](#storage)
- [Related Documentation](#related-documentation)

## POST /api/admin/icons/generate

### Request Body
```json
{
  "imageUrl": "https://example.com/reference.jpg",
  "unitName": "Intercessor Squad",
  "faction": "Space Marines",
  "stylePrompt": "optional override prompt",
  "datasheetId": "optional datasheet id"
}
```

### Response (success)
```json
{
  "success": true,
  "url": "https://<project>.supabase.co/storage/v1/object/public/unit-icons/icons/<faction>/<unit>.png",
  "persisted": true
}
```

### Response (error)
```json
{
  "error": "human readable message"
}
```

## Permissions
- Requires an authenticated Supabase user with `User.isAdmin = true` in the Grimlog database.

## Storage
- Bucket: `unit-icons` (public)
- Object path: `icons/<safeFaction>/<safeUnitName>.png`
- Mapping table: `GlobalUnitIcon` (keyed by `faction + unitName`)

## Related Documentation
- [Unit Icon Generation](../features/UNIT_ICON_GENERATION.md)
- [Admin Icons Delete Endpoint](ADMIN_ICONS_DELETE_ENDPOINT.md)
- [Icons Resolve Endpoint](ICONS_RESOLVE_ENDPOINT.md)


