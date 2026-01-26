'use client';

import { useState, useRef, useEffect } from 'react';

interface BriefActionsMenuProps {
  isOwner: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onShowVersionHistory: () => void;
  onShowShareModal: () => void;
  currentVersion: number;
  isEdited: boolean;
}

/**
 * BriefActionsMenu - Kebab menu (⋮) for brief actions
 *
 * Contains: Edit, History, Share
 */
export function BriefActionsMenu({
  isOwner,
  isEditMode,
  onToggleEditMode,
  onShowVersionHistory,
  onShowShareModal,
  currentVersion,
  isEdited,
}: BriefActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Ensure dropdown stays within viewport
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // If dropdown extends below viewport, position it above the button instead
      if (rect.bottom > viewportHeight - 10) {
        dropdownRef.current.style.top = 'auto';
        dropdownRef.current.style.bottom = '100%';
        dropdownRef.current.style.marginBottom = '4px';
        dropdownRef.current.style.marginTop = '0';
      }
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Kebab button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-grimlog-orange hover:text-grimlog-amber transition-colors"
        aria-label="More actions"
        title="More actions"
      >
        <svg
          className="w-6 h-6"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 min-w-[200px] bg-grimlog-black border-2 border-grimlog-steel z-50 shadow-lg shadow-black/50"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-grimlog-darkGray border-b-2 border-grimlog-steel">
            <span className="text-grimlog-orange text-xs font-bold uppercase tracking-wider">Actions</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-grimlog-steel hover:text-grimlog-orange transition-colors text-base leading-none"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          {/* Edit option - only for owners */}
          {isOwner && (
            <button
              onClick={() => handleAction(onToggleEditMode)}
              className={`
                w-full px-4 py-3 text-left text-sm font-bold uppercase tracking-wider
                flex items-center gap-3 transition-colors border-b border-grimlog-steel/50
                ${isEditMode
                  ? 'bg-grimlog-orange text-grimlog-black'
                  : 'text-grimlog-orange hover:bg-grimlog-orange/10'
                }
              `}
            >
              <span>{isEditMode ? '✓' : '✎'}</span>
              <span>{isEditMode ? 'Done Editing' : 'Edit'}</span>
            </button>
          )}

          {/* History option */}
          <button
            onClick={() => handleAction(onShowVersionHistory)}
            className="w-full px-4 py-3 text-left text-sm font-bold uppercase tracking-wider flex items-center justify-between text-grimlog-light-steel hover:text-grimlog-amber hover:bg-grimlog-amber/10 transition-colors border-b border-grimlog-steel/50"
          >
            <div className="flex items-center gap-3">
              <span>↻</span>
              <span>History</span>
            </div>
            <span className="text-grimlog-steel font-mono text-xs">
              v{currentVersion}{isEdited && '*'}
            </span>
          </button>

          {/* Share option - only for owners */}
          {isOwner && (
            <button
              onClick={() => handleAction(onShowShareModal)}
              className="w-full px-4 py-3 text-left text-sm font-bold uppercase tracking-wider flex items-center gap-3 text-grimlog-light-steel hover:text-grimlog-orange hover:bg-grimlog-orange/10 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                />
              </svg>
              <span>Share</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BriefActionsMenu;
