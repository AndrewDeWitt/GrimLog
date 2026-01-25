'use client';

import type { SecondaryObjective, SecondaryProgress } from '@/lib/types';

interface SecondaryCardLargeProps {
  secondary: SecondaryObjective | null;
  progress: SecondaryProgress | null;
  player: 'attacker' | 'defender';
  onTap: () => void;
  onAdd: () => void;
}

export default function SecondaryCardLarge({
  secondary,
  progress,
  player,
  onTap,
  onAdd
}: SecondaryCardLargeProps) {
  const isAttacker = player === 'attacker';
  
  // High contrast card colors
  const borderColor = isAttacker ? 'border-grimlog-red' : 'border-grimlog-green';
  const bgColor = 'bg-gray-50'; // Light background for better text contrast
  const accentColor = isAttacker ? 'text-grimlog-red' : 'text-grimlog-green';

  // Empty state - show "Add Secondary" button
  if (!secondary) {
    return (
      <button
        onClick={onAdd}
        className={`
          flex-1 min-w-[160px] min-h-[200px] sm:min-h-[240px]
          flex flex-col items-center justify-center gap-3
          bg-gray-100 border-3 border-dashed ${borderColor}
          hover:border-grimlog-orange hover:bg-gray-50
          shadow-md
          transition-all duration-200 rounded-lg
          active:scale-95
        `}
      >
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 border-dashed ${borderColor} flex items-center justify-center`}>
          <span className={`text-4xl sm:text-5xl font-light ${accentColor}`}>+</span>
        </div>
        <span className={`text-sm sm:text-base font-bold uppercase tracking-wider ${accentColor}`}>
          Add Secondary
        </span>
      </button>
    );
  }

  // Filled state
  const currentVP = progress?.vp || 0;
  const maxVP = secondary.maxVPTotal || 20;
  const vpProgress = Math.min(currentVP / maxVP, 1);
  const isMaxed = currentVP >= maxVP;

  // Calculate stroke dasharray for the circular progress
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - vpProgress);

  return (
    <button
      onClick={onTap}
      className={`
        flex-1 min-w-[160px] min-h-[200px] sm:min-h-[240px]
        flex flex-col items-center justify-between
        ${bgColor} border-[3px] ${borderColor}
        ${isMaxed ? 'border-grimlog-amber ring-2 ring-grimlog-amber/50' : ''}
        shadow-md
        hover:shadow-lg active:scale-[0.98]
        transition-all duration-200 rounded-lg
        p-4 sm:p-5
        relative overflow-hidden
      `}
    >
      {/* Category badge - top right */}
      <div className={`
        absolute top-2 right-2
        px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold uppercase
        ${secondary.category === 'Tactical' ? 'bg-blue-600 text-white' : 'bg-amber-700 text-white'}
      `}>
        {secondary.category === 'Tactical' ? 'TAC' : 'FIX'}
      </div>

      {/* Maxed indicator */}
      {isMaxed && (
        <div className="absolute top-2 left-2 text-grimlog-amber text-lg animate-pulse">
          ⭐
        </div>
      )}

      {/* Circular VP Progress - Simplified, only show when scored */}
      {currentVP > 0 ? (
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mt-2 flex items-center justify-center">
          {/* White background circle for contrast */}
          <div className="absolute inset-0 rounded-full bg-white/95 shadow-md"></div>
          {/* VP number - high contrast dark text */}
          <span className={`relative z-10 text-4xl sm:text-5xl font-black ${isMaxed ? 'text-grimlog-amber' : 'text-gray-800'}`}>
            {currentVP}
          </span>
        </div>
      ) : (
        <div className="w-20 h-20 sm:w-24 sm:h-24 mt-2 flex items-center justify-center">
          <span className="text-3xl sm:text-4xl font-bold text-gray-400">-</span>
        </div>
      )}

      {/* Secondary name - 2 lines max, large text - high contrast */}
      <div className="flex-1 flex items-center justify-center px-1 mt-2">
        <h3 
          className="text-center font-black uppercase tracking-wide leading-tight text-base sm:text-lg text-gray-900"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {secondary.name}
        </h3>
      </div>

      {/* Turn cap indicator if applicable */}
      {secondary.maxVPPerTurn && (
        <div className="mt-2 px-2 py-1 rounded text-xs font-bold bg-gray-800 text-white">
          {secondary.maxVPPerTurn}VP/TURN
        </div>
      )}

      {/* Tap hint */}
      <div className="mt-2 text-xs uppercase tracking-wider text-gray-600 font-semibold">
        Tap to score
      </div>
    </button>
  );
}

