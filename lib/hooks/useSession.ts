/**
 * useSession Hook
 * 
 * Provides cached session data with automatic refetching and invalidation.
 * Prevents duplicate fetches for the same session across components.
 */

import { useState, useEffect, useCallback } from 'react';
import { cachedFetch, invalidateCache, invalidateCachePattern } from '@/lib/requestCache';

export interface SessionData {
  id: string;
  startTime: string;
  endTime: string | null;
  currentPhase: string;
  currentTurn: string;
  battleRound: number;
  deploymentType: string;
  firstTurn: string;
  isActive: boolean;
  attackerCommandPoints: number;
  defenderCommandPoints: number;
  attackerVictoryPoints: number;
  defenderVictoryPoints: number;
  attackerSecondaries: string | null;
  defenderSecondaries: string | null;
  attackerSecondaryProgress?: string | null;
  defenderSecondaryProgress?: string | null;
  attackerDiscardedSecondaries?: string | null;
  defenderDiscardedSecondaries?: string | null;
  attackerExtraCPGainedThisTurn?: boolean;
  defenderExtraCPGainedThisTurn?: boolean;
  defenderName: string | null;
  defenderFaction: string | null;
  objectiveMarkers?: any[];
  attackerArmy?: {
    name: string;
    player: {
      name: string;
      faction: string;
    };
  } | null;
  timelineEvents?: any[];
  transcripts?: any[];
}

interface UseSessionResult {
  session: SessionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

const DEFAULT_TTL = 30000; // 30 seconds

export function useSession(sessionId: string | null, options: { ttl?: number; autoFetch?: boolean } = {}): UseSessionResult {
  const { ttl = DEFAULT_TTL, autoFetch = true } = options;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(autoFetch && !!sessionId);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async (skipCache = false) => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await cachedFetch<SessionData>(
        `/api/sessions/${sessionId}`,
        { method: 'GET' },
        { ttl, skipCache }
      );
      setSession(data);
    } catch (err) {
      console.error('Failed to fetch session:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch session');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId, ttl]);

  const invalidate = useCallback(() => {
    if (sessionId) {
      invalidateCache(`/api/sessions/${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (autoFetch && sessionId) {
      fetchSession();
    }
  }, [sessionId, autoFetch, fetchSession]);

  return {
    session,
    loading,
    error,
    refetch: () => fetchSession(true),
    invalidate,
  };
}

/**
 * Fetch session events with caching
 */
export async function fetchSessionEvents(sessionId: string, options?: { skipCache?: boolean; ttl?: number }) {
  const ttl = options?.ttl || DEFAULT_TTL;
  const skipCache = options?.skipCache || false;
  
  return cachedFetch(
    `/api/sessions/${sessionId}/events`,
    { method: 'GET' },
    { ttl, skipCache }
  );
}

/**
 * Invalidate all session-related caches
 */
export function invalidateSessionCache(sessionId: string) {
  invalidateCachePattern(`/api/sessions/${sessionId}`);
}

