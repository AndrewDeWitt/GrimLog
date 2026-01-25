# API Security

**Last Updated:** 2026-01-18
**Status:** Complete
**Version:** 4.88.0

## Overview

Grimlog implements a comprehensive API security model with five layers of protection: authentication, authorization, rate limiting, input validation, and database security (RLS). All endpoints are protected by global rate limiting, with stricter limits on expensive AI operations.

## Table of Contents

- [Security Layers](#security-layers)
- [Rate Limiting](#rate-limiting)
- [Protected Endpoints](#protected-endpoints)
- [Authentication Methods](#authentication-methods)
- [Input Validation](#input-validation)
- [Route Protection](#route-protection)
- [Security Testing](#security-testing)
- [Error Responses](#error-responses)
- [Related Documentation](#related-documentation)

## Security Layers

### Layer 1: Supabase Authentication

All API requests are authenticated via Supabase Auth:
- JWT tokens in cookies (automatically managed by Supabase client)
- Server-side session validation via `createClient()` from `@/lib/supabase/server`
- No API keys exposed to frontend

### Layer 2: Middleware Route Protection

Next.js middleware enforces access control:
- Public routes: `/`, `/auth/callback`
- Authenticated routes: `/dossier`
- Admin routes: `/sessions`, `/armies`, `/datasheets`, `/calculator`, `/admin/*`

### Layer 3: Endpoint-Level Auth

Each protected API endpoint calls `requireAuth()` or `withAdminAuth()`:
- `requireAuth()` - Verifies user is authenticated, returns user object
- `withAdminAuth()` - Verifies user is admin, wraps handler function

### Layer 4: Credits System

LLM endpoints additionally check user credits:
- Prevents abuse even by authenticated users
- Deducts credit before expensive operations
- Returns 402 when credits depleted

### Layer 5: Rate Limiting

All API endpoints are rate-limited to prevent abuse:
- Global limit: 120 requests/minute per user (or IP if unauthenticated)
- Endpoint-specific limits for expensive operations
- See [Rate Limiting](#rate-limiting) section for details

### Layer 6: Database Security (RLS)

Supabase Row Level Security provides defense-in-depth:
- All tables have RLS enabled
- API routes use service role (bypasses RLS)
- Direct client access blocked (if anon key exposed)

## Rate Limiting

### Architecture

Grimlog uses a hybrid rate limiting system:

1. **Global Middleware** (`middleware.ts`) - Applies to ALL API routes
   - Uses Vercel KV/Redis when configured (distributed, production-ready)
   - Fails open if Redis unavailable (individual limits still apply)

2. **Endpoint-Specific** (`lib/rateLimit.ts`) - Stricter limits on expensive endpoints
   - In-memory fallback for development
   - Redis-backed for production

### Rate Limit Configuration

| Endpoint Category | Limit | Window | Reason |
|-------------------|-------|--------|--------|
| **Global (all APIs)** | 120 req | 1 min | Baseline protection |
| `/api/analyze` | 30 req | 1 min | Voice analysis AI |
| `/api/transcribe` | 60 req | 1 min | Whisper API |
| `/api/armies/parse` | 10 req | 1 min | AI parsing |
| `/api/tactical-advisor` | 20 req | 1 min | AI advisor |
| `/api/dossier/submit` | 5 req | 1 min | Most expensive |
| `/api/dossier/generate-*` | 5-10 req | 1 min | Image generation |
| Public galleries | 60 req | 1 min | Read-only browsing |

### Implementation

**Middleware (Global):**

```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'

const globalRateLimiter = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'ratelimit:globalApi',
    })
  : null;

// In middleware function:
if (isApiRoute && globalRateLimiter) {
  const identifier = user ? `user:${user.id}` : `ip:${ip}`
  const { success, remaining } = await globalRateLimiter.limit(identifier)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
}
```

**Endpoint-Specific:**

```typescript
// In API route handler
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

const ipAddress = getClientIp(request);
const identifier = getRateLimitIdentifier(user?.id ?? null, ipAddress);
const rateLimit = checkRateLimit(identifier, RATE_LIMITS.analyze);

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
    { status: 429, headers: { 'Retry-After': '...' } }
  );
}
```

### Response Headers

When Vercel KV is configured, rate limit info is included in responses:

```
X-RateLimit-Remaining: 115
Retry-After: 45  (only on 429 responses)
```

## Protected Endpoints

### Critical LLM Endpoints (Cost Protection)

| Endpoint | Method | Protection | Purpose |
|----------|--------|------------|---------|
| `/api/dossier/submit` | POST | Auth + Credits | AI strategic analysis |
| `/api/armies/parse` | POST | Auth | AI army list parsing |
| `/api/dossier/generate-spirit-icon` | POST | Auth | AI image generation |
| `/api/dossier/generate-stat-icons` | POST | Auth | AI image generation |
| `/api/tactical-advisor` | POST | Auth | AI tactical advice |
| `/api/analyze` | POST | Auth | Voice command analysis |

### Admin Endpoints

| Endpoint | Method | Protection | Purpose |
|----------|--------|------------|---------|
| `/api/admin/users` | GET | Admin | List all users |
| `/api/admin/users/[id]/credits` | PATCH | Admin | Adjust credits |
| `/api/admin/factions/*` | ALL | Admin | Faction management |
| `/api/admin/datasheets/*` | ALL | Admin | Datasheet management |
| `/api/admin/icons/*` | ALL | Admin | Icon management |

### Public Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/factions` | GET | List factions |
| `/api/datasheets` | GET | List datasheets |
| `/api/datasheets/[id]` | GET | Get datasheet |

## Authentication Methods

### requireAuth()

Standard authentication check for protected endpoints:

```typescript
import { requireAuth } from '@/lib/auth/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    // user.id, user.email available
    // ... handler logic
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Handle other errors
  }
}
```

### withAdminAuth()

Admin-only wrapper for sensitive operations:

```typescript
import { withAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    // Only executes if user is admin
    const data = await fetchSensitiveData();
    return NextResponse.json({ data });
  });
}
```

## Input Validation

### Safe JSON Parsing

All `JSON.parse()` calls are wrapped to prevent crashes on malformed data:

```typescript
// lib/datasheetHelpers.ts
function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

// Usage
keywords: safeJsonParse<string[]>(datasheet.keywords, []),
```

### Numeric Query Parameters

All numeric query parameters are validated against NaN:

```typescript
const parsedLimit = parseInt(searchParams.get('limit') || '50');
const limit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100);

const parsedOffset = parseInt(searchParams.get('offset') || '0');
const offset = isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);
```

### Error Response Sanitization

Internal error details are logged server-side but not exposed to clients:

```typescript
// BAD - leaks DB schema
return NextResponse.json({ error: 'Failed', details: error.meta }, { status: 400 });

// GOOD - logs details, returns safe message
console.error('Foreign key constraint details:', error.meta);
return NextResponse.json({ error: 'Foreign key constraint failed.' }, { status: 400 });
```

## Route Protection

### Middleware Configuration

```typescript
// middleware.ts
const PUBLIC_ROUTES = ['/', '/auth/callback'];
const DOSSIER_ROUTES = ['/dossier'];
const ADMIN_ROUTES = ['/sessions', '/armies', '/datasheets', '/calculator', '/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await getUser(request);

  // Public routes - allow
  if (PUBLIC_ROUTES.some(r => pathname === r)) {
    return sessionResponse;
  }

  // Not authenticated - redirect or 401
  if (!user) {
    if (pathname.startsWith('/api')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Admin routes - check isAdmin
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    const isAdmin = await checkIsAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dossier', request.url));
    }
  }

  return sessionResponse;
}
```

## Security Testing

### Automated Test Script

`scripts/security-test.ps1` verifies all endpoints return correct status codes:

```powershell
# Run while dev server is running
powershell -ExecutionPolicy Bypass -File scripts/security-test.ps1
```

### Test Coverage

**19 endpoint tests across 4 categories:**

1. **Critical LLM Endpoints** (6 tests) - All return 401 without auth
2. **Admin Endpoints** (4 tests) - All return 401/403 without admin
3. **Other Protected Endpoints** (6 tests) - All return 401 without auth
4. **Public Endpoints** (3 tests) - All return 200 without auth

### Expected Results

```
========================================
  GRIMLOG API SECURITY TESTS
========================================

=== Critical LLM Endpoints (MUST return 401) ===
Testing: Dossier Analyze (requires auth + credits)
  POST /api/dossier/submit
  Status: 401
  ✅ PASS - Expected 401, Got 401

... (19 tests total)

========================================
  SECURITY TEST SUMMARY
========================================
PASSED: 19
FAILED: 0
```

## Error Responses

### 401 Unauthorized

Returned when no valid session exists:

```json
{
  "error": "Unauthorized"
}
```

### 402 Payment Required

Returned when credits depleted:

```json
{
  "error": "No credits remaining"
}
```

### 403 Forbidden

Returned when authenticated but not admin:

```json
{
  "error": "Forbidden"
}
```

### 500 Internal Server Error

Returned for actual server errors (never for auth failures):

```json
{
  "error": "Failed to process request"
}
```

## LLM Token Limits

All LLM endpoints have `maxOutputTokens` limits to prevent runaway costs:

| Endpoint | Limit | Max Output |
|----------|-------|------------|
| Dossier Analysis | 24,576 | ~100KB |
| Dossier Suggestions | 8,192 | ~32KB |
| Army Parsing | 16,384 | ~64KB |
| Voice Commands | 8,192 | ~32KB |
| Tactical Advisor | 20,000 | ~80KB |

## Related Documentation

- **[Dossier Credits System](DOSSIER_CREDITS_SYSTEM.md)** - Usage-based access control
- **[Admin Panel](ADMIN_PANEL.md)** - Admin feature overview
- **[Dossier Async Endpoints](../api/DOSSIER_ASYNC_ENDPOINTS.md)** - Submit/status/dismiss APIs
- **[Langfuse Observability](LANGFUSE_OBSERVABILITY.md)** - Request tracing and monitoring

