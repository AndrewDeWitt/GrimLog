# Competitive Create From Text API

**Last Updated:** 2025-12-27
**Status:** Complete

## Overview
This API endpoint allows administrators to manually create a competitive context source by providing a transcript or article text. This source can then be parsed by AI to extract unit and faction insights.

## Endpoint
`POST /api/competitive/create-from-text`

## Authentication
- **Role**: Admin only (`withAdminAuth`)

## Request Format
### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | The title of the source (e.g., "Goonhammer Tier List") |
| `transcript` | string | Yes | The full text or transcript content |
| `sourceType` | string | No | `youtube`, `article`, `notes`, or `other`. Defaults to `other`. |
| `sourceUrl` | string | No | The original URL for reference |
| `channelName` | string | No | Author or YouTube channel name |
| `gameVersion` | string | No | e.g., "January 2025 Dataslate" |
| `gameVersionDate` | string | No | ISO date string for the version |

### Example Request
```json
{
  "title": "Salamanders Forgefather's Seekers 10 Tips",
  "transcript": "Full transcript text here...",
  "sourceType": "youtube",
  "sourceUrl": "https://youtube.com/watch?v=Yh9NFoHprH0",
  "channelName": "Hubtown Hammer",
  "gameVersion": "January 2025 Dataslate"
}
```

## Response Format
### Success (201 Created)
```json
{
  "success": true,
  "source": {
    "id": "uuid-string",
    "videoTitle": "Salamanders Forgefather's Seekers 10 Tips",
    "channelName": "Hubtown Hammer",
    "status": "fetched",
    "transcriptLength": 45896,
    "gameVersion": "January 2025 Dataslate",
    "createdAt": "2025-12-27T12:34:56.789Z"
  },
  "message": "Source created successfully. Ready for parsing."
}
```

### Error Responses
- **400 Bad Request**: Missing title or transcript text.
- **401 Unauthorized**: User is not logged in.
- **403 Forbidden**: User is not an administrator.
- **409 Conflict**: A source with the provided URL already exists.

## Usage in Workflow
After calling this endpoint, the administrator should call `POST /api/competitive/parse-context` with the returned `id` to trigger the AI extraction process.

## Related Documentation
- [Competitive Context Paste Feature](../features/COMPETITIVE_CONTEXT_PASTE.md)
- [Competitive Context Parser Logic](../../lib/competitiveContextParser.ts)

