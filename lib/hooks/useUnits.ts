/**
 * useUnits Hook
 * 
 * Provides cached unit data with optimistic updates.
 * Persists across tab switches to prevent unnecessary refetches.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedFetch, invalidateCache } from '@/lib/requestCache';

export interface UnitInstance {
  id: string;
  unitName: string;
  owner: 'attacker' | 'defender';
  datasheet: string;
  faction?: string | null;
  startingModels: number;
  currentModels: number;
  startingWounds: number | null;
  currentWounds: number | null;
  woundsPerModel?: number | null;
  modelsArray?: string | null;
  attachedToUnit?: string | null;
  isDestroyed: boolean;
  isBattleShocked: boolean;
  activeEffects: string[];
  iconUrl?: string | null;
}

interface UseUnitsResult {
  units: UnitInstance[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateUnit: (unitId: string, updates: Partial<UnitInstance>) => Promise<void>;
  invalidate: () => void;
}

const DEFAULT_TTL = 60000; // 60 seconds for units (change less frequently)

export function useUnits(sessionId: string | null, options: { ttl?: number; autoFetch?: boolean } = {}): UseUnitsResult {
  const { ttl = DEFAULT_TTL, autoFetch = true } = options;
  
  const [units, setUnits] = useState<UnitInstance[]>([]);
  const [loading, setLoading] = useState(autoFetch && !!sessionId);
  const [error, setError] = useState<string | null>(null);
  
  // Track pending updates to prevent race conditions
  const pendingUpdates = useRef<Set<string>>(new Set());

  const fetchUnits = useCallback(async (skipCache = false) => {
    if (!sessionId) {
      setUnits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await cachedFetch<{ unitInstances: UnitInstance[] }>(
        `/api/sessions/${sessionId}/units`,
        { method: 'GET' },
        { ttl, skipCache }
      );
      setUnits(data.unitInstances || []);
    } catch (err) {
      console.error('Failed to fetch units:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch units');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, ttl]);

  const updateUnit = useCallback(async (unitId: string, updates: Partial<UnitInstance>) => {
    if (!sessionId) return;

    // Prevent duplicate updates for same unit
    if (pendingUpdates.current.has(unitId)) {
      console.log(`[useUnits] Update already pending for unit ${unitId}, skipping`);
      return;
    }

    pendingUpdates.current.add(unitId);

    // Optimistic update
    setUnits(prevUnits =>
      prevUnits.map(unit =>
        unit.id === unitId ? { ...unit, ...updates } : unit
      )
    );

    try {
      const response = await fetch(`/api/sessions/${sessionId}/units/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update unit');
      }

      const result = await response.json();

      // Update with server response
      if (result.unitInstance) {
        setUnits(prevUnits =>
          prevUnits.map(unit =>
            unit.id === unitId ? result.unitInstance : unit
          )
        );
      }

      // Invalidate cache after successful update
      invalidateCache(`/api/sessions/${sessionId}/units`);
    } catch (err) {
      console.error('Failed to update unit:', err);
      setError(err instanceof Error ? err.message : 'Failed to update unit');
      
      // Revert optimistic update by refetching (silently)
      await fetchUnits(true);
    } finally {
      pendingUpdates.current.delete(unitId);
    }
  }, [sessionId, fetchUnits]);

  const invalidate = useCallback(() => {
    if (sessionId) {
      invalidateCache(`/api/sessions/${sessionId}/units`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (autoFetch && sessionId) {
      fetchUnits();
    }
  }, [sessionId, autoFetch, fetchUnits]);

  return {
    units,
    loading,
    error,
    refetch: () => fetchUnits(true),
    updateUnit,
    invalidate,
  };
}

