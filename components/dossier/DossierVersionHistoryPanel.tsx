'use client';

import { useState, useEffect } from 'react';

interface VersionInfo {
  id: string;
  versionNumber: number;
  versionLabel: string | null;
  changelog: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null } | null;
  isCurrent: boolean;
}

interface DossierVersionHistoryPanelProps {
  dossierId: string;
  currentVersion: number;
  isOpen: boolean;
  onClose: () => void;
  onRestoreVersion: (versionNumber: number) => void;
  isRestoring: boolean;
}

/**
 * DossierVersionHistoryPanel - Slide-out panel showing version history
 */
export function DossierVersionHistoryPanel({
  dossierId,
  currentVersion,
  isOpen,
  onClose,
  onRestoreVersion,
  isRestoring,
}: DossierVersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && dossierId) {
      fetchVersions();
    }
  }, [isOpen, dossierId]);

  const fetchVersions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dossier/${dossierId}/versions`);
      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-grimlog-darkGray border-l-2 border-grimlog-steel overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-grimlog-black p-4 border-b border-grimlog-steel flex items-center justify-between">
          <h2 className="text-grimlog-orange font-bold uppercase tracking-wider">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="text-grimlog-steel hover:text-grimlog-amber transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-grimlog-orange animate-pulse">Loading versions...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-grimlog-red">{error}</div>
              <button
                onClick={fetchVersions}
                className="mt-2 text-grimlog-orange hover:underline text-sm"
              >
                Try again
              </button>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-grimlog-steel">No versions saved yet</div>
              <p className="text-grimlog-steel/70 text-sm mt-2">
                Use &quot;Save Version&quot; to create snapshots of your dossier
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`border rounded p-3 ${
                    version.isCurrent
                      ? 'border-grimlog-orange bg-grimlog-orange/5'
                      : 'border-grimlog-steel bg-grimlog-black/50'
                  }`}
                >
                  {/* Version header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-grimlog-green font-bold">
                          v{version.versionNumber}
                        </span>
                        {version.versionLabel && (
                          <span className="text-grimlog-amber text-sm">
                            {version.versionLabel}
                          </span>
                        )}
                        {version.isCurrent && (
                          <span className="text-xs px-1.5 py-0.5 bg-grimlog-orange/20 text-grimlog-orange rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-grimlog-steel text-xs mt-1">
                        {formatDate(version.createdAt)}
                        {version.createdBy?.name && ` by ${version.createdBy.name}`}
                      </div>
                    </div>

                    {!version.isCurrent && (
                      version.id.startsWith('synthetic-') ? (
                        <span className="text-xs text-grimlog-steel/60 italic">
                          No snapshot
                        </span>
                      ) : (
                        <button
                          onClick={() => onRestoreVersion(version.versionNumber)}
                          disabled={isRestoring}
                          className="px-2 py-1 text-xs font-bold uppercase bg-grimlog-black border border-grimlog-steel text-grimlog-light-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors disabled:opacity-50"
                        >
                          {isRestoring ? '...' : 'Restore'}
                        </button>
                      )
                    )}
                  </div>

                  {/* Changelog */}
                  {version.changelog && (
                    <div className="mt-2 pt-2 border-t border-grimlog-steel/30">
                      <p className="text-gray-300 text-sm">{version.changelog}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel">
          <p className="text-grimlog-steel text-xs">
            Restoring a version creates a new version with the old content.
            No history is ever deleted.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DossierVersionHistoryPanel;
