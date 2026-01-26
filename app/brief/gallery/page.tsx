'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import { useBriefNotifications, PendingBrief } from '@/lib/brief/BriefNotificationContext';
import { GalleryFilterDropdown, PointsRangeDropdown, MobileFilterPanel } from '@/components/gallery';

interface PlaystyleBlend {
  primary: { style: string; percentage: number };
  secondary?: { style: string; percentage: number };
}

interface PublicBrief {
  id: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
  executiveSummary: string | null;
  tagline: string | null;
  archetype: string | null;
  playstyleBlend: PlaystyleBlend | null;
  combatSpectrum: number | null;
  totalWounds: number | null;
}

interface GalleryResponse {
  briefs: PublicBrief[];
  total: number;
  factions: string[];
  detachments: string[];
  factionMeta: Record<string, { iconUrl?: string }>;
}

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Archetype config with colors
const ARCHETYPE_CONFIG: Record<string, { color: string; borderColor: string; icon: string }> = {
  horde: { color: 'text-green-400', borderColor: 'border-green-500/60', icon: '🐺' },
  elite: { color: 'text-purple-400', borderColor: 'border-purple-500/60', icon: '👑' },
  balanced: { color: 'text-blue-400', borderColor: 'border-blue-500/60', icon: '⚖️' },
  skew: { color: 'text-orange-400', borderColor: 'border-orange-500/60', icon: '🎯' },
  castle: { color: 'text-gray-400', borderColor: 'border-gray-500/60', icon: '🏰' },
  alpha_strike: { color: 'text-red-400', borderColor: 'border-red-500/60', icon: '⚡' },
  attrition: { color: 'text-amber-400', borderColor: 'border-amber-500/60', icon: '🛡️' },
};

export default function BriefGalleryPage() {
  const [data, setData] = useState<GalleryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<string>('');
  const [selectedDetachment, setSelectedDetachment] = useState<string>('');
  const [pointsRange, setPointsRange] = useState<{ min: number; max: number }>({ min: 0, max: 99999 });
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'oldest'>('recent');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Calculate active filter count for mobile badge (excludes faction which is always visible)
  const activeFilterCount =
    (selectedDetachment ? 1 : 0) +
    (pointsRange.min > 0 || pointsRange.max < 99999 ? 1 : 0) +
    (sortBy !== 'recent' ? 1 : 0);

  // Get pending briefs from notification context
  const { pendingBriefs } = useBriefNotifications();

  const fetchBriefs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortBy,
      });
      if (selectedFaction) {
        params.set('faction', selectedFaction);
      }
      if (selectedDetachment) {
        params.set('detachment', selectedDetachment);
      }
      if (pointsRange.min > 0) {
        params.set('minPoints', pointsRange.min.toString());
      }
      if (pointsRange.max < 99999) {
        params.set('maxPoints', pointsRange.max.toString());
      }

      const response = await fetch(`/api/brief/public?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch briefs');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefs();
  }, [selectedFaction, selectedDetachment, pointsRange, sortBy, offset]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getArchetypeConfig = (archetype: string | null) => {
    if (!archetype) return null;
    return ARCHETYPE_CONFIG[archetype] || { color: 'text-grimlog-steel', borderColor: 'border-grimlog-steel/50', icon: '⚔️' };
  };

  return (
    <>
      <GrimlogFrame />

      <main className="fixed inset-0 top-12 flex flex-col bg-grimlog-black">
        {/* Scanlines overlay - CRT effect */}
        <div
          className="pointer-events-none fixed inset-0 z-30 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.8) 2px, rgba(0, 0, 0, 0.8) 4px)',
          }}
        />

        {/* Atmospheric background with green tint for terminal feel */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.04)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,107,0,0.02)_0%,transparent_50%)] pointer-events-none" />

        {/* Fixed Header Section */}
        <div className="relative flex-shrink-0 container mx-auto max-w-7xl w-full">
          <header className="pb-1">
            {/* Glow effect behind header */}
            <div className="absolute -inset-1 bg-green-500/5 blur-lg rounded-lg" />

            {/* Main header container */}
            <div className="relative bg-black/90 border border-green-500/30 overflow-hidden shadow-lg shadow-black/50">
              {/* Scanline overlay for header */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.4)_2px,rgba(0,0,0,0.4)_4px)] pointer-events-none" />

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500" />

              <div className="relative px-4 py-3">
                {/* Title row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Terminal icon */}
                    <div className="hidden sm:flex w-8 h-8 items-center justify-center border border-green-500/50 bg-green-500/5">
                      <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 17l6-6-6-6" />
                        <path d="M12 19h8" />
                      </svg>
                    </div>

                    <div>
                      <h1 className="text-lg sm:text-xl font-black text-green-400 tracking-wider uppercase drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
                        Brief Gallery
                      </h1>
                      <p className="text-green-600 text-[10px] sm:text-xs font-mono tracking-wide hidden sm:block">
                        ++ TACTICAL INTELLIGENCE ARCHIVE ++
                      </p>
                    </div>
                  </div>

                  {/* Generate CTA */}
                  <Link
                    href="/brief"
                    className="self-center flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-grimlog-orange hover:bg-grimlog-amber text-black text-xs sm:text-sm font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_12px_rgba(255,107,0,0.4)] flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Generate
                  </Link>
                </div>

                {/* Filters row - Mobile: faction + filter button, Desktop: inline filters */}
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  {/* Mobile: Faction dropdown + More filters button */}
                  <div className="sm:hidden flex gap-3">
                    <GalleryFilterDropdown
                      value={selectedFaction || null}
                      onChange={(v) => { setSelectedFaction(v || ''); setSelectedDetachment(''); setOffset(0); }}
                      options={data?.factions.map(f => ({
                        value: f,
                        label: f,
                        iconUrl: data?.factionMeta?.[f]?.iconUrl,
                        factionName: f,
                      })) || []}
                      placeholder="All Factions"
                      className="flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => setMobileFiltersOpen(true)}
                      className="w-10 h-10 bg-black/50 border border-green-500/30 text-green-400 flex items-center justify-center hover:border-green-500/50 transition-colors flex-shrink-0 relative"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Desktop: Inline filters */}
                  <div className="hidden sm:flex gap-2 flex-wrap">
                    {/* Faction filter with icons */}
                    <GalleryFilterDropdown
                      value={selectedFaction || null}
                      onChange={(v) => { setSelectedFaction(v || ''); setSelectedDetachment(''); setOffset(0); }}
                      options={data?.factions.map(f => ({
                        value: f,
                        label: f,
                        iconUrl: data?.factionMeta?.[f]?.iconUrl,
                        factionName: f,
                      })) || []}
                      placeholder="All Factions"
                      className="flex-1 min-w-[140px]"
                    />

                    {/* Detachment filter - only show when faction selected */}
                    {selectedFaction && (data?.detachments?.length ?? 0) > 0 && (
                      <GalleryFilterDropdown
                        value={selectedDetachment || null}
                        onChange={(v) => { setSelectedDetachment(v || ''); setOffset(0); }}
                        options={data?.detachments?.map(d => ({
                          value: d,
                          label: d,
                        })) || []}
                        placeholder="All Detachments"
                        className="flex-1 min-w-[140px]"
                      />
                    )}

                    {/* Points range filter */}
                    <PointsRangeDropdown
                      value={pointsRange}
                      onChange={(range) => { setPointsRange(range); setOffset(0); }}
                      className="min-w-[120px]"
                    />

                    {/* Sort dropdown */}
                    <GalleryFilterDropdown
                      value={sortBy}
                      onChange={(v) => { setSortBy((v as 'recent' | 'popular' | 'oldest') || 'recent'); setOffset(0); }}
                      options={[
                        { value: 'recent', label: 'Newest' },
                        { value: 'popular', label: 'Most Views' },
                        { value: 'oldest', label: 'Oldest' },
                      ]}
                      placeholder="Sort"
                      searchable={false}
                      className="min-w-[100px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>
        </div>

        {/* Scrollable Content Area */}
        <div className="relative flex-1 overflow-auto min-h-0">
          <div className="container mx-auto pt-2 px-3 max-w-7xl pb-8">
            {/* Pending Briefs Section */}
          {pendingBriefs.length > 0 && (
            <div className="mb-4">
              <h2 className="text-green-400 font-bold uppercase tracking-wider text-xs mb-2 flex items-center gap-2 font-mono">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Processing ({pendingBriefs.length})
              </h2>
              <div className="space-y-2">
                {pendingBriefs.map((brief: PendingBrief) => (
                  <div
                    key={brief.id}
                    className="bg-black/60 border border-green-500/30 p-3 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 border border-green-500/50 bg-green-500/10 flex items-center justify-center animate-pulse">
                      <svg className="w-5 h-5 text-green-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4m-8-10h4m12 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-green-400 font-bold text-sm truncate">
                        {brief.faction || 'Analyzing...'}
                      </p>
                      <p className="text-green-600 text-xs font-mono">
                        {formatTimeAgo(brief.startedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-grimlog-darkGray/50 border border-grimlog-steel/30 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-grimlog-black/50" />
                  <div className="p-2.5 space-y-2">
                    <div className="h-4 bg-grimlog-steel/30 rounded w-3/4" />
                    <div className="h-3 bg-grimlog-steel/20 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-black/60 border border-red-500/30">
                <div className="text-red-400 font-mono text-sm mb-4">++ ERROR: DATA RETRIEVAL FAILED ++</div>
                <button
                  onClick={fetchBriefs}
                  className="px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black text-sm font-bold uppercase transition-all"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {data && data.briefs.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-black/60 border border-green-500/30">
                <div className="text-green-400 font-mono text-sm mb-4">
                  {selectedFaction
                    ? `++ NO BRIEFS FOUND FOR ${selectedFaction.toUpperCase()} ++`
                    : '++ ARCHIVE EMPTY ++'
                  }
                </div>
                <Link
                  href="/brief"
                  className="inline-block px-4 py-2 bg-green-700 hover:bg-green-600 text-green-100 text-sm font-bold uppercase transition-all border border-green-500/50"
                >
                  Generate First Brief
                </Link>
              </div>
            </div>
          )}

          {/* Brief Grid - Showcase/Portfolio Style */}
          {data && data.briefs.length > 0 && !isLoading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {data.briefs.map((brief) => {
                  const archetypeConfig = getArchetypeConfig(brief.archetype);

                  return (
                    <Link
                      key={brief.id}
                      href={brief.shareToken ? `/brief/share/${brief.shareToken}` : `/brief/${brief.id}`}
                      className={`group relative bg-grimlog-darkGray/80 border overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-grimlog-orange/20 ${
                        archetypeConfig ? archetypeConfig.borderColor : 'border-grimlog-steel/40'
                      } hover:border-grimlog-orange`}
                    >
                      {/* Spirit Icon - Hero Element */}
                      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-grimlog-black to-grimlog-darkGray">
                        {brief.spiritIconUrl ? (
                          <img
                            src={brief.spiritIconUrl}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-5xl sm:text-6xl text-grimlog-steel/30">
                            ⚔
                          </div>
                        )}

                        {/* Gradient overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        {/* View count badge */}
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-white/70 flex items-center gap-1 font-mono">
                          <span className="opacity-60">👁</span>
                          <span>{brief.viewCount}</span>
                        </div>

                        {/* Points badge */}
                        <div className="absolute top-2 left-2 bg-grimlog-orange/90 backdrop-blur-sm px-2 py-0.5 text-xs font-mono font-bold text-black">
                          {brief.totalPoints}
                        </div>

                        {/* Bottom info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          {/* Archetype badge */}
                          {archetypeConfig && (
                            <div className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium mb-1.5 ${archetypeConfig.color}`}>
                              <span>{archetypeConfig.icon}</span>
                              <span className="capitalize">{brief.archetype?.replace('_', ' ')}</span>
                            </div>
                          )}

                          {/* Title */}
                          <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-2 group-hover:text-grimlog-amber transition-colors">
                            {brief.listName || brief.faction}
                          </h3>
                        </div>
                      </div>

                      {/* Tagline + Date footer */}
                      <div className="p-2.5 bg-black/40 border-t border-white/5">
                        {brief.tagline ? (
                          <p className="text-grimlog-amber/90 text-xs leading-snug line-clamp-2 mb-1">
                            &ldquo;{brief.tagline}&rdquo;
                          </p>
                        ) : (
                          <p className="text-grimlog-steel/60 text-xs mb-1">{brief.faction}</p>
                        )}
                        <p className="text-grimlog-steel/50 text-[10px] font-mono text-right">
                          {formatDate(brief.createdAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {data.total > limit && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-4 py-2 bg-black/60 border border-green-500/30 text-green-400 text-xs font-mono hover:border-green-400 hover:shadow-[0_0_10px_rgba(34,197,94,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ← PREV
                  </button>
                  <span className="text-green-500/70 text-xs font-mono">
                    [{Math.floor(offset / limit) + 1} / {Math.ceil(data.total / limit)}]
                  </span>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= data.total}
                    className="px-4 py-2 bg-black/60 border border-green-500/30 text-green-400 text-xs font-mono hover:border-green-400 hover:shadow-[0_0_10px_rgba(34,197,94,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    NEXT →
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </main>

      {/* Mobile Filter Panel (excludes faction which is always visible) */}
      <MobileFilterPanel
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        selectedFaction={selectedFaction}
        selectedDetachment={selectedDetachment}
        onDetachmentChange={(d) => { setSelectedDetachment(d); setOffset(0); }}
        detachmentOptions={data?.detachments?.map(d => ({
          value: d,
          label: d,
        })) || []}
        pointsRange={pointsRange}
        onPointsRangeChange={(range) => { setPointsRange(range); setOffset(0); }}
        sortBy={sortBy}
        onSortChange={(s) => { setSortBy(s as 'recent' | 'popular' | 'oldest'); setOffset(0); }}
        activeFilterCount={activeFilterCount}
      />
    </>
  );
}
