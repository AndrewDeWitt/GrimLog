'use client';

import { useState, useRef, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

interface EditableSelectProps {
  value: string;
  onChange: (value: string) => void;
  isEditMode: boolean;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

/**
 * EditableSelect - Dropdown select for enum fields
 *
 * In view mode: displays the selected option's label (with icon if present)
 * In edit mode: shows a dropdown to select from available options
 */
export function EditableSelect({
  value,
  onChange,
  isEditMode,
  options,
  placeholder = 'Select...',
  className = '',
}: EditableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isEditMode) {
    // View mode - just display selected option
    if (!selectedOption) {
      return <span className={`text-grimlog-steel italic ${className}`}>{placeholder}</span>;
    }

    return (
      <span className={`${selectedOption.color || ''} ${className}`}>
        {selectedOption.icon && <span className="mr-1">{selectedOption.icon}</span>}
        {selectedOption.label}
      </span>
    );
  }

  // Edit mode - show dropdown
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2
          bg-grimlog-black/50 border border-grimlog-orange/50
          text-left text-sm
          hover:border-grimlog-orange/70 focus:outline-none focus:border-grimlog-orange
          transition-colors
        `}
      >
        <span className={selectedOption?.color || 'text-grimlog-green'}>
          {selectedOption?.icon && <span className="mr-1">{selectedOption.icon}</span>}
          {selectedOption?.label || <span className="text-grimlog-steel/50">{placeholder}</span>}
        </span>
        <span className="text-grimlog-steel text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-max bg-grimlog-darkGray border border-grimlog-steel shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap
                hover:bg-grimlog-orange/20 transition-colors
                ${option.value === value ? 'bg-grimlog-orange/10 border-l-2 border-grimlog-orange' : ''}
                ${option.color || 'text-grimlog-light-steel'}
              `}
            >
              {option.icon && <span>{option.icon}</span>}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default EditableSelect;
