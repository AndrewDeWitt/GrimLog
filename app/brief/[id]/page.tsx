'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import BriefReport from '@/components/BriefReport';
import { BriefShareModal, BriefActionsMenu } from '@/components/brief';
import { BriefEditToolbar } from '@/components/brief/BriefEditToolbar';
import { SaveVersionModal } from '@/components/brief/SaveVersionModal';
import { BriefVersionHistoryPanel } from '@/components/brief/BriefVersionHistoryPanel';
import { WIPRecoveryModal } from '@/components/brief/WIPRecoveryModal';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  BriefAnalysis,
  BriefStrategicAnalysis,
  ListSuggestion,
  TacticalRole,
  FunStat,
} from '@/lib/briefAnalysis';
import { generateBriefHTML, SynergyExportData } from '@/lib/briefExport';
import { BriefExportData } from '@/components/BriefReport';
import useBriefAutoSave, {
  getWIPData,
  clearWIPData,
  BriefWIPData,
} from '@/hooks/useBriefAutoSave';

interface SavedBrief {
  id: string;
  userId: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  localAnalysis: BriefAnalysis;
  strategicAnalysis: BriefStrategicAnalysis;
  listSuggestions: ListSuggestion[] | null;
  visibility: 'private' | 'link' | 'public';
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
  isOwner: boolean;
  currentVersion: number;
  isEdited: boolean;
  lastEditedAt: string | null;
  user?: {
    id: string;
    name: string | null;
  };
}

export default function ViewBriefPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();

  const [brief, setBrief] = useState<SavedBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedStrategicAnalysis, setEditedStrategicAnalysis] = useState<
    Partial<BriefStrategicAnalysis> | null
  >(null);
  const [editedListSuggestions, setEditedListSuggestions] = useState<ListSuggestion[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Version and modal state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSaveVersionModal, setShowSaveVersionModal] = useState(false);
  const [showWIPRecoveryModal, setShowWIPRecoveryModal] = useState(false);
  const [wipData, setWipData] = useState<BriefWIPData | null>(null);

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = editedStrategicAnalysis !== null || editedListSuggestions !== null;

  // Auto-save hook
  useBriefAutoSave(
    id,
    hasUnsavedChanges
      ? {
          strategicAnalysis: editedStrategicAnalysis || {},
          listSuggestions: editedListSuggestions || brief?.listSuggestions || [],
        }
      : null,
    brief?.currentVersion || 1,
    hasUnsavedChanges
  );

  useEffect(() => {
    if (!id) return;

    const fetchBrief = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/brief/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Brief not found');
          }
          if (response.status === 403) {
            throw new Error('You do not have permission to view this brief');
          }
          throw new Error('Failed to load brief');
        }

        const data = await response.json();
        setBrief(data);

        // Check for WIP data after brief loads
        if (data.isOwner) {
          const wip = getWIPData(id);
          if (wip) {
            setWipData(wip);
            setShowWIPRecoveryModal(true);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load brief');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrief();
  }, [id]);

  // Get the current strategic analysis (edited or original)
  const currentStrategicAnalysis = editedStrategicAnalysis
    ? { ...brief?.strategicAnalysis, ...editedStrategicAnalysis }
    : brief?.strategicAnalysis;

  // Get the current list suggestions (edited or original)
  const currentListSuggestions = editedListSuggestions ?? brief?.listSuggestions ?? [];

  // Update handlers for edit mode
  const handleUpdateFunStats = useCallback((funStats: FunStat[]) => {
    setEditedStrategicAnalysis((prev) => {
      const existingInsights = prev?.viralInsights || brief?.strategicAnalysis?.viralInsights;
      return {
        ...prev,
        viralInsights: {
          tagline: existingInsights?.tagline || '',
          spiritDescription: existingInsights?.spiritDescription || '',
          armySpiritIconPrompt: existingInsights?.armySpiritIconPrompt || '',
          funStats,
        },
      };
    });
  }, [brief?.strategicAnalysis?.viralInsights]);

  const handleUpdateTacticalSummary = useCallback(
    (unitDisplayName: string, summary: string) => {
      setEditedStrategicAnalysis((prev) => ({
        ...prev,
        unitTacticalSummaries: {
          ...(prev?.unitTacticalSummaries || brief?.strategicAnalysis?.unitTacticalSummaries || {}),
          [unitDisplayName]: summary,
        },
      }));
    },
    [brief?.strategicAnalysis?.unitTacticalSummaries]
  );

  const handleUpdateRole = useCallback(
    (unitDisplayName: string, role: TacticalRole, reasoning: string) => {
      setEditedStrategicAnalysis((prev) => ({
        ...prev,
        unitRoleAssignments: {
          ...(prev?.unitRoleAssignments || brief?.strategicAnalysis?.unitRoleAssignments || {}),
          [unitDisplayName]: { role, reasoning },
        },
      }));
    },
    [brief?.strategicAnalysis?.unitRoleAssignments]
  );

  const handleUpdateListSuggestions = useCallback((suggestions: ListSuggestion[]) => {
    setEditedListSuggestions(suggestions);
  }, []);

  const handleUpdateMatchups = useCallback(
    (matchups: BriefStrategicAnalysis['matchupConsiderations']) => {
      setEditedStrategicAnalysis((prev) => ({
        ...prev,
        matchupConsiderations: matchups,
      }));
    },
    []
  );

  // Save changes (always creates a version)
  const handleSaveAsVersion = async (versionLabel: string, changelog: string) => {
    if (!brief) return;

    setIsSaving(true);
    try {
      // Only include fields that were actually edited
      const payload: {
        strategicAnalysis?: Partial<BriefStrategicAnalysis>;
        listSuggestions?: ListSuggestion[];
        createVersion: boolean;
        versionLabel?: string;
        changelog?: string;
      } = {
        createVersion: true,
        versionLabel: versionLabel || undefined,
        changelog: changelog || undefined,
      };

      if (editedStrategicAnalysis !== null) {
        payload.strategicAnalysis = editedStrategicAnalysis;
      }
      if (editedListSuggestions !== null) {
        payload.listSuggestions = editedListSuggestions;
      }

      const response = await fetch(`/api/brief/${brief.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save version');
      }

      const updated = await response.json();
      setBrief((prev) =>
        prev
          ? {
              ...prev,
              strategicAnalysis: updated.strategicAnalysis,
              listSuggestions: updated.listSuggestions,
              currentVersion: updated.currentVersion,
              isEdited: updated.isEdited,
              lastEditedAt: updated.lastEditedAt,
            }
          : null
      );

      // Clear edited state and WIP
      setEditedStrategicAnalysis(null);
      setEditedListSuggestions(null);
      clearWIPData(brief.id);
      setShowSaveVersionModal(false);
    } catch (err) {
      console.error('Save version error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setEditedStrategicAnalysis(null);
    setEditedListSuggestions(null);
    if (brief) {
      clearWIPData(brief.id);
    }
  };

  // Restore a version
  const handleRestoreVersion = async (versionNumber: number) => {
    if (!brief) return;

    setIsRestoring(true);
    try {
      const response = await fetch(
        `/api/brief/${brief.id}/versions/${versionNumber}/restore`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to restore version');
      }

      const data = await response.json();
      setBrief((prev) =>
        prev
          ? {
              ...prev,
              strategicAnalysis: data.brief.strategicAnalysis,
              listSuggestions: data.brief.listSuggestions,
              currentVersion: data.brief.currentVersion,
              isEdited: data.brief.isEdited,
              lastEditedAt: data.brief.lastEditedAt,
            }
          : null
      );

      // Clear any edited state
      setEditedStrategicAnalysis(null);
      setEditedListSuggestions(null);
      setShowVersionHistory(false);
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  // Restore WIP data
  const handleRestoreWIP = () => {
    if (!wipData) return;

    setEditedStrategicAnalysis(wipData.edits.strategicAnalysis);
    setEditedListSuggestions(wipData.edits.listSuggestions);
    setIsEditMode(true);
  };

  // Discard WIP data
  const handleDiscardWIP = () => {
    if (brief) {
      clearWIPData(brief.id);
    }
    setWipData(null);
  };

  // Handle HTML export
  const handleExport = async (exportData: BriefExportData) => {
    if (!brief) return;

    try {
      let synergyDataForExport: SynergyExportData | null = null;
      if (exportData.synergyData) {
        synergyDataForExport = {
          ...exportData.synergyData,
          unitData: exportData.synergyData.unitData,
        };
      }

      const html = await generateBriefHTML(
        brief.localAnalysis,
        {
          units: [],
          detectedFaction: brief.faction,
          detectedDetachment: brief.detachment || null,
          detectedPointsLimit: null,
          parsingConfidence: 1.0,
        },
        currentStrategicAnalysis || brief.strategicAnalysis,
        brief.spiritIconUrl || exportData.spiritIconUrl,
        exportData.unitIcons,
        synergyDataForExport,
        brief.listName || 'Army Analysis',
        currentListSuggestions
      );

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (brief.listName || brief.faction || 'army-analysis')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      a.download = `tactical-brief-${safeName}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <>
      <GrimlogFrame />

      <main className="fixed inset-0 top-12 flex flex-col bg-grimlog-black">
        {/* Edit Toolbar - only shown when in edit mode */}
        {brief?.isOwner && isEditMode && (
          <BriefEditToolbar
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={() => setShowSaveVersionModal(true)}
            onDiscard={handleDiscard}
            onDone={() => setIsEditMode(false)}
            isSaving={isSaving}
          />
        )}

        {/* Scrollable Content */}
        <div className="relative flex-1 overflow-auto min-h-0">
          <div className="container mx-auto max-w-7xl px-2 pt-2">
            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-20">
                <span className="text-grimlog-orange text-xl animate-pulse">
                  Loading brief...
                </span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-20">
                <div className="text-grimlog-red text-xl mb-4">{error}</div>
                <Link
                  href="/brief"
                  className="inline-block px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase tracking-wider transition-all"
                >
                  Generate New Brief
                </Link>
              </div>
            )}

            {/* Army Identity Card */}
            {brief && (
              <div className="relative bg-grimlog-darkGray/60 border-2 border-grimlog-steel/50 rounded-lg mb-4">
                {/* Actions Menu - top right corner */}
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                  <BriefActionsMenu
                    isOwner={brief.isOwner}
                    isEditMode={isEditMode}
                    onToggleEditMode={() => setIsEditMode(!isEditMode)}
                    onShowVersionHistory={() => setShowVersionHistory(true)}
                    onShowShareModal={() => setShowShareModal(true)}
                    currentVersion={brief.currentVersion || 1}
                    isEdited={brief.isEdited || false}
                  />
                </div>
                <div className="flex items-center gap-4">
                  {/* Spirit Icon */}
                  {brief.spiritIconUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={brief.spiritIconUrl}
                        alt=""
                        className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-lg bg-black/40"
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 pr-10">
                    <p className="text-grimlog-orange text-sm sm:text-base font-bold uppercase tracking-wider">
                      {brief.faction}
                    </p>
                    {brief.detachment && (
                      <p className="text-amber-400 text-xs sm:text-sm font-medium mt-0.5">
                        {brief.detachment}
                      </p>
                    )}
                    <p className="text-gray-300 text-sm mt-2 leading-snug line-clamp-2">
                      {currentStrategicAnalysis?.viralInsights?.tagline ||
                        brief.listName ||
                        'Tactical Brief'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Brief Content */}
            {brief && (
              <BriefReport
                analysis={brief.localAnalysis}
                strategicAnalysis={currentStrategicAnalysis}
                listSuggestions={currentListSuggestions}
                spiritIconUrl={brief.spiritIconUrl}
                onExport={handleExport}
                briefId={brief.id}
                briefVisibility={brief.visibility}
                briefShareToken={brief.shareToken}
                listName={brief.listName || undefined}
                isEditMode={isEditMode}
                onUpdateFunStats={handleUpdateFunStats}
                onUpdateTacticalSummary={handleUpdateTacticalSummary}
                onUpdateRole={handleUpdateRole}
                onUpdateListSuggestions={handleUpdateListSuggestions}
                onUpdateMatchups={handleUpdateMatchups}
              />
            )}
          </div>
        </div>
      </main>

      {/* Share Modal */}
      {brief && (
        <BriefShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          briefId={brief.id}
          currentVisibility={brief.visibility}
          currentShareToken={brief.shareToken}
          listName={brief.listName || undefined}
          faction={brief.faction}
        />
      )}

      {/* Save Version Modal */}
      <SaveVersionModal
        isOpen={showSaveVersionModal}
        onClose={() => setShowSaveVersionModal(false)}
        onSave={handleSaveAsVersion}
        isSaving={isSaving}
      />

      {/* Version History Panel */}
      {brief && (
        <BriefVersionHistoryPanel
          briefId={brief.id}
          currentVersion={brief.currentVersion || 1}
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          onRestoreVersion={handleRestoreVersion}
          isRestoring={isRestoring}
        />
      )}

      {/* WIP Recovery Modal */}
      <WIPRecoveryModal
        isOpen={showWIPRecoveryModal}
        wipData={wipData}
        currentVersion={brief?.currentVersion || 1}
        onRestore={handleRestoreWIP}
        onDiscard={handleDiscardWIP}
        onClose={() => setShowWIPRecoveryModal(false)}
      />
    </>
  );
}
