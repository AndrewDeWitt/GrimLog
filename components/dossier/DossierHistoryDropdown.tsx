'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface DossierSummary {
  id: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  visibility: 'private' | 'link' | 'public';
  viewCount: number;
  createdAt: string;
  tagline: string | null;
  archetype: string | null;
}

interface DossierHistoryResponse {
  dossiers: DossierSummary[];
  total: number;
  factions: string[];
}

export function DossierHistoryDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<DossierHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchHistory = async () => {
    if (data) return; // Don't refetch if we already have data
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dossier/list?limit=10');
      if (!response.ok) {
        if (response.status === 401) {
          setError('Sign in to view history');
          return;
        }
        throw new Error('Failed to fetch history');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState) {
      fetchHistory();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return '🌐';
      case 'link': return '🔗';
      default: return '🔒';
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className="px-4 py-2 bg-grimlog-darkGray hover:bg-grimlog-gray text-grimlog-amber font-bold tracking-wider border border-grimlog-steel hover:border-grimlog-amber transition-all uppercase text-sm flex items-center gap-2"
      >
        📋 My Dossiers
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-grimlog-darkGray border border-grimlog-steel rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-grimlog-black p-3 border-b border-grimlog-steel flex items-center justify-between">
            <span className="text-grimlog-orange font-bold text-sm uppercase tracking-wider">
              Recent Dossiers
            </span>
            {data && data.total > 10 && (
              <Link 
                href="/dossier/history"
                className="text-grimlog-amber text-xs hover:underline"
              >
                View All ({data.total})
              </Link>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="p-6 text-center">
                <span className="text-grimlog-steel animate-pulse">Loading...</span>
              </div>
            )}

            {error && (
              <div className="p-4 text-center">
                <span className="text-grimlog-red text-sm">{error}</span>
              </div>
            )}

            {data && data.dossiers.length === 0 && (
              <div className="p-6 text-center">
                <span className="text-grimlog-steel text-sm">No dossiers yet</span>
                <p className="text-grimlog-steel/70 text-xs mt-1">
                  Generate your first dossier above!
                </p>
              </div>
            )}

            {data && data.dossiers.length > 0 && (
              <div className="divide-y divide-grimlog-steel/30">
                {data.dossiers.map((dossier) => (
                  <Link
                    key={dossier.id}
                    href={`/dossier/${dossier.id}`}
                    className="block p-3 hover:bg-grimlog-black/50 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Spirit Icon or Placeholder */}
                      {dossier.spiritIconUrl ? (
                        <img
                          src={dossier.spiritIconUrl}
                          alt=""
                          className="w-10 h-10 rounded border border-grimlog-steel/50 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded border border-grimlog-steel/50 bg-grimlog-black flex items-center justify-center text-lg flex-shrink-0">
                          ⚔
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-grimlog-green font-bold text-sm truncate">
                            {dossier.listName || dossier.faction}
                          </span>
                          <span className="text-xs">{getVisibilityIcon(dossier.visibility)}</span>
                        </div>
                        {dossier.tagline && (
                          <p className="text-grimlog-amber text-xs italic truncate mt-0.5">
                            &quot;{dossier.tagline}&quot;
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-grimlog-steel text-xs">
                            {dossier.totalPoints}pts
                          </span>
                          <span className="text-grimlog-steel/50">•</span>
                          <span className="text-grimlog-steel text-xs">
                            {formatDate(dossier.createdAt)}
                          </span>
                          {dossier.viewCount > 0 && (
                            <>
                              <span className="text-grimlog-steel/50">•</span>
                              <span className="text-grimlog-steel text-xs">
                                {dossier.viewCount} views
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {data && data.dossiers.length > 0 && (
            <div className="bg-grimlog-black p-3 border-t border-grimlog-steel">
              <Link
                href="/dossier/gallery"
                className="block text-center text-grimlog-amber text-xs hover:underline"
              >
                Browse Public Gallery →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DossierHistoryDropdown;

