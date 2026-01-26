'use client';

interface BriefHeroProps {
  onAnalyzeClick: () => void;
  onPreviewClick: () => void;
  isAuthenticated: boolean;
}

export function BriefHero({ onAnalyzeClick, onPreviewClick, isAuthenticated }: BriefHeroProps) {
  return (
    <section className="relative pt-14 sm:pt-16 pb-6 sm:pb-8 bg-grimlog-black overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.04)_0%,transparent_50%)]" />
      
      {/* Content */}
      <div className="relative container mx-auto px-3 sm:px-4">
        {/* Free Generations Banner - Terminal/Cogitator green style */}
        <div className="flex justify-center">
          <div className="relative group w-full max-w-sm sm:max-w-none sm:w-auto">
            {/* Glow effect behind */}
            <div className="absolute -inset-1 bg-green-500/5 blur-md" />
            
            {/* Corner accents - responsive size */}
            <div className="absolute -top-0.5 -left-0.5 sm:-top-1 sm:-left-1 w-3 h-3 sm:w-4 sm:h-4 border-t-2 border-l-2 border-green-500" />
            <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 border-t-2 border-r-2 border-green-500" />
            <div className="absolute -bottom-0.5 -left-0.5 sm:-bottom-1 sm:-left-1 w-3 h-3 sm:w-4 sm:h-4 border-b-2 border-l-2 border-green-500" />
            <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 border-b-2 border-r-2 border-green-500" />
            
            {/* Main banner */}
            <div className="relative px-4 py-3 sm:px-6 sm:py-4 bg-black/80 border border-green-500/40">
              {/* Scanline overlay for CRT effect */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)] pointer-events-none" />
              
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
                {/* Icon - hidden on mobile */}
                <div className="hidden md:flex w-12 h-12 items-center justify-center border border-green-500/50 bg-green-500/5 flex-shrink-0">
                  <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4" />
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
                
                <div className="text-center sm:text-left">
                  <div className="text-green-400 font-black text-lg sm:text-xl md:text-2xl uppercase tracking-wider sm:tracking-[0.15em] drop-shadow-[0_0_5px_rgba(34,197,94,0.2)]">
                    2 Free Analyses
                  </div>
                  <div className="text-green-600 text-[10px] sm:text-xs font-mono tracking-wide sm:tracking-wider mt-0.5">
                    ++ TACTICAL SUBSIDY ++ NO SURCHARGE ++
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={onAnalyzeClick}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-emerald-700 hover:bg-emerald-600 text-emerald-100 font-bold text-xs sm:text-sm uppercase tracking-wider border border-emerald-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tagline */}
      </div>
    </section>
  );
}

export default BriefHero;
