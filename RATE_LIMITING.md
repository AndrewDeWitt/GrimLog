# Rate Limiting Implementation

## Overview

Rate limiting has been implemented for expensive AI endpoints to prevent abuse and control costs.

## Implementation

Rate limiting is implemented in `lib/rateLimit.ts` and uses an in-memory store. For production at scale, consider:

- **Vercel's built-in rate limiting** (recommended for Vercel deployments)
- **Redis-based rate limiting** (for distributed systems)
- **Upstash Redis** (serverless Redis, works well with Vercel)

## Current Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/analyze` | 30 requests | 1 minute |
| `/api/transcribe` | 60 requests | 1 minute |
| `/api/armies/parse` | 10 requests | 1 minute |
| `/api/tactical-advisor` | 20 requests | 1 minute |
| `/api/admin/icons/generate` | 5 requests | 1 minute |

## How It Works

1. **Identifier**: Uses user ID (if authenticated) or IP address
2. **Window**: Sliding window per identifier
3. **Response**: Returns 429 status with `Retry-After` header when limit exceeded

## Adding Rate Limiting to Other Endpoints

Example for `/api/transcribe`:

```typescript
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  
  // Rate limiting
  const ipAddress = getClientIp(request);
  const identifier = getRateLimitIdentifier(user.id, ipAddress);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.transcribe);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }
  
  // ... rest of handler
}
```

## Production Considerations

### Current Implementation (In-Memory)
- ✅ Simple, no external dependencies
- ✅ Works for single-instance deployments
- ⚠️ Each Vercel serverless function has its own store
- ⚠️ Not shared across instances

### Recommended: Vercel Rate Limiting

Vercel provides built-in rate limiting. Add to `vercel.json`:

```json
{
  "functions": {
    "app/api/analyze/route.ts": {
      "maxDuration": 30
    }
  },
  "crons": []
}
```

Or use Vercel's Edge Config for distributed rate limiting.

### Alternative: Upstash Redis

For distributed rate limiting:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Use Redis for rate limiting store
```

## Monitoring

Monitor rate limit hits:
- Check Vercel logs for 429 responses
- Add analytics to track rate limit violations
- Adjust limits based on usage patterns

## Adjusting Limits

Edit `lib/rateLimit.ts`:

```typescript
export const RATE_LIMITS = {
  analyze: {
    maxRequests: 50, // Increase limit
    windowMs: 60 * 1000,
  },
  // ...
};
```


