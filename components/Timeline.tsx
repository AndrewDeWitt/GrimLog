'use client';

import { TimelineEventData, ValidationSeverity } from '@/lib/types';
import { useEffect, useRef, useState, useMemo } from 'react';
import RevertConfirmDialog from './RevertConfirmDialog';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';

interface TimelineProps {
  events: TimelineEventData[];
  sessionId?: string;
  onRefresh?: () => void;
  onDamageCalcClick?: (eventData: TimelineEventData) => void;
  attackerFaction?: string;
  defenderFaction?: string;
}

interface ValidationMetadata {
  wasOverridden?: boolean;
  severity?: ValidationSeverity;
  rule?: string;
}

// Helper to extract validation info from metadata
function getValidationInfo(metadata?: Record<string, any>): ValidationMetadata | null {
  if (!metadata) return null;
  if (metadata.wasOverridden !== undefined || metadata.severity !== undefined) {
    return {
      wasOverridden: metadata.wasOverridden,
      severity: metadata.severity,
      rule: metadata.rule,
    };
  }
  return null;
}

const eventTypeIcons: Record<string, string> = {
  phase: '⚡',
  stratagem: '◆',
  deepstrike: '↓',
  objective: '📍',
  ability: '✦',
  vp: '★',
  custom: '●',
  revert: '⎌',
  damage_calc: '⚔',
};

const eventTypeColors: Record<string, string> = {
  phase: 'text-blue-700 border-blue-500 bg-blue-100',
  stratagem: 'text-amber-700 border-amber-500 bg-amber-100',
  deepstrike: 'text-purple-700 border-purple-500 bg-purple-100',
  objective: 'text-green-700 border-green-500 bg-green-100',
  ability: 'text-orange-700 border-grimlog-orange bg-orange-100',
  vp: 'text-emerald-700 border-emerald-500 bg-emerald-100',
  custom: 'text-gray-700 border-gray-500 bg-gray-100',
  revert: 'text-amber-700 border-amber-500 bg-amber-100',
  damage_calc: 'text-orange-700 border-orange-500 bg-orange-100',
};

const eventTypeLabels: Record<string, string> = {
  phase: 'Phase Change',
  stratagem: 'Stratagem',
  deepstrike: 'Deep Strike',
  objective: 'Objective',
  ability: 'Ability',
  vp: 'Secondary VP',
  custom: 'Custom Event',
  damage_calc: 'Damage Calc',
};

// Helper to extract unit info from event metadata for icon resolution
interface ExtractedUnitInfo {
  unitName: string;
  owner: 'attacker' | 'defender';
  faction: string;
}

function extractUnitInfoFromEvent(
  event: TimelineEventData,
  attackerFaction: string,
  defenderFaction: string
): ExtractedUnitInfo | null {
  const metadata = typeof event.metadata === 'string' 
    ? (() => { try { return JSON.parse(event.metadata); } catch { return null; } })()
    : event.metadata;
  
  if (!metadata) return null;
  
  // Check for unit-related metadata fields
  const unitName = metadata.unitName || metadata.defendingUnit || metadata.attackingUnit;
  const owner = metadata.owner || metadata.defendingPlayer || metadata.attackingPlayer;
  
  if (!unitName || !owner) return null;
  
  // Map owner to faction
  const faction = owner === 'attacker' ? attackerFaction : defenderFaction;
  if (!faction) return null;
  
  return {
    unitName,
    owner: owner as 'attacker' | 'defender',
    faction
  };
}

// Action category info for icon styling
interface ActionCategoryInfo {
  category: 'damage' | 'stratagem' | 'action' | 'status' | 'neutral';
  borderClass: string;
  badge?: {
    symbol: string;
    bgClass: string;
    textClass: string;
  };
}

function getActionCategoryFromEvent(event: TimelineEventData): ActionCategoryInfo {
  const metadata = typeof event.metadata === 'string'
    ? (() => { try { return JSON.parse(event.metadata); } catch { return null; } })()
    : event.metadata || {};
  
  // Check for damage events (wounded, destroyed)
  if (metadata.woundsLost || metadata.modelsLost || metadata.modelsKilled || metadata.isDestroyed) {
    const isDestroyed = metadata.isDestroyed;
    const modelsKilled = metadata.modelsKilled || metadata.modelsLost || 0;
    return {
      category: 'damage',
      borderClass: 'border-red-500 border-2',
      badge: {
        symbol: isDestroyed ? '💀' : (modelsKilled > 0 ? `-${modelsKilled}` : '⚔'),
        bgClass: isDestroyed ? 'bg-red-700' : 'bg-red-600',
        textClass: 'text-white'
      }
    };
  }
  
  // Check for stratagem events
  if (event.eventType === 'stratagem' || metadata.stratagemName || metadata.cpCost !== undefined) {
    const cpCost = metadata.cpCost;
    return {
      category: 'stratagem',
      borderClass: 'border-amber-500 border-2',
      badge: cpCost !== undefined ? {
        symbol: `-${cpCost}`,
        bgClass: 'bg-amber-600',
        textClass: 'text-white'
      } : {
        symbol: '◆',
        bgClass: 'bg-amber-600',
        textClass: 'text-white'
      }
    };
  }
  
  // Check for unit actions (deep strike, charge, advance, etc.)
  if (metadata.actionType) {
    const actionSymbols: Record<string, string> = {
      deepstrike: '↓',
      charge: '⚔',
      advance: '→',
      fall_back: '←',
      heroic_intervention: '⚡',
      pile_in: '↘',
      consolidate: '↗',
      remains_stationary: '◯'
    };
    return {
      category: 'action',
      borderClass: 'border-purple-500 border-2',
      badge: {
        symbol: actionSymbols[metadata.actionType] || '●',
        bgClass: 'bg-purple-600',
        textClass: 'text-white'
      }
    };
  }
  
  // Check for status changes (battleshock, effects)
  if (metadata.isBattleShocked !== undefined || metadata.addedEffects || metadata.removedEffects) {
    return {
      category: 'status',
      borderClass: 'border-blue-500 border-2',
      badge: metadata.isBattleShocked ? {
        symbol: '⚡',
        bgClass: 'bg-blue-600',
        textClass: 'text-white'
      } : {
        symbol: '◈',
        bgClass: 'bg-blue-600',
        textClass: 'text-white'
      }
    };
  }
  
  // Default neutral
  return {
    category: 'neutral',
    borderClass: 'border-grimlog-steel/50 border',
    badge: undefined
  };
}

export default function Timeline({ events, sessionId, onRefresh, onDamageCalcClick, attackerFaction = '', defenderFaction = '' }: TimelineProps) {
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(() => {
    // Load seen events from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('grimlog-seen-events');
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  
  // Minimized reverts state
  const [minimizedReverts, setMinimizedReverts] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('grimlog-minimized-reverts');
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch {
          return new Set(); // Will populate in effect
        }
      }
    }
    return new Set();
  });
  
  // Revert confirmation state
  const [revertConfirmation, setRevertConfirmation] = useState<{
    eventId: string;
    description: string;
    subsequentCount: number;
  } | null>(null);
  
  // Expanded revert actions state (for individual revert details)
  const [expandedRevertActions, setExpandedRevertActions] = useState<Set<string>>(new Set());
  
  // Expanded revert groups state (for grouped consecutive reverts)
  const [expandedRevertGroups, setExpandedRevertGroups] = useState<Set<number>>(new Set());
  
  // Selected event ID for showing undo button (tap-to-reveal)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  // Handler to toggle event selection
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(prev => prev === eventId ? null : eventId);
  };

  // Extract unique units from events for batch icon fetching
  const unitsForIcons = useMemo(() => {
    if (!attackerFaction && !defenderFaction) return [];
    
    const unitMap = new Map<string, { unitName: string; faction: string }>();
    
    events.forEach(event => {
      const unitInfo = extractUnitInfoFromEvent(event, attackerFaction, defenderFaction);
      if (unitInfo) {
        const key = `${unitInfo.faction}:${unitInfo.unitName}`;
        if (!unitMap.has(key)) {
          unitMap.set(key, { unitName: unitInfo.unitName, faction: unitInfo.faction });
        }
      }
    });
    
    return Array.from(unitMap.values());
  }, [events, attackerFaction, defenderFaction]);

  // Batch fetch icons for all units in events
  const { icons: unitIcons } = useUnitIcons(unitsForIcons, { 
    autoFetch: unitsForIcons.length > 0 
  });

  useEffect(() => {
    // Detect newly added events (events not in seenEventIds)
    const currentIds = new Set(events.map(e => e.id));
    const newIds = new Set<string>();
    
    currentIds.forEach(id => {
      if (!seenEventIds.has(id)) {
        newIds.add(id);
      }
    });
    
    if (newIds.size > 0) {
      // Mark these events as new (for animation)
      setNewEventIds(newIds);
      
      // Add them to seen events immediately (so they don't re-trigger on remount)
      const updatedSeenIds = new Set([...seenEventIds, ...newIds]);
      setSeenEventIds(updatedSeenIds);
      
      // Handle new revert events - minimize by default
      const newRevertEvents = events.filter(e => newIds.has(e.id) && e.metadata?.isRevertAction);
      if (newRevertEvents.length > 0) {
        const updatedMinimized = new Set(minimizedReverts);
        newRevertEvents.forEach(e => updatedMinimized.add(e.id));
        
        // Also check for potential new groups
        // We can't easily know group indices here as they depend on filtering
        // But we can ensure the individual items are minimized
        
        setMinimizedReverts(updatedMinimized);
        if (typeof window !== 'undefined') {
          localStorage.setItem('grimlog-minimized-reverts', JSON.stringify([...updatedMinimized]));
        }
      }
      
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('grimlog-seen-events', JSON.stringify([...updatedSeenIds]));
      }
      
      // Remove the "new" status after animation completes
      setTimeout(() => {
        setNewEventIds(new Set());
      }, 3000); // 3 seconds for the full animation cycle
    }
  }, [events, seenEventIds, minimizedReverts]);

  // Initial load of minimized state for existing reverts
  useEffect(() => {
    const allRevertIds = events
      .filter(e => e.metadata?.isRevertAction)
      .map(e => e.id);
      
    if (allRevertIds.length > 0) {
      setMinimizedReverts(prev => {
        // If we already have some state, merge it
        // This ensures existing reverts get minimized if not already tracked
        // But doesn't override user choices if they expanded some
        // Actually, let's just ensure all reverts are tracked.
        // If a revert ID is missing from the set, it effectively means "expanded" if we blindly trust the set.
        // BUT the requirement is "default behavior: All reverts start minimized".
        // So if we encounter a revert we haven't seen before (not in set, but maybe also not in "seenEventIds"?), we should minimize it.
        // For simplicity, on first load, if the set is empty but we have reverts, we might want to initialize.
        // However, the lazy init already handles localStorage.
        // Let's just stick to the "new event" logic for adding to the set.
        
        // Wait, if I refresh the page and localStorage is empty (first time feature is live),
        // I want existing reverts to be minimized.
        // So: check if localStorage was empty/missing.
        
        if (prev.size === 0 && localStorage.getItem('grimlog-minimized-reverts') === null) {
            const newSet = new Set(allRevertIds);
            localStorage.setItem('grimlog-minimized-reverts', JSON.stringify([...newSet]));
            return newSet;
        }
        return prev;
      });
    }
  }, []); // Run once on mount (after events are available? No, events prop can change. But this is just for migration/init)


  // Memoize filtered events to prevent unnecessary recalculations
  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    // Filter by event type if filters are selected
    if (selectedFilters.size > 0) {
      filtered = filtered.filter(event => selectedFilters.has(event.eventType));
    }
    
    // Filter out reverted events (except revert action events which should always show)
    filtered = filtered.filter(event => {
      // Always show revert action events
      if (event.metadata?.isRevertAction) {
        return true;
      }
      // Hide reverted events
      return !event.isReverted;
    });
    
    return filtered.slice().reverse(); // Reverse to show newest events at the top
  }, [events, selectedFilters]);
  
  // Group consecutive revert actions together
  const groupedEvents = useMemo(() => {
    const groups: Array<{ type: 'single' | 'revert-group', events: TimelineEventData[] }> = [];
    let currentRevertGroup: TimelineEventData[] = [];
    
    filteredEvents.forEach((event, index) => {
      const isRevertAction = event.metadata?.isRevertAction === true;
      
      if (isRevertAction) {
        currentRevertGroup.push(event);
      } else {
        // If we have accumulated revert actions, add them as a group
        if (currentRevertGroup.length > 0) {
          if (currentRevertGroup.length === 1) {
            // Single revert - add as standalone
            groups.push({ type: 'single', events: [currentRevertGroup[0]] });
          } else {
            // Multiple consecutive reverts - group them
            groups.push({ type: 'revert-group', events: [...currentRevertGroup] });
          }
          currentRevertGroup = [];
        }
        // Add the regular event
        groups.push({ type: 'single', events: [event] });
      }
    });
    
    // Handle any remaining revert actions at the end
    if (currentRevertGroup.length > 0) {
      if (currentRevertGroup.length === 1) {
        groups.push({ type: 'single', events: [currentRevertGroup[0]] });
      } else {
        groups.push({ type: 'revert-group', events: [...currentRevertGroup] });
      }
    }
    
    return groups;
  }, [filteredEvents]);

  // Toggle filter
  const toggleFilter = (eventType: string) => {
    setSelectedFilters(prev => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters(new Set());
  };

  // Memoize available event types to prevent recalculation
  const availableEventTypes = useMemo(() => 
    Array.from(new Set(events.map(e => e.eventType))),
    [events]
  );
  
  // Toggle expanded view for revert action
  const toggleRevertActionExpansion = (eventId: string) => {
    setExpandedRevertActions(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // Toggle minimized state for a revert ID or group key
  const toggleRevertMinimized = (id: string) => {
    setMinimizedReverts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('grimlog-minimized-reverts', JSON.stringify([...next]));
      }
      
      return next;
    });
  };
  
  // Handle revert button click
  const handleRevertClick = (event: TimelineEventData) => {
    if (!sessionId) return;
    
    // Find events that occurred AFTER this event (by timestamp, not array position)
    // since timeline displays in reverse order
    const targetTimestamp = new Date(event.timestamp).getTime();
    const subsequentEvents = events.filter(e => {
      const eventTimestamp = new Date(e.timestamp).getTime();
      return eventTimestamp > targetTimestamp && !e.isReverted;
    });
    
    setRevertConfirmation({
      eventId: event.id,
      description: event.description,
      subsequentCount: subsequentEvents.length
    });
  };
  
  // Handle revert confirmation
  const handleConfirmRevert = async (cascadeMode: 'single' | 'cascade') => {
    if (!revertConfirmation || !sessionId) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/events/${revertConfirmation.eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revertReason: 'User correction',
          cascadeMode
        }),
        cache: 'no-store' // Ensure fresh data
      });
      
      if (!response.ok) throw new Error('Failed to revert');
      
      // Wait a moment for database to update, then refresh
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh timeline and game state
      if (onRefresh) {
        await onRefresh();
      }
      
      setRevertConfirmation(null);
    } catch (error) {
      console.error('Failed to revert event:', error);
      alert('Failed to revert event. Please try again.');
    }
  };
  
  // Render a minimal revert view
  const renderMinimalRevert = (
    onClick: () => void,
    count: number = 1,
    timestamp: string
  ) => {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-2 py-1 border-l-2 border-amber-500 bg-amber-100 hover:bg-amber-200 transition-colors text-left group"
        aria-label={count > 1 ? `Expand ${count} reverts` : "Expand revert"}
      >
        <span className="text-amber-600 text-[10px] group-hover:text-amber-800 transition-colors">▶</span>
        <span className="text-amber-700 text-xs font-bold uppercase tracking-wider">
           ⎌ REVERT {count > 1 ? `(${count})` : ''}
        </span>
        <span className="text-grimlog-steel text-[10px] font-mono ml-auto">
          {timestamp}
        </span>
      </button>
    );
  };

  // Render a single event
  const renderEvent = (event: TimelineEventData, isInGroup: boolean) => {
    const isNew = newEventIds.has(event.id);
    const isRevertAction = event.metadata?.isRevertAction === true;
    const eventKey = isRevertAction ? 'revert' : event.eventType;
    const isMinimized = isRevertAction && minimizedReverts.has(event.id);

    // Parse metadata safely for stratagem details
    const stratagemInfo = event.eventType === 'stratagem' ? (() => {
      try {
        const m = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata || {};
        return { usedBy: m.usedBy, cpCost: m.cpCost };
      } catch { return {}; }
    })() : null;

    if (isMinimized && !isInGroup) {
        return (
            <article 
                key={event.id} 
                className={`mb-2 ${isNew ? 'new-event-enter' : ''}`}
                style={{
                    animation: isNew ? 'slideDownBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined
                }}
            >
                {renderMinimalRevert(
                    () => toggleRevertMinimized(event.id),
                    1,
                    new Date(event.timestamp).toLocaleTimeString()
                )}
            </article>
        );
    }
    
    // Check if this is a clickable damage_calc event (custom event with damage_calculation metadata type)
    const isDamageCalc = event.eventType === 'custom' && event.metadata?.type === 'damage_calculation' && onDamageCalcClick;
    
    // Check if this event is selected (for showing undo button)
    const isSelected = selectedEventId === event.id;
    const canShowUndo = !event.isReverted && !event.metadata?.isRevertAction && sessionId;
    
    // Handle row click - toggle selection or trigger damage calc
    const handleRowClick = () => {
      if (isDamageCalc) {
        onDamageCalcClick(event);
      } else if (canShowUndo) {
        handleEventSelect(event.id);
      }
    };
    
    return (
      <article
        key={event.id}
        className={`
          relative p-3 border-l-4 border-2 bg-white
          ${eventTypeColors[eventKey]}
          hover:brightness-95 hover:border-l-[6px]
          focus-within:ring-2 focus-within:ring-grimlog-orange focus-within:ring-offset-2 focus-within:ring-offset-grimlog-slate
          transition-all duration-200
          ${isNew ? 'new-event-enter' : ''}
          ${isRevertAction ? 'border-dashed' : ''}
          ${isInGroup ? '' : ''}
          ${isDamageCalc ? 'cursor-pointer hover:border-grimlog-orange' : ''}
          ${canShowUndo && !isDamageCalc ? 'cursor-pointer' : ''}
          ${isSelected ? 'ring-2 ring-grimlog-orange ring-offset-1 ring-offset-grimlog-slate-light' : ''}
          shadow-sm
        `}
        style={{
          animation: isNew ? 'slideDownBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined
        }}
        onClick={handleRowClick}
        aria-label={`${isRevertAction ? 'Revert Action' : eventTypeLabels[event.eventType]}: ${event.description}`}
        aria-selected={isSelected}
      >
        {/* Event content */}
        <div className="flex items-start gap-3">
          <span 
            className={`text-2xl ${eventTypeColors[eventKey].split(' ')[0]} flex-shrink-0 drop-shadow-lg`}
            aria-hidden="true"
          >
            {isRevertAction ? eventTypeIcons.revert : eventTypeIcons[event.eventType]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {isRevertAction ? (
                  <>
                    <span 
                        className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 cursor-pointer hover:brightness-110 ${eventTypeColors.revert}`}
                        onClick={() => toggleRevertMinimized(event.id)}
                        title="Minimize"
                    >
                        ⎌ REVERT
                    </span>
                    <button 
                        onClick={() => toggleRevertMinimized(event.id)}
                        className="text-grimlog-amber hover:text-amber-300 text-xs"
                        aria-label="Minimize"
                    >
                        ▼
                    </button>
                  </>
                ) : (
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 ${eventTypeColors[event.eventType]}`}>
                    {event.eventType === 'custom' && event.metadata?.type === 'damage_calculation' ? '⚔ DAMAGE' : event.eventType}
                  </span>
                )}
                
                {/* Clickable indicator for damage_calc */}
                {isDamageCalc && (
                  <span className="px-2 py-1 text-xs font-mono text-grimlog-orange border border-grimlog-orange bg-grimlog-orange/10 hover:bg-grimlog-orange/20">
                    👁 VIEW
                  </span>
                )}
                
                {/* Stratagem Badges */}
                {stratagemInfo?.usedBy && (
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 ${
                    stratagemInfo.usedBy === 'attacker'
                      ? 'bg-grimlog-green text-grimlog-black border-grimlog-green'
                      : 'bg-grimlog-red text-grimlog-black border-grimlog-red'
                  }`}>
                    {stratagemInfo.usedBy}
                  </span>
                )}
                {stratagemInfo?.cpCost !== undefined && (
                  <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 text-grimlog-amber border-grimlog-amber bg-amber-950">
                    -{stratagemInfo.cpCost} CP
                  </span>
                )}

                {/* Phase Badge */}
                {event.phase && (
                  <span className="px-2 py-1 text-xs text-white bg-grimlog-steel font-bold uppercase tracking-wider border-2 border-grimlog-steel">
                    {event.phase}
                  </span>
                )}
                {/* Validation Badge */}
                {(() => {
                  const validation = getValidationInfo(event.metadata);
                  if (!validation) return null;
                  
                  const severityConfig = {
                    info: { icon: 'ℹ', color: 'text-blue-400 bg-blue-950 border-blue-600', label: 'Info' },
                    warning: { icon: '⚠', color: 'text-grimlog-amber bg-orange-950 border-grimlog-amber', label: 'Warning' },
                    error: { icon: '✕', color: 'text-grimlog-red bg-red-950 border-grimlog-red', label: 'Error' },
                    critical: { icon: '🚨', color: 'text-red-500 bg-red-950 border-red-600', label: 'Critical' },
                    valid: { icon: '✓', color: 'text-grimlog-green bg-green-950 border-grimlog-green', label: 'Valid' },
                  };
                  
                  const config = validation.severity ? severityConfig[validation.severity] : null;
                  if (!config) return null;
                  
                  return (
                    <span 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border ${config.color} ${validation.wasOverridden ? 'opacity-60' : ''}`}
                      title={validation.wasOverridden ? `${config.label} - Overridden by user` : config.label}
                    >
                      <span aria-hidden="true">{config.icon}</span>
                      {validation.wasOverridden && <span className="text-[10px]">OVERRIDE</span>}
                    </span>
                  );
                })()}
              </div>
              <time 
                className="text-grimlog-light-steel text-xs font-mono"
                dateTime={new Date(event.timestamp).toISOString()}
              >
                {new Date(event.timestamp).toLocaleTimeString()}
              </time>
            </div>
            {/* Event description with optional unit icon */}
            {(() => {
              const unitInfo = extractUnitInfoFromEvent(event, attackerFaction, defenderFaction);
              const iconKey = unitInfo ? `${unitInfo.faction}:${unitInfo.unitName}` : null;
              const resolvedIconUrl = iconKey ? unitIcons[iconKey] : null;
              const icon = unitInfo ? getUnitIcon(resolvedIconUrl, unitInfo.unitName) : null;
              const hasCustomIcon = icon ? isCustomIcon(icon) : false;
              const actionCategory = getActionCategoryFromEvent(event);
              
              return (
                <div className={`flex items-start gap-2 ${event.isReverted ? 'line-through opacity-50' : ''}`}>
                  {/* Unit Icon with action indicator */}
                  {icon && (
                    <div className="relative flex-shrink-0 mt-0.5">
                      {hasCustomIcon ? (
                        <img
                          src={icon}
                          alt={`${unitInfo?.unitName} icon`}
                          className={`w-12 h-12 object-cover rounded-sm bg-grimlog-black ${actionCategory.borderClass}`}
                          loading="lazy"
                        />
                      ) : (
                        <span 
                          className={`w-12 h-12 rounded-sm bg-grimlog-slate-dark flex items-center justify-center text-2xl ${actionCategory.borderClass}`}
                          title={unitInfo?.unitName}
                        >
                          {icon}
                        </span>
                      )}
                      {/* Action Badge Overlay */}
                      {actionCategory.badge && (
                        <span 
                          className={`absolute -bottom-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${actionCategory.badge.bgClass} ${actionCategory.badge.textClass}`}
                          title={actionCategory.category}
                        >
                          {actionCategory.badge.symbol}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-grimlog-black text-base font-mono leading-relaxed flex-1">
                    {event.description}
                  </p>
                </div>
              );
            })()}
            
            
            {/* Expandable Revert Details */}
            {event.metadata?.isRevertAction && event.metadata?.affectedEvents && (
              <>
                <button
                  onClick={() => toggleRevertActionExpansion(event.id)}
                  className="mt-2 text-xs text-grimlog-amber hover:text-amber-300 font-mono flex items-center gap-1 transition-colors"
                >
                  {expandedRevertActions.has(event.id) ? '▼' : '▶'} 
                  Show {event.metadata.affectedEvents.length} affected event{event.metadata.affectedEvents.length !== 1 ? 's' : ''}
                </button>
                
                {expandedRevertActions.has(event.id) && (
                  <div className="mt-3 ml-4 border-l-2 border-grimlog-amber/30 pl-3 space-y-2">
                    <p className="text-xs text-grimlog-steel uppercase font-bold mb-2">
                      Events Reverted:
                    </p>
                    {event.metadata.affectedEvents.map((affectedEvent: any, idx: number) => (
                      <div 
                        key={idx}
                        className="text-xs bg-grimlog-black/50 border border-grimlog-steel/30 p-2 rounded"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-grimlog-orange font-bold">
                            {eventTypeIcons[affectedEvent.eventType] || '●'}
                          </span>
                          <span className="text-grimlog-steel uppercase font-mono">
                            {affectedEvent.eventType}
                          </span>
                          <span className="text-grimlog-light-steel text-[10px] font-mono ml-auto">
                            {new Date(affectedEvent.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-grimlog-light-steel/70 font-mono line-through">
                          {affectedEvent.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Revert Button - Only shows when row is selected */}
          {isSelected && canShowUndo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRevertClick(event);
              }}
              className="
                flex-shrink-0 flex items-center justify-center gap-1.5
                min-h-[44px] min-w-[44px] px-3 md:px-4
                text-sm md:text-xs font-bold uppercase tracking-wide
                bg-grimlog-red hover:bg-red-700 active:bg-red-800
                text-white border-2 border-grimlog-red/80
                transition-all duration-200 ease-out
                animate-slide-in-right
                rounded-sm
              "
              title="Undo this event"
              aria-label="Undo this event"
            >
              <span className="text-base" aria-hidden="true">⎌</span>
              <span className="hidden sm:inline">UNDO</span>
            </button>
          )}
          
          {/* Reverted Badge */}
          {event.isReverted && (
            <span className="flex-shrink-0 px-2 py-1 text-xs font-bold uppercase bg-gray-800 text-gray-400 border-2 border-gray-600">
              ⎌ REVERTED
            </span>
          )}
        </div>
      </article>
    );
  };

  return (
    <section 
      className="h-full flex flex-col bg-grimlog-slate-light border-l-2 border-grimlog-steel"
      aria-label="Event timeline"
      role="region"
    >
      {/* Sticky Header + Filters - Sticks to viewport on mobile, sticks to container on tablet+ */}
      <div className="sticky top-0 bg-grimlog-slate-light border-b-2 border-grimlog-steel">
        {/* Header */}
        <header className="p-2 bg-grimlog-slate-dark">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-grimlog-orange font-bold text-lg tracking-wider uppercase flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">◧</span>
              EVENT LOG
            </h2>
            <p className="text-grimlog-black text-xs font-mono">
              [{filteredEvents.length} of {events.length} {events.length === 1 ? 'ENTRY' : 'ENTRIES'}]
            </p>
          </div>
        </header>

        {/* Filter Bar */}
        {availableEventTypes.length > 0 && (
          <div className="p-1.5 bg-grimlog-slate border-t border-grimlog-steel">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-grimlog-steel text-xs font-bold tracking-wider uppercase flex-shrink-0">
                FILTER:
              </span>
              {availableEventTypes.map(eventType => (
                <button
                  key={eventType}
                  onClick={() => toggleFilter(eventType)}
                  className={`
                    px-2 py-1 text-xs font-bold tracking-wider uppercase border-2 transition-all btn-depth-sm hover-lift
                    ${selectedFilters.has(eventType)
                      ? `${eventTypeColors[eventType]} active-depth`
                      : 'bg-white text-grimlog-steel border-grimlog-steel hover:bg-grimlog-slate-dark'
                    }
                  `}
                  aria-pressed={selectedFilters.has(eventType)}
                  aria-label={`Filter ${eventTypeLabels[eventType]}`}
                >
                  <span aria-hidden="true">{eventTypeIcons[eventType]} </span>
                  {eventType.toUpperCase()}
                </button>
              ))}
              {selectedFilters.size > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-2 py-1 text-xs font-bold tracking-wider uppercase bg-grimlog-red hover:bg-red-600 text-white border-2 border-grimlog-red transition-all btn-depth hover-lift"
                  aria-label="Clear all filters"
                >
                  ✕ CLEAR
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline events */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {groupedEvents.length === 0 ? (
          <div className="text-grimlog-steel text-center text-sm font-mono mt-8">
            {events.length === 0 ? (
              <>
                <p>-- NO EVENTS LOGGED --</p>
                <p className="text-xs text-grimlog-black mt-2">Awaiting input...</p>
              </>
            ) : (
              <>
                <p>-- NO MATCHING EVENTS --</p>
                <p className="text-xs text-grimlog-black mt-2">Try different filters...</p>
              </>
            )}
          </div>
        ) : (
          groupedEvents.map((group, groupIndex) => {
            // Render revert groups
            if (group.type === 'revert-group') {
              const groupKey = group.events[0].id;
              const isGroupMinimized = minimizedReverts.has(groupKey);
              const isGroupExpanded = expandedRevertGroups.has(groupIndex);
              const totalAffectedEvents = group.events.reduce((sum, e) => 
                sum + (e.metadata?.affectedEvents?.length || 0), 0
              );
              
              if (isGroupMinimized) {
                 return (
                     <article key={`revert-group-min-${groupIndex}`} className="mb-2">
                        {renderMinimalRevert(
                            () => toggleRevertMinimized(groupKey),
                            group.events.length,
                            new Date(group.events[0].timestamp).toLocaleTimeString()
                        )}
                     </article>
                 )
              }

              return (
                <article 
                  key={`revert-group-${groupIndex}`}
                  className="relative p-3 border-l-4 border-2 border-dashed border-amber-500 bg-amber-100 hover:bg-amber-200 transition-all shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl text-amber-600 flex-shrink-0">
                      ⎌
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            <span 
                                className="px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 text-amber-700 border-amber-500 bg-amber-200 cursor-pointer hover:bg-amber-300"
                                onClick={() => toggleRevertMinimized(groupKey)}
                                title="Minimize group"
                            >
                                ⎌ REVERTS ({group.events.length})
                            </span>
                            <button 
                                onClick={() => toggleRevertMinimized(groupKey)}
                                className="text-amber-600 hover:text-amber-800 text-xs"
                                aria-label="Minimize group"
                            >
                                ▼
                            </button>
                        </div>
                        <span className="text-grimlog-steel text-xs font-mono">
                          {group.events.length} correction{group.events.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setExpandedRevertGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(groupIndex)) {
                              next.delete(groupIndex);
                            } else {
                              next.add(groupIndex);
                            }
                            return next;
                          });
                        }}
                        className="text-amber-700 hover:text-amber-900 font-mono text-sm flex items-center gap-1 transition-colors"
                      >
                        {isGroupExpanded ? '▼' : '▶'} 
                        {isGroupExpanded ? 'Hide' : 'Show'} {group.events.length} revert action{group.events.length !== 1 ? 's' : ''} ({totalAffectedEvents} events affected)
                      </button>
                      
                      {isGroupExpanded && (
                        <div className="mt-3 space-y-2 border-t border-amber-400 pt-2">
                          {group.events.map((event) => renderEvent(event, true))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            }
            
            // Render single events
            return renderEvent(group.events[0], false);
          })
        )}
      </div>
      
      {/* Inline styles for animations */}
      <style jsx>{`
        @keyframes slideDownBounce {
          0% {
            transform: translateY(-100%) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: translateY(10px) scale(1.02);
            opacity: 1;
          }
          80% {
            transform: translateY(-5px) scale(0.98);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes fadeOut {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          70% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.8);
          }
        }
        
        @keyframes glowPulse {
          0%, 100% {
            box-shadow: 0 0 5px rgba(255, 152, 0, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 152, 0, 0.8), 0 0 30px rgba(255, 152, 0, 0.4);
          }
        }
        
        .new-event-enter {
          animation: glowPulse 1.5s ease-in-out 3;
          border-left-width: 6px !important;
        }
      `}</style>
      
      {/* Global animation styles */}
      <style jsx global>{`
        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out forwards;
        }
      `}</style>
      
      {/* Revert Confirmation Dialog */}
      {revertConfirmation && (
        <RevertConfirmDialog
          eventDescription={revertConfirmation.description}
          subsequentCount={revertConfirmation.subsequentCount}
          onConfirm={handleConfirmRevert}
          onCancel={() => setRevertConfirmation(null)}
        />
      )}
    </section>
  );
}
