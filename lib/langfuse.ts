// Langfuse client configuration for tracing AI calls
import { Langfuse } from "langfuse";

// Increase max listeners to prevent warning in development with hot-reloading
// Langfuse registers beforeExit listeners for flushing traces
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(20);
}

// Use global singleton pattern to survive Next.js hot-reloading in development
const globalForLangfuse = globalThis as unknown as {
  langfuse: Langfuse | undefined;
};

export const langfuse = globalForLangfuse.langfuse ?? new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

if (process.env.NODE_ENV !== 'production') {
  globalForLangfuse.langfuse = langfuse;
}

// Helper to ensure all traces are flushed before process exits
export async function flushLangfuse() {
  await langfuse.flushAsync();
}

// ========== Cache Token Tracking ==========

/**
 * Cache token statistics extracted from AI SDK responses.
 * Supports both AI SDK 6 standardized fields and provider-specific fields.
 */
export interface CacheTokenStats {
  /** Total cached tokens (from either SDK or provider) */
  cachedTokens: number;
  /** AI SDK 6 standardized: tokens read from cache */
  cacheReadTokens: number;
  /** AI SDK 6 standardized: tokens written to cache */
  cacheWriteTokens: number;
  /** AI SDK 6 standardized: tokens not from cache */
  noCacheTokens: number;
  /** Cache hit rate as percentage (0-100) */
  cacheHitRate: number;
}

/**
 * Extract cache token statistics from AI SDK responses.
 * 
 * Checks multiple locations for cache data:
 * 1. AI SDK 6 standardized: usage.inputTokenDetails.cacheReadTokens
 * 2. Provider-specific (Gemini): providerMetadata.google.usageMetadata.cachedContentTokenCount
 * 3. Raw Gemini SDK: usageMetadata.cachedContentTokenCount
 * 
 * @param usage - The usage object from AI SDK response (streamResult.usage or result.usage)
 * @param providerMetadata - Optional provider metadata from AI SDK response
 * @returns CacheTokenStats with all cache-related metrics
 */
export function extractCacheTokenStats(
  usage: any,
  providerMetadata?: any
): CacheTokenStats {
  // AI SDK 6 standardized fields (preferred)
  const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens || 0;
  const cacheWriteTokens = usage?.inputTokenDetails?.cacheWriteTokens || 0;
  const noCacheTokens = usage?.inputTokenDetails?.noCacheTokens || 0;
  
  // Provider-specific fallback (Gemini via AI SDK)
  const providerCached = providerMetadata?.google?.usageMetadata?.cachedContentTokenCount || 0;
  
  // Raw Gemini SDK fallback (for direct SDK calls)
  const rawGeminiCached = usage?.cachedContentTokenCount || 0;
  
  // Use whichever source has data (prioritize SDK standardized > provider > raw)
  const cachedTokens = cacheReadTokens || providerCached || rawGeminiCached;
  const inputTokens = usage?.inputTokens || usage?.promptTokenCount || 0;
  
  // Calculate cache hit rate
  const cacheHitRate = inputTokens > 0 
    ? Math.round((cachedTokens / inputTokens) * 100) 
    : 0;

  return { 
    cachedTokens, 
    cacheReadTokens, 
    cacheWriteTokens, 
    noCacheTokens, 
    cacheHitRate 
  };
}

/**
 * Format cache stats for console logging
 */
export function formatCacheStats(stats: CacheTokenStats, inputTokens: number): string {
  if (stats.cachedTokens > 0) {
    return `💾 Cache hit: ${stats.cachedTokens}/${inputTokens} tokens cached (${stats.cacheHitRate}% hit rate)`;
  }
  return `💾 Cache miss: 0/${inputTokens} tokens cached (tracking for future hits)`;
}

