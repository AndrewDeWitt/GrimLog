# Vertex AI Migration Guide

**Version:** 4.90.5
**Last Updated:** 2026-01-26
**Status:** Production Ready

---

## Overview

This guide documents the migration from Google AI Studio (`@google/genai` with API key) to Google Cloud Vertex AI with Workload Identity Federation (WIF) for production-grade security.

### Why Vertex AI?

| Aspect | Google AI Studio | Vertex AI + WIF |
|--------|------------------|-----------------|
| **Authentication** | API key (static secret) | WIF (short-lived OIDC tokens) |
| **Security** | Key could leak | Zero secrets in code |
| **SLA** | None | Enterprise SLA available |
| **Compliance** | Limited | HIPAA, SOC2, more |
| **Quotas** | Fixed | Flexible, can request increases |
| **Pricing** | Same | Same (no free tier) |

---

## Architecture

### Authentication Flow

```
[Vercel Function]
    → generates OIDC token (proves it's Vercel)
    → sends to Google STS (Security Token Service)
    → exchanges for short-lived GCP access token
    → calls Vertex AI with that token
```

### Provider Selection

The system supports three AI providers via the `AI_PROVIDER` environment variable:

- `openai` - OpenAI GPT models
- `google` - Google AI Studio (API key auth)
- `vertex` - Google Cloud Vertex AI (WIF auth)

```typescript
// lib/aiProvider.ts
export type AIProvider = 'openai' | 'google' | 'vertex';

export function isGeminiProvider(provider: AIProvider): boolean {
  return provider === 'google' || provider === 'vertex';
}
```

### Client Factory

The `lib/vertexAI.ts` module provides dynamic client selection:

```typescript
import { getGeminiClient, isGeminiProvider } from '@/lib/vertexAI';
import { getProvider } from '@/lib/aiProvider';

// In your API route
const provider = getProvider();
const geminiProvider = isGeminiProvider(provider) ? (provider as 'google' | 'vertex') : 'google';
const gemini = await getGeminiClient(geminiProvider);
```

---

## Setup Instructions

### Prerequisites

1. Google Cloud Project with Vertex AI API enabled
2. Vercel project for deployment
3. `gcloud` CLI installed locally

### Step 1: Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
```

Or via GCP Console: APIs & Services > Enable APIs > Search "Vertex AI API"

### Step 2: Create Workload Identity Pool

1. Go to **IAM & Admin > Workload Identity Federation**
2. Click **Create Pool**
   - Name: `vercel`
   - Pool ID: `vercel`
3. **Add Provider**
   - Select: `OpenID Connect (OIDC)`
   - Provider name: `vercel`
   - Provider ID: `vercel`
   - Issuer URL: `https://oidc.vercel.com/YOUR_VERCEL_TEAM_SLUG`
   - Audience: `https://vercel.com/YOUR_VERCEL_TEAM_SLUG`
4. **Configure Attributes**
   - Map `google.subject` to `assertion.sub`

### Step 3: Create Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
   - Name: `grimlog-vertex`
   - ID: `grimlog-vertex`
3. **Grant Role**: `Vertex AI User`
4. **Grant WIF Access** (IAM binding):

   ```
   principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/vercel/subject/owner:VERCEL_TEAM:project:VERCEL_PROJECT:environment:production
   ```

### Step 4: Local Development Auth

```bash
# Install gcloud CLI, then authenticate
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

This caches credentials locally - no JSON key files needed.

### Step 5: Configure Environment Variables

**Local development (`.env.local`):**

```bash
AI_PROVIDER=vertex
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-east1
```

**Vercel Production:**

```bash
AI_PROVIDER=vertex
GCP_PROJECT_ID=your-project-id
GCP_PROJECT_NUMBER=your-project-number
GCP_LOCATION=us-east1
GCP_SERVICE_ACCOUNT_EMAIL=grimlog-vertex@project.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_POOL_ID=vercel
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
```

---

## Code Changes

### Files Created

| File | Purpose |
|------|---------|
| `lib/vertexAI.ts` | Vertex AI client factory with WIF/ADC support |

### Files Modified

| File | Changes |
|------|---------|
| `lib/aiProvider.ts` | Added `'vertex'` to AIProvider type, added `isGeminiProvider()` helper |
| `app/api/analyze/route.ts` | Dynamic Gemini client via `getGeminiClient()` |
| `app/api/tactical-advisor/route.ts` | Dynamic Gemini client |
| `lib/intentOrchestrator.ts` | Added provider parameter, dynamic client |
| `lib/briefGenerator.ts` | Dynamic client with custom timeout |
| `lib/competitiveContextParser.ts` | Dynamic Gemini client |
| `lib/spiritIconGenerator.ts` | Dynamic Gemini client |
| `lib/armyListParser.ts` | Provider check updated, dynamic client |

### Migration Pattern

**Before (static client):**
```typescript
import { GoogleGenAI } from '@google/genai';
const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
// Used directly in API calls
```

**After (dynamic client):**
```typescript
import { getGeminiClient } from '@/lib/vertexAI';
import { getProvider, isGeminiProvider } from '@/lib/aiProvider';

// Inside your function
const provider = getProvider();
const geminiProvider = isGeminiProvider(provider) ? (provider as 'google' | 'vertex') : 'google';
const gemini = await getGeminiClient(geminiProvider);
// Use gemini.models.generateContent() as before
```

---

## Client Caching

The Vertex AI client is cached with automatic refresh:

```typescript
// lib/vertexAI.ts
const VERTEX_CLIENT_CACHE_TTL = 55 * 60 * 1000; // 55 minutes

// Clients are cached and reused until expiry
// WIF tokens are automatically refreshed before the 1-hour expiry
```

---

## Troubleshooting

### "Could not load the default credentials"

**Local:** Run `gcloud auth application-default login`

**Vercel:** Ensure all `GCP_*` environment variables are set correctly

### "Permission denied" on Vertex AI calls

1. Verify service account has `Vertex AI User` role
2. Verify WIF principal string matches your Vercel team/project
3. Check the environment (production vs preview) in the principal string

### "Invalid issuer" errors

Ensure the Vercel OIDC issuer URL matches your team slug exactly:
`https://oidc.vercel.com/your-team-slug`

### Model not available in region

Some Gemini models may not be available in all regions. Check [Vertex AI regional availability](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations).

---

## Observability

Vertex AI calls are traced via Langfuse with the same span/generation structure as before. The provider is included in generation metadata:

```typescript
generation.update({
  metadata: {
    provider: geminiProvider, // 'google' or 'vertex'
    // ...
  }
});
```

For GCP-native logging, see Cloud Logging in the GCP Console under your project.

---

## Rollback

To revert to Google AI Studio:

1. Change `AI_PROVIDER=google` in environment
2. Ensure `GOOGLE_API_KEY` is set
3. Deploy

No code changes needed - the client factory handles both providers.

---

## Related Documentation

- [Vercel OIDC + GCP Setup](https://vercel.com/docs/oidc/gcp) - Official Vercel docs
- [GCP Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Vertex AI Overview](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/overview)
- [Langfuse Observability](./LANGFUSE_OBSERVABILITY.md) - LLM tracing documentation
