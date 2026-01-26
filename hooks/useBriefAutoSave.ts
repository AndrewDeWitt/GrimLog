'use client';

import { useEffect, useCallback, useRef } from 'react';
import { BriefStrategicAnalysis, ListSuggestion } from '@/lib/briefAnalysis';

export interface BriefWIPData {
  briefId: string;
  savedAt: string;
  baseVersion: number;
  edits: {
    strategicAnalysis: Partial<BriefStrategicAnalysis>;
    listSuggestions: ListSuggestion[];
  };
}

const BRIEF_WIP_KEY = (id: string) => `grimlog_brief_wip_${id}`;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * useBriefAutoSave - Auto-saves brief edits to localStorage
 *
 * @param briefId - The brief ID
 * @param editedData - Current edited data (null if no edits)
 * @param baseVersion - The version this edit is based on
 * @param hasUnsavedChanges - Whether there are unsaved changes
 */
export function useBriefAutoSave(
  briefId: string | null,
  editedData: {
    strategicAnalysis: Partial<BriefStrategicAnalysis>;
    listSuggestions: ListSuggestion[];
  } | null,
  baseVersion: number,
  hasUnsavedChanges: boolean
) {
  const lastSavedRef = useRef<string | null>(null);

  const saveToLocalStorage = useCallback(() => {
    if (!briefId || !editedData || !hasUnsavedChanges) return;

    const wipData: BriefWIPData = {
      briefId,
      savedAt: new Date().toISOString(),
      baseVersion,
      edits: editedData,
    };

    const wipString = JSON.stringify(wipData);

    // Only save if data actually changed
    if (wipString !== lastSavedRef.current) {
      localStorage.setItem(BRIEF_WIP_KEY(briefId), wipString);
      lastSavedRef.current = wipString;
    }
  }, [briefId, editedData, baseVersion, hasUnsavedChanges]);

  // Auto-save on interval
  useEffect(() => {
    if (!briefId || !hasUnsavedChanges) return;

    const interval = setInterval(saveToLocalStorage, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [briefId, hasUnsavedChanges, saveToLocalStorage]);

  // Save on beforeunload
  useEffect(() => {
    if (!briefId || !hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      saveToLocalStorage();
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [briefId, hasUnsavedChanges, saveToLocalStorage]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    if (!briefId || !hasUnsavedChanges) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveToLocalStorage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [briefId, hasUnsavedChanges, saveToLocalStorage]);

  return { saveToLocalStorage };
}

/**
 * Get WIP data from localStorage
 */
export function getWIPData(briefId: string): BriefWIPData | null {
  try {
    const stored = localStorage.getItem(BRIEF_WIP_KEY(briefId));
    if (!stored) return null;
    return JSON.parse(stored) as BriefWIPData;
  } catch {
    return null;
  }
}

/**
 * Clear WIP data from localStorage
 */
export function clearWIPData(briefId: string): void {
  localStorage.removeItem(BRIEF_WIP_KEY(briefId));
}

/**
 * Check if WIP data exists for a brief
 */
export function hasWIPData(briefId: string): boolean {
  return !!localStorage.getItem(BRIEF_WIP_KEY(briefId));
}

export default useBriefAutoSave;
