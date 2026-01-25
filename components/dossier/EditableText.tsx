'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  isEditMode: boolean;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
}

/**
 * EditableText - Inline text editing component
 *
 * In view mode: displays text normally
 * In edit mode: shows input/textarea with visual indication
 */
export function EditableText({
  value,
  onChange,
  isEditMode,
  multiline = false,
  placeholder = 'Enter text...',
  maxLength,
  className = '',
  inputClassName = '',
}: EditableTextProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync local value when prop changes (e.g., from restore)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    if (multiline && inputRef.current && isEditMode) {
      const textarea = inputRef.current as HTMLTextAreaElement;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [localValue, multiline, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  if (!isEditMode) {
    // View mode - just display text
    return (
      <span className={className}>
        {value || <span className="text-grimlog-steel italic">{placeholder}</span>}
      </span>
    );
  }

  // Edit mode - show input
  const baseInputClasses = `
    w-full bg-grimlog-black/50 border border-grimlog-orange/50
    text-grimlog-green p-2 font-mono text-sm
    focus:outline-none focus:border-grimlog-orange
    hover:border-grimlog-orange/70 transition-colors
    placeholder:text-grimlog-steel/50
    ${inputClassName}
  `;

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
        className={`${baseInputClasses} resize-none min-h-[60px] ${className}`}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`${baseInputClasses} ${className}`}
    />
  );
}

export default EditableText;
