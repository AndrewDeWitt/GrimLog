'use client';

import { useState } from 'react';
import Link from 'next/link';

// Archetype config matching the public gallery
const ARCHETYPE_CONFIG: Record<string, { color: string; borderColor: string; icon: string }> = {
  horde: { color: 'text-green-400', borderColor: 'border-green-500/60', icon: '' },
  elite: { color: 'text-purple-400', borderColor: 'border-purple-500/60', icon: '' },
  balanced: { color: 'text-blue-400', borderColor: 'border-blue-500/60', icon: '' },
  skew: { color: 'text-orange-400', borderColor: 'border-orange-500/60', icon: '' },
  castle: { color: 'text-gray-400', borderColor: 'border-gray-500/60', icon: '' },
  alpha_strike: { color: 'text-red-400', borderColor: 'border-red-500/60', icon: '' },
  attrition: { color: 'text-amber-400', borderColor: 'border-amber-500/60', icon: '' },
};

export interface BriefSummary {
  id: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  visibility: 'private' | 'link' | 'public';
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
  tagline: string | null;
  archetype: string | null;
}

interface BriefCardProps {
  brief: BriefSummary;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
  showOwnerActions?: boolean;
}

export default function BriefCard({
  brief,
  isSelectable = false,
  isSelected = false,
  onSelect,
  onRename,
  showOwnerActions = false,
}: BriefCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(brief.listName || '');
  const [isSaving, setIsSaving] = useState(false);

  const isPrivate = brief.visibility === 'private';
  const archetypeConfig = brief.archetype ? ARCHETYPE_CONFIG[brief.archetype] : null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSaveRename = async () => {
    if (!onRename) return;
    const trimmedName = editName.trim();
    if (trimmedName === (brief.listName || '')) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onRename(brief.id, trimmedName);
      setIsEditing(false);
    } catch {
      // Keep editing open on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditName(brief.listName || '');
      setIsEditing(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If selectable and clicking the card (not a link/input), toggle selection
    if (isSelectable && onSelect) {
      const target = e.target as HTMLElement;
      // Don't toggle if clicking on input or links
      if (target.tagName !== 'INPUT' && target.tagName !== 'A' && !target.closest('a')) {
        e.preventDefault();
        onSelect(brief.id);
      }
    }
  };

  const getVisibilityBadge = () => {
    switch (brief.visibility) {
      case 'public':
        return (
          <div className="flex items-center gap-1 text-[9px] font-mono text-green-400">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
            </svg>
            PUBLIC
          </div>
        );
      case 'link':
        return (
          <div className="flex items-center gap-1 text-[9px] font-mono text-grimlog-amber">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
            </svg>
            LINK
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-[9px] font-mono text-grimlog-steel">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            PRIVATE
          </div>
        );
    }
  };

  // Determine border color: selected > private > archetype > default
  const borderColorClass = isSelected
    ? 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
    : isPrivate
      ? 'border-grimlog-steel/40'
      : archetypeConfig?.borderColor || 'border-grimlog-steel/40';

  const CardWrapper = isSelectable ? 'div' : Link;
  const cardProps = isSelectable
    ? { onClick: handleCardClick, className: 'cursor-pointer' }
    : { href: `/brief/${brief.id}` };

  return (
    <CardWrapper
      {...(cardProps as any)}
      className={`group relative bg-grimlog-darkGray/80 border overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-grimlog-orange/20 ${borderColorClass} hover:border-grimlog-orange ${
        isPrivate ? 'opacity-80' : ''
      } ${isSelectable ? 'cursor-pointer' : ''}`}
    >
      {/* Selection checkbox overlay */}
      {isSelectable && (
        <div
          className={`absolute top-2 left-2 z-20 w-5 h-5 border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-green-500 border-green-500'
              : 'bg-black/60 border-grimlog-steel/60 group-hover:border-green-500/60'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(brief.id);
          }}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}

      {/* Spirit Icon - Hero Element */}
      <div className={`relative aspect-square overflow-hidden bg-gradient-to-br from-grimlog-black to-grimlog-darkGray ${isPrivate ? 'grayscale-[30%]' : ''}`}>
        {brief.spiritIconUrl ? (
          <img
            src={brief.spiritIconUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl sm:text-6xl text-grimlog-steel/30">

          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Private lock overlay */}
        {isPrivate && (
          <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-grimlog-steel flex items-center gap-1 font-mono z-10">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* View count badge */}
        {brief.viewCount > 0 && (
          <div className={`absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-white/70 flex items-center gap-1 font-mono ${isSelectable ? '' : ''}`}>
            <span className="opacity-60">
              <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span>{brief.viewCount}</span>
          </div>
        )}

        {/* Points badge */}
        <div className="absolute top-2 left-2 bg-grimlog-orange/90 backdrop-blur-sm px-2 py-0.5 text-xs font-mono font-bold text-black z-10" style={{ left: isPrivate || isSelectable ? '2.5rem' : '0.5rem' }}>
          {brief.totalPoints}
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {/* Visibility badge for owner view */}
          {showOwnerActions && (
            <div className="mb-1.5">
              {getVisibilityBadge()}
            </div>
          )}

          {/* Archetype badge */}
          {archetypeConfig && !showOwnerActions && (
            <div className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium mb-1.5 ${archetypeConfig.color}`}>
              <span>{archetypeConfig.icon}</span>
              <span className="capitalize">{brief.archetype?.replace('_', ' ')}</span>
            </div>
          )}

          {/* Title - editable if onRename provided */}
          {isEditing && showOwnerActions ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveRename}
                autoFocus
                disabled={isSaving}
                className="w-full bg-black/80 border border-green-500/50 text-white text-sm sm:text-base px-2 py-1 font-bold focus:outline-none focus:border-green-500"
                placeholder={brief.faction}
              />
              {isSaving && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-green-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-8-10h4m12 0h4" />
                  </svg>
                </div>
              )}
            </div>
          ) : (
            <h3
              className={`text-white font-bold text-sm sm:text-base leading-tight line-clamp-2 transition-colors ${
                showOwnerActions && onRename ? 'cursor-text hover:text-green-400' : 'group-hover:text-grimlog-amber'
              }`}
              onClick={(e) => {
                if (showOwnerActions && onRename) {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditName(brief.listName || '');
                  setIsEditing(true);
                }
              }}
            >
              {brief.listName || brief.faction}
            </h3>
          )}
        </div>
      </div>

      {/* Tagline + Date footer */}
      <div className="p-2.5 bg-black/40 border-t border-white/5">
        {brief.tagline ? (
          <p className="text-grimlog-amber/90 text-xs leading-snug line-clamp-2 mb-1">
            &ldquo;{brief.tagline}&rdquo;
          </p>
        ) : (
          <p className="text-grimlog-steel/60 text-xs mb-1">{brief.faction}</p>
        )}
        <div className="flex justify-between items-center">
          <p className="text-grimlog-steel/50 text-[10px] font-mono">
            {brief.unitCount} units
          </p>
          <p className="text-grimlog-steel/50 text-[10px] font-mono">
            {formatDate(brief.createdAt)}
          </p>
        </div>
      </div>

      {/* View link when selectable */}
      {isSelectable && (
        <Link
          href={`/brief/${brief.id}`}
          className="absolute bottom-12 right-2 z-20 bg-grimlog-orange/90 hover:bg-grimlog-orange text-black text-[10px] font-bold px-2 py-1 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </Link>
      )}
    </CardWrapper>
  );
}
