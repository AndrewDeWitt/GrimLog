/**
 * useUnitAbilities Hook
 * 
 * Provides cached unit abilities data with phase filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import { cachedFetch, invalidateCache } from '@/lib/requestCache';

export interface UnitAbility {
  name: string;
  type: string;
  description: string;
  triggerPhase: string[];
  triggerSubphase: string | null;
  isReactive: boolean;
  requiredKeywords: string[];
  source: string;
}

export interface UnitWithAbilities {
  unitId: string;
  unitName: string;
  datasheet: string;
  abilities: UnitAbility[];
}

export interface OwnerAbilitiesData {
  armyAbilities: UnitAbility[];
  units: UnitWithAbilities[];
}

export interface UnitAbilitiesResponse {
  sessionId: string;
  currentPhase?: string;
  attacker: OwnerAbilitiesData;
  defender: OwnerAbilitiesData;
}

interface UseUnitAbilitiesResult {
  attacker: OwnerAbilitiesData;
  defender: OwnerAbilitiesData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

const DEFAULT_TTL = 300000; // 5 minutes for abilities (change rarely)

export function useUnitAbilities(
  sessionId: string | null,
  phase?: string | null,
  options: { ttl?: number; autoFetch?: boolean } = {}
): UseUnitAbilitiesResult {
  const { ttl = DEFAULT_TTL, autoFetch = true } = options;
  
  const [attacker, setAttacker] = useState<OwnerAbilitiesData>({ armyAbilities: [], units: [] });
  const [defender, setDefender] = useState<OwnerAbilitiesData>({ armyAbilities: [], units: [] });
  const [loading, setLoading] = useState(autoFetch && !!sessionId);
  const [error, setError] = useState<string | null>(null);

  const fetchAbilities = useCallback(async (skipCache = false) => {
    if (!sessionId) {
      setAttacker({ armyAbilities: [], units: [] });
      setDefender({ armyAbilities: [], units: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build URL with optional phase filter
      const url = phase
        ? `/api/sessions/${sessionId}/units/abilities?phase=${encodeURIComponent(phase)}`
        : `/api/sessions/${sessionId}/units/abilities`;

      const data = await cachedFetch<UnitAbilitiesResponse>(
        url,
        { method: 'GET' },
        { ttl, skipCache }
      );
      
      setAttacker(data.attacker || { armyAbilities: [], units: [] });
      setDefender(data.defender || { armyAbilities: [], units: [] });
    } catch (err) {
      console.error('Failed to fetch unit abilities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch unit abilities');
      setAttacker({ armyAbilities: [], units: [] });
      setDefender({ armyAbilities: [], units: [] });
    } finally {
      setLoading(false);
    }
  }, [sessionId, phase, ttl]);

  const invalidate = useCallback(() => {
    if (sessionId) {
      // Invalidate all abilities endpoints for this session
      invalidateCache(`/api/sessions/${sessionId}/units/abilities`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (autoFetch && sessionId) {
      fetchAbilities();
    }
  }, [sessionId, phase, autoFetch, fetchAbilities]);

  return {
    attacker,
    defender,
    loading,
    error,
    refetch: () => fetchAbilities(true),
    invalidate,
  };
}

