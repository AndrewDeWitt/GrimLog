# Admin Icons Delete Endpoint

**Last Updated:** 2025-12-20  
**Status:** Complete

## Overview

`DELETE /api/admin/icons/delete` removes a unit icon from Supabase Storage and the `GlobalUnitIcon` database table. This allows admins to delete icons that are unsatisfactory and regenerate them.

This endpoint is **admin-only**.

## Table of Contents
- [DELETE /api/admin/icons/delete](#delete-apiadminiconsdelete)
- [Permissions](#permissions)
- [Storage Cleanup](#storage-cleanup)
- [Related Documentation](#related-documentation)

## DELETE /api/admin/icons/delete

### Request Body
```json
{
  "unitName": "Intercessor Squad",
  "faction": "Space Marines"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `unitName` | string | Yes | Exact unit name as stored in database |
| `faction` | string | Yes | Exact faction name as stored in database |

### Response (success)
```json
{
  "success": true,
  "deleted": {
    "unitName": "Intercessor Squad",
    "faction": "Space Marines",
    "path": "icons/space_marines/Intercessor_Squad.png"
  }
}
```

### Response (not found)
```json
{
  "error": "Icon not found"
}
```
Status: `404`

### Response (error)
```json
{
  "error": "human readable message"
}
```
Status: `500`

## Permissions
- Requires an authenticated Supabase user with `User.isAdmin = true` in the Grimlog database.
- Non-admin users receive a `401 Unauthorized` response.

## Storage Cleanup

The endpoint performs two cleanup operations:

1. **Supabase Storage:** Removes the PNG file from the `unit-icons` bucket
2. **Database:** Deletes the `GlobalUnitIcon` record

If the storage deletion fails (e.g., file already deleted), the database record is still removed to maintain consistency.

## Example Usage

```typescript
const response = await fetch('/api/admin/icons/delete', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    unitName: 'Wolf Guard Terminators',
    faction: 'Space Wolves'
  })
});

if (response.ok) {
  console.log('Icon deleted successfully');
}
```

## Related Documentation
- [Unit Icon Generation](../features/UNIT_ICON_GENERATION.md)
- [Admin Icons Generate Endpoint](ADMIN_ICONS_GENERATE_ENDPOINT.md)
- [Icons Resolve Endpoint](ICONS_RESOLVE_ENDPOINT.md)

