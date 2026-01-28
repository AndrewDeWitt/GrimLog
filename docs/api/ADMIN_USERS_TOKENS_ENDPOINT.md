# Admin Users Tokens Endpoint

**Last Updated:** 2026-01-27  
**Status:** Complete  
**Version:** 4.91.0

## Overview

The Admin Users Tokens endpoint allows administrators to manage user token balances, grant tokens, and view transaction history.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users/[id]/tokens` | Get user token info and history |
| POST | `/api/admin/users/[id]/tokens` | Grant tokens to user |
| PATCH | `/api/admin/users/[id]/tokens` | Set or adjust token balance |

## Authentication

**Required:** Admin authorization (Supabase Auth + `isAdmin: true`)

All endpoints use the `withAdminAuth` middleware.

## Get User Token Info

### GET /api/admin/users/[id]/tokens

Returns a user's token balance, status, and transaction history.

**Response (200 OK):**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "tokenBalance": 15,
    "accessStatus": "ACTIVE",
    "isAdmin": false
  },
  "transactions": [
    {
      "id": "tx-uuid",
      "amount": -3,
      "transactionType": "USAGE",
      "featureKey": "generate_brief",
      "description": "Brief generation",
      "createdAt": "2026-01-27T14:30:00.000Z"
    },
    {
      "id": "tx-uuid-2",
      "amount": 10,
      "transactionType": "GRANT",
      "featureKey": null,
      "description": "Admin grant - Welcome bonus",
      "createdAt": "2026-01-25T10:00:00.000Z"
    }
  ],
  "transactionCount": 2
}
```

**Error (404 Not Found):**

```json
{
  "error": "User not found"
}
```

## Grant Tokens

### POST /api/admin/users/[id]/tokens

Grants tokens to a user with an audit trail entry.

**Request Body:**

```json
{
  "amount": 10,
  "description": "Welcome bonus"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | `number` | Yes | Tokens to grant (must be positive) |
| `description` | `string` | No | Reason for grant (appears in ledger) |

**Response (200 OK):**

```json
{
  "success": true,
  "newBalance": 25,
  "granted": 10,
  "ledgerEntry": {
    "id": "ledger-uuid",
    "amount": 10,
    "transactionType": "GRANT",
    "description": "Admin grant - Welcome bonus",
    "createdAt": "2026-01-27T15:00:00.000Z"
  }
}
```

**Error (400 Bad Request):**

```json
{
  "error": "Amount must be a positive integer"
}
```

## Set or Adjust Balance

### PATCH /api/admin/users/[id]/tokens

Sets an absolute balance or applies a relative adjustment.

**Request Body (Absolute Set):**

```json
{
  "balance": 50
}
```

**Request Body (Relative Adjustment):**

```json
{
  "adjustment": -5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `balance` | `number` | Set balance to exact value (must be >= 0) |
| `adjustment` | `number` | Adjust balance by delta (can be negative) |

Note: Only one of `balance` or `adjustment` should be provided.

**Response (200 OK):**

```json
{
  "success": true,
  "previousBalance": 15,
  "newBalance": 50,
  "change": 35
}
```

**Error (400 Bad Request):**

```json
{
  "error": "Adjustment would result in negative balance"
}
```

## Usage Examples

### Grant Welcome Bonus

```bash
curl -X POST /api/admin/users/user-uuid/tokens \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{
    "amount": 10,
    "description": "Welcome bonus for beta tester"
  }'
```

### Set Exact Balance

```bash
curl -X PATCH /api/admin/users/user-uuid/tokens \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{"balance": 100}'
```

### Deduct Tokens (Manual Correction)

```bash
curl -X PATCH /api/admin/users/user-uuid/tokens \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{"adjustment": -5}'
```

### Frontend Integration

```typescript
// Grant tokens to a user
const grantTokens = async (userId: string, amount: number, description?: string) => {
  const response = await fetch(`/api/admin/users/${userId}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, description })
  });
  
  if (response.ok) {
    const result = await response.json();
    toast.success(`Granted ${amount} tokens. New balance: ${result.newBalance}`);
    return result;
  }
  
  const error = await response.json();
  toast.error(error.error);
  return null;
};

// View user token history
const fetchUserTokens = async (userId: string) => {
  const response = await fetch(`/api/admin/users/${userId}/tokens`);
  if (response.ok) {
    return await response.json();
  }
  return null;
};
```

## Related Documentation

- **[Token Economy System](../features/TOKEN_ECONOMY_SYSTEM.md)** - Full token system documentation
- **[Token Balance Endpoint](TOKEN_BALANCE_ENDPOINT.md)** - User token balance API
- **[Admin Feature Costs Endpoint](ADMIN_FEATURE_COSTS_ENDPOINT.md)** - Admin pricing API
- **[Admin Users Endpoint](ADMIN_USERS_ENDPOINT.md)** - Admin user list API
