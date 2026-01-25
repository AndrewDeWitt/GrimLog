/**
 * Request Cache & Deduplication Utility
 * 
 * Prevents duplicate API calls by:
 * 1. Deduplicating in-flight requests (same request returns same promise)
 * 2. Caching responses with configurable TTL
 * 3. Providing cache invalidation methods
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface RequestOptions {
  ttl?: number; // Time-to-live in milliseconds (default: 30 seconds)
  skipCache?: boolean; // Force fresh fetch
  cacheKey?: string; // Custom cache key override
}

// Cache storage
const cache = new Map<string, CacheEntry<any>>();

// In-flight requests storage (prevents duplicate concurrent requests)
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Generate cache key from URL, method, and body
 */
function generateCacheKey(url: string, init?: RequestInit, customKey?: string): string {
  if (customKey) return customKey;
  
  const method = init?.method || 'GET';
  const body = init?.body ? JSON.stringify(init.body) : '';
  
  return `${method}:${url}:${body}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.timestamp < entry.ttl;
}

/**
 * Cached fetch with deduplication
 * 
 * @param url - Request URL
 * @param init - Fetch init options
 * @param options - Cache options
 * @returns Promise with response data
 */
export async function cachedFetch<T = any>(
  url: string,
  init?: RequestInit,
  options: RequestOptions = {}
): Promise<T> {
  const {
    ttl = 30000, // 30 seconds default
    skipCache = false,
    cacheKey: customKey,
  } = options;

  const cacheKey = generateCacheKey(url, init, customKey);

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached.data;
    }
  }

  // Check if request is already in-flight
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    console.log(`[Dedup] Request already in-flight: ${cacheKey}`);
    return inFlight;
  }

  // Make new request
  console.log(`[Cache MISS] Fetching: ${cacheKey}`);
  const requestPromise = fetch(url, init)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Store in cache
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl,
      });
      
      return data;
    })
    .finally(() => {
      // Remove from in-flight requests
      inFlightRequests.delete(cacheKey);
    });

  // Store as in-flight
  inFlightRequests.set(cacheKey, requestPromise);

  return requestPromise;
}

/**
 * Invalidate cache entry
 */
export function invalidateCache(url: string, init?: RequestInit, customKey?: string): void {
  const cacheKey = generateCacheKey(url, init, customKey);
  cache.delete(cacheKey);
  console.log(`[Cache] Invalidated: ${cacheKey}`);
}

/**
 * Invalidate all cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string | RegExp): void {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  let count = 0;
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      count++;
    }
  }
  
  console.log(`[Cache] Invalidated ${count} entries matching pattern: ${pattern}`);
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
  console.log('[Cache] Cleared all entries');
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    size: cache.size,
    inFlight: inFlightRequests.size,
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl,
      valid: isCacheValid(entry),
    })),
  };
}

/**
 * Debounce utility for rate limiting requests
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

