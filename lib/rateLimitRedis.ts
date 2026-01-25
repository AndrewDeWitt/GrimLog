/**
 * Distributed Rate Limiting with Vercel KV
 * 
 * Uses Vercel KV (managed Redis) for rate limiting that works across all Vercel serverless instances.
 * Falls back to in-memory rate limiting if Vercel KV is not configured.
 * 
 * Setup:
 * 1. Go to your Vercel project dashboard
 * 2. Navigate to Storage → Create Database → KV
 * 3. Connect to your project - environment variables are auto-added
 * 
 * Required environment variables (auto-configured by Vercel):
 * - KV_REST_API_URL
 * - KV_REST_API_TOKEN
 */

import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

// Check if Vercel KV is configured
const isKVConfigured = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
);

/**
 * Rate limiter configurations for different endpoints
 * Using sliding window algorithm for smoother rate limiting
 * 
 * Note: @upstash/ratelimit works with @vercel/kv since Vercel KV 
 * uses Upstash under the hood with the same Redis API
 */
export const rateLimiters = isKVConfigured
  ? {
      // Voice analysis - 30 requests per minute
      analyze: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
        prefix: 'ratelimit:analyze',
      }),
      
      // Army parsing - 10 requests per minute
      parseArmy: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'ratelimit:parseArmy',
      }),
      
      // Dossier analysis - 5 requests per minute (most expensive)
      dossierAnalyze: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
        prefix: 'ratelimit:dossierAnalyze',
      }),
      
      // Tactical advisor - 20 requests per minute
      tacticalAdvisor: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
        prefix: 'ratelimit:tacticalAdvisor',
      }),
      
      // Icon generation - 5 requests per minute
      generateIcon: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
        prefix: 'ratelimit:generateIcon',
      }),
      
      // Spirit icon - 10 requests per minute
      spiritIcon: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'ratelimit:spiritIcon',
      }),
      
      // Transcription - 60 requests per minute
      transcribe: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        analytics: true,
        prefix: 'ratelimit:transcribe',
      }),

      // Global API rate limit - applies to ALL API routes as baseline protection
      // Individual endpoints can have stricter limits
      globalApi: new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        analytics: true,
        prefix: 'ratelimit:globalApi',
      }),
    }
  : null;

export type RateLimiterKey = keyof NonNullable<typeof rateLimiters>;

/**
 * Check rate limit using Upstash Redis
 * Returns a standardized result compatible with our in-memory rate limiter
 */
export async function checkRateLimitRedis(
  identifier: string,
  limiterKey: RateLimiterKey
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  if (!rateLimiters) {
    // Upstash not configured - signal to fall back to in-memory
    return { allowed: true, remaining: -1, resetTime: 0 };
  }
  
  const limiter = rateLimiters[limiterKey];
  if (!limiter) {
    console.warn(`Rate limiter not found for key: ${limiterKey}`);
    return { allowed: true, remaining: -1, resetTime: 0 };
  }
  
  try {
    const result = await limiter.limit(identifier);
    
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetTime: result.reset,
    };
  } catch (error) {
    console.error('Upstash rate limit check failed:', error);
    // On error, allow the request but log the issue
    return { allowed: true, remaining: -1, resetTime: 0 };
  }
}

/**
 * Check if Vercel KV is available
 */
export function isKVAvailable(): boolean {
  return isKVConfigured && rateLimiters !== null;
}

/**
 * Get rate limiter info for debugging
 */
export function getRateLimiterInfo(): { configured: boolean; provider: string; url?: string } {
  return {
    configured: isKVConfigured,
    provider: isKVConfigured ? 'vercel-kv' : 'in-memory',
    url: isKVConfigured ? process.env.KV_REST_API_URL?.replace(/^(https?:\/\/[^/]+).*/, '$1') : undefined,
  };
}

