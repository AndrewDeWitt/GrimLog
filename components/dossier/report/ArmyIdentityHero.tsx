'use client';

import { ViralInsights } from '@/lib/dossierAnalysis';

interface ArmyIdentityHeroProps {
  viralInsights: ViralInsights;
  spiritIconUrl: string | null;
  faction: string | null;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
}

export default function ArmyIdentityHero({
  viralInsights,
  spiritIconUrl,
  faction,
  detachment,
  totalPoints,
  unitCount,
  modelCount,
}: ArmyIdentityHeroProps) {
  return (
    <div className="relative">
      <div className="px-4 py-4 sm:px-6">
        {/* Compact horizontal layout: Icon + Details */}
        <div className="flex items-start gap-4">
          {/* Spirit Icon - compact */}
          <div className="flex-shrink-0">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24">
              {/* Corner brackets */}
              <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-grimlog-orange" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-grimlog-orange" />
              <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-grimlog-orange" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-grimlog-orange" />

              {spiritIconUrl ? (
                <img
                  src={spiritIconUrl}
                  alt={viralInsights.tagline}
                  className="w-full h-full object-contain rounded border border-grimlog-orange/50 bg-black/50 shadow-[0_0_15px_rgba(255,107,0,0.25)]"
                />
              ) : (
                <div className="w-full h-full rounded border border-grimlog-orange/50 bg-grimlog-darkGray/80 flex items-center justify-center">
                  <span className="text-3xl">⚔️</span>
                </div>
              )}
            </div>
          </div>

          {/* Army Details */}
          <div className="flex-1 min-w-0">
            {/* Tagline */}
            <h2 className="text-lg sm:text-xl font-black text-grimlog-orange tracking-wide uppercase leading-tight drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]">
              {viralInsights.tagline}
            </h2>

            {/* Faction & Detachment */}
            <p className="text-grimlog-amber text-xs sm:text-sm font-bold mt-1 tracking-wide">
              {faction || 'Unknown'} {detachment ? `• ${detachment}` : ''}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-2 mt-2 text-[10px] sm:text-xs flex-wrap">
              <span className="px-2 py-1 bg-grimlog-orange/20 border border-grimlog-orange/50 text-grimlog-orange font-mono font-bold">
                {totalPoints} PTS
              </span>
              <span className="px-2 py-1 bg-grimlog-darkGray border border-grimlog-steel/40 text-grimlog-steel font-mono">
                {unitCount} UNITS
              </span>
              <span className="px-2 py-1 bg-grimlog-darkGray border border-grimlog-steel/40 text-grimlog-steel font-mono">
                {modelCount} MODELS
              </span>
            </div>

            {/* Spirit Description - truncated */}
            <p className="text-grimlog-steel text-xs italic mt-2 leading-relaxed line-clamp-2">
              &ldquo;{viralInsights.spiritDescription}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
