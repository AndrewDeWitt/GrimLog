/**
 * useUnitIcon Hook
 * 
 * Provides user-specific icon resolution with caching.
 * Falls back to null if no custom icon exists.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

// Simple in-memory cache for icon URLs
const iconCache = new Map<string, { url: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: string | undefined, faction: string, unitName: string): string {
  return `${userId || 'anon'}:${faction}:${unitName}`;
}

function getFromCache(key: string): string | null | undefined {
  const cached = iconCache.get(key);
  if (!cached) return undefined;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    iconCache.delete(key);
    return undefined;
  }
  
  return cached.url;
}

function setCache(key: string, url: string | null): void {
  iconCache.set(key, { url, timestamp: Date.now() });
}

interface UseUnitIconResult {
  iconUrl: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to resolve a single unit's icon
 */
export function useUnitIcon(
  unitName: string,
  faction: string,
  options: { autoFetch?: boolean } = {}
): UseUnitIconResult {
  const { autoFetch = true } = options;
  const { user } = useAuth();
  
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchIcon = useCallback(async () => {
    const cacheKey = getCacheKey(user?.id, faction, unitName);
    const cached = getFromCache(cacheKey);
    
    if (cached !== undefined) {
      setIconUrl(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ unitName, faction });
      const response = await fetch(`/api/icons/resolve?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to resolve icon');
      }
      
      const data = await response.json();
      setIconUrl(data.iconUrl);
      setCache(cacheKey, data.iconUrl);
    } catch (err) {
      console.error('Failed to fetch icon:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch icon');
      setIconUrl(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, unitName, faction]);

  useEffect(() => {
    if (autoFetch) {
      fetchIcon();
    }
  }, [autoFetch, fetchIcon]);

  return {
    iconUrl,
    loading,
    error,
    refetch: fetchIcon,
  };
}

/**
 * Hook to batch resolve multiple units' icons
 * More efficient for lists of units
 */
export function useUnitIcons(
  units: Array<{ unitName: string; faction: string }>,
  options: { autoFetch?: boolean } = {}
): {
  icons: Record<string, string | null>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { autoFetch = true } = options;
  const { user } = useAuth();
  
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(autoFetch && units.length > 0);
  const [error, setError] = useState<string | null>(null);

  const fetchIcons = useCallback(async () => {
    if (units.length === 0) {
      setIcons({});
      setLoading(false);
      return;
    }

    // Check cache first
    const uncachedUnits: Array<{ unitName: string; faction: string }> = [];
    const cachedIcons: Record<string, string | null> = {};

    units.forEach(unit => {
      const cacheKey = getCacheKey(user?.id, unit.faction, unit.unitName);
      const cached = getFromCache(cacheKey);
      
      if (cached !== undefined) {
        const key = `${unit.faction}:${unit.unitName}`;
        cachedIcons[key] = cached;
      } else {
        uncachedUnits.push(unit);
      }
    });

    // If everything was cached, we're done
    if (uncachedUnits.length === 0) {
      setIcons(cachedIcons);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/icons/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units: uncachedUnits }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resolve icons');
      }
      
      const data = await response.json();
      
      // Cache the results
      uncachedUnits.forEach(unit => {
        const key = `${unit.faction}:${unit.unitName}`;
        const cacheKey = getCacheKey(user?.id, unit.faction, unit.unitName);
        setCache(cacheKey, data.icons[key] || null);
      });

      // Merge cached and fetched icons
      setIcons({ ...cachedIcons, ...data.icons });
    } catch (err) {
      console.error('Failed to fetch icons:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch icons');
      setIcons(cachedIcons); // Use what we have from cache
    } finally {
      setLoading(false);
    }
  }, [user?.id, units]);

  useEffect(() => {
    if (autoFetch && units.length > 0) {
      fetchIcons();
    }
  }, [autoFetch, fetchIcons, units.length]);

  return {
    icons,
    loading,
    error,
    refetch: fetchIcons,
  };
}

/**
 * Utility to invalidate icon cache for a specific unit
 * Call this after generating/updating an icon
 */
export function invalidateIconCache(userId: string, faction: string, unitName: string): void {
  const key = getCacheKey(userId, faction, unitName);
  iconCache.delete(key);
}

/**
 * Utility to clear all icon cache
 */
export function clearIconCache(): void {
  iconCache.clear();
}
