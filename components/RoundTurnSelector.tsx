'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ShieldIcon, SwordIcon } from './ControlIcons';

interface RoundTurnSelectorProps {
  battleRound: number;
  currentTurn: 'attacker' | 'defender';
  firstTurn: 'attacker' | 'defender';
  sessionId: string;
  onTurnChange: (round: number, playerTurn: 'attacker' | 'defender') => Promise<void>;
  disabled?: boolean;
}

interface RoundOption {
  round: number;
  playerTurn: 'attacker' | 'defender';
  label: string;
}

export default function RoundTurnSelector({
  battleRound,
  currentTurn,
  firstTurn,
  sessionId,
  onTurnChange,
  disabled = false
}: RoundTurnSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
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

  // Generate all round options (1-5, both attacker and defender)
  const generateOptions = (): RoundOption[] => {
    const options: RoundOption[] = [];
    
    for (let round = 1; round <= 5; round++) {
      // First turn of round
      options.push({
        round,
        playerTurn: firstTurn,
        label: `Round ${round} - ${firstTurn === 'attacker' ? 'Attacker' : 'Defender'}`,
      });
      
      // Second turn of round
      const secondPlayer = firstTurn === 'attacker' ? 'defender' : 'attacker';
      options.push({
        round,
        playerTurn: secondPlayer,
        label: `Round ${round} - ${secondPlayer === 'attacker' ? 'Attacker' : 'Defender'}`,
      });
    }
    
    return options;
  };

  const options = generateOptions();
  
  // Determine current selection
  const isAttackerTurn = currentTurn === 'attacker';
  const chipClass = isAttackerTurn
    ? 'bg-grimlog-red text-white border-grimlog-attacker-border'
    : 'bg-grimlog-defender-border text-white border-grimlog-defender-border';

  const handleSelect = async (option: RoundOption) => {
    if (isChanging || (option.round === battleRound && option.playerTurn === currentTurn)) {
      setShowDropdown(false);
      return;
    }

    // Optimistic UI update - close dropdown immediately for snappy feel
    setShowDropdown(false);
    setIsChanging(true);
    
    try {
      // API call happens in background
      await onTurnChange(option.round, option.playerTurn);
    } catch (error) {
      console.error('Error changing turn:', error);
      // Error is handled by parent component with rollback
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto flex-1">
      <button
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        disabled={disabled || isChanging}
        className={`
          w-full sm:w-[20rem] h-11
          px-3
          font-black text-xs sm:text-sm tracking-wider uppercase
          transition-all disabled:opacity-50
          text-left flex items-center justify-between gap-2
          bg-white hover:bg-grimlog-slate-light
          border-2 border-grimlog-steel border-l-4 border-l-grimlog-steel
          text-grimlog-black
          focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-slate-dark
          btn-depth-sm hover-lift
        `}
        aria-label="Select round and turn"
      >
        <span className="flex items-center gap-2">
          {isAttackerTurn ? (
            <SwordIcon className="w-4 h-4 text-grimlog-steel flex-shrink-0" aria-hidden />
          ) : (
            <ShieldIcon className="w-4 h-4 text-grimlog-steel flex-shrink-0" aria-hidden />
          )}
          <span className="flex flex-col justify-center">
            <span className="text-[10px] text-grimlog-steel font-black tracking-[0.2em] leading-none mb-0.5">
              ROUND <span className="text-grimlog-orange">{battleRound}</span>
            </span>
            <span className={`text-xs sm:text-sm font-black tracking-wider whitespace-normal px-2 py-0.5 rounded-sm inline-block w-fit ${chipClass}`}>
              {isAttackerTurn ? 'Attacker' : 'Defender'}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {showDropdown ? (
            <ChevronUpIcon className="w-4 h-4 text-grimlog-steel" aria-hidden />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-grimlog-steel" aria-hidden />
          )}
        </span>
      </button>

      {showDropdown && (
        <div 
          className="absolute top-full left-0 mt-1 z-50 w-full sm:w-[20rem] max-h-[55vh] overflow-y-auto bg-grimlog-slate-light border-2 border-grimlog-steel dropdown-shadow"
          style={{ willChange: 'auto' }}
        >
          {options.map((option) => {
            const isSelected = option.round === battleRound && option.playerTurn === currentTurn;
            const isAttacker = option.playerTurn === 'attacker';
            const optionLabel = `${option.label}`;
            const optionChipClass = isAttacker
              ? 'bg-grimlog-red text-white border-grimlog-attacker-border'
              : 'bg-grimlog-defender-border text-white border-grimlog-defender-border';
            
            return (
              <button
                key={`${option.round}-${option.playerTurn}`}
                onClick={() => handleSelect(option)}
                className={`
                  w-full px-3 py-3 text-left
                  text-xs sm:text-sm font-black tracking-wide uppercase
                  transition-all
                  border-b border-grimlog-steel/60
                  border-l-4 border-l-grimlog-steel
                  ${isSelected ? 'bg-grimlog-slate' : 'bg-white hover:bg-grimlog-slate'}
                  text-grimlog-black
                  focus:outline-none focus:ring-2 focus:ring-grimlog-orange
                `}
              >
                <span className="flex items-center gap-2">
                  <span className="w-8 text-grimlog-steel font-black">{`R${option.round}`}</span>
                  {isAttacker ? (
                    <SwordIcon className="w-4 h-4 text-grimlog-steel flex-shrink-0" aria-hidden />
                  ) : (
                    <ShieldIcon className="w-4 h-4 text-grimlog-steel flex-shrink-0" aria-hidden />
                  )}
                  <span className="flex-1 whitespace-normal">
                    ROUND {option.round} - <span className={`px-2 py-0.5 rounded-sm ${optionChipClass}`}>{isAttacker ? 'ATTACKER' : 'DEFENDER'}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

