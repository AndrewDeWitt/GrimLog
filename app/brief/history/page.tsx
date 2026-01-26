'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GrimlogFrame from '@/components/MechanicusFrame';
import { useAuth } from '@/lib/auth/AuthContext';
import { GalleryFilterDropdown, PointsRangeDropdown } from '@/components/gallery';
import {
  BriefCard,
  BulkActionsToolbar,
  MyBriefsMobileFilterPanel,
  type BriefSummary,
} from '@/components/brief';

interface HistoryResponse {
  briefs: BriefSummary[];
  total: number;
  factions: string[];
  detachments: string[];
  factionMeta: Record<string, { iconUrl?: string }>;
}

export default function MyBriefsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Data state
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedFaction, setSelectedFaction] = useState<string>('');
  const [selectedDetachment, setSelectedDetachment] = useState<string>('');
  const [pointsRange, setPointsRange] = useState<{ min: number; max: number }>({ min: 0, max: 99999 });
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'oldest'>('recent');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Mobile filter panel state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Search debounce
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate active filter count for mobile badge (excludes faction which is always visible)
  const activeFilterCount =
    (selectedDetachment ? 1 : 0) +
    (pointsRange.min > 0 || pointsRange.max < 99999 ? 1 : 0) +
    (sortBy !== 'recent' ? 1 : 0) +
    (debouncedSearch ? 1 : 0) +
    (visibilityFilter ? 1 : 0);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/brief');
    }
  }, [user, authLoading, router]);

  const fetchBriefs = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortBy,
      });
      if (selectedFaction) params.set('faction', selectedFaction);
      if (selectedDetachment) params.set('detachment', selectedDetachment);
      if (pointsRange.min > 0) params.set('minPoints', pointsRange.min.toString());
      if (pointsRange.max < 99999) params.set('maxPoints', pointsRange.max.toString());
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (visibilityFilter) params.set('visibility', visibilityFilter);

      const response = await fetch(`/api/brief/list?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/brief');
          return;
        }
        throw new Error('Failed to fetch briefs');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, offset, sortBy, selectedFaction, selectedDetachment, pointsRange, debouncedSearch, visibilityFilter, router]);

  useEffect(() => {
    if (user) {
      fetchBriefs();
    }
  }, [fetchBriefs, user]);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, [data?.briefs]);

  const handleRename = async (id: string, newName: string) => {
    try {
      const response = await fetch(`/api/brief/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName: newName }),
      });
      if (!response.ok) throw new Error('Failed to rename');

      // Update local state optimistically
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          briefs: prev.briefs.map((d) =>
            d.id === id ? { ...d, listName: newName || null } : d
          ),
        };
      });
    } catch {
      alert('Failed to rename brief');
      throw new Error('Failed to rename');
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Auto-enable selection mode when first item is selected
      if (next.size > 0 && !isSelectionMode) {
        setIsSelectionMode(true);
      }
      // Auto-disable selection mode when all items are deselected
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (data) {
      setSelectedIds(new Set(data.briefs.map((d) => d.id)));
      setIsSelectionMode(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} brief${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;

    setBulkActionLoading(true);
    try {
      const response = await fetch('/api/brief/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'delete' }),
      });
      if (!response.ok) throw new Error('Failed to delete');
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      fetchBriefs();
    } catch {
      alert('Failed to delete briefs');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkVisibilityChange = async (visibility: 'private' | 'link' | 'public') => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const response = await fetch('/api/brief/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'setVisibility', visibility }),
      });
      if (!response.ok) throw new Error('Failed to update visibility');
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      fetchBriefs();
    } catch {
      alert('Failed to update visibility');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <>
        <GrimlogFrame />
        <main className="min-h-screen pt-16 pb-8 bg-grimlog-black flex items-center justify-center">
          <span className="text-grimlog-orange animate-pulse">Loading...</span>
        </main>
      </>
    );
  }

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

        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,0,0.04)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,107,0,0.02)_0%,transparent_50%)] pointer-events-none" />

        {/* Fixed Header Section */}
        <div className="relative flex-shrink-0 container mx-auto max-w-7xl w-full">
          <header className="pb-1">
            {/* Glow effect behind header */}
            <div className="absolute -inset-1 bg-grimlog-orange/5 blur-lg rounded-lg" />

            {/* Main header container */}
            <div className="relative bg-black/90 border border-grimlog-orange/30 overflow-hidden shadow-lg shadow-black/50">
              {/* Scanline overlay for header */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.4)_2px,rgba(0,0,0,0.4)_4px)] pointer-events-none" />

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grimlog-orange" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grimlog-orange" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-grimlog-orange" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-grimlog-orange" />

              <div className="relative px-4 py-3">
                {/* Title row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Back link */}
                    <Link
                      href="/brief"
                      className="hidden sm:flex w-8 h-8 items-center justify-center border border-grimlog-orange/50 bg-grimlog-orange/5 text-grimlog-orange hover:bg-grimlog-orange/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Link>

                    <div>
                      <h1 className="text-lg sm:text-xl font-black text-grimlog-orange tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]">
                        My Briefs
                      </h1>
                      <p className="text-grimlog-amber text-[10px] sm:text-xs font-mono tracking-wide hidden sm:block">
                        {data ? `${data.total} brief${data.total !== 1 ? 's' : ''} in archive` : '++ LOADING ++'}
                      </p>
                    </div>
                  </div>

                  {/* Selection mode toggle & Generate CTA */}
                  <div className="flex items-center gap-2">
                    {data && data.briefs.length > 0 && (
                      <button
                        onClick={() => {
                          if (isSelectionMode) {
                            handleClearSelection();
                          } else {
                            setIsSelectionMode(true);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all border ${
                          isSelectionMode
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-transparent border-grimlog-steel/50 text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange'
                        }`}
                      >
                        {isSelectionMode ? 'Cancel' : 'Select'}
                      </button>
                    )}
                    <Link
                      href="/brief"
                      className="self-center flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-grimlog-orange hover:bg-grimlog-amber text-black text-xs sm:text-sm font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_12px_rgba(255,107,0,0.4)] flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      New
                    </Link>
                  </div>
                </div>

                {/* Filters row */}
                <div className="mt-3 pt-3 border-t border-grimlog-orange/20">
                  {/* Mobile: Faction dropdown + Search + filter button */}
                  <div className="sm:hidden flex gap-2">
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
                      className="w-10 h-10 bg-black/50 border border-grimlog-orange/30 text-grimlog-orange flex items-center justify-center hover:border-grimlog-orange/50 transition-colors flex-shrink-0 relative"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-grimlog-orange text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Desktop: Inline filters */}
                  <div className="hidden sm:flex gap-2 flex-wrap">
                    {/* Search input */}
                    <div className="relative flex-1 min-w-[160px] max-w-[240px]">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setOffset(0); }}
                        placeholder="Search..."
                        className="w-full h-10 bg-black/50 border border-grimlog-orange/30 text-grimlog-green px-3 pl-9 text-sm font-mono focus:outline-none focus:border-grimlog-orange placeholder:text-grimlog-steel/50"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grimlog-steel" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => { setSearchQuery(''); setOffset(0); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-grimlog-steel hover:text-grimlog-orange"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Faction filter */}
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
                      className="min-w-[140px]"
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
                        className="min-w-[140px]"
                      />
                    )}

                    {/* Points range filter */}
                    <PointsRangeDropdown
                      value={pointsRange}
                      onChange={(range) => { setPointsRange(range); setOffset(0); }}
                      className="min-w-[100px]"
                    />

                    {/* Visibility filter */}
                    <GalleryFilterDropdown
                      value={visibilityFilter || null}
                      onChange={(v) => { setVisibilityFilter(v || ''); setOffset(0); }}
                      options={[
                        { value: 'private', label: 'Private' },
                        { value: 'link', label: 'Link Only' },
                        { value: 'public', label: 'Public' },
                      ]}
                      placeholder="All Visibility"
                      searchable={false}
                      className="min-w-[100px]"
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
          <div className="container mx-auto pt-2 px-3 max-w-7xl pb-24">
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
                <div className="inline-block p-6 bg-black/60 border border-grimlog-red/30">
                  <div className="text-grimlog-red font-mono text-sm mb-4">++ ERROR: DATA RETRIEVAL FAILED ++</div>
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
                <div className="inline-block p-6 bg-black/60 border border-grimlog-orange/30">
                  <div className="text-grimlog-orange font-mono text-sm mb-4">
                    {selectedFaction || debouncedSearch || visibilityFilter
                      ? '++ NO BRIEFS MATCH FILTERS ++'
                      : '++ ARCHIVE EMPTY ++'
                    }
                  </div>
                  <Link
                    href="/brief"
                    className="inline-block px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black text-sm font-bold uppercase transition-all"
                  >
                    Generate Your First Brief
                  </Link>
                </div>
              </div>
            )}

            {/* Brief Grid */}
            {data && data.briefs.length > 0 && !isLoading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {data.briefs.map((brief) => (
                    <BriefCard
                      key={brief.id}
                      brief={brief}
                      isSelectable={isSelectionMode}
                      isSelected={selectedIds.has(brief.id)}
                      onSelect={handleSelect}
                      onRename={handleRename}
                      showOwnerActions={true}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {data.total > limit && (
                  <div className="flex justify-center items-center gap-4 mt-8">
                    <button
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      className="px-4 py-2 bg-black/60 border border-grimlog-orange/30 text-grimlog-orange text-xs font-mono hover:border-grimlog-orange hover:shadow-[0_0_10px_rgba(255,107,0,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      &larr; PREV
                    </button>
                    <span className="text-grimlog-amber/70 text-xs font-mono">
                      [{Math.floor(offset / limit) + 1} / {Math.ceil(data.total / limit)}]
                    </span>
                    <button
                      onClick={() => setOffset(offset + limit)}
                      disabled={offset + limit >= data.total}
                      className="px-4 py-2 bg-black/60 border border-grimlog-orange/30 text-grimlog-orange text-xs font-mono hover:border-grimlog-orange hover:shadow-[0_0_10px_rgba(255,107,0,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      NEXT &rarr;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Filter Panel */}
      <MyBriefsMobileFilterPanel
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={(q) => { setSearchQuery(q); setOffset(0); }}
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
        visibilityFilter={visibilityFilter}
        onVisibilityFilterChange={(v) => { setVisibilityFilter(v); setOffset(0); }}
        activeFilterCount={activeFilterCount}
      />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        totalCount={data?.briefs.length || 0}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkVisibilityChange={handleBulkVisibilityChange}
        isLoading={bulkActionLoading}
      />
    </>
  );
}
