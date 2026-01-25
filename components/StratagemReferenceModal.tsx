'use client';

import { useState, useEffect } from 'react';

interface Stratagem {
  id: string;
  name: string;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
  triggerPhase: string[];
  isReactive: boolean;
  source: 'core' | 'faction';
  faction?: string;
  detachment?: string;
  availableNow: boolean;
}

interface StratagemReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhase: string;
  currentTurn: 'attacker' | 'defender';
  player: 'attacker' | 'defender';
  playerCP: number;
  // Pre-computed stratagem data (from parent)
  coreStratagems: Stratagem[];
  factionStratagems: Stratagem[];
  targetFaction: string | null;
  targetDetachment: string | null;
}

export default function StratagemReferenceModal({
  isOpen,
  onClose,
  currentPhase,
  currentTurn,
  player,
  playerCP,
  coreStratagems,
  factionStratagems,
  targetFaction,
  targetDetachment
}: StratagemReferenceModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Default to showing only available stratagems
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const playerLabel = player === 'defender' ? 'DEFENDER' : 'ATTACKER';

  // Filter stratagems if toggle is on
  const filteredCore = showOnlyAvailable 
    ? coreStratagems.filter(s => s.availableNow) 
    : coreStratagems;
  const filteredFaction = showOnlyAvailable 
    ? factionStratagems.filter(s => s.availableNow) 
    : factionStratagems;

  const totalAvailable = coreStratagems.filter(s => s.availableNow).length 
    + factionStratagems.filter(s => s.availableNow).length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div 
        className="relative w-full max-w-2xl mx-auto max-h-[85vh] flex flex-col bg-grimlog-slate-light border-t-2 border-grimlog-steel shadow-2xl rounded-t-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-grimlog-steel bg-grimlog-slate-dark">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-wider uppercase flex items-center gap-2">
                <span className="text-grimlog-orange">◆</span> {playerLabel} STRATAGEMS
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-mono text-gray-600">
                  {currentPhase} Phase • {currentTurn === player ? 'Your Turn' : "Opponent's Turn"}
                </span>
                <span className="text-sm font-bold text-grimlog-orange">
                  {playerCP} CP Available
                </span>
              </div>
              {targetFaction && (
                <span className="text-xs text-gray-500 font-mono">
                  {targetFaction}{targetDetachment ? ` • ${targetDetachment}` : ''}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-2xl font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>

          {/* Filter Toggle */}
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyAvailable}
                onChange={(e) => setShowOnlyAvailable(e.target.checked)}
                className="w-4 h-4 accent-grimlog-orange"
              />
              <span className="text-sm text-gray-700">
                Show only available ({totalAvailable})
              </span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-grimlog-slate-light">
          {/* Core Stratagems Section */}
              <section>
                <h3 className="text-lg font-bold text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                  <span className="text-grimlog-orange">⚔</span> Core Stratagems
                  <span className="text-sm text-gray-500 font-normal">
                    ({filteredCore.length})
                  </span>
                </h3>
                
                {filteredCore.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">
                    {showOnlyAvailable ? 'No core stratagems available in this phase' : 'No core stratagems found'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredCore.map(strat => (
                      <StratagemCard
                        key={strat.id}
                        stratagem={strat}
                        isExpanded={expandedId === strat.id}
                        onToggle={() => setExpandedId(expandedId === strat.id ? null : strat.id)}
                        canAfford={playerCP >= strat.cpCost}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Faction Stratagems Section */}
              <section>
                <h3 className="text-lg font-bold text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                  <span className="text-grimlog-orange">🛡</span> 
                  {targetFaction || 'Faction'} Stratagems
                  <span className="text-sm text-gray-500 font-normal">
                    ({filteredFaction.length})
                  </span>
                </h3>
                
                {filteredFaction.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">
                    {showOnlyAvailable 
                      ? 'No faction stratagems available in this phase' 
                      : targetFaction 
                        ? 'No faction stratagems found for this detachment'
                        : 'No faction selected - select an army to see faction stratagems'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredFaction.map(strat => (
                      <StratagemCard
                        key={strat.id}
                        stratagem={strat}
                        isExpanded={expandedId === strat.id}
                        onToggle={() => setExpandedId(expandedId === strat.id ? null : strat.id)}
                        canAfford={playerCP >= strat.cpCost}
                      />
                    ))}
                  </div>
)}
            </section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-grimlog-steel bg-grimlog-slate-dark">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 font-bold tracking-wider transition-all uppercase bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 rounded-lg"
          >
            CLOSE (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}

// Stratagem Card Component
interface StratagemCardProps {
  stratagem: Stratagem;
  isExpanded: boolean;
  onToggle: () => void;
  canAfford: boolean;
}

function StratagemCard({ stratagem, isExpanded, onToggle, canAfford }: StratagemCardProps) {
  const isAvailable = stratagem.availableNow && canAfford;
  
  // Styling based on availability
  const containerClass = isAvailable
    ? 'bg-white border-gray-300 hover:border-grimlog-orange'
    : 'bg-gray-100 border-gray-300 opacity-70';
  
  const cpClass = isAvailable
    ? 'bg-grimlog-orange text-gray-900 font-bold'
    : 'bg-gray-400 text-white font-bold';

  const titleClass = isAvailable
    ? 'text-gray-900'
    : 'text-gray-500';
  
  const subtextClass = isAvailable
    ? 'text-gray-600'
    : 'text-gray-400';

  return (
    <div className={`border-2 ${containerClass} transition-all rounded-lg overflow-hidden`}>
      {/* Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* CP Cost Badge */}
          <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center text-lg rounded ${cpClass}`}>
            {stratagem.cpCost}
          </span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold ${titleClass} truncate`}>
                {stratagem.name}
              </span>
              {stratagem.isReactive && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-purple-600 text-white rounded">
                  REACTIVE
                </span>
              )}
              {!canAfford && stratagem.availableNow && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-red-600 text-white rounded">
                  INSUFFICIENT CP
                </span>
              )}
            </div>
            <span className={`text-xs ${subtextClass} font-mono block truncate`}>
              {stratagem.type} • {stratagem.triggerPhase.join(', ')}
            </span>
          </div>
        </div>
        
        {/* Expand Arrow */}
        <span className={`${subtextClass} text-xl transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-200 space-y-2 bg-gray-50">
          <div className="pt-2">
            <span className="text-xs font-bold text-grimlog-orange uppercase">When:</span>
            <p className="text-sm text-gray-800">{stratagem.when}</p>
          </div>
          <div>
            <span className="text-xs font-bold text-grimlog-orange uppercase">Target:</span>
            <p className="text-sm text-gray-800">{stratagem.target}</p>
          </div>
          <div>
            <span className="text-xs font-bold text-grimlog-orange uppercase">Effect:</span>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{stratagem.effect}</p>
          </div>
          {stratagem.detachment && (
            <div className="pt-1">
              <span className="text-xs text-gray-500 italic">
                Detachment: {stratagem.detachment}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
