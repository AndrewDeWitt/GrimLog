'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GalleryFilterOption } from './GalleryFilterDropdown';

interface MobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
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
  // Active filter count for badge (excluding faction which is always visible)
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

/**
 * Mobile slide-up panel for gallery filters.
 * Clean grim dark aesthetic with inline selections.
 */
export default function MobileFilterPanel({
  isOpen,
  onClose,
  selectedFaction,
  selectedDetachment,
  onDetachmentChange,
  detachmentOptions,
  pointsRange,
  onPointsRangeChange,
  sortBy,
  onSortChange,
  activeFilterCount,
}: MobileFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
    onDetachmentChange('');
    onPointsRangeChange({ min: 0, max: 99999 });
    onSortChange('recent');
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
        className="absolute bottom-0 left-0 right-0 bg-black border-t-2 border-green-500 max-h-[80vh] flex flex-col"
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
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-green-500/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-green-400 font-mono text-sm uppercase tracking-wider font-bold">
              Filters
            </span>
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-red-500/80 hover:text-red-400 text-xs font-mono uppercase"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-green-500 hover:text-green-400 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Detachment - Inline list (only show when faction selected) */}
          {selectedFaction && detachmentOptions.length > 0 && (
            <div>
              <label className="block text-green-600 text-[10px] font-mono uppercase tracking-widest mb-2">
                Detachment
              </label>
              <div className="border border-green-500/30 bg-black/50 max-h-32 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => onDetachmentChange('')}
                  className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between border-b border-green-500/20 last:border-0 transition-colors ${
                    !selectedDetachment
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-green-600 hover:bg-green-500/10 hover:text-green-500'
                  }`}
                >
                  <span>All Detachments</span>
                  {!selectedDetachment && <span className="text-green-400">✓</span>}
                </button>
                {detachmentOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDetachmentChange(opt.value)}
                    className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between border-b border-green-500/20 last:border-0 transition-colors ${
                      selectedDetachment === opt.value
                        ? 'bg-green-500/20 text-green-400'
                        : 'text-green-600 hover:bg-green-500/10 hover:text-green-500'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selectedDetachment === opt.value && <span className="text-green-400 flex-shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Points Range - Chips */}
          <div>
            <label className="block text-green-600 text-[10px] font-mono uppercase tracking-widest mb-2">
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
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-black/40 border-green-500/30 text-green-600 hover:border-green-500/50'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort - Chips */}
          <div>
            <label className="block text-green-600 text-[10px] font-mono uppercase tracking-widest mb-2">
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
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-black/40 border-green-500/30 text-green-600 hover:border-green-500/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Apply button - Fixed */}
        <div className="relative px-4 py-3 border-t border-green-500/40 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-black font-mono font-bold uppercase tracking-wider transition-colors"
          >
            Apply
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
