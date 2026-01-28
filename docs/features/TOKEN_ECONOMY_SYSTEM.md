# Token Economy System

**Last Updated:** 2026-01-27  
**Status:** Complete  
**Version:** 4.91.0

## Overview

The Token Economy System provides a flexible, auditable currency system for controlling access to AI-powered features. It replaces the simpler credit system with dynamic pricing, transaction ledgers, and admin controls for real-time cost management.

## Table of Contents

- [Key Concepts](#key-concepts)
- [User Experience](#user-experience)
- [Admin Management](#admin-management)
- [Technical Implementation](#technical-implementation)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Security Considerations](#security-considerations)
- [Related Documentation](#related-documentation)

## Key Concepts

### The Token Currency

| Property | Value |
|----------|-------|
| **Currency Name** | Tokens |
| **Symbol** | ⬢ (Hexagon) |
| **Value Peg** | ~$0.15-0.20 retail |
| **Cost Basis** | ~$0.05-0.10 API cost |

### Dynamic Pricing

Feature costs are stored in the database, not hardcoded. This allows:

- **Real-time price adjustments** without code deployment
- **Margin protection** by adjusting costs based on actual API usage
- **Feature experimentation** with different price points

### Transaction Ledger

Every token operation is recorded in the `TokenLedger` table:

| Transaction Type | Description |
|------------------|-------------|
| `GRANT` | Admin-initiated token grant |
| `PURCHASE` | User token purchase (future) |
| `USAGE` | Tokens spent on a feature |
| `REFUND` | Tokens returned (feature failed before LLM call) |

## User Experience

### Token Balance Display

The hamburger menu shows the user's current token balance:

```
┌─────────────────────────────────────────┐
│  ⚙ MENU                                 │
│  ────────────────────────────────────── │
│  ⬢ 15 Tokens                            │
│  [Get More Tokens]                      │
│  ────────────────────────────────────── │
│  📊 My Dossiers                         │
│  📋 My Armies                           │
└─────────────────────────────────────────┘
```

### Insufficient Tokens Modal

When a user attempts a feature without enough tokens:

```
┌─────────────────────────────────────────┐
│  ⚠️ INSUFFICIENT TOKENS                 │
│                                         │
│  This feature requires 3 tokens.        │
│  You have 2 tokens.                     │
│                                         │
│  You need 1 more token to continue.     │
│                                         │
│  [Get Tokens] [Cancel]                  │
└─────────────────────────────────────────┘
```

### Token Purchase Modal

The purchase flow shows available bundles:

```
┌─────────────────────────────────────────┐
│  ⬢ GET TOKENS                           │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ STARTER PACK          $4.99        ││
│  │ 25 Tokens (⬢25)                    ││
│  │ Best for trying out features       ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ POWER USER            $9.99        ││
│  │ 60 Tokens (⬢60) - BEST VALUE       ││
│  │ For regular users                  ││
│  └─────────────────────────────────────┘│
│                                         │
│  Payment processing coming soon!        │
└─────────────────────────────────────────┘
```

## Admin Management

### Feature Pricing Dashboard

Access via hamburger menu → "PRICING" (admin only).

Located at `/admin/pricing`, the dashboard provides:

| Feature | Description |
|---------|-------------|
| Feature List | All features with current costs |
| Inline Editing | Click cost to edit, instant save |
| Active Toggle | Enable/disable features |
| Cost History | Track when prices changed |

### Admin Token Controls

At `/admin/users`, admins can:

| Action | Description |
|--------|-------------|
| View Balance | See any user's token balance |
| Grant Tokens | Add tokens with audit trail |
| Set Balance | Override to exact amount |
| View History | See user's transaction ledger |

### Setting Feature Costs (Admin API)

```bash
# Update a feature cost
curl -X PATCH /api/admin/feature-costs/generate_brief \
  -H "Content-Type: application/json" \
  -d '{"tokenCost": 4}'
```

## Technical Implementation

### Token Service Layer

`lib/tokenService.ts` provides the core business logic:

```typescript
// Check and deduct tokens atomically (race-condition safe)
const result = await checkAndDeductTokens(userId, 'generate_brief');
if (!result.success) {
  // Handle insufficient tokens
  return { error: result.error, required: result.required };
}

// Refund tokens (only if failure before LLM call)
await refundTokens(userId, 'generate_brief', 'API error before LLM');

// Grant tokens (admin action)
await grantTokens(userId, 10, 'Welcome bonus', adminUserId);

// Get user token info
const info = await getUserTokenInfo(userId);
// { balance: 15, accessStatus: 'ACTIVE', isAdmin: false }
```

### Race Condition Protection

The token deduction uses an atomic conditional update:

```typescript
// Inside checkAndDeductTokens()
await prisma.$transaction(async (tx) => {
  // Atomic update - only succeeds if balance >= cost
  const result = await tx.user.updateMany({
    where: {
      id: userId,
      tokenBalance: { gte: featureCost.tokenCost }
    },
    data: {
      tokenBalance: { decrement: featureCost.tokenCost }
    }
  });
  
  if (result.count === 0) {
    // Balance was insufficient - another request may have raced
    throw new Error('Insufficient tokens');
  }
  
  // Create ledger entry
  await tx.tokenLedger.create({ ... });
});
```

This prevents the TOCTOU (Time-of-Check Time-of-Use) race condition where two concurrent requests could both pass the balance check and then both deduct, resulting in a negative balance.

### Brief Generation Integration

```typescript
// In /api/brief/submit/route.ts

// 1. Validate input BEFORE deducting tokens
if (!factionId) {
  return NextResponse.json({ error: 'Faction ID required' }, { status: 400 });
}

// 2. Check and deduct tokens
const deduction = await checkAndDeductTokens(user.id, 'generate_brief');
if (!deduction.success) {
  return NextResponse.json({
    error: 'Insufficient tokens',
    required: deduction.required,
    current: deduction.current
  }, { status: 402 });
}

// 3. Process in background
let llmCallMade = false;
after(async () => {
  try {
    // First LLM call
    const parsedArmy = await parseArmyListFromText(text, faction);
    llmCallMade = true;  // Mark that we've consumed API resources
    
    // Continue processing...
  } catch (error) {
    // Only refund if we didn't make any LLM calls
    if (!llmCallMade) {
      await refundTokens(user.id, 'generate_brief', error.message);
    }
    throw error;
  }
});
```

## API Endpoints

### User Endpoints

#### GET /api/tokens/balance

Fetch current user's token information.

**Response:**
```json
{
  "balance": 15,
  "accessStatus": "ACTIVE",
  "isAdmin": false,
  "recentTransactions": [
    {
      "id": "uuid",
      "amount": -3,
      "transactionType": "USAGE",
      "featureKey": "generate_brief",
      "description": "Brief generation",
      "createdAt": "2026-01-27T..."
    }
  ],
  "featureCosts": [
    { "featureKey": "generate_brief", "tokenCost": 3, "displayName": "Tactical Brief" }
  ]
}
```

#### GET /api/tokens/purchase

Get available token bundles.

**Response:**
```json
{
  "bundles": [
    { "id": "starter", "tokens": 25, "price": 4.99, "name": "Starter Pack" },
    { "id": "power", "tokens": 60, "price": 9.99, "name": "Power User", "badge": "BEST VALUE" }
  ],
  "paymentEnabled": false
}
```

#### POST /api/tokens/purchase

Attempt to purchase tokens (currently returns 503).

**Response (503):**
```json
{
  "error": "Payment processing coming soon!",
  "message": "Token purchases will be available when payment integration is complete."
}
```

### Admin Endpoints

#### GET /api/admin/feature-costs

List all feature costs (including inactive).

#### POST /api/admin/feature-costs

Create a new feature cost.

#### PATCH /api/admin/feature-costs/[featureKey]

Update a feature's cost or status.

#### DELETE /api/admin/feature-costs/[featureKey]

Soft-delete (if ledger entries exist) or hard-delete a feature cost.

#### GET /api/admin/users/[id]/tokens

Get a user's token info and history.

#### POST /api/admin/users/[id]/tokens

Grant tokens to a user.

#### PATCH /api/admin/users/[id]/tokens

Set or adjust a user's token balance.

## Database Schema

### User Model Changes

```prisma
model User {
  id            String       @id
  email         String       @unique
  name          String?
  avatar        String?
  isAdmin       Boolean      @default(false)
  tokenBalance  Int          @default(0)  // Renamed from briefCredits
  accessStatus  AccessStatus @default(ACTIVE)
  // ... relations
  tokenLedger   TokenLedger[]
}

enum AccessStatus {
  WAITLISTED
  ACTIVE
}
```

### Feature Cost Model

```prisma
model FeatureCost {
  featureKey   String        @id
  displayName  String?
  description  String?
  tokenCost    Int
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  tokenLedger  TokenLedger[]
}
```

### Token Ledger Model

```prisma
model TokenLedger {
  id              String          @id @default(uuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount          Int             // Positive for grants/refunds, negative for usage
  transactionType TransactionType
  featureKey      String?
  featureCost     FeatureCost?    @relation(fields: [featureKey], references: [featureKey])
  description     String?
  createdAt       DateTime        @default(now())
  
  @@index([userId, createdAt(sort: Desc)])
}

enum TransactionType {
  GRANT
  PURCHASE
  USAGE
  REFUND
}
```

## Security Considerations

### Race Condition Protection

The check-then-deduct pattern is vulnerable to race conditions:

```
Request A: Check (3 >= 3) → OK
Request B: Check (3 >= 3) → OK
Request A: Deduct → Balance = 0
Request B: Deduct → Balance = -3 ← BUG
```

**Solution:** Use atomic conditional updates within a transaction:

```typescript
// This is atomic - only ONE request can succeed
await tx.user.updateMany({
  where: { id: userId, tokenBalance: { gte: cost } },
  data: { tokenBalance: { decrement: cost } }
});
```

### Input Validation Order

Always validate input BEFORE deducting tokens:

```typescript
// CORRECT order
validateInput(request);      // 1. Validate first
deductTokens(userId, key);   // 2. Deduct after validation

// WRONG order
deductTokens(userId, key);   // 1. User loses tokens
validateInput(request);      // 2. Request fails - tokens wasted!
```

### LLM Usage Tracking

Tokens should only be refunded if the error occurred BEFORE any LLM API call:

```typescript
let llmCallMade = false;

try {
  // First LLM call
  const result = await callLLM(prompt);
  llmCallMade = true;  // API cost incurred
  
  // Further processing...
} catch (error) {
  if (!llmCallMade) {
    await refundTokens(userId, key, error.message);
  }
  // No refund if LLM was called - we paid for that API call
}
```

### Admin Authorization

All admin endpoints require proper authorization:

```typescript
export const PATCH = withAdminAuth(async (request, user) => {
  // User is verified as admin
  // ...
});
```

## Related Documentation

- **[Tactical Brief](TACTICAL_BRIEF.md)** - Primary token-consuming feature
- **[API Security](API_SECURITY.md)** - Authentication and rate limiting
- **[Token Balance Endpoint](../api/TOKEN_BALANCE_ENDPOINT.md)** - User token API
- **[Admin Feature Costs Endpoint](../api/ADMIN_FEATURE_COSTS_ENDPOINT.md)** - Admin pricing API
- **[Admin Panel](ADMIN_PANEL.md)** - Admin feature overview
