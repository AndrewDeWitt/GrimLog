# Admin Users Endpoint

**Last Updated:** 2026-01-04  
**Status:** Complete  
**Version:** 4.58.0

## Overview

The Admin Users endpoints allow administrators to list all users and manage their dossier credits.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users with credits |
| PATCH | `/api/admin/users/[id]/credits` | Adjust a user's credits |

## Authentication

**Required:** Admin privileges (`isAdmin: true`)

Non-admin users receive a 401 or 403 response.

---

## GET /api/admin/users

List all registered users with their credit balances.

### Request

No request body required.

### Response (200 OK)

```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://...",
      "isAdmin": false,
      "dossierCredits": 2,
      "createdAt": "2026-01-04T12:00:00.000Z",
      "updatedAt": "2026-01-04T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `users` | `array` | List of user objects |
| `users[].id` | `string` | User UUID (from Supabase Auth) |
| `users[].email` | `string` | User email address |
| `users[].name` | `string?` | Display name (may be null) |
| `users[].avatar` | `string?` | Avatar URL (may be null) |
| `users[].isAdmin` | `boolean` | Admin status |
| `users[].dossierCredits` | `number` | Current credit balance |
| `users[].createdAt` | `string` | ISO timestamp |
| `users[].updatedAt` | `string` | ISO timestamp |
| `count` | `number` | Total user count |

### Error (401 Unauthorized)

```json
{
  "error": "Unauthorized"
}
```

---

## PATCH /api/admin/users/[id]/credits

Adjust a specific user's credit balance.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | User UUID to modify |

### Request Body

**Option 1: Relative Adjustment**

Add or subtract from current balance:

```json
{
  "adjustment": 5
}
```

**Option 2: Absolute Set**

Set to an exact value:

```json
{
  "credits": 10
}
```

### Response (200 OK)

```json
{
  "success": true,
  "newCredits": 10
}
```

### Error Responses

**400 Bad Request** - Invalid amount:
```json
{
  "error": "Invalid amount provided"
}
```

**401 Unauthorized** - Not authenticated:
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden** - Not admin:
```json
{
  "error": "Forbidden"
}
```

**404 Not Found** - User doesn't exist:
```json
{
  "error": "User not found"
}
```

---

## Usage Examples

### List All Users

```typescript
const fetchUsers = async () => {
  const response = await fetch('/api/admin/users');
  const { users, count } = await response.json();
  console.log(`Found ${count} users`);
  return users;
};
```

### Add Credits

```typescript
const addCredits = async (userId: string, amount: number) => {
  const response = await fetch(`/api/admin/users/${userId}/credits`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adjustment: amount })
  });
  const { newCredits } = await response.json();
  return newCredits;
};

// Add 5 credits
await addCredits('user-uuid', 5);
```

### Set Exact Credits

```typescript
const setCredits = async (userId: string, amount: number) => {
  const response = await fetch(`/api/admin/users/${userId}/credits`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credits: amount })
  });
  const { newCredits } = await response.json();
  return newCredits;
};

// Set to exactly 10 credits
await setCredits('user-uuid', 10);
```

---

## Admin UI

The Admin Users page at `/admin/users` provides a visual interface for these operations:

- **User Table:** Displays all users with sortable columns
- **Quick Adjust:** +1/-1 buttons for simple adjustments
- **Set Value:** Input field + Enter to set exact credits
- **Real-time Updates:** List refreshes after each change

## Related Documentation

- **[Dossier Credits System](../features/DOSSIER_CREDITS_SYSTEM.md)** - Full credits system documentation
- **[User Credits Endpoint](USER_CREDITS_ENDPOINT.md)** - User-facing credits API
- **[API Security](../features/API_SECURITY.md)** - Authentication and authorization
- **[Admin Panel](../features/ADMIN_PANEL.md)** - Admin feature overview

