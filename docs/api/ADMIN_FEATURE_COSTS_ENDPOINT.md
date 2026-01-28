# Admin Feature Costs Endpoint

**Last Updated:** 2026-01-27  
**Status:** Complete  
**Version:** 4.91.0

## Overview

The Admin Feature Costs endpoints provide CRUD operations for managing dynamic feature pricing in the token economy system. Admins can create, update, and deactivate feature costs without code deployment.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/feature-costs` | List all feature costs |
| POST | `/api/admin/feature-costs` | Create a new feature cost |
| GET | `/api/admin/feature-costs/[featureKey]` | Get a specific feature cost |
| PATCH | `/api/admin/feature-costs/[featureKey]` | Update a feature cost |
| DELETE | `/api/admin/feature-costs/[featureKey]` | Delete or deactivate a feature cost |

## Authentication

**Required:** Admin authorization (Supabase Auth + `isAdmin: true`)

All endpoints use the `withAdminAuth` middleware, which returns:
- `401 Unauthorized` if not authenticated
- `403 Forbidden` if authenticated but not admin

## List Feature Costs

### GET /api/admin/feature-costs

Returns all feature costs, including inactive ones.

**Response (200 OK):**

```json
{
  "featureCosts": [
    {
      "featureKey": "generate_brief",
      "displayName": "Tactical Brief",
      "description": "Deep tactical analysis with AI-powered insights",
      "tokenCost": 3,
      "isActive": true,
      "createdAt": "2026-01-27T00:00:00.000Z",
      "updatedAt": "2026-01-27T00:00:00.000Z"
    },
    {
      "featureKey": "quick_check",
      "displayName": "Quick List Check",
      "description": "Fast army list validation",
      "tokenCost": 1,
      "isActive": true,
      "createdAt": "2026-01-27T00:00:00.000Z",
      "updatedAt": "2026-01-27T00:00:00.000Z"
    },
    {
      "featureKey": "deprecated_feature",
      "displayName": "Old Feature",
      "description": null,
      "tokenCost": 5,
      "isActive": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "count": 3
}
```

## Create Feature Cost

### POST /api/admin/feature-costs

Creates a new feature cost entry.

**Request Body:**

```json
{
  "featureKey": "new_feature",
  "displayName": "New Feature",
  "description": "Description of the new feature",
  "tokenCost": 2,
  "isActive": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `featureKey` | `string` | Yes | Unique identifier (snake_case recommended) |
| `displayName` | `string` | No | Human-readable name |
| `description` | `string` | No | Feature description |
| `tokenCost` | `number` | Yes | Token cost (must be positive integer) |
| `isActive` | `boolean` | No | Whether feature is available (default: true) |

**Response (201 Created):**

```json
{
  "featureKey": "new_feature",
  "displayName": "New Feature",
  "description": "Description of the new feature",
  "tokenCost": 2,
  "isActive": true,
  "createdAt": "2026-01-27T14:30:00.000Z",
  "updatedAt": "2026-01-27T14:30:00.000Z"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "featureKey and tokenCost are required"
}
```

**Error (409 Conflict):**

```json
{
  "error": "Feature cost with this key already exists"
}
```

## Get Feature Cost

### GET /api/admin/feature-costs/[featureKey]

Returns a specific feature cost by key.

**Response (200 OK):**

```json
{
  "featureKey": "generate_brief",
  "displayName": "Tactical Brief",
  "description": "Deep tactical analysis with AI-powered insights",
  "tokenCost": 3,
  "isActive": true,
  "createdAt": "2026-01-27T00:00:00.000Z",
  "updatedAt": "2026-01-27T00:00:00.000Z"
}
```

**Error (404 Not Found):**

```json
{
  "error": "Feature cost not found"
}
```

## Update Feature Cost

### PATCH /api/admin/feature-costs/[featureKey]

Updates an existing feature cost. Supports partial updates.

**Request Body:**

```json
{
  "tokenCost": 4,
  "isActive": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | `string` | Update display name |
| `description` | `string` | Update description |
| `tokenCost` | `number` | Update token cost (must be positive integer) |
| `isActive` | `boolean` | Enable/disable feature |

**Response (200 OK):**

```json
{
  "featureKey": "generate_brief",
  "displayName": "Tactical Brief",
  "description": "Deep tactical analysis with AI-powered insights",
  "tokenCost": 4,
  "isActive": false,
  "createdAt": "2026-01-27T00:00:00.000Z",
  "updatedAt": "2026-01-27T15:00:00.000Z"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "tokenCost must be a positive integer"
}
```

**Error (404 Not Found):**

```json
{
  "error": "Feature cost not found"
}
```

## Delete Feature Cost

### DELETE /api/admin/feature-costs/[featureKey]

Deletes or deactivates a feature cost.

**Behavior:**
- If the feature has **no ledger entries**: Hard delete (removed from database)
- If the feature has **ledger entries**: Soft delete (set `isActive: false`)

This preserves audit trail integrity while allowing cleanup of unused features.

**Response (200 OK) - Hard Delete:**

```json
{
  "message": "Feature cost deleted",
  "deleted": true
}
```

**Response (200 OK) - Soft Delete:**

```json
{
  "message": "Feature cost deactivated (has ledger entries)",
  "deactivated": true
}
```

**Error (404 Not Found):**

```json
{
  "error": "Feature cost not found"
}
```

## Usage Examples

### Update Price in Real-Time

```bash
# Increase brief cost due to rising API costs
curl -X PATCH /api/admin/feature-costs/generate_brief \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{"tokenCost": 4}'
```

### Disable a Feature Temporarily

```bash
# Disable matchup simulator during maintenance
curl -X PATCH /api/admin/feature-costs/matchup_simulator \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{"isActive": false}'
```

### Add a New Feature

```bash
# Add a new premium feature
curl -X POST /api/admin/feature-costs \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{
    "featureKey": "premium_analysis",
    "displayName": "Premium Analysis",
    "description": "In-depth analysis with competitive meta insights",
    "tokenCost": 5,
    "isActive": true
  }'
```

### Frontend Admin Dashboard

```typescript
// Fetch all feature costs
const fetchFeatureCosts = async () => {
  const response = await fetch('/api/admin/feature-costs');
  if (response.ok) {
    const { featureCosts } = await response.json();
    setFeatureCosts(featureCosts);
  }
};

// Update a feature cost
const updateFeatureCost = async (featureKey: string, updates: Partial<FeatureCost>) => {
  const response = await fetch(`/api/admin/feature-costs/${featureKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  
  if (response.ok) {
    // Refresh the list
    await fetchFeatureCosts();
    toast.success('Feature cost updated');
  }
};
```

## Default Feature Costs

These are the default feature costs seeded during setup:

| Feature Key | Display Name | Cost | Description |
|-------------|--------------|------|-------------|
| `generate_brief` | Tactical Brief | 3 | Deep tactical brief analysis |
| `generate_dossier` | Full Dossier | 3 | Complete dossier generation |
| `quick_check` | Quick Check | 1 | Fast list validation |
| `matchup_simulator` | Matchup Sim | 5 | Matchup simulation (future) |
| `image_generation` | Image Gen | 2 | Army badge/icon generation |

## Related Documentation

- **[Token Economy System](../features/TOKEN_ECONOMY_SYSTEM.md)** - Full token system documentation
- **[Token Balance Endpoint](TOKEN_BALANCE_ENDPOINT.md)** - User token balance API
- **[Admin Users Tokens Endpoint](ADMIN_USERS_TOKENS_ENDPOINT.md)** - Admin user token management
- **[Admin Panel](../features/ADMIN_PANEL.md)** - Admin feature overview
