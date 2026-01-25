'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUnits } from '@/lib/hooks/useUnits';
import { useModelUpdate } from '@/lib/hooks/useModelUpdate';
import { useUnitAbilities, UnitAbility } from '@/lib/hooks/useUnitAbilities';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';
import { GamePhase } from '@/lib/phaseRelevance';

type UnitStatusView = 'phase-abilities' | 'all-units';
type ArmyTab = 'attacker' | 'defender';

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
  faction?: string | null;
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
  fullDatasheet?: {
    compositionData?: string | null;
    wounds?: number | null;
  } | null;
}

interface UnitHealthSheetProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helper component for displaying individual models
interface UnitModelListProps {
  sessionId: string;
  unit: UnitInstance;
  models: ModelState[];
  onRefresh: () => void;
}

function UnitModelList({ sessionId, unit, models, onRefresh }: UnitModelListProps) {
  const unitId = unit.id;
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

  const mismatch = models.length !== unit.currentModels;

  const buildBaselineModels = useCallback((count: number): ModelState[] => {
    const baseWounds = unit.fullDatasheet?.wounds || unit.woundsPerModel || 1;
    const compositionData = unit.fullDatasheet?.compositionData || null;

    const result: ModelState[] = [];

    if (compositionData) {
      try {
        const parsed = JSON.parse(compositionData);
        if (Array.isArray(parsed)) {
          for (const comp of parsed) {
            const c = Math.max(0, Number(comp.count || 0));
            const role = typeof comp.role === 'string' ? comp.role : 'regular';
            const wounds = Math.max(1, Number(comp.woundsPerModel || baseWounds || 1));
            for (let i = 0; i < c; i++) {
              result.push({ role, currentWounds: wounds, maxWounds: wounds });
            }
          }
        }
      } catch {
        // ignore and fallback
      }
    }

    // Fallback if no compositionData or it didn't produce anything
    if (result.length === 0) {
      for (let i = 0; i < count; i++) {
        result.push({ role: 'regular', currentWounds: baseWounds, maxWounds: baseWounds });
      }
      return result;
    }

    // Ensure we hit requested count (datasheets often store minimum-size compositionData)
    const regularTemplate = result.find(m => m.role === 'regular') || result[result.length - 1];
    while (result.length < count) {
      result.push({
        role: regularTemplate?.role || 'regular',
        currentWounds: regularTemplate?.maxWounds || baseWounds,
        maxWounds: regularTemplate?.maxWounds || baseWounds,
      });
    }

    return result.slice(0, count);
  }, [unit.fullDatasheet?.compositionData, unit.fullDatasheet?.wounds, unit.woundsPerModel]);

  const applyDamageToMatchTotal = (ms: ModelState[], desiredTotal: number): ModelState[] => {
    const next = ms.map(m => ({ ...m }));
    const full = next.reduce((sum, m) => sum + m.maxWounds, 0);
    let remaining = Math.max(0, Math.min(desiredTotal, full));

    // Start everyone at full, then subtract damage from the end
    for (let i = 0; i < next.length; i++) next[i].currentWounds = next[i].maxWounds;

    let toRemove = full - remaining;
    for (let i = next.length - 1; i >= 0 && toRemove > 0; i--) {
      const canRemove = Math.min(toRemove, next[i].currentWounds);
      next[i].currentWounds -= canRemove;
      toRemove -= canRemove;
    }

    // Keep invariant: alive models only
    return next.filter(m => m.currentWounds > 0);
  };

  const syncModels = useCallback(async () => {
    // Build baseline for startingModels to correct startingWounds
    const baselineStarting = buildBaselineModels(unit.startingModels);
    const startingWounds = baselineStarting.reduce((sum, m) => sum + m.maxWounds, 0);

    // Build baseline for currentModels to correct modelsArray
    const baselineCurrent = buildBaselineModels(unit.currentModels).slice(0, unit.currentModels);
    const fullCurrent = baselineCurrent.reduce((sum, m) => sum + m.maxWounds, 0);

    // If unit looks "full" but startingWounds/currentWounds were wrong, treat as full after sync
    const looksFull = unit.currentModels === unit.startingModels && unit.currentWounds === unit.startingWounds;
    const desiredCurrentWounds = looksFull ? fullCurrent : (unit.currentWounds ?? fullCurrent);

    const nextModels = applyDamageToMatchTotal(baselineCurrent, desiredCurrentWounds);

    await fetch(`/api/sessions/${sessionId}/units/${unitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelsArray: nextModels,
        startingWounds,
        woundsPerModel: baselineStarting.length > 0 ? Math.max(...baselineStarting.map(m => m.maxWounds)) : (unit.woundsPerModel || 1),
      }),
    });

    onRefresh();
  }, [buildBaselineModels, onRefresh, sessionId, unit.currentModels, unit.currentWounds, unit.startingModels, unit.startingWounds, unit.woundsPerModel, unitId]);

  const adjustMaxWounds = useCallback(async (modelIndex: number, delta: number) => {
    const next = models.map(m => ({ ...m }));
    if (modelIndex < 0 || modelIndex >= next.length) return;

    const m = next[modelIndex];
    const newMax = Math.max(1, Math.min(20, m.maxWounds + delta));
    const maxDelta = newMax - m.maxWounds;
    m.maxWounds = newMax;
    // Assume wargear increases also heal to full for the new max; decreasing clamps
    m.currentWounds = Math.max(1, Math.min(m.maxWounds, m.currentWounds + maxDelta));

    const startingBaseline = buildBaselineModels(unit.startingModels);
    const oldStartingTotal = startingBaseline.reduce((sum, mm) => sum + mm.maxWounds, 0);
    const nextStartingTotal = (unit.startingWounds ?? oldStartingTotal) + maxDelta; // keep cumulative starting wounds changes

    await fetch(`/api/sessions/${sessionId}/units/${unitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelsArray: next,
        startingWounds: nextStartingTotal,
        woundsPerModel: Math.max(...next.map(mm => mm.maxWounds)),
      }),
    });

    onRefresh();
  }, [buildBaselineModels, models, onRefresh, sessionId, unit.startingModels, unitId]);

  if (models.length === 0) {
    return (
      <div className="mt-3">
        {unit.currentModels > 0 ? (
          <div className="p-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm">
            <div className="text-sm font-black text-gray-900">Individual Models</div>
            <div className="text-xs text-gray-700 mt-1">
              Model details are missing ({models.length}/{unit.currentModels}).
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); syncModels(); }}
              className="mt-2 px-3 py-2 bg-grimlog-orange hover:brightness-110 text-grimlog-black font-bold rounded-lg shadow-sm"
            >
              Sync Models
            </button>
          </div>
        ) : (
          <div className="text-center text-grimlog-red text-xs py-2 font-bold mt-2">
            💀 ALL MODELS DESTROYED
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {/* Header + Repair */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-black uppercase tracking-wider text-gray-800">
          Models ({models.length})
        </div>
        {mismatch && (
          <button
            onClick={(e) => { e.stopPropagation(); syncModels(); }}
            className="px-2 py-1 text-xs font-bold bg-grimlog-orange text-grimlog-black rounded shadow-sm"
            title="Fix model list to match the unit's current model count"
          >
            Sync Models ({models.length}/{unit.currentModels})
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {models.map((model, modelIdx) => {
          const icon = getRoleIcon(model.role);
          const roleLabel = getRoleLabel(model.role);
          const roleColor = getRoleColor(model.role);
          const healthColor = getHealthColor(model.currentWounds, model.maxWounds);
          const fillPercent = model.maxWounds > 0 ? `${(model.currentWounds / model.maxWounds) * 100}%` : '0%';
          const statusIcon = getHealthStatusIcon(model.currentWounds, model.maxWounds);

          return (
            <div
              key={modelIdx}
              className={`bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden ${roleColor}`}
            >
              <div className="p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">{statusIcon}</span>
                    <span className="text-xs">{icon}</span>
                    <span className="text-xs font-mono text-gray-800 truncate">
                      #{modelIdx + 1} {roleLabel}
                    </span>
                  </div>
                  <div className="text-xs font-black text-gray-900">
                    {model.currentWounds}/{model.maxWounds}
                  </div>
                </div>

                <div className="mt-2 h-2 bg-grimlog-slate border border-grimlog-steel/30 rounded-full overflow-hidden">
                  <div className={`h-full ${healthColor}`} style={{ width: fillPercent }} />
                </div>

                {/* Wounds controls */}
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateModelWounds(modelIdx, -1); }}
                    disabled={model.currentWounds <= 0}
                    className="h-9 bg-grimlog-red hover:bg-grimlog-darkRed disabled:bg-gray-200 text-white font-black rounded-md btn-depth-sm disabled:opacity-50"
                    aria-label={`Model ${modelIdx + 1}: -1 wound`}
                  >
                    −
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateModelWounds(modelIdx, 1); }}
                    disabled={model.currentWounds >= model.maxWounds}
                    className="h-9 bg-grimlog-green hover:bg-grimlog-darkGreen disabled:bg-gray-200 text-grimlog-black font-black rounded-md btn-depth-sm disabled:opacity-50"
                    aria-label={`Model ${modelIdx + 1}: +1 wound`}
                  >
                    +
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); destroyModel(modelIdx); }}
                    className="h-9 bg-white hover:bg-grimlog-red border-2 border-grimlog-red text-grimlog-red hover:text-white font-black rounded-md btn-depth-sm"
                    title="Destroy model"
                    aria-label={`Model ${modelIdx + 1}: destroy`}
                  >
                    ✕
                  </button>
                </div>

                {/* Max-wounds controls (wargear like relic shields) */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-mono text-gray-600">
                    MAX WOUNDS
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustMaxWounds(modelIdx, -1); }}
                      disabled={model.maxWounds <= 1}
                      className="w-8 h-8 bg-white border border-gray-300 hover:border-grimlog-orange text-gray-800 font-black rounded btn-depth-sm disabled:opacity-40"
                      title="Decrease max wounds"
                    >
                      −
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustMaxWounds(modelIdx, 1); }}
                      className="w-8 h-8 bg-white border border-gray-300 hover:border-grimlog-orange text-gray-800 font-black rounded btn-depth-sm"
                      title="Increase max wounds (e.g. relic shield)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper component for rendering an ability card
interface AbilityCardProps {
  ability: UnitAbility;
  ownerColor: 'attacker' | 'defender';
}

function AbilityCard({ ability, ownerColor }: AbilityCardProps) {
  const abilityIcon = ability.type === 'core' ? '●' : 
                     ability.type === 'faction' ? '◆' :
                     ability.type === 'leader' ? '⭐' :
                     ability.type === 'wargear' ? '⚙' : '✦';
  const isAnyPhase = ability.triggerPhase.includes('Any');
  
  return (
    <div className="p-4 bg-white border-2 border-gray-300 hover:border-grimlog-orange transition-colors rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-700">{abilityIcon}</span>
          <span className="text-gray-900 font-black text-sm uppercase tracking-wide">{ability.name}</span>
        </div>
        {!isAnyPhase && (
          <div className="px-2 py-0.5 bg-grimlog-orange text-grimlog-black text-xs font-bold rounded shadow-sm">
            {ability.triggerPhase.join('/')}
          </div>
        )}
      </div>
      <div className="text-gray-700 text-xs leading-snug line-clamp-2">
        {ability.description || 'See datasheet for details'}
      </div>
      {ability.triggerSubphase && (
        <div className="text-gray-600 text-xs mt-1">
          📍 {ability.triggerSubphase}
        </div>
      )}
      {ability.isReactive && (
        <div className="text-grimlog-amber text-xs mt-1 font-bold">
          ⚡ Reactive (opponent&apos;s turn)
        </div>
      )}
    </div>
  );
}

export default function UnitHealthSheet({ sessionId, isOpen, onClose }: UnitHealthSheetProps) {
  const { units, loading, error, refetch, updateUnit: updateUnitHook } = useUnits(sessionId, {
    ttl: 60000,
    autoFetch: true
  });
  
  const [activeTab, setActiveTab] = useState<ArmyTab>('attacker');
  const [unitStatusView, setUnitStatusView] = useState<UnitStatusView>('phase-abilities');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showModelsForUnit, setShowModelsForUnit] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState(false);
  
  // Session data for phase/round
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('Command');
  const [battleRound, setBattleRound] = useState<number>(1);
  
  // Drag state for bottom sheet
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  // Mount check for portal
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Fetch abilities for phase-aware view
  const { 
    attacker: attackerAbilitiesData,
    defender: defenderAbilitiesData,
    loading: abilitiesLoading 
  } = useUnitAbilities(sessionId, currentPhase, {
    ttl: 300000,
    autoFetch: unitStatusView === 'phase-abilities' && isOpen
  });

  // Build icon requests from units (requires faction)
  const unitIconRequests = useMemo(() => 
    units
      .filter(u => u.faction) // Only request icons for units with faction data
      .map(u => ({ unitName: u.datasheet || u.unitName, faction: u.faction! })),
    [units]
  );

  // Fetch icons for all units
  const { icons: unitIcons } = useUnitIcons(unitIconRequests, { autoFetch: isOpen && unitIconRequests.length > 0 });

  // Helper to get icon for a unit
  const getIconForUnit = useCallback((unit: UnitInstance): { url: string | null; isImage: boolean } => {
    if (!unit.faction) return { url: null, isImage: false };
    const key = `${unit.faction}:${unit.datasheet || unit.unitName}`;
    const iconUrl = unitIcons[key] || null;
    const icon = getUnitIcon(iconUrl, unit.datasheet || unit.unitName);
    return { url: icon, isImage: isCustomIcon(icon) };
  }, [unitIcons]);

  // Fetch session data for phase/round
  useEffect(() => {
    if (!isOpen) return;
    
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
  }, [sessionId, isOpen]);

  // Toggle unit expansion
  const toggleUnitExpansion = useCallback((unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
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
  }, []);

  // Toggle individual model view for a unit
  const toggleModelsView = useCallback((unitId: string) => {
    setShowModelsForUnit(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  }, []);

  // Calculate health percentage
  const getHealthPercent = (unit: UnitInstance): number => {
    if (unit.isDestroyed) return 0;
    return unit.startingModels > 0 ? (unit.currentModels / unit.startingModels) * 100 : 0;
  };

  // Calculate army stats
  const calculateArmyStats = useCallback((owner: 'attacker' | 'defender') => {
    const ownerUnits = units.filter(u => u.owner === owner);
    
    return {
      totalUnits: ownerUnits.length,
      aliveUnits: ownerUnits.filter(u => !u.isDestroyed).length,
      totalModels: ownerUnits.reduce((sum, u) => sum + u.startingModels, 0),
      currentModels: ownerUnits.reduce((sum, u) => sum + u.currentModels, 0),
      totalWounds: ownerUnits.reduce((sum, u) => sum + (u.startingWounds || u.startingModels), 0),
      currentWounds: ownerUnits.reduce((sum, u) => sum + (u.currentWounds || u.currentModels), 0)
    };
  }, [units]);

  // Drag handling for swipe-to-close
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStartY(clientY);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const offset = Math.max(0, clientY - dragStartY);
    setDragOffset(offset);
  };

  const handleDragEnd = () => {
    if (dragOffset > 100) {
      onClose();
    }
    setIsDragging(false);
    setDragOffset(0);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const attackerStats = useMemo(() => calculateArmyStats('attacker'), [calculateArmyStats]);
  const defenderStats = useMemo(() => calculateArmyStats('defender'), [calculateArmyStats]);
  
  const activeStats = activeTab === 'attacker' ? attackerStats : defenderStats;
  const activeAbilities = activeTab === 'attacker' ? attackerAbilitiesData : defenderAbilitiesData;
  const tabColor = activeTab === 'attacker' ? 'grimlog-red' : 'grimlog-green';

  if (!isMounted || !isOpen) return null;

  const sheetContent = (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`relative bg-grimlog-slate-light border-t-2 border-grimlog-steel flex flex-col max-h-[85vh] transition-transform duration-300 ease-out shadow-2xl rounded-t-2xl overflow-hidden ${
          isOpen && !isDragging ? 'translate-y-0' : ''
        }`}
        style={{
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          animation: isOpen && !isDragging ? 'slideUp 0.3s ease-out' : undefined
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div 
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none bg-grimlog-slate-dark border-b border-grimlog-steel"
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header with Army Tabs - Embedded Stats */}
        <div className="px-4 py-3 flex-shrink-0 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="flex items-stretch gap-2">
            {/* Attacker Tab */}
            <button
              onClick={() => setActiveTab('attacker')}
              className={`flex-1 p-3 transition-all border-2 rounded-lg shadow-sm active:scale-[0.99] ${
                activeTab === 'attacker'
                  ? 'bg-grimlog-attacker-bg border-grimlog-attacker-border'
                  : 'bg-white border-gray-300 hover:border-grimlog-attacker-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold text-sm uppercase tracking-wider ${
                  activeTab === 'attacker' ? 'text-grimlog-attacker-accent' : 'text-gray-800'
                }`}>
                  ATTACKER
                </span>
                <span className={`text-lg font-bold font-mono ${
                  activeTab === 'attacker' ? 'text-grimlog-attacker-text' : 'text-gray-900'
                }`}>
                  {attackerStats.totalModels > 0 
                    ? `${Math.round((attackerStats.currentModels / attackerStats.totalModels) * 100)}%` 
                    : '0%'}
                </span>
              </div>
              {/* Embedded Health Bar */}
              <div className="w-full h-2 bg-grimlog-slate border border-grimlog-steel/40 rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    attackerStats.totalModels > 0 && (attackerStats.currentModels / attackerStats.totalModels) * 100 > 66 ? 'bg-grimlog-green' :
                    attackerStats.totalModels > 0 && (attackerStats.currentModels / attackerStats.totalModels) * 100 > 33 ? 'bg-grimlog-amber' :
                    'bg-grimlog-red'
                  }`}
                  style={{ width: `${attackerStats.totalModels > 0 ? (attackerStats.currentModels / attackerStats.totalModels) * 100 : 0}%` }}
                />
              </div>
              {/* Compact Stats */}
              <div className={`text-xs font-mono ${
                activeTab === 'attacker' ? 'text-grimlog-attacker-accent' : 'text-gray-600'
              }`}>
                {attackerStats.aliveUnits}u • {attackerStats.currentModels}m • {attackerStats.currentWounds}w
              </div>
            </button>

            {/* Defender Tab */}
            <button
              onClick={() => setActiveTab('defender')}
              className={`flex-1 p-3 transition-all border-2 rounded-lg shadow-sm active:scale-[0.99] ${
                activeTab === 'defender'
                  ? 'bg-grimlog-defender-bg border-grimlog-defender-border'
                  : 'bg-white border-gray-300 hover:border-grimlog-defender-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold text-sm uppercase tracking-wider ${
                  activeTab === 'defender' ? 'text-grimlog-defender-accent' : 'text-gray-800'
                }`}>
                  DEFENDER
                </span>
                <span className={`text-lg font-bold font-mono ${
                  activeTab === 'defender' ? 'text-grimlog-defender-text' : 'text-gray-900'
                }`}>
                  {defenderStats.totalModels > 0 
                    ? `${Math.round((defenderStats.currentModels / defenderStats.totalModels) * 100)}%` 
                    : '0%'}
                </span>
              </div>
              {/* Embedded Health Bar */}
              <div className="w-full h-2 bg-grimlog-slate border border-grimlog-steel/40 rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    defenderStats.totalModels > 0 && (defenderStats.currentModels / defenderStats.totalModels) * 100 > 66 ? 'bg-grimlog-green' :
                    defenderStats.totalModels > 0 && (defenderStats.currentModels / defenderStats.totalModels) * 100 > 33 ? 'bg-grimlog-amber' :
                    'bg-grimlog-red'
                  }`}
                  style={{ width: `${defenderStats.totalModels > 0 ? (defenderStats.currentModels / defenderStats.totalModels) * 100 : 0}%` }}
                />
              </div>
              {/* Compact Stats */}
              <div className={`text-xs font-mono ${
                activeTab === 'defender' ? 'text-grimlog-defender-accent' : 'text-gray-600'
              }`}>
                {defenderStats.aliveUnits}u • {defenderStats.currentModels}m • {defenderStats.currentWounds}w
              </div>
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-12 h-auto flex items-center justify-center bg-white hover:bg-grimlog-slate border-2 border-gray-300 hover:border-grimlog-orange text-gray-700 hover:text-grimlog-orange transition-all rounded-lg shadow-sm active:scale-[0.99]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Toggle */}
        <div className="px-4 pb-3 flex-shrink-0 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="flex gap-0.5 bg-white border-2 border-grimlog-steel rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={() => setUnitStatusView('phase-abilities')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-all ${
                unitStatusView === 'phase-abilities'
                  ? 'bg-grimlog-orange text-grimlog-black'
                  : 'text-grimlog-steel hover:bg-grimlog-slate'
              }`}
            >
              PHASE ABILITIES
            </button>
            <button
              onClick={() => setUnitStatusView('all-units')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-all ${
                unitStatusView === 'all-units'
                  ? 'bg-grimlog-orange text-grimlog-black'
                  : 'text-grimlog-steel hover:bg-grimlog-slate'
              }`}
            >
              ALL UNITS
            </button>
          </div>
        </div>

        {/* Scrollable Content Area - iPad Optimized */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 unit-sheet-scroll no-tap-highlight">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-4xl text-grimlog-orange mb-4 animate-pulse">◎</div>
                <p className="text-grimlog-green font-mono text-sm">LOADING UNIT DATA...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center p-4 border-2 border-grimlog-red bg-grimlog-gray">
                <div className="text-3xl text-grimlog-red mb-2">⚠</div>
                <p className="text-grimlog-red font-bold mb-2">ERROR</p>
                <p className="text-grimlog-light-steel text-sm mb-3">{error}</p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold text-sm"
                >
                  RETRY
                </button>
              </div>
            </div>
          ) : units.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center p-5 border-2 border-gray-300 bg-white rounded-lg shadow-sm">
                <div className="text-3xl text-grimlog-orange mb-2">◈</div>
                <p className="text-gray-900 font-black uppercase tracking-wider mb-2">No Units</p>
                <p className="text-gray-700 text-sm">
                  Units will appear once armies are initialized.
                </p>
              </div>
            </div>
          ) : unitStatusView === 'phase-abilities' ? (
            // Phase Abilities View
            <div className="space-y-3">
              <div className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg shadow-sm flex items-center justify-between">
                <div className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Phase Abilities
                </div>
                <div className="text-xs font-mono text-gray-700">
                  Round {battleRound} • {currentPhase}
                </div>
              </div>
              
              {abilitiesLoading ? (
                <div className="text-center text-gray-600 text-xs py-4">
                  Loading abilities...
                </div>
              ) : (
                <>
                  {/* Army Abilities */}
                  {activeAbilities.armyAbilities.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-grimlog-orange">◆</span>
                        <span className="text-xs text-gray-800 font-black uppercase tracking-wider">
                          Army Abilities
                        </span>
                        <div className="flex-1 h-px bg-grimlog-steel/40" />
                      </div>
                      <div className="space-y-2">
                        {activeAbilities.armyAbilities.map((ability) => (
                          <AbilityCard
                            key={`army-${ability.name}`}
                            ability={ability}
                            ownerColor={activeTab}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unit Abilities */}
                  {activeAbilities.units.length > 0 && (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 px-1 ${activeAbilities.armyAbilities.length > 0 ? 'mt-4' : ''}`}>
                        <span className="text-grimlog-orange">⚔</span>
                        <span className="text-xs text-gray-800 font-black uppercase tracking-wider">
                          Unit Abilities
                        </span>
                        <div className="flex-1 h-px bg-grimlog-steel/40" />
                      </div>
                      <div className="space-y-3">
                        {activeAbilities.units.map((unitWithAbilities) => (
                          <div key={unitWithAbilities.unitId} className="space-y-1">
                            <div className="text-sm text-gray-900 font-black">
                              {unitWithAbilities.unitName}
                            </div>
                            {unitWithAbilities.abilities.map((ability) => (
                              <AbilityCard
                                key={`${unitWithAbilities.unitId}-${ability.name}`}
                                ability={ability}
                                ownerColor={activeTab}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {activeAbilities.armyAbilities.length === 0 && activeAbilities.units.length === 0 && (
                    <div className="text-center text-gray-700 text-sm py-8">
                      No units with {currentPhase} phase abilities
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            // All Units View - 2 Column Grid
            <div className="grid grid-cols-2 gap-3">
              {units.filter(u => u.owner === activeTab && !u.isDestroyed).map((unit) => {
                const healthPercent = getHealthPercent(unit);
                const isExpanded = expandedUnits.has(unit.id);
                const showModels = showModelsForUnit.has(unit.id);
                const iconData = getIconForUnit(unit);
                
                // Health bar color
                const healthBarColor = healthPercent <= 25 ? 'bg-grimlog-red' : 
                                       healthPercent <= 50 ? 'bg-grimlog-amber' : 'bg-grimlog-green';
                
                let parsedModels: ModelState[] | null = null;
                if (unit.modelsArray) {
                  try {
                    parsedModels = JSON.parse(unit.modelsArray);
                  } catch (e) {
                    console.warn('Failed to parse modelsArray:', e);
                  }
                }
                const hasIndividualModels = parsedModels && parsedModels.length > 0;
                const hasMultiWound = unit.startingWounds && unit.startingWounds > unit.startingModels;
                
                return (
                  <div 
                    key={unit.id}
                    className={`bg-white border-2 rounded-xl transition-all duration-200 overflow-hidden card-depth-hover ${
                      isExpanded 
                        ? 'col-span-2 border-grimlog-orange shadow-lg' 
                        : activeTab === 'attacker' 
                          ? 'border-gray-300 hover:border-grimlog-attacker-border' 
                          : 'border-gray-300 hover:border-grimlog-defender-border'
                    }`}
                  >
                    {/* Compact Card View */}
                    <div 
                      className="p-3 cursor-pointer active:scale-[0.99] transition-transform"
                      onClick={() => toggleUnitExpansion(unit.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Unit Icon */}
                        <div className={`w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 bg-white ${
                          healthPercent <= 25 ? 'border-grimlog-red' : 
                          healthPercent <= 50 ? 'border-grimlog-amber' : 'border-grimlog-green'
                        }`}>
                          {iconData.isImage ? (
                            <img 
                              src={iconData.url!} 
                              alt={unit.unitName}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {iconData.url || '◆'}
                            </div>
                          )}
                        </div>
                        
                        {/* Unit Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-bold text-sm truncate ${
                            activeTab === 'attacker' ? 'text-grimlog-attacker-accent' : 'text-grimlog-defender-accent'
                          }`}>
                            {unit.unitName}
                          </div>
                          
                          {/* Health Bar */}
                          <div className="w-full h-1.5 bg-grimlog-slate border border-grimlog-steel/30 rounded-full overflow-hidden mt-1.5 mb-1">
                            <div 
                              className={`h-full ${healthBarColor} transition-all duration-300 rounded-full`}
                              style={{ width: `${healthPercent}%` }}
                            />
                          </div>
                          
                          {/* Stats Row */}
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <span className={`font-bold ${
                              healthPercent <= 25 ? 'text-grimlog-red' : 
                              healthPercent <= 50 ? 'text-grimlog-amber' : 'text-grimlog-green'
                            }`}>
                              {unit.currentModels}/{unit.startingModels}
                            </span>
                            {hasMultiWound && (
                              <span className="text-gray-600">
                                • {unit.currentWounds}W
                              </span>
                            )}
                            {unit.isBattleShocked && (
                              <span className="text-grimlog-red text-[10px] font-bold bg-grimlog-red/10 border border-grimlog-red/30 px-1.5 py-0.5 rounded">
                                SHOCKED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expand Indicator */}
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                          isExpanded 
                            ? 'bg-grimlog-orange text-grimlog-black rotate-180' 
                            : 'bg-grimlog-slate text-grimlog-steel border border-grimlog-steel/30'
                        }`}>
                          ▼
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Controls Overlay */}
                    {isExpanded && (
                      <div className="border-t border-grimlog-steel bg-grimlog-slate animate-card-expand">
                        {/* Large Icon + Name Header */}
                        <div className="flex items-center gap-4 p-4 border-b border-grimlog-steel/50 bg-grimlog-slate-dark">
                          <div className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 ${
                            healthPercent <= 25 ? 'border-grimlog-red' : 
                            healthPercent <= 50 ? 'border-grimlog-amber' : 'border-grimlog-green'
                          } bg-white`}>
                            {iconData.isImage ? (
                              <img 
                                src={iconData.url!} 
                                alt={unit.unitName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">
                                {iconData.url || '◆'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className={`font-bold text-lg ${
                              activeTab === 'attacker' ? 'text-grimlog-attacker-accent' : 'text-grimlog-defender-accent'
                            }`}>
                              {unit.unitName}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-2xl font-bold ${
                                healthPercent <= 25 ? 'text-grimlog-red' : 
                                healthPercent <= 50 ? 'text-grimlog-amber' : 'text-grimlog-green'
                              }`}>
                                {unit.currentModels}/{unit.startingModels}
                              </span>
                              {hasMultiWound && (
                                <span className="text-grimlog-steel text-lg">
                                  {unit.currentWounds}/{unit.startingWounds}W
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls Grid */}
                        <div className="p-4 space-y-4">
                          {/* Models + Wounds Side by Side */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Models Control */}
                            <div className="bg-white border-2 border-gray-300 rounded-xl p-3 shadow-sm">
                              <label className="text-xs text-gray-700 font-mono block mb-2 text-center">
                                MODELS
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateUnitHook(unit.id, {
                                      currentModels: Math.max(0, unit.currentModels - 1)
                                    });
                                  }}
                                  disabled={unit.currentModels === 0}
                                  className="flex-1 h-12 bg-grimlog-red hover:bg-grimlog-darkRed disabled:bg-gray-200 text-white text-xl font-bold rounded-lg disabled:opacity-50 transition-all active:scale-95 btn-depth-sm"
                                >
                                  −
                                </button>
                                <div className="w-14 h-12 flex items-center justify-center bg-grimlog-slate rounded-lg text-xl font-bold text-gray-900 border border-gray-300">
                                  {unit.currentModels}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateUnitHook(unit.id, {
                                      currentModels: Math.min(unit.startingModels, unit.currentModels + 1)
                                    });
                                  }}
                                  disabled={unit.currentModels >= unit.startingModels}
                                  className="flex-1 h-12 bg-grimlog-green hover:bg-grimlog-darkGreen disabled:bg-gray-200 text-grimlog-black text-xl font-bold rounded-lg disabled:opacity-50 transition-all active:scale-95 btn-depth-sm"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            
                            {/* Wounds Control */}
                            {hasMultiWound ? (
                              <div className="bg-white border-2 border-gray-300 rounded-xl p-3 shadow-sm">
                                <label className="text-xs text-gray-700 font-mono block mb-2 text-center">
                                  WOUNDS
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, {
                                        currentWounds: Math.max(0, (unit.currentWounds || 0) - 1)
                                      });
                                    }}
                                    disabled={(unit.currentWounds || 0) === 0}
                                    className="flex-1 h-12 bg-grimlog-red hover:bg-grimlog-darkRed disabled:bg-gray-200 text-white text-xl font-bold rounded-lg disabled:opacity-50 transition-all active:scale-95 btn-depth-sm"
                                  >
                                    −
                                  </button>
                                  <div className="w-14 h-12 flex items-center justify-center bg-grimlog-slate rounded-lg text-xl font-bold text-gray-900 border border-gray-300">
                                    {unit.currentWounds}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUnitHook(unit.id, {
                                        currentWounds: Math.min(unit.startingWounds || 0, (unit.currentWounds || 0) + 1)
                                      });
                                    }}
                                    disabled={(unit.currentWounds || 0) >= (unit.startingWounds || 0)}
                                    className="flex-1 h-12 bg-grimlog-green hover:bg-grimlog-darkGreen disabled:bg-gray-200 text-grimlog-black text-xl font-bold rounded-lg disabled:opacity-50 transition-all active:scale-95 btn-depth-sm"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white border-2 border-gray-300 rounded-xl p-3 flex items-center justify-center shadow-sm">
                                <span className="text-gray-600 text-sm">Single-wound unit</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Status Actions */}
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateUnitHook(unit.id, {
                                  isBattleShocked: !unit.isBattleShocked
                                });
                              }}
                              className={`h-12 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 btn-depth-sm ${
                                unit.isBattleShocked
                                  ? 'bg-grimlog-red text-white'
                                  : 'bg-white border-2 border-gray-300 text-grimlog-amber hover:border-grimlog-amber'
                              }`}
                            >
                              <span className="text-lg">⚡</span>
                              {unit.isBattleShocked ? 'SHOCKED' : 'BATTLESHOCK'}
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
                              className="h-12 bg-white border-2 border-grimlog-red hover:bg-grimlog-red text-grimlog-red hover:text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 btn-depth-sm"
                            >
                              <span className="text-lg">💀</span>
                              DESTROY
                            </button>
                          </div>
                          
                          {/* Individual Models Section */}
                          {hasIndividualModels && (
                            <div className="border-t border-grimlog-steel/40 pt-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleModelsView(unit.id);
                                }}
                                className={`w-full h-12 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-between px-4 btn-depth-sm ${
                                  showModels
                                    ? 'bg-grimlog-orange text-grimlog-black'
                                    : 'bg-white border-2 border-gray-300 text-gray-800 hover:border-grimlog-orange'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>👥</span>
                                  INDIVIDUAL MODELS
                                </span>
                                <span className={`transition-transform ${showModels ? 'rotate-180' : ''}`}>▼</span>
                              </button>
                              
                              {showModels && parsedModels && (
                                <UnitModelList
                                  sessionId={sessionId}
                                  unit={unit}
                                  models={parsedModels}
                                  onRefresh={refetch}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {units.filter(u => u.owner === activeTab && !u.isDestroyed).length === 0 && (
                <div className="col-span-2 text-center text-grimlog-light-steel text-sm py-8">
                  No active units for {activeTab === 'attacker' ? 'Attacker' : 'Defender'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(sheetContent, document.body);
}

