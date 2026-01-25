'use client';

import { useState, useRef, useEffect } from 'react';
import TacticalMapView from './TacticalMapView';

// ============================================
// Types
// ============================================

interface ObjectiveMarker {
  objectiveNumber: number;
  controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
  controllingUnit?: string;
}

interface ObjectiveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  deploymentType: string;
  objectives: ObjectiveMarker[];
  battleRound: number;
  sessionId: string;
  onObjectiveClick: (objectiveNumber: number, newState: 'attacker' | 'defender' | 'contested' | 'none') => Promise<void>;
}

// ============================================
// Main Modal Component
// ============================================

export default function ObjectiveMapModal({
  isOpen,
  onClose,
  deploymentType,
  objectives,
  battleRound,
  sessionId,
  onObjectiveClick
}: ObjectiveMapModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        // Only close if not clicking on an objective popup which might be outside this ref
        const target = e.target as HTMLElement;
        if (!target.closest('.objective-popup') && !target.closest('.objective-marker')) {
          onClose();
        }
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-grimlog-black/45 backdrop-blur-[2px]">
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl mx-auto bg-grimlog-slate-light border-t-2 border-grimlog-steel rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel rounded-t-2xl">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 tracking-wider uppercase flex items-center gap-2">
              <span>📍</span> Tactical Map
            </h2>
            <div className="hidden sm:flex items-center gap-1.5 ml-4">
              {[1, 2, 3, 4, 5].map((round) => (
                <div
                  key={round}
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs
                    transition-all duration-200
                    ${round <= battleRound
                      ? round === battleRound
                        ? 'bg-grimlog-orange text-black shadow-lg ring-2 ring-grimlog-amber'
                        : 'bg-grimlog-steel text-grimlog-light-steel'
                      : 'bg-white border-2 border-grimlog-steel text-grimlog-steel opacity-40'
                    }
                  `}
                >
                  {round}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl font-bold leading-none w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Map Content - We use the existing TacticalMapView logic but simplified */}
        <div className="flex-1 overflow-hidden bg-grimlog-black flex flex-col">
          <TacticalMapView
            deploymentType={deploymentType}
            objectives={objectives}
            battleRound={battleRound}
            sessionId={sessionId}
            onObjectiveClick={onObjectiveClick}
            isModal={true}
          />
        </div>

        {/* Legend / Footer */}
        <div className="p-4 bg-grimlog-slate-dark border-t border-grimlog-steel flex justify-center items-center flex-shrink-0">
           <div className="flex flex-wrap gap-4 justify-center text-[10px] md:text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-grimlog-red border-2 border-grimlog-black"></div>
              <span className="text-gray-700 font-bold uppercase tracking-tighter">Attacker</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-grimlog-green border-2 border-grimlog-black"></div>
              <span className="text-gray-700 font-bold uppercase tracking-tighter">Defender</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-grimlog-amber border-2 border-grimlog-black"></div>
              <span className="text-gray-700 font-bold uppercase tracking-tighter">Contested</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-grimlog-steel border-2 border-grimlog-black"></div>
              <span className="text-gray-700 font-bold uppercase tracking-tighter">Unclaimed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

