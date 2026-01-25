'use client';

import { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import FactionIconImage from './FactionIconImage';

export interface GalleryFilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  iconUrl?: string;
  factionName?: string; // For FactionIconImage fallback
}

interface GalleryFilterDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: GalleryFilterOption[];
  placeholder: string;
  searchable?: boolean;
  className?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Icon-rich dropdown styled for the gallery's green terminal theme.
 * Supports custom icons, faction icons, and searchable options.
 */
export default function GalleryFilterDropdown({
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
  className = '',
}: GalleryFilterDropdownProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Client-side only mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = useMemo(
    () => options.find(o => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Calculate dropdown position relative to trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownMaxHeight = 280;

    // Check if dropdown would overflow bottom of viewport
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
      // Open upward
      top = rect.top + window.scrollY - dropdownMaxHeight;
    } else {
      // Open downward (default)
      top = rect.bottom + window.scrollY + 4;
    }

    setDropdownPosition({
      top,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 200), // Minimum 200px width
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    if (searchable) {
      searchRef.current?.focus();
    }
    setActiveIndex(0);

    // Update position on scroll/resize
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition, searchable]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const commitSelection = (next: string | null) => {
    onChange(next);
    setIsOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) commitSelection(option.value);
    }
  };

  const renderIcon = (option: GalleryFilterOption) => {
    if (option.icon) {
      return <span className="flex-shrink-0">{option.icon}</span>;
    }
    if (option.iconUrl || option.factionName) {
      return (
        <FactionIconImage
          factionName={option.factionName || option.label}
          iconUrl={option.iconUrl}
          className="w-4 h-4"
        />
      );
    }
    return null;
  };

  const dropdownContent = isOpen && dropdownPosition && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] border border-green-500/50 bg-black/95 backdrop-blur-sm shadow-[0_0_20px_rgba(34,197,94,0.15)]"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
      onKeyDown={onKeyDown}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-500" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-500" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-500" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-500" />

      {/* Search input */}
      {searchable && options.length > 5 && (
        <div className="p-2 border-b border-green-500/30">
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full px-2 py-1.5 bg-black/60 text-green-400 border border-green-500/30 font-mono text-xs focus:outline-none focus:border-green-400 placeholder-green-700"
          />
        </div>
      )}

      {/* Clear/results row */}
      <div className="flex justify-between px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-green-600 border-b border-green-500/20">
        <button
          type="button"
          className="hover:text-green-400 transition-colors"
          onClick={() => commitSelection(null)}
        >
          Clear
        </button>
        <span>{filtered.length} results</span>
      </div>

      {/* Options list */}
      <ul
        id={`${id}-listbox`}
        role="listbox"
        className="max-h-56 overflow-y-auto"
        aria-label="Options"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-xs text-green-700 font-mono">No matches</li>
        ) : (
          filtered.map((opt, idx) => {
            const isActive = idx === activeIndex;
            const isSelected = opt.value === value;

            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 border-b border-green-500/10 last:border-0 transition-colors ${
                    isActive
                      ? 'bg-green-500/15 text-green-300'
                      : 'text-green-400 hover:bg-green-500/10'
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commitSelection(opt.value)}
                >
                  {renderIcon(opt)}
                  <span className="flex-1 truncate font-mono text-xs">{opt.label}</span>
                  {isSelected && <span className="text-green-300 text-xs">&#10003;</span>}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        className={`w-full px-3 py-1.5 bg-black/50 border text-xs font-mono flex items-center justify-between gap-2 transition-all cursor-pointer min-w-[100px] ${
          isOpen
            ? 'border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
            : 'border-green-500/30 hover:border-green-500/50'
        }`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected && renderIcon(selected)}
          <span className={`truncate ${selected ? 'text-green-400' : 'text-green-600'}`}>
            {selected?.label || placeholder}
          </span>
        </span>
        <span className="text-green-500/70 text-[10px] flex-shrink-0">
          {isOpen ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {/* Render dropdown via portal to escape scroll containers */}
      {mounted && dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
