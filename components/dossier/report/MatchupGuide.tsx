'use client';

import { useState } from 'react';
import { EditableText } from '../EditableText';
import { EditableSelect } from '../EditableSelect';
import {
  OpponentArchetype,
  MatchupRating,
  WinCondition,
  MatchupConsideration,
} from '@/lib/dossierAnalysis';

// Extended type for display - handles backward compatibility with old data
type DisplayMatchup = Omit<MatchupConsideration, 'winCondition' | 'battlePlan'> & {
  winCondition?: WinCondition;
  battlePlan?: string;
};

// Win condition display configuration
const WIN_CONDITION_CONFIG: Record<WinCondition, { label: string; color: string }> = {
  outscore: { label: 'Outscore', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  tabling: { label: 'Table', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  attrition: { label: 'Grind', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  alpha_strike: { label: 'Alpha', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  denial: { label: 'Deny', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
};

// Display configuration for opponent archetypes
const ARCHETYPE_CONFIG: Record<OpponentArchetype, { label: string; icon: string; color: string }> = {
  horde_armies: { label: 'Horde', icon: '🐀', color: 'text-amber-400' },
  elite_armies: { label: 'Elite', icon: '⚔️', color: 'text-blue-400' },
  vehicle_spam: { label: 'Vehicles', icon: '🚀', color: 'text-purple-400' },
  monster_mash: { label: 'Monsters', icon: '🦖', color: 'text-emerald-400' },
  skirmish_msu: { label: 'Skirmish', icon: '🗡️', color: 'text-cyan-400' },
  melee_rush: { label: 'Melee Rush', icon: '💀', color: 'text-red-400' },
  gunline: { label: 'Gunline', icon: '🎯', color: 'text-orange-400' },
  attrition: { label: 'Attrition', icon: '🛡️', color: 'text-slate-300' },
};

// Rating configuration with colors and numeric values for sorting
const RATING_CONFIG: Record<MatchupRating, { label: string; color: string; bgColor: string; value: number }> = {
  very_favorable: { label: 'Strong', color: 'text-green-400', bgColor: 'bg-green-500', value: 5 },
  favorable: { label: 'Good', color: 'text-green-300', bgColor: 'bg-green-400', value: 4 },
  even: { label: 'Even', color: 'text-amber-400', bgColor: 'bg-amber-500', value: 3 },
  unfavorable: { label: 'Tough', color: 'text-red-300', bgColor: 'bg-red-400', value: 2 },
  very_unfavorable: { label: 'Hard', color: 'text-red-400', bgColor: 'bg-red-500', value: 1 },
};

// Convert configs to select options
const ARCHETYPE_OPTIONS = Object.entries(ARCHETYPE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  icon: config.icon,
  color: config.color,
}));

const RATING_OPTIONS = Object.entries(RATING_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  color: config.color,
}));

const WIN_CONDITION_OPTIONS = Object.entries(WIN_CONDITION_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  color: config.color.split(' ')[1], // Extract text color class
}));

interface MatchupGuideProps {
  matchups: DisplayMatchup[] | undefined;
  isEditMode?: boolean;
  onUpdate?: (matchups: MatchupConsideration[]) => void;
}

const DEFAULT_NEW_MATCHUP: MatchupConsideration = {
  opponentArchetype: 'elite_armies',
  matchupRating: 'even',
  winCondition: 'outscore',
  battlePlan: 'Describe your battle plan...',
  reasoning: 'Explain the matchup dynamics...',
  keyTips: ['Tip 1'],
};

// Helper to ensure matchup has all required fields for saving
const normalizeMatchup = (matchup: DisplayMatchup): MatchupConsideration => ({
  ...matchup,
  winCondition: matchup.winCondition || 'outscore',
  battlePlan: matchup.battlePlan || '',
});

export default function MatchupGuide({
  matchups,
  isEditMode = false,
  onUpdate,
}: MatchupGuideProps) {
  const [expandedMatchups, setExpandedMatchups] = useState<Set<OpponentArchetype>>(new Set());

  if (!matchups || matchups.length === 0) {
    if (!isEditMode) return null;
    // In edit mode with no matchups, show add button
    return (
      <div className="py-2">
        <button
          onClick={() => onUpdate?.([DEFAULT_NEW_MATCHUP])}
          className="w-full p-4 border-2 border-dashed border-grimlog-steel/50 rounded text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors"
        >
          + Add Matchup
        </button>
      </div>
    );
  }

  // Sort matchups: favorable first, then even, then unfavorable
  const sortedMatchups = [...matchups].sort((a, b) => {
    return RATING_CONFIG[b.matchupRating].value - RATING_CONFIG[a.matchupRating].value;
  });

  // Calculate rating bar width (1-5 scale to percentage)
  const getRatingWidth = (rating: MatchupRating): number => {
    return (RATING_CONFIG[rating].value / 5) * 100;
  };

  const updateMatchup = (index: number, updates: Partial<DisplayMatchup>) => {
    if (!onUpdate) return;
    const originalIndex = matchups.findIndex(
      (m) => m.opponentArchetype === sortedMatchups[index].opponentArchetype
    );
    const newMatchups = [...matchups];
    newMatchups[originalIndex] = { ...newMatchups[originalIndex], ...updates };
    onUpdate(newMatchups.map(normalizeMatchup));
  };

  const removeMatchup = (index: number) => {
    if (!onUpdate) return;
    const originalIndex = matchups.findIndex(
      (m) => m.opponentArchetype === sortedMatchups[index].opponentArchetype
    );
    const newMatchups = matchups.filter((_, i) => i !== originalIndex);
    onUpdate(newMatchups.map(normalizeMatchup));
  };

  const addMatchup = () => {
    if (!onUpdate) return;
    // Find an archetype not yet used
    const usedArchetypes = new Set(matchups.map((m) => m.opponentArchetype));
    const availableArchetype = Object.keys(ARCHETYPE_CONFIG).find(
      (a) => !usedArchetypes.has(a as OpponentArchetype)
    ) as OpponentArchetype | undefined;

    if (!availableArchetype) return; // All archetypes used

    onUpdate([
      ...matchups.map(normalizeMatchup),
      { ...DEFAULT_NEW_MATCHUP, opponentArchetype: availableArchetype },
    ]);
  };

  const updateTip = (matchupIndex: number, tipIndex: number, value: string) => {
    const matchup = sortedMatchups[matchupIndex];
    const newTips = [...matchup.keyTips];
    newTips[tipIndex] = value;
    updateMatchup(matchupIndex, { keyTips: newTips });
  };

  const addTip = (matchupIndex: number) => {
    const matchup = sortedMatchups[matchupIndex];
    updateMatchup(matchupIndex, { keyTips: [...matchup.keyTips, 'New tip...'] });
  };

  const removeTip = (matchupIndex: number, tipIndex: number) => {
    const matchup = sortedMatchups[matchupIndex];
    if (matchup.keyTips.length <= 1) return;
    const newTips = matchup.keyTips.filter((_, i) => i !== tipIndex);
    updateMatchup(matchupIndex, { keyTips: newTips });
  };

  return (
    <div className="py-2">
      <div className={`bg-grimlog-darkGray/50 border rounded-lg overflow-hidden ${
        isEditMode ? 'border-grimlog-orange/50' : 'border-grimlog-steel/30'
      }`}>
        {/* Matchup list */}
        <ul className="divide-y divide-grimlog-steel/30">
          {sortedMatchups.map((matchup, sortedIndex) => {
            const archetype = ARCHETYPE_CONFIG[matchup.opponentArchetype] || {
              label: matchup.opponentArchetype.replace(/_/g, ' '),
              icon: '❓',
              color: 'text-gray-300'
            };
            const rating = RATING_CONFIG[matchup.matchupRating] || RATING_CONFIG.even;
            const winCondition = matchup.winCondition ? WIN_CONDITION_CONFIG[matchup.winCondition] : null;
            const isItemExpanded = expandedMatchups.has(matchup.opponentArchetype);
            // Use battlePlan as preview if available, otherwise fall back to first tip
            const previewText = matchup.battlePlan || matchup.keyTips?.[0];

            return (
              <li key={matchup.opponentArchetype} className="px-2 py-3">
                {/* Main row - use div in edit mode to avoid nested buttons */}
                <div
                  onClick={() => {
                    const newSet = new Set(expandedMatchups);
                    if (isItemExpanded) {
                      newSet.delete(matchup.opponentArchetype);
                    } else {
                      newSet.add(matchup.opponentArchetype);
                    }
                    setExpandedMatchups(newSet);
                  }}
                  className="w-full text-left cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const newSet = new Set(expandedMatchups);
                      if (isItemExpanded) {
                        newSet.delete(matchup.opponentArchetype);
                      } else {
                        newSet.add(matchup.opponentArchetype);
                      }
                      setExpandedMatchups(newSet);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    {/* Archetype - editable in edit mode */}
                    {isEditMode ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <EditableSelect
                          value={matchup.opponentArchetype}
                          onChange={(v) => updateMatchup(sortedIndex, { opponentArchetype: v as OpponentArchetype })}
                          isEditMode={isEditMode}
                          options={ARCHETYPE_OPTIONS}
                          className="min-w-[100px]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-sm">{archetype.icon}</span>
                        <span className={`text-sm font-semibold whitespace-nowrap ${archetype.color}`}>{archetype.label}</span>
                      </div>
                    )}

                    {/* Rating bar - editable dropdown in edit mode */}
                    {isEditMode ? (
                      <div onClick={(e) => e.stopPropagation()} className="flex-1 min-w-[80px]">
                        <EditableSelect
                          value={matchup.matchupRating}
                          onChange={(v) => updateMatchup(sortedIndex, { matchupRating: v as MatchupRating })}
                          isEditMode={isEditMode}
                          options={RATING_OPTIONS}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-[40px] h-1.5 bg-grimlog-darkGray rounded-full overflow-hidden">
                          <div
                            className={`h-full ${rating.bgColor} transition-all`}
                            style={{ width: `${getRatingWidth(matchup.matchupRating)}%` }}
                          />
                        </div>

                        {/* Rating label */}
                        <span className={`text-sm font-bold uppercase w-16 text-right ${rating.color}`}>
                          {rating.label}
                        </span>
                      </>
                    )}

                    {/* Win condition badge */}
                    {isEditMode ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <EditableSelect
                          value={matchup.winCondition || 'outscore'}
                          onChange={(v) => updateMatchup(sortedIndex, { winCondition: v as WinCondition })}
                          isEditMode={isEditMode}
                          options={WIN_CONDITION_OPTIONS}
                          className="min-w-[80px]"
                        />
                      </div>
                    ) : (
                      winCondition && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${winCondition.color}`}>
                          {winCondition.label}
                        </span>
                      )
                    )}

                    {/* Expand indicator */}
                    <span className="text-gray-400 text-sm">
                      {isItemExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Battle plan preview (always visible when collapsed) */}
                  {previewText && !isItemExpanded && !isEditMode && (
                    <p className="text-gray-200 text-sm mt-1">
                      {previewText}
                    </p>
                  )}
                </div>

                {/* Expanded details */}
                {isItemExpanded && (
                  <div className="mt-2 space-y-2">
                    {/* Battle Plan (prominent) */}
                    <div className="bg-grimlog-darkGray/50 border-l-2 border-grimlog-orange px-2 py-1.5 rounded-r">
                      <span className="text-grimlog-orange text-xs font-bold uppercase block mb-0.5">Battle Plan</span>
                      {isEditMode ? (
                        <EditableText
                          value={matchup.battlePlan || ''}
                          onChange={(v) => updateMatchup(sortedIndex, { battlePlan: v })}
                          isEditMode={isEditMode}
                          multiline
                          placeholder="Describe your battle plan..."
                          className="text-gray-200 text-sm leading-relaxed w-full"
                        />
                      ) : (
                        matchup.battlePlan && (
                          <p className="text-gray-200 text-sm leading-relaxed">
                            {matchup.battlePlan}
                          </p>
                        )
                      )}
                    </div>

                    {/* Reasoning */}
                    <div>
                      <span className="text-grimlog-steel text-xs font-bold uppercase block mb-0.5">Reasoning</span>
                      {isEditMode ? (
                        <EditableText
                          value={matchup.reasoning}
                          onChange={(v) => updateMatchup(sortedIndex, { reasoning: v })}
                          isEditMode={isEditMode}
                          multiline
                          placeholder="Explain the matchup dynamics..."
                          className="text-gray-300 text-sm leading-relaxed w-full"
                        />
                      ) : (
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {matchup.reasoning}
                        </p>
                      )}
                    </div>

                    {/* All tips */}
                    {(matchup.keyTips && matchup.keyTips.length > 0) || isEditMode ? (
                      <div className="space-y-1.5">
                        <span className="text-grimlog-orange text-xs font-bold uppercase">Phased Tips</span>
                        <ul className="space-y-1.5">
                          {matchup.keyTips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="text-gray-300 text-sm flex gap-2 items-start">
                              <span className="text-grimlog-orange">•</span>
                              {isEditMode ? (
                                <div className="flex-1 flex gap-1 items-start">
                                  <EditableText
                                    value={tip}
                                    onChange={(v) => updateTip(sortedIndex, tipIndex, v)}
                                    isEditMode={isEditMode}
                                    placeholder="Tip..."
                                    className="flex-1"
                                  />
                                  {matchup.keyTips.length > 1 && (
                                    <button
                                      onClick={() => removeTip(sortedIndex, tipIndex)}
                                      className="text-grimlog-red hover:bg-grimlog-red/20 rounded text-xs px-1"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span>{tip}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {isEditMode && (
                          <button
                            onClick={() => addTip(sortedIndex)}
                            className="text-grimlog-orange text-xs hover:underline"
                          >
                            + Add Tip
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* Remove matchup button - only in edit mode */}
                    {isEditMode && (
                      <div className="mt-3 pt-2 border-t border-grimlog-steel/30">
                        <button
                          onClick={() => removeMatchup(sortedIndex)}
                          className="w-full py-2 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 bg-grimlog-red/20 hover:bg-grimlog-red/30 border border-grimlog-red/70 hover:border-grimlog-red rounded text-xs font-medium uppercase tracking-wider transition-colors"
                        >
                          <span>✕</span>
                          <span>Remove Matchup</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Remove button when collapsed in edit mode */}
                {isEditMode && !isItemExpanded && (
                  <div className="mt-2">
                    <button
                      onClick={() => removeMatchup(sortedIndex)}
                      className="w-full py-1.5 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 bg-grimlog-red/20 hover:bg-grimlog-red/30 border border-grimlog-red/70 hover:border-grimlog-red rounded text-xs font-medium uppercase tracking-wider transition-colors"
                    >
                      <span>✕</span>
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Add matchup button in edit mode */}
        {isEditMode && matchups.length < Object.keys(ARCHETYPE_CONFIG).length && (
          <div className="p-3 border-t border-grimlog-steel/30">
            <button
              onClick={addMatchup}
              className="w-full p-3 border-2 border-dashed border-grimlog-steel/50 rounded text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors text-sm"
            >
              + Add Matchup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
