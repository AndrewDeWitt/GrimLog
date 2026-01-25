'use client';

import { useState } from 'react';

interface ObjectiveMarker {
  objectiveNumber: number;
  controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
  controllingUnit?: string;
}

interface ObjectiveMarkersControlProps {
  sessionId: string;
  objectives: ObjectiveMarker[];
  onUpdate: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const CONTROL_STATES: Array<'none' | 'attacker' | 'contested' | 'defender'> = [
  'none',
  'attacker',
  'contested',
  'defender'
];

export default function ObjectiveMarkersControl({
  sessionId,
  objectives,
  onUpdate,
  onShowToast
}: ObjectiveMarkersControlProps) {
  const [updating, setUpdating] = useState<number | null>(null);

  // Ensure we have all 6 objectives
  const allObjectives: ObjectiveMarker[] = Array.from({ length: 6 }, (_, i) => {
    const existing = objectives.find(obj => obj.objectiveNumber === i + 1);
    return existing || {
      objectiveNumber: i + 1,
      controlledBy: 'none'
    };
  });

  const updateObjective = async (objectiveNumber: number, controlledBy: string) => {
    setUpdating(objectiveNumber);
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/manual-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'update_objective_control',
          args: {
            objective_number: objectiveNumber,
            controlled_by: controlledBy
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update objective');
      }

      const result = await response.json();
      
      if (result.success) {
        onUpdate();
        onShowToast(result.message, 'success');
      } else {
        onShowToast(result.message || 'Failed to update objective', 'error');
      }
    } catch (error) {
      console.error('Error updating objective:', error);
      onShowToast('Failed to update objective', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const cycleObjectiveControl = (objective: ObjectiveMarker) => {
    const currentIndex = CONTROL_STATES.indexOf(objective.controlledBy as any);
    const nextIndex = (currentIndex + 1) % CONTROL_STATES.length;
    const nextState = CONTROL_STATES[nextIndex];
    
    updateObjective(objective.objectiveNumber, nextState);
  };

  const getObjectiveColor = (controlledBy: string) => {
    switch (controlledBy) {
      case 'attacker':
        return 'bg-orange-600 border-orange-600 text-gray-300';
      case 'defender':
        return 'bg-green-600 border-green-600 text-gray-300';
      case 'contested':
        return 'bg-yellow-600 border-yellow-600 text-grimlog-black';
      case 'none':
      default:
        return 'bg-grimlog-gray border-grimlog-steel text-grimlog-light-steel';
    }
  };

  const getObjectiveIcon = (controlledBy: string) => {
    switch (controlledBy) {
      case 'attacker':
        return '✓';
      case 'defender':
        return '✗';
      case 'contested':
        return '⚔';
      case 'none':
      default:
        return '○';
    }
  };

  return (
    <div className="py-2 px-2 bg-grimlog-gray border border-grimlog-steel rounded">
      <div className="flex items-center justify-between mb-2">
        <span className="text-grimlog-light-steel font-bold text-xs tracking-wider uppercase">
          OBJECTIVE MARKERS
        </span>
        <span className="text-grimlog-steel text-xs font-mono">
          Click to cycle
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {allObjectives.map((objective) => (
          <button
            key={objective.objectiveNumber}
            onClick={() => cycleObjectiveControl(objective)}
            disabled={updating === objective.objectiveNumber}
            className={`
              relative aspect-square rounded border-2 font-bold text-lg
              transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
              ${getObjectiveColor(objective.controlledBy)}
            `}
            aria-label={`Objective ${objective.objectiveNumber}: ${objective.controlledBy}`}
            title={`Objective ${objective.objectiveNumber}\nStatus: ${objective.controlledBy}\nClick to change`}
          >
            <div className="absolute top-0.5 left-1 text-xs opacity-70">
              {objective.objectiveNumber}
            </div>
            <div className="flex items-center justify-center h-full">
              {updating === objective.objectiveNumber ? (
                <span className="animate-pulse">...</span>
              ) : (
                <span className="text-2xl">
                  {getObjectiveIcon(objective.controlledBy)}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-600 border border-green-600 rounded"></div>
          <span className="text-grimlog-light-steel">Defender</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-600 border border-orange-600 rounded"></div>
          <span className="text-grimlog-light-steel">Attacker</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-600 border border-yellow-600 rounded"></div>
          <span className="text-grimlog-light-steel">Contested</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-grimlog-gray border border-grimlog-steel rounded"></div>
          <span className="text-grimlog-light-steel">Unclaimed</span>
        </div>
      </div>
    </div>
  );
}

