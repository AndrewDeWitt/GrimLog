'use client';

import { GamePhase } from '@/lib/types';

interface PhaseDisplayProps {
  currentPhase: GamePhase;
  battleRound: number;
  currentTurn?: 'attacker' | 'defender';
  firstPlayer?: 'attacker' | 'defender';
}

// Muted grimdark phase colors for better readability
const phaseColors: Record<GamePhase, string> = {
  'Command': 'from-slate-900 to-slate-800',
  'Movement': 'from-emerald-950 to-emerald-900',
  'Shooting': 'from-rose-950 to-rose-900',
  'Charge': 'from-amber-950 to-amber-900',
  'Fight': 'from-violet-950 to-violet-900',
};

export default function PhaseDisplay({ currentPhase, battleRound, currentTurn, firstPlayer }: PhaseDisplayProps) {
  // Determine turn display info using attacker/defender terminology
  const showTurnInfo = currentTurn !== undefined;
  const isAttacker = firstPlayer && currentTurn ? (currentTurn === firstPlayer) : true;
  const turnColor = currentTurn === 'attacker' ? 'text-grimlog-green' : 'text-grimlog-orange';
  const turnText = isAttacker ? 'ATTACKER' : 'DEFENDER';
  const turnPosition = firstPlayer && currentTurn ? (currentTurn === firstPlayer ? '1st' : '2nd') : '';

  return (
    <section 
      className="flex flex-col items-center justify-center gap-6 md:gap-8 p-4 md:p-8 relative w-full max-w-4xl"
      aria-label="Current game phase"
    >
      {/* Subtle scanline effect */}
      <div className="absolute inset-0 scanline pointer-events-none" aria-hidden="true"></div>

      {/* Battle Round */}
      <div 
        className="text-center"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="text-grimlog-light-steel text-base md:text-lg font-mono tracking-wider uppercase">
          <span className="text-grimlog-light-steel">Battle Round</span>
          <span className="ml-2 text-3xl md:text-4xl text-grimlog-orange glow-orange font-bold">
            {battleRound}
          </span>
        </p>
        {showTurnInfo && (
          <p className={`mt-2 text-sm md:text-base font-bold tracking-wider ${turnColor}`}>
            {turnText} {turnPosition && `(${turnPosition} turn)`}
          </p>
        )}
      </div>

      {/* Phase Display */}
      <div className="relative w-full">
        {/* Corner brackets - decorative only */}
        <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-grimlog-orange opacity-50" aria-hidden="true"></div>
        <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-grimlog-orange opacity-50" aria-hidden="true"></div>
        <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-grimlog-orange opacity-50" aria-hidden="true"></div>
        <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-grimlog-orange opacity-50" aria-hidden="true"></div>

        {/* Main phase container */}
        <div className={`
          relative px-8 py-10 md:px-16 md:py-16 
          bg-gradient-to-br ${phaseColors[currentPhase]}
          border-2 border-grimlog-orange
          shadow-2xl
        `}>
          <div className="absolute inset-0 bg-grimlog-black opacity-50"></div>
          <h1 
            className="relative text-5xl md:text-7xl lg:text-8xl font-bold text-center text-grimlog-orange glow-orange tracking-widest uppercase"
            aria-live="assertive"
            aria-atomic="true"
          >
            {currentPhase}
          </h1>
          <p className="relative text-center text-grimlog-light-steel text-base md:text-lg mt-3 tracking-widest font-mono">
            [ PHASE ACTIVE ]
          </p>
        </div>

        {/* Status indicators - less distracting */}
        <div className="absolute -top-1 -left-1 w-2 h-2 bg-grimlog-orange opacity-75" aria-hidden="true"></div>
        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-grimlog-orange opacity-75" aria-hidden="true"></div>
      </div>

      {/* Status text */}
      <div className="text-grimlog-green text-xs md:text-sm font-mono tracking-wider opacity-70" aria-hidden="true">
        &lt;!-- SYSTEM OPERATIONAL --&gt;
      </div>
    </section>
  );
}
