'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkVisibilityChange: (visibility: 'private' | 'link' | 'public') => void;
  isLoading: boolean;
}

export default function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  onBulkVisibilityChange,
  isLoading,
}: BulkActionsToolbarProps) {
  const [visibilityDropdownOpen, setVisibilityDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setVisibilityDropdownOpen(false);
      }
    };

    if (visibilityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visibilityDropdownOpen]);

  if (!mounted || selectedCount === 0) return null;

  const toolbarContent = (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ${
        selectedCount > 0 ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-green-500/10 blur-lg" />

      {/* Main toolbar */}
      <div className="relative bg-black/95 border-t border-green-500/40 backdrop-blur-sm">
        {/* Scanline overlay */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.4)_2px,rgba(0,0,0,0.4)_4px)] pointer-events-none" />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-green-500" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-green-500" />

        <div className="relative px-4 py-3">
          <div className="container mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <span className="text-green-400 font-mono text-sm">
                <span className="font-bold">{selectedCount}</span>
                <span className="text-green-600"> of </span>
                <span className="font-bold">{totalCount}</span>
                <span className="text-green-600"> selected</span>
              </span>

              {/* Select All / Clear buttons */}
              <div className="flex gap-2">
                {selectedCount < totalCount && (
                  <button
                    onClick={onSelectAll}
                    disabled={isLoading}
                    className="px-2 py-1 text-[10px] font-mono text-green-400 border border-green-500/30 hover:border-green-500/60 hover:bg-green-500/10 disabled:opacity-50 transition-all uppercase tracking-wider"
                  >
                    Select All
                  </button>
                )}
                <button
                  onClick={onClearSelection}
                  disabled={isLoading}
                  className="px-2 py-1 text-[10px] font-mono text-grimlog-steel border border-grimlog-steel/30 hover:border-grimlog-steel/60 hover:bg-grimlog-steel/10 disabled:opacity-50 transition-all uppercase tracking-wider"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Visibility dropdown */}
              <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={() => setVisibilityDropdownOpen(!visibilityDropdownOpen)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-mono text-grimlog-amber border border-grimlog-amber/40 hover:border-grimlog-amber/70 hover:bg-grimlog-amber/10 disabled:opacity-50 transition-all uppercase tracking-wider flex items-center gap-1.5"
                >
                  {isLoading ? (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4m-8-10h4m12 0h4" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  Visibility
                  <svg className={`w-3 h-3 transition-transform ${visibilityDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {visibilityDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute bottom-full mb-1 right-0 w-36 bg-black/95 border border-grimlog-amber/30 shadow-xl"
                  >
                    <button
                      onClick={() => { onBulkVisibilityChange('private'); setVisibilityDropdownOpen(false); }}
                      className="w-full px-3 py-2 text-left text-xs font-mono text-grimlog-steel hover:bg-grimlog-amber/10 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Private
                    </button>
                    <button
                      onClick={() => { onBulkVisibilityChange('link'); setVisibilityDropdownOpen(false); }}
                      className="w-full px-3 py-2 text-left text-xs font-mono text-grimlog-amber hover:bg-grimlog-amber/10 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                      </svg>
                      Link Only
                    </button>
                    <button
                      onClick={() => { onBulkVisibilityChange('public'); setVisibilityDropdownOpen(false); }}
                      className="w-full px-3 py-2 text-left text-xs font-mono text-green-400 hover:bg-grimlog-amber/10 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                      </svg>
                      Public
                    </button>
                  </div>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={onBulkDelete}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-mono text-grimlog-red border border-grimlog-red/40 hover:border-grimlog-red/70 hover:bg-grimlog-red/10 disabled:opacity-50 transition-all uppercase tracking-wider flex items-center gap-1.5"
              >
                {isLoading ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-8-10h4m12 0h4" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(toolbarContent, document.body);
}
