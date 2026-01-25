'use client';

import { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  leading?: React.ReactNode;
  description?: string;
}

interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
}: SearchableSelectProps) {
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
    const dropdownMaxHeight = 320; // max-h-80 roughly
    
    // Check if dropdown would overflow bottom of viewport
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    let top: number;
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
      // Open upward
      top = rect.top + window.scrollY - dropdownMaxHeight;
    } else {
      // Open downward (default)
      top = rect.bottom + window.scrollY + 4; // 4px gap
    }
    
    setDropdownPosition({
      top,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    updatePosition();
    searchRef.current?.focus();
    setActiveIndex(0);

    // Update position on scroll/resize
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Click outside handler - needs to account for portal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      
      // Check if click is inside trigger
      if (rootRef.current?.contains(target)) return;
      
      // Check if click is inside dropdown (portal)
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
        if (!disabled) setIsOpen(true);
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
      if (option && !option.disabled) commitSelection(option.value);
    }
  };

  const dropdownContent = isOpen && dropdownPosition && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] border border-grimlog-orange bg-grimlog-black dropdown-shadow"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
      onKeyDown={onKeyDown}
    >
      <div className="p-2 border-b border-grimlog-steel/30">
        <input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full px-3 py-2 bg-grimlog-darkGray text-white border border-grimlog-steel focus:border-grimlog-orange focus:outline-none font-mono text-sm btn-depth-sm"
        />
        <div className="flex justify-between mt-2 text-[10px] font-mono uppercase tracking-wider text-grimlog-steel">
          <button
            type="button"
            className="hover:text-grimlog-orange"
            onClick={() => commitSelection(null)}
          >
            Clear
          </button>
          <span>{filtered.length} results</span>
        </div>
      </div>

      <ul
        id={`${id}-listbox`}
        role="listbox"
        className="max-h-64 overflow-y-auto"
        aria-label="Options"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-sm text-grimlog-steel font-mono">No matches</li>
        ) : (
          filtered.map((opt, idx) => {
            const isActive = idx === activeIndex;
            const isSelected = opt.value === value;
            const isDisabled = !!opt.disabled;

            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  disabled={isDisabled}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 border-b border-grimlog-steel/20 last:border-0 ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isActive ? 'bg-grimlog-orange/10 text-grimlog-orange' : 'text-grimlog-green hover:bg-grimlog-darkGray'
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    if (isDisabled) return;
                    commitSelection(opt.value);
                  }}
                >
                  {opt.leading ? <span className="flex-shrink-0">{opt.leading}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm">{opt.label}</span>
                    {opt.description ? (
                      <span className="block text-[10px] text-grimlog-steel truncate">{opt.description}</span>
                    ) : null}
                  </span>
                  {isSelected ? <span className="text-grimlog-amber text-xs">✓</span> : null}
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
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        className={`w-full px-3 py-2 bg-grimlog-black text-grimlog-green border border-grimlog-steel focus:border-grimlog-orange focus:outline-none font-mono text-sm flex items-center justify-between gap-2 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(prev => !prev);
        }}
      >
        <span className="min-w-0 flex items-center gap-2">
          {selected?.leading ? <span className="flex-shrink-0">{selected.leading}</span> : null}
          <span className={`truncate ${selected ? 'text-grimlog-green' : 'text-grimlog-steel'}`}>
            {selected?.label || (value ? value : placeholder)}
          </span>
        </span>
        <span className="text-grimlog-orange/70 text-[10px] flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Render dropdown via portal to escape scroll containers */}
      {mounted && dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
