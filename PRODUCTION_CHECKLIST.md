# TacLog Production Security Checklist

**Last Updated:** January 5, 2026  
**Status:** ✅ Production Ready (Security Audit Complete)

---

## Pre-Deployment Checklist

### Authentication & Authorization

- [x] **Supabase Auth** configured with OAuth providers (Google, Microsoft)
- [x] **requireAuth()** enforced on all user data endpoints
- [x] **requireAdmin()** / **withAdminAuth()** on admin-only endpoints
- [x] **Middleware** redirects unauthenticated users from protected routes
- [x] **Session endpoints secured** - All `/api/sessions/[id]/*` routes now require auth + ownership verification
- [x] **Army endpoints secured** - GET/export check visibility permissions
- [x] **User sync secured** - POST `/api/users` validates authenticated user matches request

### Rate Limiting

- [x] **In-memory rate limiting** implemented for all LLM endpoints
- [x] **Vercel KV** integration ready for distributed rate limiting
- [x] Rate limits configured:
  | Endpoint | Limit |
  |----------|-------|
  | `/api/analyze` | 30 req/min |
  | `/api/armies/parse` | 10 req/min |
  | `/api/dossier/submit` | 5 req/min |
  | `/api/tactical-advisor` | 20 req/min |
  | `/api/dossier/generate-spirit-icon` | 10 req/min |
  | `/api/dossier/generate-stat-icons` | 5 req/min |

### Database Security (RLS)

- [x] **Row Level Security** enabled on user data tables:
  - `Army` - users can only access their own armies
  - `GameSession` - users can access own sessions + shared sessions
  - `UnitIcon` - users can only access their own icons
  - `Unit` - users can access units in their own armies
  - `Stratagem` - users can access stratagems in their own armies
- [x] **RLS enabled with NO policies** on reference data tables (complete PostgREST lockdown):
  - `FactionCompetitiveContext`
  - `UnitCompetitiveContext`
  - `DatasheetSource`
  - `DatasheetCompetitiveContext`
  - `CompetitiveSource`
  
  > These tables are only accessed via Prisma on the backend, so no PostgREST access is needed.

### Cost Protection

- [x] **Dossier credits system** - new users get 2 free generations
- [x] **Admin bypass** for unlimited access
- [x] **Rate limiting** prevents rapid API abuse

### Environment & Secrets

- [x] **No secrets in code** - all use `process.env`
- [x] **`.env` files in `.gitignore`** - never committed
- [x] **Vercel environment variables** configured for:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `GOOGLE_API_KEY`
  - `LANGFUSE_SECRET_KEY` / `LANGFUSE_PUBLIC_KEY`

### Vercel Configuration

- [x] **`vercel.json`** created with:
  - Function timeout limits (up to 300s for dossier analysis)
  - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
  - **Content-Security-Policy** header to prevent XSS attacks
  - API cache control headers

### Additional Security Hardening

- [x] **Admin API key disabled** - Script-based admin access removed; all admin operations require session auth via UI
- [ ] **Leaked Password Protection** - Enable in Supabase Dashboard (see instructions below)

---

## Post-Deployment Verification

### Functional Tests
- [ ] Login/logout works via OAuth
- [ ] Rate limiting triggers 429 on excess requests
- [ ] Users can only see their own armies/sessions
- [ ] LLM endpoints return expected responses
- [ ] Admin routes blocked for non-admin users

### Monitoring Setup
- [ ] Vercel Analytics enabled
- [ ] Langfuse tracing visible for LLM calls
- [ ] Error tracking configured

---

## Ongoing Security Tasks

### Weekly
- [ ] Review rate limit violations in logs
- [ ] Check Langfuse for unusual patterns
- [ ] Monitor API costs (OpenAI, Google)

### Monthly
- [ ] Review and rotate API keys if needed
- [ ] Check Supabase security advisors
- [ ] Audit user access patterns
- [ ] Update dependencies (`yarn upgrade`)

### As Needed
- [ ] Respond to security incidents
- [ ] Update RLS policies for new tables
- [ ] Add rate limiting to new endpoints

---

## Vercel KV Setup (Distributed Rate Limiting)

To enable distributed rate limiting across all serverless instances:

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database** → **KV**
3. Connect to your project (environment variables auto-added)
4. Required env vars will be automatically configured:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

The app automatically uses Vercel KV when these are present, falling back to in-memory otherwise.

---

## Supabase Leaked Password Protection

**Status:** Requires manual action in Supabase Dashboard

This feature prevents users from using passwords that have been exposed in data breaches (via HaveIBeenPwned.org).

**To enable:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (TacLogProd)
3. Navigate to **Authentication** → **Providers** → **Email**
4. Scroll to **Password Security**
5. Enable **Leaked password protection**
6. Click **Save**

---

## Emergency Procedures

### If API Costs Spike
1. Check Langfuse for unusual request patterns
2. Review rate limit logs for bypasses
3. Temporarily reduce rate limits in `lib/rateLimit.ts`
4. Consider pausing non-essential LLM features

### If Data Breach Suspected
1. Rotate all API keys immediately
2. Review Supabase audit logs
3. Check RLS policies are active
4. Review recent user registrations

### If Service Degraded
1. Check Vercel status page
2. Check Supabase status page
3. Review function logs in Vercel
4. Fall back to reduced functionality if needed

---

## Architecture Security Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                       │
│  • HTTPS enforced                                            │
│  • Security headers (vercel.json)                            │
│  • DDoS protection                                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Middleware                        │
│  • Session refresh                                           │
│  • Route protection                                          │
│  • Auth redirect                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Route Handlers                        │
│  • requireAuth() - Authentication check                      │
│  • Rate limiting - Abuse prevention                          │
│  • Credit system - Cost control (dossier)                    │
│  • Input validation - Sanitization                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Supabase DB   │ │   OpenAI API    │ │   Google API    │
│  • RLS enabled  │ │  • API key auth │ │  • API key auth │
│  • Row policies │ │  • Cost tracked │ │  • Cost tracked │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Files Modified for Production Security

| File | Purpose |
|------|---------|
| `lib/rateLimit.ts` | In-memory rate limiting with configurable limits |
| `lib/rateLimitRedis.ts` | Vercel KV distributed rate limiting |
| `lib/dossierCredits.ts` | Credit-based access control for dossier |
| `lib/auth/apiAuth.ts` | Authentication helpers |
| `lib/auth/adminAuth.ts` | Admin authorization (session-based only, API key disabled) |
| `middleware.ts` | Route protection and session management |
| `vercel.json` | Function limits, security headers, and CSP |
| `ENABLE_RLS.md` | RLS policy documentation |

### Security Audit (January 5, 2026)

Files secured in security audit:

| File | Changes |
|------|---------|
| `app/api/sessions/[id]/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/events/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/units/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/units/[unitId]/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/units/abilities/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/stratagems/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/validations/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/cp-spent/route.ts` | Added auth + ownership checks |
| `app/api/sessions/[id]/units/[unitId]/model/[modelIndex]/route.ts` | Added auth + ownership checks |
| `app/api/armies/[id]/route.ts` | Added auth to GET with visibility support |
| `app/api/armies/[id]/export/route.ts` | Added auth with visibility support |
| `app/api/users/route.ts` | Secured POST to prevent arbitrary user creation |
| `lib/auth/adminAuth.ts` | Disabled API key auth for production security |
| `vercel.json` | Added Content-Security-Policy header |

---

**Status: Ready for Production** ✅

