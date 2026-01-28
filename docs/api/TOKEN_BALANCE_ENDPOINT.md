# Token Balance Endpoint

**Last Updated:** 2026-01-27  
**Status:** Complete  
**Version:** 4.91.0

## Overview

The Token Balance endpoint allows authenticated users to fetch their current token balance, access status, recent transactions, and active feature costs.

## Endpoint

```
GET /api/tokens/balance
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
  "balance": 15,
  "accessStatus": "ACTIVE",
  "isAdmin": false,
  "recentTransactions": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "amount": -3,
      "transactionType": "USAGE",
      "featureKey": "generate_brief",
      "description": "Brief generation",
      "createdAt": "2026-01-27T14:30:00.000Z"
    },
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "amount": 10,
      "transactionType": "GRANT",
      "featureKey": null,
      "description": "Admin grant - Welcome bonus",
      "createdAt": "2026-01-25T10:00:00.000Z"
    }
  ],
  "featureCosts": [
    {
      "featureKey": "generate_brief",
      "tokenCost": 3,
      "displayName": "Tactical Brief"
    },
    {
      "featureKey": "quick_check",
      "tokenCost": 1,
      "displayName": "Quick List Check"
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `balance` | `number` | Current token balance |
| `accessStatus` | `string` | User access status: `ACTIVE` or `WAITLISTED` |
| `isAdmin` | `boolean` | Whether the user has admin privileges |
| `recentTransactions` | `array` | Last 10 token transactions |
| `featureCosts` | `array` | Active features with their token costs |

### Transaction Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique transaction ID |
| `amount` | `number` | Token change (positive for grants/refunds, negative for usage) |
| `transactionType` | `string` | `GRANT`, `PURCHASE`, `USAGE`, or `REFUND` |
| `featureKey` | `string \| null` | Associated feature (if applicable) |
| `description` | `string \| null` | Human-readable description |
| `createdAt` | `string` | ISO 8601 timestamp |

### Feature Cost Object

| Field | Type | Description |
|-------|------|-------------|
| `featureKey` | `string` | Unique identifier for the feature |
| `tokenCost` | `number` | Tokens required to use this feature |
| `displayName` | `string \| null` | Human-readable feature name |

### Error (401 Unauthorized)

```json
{
  "error": "Unauthorized"
}
```

### Error (500 Internal Server Error)

```json
{
  "error": "Failed to fetch token balance"
}
```

## Usage Example

### Frontend (React)

```typescript
interface TokenInfo {
  balance: number;
  accessStatus: 'ACTIVE' | 'WAITLISTED';
  isAdmin: boolean;
  recentTransactions: Transaction[];
  featureCosts: FeatureCost[];
}

const fetchTokenInfo = async (): Promise<TokenInfo | null> => {
  try {
    const response = await fetch('/api/tokens/balance');
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
};

// Usage in component
const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

useEffect(() => {
  fetchTokenInfo().then(setTokenInfo);
}, []);

// Display balance
const displayBalance = tokenInfo?.isAdmin 
  ? '∞' 
  : `⬢ ${tokenInfo?.balance ?? 0}`;
```

### Check Feature Affordability

```typescript
const canAffordFeature = (featureKey: string): boolean => {
  if (!tokenInfo) return false;
  if (tokenInfo.isAdmin) return true;
  
  const feature = tokenInfo.featureCosts.find(f => f.featureKey === featureKey);
  if (!feature) return false;
  
  return tokenInfo.balance >= feature.tokenCost;
};

// Usage
if (!canAffordFeature('generate_brief')) {
  openInsufficientTokensModal();
}
```

## Related Documentation

- **[Token Economy System](../features/TOKEN_ECONOMY_SYSTEM.md)** - Full token system documentation
- **[Token Purchase Endpoint](TOKEN_PURCHASE_ENDPOINT.md)** - Token purchase API
- **[Admin Feature Costs Endpoint](ADMIN_FEATURE_COSTS_ENDPOINT.md)** - Admin pricing API
- **[Admin Users Tokens Endpoint](ADMIN_USERS_TOKENS_ENDPOINT.md)** - Admin user token management
