/**
 * useArmies Hook
 * 
 * Provides cached armies list across all components.
 * Single source of truth for army data.
 */

import { useState, useEffect, useCallback } from 'react';
import { cachedFetch, invalidateCache } from '@/lib/requestCache';

export interface Army {
  id: string;
  name: string;
  player: {
    name: string;
    faction: string;
  };
  pointsLimit: number;
  _count?: {
    units: number;
  };
}

interface UseArmiesResult {
  armies: Army[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

const DEFAULT_TTL = 60000; // 60 seconds (armies don't change frequently)

export function useArmies(options: { detailed?: boolean; ttl?: number; autoFetch?: boolean } = {}): UseArmiesResult {
  const { detailed = false, ttl = DEFAULT_TTL, autoFetch = true } = options;
  
  const [armies, setArmies] = useState<Army[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchArmies = useCallback(async (skipCache = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = detailed ? '/api/armies?detailed=true' : '/api/armies';
      const data = await cachedFetch<Army[]>(
        url,
        { method: 'GET' },
        { ttl, skipCache }
      );
      setArmies(data);
    } catch (err) {
      console.error('Failed to fetch armies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch armies');
      setArmies([]);
    } finally {
      setLoading(false);
    }
  }, [detailed, ttl]);

  const invalidate = useCallback(() => {
    invalidateCache('/api/armies');
    invalidateCache('/api/armies?detailed=true');
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchArmies();
    }
  }, [autoFetch, fetchArmies]);

  return {
    armies,
    loading,
    error,
    refetch: () => fetchArmies(true),
    invalidate,
  };
}

