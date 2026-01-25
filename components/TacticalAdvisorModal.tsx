'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import type { TacticalAdviceResponse, TacticalSuggestion } from '@/lib/types';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';

// ============================================
// Types
// ============================================

interface TacticalAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  currentPhase: string;
  currentTurn: 'attacker' | 'defender';
}

// ============================================
// Priority & Category Styling (Event Log row vibe)
// ============================================

const priorityStyles = {
  high: {
    borderLeft: 'border-l-grimlog-orange',
    chip: 'text-orange-700 border-grimlog-orange bg-orange-100',
    icon: '🔥'
  },
  medium: {
    borderLeft: 'border-l-grimlog-amber',
    chip: 'text-amber-700 border-amber-500 bg-amber-100',
    icon: '⚡'
  },
  low: {
    borderLeft: 'border-l-grimlog-steel',
    chip: 'text-gray-700 border-gray-500 bg-gray-100',
    icon: '💡'
  }
};

const categoryIcons: Record<string, string> = {
  positioning: '🎯',
  stratagem: '📜',
  ability: '⚔️',
  objective: '🏁',
  resource: '💎',
  threat: '⚠️',
  opponent_threat: '🛡️'
};

const categoryLabels: Record<string, string> = {
  positioning: 'Movement',
  stratagem: 'Stratagem',
  ability: 'Ability',
  objective: 'Objective',
  resource: 'Resources',
  threat: 'Threat',
  opponent_threat: 'Watch Out'
};

// Owner-based styling: Your plays vs Opponent threats
const ownerStyles = {
  player: {
    borderLeft: 'border-l-grimlog-orange',
    badge: 'bg-grimlog-orange text-gray-900 border-grimlog-orange',
    badgeLabel: 'YOUR PLAY',
    cardBg: 'bg-white',
  },
  opponent: {
    borderLeft: 'border-l-red-600',
    badge: 'bg-red-600 text-white border-red-600',
    badgeLabel: 'OPPONENT',
    cardBg: 'bg-red-50',
  }
};

// ============================================
// Main Modal Component
// ============================================

export default function TacticalAdvisorModal({
  isOpen,
  onClose,
  sessionId,
  currentPhase,
  currentTurn
}: TacticalAdvisorModalProps) {
  // State
  const [detailLevel, setDetailLevel] = useState<'quick' | 'detailed'>('quick');
  const [advice, setAdvice] = useState<TacticalAdviceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch advice (manual trigger only - no auto-fetch)
  const fetchAdvice = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/tactical-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          perspective: currentTurn, // Analyze from whoever's turn it currently is
          detailLevel
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get tactical advice');
      }
      
      const data: TacticalAdviceResponse = await response.json();
      setAdvice(data);
    } catch (err) {
      console.error('Failed to fetch tactical advice:', err);
      setError(err instanceof Error ? err.message : 'Failed to get tactical advice');
    } finally {
      setLoading(false);
    }
  }, [sessionId, currentTurn, detailLevel]);

  // Collapse expanded state when leaving detailed mode
  useEffect(() => {
    if (detailLevel !== 'detailed') {
      setExpandedSuggestion(null);
    }
  }, [detailLevel]);
  
  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setAdvice(null);
      setError(null);
      setExpandedSuggestion(null);
    }
  }, [isOpen]);

  const iconUnits = useMemo(() => {
    if (!advice?.suggestions || !advice.unitDirectory || !advice.meta) return [];

    const attackerFaction = advice.meta.attackerFaction || '';
    const defenderFaction = advice.meta.defenderFaction || '';

    const uniq = new Map<string, { unitName: string; faction: string }>();

    for (const s of advice.suggestions) {
      for (const unitId of s.relatedUnitIds || []) {
        const u = advice.unitDirectory[unitId];
        if (!u) continue;
        const faction = u.owner === 'attacker' ? attackerFaction : defenderFaction;
        if (!faction) continue;
        const key = `${faction}:${u.name}`;
        if (!uniq.has(key)) {
          uniq.set(key, { unitName: u.name, faction });
        }
      }
    }

    return Array.from(uniq.values());
  }, [advice]);

  const { icons: resolvedIcons } = useUnitIcons(iconUnits, { autoFetch: Boolean(isOpen && iconUnits.length > 0) });

  if (!isOpen) return null;

  const turnLabel = currentTurn === 'attacker' ? 'Your Turn' : "Opponent's Turn";
  
  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tactical-advisor-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-2xl mx-auto max-h-[85vh] flex flex-col overflow-hidden rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 
              id="tactical-advisor-title"
              className="text-gray-900 text-lg font-bold tracking-wider uppercase flex items-center gap-2"
            >
              <span className="text-xl">🧠</span>
              Tactical Advisor
            </h2>
            <div className="text-gray-600 text-xs mt-1">
              {currentPhase} Phase • {turnLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl font-bold transition-colors ml-4 w-10 h-10 flex items-center justify-center rounded-lg"
            aria-label="Close tactical advisor"
          >
            ✕
          </button>
        </div>
        
        {/* Controls */}
        <div className="px-4 py-3 bg-grimlog-slate-dark border-b border-grimlog-steel flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {/* Detail Level Toggle */}
            <div className="flex">
              <button
                onClick={() => setDetailLevel('quick')}
                className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase border transition-all rounded-l-lg ${
                  detailLevel === 'quick'
                    ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-grimlog-orange'
                }`}
              >
                Quick Tips
              </button>
              <button
                onClick={() => setDetailLevel('detailed')}
                className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase border border-l-0 transition-all rounded-r-lg ${
                  detailLevel === 'detailed'
                    ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-grimlog-orange'
                }`}
              >
                Detailed
              </button>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={fetchAdvice}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase border border-gray-300 text-gray-600 hover:border-grimlog-orange hover:text-grimlog-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto bg-white rounded-lg"
            >
              {loading ? '...' : '↻ Refresh'}
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-grimlog-slate-light p-2 md:p-3 space-y-2">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-center">
              <div className="text-red-600 font-bold mb-2">⚠️ Error</div>
              <div className="text-gray-600 text-sm">{error}</div>
              <button
                onClick={fetchAdvice}
                className="mt-3 px-4 py-2 bg-grimlog-orange text-gray-900 font-bold text-sm tracking-wider uppercase hover:bg-grimlog-amber transition-colors rounded-lg"
              >
                Retry
              </button>
            </div>
          )}
          
          {/* Loading State */}
          {loading && !error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-4xl mb-4 animate-pulse">🧠</div>
              <div className="text-grimlog-orange font-bold tracking-wider uppercase">
                Analyzing...
              </div>
              <div className="text-gray-500 text-sm mt-2">
                Evaluating tactical options
              </div>
            </div>
          )}
          
          {/* Empty State - Generate Button */}
          {!loading && !error && !advice && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-5xl mb-4">🧠</div>
              <div className="text-gray-600 text-center mb-6 max-w-sm">
                <p className="font-bold text-lg mb-2 text-gray-800">Ready to Analyze</p>
                <p className="text-sm">
                  Generate AI-powered tactical suggestions based on the current game state. 
                  Includes your plays and opponent threat awareness.
                </p>
              </div>
              <button
                onClick={fetchAdvice}
                className="px-6 py-3 bg-grimlog-orange text-gray-900 font-bold text-sm tracking-wider uppercase hover:bg-grimlog-amber transition-colors rounded-lg shadow-lg"
              >
                🎯 Generate Tactical Advice
              </button>
            </div>
          )}
          
          {/* Suggestions */}
          {!loading && !error && advice && (
            <>
              {/* Context Summary */}
              <div className="sticky top-0 z-10 -mx-2 md:-mx-3 px-2 md:px-3 pt-2 pb-2 bg-grimlog-slate-light border-b border-gray-300">
                <div className="bg-white border-2 border-gray-300 rounded-lg p-2 text-xs">
                  <div className="flex flex-wrap gap-4 text-gray-800 font-mono items-center">
                  {advice.meta?.primaryMission?.name && (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-2 border-grimlog-orange bg-orange-50 text-gray-900 rounded">
                        🎯 {advice.meta.primaryMission.name}
                      </span>
                    )}
                  <span>
                    <span className="text-grimlog-orange font-bold">CP:</span> {advice.context.cpAvailable}
                  </span>
                  <span>
                    <span className="text-grimlog-orange font-bold">VP:</span> {advice.context.vpDifferential >= 0 ? '+' : ''}{advice.context.vpDifferential}
                  </span>
                  <span>
                    <span className="text-grimlog-orange font-bold">Units:</span> {advice.context.unitsAnalyzed} active
                  </span>
                  <span>
                    <span className="text-grimlog-orange font-bold">Objectives:</span> {advice.context.objectivesHeld} held
                  </span>
                  </div>

                  {advice.meta?.primaryMission?.scoringTiming && (
                    <div className="mt-2 text-[10px] text-gray-700 font-mono">
                      <span className="text-gray-500 font-bold uppercase tracking-wider">Primary:</span>{' '}
                      {advice.meta.primaryMission.scoringTiming}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Suggestion Cards */}
              {advice.suggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No specific suggestions at this time.
                </div>
              ) : (
                advice.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    detailLevel={detailLevel}
                    isExpanded={expandedSuggestion === suggestion.id}
                    onToggle={() => setExpandedSuggestion(
                      expandedSuggestion === suggestion.id ? null : suggestion.id
                    )}
                    unitDirectory={advice.unitDirectory}
                    attackerFaction={advice.meta?.attackerFaction}
                    defenderFaction={advice.meta?.defenderFaction}
                    resolvedIcons={resolvedIcons}
                  />
                ))
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 bg-grimlog-slate-dark border-t border-grimlog-steel text-gray-600 text-xs flex-shrink-0 flex items-center justify-between">
          <span>
            <span className="text-grimlog-orange font-bold">AI-Powered</span> • Gemini 3 Flash
          </span>
          {advice && (
            <span className="text-gray-400">
              Generated {new Date(advice.generatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Suggestion Card Component
// ============================================

interface SuggestionCardProps {
  suggestion: TacticalSuggestion;
  detailLevel: 'quick' | 'detailed';
  isExpanded: boolean;
  onToggle: () => void;
  unitDirectory?: TacticalAdviceResponse['unitDirectory'];
  attackerFaction?: string;
  defenderFaction?: string;
  resolvedIcons?: Record<string, string | null>;
}

function SuggestionCard({
  suggestion,
  detailLevel,
  isExpanded,
  onToggle,
  unitDirectory,
  attackerFaction,
  defenderFaction,
  resolvedIcons = {},
}: SuggestionCardProps) {
  const style = priorityStyles[suggestion.priority];
  const categoryIcon = categoryIcons[suggestion.category] || '📋';
  const categoryLabel = categoryLabels[suggestion.category] || suggestion.category;
  
  // Determine if this is an opponent threat (color-coded differently)
  const isOpponentThreat = suggestion.isOpponentPlay || suggestion.category === 'opponent_threat';
  const ownerStyle = isOpponentThreat ? ownerStyles.opponent : ownerStyles.player;
  const isExpandable =
    detailLevel === 'detailed' &&
    Boolean(
      suggestion.reasoning ||
      (suggestion.relatedUnits && suggestion.relatedUnits.length > 0) ||
      (suggestion.relatedRules && suggestion.relatedRules.length > 0)
    );
  const detailsId = `tactical-suggestion-details-${suggestion.id}`;

  const relatedUnitsResolved = (suggestion.relatedUnitIds || [])
    .map((id) => unitDirectory?.[id])
    .filter(Boolean) as Array<NonNullable<NonNullable<SuggestionCardProps['unitDirectory']>[string]>>;

  const resolveFactionForUnit = (owner: 'attacker' | 'defender') => {
    return owner === 'attacker' ? attackerFaction : defenderFaction;
  };

  const renderUnitIcon = (u: { name: string; owner: 'attacker' | 'defender'; datasheet?: string; iconUrl?: string | null }) => {
    // Prefer per-unit iconUrl if set (unit-specific override)
    const customUrl = u.iconUrl || null;
    const faction = resolveFactionForUnit(u.owner) || '';
    const resolvedUrl = faction ? resolvedIcons[`${faction}:${u.name}`] : null;
    const icon = getUnitIcon(customUrl || resolvedUrl, u.datasheet || u.name);
    const isImg = isCustomIcon(icon);

    return (
      <div
        key={`${u.owner}:${u.name}`}
        className="w-12 h-12 rounded-sm overflow-hidden border border-gray-300 bg-white flex items-center justify-center"
        title={u.name}
        aria-label={u.name}
      >
        {isImg ? (
          <img src={icon} alt={u.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <span className="text-xl" aria-hidden="true">{icon}</span>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-0">
      {isExpandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          className={`
            w-full text-left
            relative p-3 border-l-4 border-2 shadow-sm rounded-lg
            border-gray-300 ${ownerStyle.borderLeft} ${ownerStyle.cardBg}
            hover:brightness-95 hover:border-l-[6px]
            focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2
            transition-all duration-200
          `}
        >
          <div className="flex items-start gap-3">
            {/* Priority Icon */}
            <span className="text-2xl flex-shrink-0 drop-shadow-lg" aria-hidden="true">
              {style.icon}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Owner badge (Your Play vs Opponent) */}
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-2 rounded ${ownerStyle.badge}`}>
                    {ownerStyle.badgeLabel}
                  </span>

                  {/* Priority chip */}
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 rounded ${style.chip}`}>
                    {suggestion.priority}
                  </span>

                  {/* Category chip */}
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 rounded ${
                    isOpponentThreat 
                      ? 'text-red-700 border-red-400 bg-red-100' 
                      : 'text-gray-700 border-gray-500 bg-gray-100'
                  }`}>
                    {categoryIcon} {categoryLabel}
                  </span>

                  {/* CP Cost */}
                  {suggestion.cpCost !== undefined && (
                    <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 rounded ${
                      isOpponentThreat
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                    }`}>
                      {suggestion.cpCost} CP
                    </span>
                  )}
                </div>

                {/* Expand chevron */}
                <span className="text-gray-500 text-xs font-mono flex items-center gap-1 flex-shrink-0">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>

              {/* Title */}
              <div className={`font-bold text-base leading-tight ${isOpponentThreat ? 'text-red-900' : 'text-gray-900'}`}>
                {suggestion.title}
              </div>

              {/* Description */}
              <div className={`text-sm mt-1 leading-relaxed font-mono ${isOpponentThreat ? 'text-red-800' : 'text-gray-700'}`}>
                {suggestion.description}
              </div>

              {/* Quick Tips: show related unit icons for faster scanning */}
              {(detailLevel as string) === 'quick' && relatedUnitsResolved.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {relatedUnitsResolved.slice(0, 6).map(renderUnitIcon)}
                  {relatedUnitsResolved.length > 6 && (
                    <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-gray-300 bg-gray-100 text-gray-700 rounded">
                      +{relatedUnitsResolved.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </button>
      ) : (
        <article
          className={`
            relative p-3 border-l-4 border-2 shadow-sm rounded-lg
            border-gray-300 ${ownerStyle.borderLeft} ${ownerStyle.cardBg}
            transition-all duration-200
          `}
          aria-label={`Tactical suggestion: ${suggestion.title}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 drop-shadow-lg" aria-hidden="true">
              {style.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Owner badge (Your Play vs Opponent) */}
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-2 rounded ${ownerStyle.badge}`}>
                  {ownerStyle.badgeLabel}
                </span>
                <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 rounded ${style.chip}`}>
                  {suggestion.priority}
                </span>
                <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 rounded ${
                  isOpponentThreat 
                    ? 'text-red-700 border-red-400 bg-red-100' 
                    : 'text-gray-700 border-gray-500 bg-gray-100'
                }`}>
                  {categoryIcon} {categoryLabel}
                </span>
                {suggestion.cpCost !== undefined && (
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 rounded ${
                    isOpponentThreat
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                  }`}>
                    {suggestion.cpCost} CP
                  </span>
                )}
              </div>
              <div className={`font-bold text-base leading-tight ${isOpponentThreat ? 'text-red-900' : 'text-gray-900'}`}>
                {suggestion.title}
              </div>
              <div className={`text-sm mt-1 leading-relaxed font-mono ${isOpponentThreat ? 'text-red-800' : 'text-gray-700'}`}>
                {suggestion.description}
              </div>

              {detailLevel === 'quick' && relatedUnitsResolved.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {relatedUnitsResolved.slice(0, 6).map(renderUnitIcon)}
                  {relatedUnitsResolved.length > 6 && (
                    <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-gray-300 bg-gray-100 text-gray-700 rounded">
                      +{relatedUnitsResolved.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </article>
      )}
      
      {/* Expanded Details (Detailed Mode) */}
      {isExpanded && isExpandable && (
        <div
          id={detailsId}
          className={`
            px-3 pb-3 pt-0
            border-l-4 border-r-2 border-b-2 border-t-0 rounded-b-lg
            border-gray-300 ${ownerStyle.borderLeft}
            ${ownerStyle.cardBg} -mt-1
          `}
        >
          {/* Reasoning */}
          {suggestion.reasoning && (
            <div className="mt-3">
              <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isOpponentThreat ? 'text-red-600' : 'text-gray-500'}`}>
                Reasoning
              </div>
              <div className={`text-sm leading-relaxed font-mono ${isOpponentThreat ? 'text-red-800' : 'text-gray-700'}`}>
                {suggestion.reasoning}
              </div>
            </div>
          )}
          
          {/* Related Units */}
          {suggestion.relatedUnits && suggestion.relatedUnits.length > 0 && (
            <div className="mt-3">
              <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isOpponentThreat ? 'text-red-600' : 'text-gray-500'}`}>
                Related Units
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestion.relatedUnits.map((unit, i) => (
                  <span 
                    key={i}
                    className={`px-2 py-0.5 text-xs border font-mono rounded ${
                      isOpponentThreat 
                        ? 'bg-red-100 border-red-300 text-red-800' 
                        : 'bg-gray-100 border-gray-300 text-gray-700'
                    }`}
                  >
                    {unit}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Related Rules */}
          {suggestion.relatedRules && suggestion.relatedRules.length > 0 && (
            <div className="mt-3">
              <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isOpponentThreat ? 'text-red-600' : 'text-gray-500'}`}>
                Rules Referenced
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestion.relatedRules.map((rule, i) => (
                  <span 
                    key={i}
                    className={`px-2 py-0.5 text-xs border font-mono rounded ${
                      isOpponentThreat
                        ? 'bg-red-200 border-red-400 text-red-800'
                        : 'bg-orange-100 border-grimlog-orange text-orange-800'
                    }`}
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
