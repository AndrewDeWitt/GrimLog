'use client';

/**
 * BriefNotificationContext
 *
 * Provides global state for tracking pending brief generations and notifications.
 * Polls the status endpoint to detect completions and triggers toast notifications.
 *
 * Notification state is persisted in the database via notificationDismissedAt field.
 *
 * Smart polling: Only polls when there are pending briefs being generated.
 * Tracks locally dismissed IDs to prevent re-showing after polling.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

// Types for brief status
export interface PendingBrief {
  id: string;
  status: 'pending' | 'processing';
  startedAt: string;
  faction: string | null;
}

export interface CompletedBrief {
  id: string;
  faction: string | null;
  completedAt: string | null;
}

export interface FailedBrief {
  id: string;
  faction: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface BriefNotificationContextType {
  pendingCount: number;
  pendingBriefs: PendingBrief[];
  recentlyCompleted: CompletedBrief[];
  recentlyFailed: FailedBrief[];
  clearCompletedNotification: (id: string) => Promise<void>;
  clearFailedNotification: (id: string) => Promise<void>;
  triggerRefresh: () => void;
}

const BriefNotificationContext = createContext<BriefNotificationContextType | undefined>(undefined);

// Polling intervals - balanced for responsiveness vs rate limit (120 req/min)
// Most brief generations take ~2 minutes, so we start slow and speed up
const INITIAL_POLL_INTERVAL = 20000; // 20 seconds initially (we know it takes ~2 min)
const FAST_POLL_INTERVAL = 10000; // 10 seconds after expected completion time approaches
const SPEEDUP_THRESHOLD = 6; // After 6 polls (~2 min), speed up polling
// Note: No idle polling - only poll when there are pending briefs

export function BriefNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendingBriefs, setPendingBriefs] = useState<PendingBrief[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<CompletedBrief[]>([]);
  const [recentlyFailed, setRecentlyFailed] = useState<FailedBrief[]>([]);

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
      const res = await fetch('/api/brief/status');
      if (!res.ok || !isMountedRef.current) return;

      const data = await res.json();
      const pending = data.pending || [];
      setPendingBriefs(pending);
      hasPendingRef.current = pending.length > 0;

      // Track consecutive polls without change for backoff logic
      if (pending.length === lastPendingCountRef.current && pending.length > 0) {
        consecutivePollsRef.current++;
      } else {
        consecutivePollsRef.current = 0;
      }
      lastPendingCountRef.current = pending.length;

      // Filter out locally dismissed IDs from API response
      const apiCompleted: CompletedBrief[] = (data.recentlyCompleted || [])
        .filter((d: CompletedBrief) => !dismissedIdsRef.current.has(d.id));
      const apiFailed: FailedBrief[] = (data.recentlyFailed || [])
        .filter((d: FailedBrief) => !dismissedIdsRef.current.has(d.id));

      setRecentlyCompleted(apiCompleted);
      setRecentlyFailed(apiFailed);

    } catch (error) {
      console.error('Failed to fetch brief status:', error);
    }
  }, [user]);

  // Smart polling: faster when pending, slower when idle
  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      // Clear state when user logs out
      setPendingBriefs([]);
      setRecentlyCompleted([]);
      setRecentlyFailed([]);
      dismissedIdsRef.current.clear();
      return;
    }

    // Set up smart polling with backoff - only polls when there are pending briefs
    const setupPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Don't poll if no pending briefs - saves unnecessary API calls
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

    // Initial fetch, then start polling if we have pending briefs
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
      await fetch('/api/brief/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: id }),
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
      await fetch('/api/brief/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: id }),
      });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  }, []);

  // Manually trigger a status refresh (called after submitting a new brief)
  const triggerRefresh = useCallback(() => {
    fetchStatus().then(() => {
      // If we now have pending briefs and no active polling, start it
      if (hasPendingRef.current && !pollIntervalRef.current && setupPollingRef.current) {
        consecutivePollsRef.current = 0; // Reset backoff for new submission
        setupPollingRef.current();
      }
    });
  }, [fetchStatus]);

  return (
    <BriefNotificationContext.Provider
      value={{
        pendingCount: pendingBriefs.length,
        pendingBriefs,
        recentlyCompleted,
        recentlyFailed,
        clearCompletedNotification,
        clearFailedNotification,
        triggerRefresh,
      }}
    >
      {children}
    </BriefNotificationContext.Provider>
  );
}

/**
 * Hook to access brief notification context
 */
export function useBriefNotifications() {
  const context = useContext(BriefNotificationContext);
  if (!context) {
    throw new Error('useBriefNotifications must be used within BriefNotificationProvider');
  }
  return context;
}
