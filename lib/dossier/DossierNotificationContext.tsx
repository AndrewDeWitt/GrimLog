'use client';

/**
 * DossierNotificationContext
 *
 * Provides global state for tracking pending dossier generations and notifications.
 * Polls the status endpoint to detect completions and triggers toast notifications.
 *
 * Notification state is persisted in the database via notificationDismissedAt field.
 *
 * Smart polling: Only polls when there are pending dossiers being generated.
 * Tracks locally dismissed IDs to prevent re-showing after polling.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

// Types for dossier status
export interface PendingDossier {
  id: string;
  status: 'pending' | 'processing';
  startedAt: string;
  faction: string | null;
}

export interface CompletedDossier {
  id: string;
  faction: string | null;
  completedAt: string | null;
}

export interface FailedDossier {
  id: string;
  faction: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface DossierNotificationContextType {
  pendingCount: number;
  pendingDossiers: PendingDossier[];
  recentlyCompleted: CompletedDossier[];
  recentlyFailed: FailedDossier[];
  clearCompletedNotification: (id: string) => Promise<void>;
  clearFailedNotification: (id: string) => Promise<void>;
  triggerRefresh: () => void;
}

const DossierNotificationContext = createContext<DossierNotificationContextType | undefined>(undefined);

// Polling intervals - balanced for responsiveness vs rate limit (120 req/min)
// Most dossier generations take ~2 minutes, so we start slow and speed up
const INITIAL_POLL_INTERVAL = 20000; // 20 seconds initially (we know it takes ~2 min)
const FAST_POLL_INTERVAL = 10000; // 10 seconds after expected completion time approaches
const SPEEDUP_THRESHOLD = 6; // After 6 polls (~2 min), speed up polling
// Note: No idle polling - only poll when there are pending dossiers

export function DossierNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendingDossiers, setPendingDossiers] = useState<PendingDossier[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<CompletedDossier[]>([]);
  const [recentlyFailed, setRecentlyFailed] = useState<FailedDossier[]>([]);

  // Track locally dismissed IDs to filter out from API responses
  // This prevents re-showing dismissed notifications before the next API response
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const hasPendingRef = useRef(false);
  const consecutivePollsRef = useRef(0); // Track polls without state change for backoff
  const lastPendingCountRef = useRef(0);
  const setupPollingRef = useRef<(() => void) | null>(null);

  // Fetch status from API
  const fetchStatus = useCallback(async () => {
    if (!user || !isMountedRef.current) return;

    try {
      const res = await fetch('/api/dossier/status');
      if (!res.ok || !isMountedRef.current) return;

      const data = await res.json();
      const pending = data.pending || [];
      setPendingDossiers(pending);
      hasPendingRef.current = pending.length > 0;

      // Track consecutive polls without change for backoff logic
      if (pending.length === lastPendingCountRef.current && pending.length > 0) {
        consecutivePollsRef.current++;
      } else {
        consecutivePollsRef.current = 0;
      }
      lastPendingCountRef.current = pending.length;

      // Filter out locally dismissed IDs from API response
      const apiCompleted: CompletedDossier[] = (data.recentlyCompleted || [])
        .filter((d: CompletedDossier) => !dismissedIdsRef.current.has(d.id));
      const apiFailed: FailedDossier[] = (data.recentlyFailed || [])
        .filter((d: FailedDossier) => !dismissedIdsRef.current.has(d.id));

      setRecentlyCompleted(apiCompleted);
      setRecentlyFailed(apiFailed);

    } catch (error) {
      console.error('Failed to fetch dossier status:', error);
    }
  }, [user]);

  // Smart polling: faster when pending, slower when idle
  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      // Clear state when user logs out
      setPendingDossiers([]);
      setRecentlyCompleted([]);
      setRecentlyFailed([]);
      dismissedIdsRef.current.clear();
      return;
    }

    // Set up smart polling with backoff - only polls when there are pending dossiers
    const setupPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Don't poll if no pending dossiers - saves unnecessary API calls
      if (!hasPendingRef.current) {
        return;
      }

      // Determine polling interval - start slow, speed up as completion approaches
      const getInterval = () => {
        // After ~2 min of polling, speed up since completion is likely soon
        if (consecutivePollsRef.current >= SPEEDUP_THRESHOLD) return FAST_POLL_INTERVAL;
        return INITIAL_POLL_INTERVAL;
      };

      const interval = getInterval();
      pollIntervalRef.current = setInterval(() => {
        fetchStatus();
        // Check if we need to adjust or stop polling
        if (!hasPendingRef.current) {
          // No more pending - stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else {
          const newInterval = getInterval();
          if (newInterval !== interval) {
            setupPolling(); // Re-setup with new interval
          }
        }
      }, interval);
    };

    // Store setupPolling in ref so triggerRefresh can access it
    setupPollingRef.current = setupPolling;

    // Initial fetch, then start polling if we have pending dossiers
    fetchStatus().then(() => {
      if (hasPendingRef.current) {
        setupPolling();
      }
    });

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, fetchStatus]);

  // Dismiss a completed notification (calls API to persist)
  const clearCompletedNotification = useCallback(async (id: string) => {
    // Add to locally dismissed set to prevent re-showing
    dismissedIdsRef.current.add(id);

    // Optimistically remove from local state
    setRecentlyCompleted(prev => prev.filter(d => d.id !== id));

    // Call API to persist the dismissal
    try {
      await fetch('/api/dossier/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: id }),
      });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      // Keep in dismissed set even on error - user intent was to dismiss
    }
  }, []);

  // Dismiss a failed notification (calls API to persist)
  const clearFailedNotification = useCallback(async (id: string) => {
    // Add to locally dismissed set to prevent re-showing
    dismissedIdsRef.current.add(id);

    // Optimistically remove from local state
    setRecentlyFailed(prev => prev.filter(d => d.id !== id));

    // Call API to persist the dismissal
    try {
      await fetch('/api/dossier/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: id }),
      });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  }, []);

  // Manually trigger a status refresh (called after submitting a new dossier)
  const triggerRefresh = useCallback(() => {
    fetchStatus().then(() => {
      // If we now have pending dossiers and no active polling, start it
      if (hasPendingRef.current && !pollIntervalRef.current && setupPollingRef.current) {
        consecutivePollsRef.current = 0; // Reset backoff for new submission
        setupPollingRef.current();
      }
    });
  }, [fetchStatus]);

  return (
    <DossierNotificationContext.Provider
      value={{
        pendingCount: pendingDossiers.length,
        pendingDossiers,
        recentlyCompleted,
        recentlyFailed,
        clearCompletedNotification,
        clearFailedNotification,
        triggerRefresh,
      }}
    >
      {children}
    </DossierNotificationContext.Provider>
  );
}

/**
 * Hook to access dossier notification context
 */
export function useDossierNotifications() {
  const context = useContext(DossierNotificationContext);
  if (!context) {
    throw new Error('useDossierNotifications must be used within DossierNotificationProvider');
  }
  return context;
}
