'use client';

import type { SecondaryObjective, SecondaryProgress } from '@/lib/types';

interface SecondaryMiniCardProps {
  secondary: SecondaryObjective | null;
  progress: SecondaryProgress | null;
  player: 'attacker' | 'defender';
  battleRound: number;
  currentTurn: 'attacker' | 'defender';
  onOpenDetail: (secondary: SecondaryObjective, player: 'attacker' | 'defender') => void;
  onAddSecondary: (player: 'attacker' | 'defender') => void;
}

export default function SecondaryMiniCard({
  secondary,
  progress,
  player,
  battleRound,
  currentTurn,
  onOpenDetail,
  onAddSecondary
}: SecondaryMiniCardProps) {
  // Grimdark colors - muted green vs red for clarity
  const textColor = player === 'attacker' ? 'text-grimlog-player-green-text' : 'text-grimlog-opponent-red-text';
  const bgColor = player === 'attacker' ? 'bg-grimlog-player-green-fill' : 'bg-grimlog-opponent-red-fill';
  const borderColor = player === 'attacker' ? 'border-grimlog-player-green' : 'border-grimlog-opponent-red';

  if (!secondary) {
    // Empty slot - fixed height to match filled cards
    return (
      <button
        onClick={() => onAddSecondary(player)}
        className="flex-1 px-1 py-1 bg-grimlog-gray border-2 border-grimlog-steel hover:border-grimlog-orange transition-all rounded flex items-center justify-center btn-depth-sm hover-lift"
        style={{ height: '48px' }}
      >
        <div className="text-xl text-white">+</div>
      </button>
    );
  }

  const currentVP = progress?.vp || 0;
  const hasScored = currentVP > 0;

  return (
    <button
      onClick={() => onOpenDetail(secondary, player)}
      className={`flex-1 px-1 py-1 transition-all rounded card-depth hover-lift ${
        hasScored 
          ? `${player === 'attacker' ? 'bg-grimlog-player-green-fill border-grimlog-player-green' : 'bg-grimlog-opponent-red-fill border-grimlog-opponent-red'} border-[3px] bg-opacity-70 hover:bg-opacity-80` 
          : `${bgColor} bg-opacity-10 border-2 ${borderColor} hover:bg-opacity-20`
      }`}
      style={{ 
        height: '48px'
      }}
    >
      <div className="flex items-center gap-2 h-full">
        {/* Mini Circle - Only show VP number, no "/20" */}
        {hasScored && (
          <div className={`relative w-8 h-8 flex-shrink-0 flex items-center justify-center`}>
            {/* Simple background circle */}
            <div 
              className="absolute inset-0 rounded-full bg-white/90"
            ></div>
            {/* VP number - high contrast */}
            <div className="relative z-10 font-black text-gray-800 text-sm">
              {currentVP}
            </div>
          </div>
        )}
        
        {/* Name - Always 2 lines high for consistency */}
        <div className="flex-1 text-left min-w-0 flex items-center" style={{height: '32px'}}>
          <div 
            className="font-bold leading-snug w-full text-gray-900"
            style={{
              fontSize: 'clamp(11px, 1.9vw, 14px)',
              lineHeight: '1.3',
              letterSpacing: '0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
          >
            {secondary.name}
          </div>
        </div>
      </div>
    </button>
  );
}
