'use client';

import { useState, useEffect } from 'react';

interface Version {
  id: string;
  versionNumber: number;
  versionLabel: string | null;
  changelog: string | null;
  createdAt: string;
  createdBy: {
    id: string | null;
    name: string;
  };
  isCurrent: boolean;
}

interface VersionHistoryPanelProps {
  datasheetId: string;
  datasheetName: string;
  currentVersion: number;
  isOfficial: boolean;
  onViewVersion?: (versionNumber: number) => void;
}

export default function VersionHistoryPanel({
  datasheetId,
  datasheetName,
  currentVersion,
  isOfficial,
  onViewVersion,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [versionSnapshot, setVersionSnapshot] = useState<any>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    fetchVersionHistory();
  }, [datasheetId]);

  const fetchVersionHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/datasheets/detail/${datasheetId}/versions`);
      if (!res.ok) {
        throw new Error('Failed to fetch version history');
      }
      const data = await res.json();
      setVersions(data.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionSnapshot = async (versionNumber: number) => {
    setLoadingSnapshot(true);
    try {
      const res = await fetch(`/api/datasheets/detail/${datasheetId}/versions/${versionNumber}`);
      if (!res.ok) {
        throw new Error('Failed to fetch version');
      }
      const data = await res.json();
      setVersionSnapshot(data.snapshot);
    } catch (err) {
      console.error('Failed to load version snapshot:', err);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const toggleVersion = (versionNumber: number) => {
    if (expandedVersion === versionNumber) {
      setExpandedVersion(null);
      setVersionSnapshot(null);
    } else {
      setExpandedVersion(versionNumber);
      fetchVersionSnapshot(versionNumber);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="border border-grimlog-steel bg-grimlog-darkGray p-4">
        <h3 className="text-lg font-bold text-grimlog-orange mb-4">VERSION HISTORY</h3>
        <p className="text-grimlog-light-steel text-center py-4">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-grimlog-steel bg-grimlog-darkGray p-4">
        <h3 className="text-lg font-bold text-grimlog-orange mb-4">VERSION HISTORY</h3>
        <p className="text-red-400 text-center py-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="border border-grimlog-steel bg-grimlog-darkGray p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-grimlog-orange">VERSION HISTORY</h3>
        <span className="text-sm text-grimlog-light-steel">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {versions.length === 0 ? (
        <p className="text-grimlog-light-steel text-center py-4">No version history available</p>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className={`border ${version.isCurrent ? 'border-grimlog-orange' : 'border-grimlog-steel'} bg-grimlog-black`}
            >
              {/* Version Header */}
              <button
                onClick={() => toggleVersion(version.versionNumber)}
                className="w-full p-3 flex justify-between items-center text-left hover:bg-grimlog-gray/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`font-mono font-bold ${version.isCurrent ? 'text-grimlog-orange' : 'text-white'}`}>
                    v{version.versionNumber}
                  </span>
                  {version.versionLabel && (
                    <span className="text-grimlog-light-steel text-sm">{version.versionLabel}</span>
                  )}
                  {version.isCurrent && (
                    <span className="px-2 py-0.5 bg-grimlog-orange text-grimlog-black text-xs font-bold">
                      CURRENT
                    </span>
                  )}
                </div>
                <span className="text-grimlog-light-steel text-xs">
                  {formatDate(version.createdAt)}
                </span>
              </button>

              {/* Expanded Details */}
              {expandedVersion === version.versionNumber && (
                <div className="p-3 border-t border-grimlog-steel bg-grimlog-gray/20">
                  <div className="space-y-3">
                    {/* Changelog */}
                    {version.changelog && (
                      <div>
                        <span className="text-xs text-grimlog-light-steel">Changelog:</span>
                        <p className="text-sm text-white mt-1">{version.changelog}</p>
                      </div>
                    )}

                    {/* Created By */}
                    <div className="text-xs text-grimlog-light-steel">
                      Created by: <span className="text-white">{version.createdBy.name}</span>
                    </div>

                    {/* Snapshot Preview */}
                    {loadingSnapshot ? (
                      <p className="text-grimlog-light-steel text-sm">Loading snapshot...</p>
                    ) : versionSnapshot && (
                      <div className="mt-3">
                        <span className="text-xs text-grimlog-light-steel">Snapshot Preview:</span>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-grimlog-black p-2">
                            <span className="text-grimlog-light-steel">Points:</span>
                            <span className="text-grimlog-green ml-1">{versionSnapshot.pointsCost}</span>
                          </div>
                          <div className="bg-grimlog-black p-2">
                            <span className="text-grimlog-light-steel">Wounds:</span>
                            <span className="text-white ml-1">{versionSnapshot.wounds}</span>
                          </div>
                          <div className="bg-grimlog-black p-2">
                            <span className="text-grimlog-light-steel">Weapons:</span>
                            <span className="text-white ml-1">{versionSnapshot.weapons?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      {onViewVersion && (
                        <button
                          onClick={() => onViewVersion(version.versionNumber)}
                          className="px-3 py-1 bg-grimlog-gray border border-grimlog-steel text-grimlog-light-steel hover:text-white text-sm"
                        >
                          View Full Snapshot
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
