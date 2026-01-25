# Datasheet Sources API

**Last Updated:** 2025-12-27
**Status:** Complete

## Overview
Internal admin API for managing external content sources (YouTube videos, articles) linked to specific datasheets. Used by the Admin UI and the offline Python worker script.

## Table of Contents
- [List Sources](#list-sources)
- [Add Source](#add-source)
- [Update Source](#update-source)
- [Delete Source](#delete-source)
- [Fetch Pending](#fetch-pending)
- [Bulk Update](#bulk-update)

## List Sources
`GET /api/admin/datasheet-sources`

### Parameters
| Name | Type | Description |
|------|------|-------------|
| `datasheetId` | String | (Optional) Filter by datasheet |
| `status` | String | (Optional) pending, fetched, processed, error |
| `limit` | Number | (Optional) Default 50 |

### Response
```json
{
  "sources": [
    {
      "id": "uuid",
      "datasheetId": "id",
      "sourceType": "youtube",
      "sourceUrl": "url",
      "status": "pending",
      "datasheet": { "name": "...", "faction": "..." }
    }
  ],
  "counts": { "pending": 5, "processed": 10 },
  "total": 1
}
```

## Add Source
`POST /api/admin/datasheet-sources`

### Request Body
```json
{
  "datasheetId": "string",
  "sourceUrl": "string",
  "sourceType": "youtube"
}
```

## Update Source
`PATCH /api/admin/datasheet-sources/[id]`

### Request Body
Allows updating transcript, context, status, and metadata.

## Delete Source
`DELETE /api/admin/datasheet-sources/[id]`

## Fetch Pending
`GET /api/admin/datasheet-sources/pending`

Returns sources with `status: "pending"` formatted for the Python worker script.

## Bulk Update
`POST /api/admin/datasheet-sources/bulk-update`

Used by the Python script to save processing results for multiple sources at once.

### Request Body
```json
{
  "updates": [
    {
      "id": "uuid",
      "status": "processed",
      "transcript": "...",
      "extractedContext": { ... },
      "confidence": 85
    }
  ]
}
```

## Related Documentation
- [Competitive Context Database](docs/features/COMPETITIVE_CONTEXT_DATABASE.md)
- [Admin API](docs/api/ADMIN_API.md)

