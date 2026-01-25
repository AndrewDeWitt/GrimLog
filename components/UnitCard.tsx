'use client';

import { useState } from 'react';
import UnitHealthDisplay from './UnitHealthDisplay';
import ModelHealthGrid from './ModelHealthGrid';
import ModelDetailsModal from './ModelDetailsModal';
import PhaseContextualActions from './PhaseContextualActions';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';
import { GamePhase } from '@/lib/phaseRelevance';
import { useModelUpdate } from '@/lib/hooks/useModelUpdate';
import IconGeneratorModal from '@/components/tools/IconGeneratorModal';

interface ModelState {
  role: string;
  currentWounds: number;
  maxWounds: number;
}

interface AttachedCharacter {
  id: string;
  unitName: string;
  currentWounds: number | null;
  startingWounds: number | null;
  isDestroyed: boolean;
}

interface UnitCardProps {
  id: string; // Unit instance ID for per-model updates
  sessionId: string; // Session ID for API calls
  unitName: string;
  owner: 'attacker' | 'defender';
  currentModels: number;
  startingModels: number;
  currentWounds: number | null;
  startingWounds: number | null;
  woundsPerModel?: number | null;
  modelsArray?: string | null; // JSON string of ModelState[]
  attachedCharacters?: AttachedCharacter[];
  isDestroyed: boolean;
  isBattleShocked: boolean;
  activeEffects: string[];
  datasheet: string;
  iconUrl?: string | null;
  currentPhase?: GamePhase;
  onAdjustModels?: (change: number) => void;
  onAdjustWounds?: (change: number) => void;
  onToggleBattleShock?: () => void;
  onDestroy?: () => void;
  onRefresh?: () => void; // Callback to refresh unit data
  viewDensity?: 'compact' | 'medium';
  faction?: string; // Added for icon generation
}

export default function UnitCard({
  id,
  sessionId,
  unitName,
  owner,
  currentModels,
  startingModels,
  currentWounds,
  startingWounds,
  woundsPerModel,
  modelsArray,
  attachedCharacters = [],
  isDestroyed,
  isBattleShocked,
  activeEffects,
  datasheet,
  iconUrl,
  currentPhase = 'Command',
  onAdjustModels,
  onAdjustWounds,
  onToggleBattleShock,
  onDestroy,
  onRefresh,
  viewDensity = 'medium',
  faction = 'Unknown' // Default if not provided
}: UnitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModelDetailsOpen, setIsModelDetailsOpen] = useState(false);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  
  // Per-model update hooks
  const { updateModelWounds, destroyModel } = useModelUpdate({
    sessionId,
    unitId: id,
    onSuccess: () => onRefresh?.()
  });
  
  // Parse models array if available
  let parsedModels: ModelState[] | null = null;
  if (modelsArray) {
    try {
      parsedModels = JSON.parse(modelsArray);
    } catch (e) {
      console.warn('Failed to parse modelsArray:', e);
    }
  }
  
  // Determine if we should show per-model breakdown
  // Show if unit has modelsArray OR if it's a multi-model/multi-wound unit
  const showPerModelBreakdown = (parsedModels && parsedModels.length > 0) || 
                                  (startingModels > 1 && 
                                   startingWounds && 
                                   startingWounds > startingModels);
  
  // Get icon (custom or placeholder)
  const icon = getUnitIcon(iconUrl, datasheet);
  const isCustomImage = isCustomIcon(icon);
  
  // Calculate health status
  const isHalfStrength = currentModels > 0 && currentModels <= Math.floor(startingModels / 2);
  const modelPercent = startingModels > 0 ? (currentModels / startingModels) * 100 : 0;
  
  // Owner colors (Attacker=Red, Defender=Green)
  const ownerColor = owner === 'attacker' ? 'border-grimlog-red' : 'border-grimlog-green';
  const ownerTextColor = owner === 'attacker' ? 'text-grimlog-red' : 'text-grimlog-green';
  const ownerBgColor = owner === 'attacker' ? 'bg-grimlog-red' : 'bg-grimlog-green';
  
  // Unit type accent colors (subtle left border accent)
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
  
  const roleCategory = getRoleCategory(datasheet);
  // Subtle left border accent for unit types (complements owner border)
  const roleAccentColor = roleCategory === 'characters' ? 'border-l-4 border-l-grimlog-amber' :
                          roleCategory === 'battleline' ? 'border-l-4 border-l-blue-500' :
                          roleCategory === 'transports' ? 'border-l-4 border-l-purple-500' :
                          '';
  
  const hasControls = !isDestroyed && (onAdjustModels || onAdjustWounds || onToggleBattleShock || onDestroy);
  
  // Calculate health status summary for per-model display
  const getHealthStatusSummary = () => {
    // If no modelsArray, show placeholder based on current models
    if (!parsedModels || parsedModels.length === 0) {
      // Show all as healthy if at full health
      if (currentModels === startingModels && currentWounds === startingWounds) {
        return { healthy: currentModels, damaged: 0, critical: 0 };
      }
      return null;
    }
    
    const aliveModels = parsedModels.filter(m => m.currentWounds > 0);
    const healthy = aliveModels.filter(m => m.currentWounds === m.maxWounds).length;
    const damaged = aliveModels.filter(m => {
      const percent = (m.currentWounds / m.maxWounds) * 100;
      return percent > 33 && percent < 100;
    }).length;
    const critical = aliveModels.filter(m => {
      const percent = (m.currentWounds / m.maxWounds) * 100;
      return percent > 0 && percent <= 33;
    }).length;
    
    return { healthy, damaged, critical };
  };
  
  const healthSummary = getHealthStatusSummary();
  
  // Compact View
  if (viewDensity === 'compact') {
    return (
      <div 
        className={`
          bg-grimlog-gray border-2 transition-all self-start
          ${isDestroyed ? 'border-grimlog-steel opacity-50' : ownerColor}
          ${isBattleShocked ? 'border-grimlog-red' : ''}
          ${hasControls ? 'cursor-pointer hover:bg-grimlog-steel' : ''}
          ${roleAccentColor}
        `}
        onClick={() => hasControls && setIsExpanded(!isExpanded)}
        role="article"
        aria-label={`${unitName}, ${owner}'s unit, ${currentModels} of ${startingModels} models remaining`}
      >
        {/* Compact Header */}
        <div className="p-1.5">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Icon */}
            <div 
              className="relative group flex-shrink-0 w-7 h-7 flex items-center justify-center bg-grimlog-black border border-grimlog-steel cursor-context-menu"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card expansion
                setIsIconModalOpen(true);
              }}
            >
              {isCustomImage ? (
                <img src={icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-base" aria-hidden="true">{icon}</span>
              )}
              {/* Edit Icon Overlay - Always visible but subtle */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-grimlog-orange text-black rounded-full flex items-center justify-center text-[8px] opacity-80 hover:opacity-100 transition-opacity z-10 pointer-events-none">
                ✎
              </div>
            </div>
            
            {/* Unit Name */}
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-bold ${ownerTextColor} tracking-wide truncate`}>
                {unitName}
                {isDestroyed && <span className="ml-1 text-grimlog-red text-xs">✕</span>}
                {attachedCharacters.length > 0 && (
                  <span className="ml-1 text-grimlog-amber text-xs">
                    +{attachedCharacters.length}⭐
                  </span>
                )}
              </h3>
            </div>
            
            {/* Expand indicator */}
            {hasControls && (
              <div className="flex-shrink-0 text-grimlog-light-steel">
                <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
              </div>
            )}
          </div>
          
          {/* Status Badges (compact) */}
          {!isDestroyed && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {isHalfStrength && (
                <div className="text-xs bg-grimlog-amber text-grimlog-black px-1 py-0.5 font-bold">
                  ⚠
                </div>
              )}
              {isBattleShocked && (
                <div className="text-xs bg-grimlog-red text-white px-1 py-0.5 font-bold">
                  ⚡
                </div>
              )}
              {activeEffects.slice(0, 2).map((effect, idx) => (
                <div 
                  key={idx}
                  className="text-xs bg-grimlog-steel text-grimlog-green px-1 py-0.5 font-mono uppercase"
                  title={effect}
                >
                  {effect.slice(0, 3)}
                </div>
              ))}
              {activeEffects.length > 2 && (
                <div className="text-xs text-grimlog-light-steel px-1">
                  +{activeEffects.length - 2}
                </div>
              )}
            </div>
          )}
          
          {/* Health Display */}
          <UnitHealthDisplay
            currentModels={currentModels}
            startingModels={startingModels}
            currentWounds={currentWounds}
            startingWounds={startingWounds}
            isDestroyed={isDestroyed}
            owner={owner}
            compact={true}
          />
          
          {/* Per-Model Summary - Compact */}
          {showPerModelBreakdown && healthSummary && (
            <div className="mt-1.5 pt-1.5 border-t border-grimlog-steel flex items-center justify-between text-xs">
              <span className="text-grimlog-light-steel font-mono">Per-Model:</span>
              <div className="flex items-center gap-1.5">
                {healthSummary.healthy > 0 && (
                  <span className="flex items-center gap-0.5">
                    🟢<span className="text-grimlog-green font-bold">{healthSummary.healthy}</span>
                  </span>
                )}
                {healthSummary.damaged > 0 && (
                  <span className="flex items-center gap-0.5">
                    🟡<span className="text-grimlog-amber font-bold">{healthSummary.damaged}</span>
                  </span>
                )}
                {healthSummary.critical > 0 && (
                  <span className="flex items-center gap-0.5">
                    🔴<span className="text-grimlog-red font-bold">{healthSummary.critical}</span>
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModelDetailsOpen(true);
                  }}
                  className="ml-0.5 px-1.5 py-0.5 bg-grimlog-steel hover:bg-grimlog-orange text-grimlog-light-steel hover:text-grimlog-black text-xs font-bold transition-colors"
                >
                  📋
                </button>
              </div>
            </div>
          )}
          
          {/* Phase Contextual Actions - Compact */}
          {!isDestroyed && (
            <PhaseContextualActions
              datasheet={datasheet}
              currentPhase={currentPhase}
              isBattleShocked={isBattleShocked}
              compact={true}
            />
          )}
        </div>
        
        {/* Expanded Controls */}
        {isExpanded && hasControls && (
          <div className="border-t-2 border-grimlog-steel p-1.5 bg-grimlog-black">
            <div className="space-y-2">
              {/* Model/Wound Adjustments */}
              <div className="grid grid-cols-2 gap-2">
                {onAdjustModels && (
                  <div>
                    <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                      MODELS
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAdjustModels(-1);
                        }}
                        disabled={currentModels === 0}
                        className="flex-1 min-h-[32px] px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-gray text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth-sm hover-lift"
                        aria-label="Remove 1 model"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAdjustModels(1);
                        }}
                        disabled={currentModels >= startingModels}
                        className="flex-1 min-h-[32px] px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-gray text-grimlog-black text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth-sm hover-lift"
                        aria-label="Add 1 model"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                )}
                
                {onAdjustWounds && startingWounds && startingWounds > startingModels && (
                  <div>
                    <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                      WOUNDS
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAdjustWounds(-1);
                        }}
                        disabled={(currentWounds || 0) === 0}
                        className="flex-1 min-h-[32px] px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-gray text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth-sm hover-lift"
                        aria-label="Remove 1 wound"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAdjustWounds(1);
                        }}
                        disabled={(currentWounds || 0) >= (startingWounds || 0)}
                        className="flex-1 min-h-[32px] px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-gray text-grimlog-black text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth-sm hover-lift"
                        aria-label="Add 1 wound"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Additional Actions */}
              <div className="grid grid-cols-2 gap-2">
                {onToggleBattleShock && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleBattleShock();
                    }}
                    className={`min-h-[32px] px-2 py-1 text-xs font-bold border-2 transition-all btn-depth-sm hover-lift ${
                      isBattleShocked
                        ? 'bg-grimlog-red border-grimlog-red text-white hover:bg-red-600'
                        : 'bg-grimlog-gray border-grimlog-steel text-grimlog-orange hover:bg-grimlog-steel'
                    }`}
                    aria-label={isBattleShocked ? "Remove battleshock" : "Mark as battle-shocked"}
                  >
                    {isBattleShocked ? '✓ SHOCKED' : 'BATTLESHOCK'}
                  </button>
                )}
                
                {onDestroy && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDestroy();
                    }}
                    className="min-h-[32px] px-2 py-1 bg-grimlog-black hover:bg-grimlog-red border-2 border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-all btn-depth-sm hover-lift"
                    aria-label="Mark unit as destroyed"
                  >
                    DESTROY
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Icon Modal */}
        <IconGeneratorModal
          unitName={unitName}
          faction={faction}
          isOpen={isIconModalOpen}
          onClose={() => setIsIconModalOpen(false)}
          onSuccess={() => {
            setIsIconModalOpen(false);
            onRefresh?.();
          }}
        />
      </div>
    );
  }
  
  // Medium View (default)
  return (
      <div 
        className={`
          bg-grimlog-gray border-2 transition-all self-start
          ${isDestroyed ? 'border-grimlog-steel opacity-50' : ownerColor}
          ${isBattleShocked ? 'border-grimlog-red' : ''}
          ${hasControls ? 'cursor-pointer hover:bg-grimlog-steel' : ''}
          ${roleAccentColor}
        `}
      onClick={() => hasControls && setIsExpanded(!isExpanded)}
      role="article"
      aria-label={`${unitName}, ${owner}'s unit, ${currentModels} of ${startingModels} models remaining`}
      >
      {/* Medium Header */}
      <div className="p-2.5">
        <div className="flex items-start gap-2.5 mb-2.5">
          {/* Icon */}
          <div 
            className="relative group flex-shrink-0 w-10 h-10 flex items-center justify-center bg-grimlog-black border border-grimlog-steel cursor-context-menu"
            onClick={(e) => {
              e.stopPropagation();
              setIsIconModalOpen(true);
            }}
          >
            {isCustomImage ? (
              <img src={icon} alt="" className="w-full h-full object-cover" />
              ) : (
              <span className="text-xl" aria-hidden="true">{icon}</span>
            )}
            {/* Edit Icon Overlay - Always visible but subtle */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-grimlog-orange text-black rounded-full flex items-center justify-center text-[10px] opacity-80 hover:opacity-100 transition-opacity z-10 pointer-events-none">
              ✎
            </div>
          </div>
          
          {/* Unit Info */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-bold ${ownerTextColor} tracking-wide`}>
              {unitName}
              {isDestroyed && <span className="ml-2 text-grimlog-red text-sm">✕ DESTROYED</span>}
            </h3>
            <p className="text-xs text-grimlog-light-steel font-mono truncate">
              {datasheet}
            </p>
            {/* Attached Characters */}
            {attachedCharacters.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {attachedCharacters.map((char) => (
                  <div
                    key={char.id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-grimlog-black border border-grimlog-amber text-xs"
                  >
                    <span className="text-grimlog-amber">⭐</span>
                    <span className="text-grimlog-light-steel">
                      {char.unitName}
                    </span>
                    <span className={`font-mono ${char.isDestroyed ? 'text-grimlog-red' : 'text-grimlog-green'}`}>
                      {char.isDestroyed ? '✕' : `${char.currentWounds}/${char.startingWounds}W`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Owner Badge & Expand */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div className={`text-xs font-bold px-2 py-1 ${ownerColor} border ${ownerTextColor} uppercase`}>
              {owner === 'attacker' ? 'ATK' : 'DEF'}
            </div>
            {hasControls && (
              <div className="text-grimlog-light-steel">
                <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Status Badges */}
        {!isDestroyed && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {isHalfStrength && (
              <div 
                className="text-xs bg-grimlog-amber text-grimlog-black px-2 py-1 font-bold"
                title="Unit is at half strength - Battleshock test required in Command Phase"
              >
                ⚠ HALF STRENGTH
              </div>
            )}
            {isBattleShocked && (
              <div className="text-xs bg-grimlog-red text-white px-2 py-1 font-bold">
                ⚡ BATTLE-SHOCKED
              </div>
            )}
            {activeEffects.map((effect, idx) => (
              <div 
                key={idx}
                className="text-xs bg-grimlog-steel text-grimlog-green px-2 py-1 font-mono uppercase"
              >
                {effect}
              </div>
            ))}
          </div>
        )}
        
        {/* Health Display */}
        <UnitHealthDisplay
          currentModels={currentModels}
          startingModels={startingModels}
          currentWounds={currentWounds}
          startingWounds={startingWounds}
          isDestroyed={isDestroyed}
          owner={owner}
          compact={false}
        />
        
        {/* Per-Model Summary - Medium */}
        {showPerModelBreakdown && healthSummary && (
          <div className="mt-2.5 pt-2.5 border-t-2 border-grimlog-steel flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-grimlog-light-steel font-mono">Models:</span>
              {healthSummary.healthy > 0 && (
                <span className="flex items-center gap-0.5">
                  🟢<span className="text-grimlog-green font-bold">{healthSummary.healthy}</span>
                </span>
              )}
              {healthSummary.damaged > 0 && (
                <span className="flex items-center gap-0.5">
                  🟡<span className="text-grimlog-amber font-bold">{healthSummary.damaged}</span>
                </span>
              )}
              {healthSummary.critical > 0 && (
                <span className="flex items-center gap-0.5">
                  🔴<span className="text-grimlog-red font-bold">{healthSummary.critical}</span>
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModelDetailsOpen(true);
              }}
              className="px-3 py-1.5 bg-grimlog-steel hover:bg-grimlog-orange text-grimlog-light-steel hover:text-grimlog-black text-xs font-bold border border-grimlog-steel transition-colors btn-depth-sm hover-lift"
            >
              📋 DETAILS
            </button>
          </div>
        )}
        
        {/* Phase Contextual Actions - Medium */}
        {!isDestroyed && (
          <PhaseContextualActions
            datasheet={datasheet}
            currentPhase={currentPhase}
            isBattleShocked={isBattleShocked}
            compact={false}
          />
        )}
      </div>
      
      {/* Expanded Controls */}
      {isExpanded && hasControls && (
        <div className="border-t-2 border-grimlog-steel p-2.5 bg-grimlog-black">
          <div className="space-y-2">
            {/* Model/Wound Adjustments */}
            <div className="grid grid-cols-2 gap-2">
              {onAdjustModels && (
                <div>
                  <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                    MODELS
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAdjustModels(-1);
                      }}
                      disabled={currentModels === 0}
                      className="flex-1 min-h-[36px] px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-gray text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth hover-lift"
                      aria-label="Remove 1 model"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAdjustModels(1);
                      }}
                      disabled={currentModels >= startingModels}
                      className="flex-1 min-h-[36px] px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-gray text-grimlog-black text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth hover-lift"
                      aria-label="Add 1 model"
                    >
                      +1
                    </button>
                  </div>
                </div>
              )}
              
              {onAdjustWounds && startingWounds && startingWounds > startingModels && (
                <div>
                  <label className="text-xs text-grimlog-light-steel font-mono block mb-1">
                    WOUNDS
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAdjustWounds(-1);
                      }}
                      disabled={(currentWounds || 0) === 0}
                      className="flex-1 min-h-[36px] px-2 py-1 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-gray text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth hover-lift"
                      aria-label="Remove 1 wound"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAdjustWounds(1);
                      }}
                      disabled={(currentWounds || 0) >= (startingWounds || 0)}
                      className="flex-1 min-h-[36px] px-2 py-1 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-gray text-grimlog-black text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-depth hover-lift"
                      aria-label="Add 1 wound"
                    >
                      +1
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Additional Actions */}
            <div className="grid grid-cols-2 gap-2">
              {onToggleBattleShock && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleBattleShock();
                  }}
                  className={`min-h-[36px] px-3 py-1 text-xs font-bold border-2 transition-all btn-depth hover-lift ${
                    isBattleShocked
                      ? 'bg-grimlog-red border-grimlog-red text-white hover:bg-red-600'
                      : 'bg-grimlog-gray border-grimlog-steel text-grimlog-orange hover:bg-grimlog-steel'
                  }`}
                  aria-label={isBattleShocked ? "Remove battleshock" : "Mark as battle-shocked"}
                >
                  {isBattleShocked ? '✓ SHOCKED' : 'BATTLESHOCK'}
                </button>
              )}
              
              {onDestroy && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDestroy();
                  }}
                  className="min-h-[36px] px-3 py-1 bg-grimlog-black hover:bg-grimlog-red border-2 border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold transition-all btn-depth hover-lift"
                  aria-label="Mark unit as destroyed"
                >
                  DESTROY
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Model Details Modal */}
      {parsedModels && (
        <ModelDetailsModal
          isOpen={isModelDetailsOpen}
          onClose={() => setIsModelDetailsOpen(false)}
          unitName={unitName}
          owner={owner}
          models={parsedModels}
          woundsPerModel={woundsPerModel || 1}
          onModelWoundChange={updateModelWounds}
          onModelDestroy={destroyModel}
        />
      )}

      {/* Icon Generator Modal */}
      <IconGeneratorModal
        unitName={unitName}
        faction={faction}
        isOpen={isIconModalOpen}
        onClose={() => setIsIconModalOpen(false)}
        onSuccess={() => {
          setIsIconModalOpen(false);
          onRefresh?.();
        }}
      />
    </div>
  );
}
