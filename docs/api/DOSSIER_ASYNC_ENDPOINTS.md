# Dossier Async Generation Endpoints

**Last Updated:** 2026-01-19
**Status:** Complete

## Overview

These endpoints support the async dossier generation flow introduced in v4.70.0. Instead of blocking for 3-5 minutes, users submit their army list, receive an immediate response, and poll for completion.

## Table of Contents

- [Submit Endpoint](#submit-endpoint)
- [Status Endpoint](#status-endpoint)
- [Dismiss Endpoint](#dismiss-endpoint)
- [Error Codes](#error-codes)

---

## Submit Endpoint

**POST** `/api/dossier/submit`

Submits an army list for async background processing. Returns immediately with a dossier ID for polling.

### Authentication

Requires authenticated user session.

### Request Body

```json
{
  "text": "Space Marines\nSpace Wolves\nStormlance Task Force\n...",
  "factionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `factionId` | string | Yes | UUID of the selected faction (from `/api/factions`) |
| `text` | string | Yes | Army list text (minimum 20 characters) |

> **Note:** The `factionId` is used to filter datasheets during parsing, improving accuracy. Subfactions automatically include their parent faction's datasheets (e.g., Space Wolves includes Space Marines).

### Response (Success - 200)

```json
{
  "success": true,
  "dossierId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Dossier generation started. You will be notified when complete."
}
```

### Response (Error)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Please select a faction` | Missing or empty factionId |
| 400 | `Please provide an army list text` | Missing or empty text |
| 400 | `Army list text is too short` | Text less than 20 characters |
| 401 | `Authentication required` | Not logged in |
| 402 | `No credits remaining` | User has no dossier credits |
| 429 | `Rate limit exceeded` | Too many requests |

### Example

```bash
curl -X POST https://grimlog.app/api/dossier/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"factionId": "space-wolves-uuid", "text": "Space Marines\nSpace Wolves\n..."}'
```

---

## Status Endpoint

**GET** `/api/dossier/status`

Polls for pending, completed, and failed dossiers. Used by the notification system to update the header badge and show toasts.

### Authentication

Requires authenticated user session.

### Response (Success - 200)

```json
{
  "pending": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "processing",
      "startedAt": "2026-01-11T10:30:00.000Z",
      "faction": "Space Wolves"
    }
  ],
  "pendingCount": 1,
  "recentlyCompleted": [
    {
      "id": "660f9500-f39c-52e5-b827-557766551111",
      "faction": "Adepta Sororitas",
      "completedAt": "2026-01-11T10:25:00.000Z"
    }
  ],
  "recentlyFailed": [
    {
      "id": "770a0600-g40d-63f6-c938-668877662222",
      "faction": "Tyranids",
      "completedAt": "2026-01-11T10:20:00.000Z",
      "errorMessage": "Failed to parse army list"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `pending` | array | Dossiers currently generating |
| `pendingCount` | number | Count of pending dossiers |
| `recentlyCompleted` | array | Completed dossiers (last 24h, not dismissed) |
| `recentlyFailed` | array | Failed dossiers (last 24h, not dismissed) |

### Filtering Rules

- **Pending**: All dossiers with status `pending` or `processing`
- **Completed**: Status `completed`, `notificationDismissedAt` is null, `completedAt` within last 24 hours
- **Failed**: Status `failed`, `notificationDismissedAt` is null, `completedAt` within last 24 hours
- **Limit**: Maximum 5 items per category

### Example

```bash
curl https://grimlog.app/api/dossier/status \
  -H "Cookie: session=..."
```

---

## Dismiss Endpoint

**POST** `/api/dossier/dismiss`

Marks a dossier notification as acknowledged. The dossier will no longer appear in status responses.

### Authentication

Requires authenticated user session.

### Request Body

```json
{
  "dossierId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dossierId` | string | Yes | UUID of the dossier to dismiss |

### Response (Success - 200)

```json
{
  "success": true,
  "dismissed": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always true on success |
| `dismissed` | boolean | True if a record was updated, false if already dismissed |

### Response (Error)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing dossierId` | No dossier ID provided |
| 401 | `Authentication required` | Not logged in |

### Security

- Only the dossier owner can dismiss their own notifications
- Attempting to dismiss another user's dossier silently succeeds with `dismissed: false`

### Example

```bash
curl -X POST https://grimlog.app/api/dossier/dismiss \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"dossierId": "550e8400-e29b-41d4-a716-446655440000"}'
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `Authentication required` | 401 | User not logged in |
| `No credits remaining` | 402 | Dossier credit balance is 0 |
| `Rate limit exceeded` | 429 | Too many requests in time window |
| `Missing dossierId` | 400 | Required field not provided |
| `Please select a faction` | 400 | Faction ID not provided |
| `Please provide an army list text` | 400 | Text field empty |
| `Army list text is too short` | 400 | Text under 20 characters |

## Related Documentation

- [Tactical Dossier Feature](../features/TACTICAL_DOSSIER.md) - Full feature documentation
- [Dossier Generator Library](../../lib/dossierGenerator.ts) - Core analysis logic
- [Dossier Credits System](../features/DOSSIER_CREDITS_SYSTEM.md) - Credit system details
