'use client';

import { useEffect, useCallback, useRef } from 'react';
import { DossierStrategicAnalysis, ListSuggestion } from '@/lib/dossierAnalysis';

export interface DossierWIPData {
  dossierId: string;
  savedAt: string;
  baseVersion: number;
  edits: {
    strategicAnalysis: Partial<DossierStrategicAnalysis>;
    listSuggestions: ListSuggestion[];
  };
}

const DOSSIER_WIP_KEY = (id: string) => `grimlog_dossier_wip_${id}`;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * useDossierAutoSave - Auto-saves dossier edits to localStorage
 *
 * @param dossierId - The dossier ID
 * @param editedData - Current edited data (null if no edits)
 * @param baseVersion - The version this edit is based on
 * @param hasUnsavedChanges - Whether there are unsaved changes
 */
export function useDossierAutoSave(
  dossierId: string | null,
  editedData: {
    strategicAnalysis: Partial<DossierStrategicAnalysis>;
    listSuggestions: ListSuggestion[];
  } | null,
  baseVersion: number,
  hasUnsavedChanges: boolean
) {
  const lastSavedRef = useRef<string | null>(null);

  const saveToLocalStorage = useCallback(() => {
    if (!dossierId || !editedData || !hasUnsavedChanges) return;

    const wipData: DossierWIPData = {
      dossierId,
      savedAt: new Date().toISOString(),
      baseVersion,
      edits: editedData,
    };

    const wipString = JSON.stringify(wipData);

    // Only save if data actually changed
    if (wipString !== lastSavedRef.current) {
      localStorage.setItem(DOSSIER_WIP_KEY(dossierId), wipString);
      lastSavedRef.current = wipString;
    }
  }, [dossierId, editedData, baseVersion, hasUnsavedChanges]);

  // Auto-save on interval
  useEffect(() => {
    if (!dossierId || !hasUnsavedChanges) return;

    const interval = setInterval(saveToLocalStorage, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [dossierId, hasUnsavedChanges, saveToLocalStorage]);

  // Save on beforeunload
  useEffect(() => {
    if (!dossierId || !hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      saveToLocalStorage();
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dossierId, hasUnsavedChanges, saveToLocalStorage]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    if (!dossierId || !hasUnsavedChanges) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveToLocalStorage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dossierId, hasUnsavedChanges, saveToLocalStorage]);

  return { saveToLocalStorage };
}

/**
 * Get WIP data from localStorage
 */
export function getWIPData(dossierId: string): DossierWIPData | null {
  try {
    const stored = localStorage.getItem(DOSSIER_WIP_KEY(dossierId));
    if (!stored) return null;
    return JSON.parse(stored) as DossierWIPData;
  } catch {
    return null;
  }
}

/**
 * Clear WIP data from localStorage
 */
export function clearWIPData(dossierId: string): void {
  localStorage.removeItem(DOSSIER_WIP_KEY(dossierId));
}

/**
 * Check if WIP data exists for a dossier
 */
export function hasWIPData(dossierId: string): boolean {
  return !!localStorage.getItem(DOSSIER_WIP_KEY(dossierId));
}

export default useDossierAutoSave;
