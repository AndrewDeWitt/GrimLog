'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhaseControl from './PhaseControl';
import ObjectiveMapModal from './ObjectiveMapModal';
import SecondaryMiniCard from './SecondaryMiniCard';
import SecondaryDetailModal from './SecondaryDetailModal';
import SecondarySelectionModal from './SecondarySelectionModal';
import RoundTurnSelector from './RoundTurnSelector';
import StratagemReferenceModal from './StratagemReferenceModal';
import { GamePhase } from '@/lib/types';
import type { SecondaryObjective, SecondaryProgressMap, MissionMode } from '@/lib/types';

// Stratagem types for pre-fetching cache
interface CachedStratagem {
  id: string;
  name: string;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
  triggerPhase: string[];
  isReactive: boolean;
  source: 'core' | 'faction';
  faction?: string;
  detachment?: string;
}

interface StratagemCache {
  core: CachedStratagem[];
  faction: CachedStratagem[];
  targetFaction: string | null;
  targetDetachment: string | null;
  loaded: boolean;
}

interface GameStateDisplayProps {
  // Attacker state
  playerCP: number;
  playerVP: number;
  attackerSecondaries: string[];
  playerObjectives: number;
  attackerSecondaryProgress?: SecondaryProgressMap;
  attackerArmyName?: string;
  attackerFaction?: string;
  
  // Defender state
  opponentCP: number;
  opponentVP: number;
  defenderSecondaries: string[];
  opponentObjectives: number;
  defenderSecondaryProgress?: SecondaryProgressMap;
  defenderArmyName?: string;
  defenderFaction?: string;
  
  // Meta info
  battleRound: number;
  currentPhase: string;
  currentTurn: 'attacker' | 'defender';
  firstTurn: 'attacker' | 'defender';
  sessionId: string;
  deploymentType: string;
  totalObjectives?: number; // default 5
  objectiveMarkers?: Array<{
    objectiveNumber: number;
    controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
    controllingUnit?: string;
  }>;
  allSecondaries?: SecondaryObjective[];
  missionMode?: MissionMode;
  
  // Callbacks
  onAdjustCP: (player: 'attacker' | 'defender', amount: number, absolute?: boolean) => void;
  onAdjustVP: (player: 'attacker' | 'defender', amount: number, absolute?: boolean) => void;
  onPhaseChange: (phase: GamePhase, playerTurn: 'attacker' | 'defender') => void;
  onPhaseChangeComplete?: () => void;
  onOpenSecondaries: (player: 'attacker' | 'defender') => void;
  onScoreSecondary?: (player: 'attacker' | 'defender', secondaryName: string, vpAmount: number, details: string, option: string) => void;
  onRemoveSecondary?: (player: 'attacker' | 'defender', secondaryName: string) => Promise<void>;
  onAddSecondary?: (player: 'attacker' | 'defender', secondaryName: string) => Promise<void>;
  onRefresh: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export default function GameStateDisplay({
  playerCP,
  playerVP,
  attackerSecondaries,
  playerObjectives,
  attackerSecondaryProgress = {},
  attackerArmyName = '',
  attackerFaction = '',
  opponentCP,
  opponentVP,
  defenderSecondaries,
  opponentObjectives,
  defenderSecondaryProgress = {},
  defenderArmyName = '',
  defenderFaction = '',
  battleRound,
  currentPhase,
  currentTurn,
  firstTurn,
  sessionId,
  deploymentType,
  totalObjectives = 5,
  objectiveMarkers = [],
  allSecondaries = [],
  missionMode = 'tactical',
  onAdjustCP,
  onAdjustVP,
  onPhaseChange,
  onPhaseChangeComplete,
  onOpenSecondaries,
  onScoreSecondary,
  onRemoveSecondary,
  onAddSecondary,
  onRefresh,
  onShowToast
}: GameStateDisplayProps) {
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showCPTooltip, setShowCPTooltip] = useState<'attacker' | 'defender' | null>(null);
  const [playerCPSpent, setPlayerCPSpent] = useState({ round: 0, total: 0 });
  const [opponentCPSpent, setOpponentCPSpent] = useState({ round: 0, total: 0 });
  
  // Secondary detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSecondary, setSelectedSecondary] = useState<SecondaryObjective | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<'attacker' | 'defender'>('attacker');
  
  // Secondary selection modal state
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [selectionPlayer, setSelectionPlayer] = useState<'attacker' | 'defender'>('attacker');
  
  // Stratagem reference modal state
  const [stratagemModalOpen, setStratagemModalOpen] = useState(false);
  const [stratagemPlayer, setStratagemPlayer] = useState<'attacker' | 'defender'>('attacker');
  
  // Pre-fetched stratagems cache (fetch once, filter client-side)
  const [attackerStratagems, setAttackerStratagems] = useState<StratagemCache>({
    core: [], faction: [], targetFaction: null, targetDetachment: null, loaded: false
  });
  const [defenderStratagems, setDefenderStratagems] = useState<StratagemCache>({
    core: [], faction: [], targetFaction: null, targetDetachment: null, loaded: false
  });
  
  // Handle opening the detail modal for a secondary
  const handleOpenSecondaryDetail = useCallback((secondary: SecondaryObjective, player: 'attacker' | 'defender') => {
    setSelectedSecondary(secondary);
    setSelectedPlayer(player);
    setDetailModalOpen(true);
  }, []);
  
  // Handle scoring from detail modal
  const handleScoreFromDetail = useCallback((vpAmount: number, details: string, optionIndex: number) => {
    if (selectedSecondary && onScoreSecondary) {
      onScoreSecondary(selectedPlayer, selectedSecondary.name, vpAmount, details, `option-${optionIndex}`);
    }
    setDetailModalOpen(false);
  }, [selectedSecondary, selectedPlayer, onScoreSecondary]);
  
  // Handle discard from detail modal
  const handleDiscardFromDetail = useCallback(async () => {
    if (selectedSecondary && onRemoveSecondary) {
      try {
        await onRemoveSecondary(selectedPlayer, selectedSecondary.name);
        setDetailModalOpen(false);
        onShowToast(`Discarded ${selectedSecondary.name}`, 'warning');
      } catch (error) {
        onShowToast('Failed to discard secondary', 'error');
      }
    } else {
      // Fallback: open management modal if no remove handler
      setDetailModalOpen(false);
      onOpenSecondaries(selectedPlayer);
    }
  }, [selectedSecondary, selectedPlayer, onRemoveSecondary, onShowToast, onOpenSecondaries]);
  
  // Handle opening selection modal for adding a secondary
  const handleOpenSelectionModal = useCallback((player: 'attacker' | 'defender') => {
    setSelectionPlayer(player);
    setSelectionModalOpen(true);
  }, []);
  
  // Handle opening stratagem reference modal
  const handleOpenStratagemModal = useCallback((player: 'attacker' | 'defender') => {
    setStratagemPlayer(player);
    setStratagemModalOpen(true);
  }, []);
  
  // Handle selecting a secondary from the selection modal
  const handleSelectSecondary = useCallback(async (secondaryName: string) => {
    if (onAddSecondary) {
      try {
        await onAddSecondary(selectionPlayer, secondaryName);
        setSelectionModalOpen(false);
        onShowToast(`Added ${secondaryName}`, 'success');
      } catch (error) {
        onShowToast('Failed to add secondary', 'error');
      }
    } else {
      // Fallback: open management modal if no add handler
      setSelectionModalOpen(false);
      onOpenSecondaries(selectionPlayer);
    }
  }, [selectionPlayer, onAddSecondary, onShowToast, onOpenSecondaries]);
  
  // Calculate available secondaries for selection
  const availableSecondaries = useMemo(() => {
    const usedNames = new Set([...attackerSecondaries, ...defenderSecondaries]);
    return allSecondaries.filter(s => {
      // Not already in use
      if (usedNames.has(s.name)) return false;
      // Compatible with mission mode
      if (s.category !== 'Both' && s.category.toLowerCase() !== missionMode) return false;
      return true;
    });
  }, [allSecondaries, attackerSecondaries, defenderSecondaries, missionMode]);

  // Track mount status for portal (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Pre-fetch stratagems once when session loads (for both players)
  useEffect(() => {
    const fetchStratagemCache = async (player: 'attacker' | 'defender') => {
      try {
        // Fetch without phase filtering - we'll compute availability client-side
        const response = await fetch(`/api/sessions/${sessionId}/stratagems?player=${player}&phase=Any&turn=attacker`);
        if (response.ok) {
          const data = await response.json();
          const cache: StratagemCache = {
            core: (data.core?.stratagems || []).map((s: CachedStratagem & { availableNow?: boolean }) => ({
              id: s.id, name: s.name, cpCost: s.cpCost, type: s.type,
              when: s.when, target: s.target, effect: s.effect,
              triggerPhase: s.triggerPhase, isReactive: s.isReactive,
              source: s.source, faction: s.faction, detachment: s.detachment
            })),
            faction: (data.faction?.stratagems || []).map((s: CachedStratagem & { availableNow?: boolean }) => ({
              id: s.id, name: s.name, cpCost: s.cpCost, type: s.type,
              when: s.when, target: s.target, effect: s.effect,
              triggerPhase: s.triggerPhase, isReactive: s.isReactive,
              source: s.source, faction: s.faction, detachment: s.detachment
            })),
            targetFaction: data.targetFaction,
            targetDetachment: data.targetDetachment,
            loaded: true
          };
          if (player === 'attacker') {
            setAttackerStratagems(cache);
          } else {
            setDefenderStratagems(cache);
          }
        }
      } catch (error) {
        console.error(`Failed to pre-fetch ${player} stratagems:`, error);
      }
    };

    if (sessionId) {
      fetchStratagemCache('attacker');
      fetchStratagemCache('defender');
    }
  }, [sessionId]);

  // Compute stratagem availability based on current phase/turn
  const computeAvailability = useCallback((
    strat: CachedStratagem, 
    phase: string, 
    turn: 'attacker' | 'defender', 
    player: 'attacker' | 'defender'
  ): boolean => {
    // Phase match: check if stratagem can be used in current phase
    const phaseMatch = !strat.triggerPhase || strat.triggerPhase.length === 0 ||
      strat.triggerPhase.includes('Any') ||
      strat.triggerPhase.some(p => p.toLowerCase() === phase.toLowerCase());
    
    // Turn match: reactive stratagems available on opponent's turn, non-reactive on your turn
    const isPlayerTurn = turn === player;
    const turnMatch = strat.isReactive ? !isPlayerTurn : isPlayerTurn;
    
    return phaseMatch && turnMatch;
  }, []);

  // Memoized stratagems with computed availability for current player
  const computedStratagems = useMemo(() => {
    const cache = stratagemPlayer === 'attacker' ? attackerStratagems : defenderStratagems;
    if (!cache.loaded) return null;

    const addAvailability = (strats: CachedStratagem[]) => strats.map(s => ({
      ...s,
      availableNow: computeAvailability(s, currentPhase, currentTurn, stratagemPlayer)
    }));

    // Sort: available first, then by CP cost, then by name
    const sortStratagems = (a: CachedStratagem & { availableNow: boolean }, b: CachedStratagem & { availableNow: boolean }) => {
      if (a.availableNow !== b.availableNow) return a.availableNow ? -1 : 1;
      if (a.cpCost !== b.cpCost) return a.cpCost - b.cpCost;
      return a.name.localeCompare(b.name);
    };

    const core = addAvailability(cache.core).sort(sortStratagems);
    const faction = addAvailability(cache.faction).sort(sortStratagems);

    return {
      core,
      faction,
      targetFaction: cache.targetFaction,
      targetDetachment: cache.targetDetachment
    };
  }, [attackerStratagems, defenderStratagems, stratagemPlayer, currentPhase, currentTurn, computeAvailability]);

  // Fetch CP spent data
  useEffect(() => {
    const fetchCPSpent = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/cp-spent`);
        if (response.ok) {
          const data = await response.json();
          setPlayerCPSpent(data.player);
          setOpponentCPSpent(data.opponent);
        }
      } catch (error) {
        console.error('Failed to fetch CP spent data:', error);
      }
    };

    fetchCPSpent();
  }, [sessionId, battleRound, playerCP, opponentCP]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showCPTooltip && !target.closest('.cp-info-button')) {
        setShowCPTooltip(null);
      }
    };

    if (showCPTooltip) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCPTooltip]);

  const handleTurnChange = useCallback(async (round: number, playerTurn: 'attacker' | 'defender') => {
    // Store previous values for rollback
    const previousPhase = currentPhase;
    const previousTurn = currentTurn;
    const previousRound = battleRound;
    
    // Optimistic update
    onPhaseChange('Command' as GamePhase, playerTurn);
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/manual-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'change_turn',
          args: {
            direction: 'specific',
            round,
            player_turn: playerTurn
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to change turn');
      }

      const result = await response.json();
      
      if (result.success) {
        // Call completion callback to refresh timeline (after event is created)
        if (onPhaseChangeComplete) {
          await onPhaseChangeComplete();
        }
      } else {
        // Rollback on failure
        onPhaseChange(previousPhase as GamePhase, previousTurn);
        console.error('Turn change failed:', result.message);
      }
    } catch (error) {
      console.error('Error changing turn:', error);
      // Rollback on error
      onPhaseChange(previousPhase as GamePhase, previousTurn);
      throw error; // Re-throw for RoundTurnSelector to handle
    }
  }, [currentPhase, currentTurn, battleRound, sessionId, onPhaseChange, onPhaseChangeComplete]);
  const [editValue, setEditValue] = useState<string>('');
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);

  // Start editing a field
  const startEdit = (field: 'playerCP' | 'opponentCP' | 'playerVP' | 'opponentVP', currentValue: number) => {
    setEditingField(field);
    setEditValue(currentValue.toString());
  };

  // Save edited value
  const saveEdit = useCallback(() => {
    if (!editingField) return;
    
    const newValue = parseInt(editValue, 10);
    if (isNaN(newValue) || newValue < 0) {
      // Invalid input, cancel edit
      setEditingField(null);
      setEditValue('');
      return;
    }

    // Get current value to check if it actually changed
    let currentValue: number;
    if (editingField === 'playerCP') {
      currentValue = playerCP;
    } else if (editingField === 'opponentCP') {
      currentValue = opponentCP;
    } else if (editingField === 'playerVP') {
      currentValue = playerVP;
    } else if (editingField === 'opponentVP') {
      currentValue = opponentVP;
    } else {
      currentValue = 0;
    }

    // Only trigger update if value actually changed
    if (newValue !== currentValue) {
      if (editingField === 'playerCP') {
        onAdjustCP('attacker', newValue, true);
      } else if (editingField === 'opponentCP') {
        onAdjustCP('defender', newValue, true);
      } else if (editingField === 'playerVP') {
        onAdjustVP('attacker', newValue, true);
      } else if (editingField === 'opponentVP') {
        onAdjustVP('defender', newValue, true);
      }
    }

    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, playerCP, opponentCP, playerVP, opponentVP, onAdjustCP, onAdjustVP]);

  // Handle key press (Enter to save, Escape to cancel)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
      setEditValue('');
    }
  };

  // Handle escape key to close objectives modal and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showObjectivesModal) {
        setShowObjectivesModal(false);
      }
    };
    
    if (showObjectivesModal) {
      window.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showObjectivesModal]);

  // Calculate objective breakdown
  const objectiveBreakdown = useMemo(() => {
    const playerCount = objectiveMarkers.filter(obj => obj.controlledBy === 'attacker').length;
    const opponentCount = objectiveMarkers.filter(obj => obj.controlledBy === 'defender').length;
    const contestedCount = objectiveMarkers.filter(obj => obj.controlledBy === 'contested').length;
    const unclaimedCount = totalObjectives - playerCount - opponentCount - contestedCount;
    
    return {
      player: playerCount,
      opponent: opponentCount,
      contested: contestedCount,
      unclaimed: unclaimedCount
    };
  }, [objectiveMarkers, totalObjectives]);

  return (
    <div className="w-full bg-grimlog-slate">
      {/* Compact Header: Round/Turn + Phase (single row on mobile, wraps if needed) */}
      <div className="px-3 py-2 bg-grimlog-slate-dark border-b border-grimlog-steel">
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <RoundTurnSelector
            battleRound={battleRound}
            currentTurn={currentTurn}
            firstTurn={firstTurn}
            sessionId={sessionId}
            onTurnChange={handleTurnChange}
          />
          <PhaseControl
            currentPhase={currentPhase as GamePhase}
            currentTurn={currentTurn}
            battleRound={battleRound}
            sessionId={sessionId}
            onPhaseChange={onPhaseChange}
            onPhaseChangeComplete={onPhaseChangeComplete}
          />
        </div>
      </div>

      {/* Objective Control Bar - Visual button */}
      <div className="px-3 py-2 bg-grimlog-slate-dark border-b border-grimlog-steel">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-grimlog-orange text-base">📍</span>
          <span className="text-grimlog-black font-bold text-sm tracking-wider uppercase">
            Objectives ({playerObjectives + opponentObjectives}/{totalObjectives})
          </span>
        </div>
        
        {/* Visual Bar - Tap to open map */}
          <button
            onClick={() => setShowObjectivesModal(true)}
          className="w-full flex h-10 gap-0.5 rounded overflow-hidden border-2 border-grimlog-steel shadow-md transition-all active:scale-[0.98] cursor-pointer hover:border-grimlog-orange bg-white"
            title="Tap to open tactical map"
          >
          {/* Defender Segment (Green) */}
            {objectiveBreakdown.player > 0 && (
              <div 
              className="bg-grimlog-defender-bg flex items-center justify-center text-grimlog-defender-text font-bold text-base border-r border-grimlog-defender-border"
                style={{ width: `${(objectiveBreakdown.player / totalObjectives) * 100}%` }}
              >
                {objectiveBreakdown.player}
              </div>
            )}
            
            {/* Contested Segment */}
            {objectiveBreakdown.contested > 0 && (
              <div 
              className="bg-yellow-200 flex items-center justify-center text-yellow-800 font-bold text-base border-r border-yellow-400"
                style={{ width: `${(objectiveBreakdown.contested / totalObjectives) * 100}%` }}
              >
                {objectiveBreakdown.contested}
              </div>
            )}
            
            {/* Unclaimed Segment */}
            {objectiveBreakdown.unclaimed > 0 && (
              <div 
              className="bg-grimlog-slate flex items-center justify-center text-grimlog-steel font-bold text-base"
                style={{ width: `${(objectiveBreakdown.unclaimed / totalObjectives) * 100}%` }}
              >
                {objectiveBreakdown.unclaimed}
              </div>
            )}
            
          {/* Attacker Segment (Red) */}
            {objectiveBreakdown.opponent > 0 && (
              <div 
              className="bg-grimlog-attacker-bg flex items-center justify-center text-grimlog-attacker-text font-bold text-base border-l border-grimlog-attacker-border"
                style={{ width: `${(objectiveBreakdown.opponent / totalObjectives) * 100}%` }}
              >
                {objectiveBreakdown.opponent}
              </div>
            )}
          </button>
      </div>

      {/* Two-Panel Dashboard: Defender Left, Attacker Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 bg-grimlog-slate p-1">
        
        {/* DEFENDER Panel - LEFT SIDE */}
        <div className="p-3 bg-grimlog-defender-bg border-l-4 border-r border-t border-b border-grimlog-defender-border">
          <div className="flex flex-col mb-2">
            <h3 className="text-sm font-extrabold text-grimlog-defender-accent tracking-wider uppercase drop-shadow-sm">
              DEFENDER
            </h3>
            {defenderArmyName && (
              <span className="text-lg md:text-xl font-black text-grimlog-defender-text truncate drop-shadow-sm" title={defenderArmyName}>
                {defenderArmyName}
              </span>
            )}
            {defenderFaction && (
              <span className="text-xs font-bold text-grimlog-defender-accent font-mono uppercase">
                {defenderFaction}
              </span>
            )}
          </div>

          {/* Stats Grid - CP/VP */}
          <div className="grid grid-cols-2 gap-2">
            {/* Command Points */}
            <div className="flex items-center justify-between py-3 px-3 bg-grimlog-defender-bg-dark border-2 border-grimlog-defender-border">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-grimlog-defender-accent text-2xl">⚡</span>
                <span className="text-grimlog-defender-text font-extrabold text-xl tracking-wider">CP:</span>
                {editingField === 'opponentCP' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-16 px-2 py-1 bg-white text-grimlog-defender-text font-mono text-3xl font-bold border-2 border-grimlog-defender-border"
                  />
                ) : (
                  <span
                    onClick={() => startEdit('opponentCP', opponentCP)}
                    className="text-grimlog-defender-text font-mono text-3xl font-bold cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {opponentCP}
                  </span>
                )}
                
                {/* CP Info Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCPTooltip(showCPTooltip === 'defender' ? null : 'defender');
                  }}
                  className="cp-info-button relative ml-1 w-5 h-5 flex items-center justify-center text-xs text-grimlog-steel hover:text-grimlog-defender-text border border-grimlog-steel hover:border-grimlog-defender-border rounded-full"
                  title="CP info"
                >
                  i
                  {showCPTooltip === 'defender' && (
                    <div className="absolute left-full ml-2 z-50 bg-white border-2 border-grimlog-steel p-2 rounded shadow-lg text-xs whitespace-nowrap pointer-events-none">
                      <div className="text-grimlog-orange font-bold mb-1">CP SPENT:</div>
                      <div className="text-grimlog-steel">Round: <span className="text-grimlog-defender-text font-mono font-bold">{opponentCPSpent.round}</span></div>
                      <div className="text-grimlog-steel">Total: <span className="text-grimlog-defender-text font-mono font-bold">{opponentCPSpent.total}</span></div>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Victory Points */}
            <div className="flex items-center justify-between py-3 px-3 bg-grimlog-defender-bg-dark border-2 border-grimlog-defender-border">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-grimlog-defender-accent text-2xl">🎯</span>
                <span className="text-grimlog-defender-text font-extrabold text-xl tracking-wider">VP:</span>
                {editingField === 'opponentVP' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-16 px-2 py-1 bg-white text-grimlog-defender-text font-mono text-3xl font-bold border-2 border-grimlog-defender-border"
                  />
                ) : (
                  <span
                    onClick={() => startEdit('opponentVP', opponentVP)}
                    className="text-grimlog-defender-text font-mono text-3xl font-bold cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {opponentVP}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Objectives - Full width */}
          <div className="mt-2 py-2 px-3 bg-grimlog-defender-bg-dark border-2 border-grimlog-defender-border">
            <div className="flex gap-2">
              {[0, 1].map(idx => {
                const secondaryName = defenderSecondaries[idx];
                const secondary = secondaryName ? allSecondaries.find(s => s.name === secondaryName) || null : null;
                const progress = secondary ? defenderSecondaryProgress[secondary.name] || null : null;
                
                return (
                  <SecondaryMiniCard
                    key={idx}
                    secondary={secondary}
                    progress={progress}
                    player="defender"
                    battleRound={battleRound}
                    currentTurn={currentTurn as 'attacker' | 'defender'}
                    onOpenDetail={handleOpenSecondaryDetail}
                    onAddSecondary={handleOpenSelectionModal}
                  />
                );
              })}
            </div>
          </div>

          {/* Stratagem Quick Reference Button */}
          <button
            onClick={() => handleOpenStratagemModal('defender')}
            className="mt-2 w-full py-2 px-3 bg-grimlog-defender-bg-dark border-2 border-grimlog-defender-border hover:border-grimlog-defender-accent flex items-center justify-center gap-2 transition-all"
          >
            <span className="text-grimlog-orange text-lg">◆</span>
            <span className="text-grimlog-defender-text font-bold text-sm tracking-wider uppercase">
              STRATAGEMS
            </span>
          </button>
        </div>

        {/* ATTACKER Panel - RIGHT SIDE */}
        <div className="p-3 bg-grimlog-attacker-bg border-l-4 border-r border-t border-b border-grimlog-attacker-border">
          <div className="flex flex-col mb-2">
            <h3 className="text-sm font-extrabold text-grimlog-attacker-accent tracking-wider uppercase drop-shadow-sm">
              ATTACKER
            </h3>
            {attackerArmyName && (
              <span className="text-lg md:text-xl font-black text-grimlog-attacker-text truncate drop-shadow-sm" title={attackerArmyName}>
                {attackerArmyName}
              </span>
            )}
            {attackerFaction && (
              <span className="text-xs font-bold text-grimlog-attacker-accent font-mono uppercase">
                {attackerFaction}
              </span>
            )}
          </div>

          {/* Stats Grid - CP/VP */}
          <div className="grid grid-cols-2 gap-2">
            {/* Command Points */}
            <div className="flex items-center justify-between py-3 px-3 bg-grimlog-attacker-bg-dark border-2 border-grimlog-attacker-border">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-grimlog-attacker-accent text-2xl">⚡</span>
                <span className="text-grimlog-attacker-text font-extrabold text-xl tracking-wider">CP:</span>
                {editingField === 'playerCP' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-16 px-2 py-1 bg-white text-grimlog-attacker-text font-mono text-3xl font-bold border-2 border-grimlog-attacker-border"
                  />
                ) : (
                  <span
                    onClick={() => startEdit('playerCP', playerCP)}
                    className="text-grimlog-attacker-text font-mono text-3xl font-bold cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {playerCP}
                  </span>
                )}
                
                {/* CP Info Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCPTooltip(showCPTooltip === 'attacker' ? null : 'attacker');
                  }}
                  className="cp-info-button relative ml-1 w-5 h-5 flex items-center justify-center text-xs text-grimlog-steel hover:text-grimlog-attacker-text border border-grimlog-steel hover:border-grimlog-attacker-border rounded-full"
                  title="CP info"
                >
                  i
                  {showCPTooltip === 'attacker' && (
                    <div className="absolute left-full ml-2 z-50 bg-white border-2 border-grimlog-steel p-2 rounded shadow-lg text-xs whitespace-nowrap pointer-events-none">
                      <div className="text-grimlog-orange font-bold mb-1">CP SPENT:</div>
                      <div className="text-grimlog-steel">Round: <span className="text-grimlog-attacker-text font-mono font-bold">{playerCPSpent.round}</span></div>
                      <div className="text-grimlog-steel">Total: <span className="text-grimlog-attacker-text font-mono font-bold">{playerCPSpent.total}</span></div>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Victory Points */}
            <div className="flex items-center justify-between py-3 px-3 bg-grimlog-attacker-bg-dark border-2 border-grimlog-attacker-border">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-grimlog-attacker-accent text-2xl">🎯</span>
                <span className="text-grimlog-attacker-text font-extrabold text-xl tracking-wider">VP:</span>
                {editingField === 'playerVP' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-16 px-2 py-1 bg-white text-grimlog-attacker-text font-mono text-3xl font-bold border-2 border-grimlog-attacker-border"
                  />
                ) : (
                  <span
                    onClick={() => startEdit('playerVP', playerVP)}
                    className="text-grimlog-attacker-text font-mono text-3xl font-bold cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {playerVP}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Objectives - Full width */}
          <div className="mt-2 py-2 px-3 bg-grimlog-attacker-bg-dark border-2 border-grimlog-attacker-border">
            <div className="flex gap-2">
              {[0, 1].map(idx => {
                const secondaryName = attackerSecondaries[idx];
                const secondary = secondaryName ? allSecondaries.find(s => s.name === secondaryName) || null : null;
                const progress = secondary ? attackerSecondaryProgress[secondary.name] || null : null;
                
                return (
                  <SecondaryMiniCard
                    key={idx}
                    secondary={secondary}
                    progress={progress}
                    player="attacker"
                    battleRound={battleRound}
                    currentTurn={currentTurn as 'attacker' | 'defender'}
                    onOpenDetail={handleOpenSecondaryDetail}
                    onAddSecondary={handleOpenSelectionModal}
                  />
                );
              })}
            </div>
          </div>

          {/* Stratagem Quick Reference Button */}
          <button
            onClick={() => handleOpenStratagemModal('attacker')}
            className="mt-2 w-full py-2 px-3 bg-grimlog-attacker-bg-dark border-2 border-grimlog-attacker-border hover:border-grimlog-attacker-accent flex items-center justify-center gap-2 transition-all"
          >
            <span className="text-grimlog-orange text-lg">◆</span>
            <span className="text-grimlog-attacker-text font-bold text-sm tracking-wider uppercase">
              STRATAGEMS
            </span>
          </button>
        </div>
      </div>
      
      {/* Secondary Detail Modal - Rendered via portal */}
      {isMounted && detailModalOpen && createPortal(
        <SecondaryDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          secondary={selectedSecondary}
          progress={selectedSecondary 
            ? (selectedPlayer === 'attacker' 
                ? attackerSecondaryProgress[selectedSecondary.name] 
                : defenderSecondaryProgress[selectedSecondary.name]) || null 
            : null
          }
          player={selectedPlayer}
          missionMode={missionMode}
          currentRound={battleRound}
          currentTurn={currentTurn}
          onScore={handleScoreFromDetail}
          onDiscard={handleDiscardFromDetail}
        />,
        document.body
      )}
      
      {/* Secondary Selection Modal - Rendered via portal */}
      {isMounted && selectionModalOpen && createPortal(
        <SecondarySelectionModal
          isOpen={selectionModalOpen}
          onClose={() => setSelectionModalOpen(false)}
          player={selectionPlayer}
          missionMode={missionMode}
          availableSecondaries={availableSecondaries}
          onSelect={handleSelectSecondary}
          onShowToast={onShowToast}
        />,
        document.body
      )}
      
      {/* Stratagem Reference Modal - Rendered via portal */}
      {isMounted && stratagemModalOpen && createPortal(
        <StratagemReferenceModal
          isOpen={stratagemModalOpen}
          onClose={() => setStratagemModalOpen(false)}
          currentPhase={currentPhase}
          currentTurn={currentTurn}
          player={stratagemPlayer}
          playerCP={stratagemPlayer === 'attacker' ? playerCP : opponentCP}
          coreStratagems={computedStratagems?.core || []}
          factionStratagems={computedStratagems?.faction || []}
          targetFaction={computedStratagems?.targetFaction || null}
          targetDetachment={computedStratagems?.targetDetachment || null}
        />,
        document.body
      )}
      
      {/* Tactical Map Modal - Refactored to Bottom Sheet */}
      {isMounted && showObjectivesModal && createPortal(
        <ObjectiveMapModal
          isOpen={showObjectivesModal}
          onClose={() => setShowObjectivesModal(false)}
          deploymentType={deploymentType}
          objectives={objectiveMarkers}
          battleRound={battleRound}
          sessionId={sessionId}
          onObjectiveClick={async (objectiveNumber, newState) => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}/manual-action`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                  toolName: 'update_objective_control',
                  args: {
                    objective_number: objectiveNumber,
                    controlled_by: newState
                  }
                })
              });

              if (response.ok) {
                const result = await response.json();
                onShowToast(result.message, 'success');
                
                await new Promise(resolve => setTimeout(resolve, 100));
                await onRefresh();
              } else {
                const error = await response.json();
                onShowToast(error.error || 'Failed to update objective', 'error');
                await onRefresh();
              }
            } catch (error) {
              console.error('Error updating objective:', error);
              onShowToast('Failed to update objective', 'error');
              await onRefresh();
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}
