# User Credits Endpoint

**Last Updated:** 2026-01-04  
**Status:** Complete  
**Version:** 4.58.0

## Overview

The User Credits endpoint allows authenticated users to fetch their current dossier credit balance and admin status.

## Endpoint

```
GET /api/users/credits
```

## Authentication

**Required:** Yes (Supabase Auth session)

## Request

No request body required.

### Headers

```
Cookie: sb-*-auth-token=... (automatically set by Supabase client)
```

## Response

### Success (200 OK)

```json
{
  "credits": 2,
  "isAdmin": false
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `credits` | `number` | Remaining dossier generations. Returns `Infinity` for admins. |
| `isAdmin` | `boolean` | Whether the user has admin privileges. |

### Error (401 Unauthorized)

```json
{
  "error": "Unauthorized"
}
```

### Error (500 Internal Server Error)

```json
{
  "error": "Failed to fetch credits"
}
```

## Usage Example

### Frontend (React)

```typescript
const fetchCredits = async () => {
  try {
    const response = await fetch('/api/users/credits');
    if (response.ok) {
      const { credits, isAdmin } = await response.json();
      setDossierCredits(credits);
      setIsAdmin(isAdmin);
    }
  } catch (error) {
    console.error('Error fetching credits:', error);
  }
};
```

### Display Logic

```typescript
// Show infinity symbol for admins
const displayCredits = credits === Infinity ? '∞' : credits;

// Disable button when depleted
const canGenerate = isAdmin || credits > 0;
```

## Related Documentation

- **[Dossier Credits System](../features/DOSSIER_CREDITS_SYSTEM.md)** - Full credits system documentation
- **[Admin Users Endpoint](ADMIN_USERS_ENDPOINT.md)** - Admin credit management API
- **[Dossier Async Endpoints](DOSSIER_ASYNC_ENDPOINTS.md)** - Main dossier generation API

