'use client';

import { useState, useEffect, useRef } from 'react';
import { GamePhase } from '@/lib/types';
import { ChevronDownIcon, ChevronUpIcon, PhaseIcon } from './ControlIcons';

interface PhaseControlProps {
  currentPhase: GamePhase;
  currentTurn: 'attacker' | 'defender';
  battleRound: number;
  sessionId: string;
  onPhaseChange: (phase: GamePhase, playerTurn: 'attacker' | 'defender') => void;
  onPhaseChangeComplete?: () => void; // Called after API succeeds
}

const PHASES: GamePhase[] = ['Command', 'Movement', 'Shooting', 'Charge', 'Fight'];

export default function PhaseControl({
  currentPhase,
  currentTurn,
  battleRound,
  sessionId,
  onPhaseChange,
  onPhaseChangeComplete
}: PhaseControlProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const changePhase = async (newPhase: GamePhase, playerTurn: 'attacker' | 'defender') => {
    if (isChanging) return;
    
    // Store previous values for rollback
    const previousPhase = currentPhase;
    const previousTurn = currentTurn;
    
    // Optimistic update - instant UI feedback
    onPhaseChange(newPhase, playerTurn);
    
    setIsChanging(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/manual-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'change_phase',
          args: {
            new_phase: newPhase,
            player_turn: playerTurn
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to change phase');
      }

      const result = await response.json();
      
      if (result.success) {
        // Call completion callback to refresh timeline (after event is created)
        if (onPhaseChangeComplete) {
          await onPhaseChangeComplete();
        }
      } else {
        // Rollback on failure
        onPhaseChange(previousPhase, previousTurn);
        console.error('Phase change failed:', result.message);
      }
    } catch (error) {
      console.error('Error changing phase:', error);
      // Rollback on error
      onPhaseChange(previousPhase, previousTurn);
    } finally {
      setIsChanging(false);
      setShowDropdown(false);
    }
  };

  const handlePhaseSelect = (phase: GamePhase) => {
    changePhase(phase, currentTurn);
  };

  // Turn indicator (subtle): small marker near chevron (no ATT/DEF chip)
  const isAttackerTurn = currentTurn === 'attacker';
  const turnMarkerClass = isAttackerTurn ? 'bg-grimlog-red' : 'bg-grimlog-defender-border';

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto flex-1 sm:flex-initial">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isChanging}
        className={`
          w-full sm:w-[14rem] h-11
          px-3
          border-2 border-grimlog-steel border-l-4 border-l-grimlog-steel
          bg-white hover:bg-grimlog-slate-light
          text-grimlog-black
          font-black text-xs sm:text-sm tracking-wider uppercase
          transition-all disabled:opacity-50
          flex items-center justify-between gap-2
          focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-slate-dark
          btn-depth-sm hover-lift
        `}
        aria-label="Select phase"
      >
        <span className="flex items-center gap-2">
          <PhaseIcon phase={currentPhase} className="w-4 h-4 text-grimlog-steel flex-shrink-0" aria-hidden />
          <span className="flex flex-col justify-center">
            <span className="text-[10px] text-grimlog-steel font-black tracking-[0.2em] leading-none mb-0.5">
              PHASE
            </span>
            <span className="text-xs sm:text-sm font-black text-grimlog-orange tracking-widest whitespace-normal">
              {currentPhase}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="sr-only">
            {isAttackerTurn ? 'Attacker turn' : 'Defender turn'}
          </span>
          <span
            className={`w-1.5 h-6 rounded-sm border border-grimlog-steel ${turnMarkerClass}`}
            aria-hidden
            title={isAttackerTurn ? 'Attacker turn' : 'Defender turn'}
          />
          {showDropdown ? (
            <ChevronUpIcon className="w-4 h-4 text-grimlog-steel" aria-hidden />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-grimlog-steel" aria-hidden />
          )}
        </span>
      </button>

      {showDropdown && (
        <div
          className="absolute top-full left-0 mt-1 z-50 w-full sm:w-[14rem] bg-grimlog-slate-light border-2 border-grimlog-steel dropdown-shadow"
          style={{ willChange: 'auto' }}
        >
          {PHASES.map((phase) => {
            const isSelected = phase === currentPhase;
            return (
              <button
                key={phase}
                onClick={() => handlePhaseSelect(phase)}
                className={`
                  w-full px-3 py-3 text-left
                  text-xs sm:text-sm font-black tracking-wider uppercase
                  transition-all
                  border-b border-grimlog-steel/60
                  border-l-4 border-l-grimlog-steel
                  ${isSelected ? 'bg-grimlog-slate' : 'bg-white hover:bg-grimlog-slate'}
                  text-grimlog-black
                  focus:outline-none focus:ring-2 focus:ring-grimlog-orange
                `}
              >
                <span className="flex items-center gap-2">
                  <PhaseIcon phase={phase} className="w-4 h-4 text-grimlog-steel flex-shrink-0" aria-hidden />
                  <span className="flex-1">{phase}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

