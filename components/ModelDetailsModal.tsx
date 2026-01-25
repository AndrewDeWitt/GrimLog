'use client';

import { useState, useEffect } from 'react';
import ModelHealthGrid from './ModelHealthGrid';

interface ModelState {
  role: string;
  currentWounds: number;
  maxWounds: number;
}

interface ModelDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitName: string;
  owner: 'attacker' | 'defender';
  models: ModelState[];
  woundsPerModel: number;
  onModelWoundChange: (modelIndex: number, change: number) => void;
  onModelDestroy: (modelIndex: number) => void;
}

export default function ModelDetailsModal({
  isOpen,
  onClose,
  unitName,
  owner,
  models,
  woundsPerModel,
  onModelWoundChange,
  onModelDestroy
}: ModelDetailsModalProps) {
  // Local state for optimistic updates
  const [localModels, setLocalModels] = useState<ModelState[]>(models);
  
  // Sync with prop changes
  useEffect(() => {
    setLocalModels(models);
  }, [models]);
  
  // Optimistic update handlers
  const handleWoundChange = (modelIndex: number, change: number) => {
    // Update local state immediately
    setLocalModels(prev => {
      const updated = [...prev];
      const model = updated[modelIndex];
      if (model) {
        const newWounds = Math.max(0, Math.min(model.maxWounds, model.currentWounds + change));
        updated[modelIndex] = { ...model, currentWounds: newWounds };
      }
      return updated;
    });
    
    // Background API call
    onModelWoundChange(modelIndex, change);
  };
  
  const handleDestroy = (modelIndex: number) => {
    // Update local state immediately (remove model)
    setLocalModels(prev => prev.filter((_, idx) => idx !== modelIndex));
    
    // Background API call
    onModelDestroy(modelIndex);
  };
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative w-full max-w-2xl mx-auto max-h-[85vh] bg-grimlog-slate-light border-t-2 border-grimlog-steel rounded-t-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-wider uppercase">
              {unitName}
            </h2>
            <p className="text-sm text-gray-600 font-mono">
              Model Details - {models.length} Models
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-3xl font-bold leading-none transition-colors px-2 rounded-lg w-10 h-10 flex items-center justify-center"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto bg-grimlog-slate-light">
          <ModelHealthGrid
            models={localModels}
            woundsPerModel={woundsPerModel}
            compact={false}
            onModelWoundChange={handleWoundChange}
            onModelDestroy={handleDestroy}
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-grimlog-slate-dark border-t border-grimlog-steel flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold rounded-lg"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
