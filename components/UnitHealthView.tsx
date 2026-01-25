'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUnits } from '@/lib/hooks/useUnits';
import { useModelUpdate } from '@/lib/hooks/useModelUpdate';
import { useUnitAbilities, UnitAbility } from '@/lib/hooks/useUnitAbilities';
import { GamePhase } from '@/lib/phaseRelevance';

type UnitStatusView = 'phase-abilities' | 'all-units';

interface ModelState {
  role: string;
  currentWounds: number;
  maxWounds: number;
}

interface UnitInstance {
  id: string;
  unitName: string;
  owner: 'attacker' | 'defender';
  datasheet: string;
  startingModels: number;
  currentModels: number;
  startingWounds: number | null;
  currentWounds: number | null;
  woundsPerModel?: number | null;
  modelsArray?: string | null;
  attachedToUnit?: string | null;
  isDestroyed: boolean;
  isBattleShocked: boolean;
  activeEffects: string[];
  iconUrl?: string | null;
}

interface UnitHealthViewProps {
  sessionId: string;
  onClose?: () => void;
}

// Helper component for displaying individual models
interface UnitModelListProps {
  unitId: string;
  sessionId: string;
  models: ModelState[];
  onRefresh: () => void;
}

function UnitModelList({ unitId, sessionId, models, onRefresh }: UnitModelListProps) {
  const { updateModelWounds, destroyModel } = useModelUpdate({
    sessionId,
    unitId,
    onSuccess: () => onRefresh()
  });

  const getRoleIcon = (role: string): string => {
    switch (role) {
      case 'sergeant':
      case 'leader':
        return '⭐';
      case 'heavy_weapon':
        return '🔫';
      case 'special_weapon':
        return '⚡';
      case 'regular':
      default:
        return '◆';
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'sergeant':
      case 'leader':
        return 'Leader';
      case 'heavy_weapon':
        return 'Heavy Wpn';
      case 'special_weapon':
        return 'Special Wpn';
      case 'regular':
      default:
        return 'Trooper';
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'sergeant':
      case 'leader':
        return 'border-l-grimlog-amber';
      case 'heavy_weapon':
        return 'border-l-grimlog-red';
      case 'special_weapon':
        return 'border-l-grimlog-orange';
      case 'regular':
      default:
        return 'border-l-grimlog-steel';
    }
  };

  const getHealthColor = (currentWounds: number, maxWounds: number): string => {
    if (currentWounds === 0) return 'bg-grimlog-steel';
    const percent = (currentWounds / maxWounds) * 100;
    if (percent === 100) return 'bg-grimlog-green';
    if (percent > 66) return 'bg-grimlog-green';
    if (percent > 33) return 'bg-grimlog-amber';
    return 'bg-grimlog-red';
  };

  const getHealthStatusIcon = (currentWounds: number, maxWounds: number): string => {
    if (currentWounds === 0) return '💀';
    const percent = (currentWounds / maxWounds) * 100;
    if (percent === 100) return '🟢';
    if (percent > 66) return '🟢';
    if (percent > 33) return '🟡';
    return '🔴';
  };

  const aliveModels = models.filter(m => m.currentWounds > 0);

  if (aliveModels.length === 0) {
    return (
      <div className="text-center text-grimlog-red text-xs py-2 font-bold mt-2">
        💀 ALL MODELS DESTROYED
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-2">
      {aliveModels.map((model, idx) => {
        const icon = getRoleIcon(model.role);
        const roleColor = getRoleColor(model.role);
        const healthColor = getHealthColor(model.currentWounds, model.maxWounds);
        const fillPercent = model.maxWounds > 0 ? `${(model.currentWounds / model.maxWounds) * 100}%` : '0%';
        const statusIcon = getHealthStatusIcon(model.currentWounds, model.maxWounds);
        const roleLabel = getRoleLabel(model.role);

        return (
          <div
            key={idx}
            className={`flex items-center gap-1.5 p-1.5 bg-grimlog-black border-l-2 ${roleColor}`}
          >
            {/* Status Icon */}
            <span className="text-sm flex-shrink-0">{statusIcon}</span>

            {/* Role Info */}
            <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
              <span className="text-xs">{icon}</span>
              <span className="text-xs text-grimlog-light-steel font-mono truncate">
                {roleLabel}
              </span>
            </div>

            {/* Wound Bar */}
            <div className="flex-1 h-3 bg-grimlog-gray border border-grimlog-steel overflow-hidden relative">
              <div
                className={`h-full ${healthColor} transition-all duration-300`}
                style={{ width: fillPercent }}
              />
            </div>

            {/* Wounds Count */}
            <span className="text-xs font-bold text-grimlog-light-steel font-mono flex-shrink-0">
              {model.currentWounds}/{model.maxWounds}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateModelWounds(idx, -1);
                }}
                disabled={model.currentWounds === 0}
                className="w-5 h-5 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-steel text-white text-xs font-bold disabled:opacity-30 transition-colors"
              >
                -
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateModelWounds(idx, 1);
                }}
                disabled={model.currentWounds >= model.maxWounds}
                className="w-5 h-5 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-steel text-grimlog-black text-xs font-bold disabled:opacity-30 transition-colors"
              >
                +
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  destroyModel(idx);
                }}
                className="w-5 h-5 bg-grimlog-black hover:bg-grimlog-red border border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-colors"
                title="Destroy model"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Map generic roles to specific categories
const getRoleCategory = (datasheet: string): string => {
  const lower = datasheet.toLowerCase();
  
  if (lower.includes('captain') || lower.includes('lieutenant') || 
      lower.includes('chaplain') || lower.includes('librarian') ||
      lower.includes('hive tyrant') || lower.includes('broodlord') ||
      lower.includes('swarmlord') || lower.includes('commander') || lower.includes('lord')) {
    return 'characters';
  }
  
  if (lower.includes('intercessor') || lower.includes('tactical') ||
      lower.includes('termagant') || lower.includes('hormagaunt') ||
      lower.includes('warrior')) {
    return 'battleline';
  }
  
  if (lower.includes('rhino') || lower.includes('razorback') ||
      lower.includes('impul') || lower.includes('transport')) {
    return 'transports';
  }
  
  return 'other';
};

// Abilities that should be excluded from phase-specific views even if marked as "Any"
const NON_PHASE_RELEVANT_ABILITIES = new Set([
  'Deep Strike',
  'DEEP STRIKE',
  'Leader',
  'LEADER',
  'Embarking within transports',
  'EMBARKING WITHIN TRANSPORTS',
  'Scout',
  'SCOUT',
  'Infiltrators',
  'INFILTRATORS',
  'Stealth',
  'STEALTH',
]);

// Special phase values that should be excluded from phase-specific views
const NON_PHASE_SPECIFIC_VALUES = new Set(['Deployment', 'Keyword', 'General']);

// Helper function to check if an ability is relevant to a specific phase
const isAbilityPhaseRelevant = (ability: UnitAbility, currentPhase: GamePhase): boolean => {
  // Exclude abilities with special phase values (Deployment, Keyword, General)
  if (ability.triggerPhase.some(phase => NON_PHASE_SPECIFIC_VALUES.has(phase))) {
    return false;
  }
  
  // Exclude legacy non-phase-relevant abilities (backward compatibility)
  if (NON_PHASE_RELEVANT_ABILITIES.has(ability.name)) {
    return false;
  }
  
  // If ability has specific phase triggers, check if current phase matches
  if (ability.triggerPhase.includes(currentPhase)) {
    return true;
  }
  
  // If ability is marked as "Any" but is reactive, include it (reactive abilities are phase-relevant)
  if (ability.triggerPhase.includes('Any') && ability.isReactive) {
    return true;
  }
  
  // For faction abilities marked as "Any", include them (they're always relevant)
  if (ability.type === 'faction' && ability.triggerPhase.includes('Any')) {
    return true;
  }
  
  // For other "Any" abilities, exclude them from phase-specific views
  // (they're always-on but not actionable in specific phases)
  return false;
};


// Helper component for rendering an ability card
interface AbilityCardProps {
  ability: UnitAbility;
  keyPrefix: string;
  ownerColor: 'attacker' | 'defender';
}

function AbilityCard({ ability, keyPrefix, ownerColor }: AbilityCardProps) {
  const abilityIcon = ability.type === 'core' ? '●' : 
                     ability.type === 'faction' ? '◆' :
                     ability.type === 'leader' ? '⭐' :
                     ability.type === 'wargear' ? '⚙' : '✦';
  const isAnyPhase = ability.triggerPhase.includes('Any');
  
  return (
    <div 
      className="p-2 bg-grimlog-gray border border-grimlog-steel hover:border-grimlog-orange transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{abilityIcon}</span>
          <span className="text-grimlog-orange font-bold text-xs">{ability.name}</span>
        </div>
        {!isAnyPhase && (
          <div className="px-1.5 py-0.5 bg-grimlog-orange text-grimlog-black text-xs font-bold rounded">
            {ability.triggerPhase.join('/')}
          </div>
        )}
      </div>
      <div className="text-grimlog-light-steel text-xs line-clamp-2">
        {ability.description || 'See datasheet for details'}
      </div>
      {ability.triggerSubphase && (
        <div className="text-grimlog-steel text-xs mt-1">
          📍 {ability.triggerSubphase}
        </div>
      )}
      {ability.isReactive && (
        <div className="text-grimlog-amber text-xs mt-1">
          ⚡ Reactive (opponent&apos;s turn)
        </div>
      )}
    </div>
  );
}

export default function UnitHealthView({ sessionId, onClose }: UnitHealthViewProps) {
  const { units, loading, error, refetch, updateUnit: updateUnitHook } = useUnits(sessionId, {
    ttl: 60000,
    autoFetch: true
  });
  
  const [unitStatusView, setUnitStatusView] = useState<UnitStatusView>('phase-abilities');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showModelsForUnit, setShowModelsForUnit] = useState<Set<string>>(new Set());
  
  // Session data for phase/round
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('Command');
  const [battleRound, setBattleRound] = useState<number>(1);
  
  // Fetch abilities for phase-aware view
  const { 
    attacker: attackerAbilitiesData,
    defender: defenderAbilitiesData,
    loading: abilitiesLoading 
  } = useUnitAbilities(sessionId, currentPhase, {
    ttl: 300000,
    autoFetch: unitStatusView === 'phase-abilities'
  });

  // Fetch session data for phase/round
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentPhase(data.currentPhase || 'Command');
          setBattleRound(data.battleRound || 1);
        }
      } catch (error) {
        console.error('Failed to fetch session data:', error);
      }
    };
    
    fetchSessionData();
  }, [sessionId]);

  // Toggle unit expansion
  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
        // Also hide models when collapsing
        setShowModelsForUnit(modelsSet => {
          const newModelsSet = new Set(modelsSet);
          newModelsSet.delete(unitId);
          return newModelsSet;
        });
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  // Toggle individual model view for a unit
  const toggleModelsView = (unitId: string) => {
    setShowModelsForUnit(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  // Get attached characters for a unit
  const getAttachedCharacters = (unitName: string, owner: 'attacker' | 'defender'): UnitInstance[] => {
    return units.filter(u => u.attachedToUnit === unitName && u.owner === owner);
  };

  // Calculate health percentage
  const getHealthPercent = (unit: UnitInstance): number => {
    if (unit.isDestroyed) return 0;
    return unit.startingModels > 0 ? (unit.currentModels / unit.startingModels) * 100 : 0;
  };

  // Calculate army stats
  const calculateArmyStats = (owner: 'attacker' | 'defender') => {
    const ownerUnits = units.filter(u => u.owner === owner);
    
    return {
      totalUnits: ownerUnits.length,
      aliveUnits: ownerUnits.filter(u => !u.isDestroyed).length,
      totalModels: ownerUnits.reduce((sum, u) => sum + u.startingModels, 0),
      currentModels: ownerUnits.reduce((sum, u) => sum + u.currentModels, 0),
      totalWounds: ownerUnits.reduce((sum, u) => sum + (u.startingWounds || u.startingModels), 0),
      currentWounds: ownerUnits.reduce((sum, u) => sum + (u.currentWounds || u.currentModels), 0)
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-grimlog-black">
        <div className="text-center">
          <div className="text-4xl text-grimlog-orange mb-4 animate-pulse">◎</div>
          <p className="text-grimlog-green font-mono">LOADING UNIT DATA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-grimlog-black">
        <div className="text-center p-6 border-2 border-grimlog-red bg-grimlog-gray">
          <div className="text-4xl text-grimlog-red mb-4">⚠</div>
          <p className="text-grimlog-red font-bold mb-2">ERROR</p>
          <p className="text-grimlog-light-steel text-sm">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold text-sm btn-depth hover-lift"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-grimlog-black">
        <div className="text-center p-6 border-2 border-grimlog-steel bg-grimlog-gray max-w-md">
          <div className="text-4xl text-grimlog-orange mb-4">◈</div>
          <p className="text-grimlog-orange font-bold mb-2">NO UNITS INITIALIZED</p>
          <p className="text-grimlog-light-steel text-sm mb-4">
            Units will be automatically created from army lists when the battle begins.
            You can also manually add units during the game.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-grimlog-green hover:bg-green-600 text-grimlog-black font-bold text-sm btn-depth hover-lift"
            >
              BACK TO DASHBOARD
            </button>
          )}
        </div>
      </div>
    );
  }

  const playerUnits = units.filter(u => u.owner === 'attacker' && !u.attachedToUnit);
  const opponentUnits = units.filter(u => u.owner === 'defender' && !u.attachedToUnit);
  
  const playerStats = calculateArmyStats('attacker');
  const opponentStats = calculateArmyStats('defender');

  return (
    <div className="h-full bg-grimlog-black overflow-hidden">
      <div className="h-full flex flex-col overflow-hidden">
        {/* Global Toggle */}
        <section className="flex items-center justify-center mb-4 pb-4 border-b-2 border-grimlog-steel flex-shrink-0">
          <div className="flex gap-1 bg-grimlog-gray border-2 border-grimlog-orange btn-depth">
            <button
              onClick={() => setUnitStatusView('phase-abilities')}
              className={`px-4 py-2 text-sm font-bold tracking-wider transition-all ${
                unitStatusView === 'phase-abilities'
                  ? 'bg-grimlog-orange text-grimlog-black active-depth'
                  : 'text-grimlog-light-steel hover:bg-grimlog-steel'
              }`}
            >
              PHASE ABILITIES
            </button>
            <button
              onClick={() => setUnitStatusView('all-units')}
              className={`px-4 py-2 text-sm font-bold tracking-wider transition-all ${
                unitStatusView === 'all-units'
                  ? 'bg-grimlog-orange text-grimlog-black active-depth'
                  : 'text-grimlog-light-steel hover:bg-grimlog-steel'
              }`}
            >
              ALL UNITS
            </button>
          </div>
        </section>

        {/* Two Column Layout */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Left Column: Attacker - Unified */}
              <div className="p-4 bg-grimlog-gray border-2 border-grimlog-red flex flex-col h-full min-h-0 overflow-hidden">
                {/* Health Bar Content */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-grimlog-red tracking-wider uppercase">
                      ATTACKER
                    </h3>
                  </div>

                  {/* Army Strength Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-grimlog-light-steel font-mono">ARMY STRENGTH</span>
                      <span className="text-sm font-bold text-grimlog-red">
                        {playerStats.currentModels} / {playerStats.totalModels} MODELS
                      </span>
                    </div>
                    <div className="w-full h-6 bg-grimlog-black border-2 border-grimlog-steel overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 flex items-center justify-center ${
                          playerStats.totalModels > 0 && (playerStats.currentModels / playerStats.totalModels) * 100 > 66 ? 'bg-grimlog-green' :
                          playerStats.totalModels > 0 && (playerStats.currentModels / playerStats.totalModels) * 100 > 33 ? 'bg-grimlog-amber' :
                          'bg-grimlog-red'
                        }`}
                        style={{ width: `${playerStats.totalModels > 0 ? (playerStats.currentModels / playerStats.totalModels) * 100 : 0}%` }}
                      >
                        {playerStats.totalModels > 0 && (playerStats.currentModels / playerStats.totalModels) * 100 > 15 && (
                          <span className="text-xs font-bold text-grimlog-black">
                            {Math.round((playerStats.currentModels / playerStats.totalModels) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Wounds Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-grimlog-light-steel font-mono">TOTAL WOUNDS</span>
                      <span className="text-sm font-bold text-grimlog-red">
                        {playerStats.currentWounds} / {playerStats.totalWounds}
                      </span>
                    </div>
                    <div className="w-full h-4 bg-grimlog-black border border-grimlog-steel overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          playerStats.totalWounds > 0 && (playerStats.currentWounds / playerStats.totalWounds) * 100 > 66 ? 'bg-grimlog-green' :
                          playerStats.totalWounds > 0 && (playerStats.currentWounds / playerStats.totalWounds) * 100 > 33 ? 'bg-grimlog-amber' :
                          'bg-grimlog-red'
                        }`}
                        style={{ width: `${playerStats.totalWounds > 0 ? (playerStats.currentWounds / playerStats.totalWounds) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-grimlog-steel">
                    <div className="text-center">
                      <div className="text-xs text-grimlog-light-steel font-mono mb-1">UNITS</div>
                      <div className="text-lg font-bold text-grimlog-red">{playerStats.aliveUnits}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-grimlog-light-steel font-mono mb-1">MODELS</div>
                      <div className="text-lg font-bold text-grimlog-red">{playerStats.currentModels}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-grimlog-light-steel font-mono mb-1">WOUNDS</div>
                      <div className="text-lg font-bold text-grimlog-red">{playerStats.currentWounds}</div>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="pt-4 border-t-2 border-grimlog-steel flex-1 flex flex-col min-h-0">
                  {/* Content based on global toggle */}
                  {unitStatusView === 'phase-abilities' ? (
                    <div className="p-3 bg-grimlog-black border border-grimlog-steel flex-1 overflow-y-auto min-h-0">
                      <div className="text-xs text-grimlog-light-steel mb-2">
                        Round {battleRound} • {currentPhase} Phase
                      </div>
                      {abilitiesLoading ? (
                        <div className="text-center text-grimlog-light-steel text-xs py-4">
                          Loading abilities...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Army Abilities Section */}
                          {attackerAbilitiesData.armyAbilities.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs text-grimlog-red font-bold uppercase tracking-wider border-b border-grimlog-steel pb-1">
                                ARMY ABILITIES
                              </div>
                              <div className="space-y-1">
                                {attackerAbilitiesData.armyAbilities.map((ability) => (
                                  <AbilityCard
                                    key={`army-${ability.name}`}
                                    ability={ability}
                                    keyPrefix="army"
                                    ownerColor="attacker"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unit Abilities Section */}
                          {attackerAbilitiesData.units.length > 0 && (
                            <div className="space-y-2">
                              <div className={`text-xs text-grimlog-red font-bold uppercase tracking-wider border-b border-grimlog-steel pb-1 ${attackerAbilitiesData.armyAbilities.length > 0 ? 'mt-2' : ''}`}>
                                UNIT ABILITIES
                              </div>
                              <div className="space-y-2">
                                {attackerAbilitiesData.units.map((unitWithAbilities) => (
                                  <div key={unitWithAbilities.unitId} className="space-y-1">
                                    <div className="text-xs text-grimlog-red font-bold mb-1">
                                      {unitWithAbilities.unitName}
                                    </div>
                                    {unitWithAbilities.abilities.map((ability) => (
                                      <AbilityCard
                                        key={`${unitWithAbilities.unitId}-${ability.name}`}
                                        ability={ability}
                                        keyPrefix={unitWithAbilities.unitId}
                                        ownerColor="attacker"
                                      />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Empty State */}
                          {attackerAbilitiesData.armyAbilities.length === 0 && attackerAbilitiesData.units.length === 0 && (
                            <div className="text-center text-grimlog-light-steel text-xs py-4">
                              No units with {currentPhase} phase abilities
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                      {units.filter(u => u.owner === 'attacker' && !u.isDestroyed).map((unit) => {
                        const healthPercent = getHealthPercent(unit);
                        const healthColor = healthPercent <= 25 ? 'text-grimlog-red' : 
                                          healthPercent <= 50 ? 'text-grimlog-amber' : 'text-grimlog-green';
                        const isExpanded = expandedUnits.has(unit.id);
                        const showModels = showModelsForUnit.has(unit.id);
                        
                        // Parse models array if available
                        let parsedModels: ModelState[] | null = null;
                        if (unit.modelsArray) {
                          try {
                            parsedModels = JSON.parse(unit.modelsArray);
                          } catch (e) {
                            console.warn('Failed to parse modelsArray:', e);
                          }
                        }
                        const hasIndividualModels = parsedModels && parsedModels.length > 0;
                        
                        return (
                          <div 
                            key={unit.id}
                            className="bg-grimlog-black border border-grimlog-steel hover:border-grimlog-red transition-colors"
                          >
                            {/* Collapsed Header */}
                            <div 
                              className="p-2 cursor-pointer"
                              onClick={() => toggleUnitExpansion(unit.id)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-base">
                                    {healthPercent <= 25 ? '🔴' : healthPercent <= 50 ? '🟡' : '🟢'}
                                  </div>
                                  <div className="text-grimlog-red font-bold text-xs">{unit.unitName}</div>
                                  <div className="text-grimlog-light-steel text-xs">
                                    {isExpanded ? '▼' : '▶'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`font-bold text-xs ${healthColor}`}>
                                    {unit.currentModels}/{unit.startingModels}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, { isDestroyed: true, currentModels: 0, currentWounds: 0 });
                                    }}
                                    className="px-1.5 py-0.5 bg-grimlog-black hover:bg-grimlog-red border border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded Controls */}
                            {isExpanded && (
                              <div className="border-t border-grimlog-steel p-2 bg-grimlog-gray">
                                {/* Quick Actions */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  {/* Models Control */}
                                  <div>
                                    <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                                      MODELS
                                    </label>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateUnitHook(unit.id, {
                                            currentModels: Math.max(0, unit.currentModels - 1)
                                          });
                                        }}
                                        disabled={unit.currentModels === 0}
                                        className="flex-1 px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-steel text-white text-xs font-bold disabled:opacity-50 transition-colors"
                                      >
                                        -1
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateUnitHook(unit.id, {
                                            currentModels: Math.min(unit.startingModels, unit.currentModels + 1)
                                          });
                                        }}
                                        disabled={unit.currentModels >= unit.startingModels}
                                        className="flex-1 px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-steel text-grimlog-black text-xs font-bold disabled:opacity-50 transition-colors"
                                      >
                                        +1
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Wounds Control - only show for multi-wound units */}
                                  {unit.startingWounds && unit.startingWounds > unit.startingModels && (
                                    <div>
                                      <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                                        WOUNDS
                                      </label>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateUnitHook(unit.id, {
                                              currentWounds: Math.max(0, (unit.currentWounds || 0) - 1)
                                            });
                                          }}
                                          disabled={(unit.currentWounds || 0) === 0}
                                          className="flex-1 px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-steel text-white text-xs font-bold disabled:opacity-50 transition-colors"
                                        >
                                          -1
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateUnitHook(unit.id, {
                                              currentWounds: Math.min(unit.startingWounds || 0, (unit.currentWounds || 0) + 1)
                                            });
                                          }}
                                          disabled={(unit.currentWounds || 0) >= (unit.startingWounds || 0)}
                                          className="flex-1 px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-steel text-grimlog-black text-xs font-bold disabled:opacity-50 transition-colors"
                                        >
                                          +1
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Additional Actions */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, {
                                        isBattleShocked: !unit.isBattleShocked
                                      });
                                    }}
                                    className={`px-2 py-1 text-xs font-bold border transition-colors ${
                                      unit.isBattleShocked
                                        ? 'bg-grimlog-red border-grimlog-red text-white hover:bg-red-600'
                                        : 'bg-grimlog-gray border-grimlog-steel text-grimlog-orange hover:bg-grimlog-steel'
                                    }`}
                                  >
                                    {unit.isBattleShocked ? '✓ SHOCKED' : 'BATTLESHOCK'}
                                  </button>
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, {
                                        isDestroyed: true,
                                        currentModels: 0,
                                        currentWounds: 0
                                      });
                                    }}
                                    className="px-2 py-1 bg-grimlog-black hover:bg-grimlog-red border border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-colors"
                                  >
                                    DESTROY
                                  </button>
                                </div>
                                
                                {/* Individual Models Section */}
                                {hasIndividualModels && (
                                  <div className="border-t border-grimlog-steel pt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleModelsView(unit.id);
                                      }}
                                      className="w-full px-2 py-1 bg-grimlog-steel hover:bg-grimlog-orange text-grimlog-light-steel hover:text-grimlog-black text-xs font-bold transition-colors flex items-center justify-between"
                                    >
                                      <span>INDIVIDUAL MODELS</span>
                                      <span>{showModels ? '▼' : '▶'}</span>
                                    </button>
                                    
                                    {showModels && parsedModels && (
                                      <UnitModelList
                                        unitId={unit.id}
                                        sessionId={sessionId}
                                        models={parsedModels}
                                        onRefresh={refetch}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Defender - Unified */}
              <div className="p-4 bg-grimlog-gray border-2 border-grimlog-green flex flex-col h-full min-h-0 overflow-hidden">
                {/* Health Bar Content */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-grimlog-green tracking-wider uppercase">
                      DEFENDER
                    </h3>
                  </div>

                  {/* Army Strength Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-grimlog-light-steel font-mono">ARMY STRENGTH</span>
                      <span className="text-sm font-bold text-grimlog-green">
                        {opponentStats.currentModels} / {opponentStats.totalModels} MODELS
                      </span>
                    </div>
                    <div className="w-full h-6 bg-grimlog-black border-2 border-grimlog-steel overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 flex items-center justify-center ${
                          opponentStats.totalModels > 0 && (opponentStats.currentModels / opponentStats.totalModels) * 100 > 66 ? 'bg-grimlog-green' :
                          opponentStats.totalModels > 0 && (opponentStats.currentModels / opponentStats.totalModels) * 100 > 33 ? 'bg-grimlog-amber' :
                          'bg-grimlog-red'
                        }`}
                        style={{ width: `${opponentStats.totalModels > 0 ? (opponentStats.currentModels / opponentStats.totalModels) * 100 : 0}%` }}
                      >
                        {opponentStats.totalModels > 0 && (opponentStats.currentModels / opponentStats.totalModels) * 100 > 15 && (
                          <span className="text-xs font-bold text-grimlog-black">
                            {Math.round((opponentStats.currentModels / opponentStats.totalModels) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Wounds Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-grimlog-light-steel font-mono">TOTAL WOUNDS</span>
                      <span className="text-sm font-bold text-grimlog-green">
                        {opponentStats.currentWounds} / {opponentStats.totalWounds}
                      </span>
                    </div>
                    <div className="w-full h-4 bg-grimlog-black border border-grimlog-steel overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          opponentStats.totalWounds > 0 && (opponentStats.currentWounds / opponentStats.totalWounds) * 100 > 66 ? 'bg-grimlog-green' :
                          opponentStats.totalWounds > 0 && (opponentStats.currentWounds / opponentStats.totalWounds) * 100 > 33 ? 'bg-grimlog-amber' :
                          'bg-grimlog-red'
                        }`}
                        style={{ width: `${opponentStats.totalWounds > 0 ? (opponentStats.currentWounds / opponentStats.totalWounds) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-grimlog-steel">
                    <div className="text-center">
                      <div className="text-xs text-grimlog-light-steel font-mono mb-1">UNITS</div>
                      <div className="text-lg font-bold text-grimlog-green">{opponentStats.aliveUnits}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-grimlog-light-steel font-mono mb-1">MODELS</div>
                      <div className="text-lg font-bold text-grimlog-green">{opponentStats.currentModels}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-grimlog-light-steel font-mono mb-1">WOUNDS</div>
                      <div className="text-lg font-bold text-grimlog-green">{opponentStats.currentWounds}</div>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="pt-4 border-t-2 border-grimlog-steel flex-1 flex flex-col min-h-0">
                  {/* Content based on global toggle */}
                  {unitStatusView === 'phase-abilities' ? (
                    <div className="p-3 bg-grimlog-black border border-grimlog-steel flex-1 overflow-y-auto min-h-0">
                      <div className="text-xs text-grimlog-light-steel mb-2">
                        Round {battleRound} • {currentPhase} Phase
                      </div>
                      {abilitiesLoading ? (
                        <div className="text-center text-grimlog-light-steel text-xs py-4">
                          Loading abilities...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Army Abilities Section */}
                          {defenderAbilitiesData.armyAbilities.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs text-grimlog-green font-bold uppercase tracking-wider border-b border-grimlog-steel pb-1">
                                ARMY ABILITIES
                              </div>
                              <div className="space-y-1">
                                {defenderAbilitiesData.armyAbilities.map((ability) => (
                                  <AbilityCard
                                    key={`army-${ability.name}`}
                                    ability={ability}
                                    keyPrefix="army"
                                    ownerColor="defender"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unit Abilities Section */}
                          {defenderAbilitiesData.units.length > 0 && (
                            <div className="space-y-2">
                              <div className={`text-xs text-grimlog-green font-bold uppercase tracking-wider border-b border-grimlog-steel pb-1 ${defenderAbilitiesData.armyAbilities.length > 0 ? 'mt-2' : ''}`}>
                                UNIT ABILITIES
                              </div>
                              <div className="space-y-2">
                                {defenderAbilitiesData.units.map((unitWithAbilities) => (
                                  <div key={unitWithAbilities.unitId} className="space-y-1">
                                    <div className="text-xs text-grimlog-green font-bold mb-1">
                                      {unitWithAbilities.unitName}
                                    </div>
                                    {unitWithAbilities.abilities.map((ability) => (
                                      <AbilityCard
                                        key={`${unitWithAbilities.unitId}-${ability.name}`}
                                        ability={ability}
                                        keyPrefix={unitWithAbilities.unitId}
                                        ownerColor="defender"
                                      />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Empty State */}
                          {defenderAbilitiesData.armyAbilities.length === 0 && defenderAbilitiesData.units.length === 0 && (
                            <div className="text-center text-grimlog-light-steel text-xs py-4">
                              No units with {currentPhase} phase abilities
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                      {units.filter(u => u.owner === 'defender' && !u.isDestroyed).map((unit) => {
                        const healthPercent = getHealthPercent(unit);
                        const healthColor = healthPercent <= 25 ? 'text-grimlog-red' : 
                                          healthPercent <= 50 ? 'text-grimlog-amber' : 'text-grimlog-green';
                        const isExpanded = expandedUnits.has(unit.id);
                        const showModels = showModelsForUnit.has(unit.id);
                        
                        // Parse models array if available
                        let parsedModels: ModelState[] | null = null;
                        if (unit.modelsArray) {
                          try {
                            parsedModels = JSON.parse(unit.modelsArray);
                          } catch (e) {
                            console.warn('Failed to parse modelsArray:', e);
                          }
                        }
                        const hasIndividualModels = parsedModels && parsedModels.length > 0;
                        
                        return (
                          <div 
                            key={unit.id}
                            className="bg-grimlog-black border border-grimlog-steel hover:border-grimlog-green transition-colors"
                          >
                            {/* Collapsed Header */}
                            <div 
                              className="p-2 cursor-pointer"
                              onClick={() => toggleUnitExpansion(unit.id)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-base">
                                    {healthPercent <= 25 ? '🔴' : healthPercent <= 50 ? '🟡' : '🟢'}
                                  </div>
                                  <div className="text-grimlog-green font-bold text-xs">{unit.unitName}</div>
                                  <div className="text-grimlog-light-steel text-xs">
                                    {isExpanded ? '▼' : '▶'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`font-bold text-xs ${healthColor}`}>
                                    {unit.currentModels}/{unit.startingModels}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, { isDestroyed: true, currentModels: 0, currentWounds: 0 });
                                    }}
                                    className="px-1.5 py-0.5 bg-grimlog-black hover:bg-grimlog-red border border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded Controls */}
                            {isExpanded && (
                              <div className="border-t border-grimlog-steel p-2 bg-grimlog-gray">
                                {/* Quick Actions */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  {/* Models Control */}
                                  <div>
                                    <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                                      MODELS
                                    </label>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateUnitHook(unit.id, {
                                            currentModels: Math.max(0, unit.currentModels - 1)
                                          });
                                        }}
                                        disabled={unit.currentModels === 0}
                                        className="flex-1 px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-steel text-white text-xs font-bold disabled:opacity-50 transition-colors"
                                      >
                                        -1
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateUnitHook(unit.id, {
                                            currentModels: Math.min(unit.startingModels, unit.currentModels + 1)
                                          });
                                        }}
                                        disabled={unit.currentModels >= unit.startingModels}
                                        className="flex-1 px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-steel text-grimlog-black text-xs font-bold disabled:opacity-50 transition-colors"
                                      >
                                        +1
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Wounds Control - only show for multi-wound units */}
                                  {unit.startingWounds && unit.startingWounds > unit.startingModels && (
                                    <div>
                                      <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                                        WOUNDS
                                      </label>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateUnitHook(unit.id, {
                                              currentWounds: Math.max(0, (unit.currentWounds || 0) - 1)
                                            });
                                          }}
                                          disabled={(unit.currentWounds || 0) === 0}
                                          className="flex-1 px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-steel text-white text-xs font-bold disabled:opacity-50 transition-colors"
                                        >
                                          -1
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateUnitHook(unit.id, {
                                              currentWounds: Math.min(unit.startingWounds || 0, (unit.currentWounds || 0) + 1)
                                            });
                                          }}
                                          disabled={(unit.currentWounds || 0) >= (unit.startingWounds || 0)}
                                          className="flex-1 px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-steel text-grimlog-black text-xs font-bold disabled:opacity-50 transition-colors"
                                        >
                                          +1
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Additional Actions */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, {
                                        isBattleShocked: !unit.isBattleShocked
                                      });
                                    }}
                                    className={`px-2 py-1 text-xs font-bold border transition-colors ${
                                      unit.isBattleShocked
                                        ? 'bg-grimlog-red border-grimlog-red text-white hover:bg-red-600'
                                        : 'bg-grimlog-gray border-grimlog-steel text-grimlog-orange hover:bg-grimlog-steel'
                                    }`}
                                  >
                                    {unit.isBattleShocked ? '✓ SHOCKED' : 'BATTLESHOCK'}
                                  </button>
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, {
                                        isDestroyed: true,
                                        currentModels: 0,
                                        currentWounds: 0
                                      });
                                    }}
                                    className="px-2 py-1 bg-grimlog-black hover:bg-grimlog-red border border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-colors"
                                  >
                                    DESTROY
                                  </button>
                                </div>
                                
                                {/* Individual Models Section */}
                                {hasIndividualModels && (
                                  <div className="border-t border-grimlog-steel pt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleModelsView(unit.id);
                                      }}
                                      className="w-full px-2 py-1 bg-grimlog-steel hover:bg-grimlog-orange text-grimlog-light-steel hover:text-grimlog-black text-xs font-bold transition-colors flex items-center justify-between"
                                    >
                                      <span>INDIVIDUAL MODELS</span>
                                      <span>{showModels ? '▼' : '▶'}</span>
                                    </button>
                                    
                                    {showModels && parsedModels && (
                                      <UnitModelList
                                        unitId={unit.id}
                                        sessionId={sessionId}
                                        models={parsedModels}
                                        onRefresh={refetch}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
      </div>
    </div>
  );
}
