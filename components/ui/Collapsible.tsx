'use client';

import { useState, ReactNode } from 'react';

export type SectionColor = 'green' | 'orange' | 'amber' | 'blue' | 'cyan' | 'purple' | 'red' | 'yellow';

interface CollapsibleProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: 'orange' | 'green' | 'red' | 'amber' | 'steel';
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'featured'; // Deprecated: use color prop instead
  color?: SectionColor;
}

const BADGE_COLORS = {
  orange: 'bg-grimlog-orange text-black',
  green: 'bg-green-500 text-black',
  red: 'bg-grimlog-red text-white',
  amber: 'bg-grimlog-amber text-black',
  steel: 'bg-grimlog-steel text-white',
};

// Color configuration for section theming
const SECTION_COLORS: Record<SectionColor, {
  border: string;
  borderMuted: string;
  text: string;
  accent: string;
  accentMuted: string;
}> = {
  green: {
    border: 'border-green-500/50',
    borderMuted: 'border-green-500/30',
    text: 'text-green-400',
    accent: 'border-green-500',
    accentMuted: 'border-green-500/50',
  },
  orange: {
    border: 'border-grimlog-orange/50',
    borderMuted: 'border-grimlog-orange/30',
    text: 'text-grimlog-orange',
    accent: 'border-grimlog-orange',
    accentMuted: 'border-grimlog-orange/50',
  },
  amber: {
    border: 'border-grimlog-amber/50',
    borderMuted: 'border-grimlog-amber/30',
    text: 'text-grimlog-amber',
    accent: 'border-grimlog-amber',
    accentMuted: 'border-grimlog-amber/50',
  },
  blue: {
    border: 'border-blue-500/50',
    borderMuted: 'border-blue-500/30',
    text: 'text-blue-400',
    accent: 'border-blue-500',
    accentMuted: 'border-blue-500/50',
  },
  cyan: {
    border: 'border-cyan-500/50',
    borderMuted: 'border-cyan-500/30',
    text: 'text-cyan-400',
    accent: 'border-cyan-500',
    accentMuted: 'border-cyan-500/50',
  },
  purple: {
    border: 'border-purple-500/50',
    borderMuted: 'border-purple-500/30',
    text: 'text-purple-400',
    accent: 'border-purple-500',
    accentMuted: 'border-purple-500/50',
  },
  red: {
    border: 'border-grimlog-red/50',
    borderMuted: 'border-grimlog-red/30',
    text: 'text-grimlog-red',
    accent: 'border-grimlog-red',
    accentMuted: 'border-grimlog-red/50',
  },
  yellow: {
    border: 'border-yellow-500/50',
    borderMuted: 'border-yellow-500/30',
    text: 'text-yellow-400',
    accent: 'border-yellow-500',
    accentMuted: 'border-yellow-500/50',
  },
};

export default function Collapsible({
  title,
  icon,
  defaultOpen = false,
  badge,
  badgeColor = 'orange',
  children,
  className = '',
  variant = 'default',
  color,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Derive color from variant for backwards compatibility
  const effectiveColor: SectionColor = color || (variant === 'featured' ? 'orange' : 'green');
  const colorConfig = SECTION_COLORS[effectiveColor];

  return (
    <div className={`relative border ${colorConfig.border} bg-grimlog-black/50 overflow-hidden ${className}`}>
      {/* Corner accents */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${colorConfig.accent}`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${colorConfig.accent}`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${colorConfig.accentMuted}`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${colorConfig.accentMuted}`} />

      {/* Header - touch-friendly */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2 py-2 flex items-center justify-between text-left min-h-[48px] transition-colors bg-grimlog-darkGray/80 hover:bg-grimlog-darkGray"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className={`flex-shrink-0 leading-none text-2xl ${colorConfig.text}`}>{icon}</span>}
          <span className={`font-bold uppercase tracking-wider truncate text-sm sm:text-base ${colorConfig.text}`}>
            {title}
          </span>
          {badge !== undefined && (
            <span className={`px-2 py-0.5 text-xs font-bold rounded flex-shrink-0 ${BADGE_COLORS[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${colorConfig.text}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content with animation */}
      <div
        className={`transition-all duration-200 ease-out overflow-hidden ${
          isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-2">
          {children}
        </div>
      </div>
    </div>
  );
}
