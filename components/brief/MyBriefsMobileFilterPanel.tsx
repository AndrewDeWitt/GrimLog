'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GalleryFilterOption } from '@/components/gallery/GalleryFilterDropdown';

interface MyBriefsMobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Faction (to determine if detachment should show)
  selectedFaction: string;
  // Detachment filter
  selectedDetachment: string;
  onDetachmentChange: (detachment: string) => void;
  detachmentOptions: GalleryFilterOption[];
  // Points filter
  pointsRange: { min: number; max: number };
  onPointsRangeChange: (range: { min: number; max: number }) => void;
  // Sort
  sortBy: string;
  onSortChange: (sort: string) => void;
  // Visibility filter (unique to My Briefs)
  visibilityFilter: string;
  onVisibilityFilterChange: (visibility: string) => void;
  // Active filter count for badge
  activeFilterCount: number;
}

const POINTS_RANGES = [
  { label: 'All', value: '', min: 0, max: 99999 },
  { label: '1000', value: '1000', min: 0, max: 1000 },
  { label: '1500', value: '1500', min: 0, max: 1500 },
  { label: '2000', value: '2000', min: 0, max: 2000 },
];

const SORT_OPTIONS = [
  { label: 'Newest', value: 'recent' },
  { label: 'Popular', value: 'popular' },
  { label: 'Oldest', value: 'oldest' },
];

const VISIBILITY_OPTIONS = [
  { label: 'All', value: '', icon: null },
  { label: 'Private', value: 'private', icon: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Link', value: 'link', icon: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Public', value: 'public', icon: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
    </svg>
  )},
];

/**
 * Mobile slide-up panel for My Briefs filters.
 * Extends the base MobileFilterPanel with search and visibility filter.
 */
export default function MyBriefsMobileFilterPanel({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  selectedFaction,
  selectedDetachment,
  onDetachmentChange,
  detachmentOptions,
  pointsRange,
  onPointsRangeChange,
  sortBy,
  onSortChange,
  visibilityFilter,
  onVisibilityFilterChange,
  activeFilterCount,
}: MyBriefsMobileFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClearAll = () => {
    onSearchChange('');
    onDetachmentChange('');
    onPointsRangeChange({ min: 0, max: 99999 });
    onSortChange('recent');
    onVisibilityFilterChange('');
  };

  // Find current points range value
  const currentPointsValue = POINTS_RANGES.find(
    r => r.min === pointsRange.min && r.max === pointsRange.max
  )?.value || '';

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute bottom-0 left-0 right-0 bg-black border-t-2 border-grimlog-orange max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* Scanline effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.8) 2px, rgba(0, 0, 0, 0.8) 4px)',
          }}
        />

        {/* Header - Fixed */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-grimlog-orange/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-grimlog-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-grimlog-orange font-mono text-sm uppercase tracking-wider font-bold">
              Filters
            </span>
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-grimlog-red/80 hover:text-grimlog-red text-xs font-mono uppercase"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-grimlog-orange hover:text-grimlog-amber p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Search Input */}
          <div>
            <label className="block text-grimlog-amber text-[10px] font-mono uppercase tracking-widest mb-2">
              Search
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name or tagline..."
                className="w-full bg-black/60 border border-grimlog-orange/30 text-grimlog-green px-3 py-2 pl-9 text-sm font-mono focus:outline-none focus:border-grimlog-orange placeholder:text-grimlog-steel/50"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grimlog-steel" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-grimlog-steel hover:text-grimlog-orange"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Visibility Filter - Chips */}
          <div>
            <label className="block text-grimlog-amber text-[10px] font-mono uppercase tracking-widest mb-2">
              Visibility
            </label>
            <div className="flex flex-wrap gap-1.5">
              {VISIBILITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onVisibilityFilterChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-all flex items-center gap-1.5 ${
                    visibilityFilter === opt.value
                      ? 'bg-grimlog-orange/20 border-grimlog-orange text-grimlog-orange'
                      : 'bg-black/40 border-grimlog-orange/30 text-grimlog-amber hover:border-grimlog-orange/50'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detachment - Inline list (only show when faction selected) */}
          {selectedFaction && detachmentOptions.length > 0 && (
            <div>
              <label className="block text-grimlog-amber text-[10px] font-mono uppercase tracking-widest mb-2">
                Detachment
              </label>
              <div className="border border-grimlog-orange/30 bg-black/50 max-h-32 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => onDetachmentChange('')}
                  className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between border-b border-grimlog-orange/20 last:border-0 transition-colors ${
                    !selectedDetachment
                      ? 'bg-grimlog-orange/20 text-grimlog-orange'
                      : 'text-grimlog-amber hover:bg-grimlog-orange/10 hover:text-grimlog-orange'
                  }`}
                >
                  <span>All Detachments</span>
                  {!selectedDetachment && <span className="text-grimlog-orange">OK</span>}
                </button>
                {detachmentOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDetachmentChange(opt.value)}
                    className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between border-b border-grimlog-orange/20 last:border-0 transition-colors ${
                      selectedDetachment === opt.value
                        ? 'bg-grimlog-orange/20 text-grimlog-orange'
                        : 'text-grimlog-amber hover:bg-grimlog-orange/10 hover:text-grimlog-orange'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selectedDetachment === opt.value && <span className="text-grimlog-orange flex-shrink-0">OK</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Points Range - Chips */}
          <div>
            <label className="block text-grimlog-amber text-[10px] font-mono uppercase tracking-widest mb-2">
              Points
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POINTS_RANGES.map(range => (
                <button
                  key={range.value}
                  type="button"
                  onClick={() => onPointsRangeChange({ min: range.min, max: range.max })}
                  className={`px-3 py-1.5 text-xs font-mono border transition-all ${
                    currentPointsValue === range.value
                      ? 'bg-grimlog-orange/20 border-grimlog-orange text-grimlog-orange'
                      : 'bg-black/40 border-grimlog-orange/30 text-grimlog-amber hover:border-grimlog-orange/50'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort - Chips */}
          <div>
            <label className="block text-grimlog-amber text-[10px] font-mono uppercase tracking-widest mb-2">
              Sort By
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSortChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-all ${
                    sortBy === opt.value
                      ? 'bg-grimlog-orange/20 border-grimlog-orange text-grimlog-orange'
                      : 'bg-black/40 border-grimlog-orange/30 text-grimlog-amber hover:border-grimlog-orange/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Apply button - Fixed */}
        <div className="relative px-4 py-3 border-t border-grimlog-orange/40 flex-shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-grimlog-orange hover:bg-grimlog-amber text-black font-mono font-bold uppercase tracking-wider transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
