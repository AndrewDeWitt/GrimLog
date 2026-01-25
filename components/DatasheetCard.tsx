'use client';

import Link from 'next/link';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';

interface DatasheetCardProps {
  id: string;
  name: string;
  faction: string;
  subfaction?: string | null;
  role: string;
  keywords: string[];
  movement: string;
  toughness: number;
  save: string;
  wounds: number;
  leadership: number;
  objectiveControl: number;
  pointsCost: number;
  composition?: string;
  iconUrl?: string | null;
  onClick?: () => void;
  showAddButton?: boolean;
  onAdd?: () => void;
}

export default function DatasheetCard({
  id,
  name,
  faction,
  subfaction,
  role,
  keywords,
  movement,
  toughness,
  save,
  wounds,
  leadership,
  objectiveControl,
  pointsCost,
  composition,
  iconUrl,
  onClick,
  showAddButton,
  onAdd,
}: DatasheetCardProps) {
  // Get icon (custom URL or fallback emoji)
  const icon = getUnitIcon(iconUrl, name, role);
  const hasCustomIcon = isCustomIcon(icon);

  // Role-based accent colors
  const getRoleColor = (role: string) => {
    const lower = role.toLowerCase();
    if (lower === 'character') return 'border-l-grimlog-amber';
    if (lower === 'battleline') return 'border-l-blue-500';
    if (lower === 'dedicated transport') return 'border-l-purple-500';
    if (lower === 'heavy support') return 'border-l-red-500';
    if (lower === 'fast attack') return 'border-l-cyan-500';
    if (lower === 'elites') return 'border-l-green-500';
    return 'border-l-grimlog-steel';
  };

  const roleColor = getRoleColor(role);

  // Filter for important keywords only
  const importantKeywords = keywords.filter(kw => 
    ['INFANTRY', 'MONSTER', 'VEHICLE', 'CHARACTER', 'PSYKER', 'FLY', 'LEADER', 'BATTLELINE', 'TRANSPORT'].includes(kw.toUpperCase())
  ).slice(0, 4);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd?.();
  };

  const cardContent = (
    <div
      className={`
        bg-grimlog-gray border-2 border-grimlog-steel border-l-4 ${roleColor}
        hover:border-grimlog-orange transition-all cursor-pointer
        group relative
      `}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="p-3 border-b border-grimlog-steel bg-grimlog-darkGray">
        <div className="flex justify-between items-start gap-2">
          {/* Icon */}
          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-grimlog-black border border-grimlog-steel rounded">
            {hasCustomIcon ? (
              <img src={icon} alt="" className="w-full h-full object-cover rounded" />
            ) : (
              <span className="text-xl" aria-hidden="true">{icon}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-grimlog-orange tracking-wide truncate group-hover:text-orange-400">
              {name}
            </h3>
            <p className="text-xs text-grimlog-light-steel font-mono mt-0.5">
              {role}
              {subfaction && <span className="text-grimlog-steel"> • {subfaction}</span>}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-lg font-bold text-grimlog-green font-mono">
              {pointsCost}
            </div>
            <div className="text-xs text-grimlog-light-steel">PTS</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-3">
        <div className="grid grid-cols-6 gap-1 mb-3">
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">M</div>
            <div className="text-sm font-bold text-white">{movement}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">T</div>
            <div className="text-sm font-bold text-white">{toughness}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">SV</div>
            <div className="text-sm font-bold text-white">{save}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">W</div>
            <div className="text-sm font-bold text-white">{wounds}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">LD</div>
            <div className="text-sm font-bold text-white">{leadership}+</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">OC</div>
            <div className="text-sm font-bold text-white">{objectiveControl}</div>
          </div>
        </div>

        {/* Keywords */}
        {importantKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {importantKeywords.map((kw, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-grimlog-black border border-grimlog-steel text-grimlog-light-steel text-xs font-mono"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add Button Overlay */}
      {showAddButton && onAdd && (
        <div className="absolute inset-0 bg-grimlog-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={handleAddClick}
            className="px-4 py-2 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold text-sm tracking-wider transition-colors"
          >
            + ADD UNIT
          </button>
        </div>
      )}
    </div>
  );

  // If onClick is provided, don't wrap in Link
  if (onClick) {
    return cardContent;
  }

  // Default: wrap in Link to detail page
  return (
    <Link href={`/datasheets/${id}`}>
      {cardContent}
    </Link>
  );
}
