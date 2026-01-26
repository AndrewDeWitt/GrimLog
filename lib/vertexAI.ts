/**
 * Vertex AI Client Factory
 *
 * Creates GoogleGenAI clients configured for Vertex AI with authentication using:
 * - Production (Vercel): Workload Identity Federation (WIF) via OIDC tokens
 * - Local Development: Application Default Credentials (ADC) via gcloud CLI
 *
 * This is the most secure approach - no API keys or service account JSON files needed.
 *
 * The key insight is that @google/genai SDK supports Vertex AI natively with
 * `vertexai: true`, so we keep all existing tool definitions and code patterns.
 */

import { GoogleGenAI } from '@google/genai';
import { GoogleAuth, ExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/functions/oidc';

// Cache the vertex client to avoid repeated auth setup
let cachedVertexClient: GoogleGenAI | null = null;
let cachedCredentialsExpiry: number | null = null;

// Environment configuration
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_LOCATION = process.env.GCP_LOCATION || 'us-east1';
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER;
const GCP_SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const GCP_WORKLOAD_IDENTITY_POOL_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || 'vercel';
const GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || 'vercel';

/**
 * Check if running in Vercel production/preview environment
 */
function isVercelEnvironment(): boolean {
  return !!process.env.VERCEL_ENV;
}

/**
 * Check if Vertex AI is configured (vs using Google AI Studio fallback)
 */
export function isVertexAIConfigured(): boolean {
  return !!GCP_PROJECT_ID;
}

/**
 * Get an access token using Workload Identity Federation (for Vercel)
 *
 * This exchanges a Vercel OIDC token for a GCP access token using WIF.
 * No secrets are stored - authentication happens via short-lived tokens.
 */
async function getAccessTokenWithWIF(): Promise<string> {
  if (!GCP_PROJECT_ID || !GCP_PROJECT_NUMBER || !GCP_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('Missing required GCP environment variables for WIF: GCP_PROJECT_ID, GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL');
  }

  console.log('🔐 Authenticating with Vertex AI via Workload Identity Federation...');

  // Get OIDC token from Vercel
  const vercelToken = await getVercelOidcToken();
  if (!vercelToken) {
    throw new Error('Failed to get Vercel OIDC token');
  }

  // Build the WIF credentials configuration
  // This tells google-auth-library how to exchange the OIDC token
  const credentialConfig = {
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    credential_source: {
      // Use the Vercel OIDC token directly
      file: '', // Will be overridden by subject_token_supplier
    },
  };

  // Create the external account client with our OIDC token
  const authClient = ExternalAccountClient.fromJSON(credentialConfig);
  if (!authClient) {
    throw new Error('Failed to create external account client');
  }

  // Override the subject token supplier to provide our OIDC token
  // @ts-expect-error - Private property access for token injection
  authClient.subjectTokenSupplier = {
    getSubjectToken: async () => vercelToken,
  };

  // Get access token for Vertex AI
  const tokenResponse = await authClient.getAccessToken();
  const accessToken = tokenResponse.token;

  if (!accessToken) {
    throw new Error('Failed to get GCP access token via WIF');
  }

  console.log('✅ WIF authentication successful');
  return accessToken;
}

/**
 * Get an access token using Application Default Credentials (for local dev)
 *
 * This uses credentials cached by `gcloud auth application-default login`.
 * No JSON key files needed.
 */
async function getAccessTokenWithADC(): Promise<string> {
  console.log('🔐 Authenticating with Vertex AI via Application Default Credentials...');

  // Verify ADC is available
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
      throw new Error('No access token from ADC. Run: gcloud auth application-default login');
    }

    console.log('✅ ADC authentication successful');
    return tokenResponse.token;
  } catch (error) {
    console.error('❌ ADC authentication failed. Run: gcloud auth application-default login');
    throw error;
  }
}

/**
 * Create a Vertex AI client using Workload Identity Federation (for Vercel)
 */
async function createVertexClientWithWIF(): Promise<GoogleGenAI> {
  const accessToken = await getAccessTokenWithWIF();

  // Cache expiry - tokens are typically valid for 1 hour
  cachedCredentialsExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

  // Create GoogleGenAI client in Vertex AI mode with the access token
  return new GoogleGenAI({
    vertexai: true,
    project: GCP_PROJECT_ID!,
    location: GCP_LOCATION,
    httpOptions: {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Create a Vertex AI client using Application Default Credentials (for local dev)
 */
async function createVertexClientWithADC(): Promise<GoogleGenAI> {
  if (!GCP_PROJECT_ID) {
    throw new Error('Missing GCP_PROJECT_ID environment variable');
  }

  const accessToken = await getAccessTokenWithADC();

  // Cache expiry - ADC tokens are typically valid for 1 hour
  cachedCredentialsExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

  // Create GoogleGenAI client in Vertex AI mode with the access token
  return new GoogleGenAI({
    vertexai: true,
    project: GCP_PROJECT_ID,
    location: GCP_LOCATION,
    httpOptions: {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Get a Vertex AI client with appropriate authentication
 *
 * - In Vercel: Uses WIF (zero secrets, short-lived tokens)
 * - Locally: Uses ADC (gcloud CLI cached credentials)
 *
 * The client is cached for performance, with automatic refresh before expiry.
 *
 * IMPORTANT: This returns a GoogleGenAI client configured for Vertex AI,
 * so all existing code patterns and tool definitions work unchanged.
 */
export async function getVertexClient(): Promise<GoogleGenAI> {
  // Check if we have a valid cached client
  if (cachedVertexClient && cachedCredentialsExpiry && Date.now() < cachedCredentialsExpiry) {
    return cachedVertexClient;
  }

  // Create new client based on environment
  if (isVercelEnvironment()) {
    cachedVertexClient = await createVertexClientWithWIF();
  } else {
    cachedVertexClient = await createVertexClientWithADC();
  }

  return cachedVertexClient;
}

/**
 * Clear the cached Vertex client (useful for testing or forced refresh)
 */
export function clearVertexClientCache(): void {
  cachedVertexClient = null;
  cachedCredentialsExpiry = null;
}

/**
 * Get the configured GCP project ID
 */
export function getGCPProjectId(): string | undefined {
  return GCP_PROJECT_ID;
}

/**
 * Get the configured GCP location/region
 */
export function getGCPLocation(): string {
  return GCP_LOCATION;
}

// Cached Google AI Studio client (for non-Vertex usage)
let cachedGoogleAIClient: GoogleGenAI | null = null;

/**
 * Get a Google AI Studio client (using API key)
 * This is used when AI_PROVIDER=google (not vertex)
 */
function getGoogleAIClient(): GoogleGenAI {
  if (!cachedGoogleAIClient) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY environment variable is required');
    }
    cachedGoogleAIClient = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  return cachedGoogleAIClient;
}

/**
 * Get the appropriate Gemini client based on the provider setting
 *
 * @param provider - The AI provider ('google' for AI Studio, 'vertex' for Vertex AI)
 * @returns A GoogleGenAI client configured for the appropriate backend
 *
 * Usage:
 * ```typescript
 * import { getGeminiClient } from '@/lib/vertexAI';
 * import { getAnalyzeProvider } from '@/lib/aiProvider';
 *
 * const provider = getAnalyzeProvider();
 * if (provider === 'google' || provider === 'vertex') {
 *   const gemini = await getGeminiClient(provider);
 *   const response = await gemini.models.generateContent({...});
 * }
 * ```
 */
export async function getGeminiClient(provider: 'google' | 'vertex'): Promise<GoogleGenAI> {
  if (provider === 'vertex') {
    return getVertexClient();
  }
  return getGoogleAIClient();
}

/**
 * Get a Gemini client with custom HTTP options (e.g., timeout)
 *
 * For Vertex AI, the httpOptions are merged with auth headers.
 * For Google AI Studio, httpOptions are applied directly.
 */
export async function getGeminiClientWithOptions(
  provider: 'google' | 'vertex',
  httpOptions?: { timeout?: number }
): Promise<GoogleGenAI> {
  if (provider === 'vertex') {
    // For Vertex, we need to get a fresh client with the options
    // This is because httpOptions might differ between calls
    if (!GCP_PROJECT_ID) {
      throw new Error('Missing GCP_PROJECT_ID environment variable');
    }

    let accessToken: string;
    if (isVercelEnvironment()) {
      accessToken = await getAccessTokenWithWIF();
    } else {
      accessToken = await getAccessTokenWithADC();
    }

    return new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT_ID,
      location: GCP_LOCATION,
      httpOptions: {
        ...httpOptions,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    });
  }

  // For Google AI Studio with custom options
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }
  return new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    httpOptions,
  });
}
