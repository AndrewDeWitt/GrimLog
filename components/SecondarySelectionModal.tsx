'use client';

import { useEffect, useRef } from 'react';
import type { SecondaryObjective, MissionMode } from '@/lib/types';

interface SecondarySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: 'attacker' | 'defender';
  missionMode: MissionMode;
  availableSecondaries: SecondaryObjective[];
  onSelect: (secondaryName: string) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export default function SecondarySelectionModal({
  isOpen,
  onClose,
  player,
  missionMode,
  availableSecondaries,
  onSelect,
  onShowToast
}: SecondarySelectionModalProps) {
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

  if (!isOpen) return null;

  const isAttacker = player === 'attacker';
  // High contrast color scheme for accessibility
  const borderColor = isAttacker ? 'border-grimlog-red' : 'border-grimlog-green';
  const headerBg = isAttacker ? 'bg-[#d4918f]' : 'bg-[#a8c4a8]'; // Lighter muted versions for better text contrast

  // Handle random draw
  const handleRandomDraw = () => {
    if (availableSecondaries.length === 0) {
      onShowToast('No secondaries available to draw', 'warning');
      return;
    }
    const random = availableSecondaries[Math.floor(Math.random() * availableSecondaries.length)];
    onSelect(random.name);
  };

  // Handle selection
  const handleSelect = (secondaryName: string) => {
    onSelect(secondaryName);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-grimlog-black/45 backdrop-blur-[2px]">
      <div
        ref={modalRef}
        className={`
          relative w-full max-w-xl mx-auto bg-grimlog-slate-light border-t-2 border-grimlog-steel
          rounded-t-2xl
          overflow-hidden shadow-2xl
          flex flex-col
          max-h-[85vh]
        `}
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel rounded-t-xl">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="relative p-4 md:p-5 bg-grimlog-slate-dark border-b border-grimlog-steel flex-shrink-0">
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>

          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide text-gray-900">
              Select Secondary
            </h2>
            <p className="text-gray-600 text-sm mt-1 font-medium">
              {isAttacker ? 'Attacker' : 'Defender'} • {missionMode === 'tactical' ? 'Tactical' : 'Fixed'} Mission
            </p>
          </div>
        </div>

        {/* Random Draw Button - Tactical mode only */}
        {missionMode === 'tactical' && (
          <div className="p-4 md:p-5 border-b border-grimlog-steel flex-shrink-0 bg-grimlog-slate-dark">
            <button
              onClick={handleRandomDraw}
              className="w-full py-4 md:py-5 bg-grimlog-orange hover:brightness-110 text-white font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg text-base md:text-lg"
            >
              <span className="text-2xl md:text-3xl">🎲</span>
              Draw Random Card
            </button>
          </div>
        )}

        {/* Selection List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 bg-grimlog-slate-light">
          {availableSecondaries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No secondaries available</p>
              <p className="text-sm mt-1">All compatible secondaries are in use</p>
            </div>
          ) : (
            availableSecondaries.map(secondary => (
              <button
                key={secondary.id}
                onClick={() => handleSelect(secondary.name)}
                className="w-full p-4 md:p-5 text-left rounded-lg border-2 transition-all bg-white border-gray-300 hover:border-grimlog-orange hover:shadow-md active:scale-[0.98] shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base md:text-lg uppercase text-gray-800">
                      {secondary.name}
                    </div>
                    <div className="text-gray-600 text-sm md:text-base mt-1 line-clamp-2">
                      {secondary.description}
                    </div>
                    {secondary.maxVPPerTurn && (
                      <div className="mt-2 inline-block px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                        {secondary.maxVPPerTurn}VP/turn cap
                      </div>
                    )}
                  </div>
                  <div className={`
                    px-2 py-1 rounded text-xs font-bold uppercase flex-shrink-0 shadow-sm
                    ${secondary.category === 'Tactical' ? 'bg-blue-600 text-white' : secondary.category === 'Fixed' ? 'bg-amber-700 text-white' : 'bg-amber-600 text-white'}
                  `}>
                    {secondary.category === 'Tactical' ? 'TAC' : secondary.category === 'Fixed' ? 'FIX' : 'BOTH'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-grimlog-steel bg-grimlog-slate-dark flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 md:py-4 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold uppercase text-sm md:text-base rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

    </div>
  );
}

