'use client';

import { useEffect, useRef } from 'react';
import type { SecondaryObjective, SecondaryProgress, MissionMode } from '@/lib/types';
import { getScoringOptions, getVPPerTurnCap } from '@/lib/secondaryRules';

interface ScoringOption {
  condition: string;
  vp: number;
}

interface SecondaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  secondary: SecondaryObjective | null;
  progress: SecondaryProgress | null;
  player: 'attacker' | 'defender';
  missionMode: MissionMode;
  currentRound: number;
  currentTurn: string;
  onScore: (vpAmount: number, details: string, optionIndex: number) => void;
  onDiscard: () => void;
  onManage?: () => void; // Optional: open full management modal
}

export default function SecondaryDetailModal({
  isOpen,
  onClose,
  secondary,
  progress,
  player,
  missionMode,
  currentRound,
  currentTurn,
  onScore,
  onDiscard,
  onManage
}: SecondaryDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !secondary) return null;

  const isAttacker = player === 'attacker';
  // High contrast color scheme for accessibility
  const borderColor = isAttacker ? 'border-grimlog-red' : 'border-grimlog-green';
  const headerBg = isAttacker ? 'bg-[#d4918f]' : 'bg-[#a8c4a8]'; // Lighter muted versions for better text contrast

  const currentVP = progress?.vp || 0;
  const maxVP = secondary.maxVPTotal || 20;
  const isMaxed = currentVP >= maxVP;
  
  // Get scoring options from the rules engine
  const scoringOptions: ScoringOption[] = getScoringOptions(secondary.name, missionMode);
  const turnCap = getVPPerTurnCap(secondary.name, missionMode);

  // Calculate VP scored this turn from progress history
  const vpScoredThisTurn = progress?.scoringHistory
    ?.filter(entry => entry.round === currentRound && entry.turn === currentTurn)
    .reduce((sum, entry) => sum + entry.vp, 0) || 0;

  // Check if tactical mission already scored this turn
  const isTacticalScoredThisTurn = missionMode === 'tactical' && 
    secondary.category === 'Tactical' && 
    vpScoredThisTurn > 0;

  const remainingTurnVP = turnCap ? Math.max(0, turnCap - vpScoredThisTurn) : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-grimlog-black/45 backdrop-blur-[2px]">
      <div
        ref={modalRef}
        className="relative w-full max-w-xl mx-auto bg-grimlog-slate-light border-t-2 border-grimlog-steel rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header - Compact design */}
        <div className="relative p-4 md:p-5 bg-grimlog-slate-dark border-b border-grimlog-steel flex-shrink-0">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>

          <div className="pr-10">
            {/* Title row with VP */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-gray-900 leading-tight flex-1">
                {secondary.name}
              </h2>
              
              {/* Compact VP display */}
              {currentVP > 0 && (
                <div className={`flex-shrink-0 px-3 py-1 rounded-lg font-black text-lg ${isMaxed ? 'bg-grimlog-amber text-gray-900' : 'bg-white text-gray-800 border border-gray-300'}`}>
                  {currentVP}<span className="text-sm font-bold text-gray-500">VP</span>
                </div>
              )}
            </div>
            
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`
                px-2 py-1 rounded text-xs font-bold uppercase shadow-sm
                ${secondary.category === 'Tactical' ? 'bg-blue-600 text-white' : 'bg-amber-700 text-white'}
              `}>
                {secondary.category === 'Tactical' ? 'TAC' : 'FIX'}
              </span>
              {secondary.maxVPPerTurn && (
                <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-gray-800 text-white shadow-sm">
                  {secondary.maxVPPerTurn}VP/TURN
                </span>
              )}
              {isMaxed && (
                <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-grimlog-amber text-black animate-pulse shadow-sm">
                  MAXED
                </span>
              )}
              
              {/* Turn cap status inline */}
              {turnCap && vpScoredThisTurn > 0 && (
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase shadow-sm ${remainingTurnVP === 0 ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}>
                  {vpScoredThisTurn}/{turnCap} this turn
                  {remainingTurnVP === 0 && ' (CAP)'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tactical scored warning */}
        {isTacticalScoredThisTurn && (
          <div className="px-4 md:px-5 py-3 bg-amber-100 border-b-2 border-amber-400">
            <p className="text-amber-800 text-sm font-bold">
              Already scored {vpScoredThisTurn}VP this turn
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              Tactical missions complete on score - draw a new card
            </p>
          </div>
        )}

        {/* Scoring Options - Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-grimlog-slate-light">
          {scoringOptions.length > 0 ? (
            <>
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">
                Score VP
              </h3>
              
              <div className="space-y-3">
                {scoringOptions.map((option, idx) => {
                  // Calculate actual VP after caps
                  let actualVP = option.vp;
                  if (remainingTurnVP !== null) {
                    actualVP = Math.min(option.vp, remainingTurnVP);
                  }
                  
                  const isDisabled = actualVP <= 0 || isTacticalScoredThisTurn || currentVP >= maxVP;
                  const isCapped = actualVP < option.vp && !isDisabled;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!isDisabled) {
                          onScore(actualVP, option.condition, idx);
                        }
                      }}
                      disabled={isDisabled}
                      className={`
                        w-full min-h-[60px] md:min-h-[68px] px-4 py-3
                        flex items-center justify-between gap-3
                        rounded-lg border-2 transition-all shadow-sm
                        ${isDisabled 
                          ? 'bg-gray-200 border-gray-300 cursor-not-allowed' 
                          : 'bg-white border-gray-300 hover:border-grimlog-orange hover:shadow-md active:scale-[0.98]'
                        }
                      `}
                    >
                      <span className={`text-sm sm:text-base text-left flex-1 font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}>
                        {option.condition}
                      </span>
                      <span className={`
                        text-xl sm:text-2xl font-black whitespace-nowrap
                        ${isDisabled ? 'text-gray-400' : 'text-grimlog-orange'}
                      `}>
                        +{actualVP}
                        {isCapped && <span className="text-xs text-amber-600 ml-1">(capped)</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No scoring options available</p>
              <p className="text-sm mt-1">This secondary may require specific conditions</p>
            </div>
          )}
        </div>

        {/* Full Rules - Collapsible */}
        <details className="border-t-2 border-gray-300 flex-shrink-0">
          <summary className="px-4 md:px-5 py-3 text-gray-600 text-sm font-bold uppercase cursor-pointer hover:text-gray-800 transition-colors flex items-center gap-2 bg-gray-100">
            <span>📜</span> Full Rules
          </summary>
          <div className="px-4 md:px-5 pb-4 pt-3 text-gray-300 text-sm leading-relaxed bg-gray-900">
            <p className="text-gray-200">{secondary.description}</p>
            {secondary.scoringTrigger && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <span className="text-grimlog-orange font-bold">Trigger:</span> {secondary.scoringTrigger}
              </div>
            )}
            <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-400">
              <span className="font-bold">Max VP:</span> {maxVP} <span className="mx-2">|</span>
              <span className="font-bold">Type:</span> {secondary.scoringType?.replace(/_/g, ' ') || 'Standard'}
            </div>
          </div>
        </details>

        {/* Footer Actions */}
        <div className="p-4 border-t border-grimlog-steel bg-grimlog-slate-dark flex gap-3 flex-shrink-0">
          <button
            onClick={onDiscard}
            className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold uppercase text-sm rounded-lg transition-colors flex-shrink-0 border border-red-300"
          >
            Discard
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold uppercase text-sm rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

    </div>
  );
}

