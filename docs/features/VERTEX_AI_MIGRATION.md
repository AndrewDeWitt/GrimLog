# Vertex AI Migration Guide

**Version:** 4.90.6
**Last Updated:** 2026-01-26
**Status:** Production Ready

---

## Overview

This guide documents the complete migration to Google Cloud Vertex AI with:

- **Production:** Workload Identity Federation (WIF) - zero secrets, short-lived OIDC tokens
- **Local Development:** Service Account Impersonation - mirrors production auth flow
- **SDK:** `@ai-sdk/google-vertex` (Vercel AI SDK) - native WIF support

### Why Vertex AI?

| Aspect | Google AI Studio | Vertex AI + WIF |
|--------|------------------|-----------------|
| **Authentication** | API key (static secret) | WIF (short-lived OIDC tokens) |
| **Security** | Key could leak | Zero secrets in code |
| **SLA** | None | Enterprise SLA available |
| **Compliance** | Limited | HIPAA, SOC2, more |
| **Quotas** | Fixed | Flexible, can request increases |
| **Pricing** | Same | Same (no free tier) |
| **Model Access** | Limited preview models | Full Gemini 3 access (global endpoint) |

---

## Architecture

### Authentication Flow

**Production (Vercel):**
```
[Vercel Function]
    → @vercel/functions/oidc generates OIDC token
    → ExternalAccountClient exchanges for GCP token
    → @ai-sdk/google-vertex makes Vertex AI calls
```

**Local Development:**
```
[Local Dev Server]
    → gcloud ADC with service account impersonation
    → @ai-sdk/google-vertex uses ADC automatically
    → Same Vertex AI endpoints as production
```

### Provider Selection

The system supports three AI providers via the `AI_PROVIDER` environment variable:

- `openai` - OpenAI GPT models
- `google` - Google AI Studio (API key auth)
- `vertex` - Google Cloud Vertex AI (WIF/impersonation auth)

```typescript
// lib/aiProvider.ts
export type AIProvider = 'openai' | 'google' | 'vertex';

export function isGeminiProvider(provider: AIProvider): boolean {
  return provider === 'google' || provider === 'vertex';
}
```

### SDK Architecture

Uses the Vercel AI SDK (`ai` package) with `@ai-sdk/google-vertex` provider:

```typescript
import { generateObject, streamObject, generateText } from 'ai';
import { getGeminiProvider } from '@/lib/vertexAI';

const gemini = getGeminiProvider('vertex');
const result = await generateObject({
  model: gemini('gemini-3-flash-preview'),
  schema: jsonSchema(MY_SCHEMA),
  prompt: 'Your prompt here',
});
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

### Step 4: Local Development Auth (Service Account Impersonation)

Service account impersonation mirrors production auth flow locally - your requests use the same service account identity as production.

**One-time setup:**

```bash
# 1. Login to gcloud
gcloud auth login

# 2. Grant yourself permission to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding grimlog-vertex@grimlog.iam.gserviceaccount.com \
  --member=user:YOUR_EMAIL@gmail.com \
  --role=roles/iam.serviceAccountTokenCreator \
  --project=grimlog

# 3. Login with impersonation
gcloud auth application-default login --impersonate-service-account=grimlog-vertex@grimlog.iam.gserviceaccount.com
```

This creates ADC credentials that impersonate the service account. No JSON key files needed.

**Logs you'll see locally:**
```
🔐 Using ADC with impersonation for local Vertex AI
   Project: grimlog, Location: global
```

### Step 5: Configure Environment Variables

**Local development (`.env.local`):**

```bash
AI_PROVIDER=vertex
GCP_PROJECT_ID=grimlog
# GCP_LOCATION defaults to 'global' for Gemini 3 models
```

**Vercel Production:**

```bash
AI_PROVIDER=vertex
GCP_PROJECT_ID=grimlog
GCP_PROJECT_NUMBER=778852092759
GCP_LOCATION=global
GCP_SERVICE_ACCOUNT_EMAIL=grimlog-vertex@grimlog.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_POOL_ID=vercel
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
```

**Note:** `GCP_LOCATION=global` is required for Gemini 3 preview models (`gemini-3-flash-preview`, `gemini-3-pro-image-preview`). See [Vertex AI regional availability](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations).

---

## Code Changes

### Files Created/Updated

| File | Purpose |
|------|---------|
| `lib/vertexAI.ts` | Vertex AI provider factory with WIF (production) and ADC impersonation (local) |

### Files Modified

| File | Changes |
|------|---------|
| `lib/aiProvider.ts` | Added `'vertex'` to AIProvider type, `isGeminiProvider()` helper, model name getters |
| `lib/armyListParser.ts` | AI SDK `generateObject`, JSON sanitization for control characters |
| `lib/briefGenerator.ts` | AI SDK `streamObject`, partial object fallback, JSON sanitization |
| `lib/intentOrchestrator.ts` | AI SDK `generateObject`, JSON sanitization |
| `app/api/tactical-advisor/route.ts` | AI SDK `generateObject`, JSON sanitization |
| `app/api/analyze/route.ts` | AI SDK `generateText` with tool calling |
| `lib/spiritIconGenerator.ts` | `@google/genai` for image generation (AI SDK doesn't support images) |

### Migration Pattern

**Before (`@google/genai` SDK):**
```typescript
import { GoogleGenAI } from '@google/genai';
const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const result = await gemini.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
});
```

**After (Vercel AI SDK + `@ai-sdk/google-vertex`):**
```typescript
import { generateObject, jsonSchema } from 'ai';
import { getGeminiProvider } from '@/lib/vertexAI';

const gemini = getGeminiProvider('vertex');
const { object } = await generateObject({
  model: gemini('gemini-3-flash-preview'),
  schema: jsonSchema(MY_SCHEMA),
  system: systemPrompt,
  prompt: userPrompt,
});
```

---

## JSON Sanitization

Gemini models occasionally include control characters (e.g., `\x13`) in responses that break JSON parsing. All structured output calls include sanitization:

```typescript
function sanitizeJsonString(text: string): string {
  return text
    .replace(/[\x13\x14\x15\x16\x17]/g, '–')  // Device control → em-dash
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')  // Other control chars → space
    .replace(/  +/g, ' ');  // Clean up multiple spaces
}
```

**Error handling pattern:**
```typescript
try {
  const { object } = await generateObject({ ... });
  return object;
} catch (error: any) {
  if (error.name === 'AI_NoObjectGeneratedError' && error.text) {
    const sanitized = sanitizeJsonString(error.text);
    return JSON.parse(sanitized);
  }
  throw error;
}
```

---

## Streaming Error Handling

For long-running generations (briefs), we use `streamObject` with partial object fallback:

```typescript
const streamResult = streamObject({ model, schema, prompt });

let lastPartialObject: any = null;
for await (const partial of streamResult.partialObjectStream) {
  lastPartialObject = partial;
}

try {
  return await streamResult.object;
} catch (error) {
  // If final parse fails, use last partial if it has required fields
  if (lastPartialObject?.executiveSummary && lastPartialObject?.armyArchetype) {
    return lastPartialObject;
  }
  throw error;
}
```

---

## Client Caching

The Vertex AI provider is cached for the lifetime of the serverless function:

```typescript
// lib/vertexAI.ts
let cachedVertexProvider: GoogleVertexProvider | null = null;

export function getVertexProvider(): GoogleVertexProvider {
  if (cachedVertexProvider) return cachedVertexProvider;
  // Create and cache provider...
}
```

WIF tokens are automatically refreshed by `ExternalAccountClient` before expiry.

---

## Troubleshooting

### "Could not load the default credentials"

**Local:** Run `gcloud auth application-default login --impersonate-service-account=SA@project.iam.gserviceaccount.com`

**Vercel:** Ensure all `GCP_*` environment variables are set correctly

### "Permission denied: unable to impersonate"

You need the Token Creator role on the service account:

```bash
gcloud iam service-accounts add-iam-policy-binding grimlog-vertex@grimlog.iam.gserviceaccount.com \
  --member=user:YOUR_EMAIL@gmail.com \
  --role=roles/iam.serviceAccountTokenCreator \
  --project=grimlog
```

### "Permission denied" on Vertex AI calls (production)

1. Verify service account has `Vertex AI User` role
2. Verify WIF principal string matches your Vercel team/project
3. Check the environment (production vs preview) in the principal string

### "Invalid issuer" errors

Ensure the Vercel OIDC issuer URL matches your team slug exactly:
`https://oidc.vercel.com/your-team-slug`

### "Model not found" errors

Gemini 3 preview models require the `global` endpoint:

```bash
# Wrong - regional endpoint
GCP_LOCATION=us-east1  # ❌ "gemini-3-flash-preview not found"

# Correct - global endpoint
GCP_LOCATION=global    # ✅ Works
```

See [Vertex AI regional availability](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations).

### "No object generated: could not parse the response"

This usually means control characters in the response. The code auto-sanitizes, but if it persists:
1. Check Langfuse traces for the raw response
2. The `sanitizeJsonString` function handles most cases
3. For streaming, the partial object fallback should recover the data

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
