'use client';

import { useState } from 'react';
import { 
  GamePhase, 
  PhaseRelevantAction, 
  getUnitActions, 
  getTopPhaseActions 
} from '@/lib/phaseRelevance';

interface PhaseContextualActionsProps {
  datasheet: string;
  currentPhase: GamePhase;
  isBattleShocked?: boolean;
  compact?: boolean;
  onActionClick?: (action: PhaseRelevantAction) => void;
}

export default function PhaseContextualActions({
  datasheet,
  currentPhase,
  isBattleShocked = false,
  compact = false,
  onActionClick
}: PhaseContextualActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get all actions for this unit
  const allActions = getUnitActions(datasheet);
  
  // Filter to top 3 most relevant for current phase
  const relevantActions = getTopPhaseActions(allActions, currentPhase, 3);
  
  // If no relevant actions, don't show anything
  if (relevantActions.length === 0) {
    return null;
  }
  
  // Compact view: Just show action icons
  if (compact) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-grimlog-steel">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full flex items-center justify-between text-xs text-grimlog-light-steel hover:text-grimlog-orange transition-colors"
        >
          <span className="font-mono uppercase">Quick Actions ({currentPhase})</span>
          <span>{isExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isExpanded && (
          <div className="mt-1.5 space-y-1">
            {relevantActions.map((action, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onActionClick?.(action);
                }}
                disabled={isBattleShocked && action.type === 'ability'}
                className={`
                  w-full flex items-center gap-1.5 p-1.5 text-left text-xs
                  border border-grimlog-steel bg-grimlog-black
                  ${isBattleShocked && action.type === 'ability' 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:border-grimlog-orange hover:bg-grimlog-steel cursor-pointer btn-depth-sm hover-lift'
                  }
                `}
                title={action.description}
              >
                <span className="text-base flex-shrink-0">{action.icon}</span>
                <span className="flex-1 truncate font-mono">{action.name}</span>
                {action.cpCost && (
                  <span className="text-grimlog-amber font-bold flex-shrink-0">
                    {action.cpCost}CP
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Medium view: Show full action cards
  return (
    <div className="mt-2.5 pt-2.5 border-t-2 border-grimlog-steel">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex items-center justify-between text-sm text-grimlog-light-steel hover:text-grimlog-orange transition-colors mb-2"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase">Quick Actions</span>
          <span className="text-xs font-mono text-grimlog-amber">
            {currentPhase} Phase
          </span>
        </div>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </button>
      
      {isExpanded && (
        <div className="space-y-2">
          {relevantActions.map((action, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onActionClick?.(action);
              }}
              disabled={isBattleShocked && action.type === 'ability'}
              className={`
                w-full p-2 text-left border-2
                ${isBattleShocked && action.type === 'ability'
                  ? 'border-grimlog-steel bg-grimlog-gray opacity-50 cursor-not-allowed'
                  : 'border-grimlog-steel bg-grimlog-black hover:border-grimlog-orange btn-depth hover-lift cursor-pointer'
                }
              `}
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-2xl flex-shrink-0">{action.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-grimlog-light-steel text-sm">
                      {action.name}
                    </span>
                    {action.cpCost && (
                      <span className="text-xs font-bold text-grimlog-amber bg-grimlog-black px-1.5 py-0.5 border border-grimlog-amber">
                        {action.cpCost} CP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-grimlog-steel uppercase font-mono">
                    {action.type}
                  </span>
                </div>
              </div>
              <p className="text-xs text-grimlog-light-steel leading-relaxed">
                {action.description}
              </p>
              
              {isBattleShocked && action.type === 'ability' && (
                <div className="mt-1 text-xs text-grimlog-red font-bold flex items-center gap-1">
                  <span>⚡</span>
                  <span>UNAVAILABLE - BATTLE-SHOCKED</span>
                </div>
              )}
            </button>
          ))}
          
          <div className="text-xs text-grimlog-steel text-center pt-1 border-t border-grimlog-steel">
            Click action for details or to log usage
          </div>
        </div>
      )}
    </div>
  );
}

