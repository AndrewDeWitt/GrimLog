/**
 * Vertex AI Provider Factory
 *
 * Creates AI SDK providers configured for Vertex AI with authentication using:
 * - Production (Vercel): Workload Identity Federation (WIF) via OIDC tokens
 * - Local Development: Application Default Credentials (ADC) via gcloud CLI
 *
 * This is the most secure approach - no API keys or service account JSON files needed.
 *
 * Uses @ai-sdk/google-vertex which properly integrates with WIF through
 * ExternalAccountClient from google-auth-library.
 */

import { createVertex, type GoogleVertexProvider } from '@ai-sdk/google-vertex';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { ExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/functions/oidc';

// Environment configuration
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
// Use 'global' by default for Vertex AI - required for Gemini 3 models which are only
// available on the global endpoint. See: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
const GCP_LOCATION = process.env.GCP_LOCATION || 'global';
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER;
const GCP_SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const GCP_WORKLOAD_IDENTITY_POOL_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || 'vercel';
const GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || 'vercel';

// Cache the vertex provider to avoid repeated auth setup
let cachedVertexProvider: GoogleVertexProvider | null = null;
let cachedGoogleProvider: GoogleGenerativeAIProvider | null = null;

/**
 * Check if running in Vercel production/preview environment
 */
export function isVercelEnvironment(): boolean {
  return !!process.env.VERCEL_ENV;
}

/**
 * Check if Vertex AI is configured (vs using Google AI Studio fallback)
 */
export function isVertexAIConfigured(): boolean {
  return !!GCP_PROJECT_ID;
}

/**
 * Create a WIF auth client for Vercel using ExternalAccountClient
 * 
 * This uses the official Google approach for Workload Identity Federation,
 * where ExternalAccountClient handles the OIDC token exchange automatically.
 */
function createWIFAuthClient(): ExternalAccountClient {
  if (!GCP_PROJECT_NUMBER || !GCP_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('Missing required GCP environment variables for WIF: GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL');
  }

  console.log('🔐 Creating WIF auth client for Vertex AI...');

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    subject_token_supplier: {
      // Use the Vercel OIDC token as the subject token
      getSubjectToken: getVercelOidcToken,
    },
  });

  if (!authClient) {
    throw new Error('Failed to create ExternalAccountClient for WIF');
  }

  console.log('✅ WIF auth client created');
  return authClient;
}

// Local development uses ADC with service account impersonation
// Setup:
// 1. Grant yourself Token Creator: gcloud iam service-accounts add-iam-policy-binding SA@project.iam.gserviceaccount.com --member='user:YOU@gmail.com' --role='roles/iam.serviceAccountTokenCreator'
// 2. Login with impersonation: gcloud auth application-default login --impersonate-service-account=SA@project.iam.gserviceaccount.com

/**
 * Get a Vertex AI provider instance with appropriate authentication
 *
 * - In Vercel: Uses WIF (zero secrets, short-lived tokens)
 * - Locally: Uses ADC (gcloud CLI cached credentials)
 *
 * The provider is cached for performance.
 *
 * Usage:
 * ```typescript
 * import { getVertexProvider } from '@/lib/vertexAI';
 * import { generateText } from 'ai';
 *
 * const vertex = getVertexProvider();
 * const { text } = await generateText({
 *   model: vertex('gemini-2.5-flash'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export function getVertexProvider(): GoogleVertexProvider {
  if (cachedVertexProvider) {
    return cachedVertexProvider;
  }

  if (!GCP_PROJECT_ID) {
    throw new Error('Missing GCP_PROJECT_ID environment variable');
  }

  if (isVercelEnvironment()) {
    // Production: Use WIF auth
    console.log('🔐 Using WIF authentication for Vertex AI (Vercel)');
    const authClient = createWIFAuthClient();

    cachedVertexProvider = createVertex({
      project: GCP_PROJECT_ID,
      location: GCP_LOCATION,
      googleAuthOptions: {
        authClient: authClient as any,
        projectId: GCP_PROJECT_ID,
      },
    });
  } else {
    // Local development: Use ADC with service account impersonation
    // Requires: gcloud auth application-default login --impersonate-service-account=SA@project.iam.gserviceaccount.com
    console.log('🔐 Using ADC with impersonation for local Vertex AI');
    console.log(`   Project: ${GCP_PROJECT_ID}, Location: ${GCP_LOCATION}`);
    
    cachedVertexProvider = createVertex({
      project: GCP_PROJECT_ID,
      location: GCP_LOCATION,
      // Don't pass authClient - let SDK use ADC automatically
    });
  }

  return cachedVertexProvider;
}

/**
 * Get a Google AI Studio provider instance (using API key)
 * This is used when AI_PROVIDER=google (not vertex)
 */
export function getGoogleProvider(): GoogleGenerativeAIProvider {
  if (cachedGoogleProvider) {
    return cachedGoogleProvider;
  }

  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }

  cachedGoogleProvider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
  });

  return cachedGoogleProvider;
}

/**
 * Get the appropriate Gemini provider based on the provider setting
 *
 * @param provider - The AI provider ('google' for AI Studio, 'vertex' for Vertex AI)
 * @returns A provider function that can be used to create model instances
 *
 * Usage:
 * ```typescript
 * import { getGeminiProvider } from '@/lib/vertexAI';
 * import { getAnalyzeProvider } from '@/lib/aiProvider';
 * import { generateText } from 'ai';
 *
 * const provider = getAnalyzeProvider();
 * if (provider === 'google' || provider === 'vertex') {
 *   const gemini = getGeminiProvider(provider);
 *   const { text } = await generateText({
 *     model: gemini('gemini-2.5-flash'),
 *     prompt: 'Hello!',
 *   });
 * }
 * ```
 */
export function getGeminiProvider(provider: 'google' | 'vertex'): GoogleVertexProvider | GoogleGenerativeAIProvider {
  if (provider === 'vertex') {
    return getVertexProvider();
  }
  return getGoogleProvider();
}

/**
 * Clear the cached providers (useful for testing or forced refresh)
 */
export function clearVertexClientCache(): void {
  cachedVertexProvider = null;
  cachedGoogleProvider = null;
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

// Cache for Vertex AI image client
let cachedVertexImageClient: GoogleGenAI | null = null;

/**
 * Get a @google/genai client configured for Vertex AI image generation with WIF
 * 
 * This uses the same WIF auth pattern as the AI SDK provider, but for the
 * @google/genai SDK which supports image generation.
 * 
 * - In Vercel: Uses WIF (zero secrets, short-lived tokens)
 * - Locally: Uses ADC (gcloud CLI cached credentials)
 */
export function getVertexImageClient(): GoogleGenAI {
  if (cachedVertexImageClient) {
    return cachedVertexImageClient;
  }

  if (!GCP_PROJECT_ID) {
    throw new Error('GCP_PROJECT_ID is required for Vertex AI image generation');
  }

  // Use global endpoint - Gemini 3 Pro Image is available there
  // See: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
  const imageLocation = GCP_LOCATION;

  if (isVercelEnvironment()) {
    // Production: Use Vertex AI with WIF
    console.log('🔐 Creating WIF-authenticated Vertex AI image client...');
    const authClient = createWIFAuthClient();
    
    cachedVertexImageClient = new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT_ID,
      location: imageLocation,
      googleAuthOptions: {
        authClient: authClient as any,
      },
    });
  } else {
    // Local: Use Vertex AI with ADC (impersonation)
    console.log('🔐 Creating ADC-authenticated Vertex AI image client (impersonation)...');
    
    cachedVertexImageClient = new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT_ID,
      location: imageLocation,
      // Don't pass googleAuthOptions - let SDK use ADC automatically
    });
  }

  console.log(`✅ Vertex AI image client created (location: ${imageLocation})`);
  return cachedVertexImageClient;
}

// ============================================================================
// DEPRECATED: Legacy exports for backward compatibility during migration
// These will be removed after all consumers are updated to use AI SDK pattern
// ============================================================================

import { GoogleGenAI } from '@google/genai';

// Cached legacy clients
let cachedLegacyGoogleClient: GoogleGenAI | null = null;

/**
 * @deprecated Use getGeminiProvider() instead with the AI SDK pattern
 * 
 * Get a legacy GoogleGenAI client for Google AI Studio (API key auth)
 * This is kept for backward compatibility during migration.
 */
export function getLegacyGoogleClient(): GoogleGenAI {
  if (!cachedLegacyGoogleClient) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY environment variable is required');
    }
    cachedLegacyGoogleClient = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  return cachedLegacyGoogleClient;
}

/**
 * @deprecated Use getGeminiProvider() instead with the AI SDK pattern
 * 
 * Legacy function that returns a GoogleGenAI client.
 * For Vertex AI, this will throw an error - use the new AI SDK pattern instead.
 * For Google AI Studio, returns the API key-based client.
 */
export async function getGeminiClient(provider: 'google' | 'vertex'): Promise<GoogleGenAI> {
  if (provider === 'vertex') {
    throw new Error(
      'getGeminiClient() is deprecated for Vertex AI. ' +
      'Use getGeminiProvider() with the AI SDK pattern instead:\n\n' +
      'import { getGeminiProvider } from "@/lib/vertexAI";\n' +
      'import { generateText } from "ai";\n\n' +
      'const gemini = getGeminiProvider("vertex");\n' +
      'const { text } = await generateText({ model: gemini("gemini-2.5-flash"), ... });'
    );
  }
  return getLegacyGoogleClient();
}

/**
 * @deprecated Use getGeminiProvider() instead with the AI SDK pattern
 */
export async function getGeminiClientWithOptions(
  provider: 'google' | 'vertex',
  _httpOptions?: { timeout?: number }
): Promise<GoogleGenAI> {
  if (provider === 'vertex') {
    throw new Error(
      'getGeminiClientWithOptions() is deprecated for Vertex AI. ' +
      'Use getGeminiProvider() with the AI SDK pattern instead.'
    );
  }
  
  // For Google AI Studio, httpOptions aren't easily supported with the legacy client
  // Just return the standard client
  return getLegacyGoogleClient();
}

/**
 * @deprecated Use getVertexProvider() instead
 */
export async function getVertexClient(): Promise<GoogleGenAI> {
  throw new Error(
    'getVertexClient() is deprecated. ' +
    'Use getVertexProvider() with the AI SDK pattern instead:\n\n' +
    'import { getVertexProvider } from "@/lib/vertexAI";\n' +
    'import { generateText } from "ai";\n\n' +
    'const vertex = getVertexProvider();\n' +
    'const { text } = await generateText({ model: vertex("gemini-2.5-flash"), ... });'
  );
}
