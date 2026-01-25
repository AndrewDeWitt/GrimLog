'use client';

import { useState, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface PrimaryMission {
  id: string;
  name: string;
  deploymentType: string;
  scoringPhase: string;
  scoringTiming: string;
  scoringFormula: string;
  maxVP: number;
  specialRules?: string;
  description: string;
}

interface MissionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (missionId: string) => Promise<void>;
  sessionId: string;
}

// ============================================
// Main Modal Component
// ============================================

export default function MissionSelectionModal({
  isOpen,
  onClose,
  onSelect,
  sessionId
}: MissionSelectionModalProps) {
  const [missions, setMissions] = useState<PrimaryMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMission, setSelectedMission] = useState<PrimaryMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch missions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMissions();
    }
  }, [isOpen]);
  
  const fetchMissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/missions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch missions');
      }
      
      const data = await response.json();
      setMissions(data.missions || []);
    } catch (error) {
      console.error('Failed to fetch missions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = async () => {
    if (!selectedMission) return;
    
    setLoading(true);
    try {
      await onSelect(selectedMission.id);
      onClose();
    } catch (error) {
      console.error('Failed to set mission:', error);
      setError(error instanceof Error ? error.message : 'Failed to set mission');
    } finally {
      setLoading(false);
    }
  };
  
  const filteredMissions = searchQuery
    ? missions.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.deploymentType.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : missions;
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-selection-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-4xl mx-auto max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
          <h2 
            id="mission-selection-title"
            className="text-gray-900 text-xl font-bold tracking-wider uppercase flex items-center gap-2"
          >
            <span>🎯</span> Select Primary Mission
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-300 flex-shrink-0">
            <p className="text-red-600 text-sm">❌ {error}</p>
          </div>
        )}
        
        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-300 bg-grimlog-slate-dark flex-shrink-0">
          <input
            type="text"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg focus:border-grimlog-orange focus:outline-none"
          />
        </div>
        
        {/* Mission List */}
        <div className="flex-1 overflow-y-auto p-6 bg-grimlog-slate-light">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading missions...</div>
            </div>
          ) : filteredMissions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">
                {searchQuery ? 'No missions match your search' : 'No missions available'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMissions.map(mission => (
                <button
                  key={mission.id}
                  onClick={() => setSelectedMission(mission)}
                  className={`
                    p-4 border-2 rounded-lg text-left transition-all
                    ${selectedMission?.id === mission.id
                      ? 'border-grimlog-orange bg-orange-50'
                      : 'border-gray-300 hover:border-grimlog-orange/50 bg-white'
                    }
                  `}
                >
                  <h3 className="text-grimlog-orange font-bold mb-2">
                    {mission.name}
                  </h3>
                  <div className="text-gray-600 text-sm space-y-1">
                    <p>📍 Deployment: {mission.deploymentType}</p>
                    <p>⏱️ Scoring: {mission.scoringTiming}</p>
                    <p>📊 Formula: {mission.scoringFormula}</p>
                    <p>🏆 Max VP: {mission.maxVP}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Selected Mission Details */}
        {selectedMission && (
          <div className="px-6 py-4 bg-white border-t border-gray-300 flex-shrink-0">
            <h4 className="text-grimlog-orange font-bold mb-2">
              {selectedMission.name}
            </h4>
            <p className="text-gray-600 text-sm mb-3">
              {selectedMission.description}
            </p>
            {selectedMission.specialRules && (
              <div className="mb-3">
                <h5 className="text-grimlog-orange text-sm font-semibold mb-1">Special Rules:</h5>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">
                  {selectedMission.specialRules}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="px-6 py-4 bg-grimlog-slate-dark border-t border-grimlog-steel flex justify-between items-center flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition-colors font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedMission || loading}
            className="px-6 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting Mission...' : 'Confirm Mission'}
          </button>
        </div>
      </div>
    </div>
  );
}
