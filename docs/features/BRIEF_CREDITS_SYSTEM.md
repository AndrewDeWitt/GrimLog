# Dossier Credits System

**Last Updated:** 2026-01-04  
**Status:** Complete  
**Version:** 4.58.0

## Overview

The Dossier Credits System controls access to AI-powered dossier analysis by limiting the number of generations per user. New users receive 2 free generations upon signing up with Google, with administrators having unlimited access and the ability to grant additional credits.

## Table of Contents

- [How It Works](#how-it-works)
- [User Experience](#user-experience)
- [Admin Management](#admin-management)
- [Technical Implementation](#technical-implementation)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Related Documentation](#related-documentation)

## How It Works

### Credit Flow

1. **New User Signs Up** → Receives 2 credits automatically (database default)
2. **User Generates Dossier** → 1 credit deducted before LLM call
3. **Credits Depleted** → Generate button disabled, helpful message shown
4. **Admin Grants Credits** → User can generate more dossiers

### Admin Bypass

Administrators (`isAdmin: true`) have unlimited generations:
- Credit check returns `Infinity` for admins
- No credit deduction occurs
- Full access to all features

## User Experience

### Credits Display

The dossier page header shows remaining credits:

```
┌─────────────────────────────────────────────────────────┐
│  📋 TACTICAL DOSSIER                  Generations: 2   │
│  Analyze army lists • Generate tactical reports        │
└─────────────────────────────────────────────────────────┘
```

### When Credits Depleted

```
┌─────────────────────────────────────────────────────────┐
│  📋 TACTICAL DOSSIER                  Generations: 0   │
│  Analyze army lists • Generate tactical reports        │
│                                   Out of credits.      │
│                                   Contact admin.       │
└─────────────────────────────────────────────────────────┘
```

The "Generate Tactical Dossier" button becomes disabled with:
- Gray styling indicating unavailability
- Clear messaging about credit depletion

### For Unauthenticated Users

```
┌─────────────────────────────────────────────────────────┐
│  Sign in to generate your Tactical Dossier!            │
│  Google sign-ups get 2 free generations.               │
└─────────────────────────────────────────────────────────┘
```

## Admin Management

### User Credits Admin Panel

Access via hamburger menu → "USER CREDITS" (admin only).

Located at `/admin/users`, the panel provides:

| Feature | Description |
|---------|-------------|
| User List | All users with email, name, admin status, credits |
| Quick Adjust | +1 / -1 buttons for single credit changes |
| Set Value | Input field to set exact credit amount |
| Real-time Updates | List refreshes after each adjustment |

### Granting Admin Status

Admin status must be granted via direct database access:

```sql
-- In Supabase SQL Editor:
UPDATE "User" SET "isAdmin" = true WHERE email = 'your-email@gmail.com';

-- Verify:
SELECT id, email, "isAdmin", "dossierCredits" FROM "User";
```

> **Security Note:** The `scripts/grant-admin.ts` script was removed in v4.58.0 to prevent unauthorized admin escalation.

## Technical Implementation

### Credit Management Library

`lib/dossierCredits.ts` provides these functions:

```typescript
// Check credits and deduct 1 if allowed
checkAndDeductCredit(userId: string): Promise<{
  allowed: boolean;
  remainingCredits: number;
  isAdmin: boolean;
}>

// Get current credits (returns Infinity for admins)
getUserCredits(userId: string): Promise<{
  credits: number;
  isAdmin: boolean;
}>

// Check admin status
checkIsAdmin(userId: string): Promise<boolean>

// Adjust credits by delta (positive or negative)
adjustUserCredits(userId: string, amount: number): Promise<number>

// Set credits to exact value
setUserCredits(userId: string, amount: number): Promise<number>
```

### Endpoint Integration

The dossier submit endpoint checks credits before processing:

```typescript
// In /api/dossier/submit/route.ts
const user = await requireAuth();
const creditCheck = await checkAndDeductCredit(user.id);

if (!creditCheck.allowed) {
  return NextResponse.json(
    { error: 'No credits remaining' },
    { status: 402 }
  );
}
```

## API Endpoints

### GET /api/users/credits

Fetch current user's credit balance.

**Authentication:** Required

**Response:**
```json
{
  "credits": 2,
  "isAdmin": false
}
```

### GET /api/admin/users

List all users with credits (admin only).

**Authentication:** Admin required

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "isAdmin": false,
      "dossierCredits": 2,
      "createdAt": "2026-01-04T..."
    }
  ],
  "count": 1
}
```

### PATCH /api/admin/users/[id]/credits

Adjust a user's credits (admin only).

**Authentication:** Admin required

**Request Body:**
```json
// Relative adjustment (+5 credits)
{ "adjustment": 5 }

// Absolute set (to exactly 10 credits)
{ "credits": 10 }
```

**Response:**
```json
{
  "success": true,
  "newCredits": 10
}
```

## Database Schema

### User Model Update

```prisma
model User {
  id              String   @id
  email           String   @unique
  name            String?
  avatar          String?
  isAdmin         Boolean  @default(false)
  dossierCredits  Int      @default(2)  // NEW
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // ... relations
}
```

### Migration SQL

```sql
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "dossierCredits" INTEGER NOT NULL DEFAULT 2;
```

## Related Documentation

- **[Tactical Dossier](TACTICAL_DOSSIER.md)** - Main dossier feature documentation
- **[API Security](API_SECURITY.md)** - Authentication and authorization
- **[Dossier Async Endpoints](../api/DOSSIER_ASYNC_ENDPOINTS.md)** - Submit/status/dismiss APIs
- **[Admin Panel](ADMIN_PANEL.md)** - Admin feature overview

