/**
 * Rate Limiting Utility
 * 
 * Hybrid rate limiter supporting:
 * 1. Upstash Redis (distributed, production-ready) - when configured
 * 2. In-memory fallback (development/single instance)
 * 
 * For production on Vercel, configure Upstash Redis for proper distributed limiting.
 * See lib/rateLimitRedis.ts for Redis implementation.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (per Vercel serverless instance)
// For production at scale, use Redis or Vercel's built-in rate limiting
const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

/**
 * Check if request should be rate limited
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param config - Rate limit configuration
 * @returns Object with `allowed` boolean and `remaining` requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  
  // Get or create entry
  let entry = store[key];
  
  if (!entry || entry.resetTime < now) {
    // Create new window
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    store[key] = entry;
  }
  
  // Increment count
  entry.count++;
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // AI analysis endpoint - expensive, limit heavily
  analyze: {
    maxRequests: 30, // 30 requests
    windowMs: 60 * 1000, // per minute
  },
  
  // Transcription endpoint - moderate cost
  transcribe: {
    maxRequests: 60, // 60 requests
    windowMs: 60 * 1000, // per minute
  },
  
  // Army parsing - expensive AI call
  parseArmy: {
    maxRequests: 10, // 10 requests
    windowMs: 60 * 1000, // per minute
  },
  
  // Tactical advisor - expensive AI call
  tacticalAdvisor: {
    maxRequests: 20, // 20 requests
    windowMs: 60 * 1000, // per minute
  },
  
  // Icon generation - expensive (Google Search API + image processing)
  generateIcon: {
    maxRequests: 5, // 5 requests
    windowMs: 60 * 1000, // per minute
  },
  
  // Dossier analysis - VERY expensive (multiple Gemini calls + icon generation)
  dossierAnalyze: {
    maxRequests: 5, // 5 requests
    windowMs: 60 * 1000, // per minute
  },
  
  // Spirit icon generation - expensive Gemini image call
  spiritIcon: {
    maxRequests: 10, // 10 requests
    windowMs: 60 * 1000, // per minute
  },

  // Public gallery endpoints - read-only, moderate limits
  publicGallery: {
    maxRequests: 60, // 60 requests
    windowMs: 60 * 1000, // per minute
  },

  // Global API rate limit - baseline protection for all endpoints
  globalApi: {
    maxRequests: 120, // 120 requests
    windowMs: 60 * 1000, // per minute
  },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/**
 * Get identifier for rate limiting
 * Prefers user ID (if authenticated), falls back to IP address
 */
export function getRateLimitIdentifier(
  userId: string | null,
  ipAddress: string | null
): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address
  if (ipAddress) {
    return `ip:${ipAddress}`;
  }
  
  // Last resort: use a default identifier
  return 'anonymous';
}

/**
 * Extract IP address from Next.js request
 */
export function getClientIp(request: Request): string | null {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return null;
}


