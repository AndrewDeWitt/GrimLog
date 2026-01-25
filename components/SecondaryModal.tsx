'use client';

import { useState, useEffect } from 'react';
import SecondaryCardLarge from './SecondaryCardLarge';
import SecondaryDetailModal from './SecondaryDetailModal';
import type { SecondaryObjective, SecondaryProgress, SecondaryProgressMap, MissionMode } from '@/lib/types';

interface SecondaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  
  // Player data
  attackerSecondaries: string[];
  defenderSecondaries: string[];
  attackerProgress: SecondaryProgressMap;
  defenderProgress: SecondaryProgressMap;
  
  // All available secondaries (pre-fetched)
  allSecondaries: SecondaryObjective[];
  
  // Game state
  missionMode: MissionMode;
  currentRound: number;
  currentTurn: string;
  
  // Callbacks
  onScore: (player: 'attacker' | 'defender', secondaryName: string, vp: number, details: string) => void;
  onAddSecondary: (player: 'attacker' | 'defender', secondaryName: string) => void;
  onRemoveSecondary: (player: 'attacker' | 'defender', secondaryName: string) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
  
  // Optional: initial tab
  initialTab?: 'attacker' | 'defender';
}

export default function SecondaryModal({
  isOpen,
  onClose,
  sessionId,
  attackerSecondaries,
  defenderSecondaries,
  attackerProgress,
  defenderProgress,
  allSecondaries,
  missionMode,
  currentRound,
  currentTurn,
  onScore,
  onAddSecondary,
  onRemoveSecondary,
  onShowToast,
  initialTab = 'attacker'
}: SecondaryModalProps) {
  const [activeTab, setActiveTab] = useState<'attacker' | 'defender'>(initialTab);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSecondary, setSelectedSecondary] = useState<SecondaryObjective | null>(null);
  const [showSelectionList, setShowSelectionList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Reset to initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDetailModalOpen(false);
      setShowSelectionList(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Get current player's data
  const currentSecondaries = activeTab === 'attacker' ? attackerSecondaries : defenderSecondaries;
  const currentProgress = activeTab === 'attacker' ? attackerProgress : defenderProgress;

  // Map secondary names to full objects
  const secondaryObjects = currentSecondaries.map(name => 
    allSecondaries.find(s => s.name === name) || null
  );

  // Ensure we always show 2 slots
  while (secondaryObjects.length < 2) {
    secondaryObjects.push(null);
  }

  // Calculate total VP for current player
  const totalVP = Object.values(currentProgress).reduce((sum, p) => sum + (p?.vp || 0), 0);

  // Handle card tap - open detail modal
  const handleCardTap = (secondary: SecondaryObjective) => {
    setSelectedSecondary(secondary);
    setDetailModalOpen(true);
  };

  // Handle add button - show selection list
  const handleAddClick = () => {
    setShowSelectionList(true);
  };

  // Handle selecting a secondary from the list
  const handleSelectSecondary = async (secondaryName: string) => {
    if (currentSecondaries.length >= 2) {
      onShowToast('Maximum 2 secondaries allowed', 'warning');
      return;
    }
    
    try {
      await onAddSecondary(activeTab, secondaryName);
      setShowSelectionList(false);
      onShowToast(`Added ${secondaryName}`, 'success');
    } catch (error) {
      onShowToast('Failed to add secondary', 'error');
    }
  };

  // Handle scoring
  const handleScore = (vpAmount: number, details: string, optionIndex: number) => {
    if (!selectedSecondary) return;
    onScore(activeTab, selectedSecondary.name, vpAmount, details);
    setDetailModalOpen(false);
  };

  // Handle discard
  const handleDiscard = async () => {
    if (!selectedSecondary) return;
    try {
      await onRemoveSecondary(activeTab, selectedSecondary.name);
      setDetailModalOpen(false);
      onShowToast(`Discarded ${selectedSecondary.name}`, 'warning');
    } catch (error) {
      onShowToast('Failed to discard secondary', 'error');
    }
  };

  // Filter available secondaries for selection
  const getAvailableSecondaries = () => {
    const usedNames = new Set([...attackerSecondaries, ...defenderSecondaries]);
    return allSecondaries.filter(s => {
      // Not already in use
      if (usedNames.has(s.name)) return false;
      // Compatible with mission mode
      if (s.category !== 'Both' && s.category.toLowerCase() !== missionMode) return false;
      return true;
    });
  };

  // Dynamic colors based on active player - Grim dark muted tones
  const isAttackerActive = activeTab === 'attacker';
  const playerBg = isAttackerActive ? 'bg-grimlog-attacker-bg-dark' : 'bg-grimlog-defender-bg-dark';
  const playerAccent = isAttackerActive ? 'border-grimlog-red' : 'border-grimlog-green';
  const playerText = isAttackerActive ? 'text-grimlog-red' : 'text-grimlog-green';

  return (
    <>
      {/* Main Modal - Full Screen - Player-colored theme */}
      <div className={`fixed inset-0 z-50 flex flex-col ${playerBg} transition-colors duration-300`}>
        {/* Header */}
        <header className={`flex-shrink-0 bg-grimlog-black border-b-4 ${playerAccent} px-4 py-3 flex items-center justify-between transition-colors duration-300`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <h1 className={`text-xl sm:text-2xl font-bold ${playerText} uppercase tracking-wider transition-colors duration-300`}>
              Secondaries
            </h1>
            <span className="text-grimlog-amber font-bold text-lg ml-2">
              {totalVP} VP
            </span>
          </div>
          <button
            onClick={onClose}
            className="group px-4 py-2 flex items-center gap-2 bg-grimlog-slate hover:bg-grimlog-red text-grimlog-black hover:text-white transition-all border-2 border-grimlog-steel hover:border-grimlog-red rounded-lg"
            aria-label="Close"
          >
            <span className="text-sm font-bold uppercase tracking-wider hidden sm:inline">Close</span>
            <span className="text-xl font-mono">✕</span>
          </button>
        </header>

        {/* Player Tabs - Defender LEFT, Attacker RIGHT (matches main game view layout) */}
        <div className="flex-shrink-0 flex border-b-2 border-grimlog-steel">
          <button
            onClick={() => setActiveTab('defender')}
            className={`
              flex-1 py-4 font-bold text-base sm:text-lg uppercase tracking-wider transition-all
              ${activeTab === 'defender'
                ? 'bg-grimlog-defender-bg-dark text-black border-b-4 border-grimlog-green'
                : 'bg-grimlog-darkGray text-grimlog-green hover:bg-grimlog-gray'
              }
            `}
          >
            <span className="hidden sm:inline">Defender</span>
            <span className="sm:hidden">DEF</span>
            <span className="ml-2 text-sm">({defenderSecondaries.length}/2)</span>
          </button>
          <button
            onClick={() => setActiveTab('attacker')}
            className={`
              flex-1 py-4 font-bold text-base sm:text-lg uppercase tracking-wider transition-all
              ${activeTab === 'attacker'
                ? 'bg-grimlog-attacker-bg-dark text-black border-b-4 border-grimlog-red'
                : 'bg-grimlog-darkGray text-grimlog-red hover:bg-grimlog-gray'
              }
            `}
          >
            <span className="hidden sm:inline">Attacker</span>
            <span className="sm:hidden">ATK</span>
            <span className="ml-2 text-sm">({attackerSecondaries.length}/2)</span>
          </button>
        </div>

        {/* Main Content - Cards */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!showSelectionList ? (
            // Card display
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch max-w-3xl mx-auto">
              {secondaryObjects.map((secondary, idx) => (
                <SecondaryCardLarge
                  key={secondary?.name || `empty-${idx}`}
                  secondary={secondary}
                  progress={secondary ? currentProgress[secondary.name] || null : null}
                  player={activeTab}
                  onTap={() => secondary && handleCardTap(secondary)}
                  onAdd={handleAddClick}
                />
              ))}
            </div>
          ) : (
            // Selection list
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-bold uppercase ${activeTab === 'attacker' ? 'text-grimlog-red' : 'text-grimlog-green'}`}>
                  Select Secondary
                </h2>
                <button
                  onClick={() => setShowSelectionList(false)}
                  className="px-3 py-1 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-black rounded-lg text-sm font-bold"
                >
                  Cancel
                </button>
              </div>

              {/* Random draw button for Tactical mode */}
              {missionMode === 'tactical' && (
                <button
                  onClick={() => {
                    const available = getAvailableSecondaries();
                    if (available.length === 0) {
                      onShowToast('No secondaries available to draw', 'warning');
                      return;
                    }
                    const random = available[Math.floor(Math.random() * available.length)];
                    handleSelectSecondary(random.name);
                  }}
                  className="w-full mb-4 py-4 bg-grimlog-orange hover:brightness-110 text-grimlog-black font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                  <span className="text-xl">🎲</span>
                  Draw Random Card
                </button>
              )}

              {/* Scrollable list */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {getAvailableSecondaries().map(secondary => (
                  <button
                    key={secondary.id}
                    onClick={() => handleSelectSecondary(secondary.name)}
                    className={`
                      w-full p-4 text-left rounded-lg border-2 transition-all
                      bg-grimlog-slate border-grimlog-steel 
                      hover:border-grimlog-orange hover:bg-grimlog-slate-light
                      active:scale-[0.98]
                    `}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className={`font-bold text-base uppercase ${activeTab === 'attacker' ? 'text-grimlog-red' : 'text-grimlog-green'}`}>
                          {secondary.name}
                        </div>
                        <div className="text-grimlog-gray text-sm mt-1 line-clamp-2">
                          {secondary.description}
                        </div>
                      </div>
                      <div className={`
                        px-2 py-1 rounded text-xs font-bold uppercase flex-shrink-0
                        ${secondary.category === 'Tactical' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}
                      `}>
                        {secondary.category === 'Tactical' ? 'TAC' : secondary.category === 'Fixed' ? 'FIX' : 'BOTH'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className={`flex-shrink-0 bg-grimlog-black border-t-2 ${playerAccent} px-4 py-3 transition-colors duration-300`}>
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="text-grimlog-light-steel text-sm">
              <span className={missionMode === 'tactical' ? 'text-blue-400' : 'text-grimlog-amber'}>
                {missionMode === 'tactical' ? '🎲 Tactical' : '📋 Fixed'}
              </span>
              <span className="mx-2">•</span>
              Round {currentRound}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`
                  px-4 py-2 rounded-lg font-bold text-sm uppercase transition-colors
                  ${showHistory 
                    ? 'bg-grimlog-steel text-grimlog-black' 
                    : 'bg-grimlog-darkGray text-white'
                  }
                `}
              >
                📜 History
              </button>
              {currentSecondaries.length < 2 && !showSelectionList && (
                <button
                  onClick={handleAddClick}
                  className={`px-4 py-2 ${isAttackerActive ? 'bg-grimlog-red' : 'bg-grimlog-green'} hover:brightness-110 text-white rounded-lg font-bold text-sm uppercase transition-all`}
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* History panel (inline collapsible) */}
          {showHistory && (
            <div className="mt-3 p-3 bg-grimlog-gray rounded-lg max-w-3xl mx-auto border border-grimlog-steel">
              <h3 className="text-grimlog-light-steel text-xs font-bold uppercase mb-2">Scoring History</h3>
              {Object.entries(currentProgress).length === 0 ? (
                <p className="text-grimlog-steel text-sm">No scoring yet</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {Object.entries(currentProgress).flatMap(([name, progress]) =>
                    (progress.scoringHistory || []).map((entry, idx) => (
                      <div key={`${name}-${idx}`} className="flex items-center justify-between text-sm">
                        <span className="text-grimlog-light-steel">
                          R{entry.round} • {name}
                        </span>
                        <span className={playerText}>
                          +{entry.vp}VP
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </footer>
      </div>

      {/* Secondary Detail Modal */}
      <SecondaryDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        secondary={selectedSecondary}
        progress={selectedSecondary ? currentProgress[selectedSecondary.name] || null : null}
        player={activeTab}
        missionMode={missionMode}
        currentRound={currentRound}
        currentTurn={currentTurn}
        onScore={handleScore}
        onDiscard={handleDiscard}
      />
    </>
  );
}

