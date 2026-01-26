'use client';

import { ListSuggestion, UnitChange, EnhancementChange } from '@/lib/briefAnalysis';
import { EditableText } from '../EditableText';
import { EditableSelect } from '../EditableSelect';

interface ListSuggestionsSectionProps {
  suggestions: ListSuggestion[];
  faction: string | null;
  icons: Record<string, string | null>;
  isEditMode?: boolean;
  onUpdate?: (suggestions: ListSuggestion[]) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: 'text-red-400' },
  { value: 'medium', label: 'Medium', color: 'text-amber-400' },
  { value: 'low', label: 'Low', color: 'text-green-400' },
];

const DEFAULT_NEW_SUGGESTION: ListSuggestion = {
  priority: 'medium',
  title: 'New Suggestion',
  removeUnits: [],
  addUnits: [],
  addEnhancements: [],
  pointsDelta: 0,
  addressesGap: 'Describe what gap this addresses...',
  tradeoffs: 'Describe trade-offs...',
  reasoning: 'Explain the reasoning...',
};

const DEFAULT_NEW_UNIT: UnitChange = {
  name: 'Unit Name',
  points: 0,
};

const DEFAULT_NEW_ENHANCEMENT: EnhancementChange = {
  name: 'Enhancement Name',
  points: 0,
  targetCharacter: 'Target Character',
};

export default function ListSuggestionsSection({
  suggestions,
  faction,
  icons,
  isEditMode = false,
  onUpdate,
}: ListSuggestionsSectionProps) {
  if (!suggestions || suggestions.length === 0) {
    if (!isEditMode) {
      return (
        <p className="text-gray-300 text-sm italic">No list modification suggestions available.</p>
      );
    }
    // In edit mode with no suggestions, show add button
    return (
      <div className="py-2">
        <button
          onClick={() => onUpdate?.([DEFAULT_NEW_SUGGESTION])}
          className="w-full p-4 border-2 border-dashed border-grimlog-steel/50 rounded text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors"
        >
          + Add List Suggestion
        </button>
      </div>
    );
  }

  const getIcon = (unitName: string) => {
    const key = `${faction}:${unitName}`;
    return icons[key] || null;
  };

  const updateSuggestion = (index: number, updates: Partial<ListSuggestion>) => {
    if (!onUpdate) return;
    const newSuggestions = [...suggestions];
    newSuggestions[index] = { ...newSuggestions[index], ...updates };
    onUpdate(newSuggestions);
  };

  const removeSuggestion = (index: number) => {
    if (!onUpdate) return;
    const newSuggestions = suggestions.filter((_, i) => i !== index);
    onUpdate(newSuggestions);
  };

  const addSuggestion = () => {
    if (!onUpdate) return;
    onUpdate([...suggestions, { ...DEFAULT_NEW_SUGGESTION }]);
  };

  // Unit management helpers
  const updateRemoveUnit = (suggestionIdx: number, unitIdx: number, updates: Partial<UnitChange>) => {
    const suggestion = suggestions[suggestionIdx];
    const newUnits = [...suggestion.removeUnits];
    newUnits[unitIdx] = { ...newUnits[unitIdx], ...updates };
    updateSuggestion(suggestionIdx, { removeUnits: newUnits });
  };

  const addRemoveUnit = (suggestionIdx: number) => {
    const suggestion = suggestions[suggestionIdx];
    updateSuggestion(suggestionIdx, {
      removeUnits: [...suggestion.removeUnits, { ...DEFAULT_NEW_UNIT }],
    });
  };

  const deleteRemoveUnit = (suggestionIdx: number, unitIdx: number) => {
    const suggestion = suggestions[suggestionIdx];
    updateSuggestion(suggestionIdx, {
      removeUnits: suggestion.removeUnits.filter((_, i) => i !== unitIdx),
    });
  };

  const updateAddUnit = (suggestionIdx: number, unitIdx: number, updates: Partial<UnitChange>) => {
    const suggestion = suggestions[suggestionIdx];
    const newUnits = [...suggestion.addUnits];
    newUnits[unitIdx] = { ...newUnits[unitIdx], ...updates };
    updateSuggestion(suggestionIdx, { addUnits: newUnits });
  };

  const addAddUnit = (suggestionIdx: number) => {
    const suggestion = suggestions[suggestionIdx];
    updateSuggestion(suggestionIdx, {
      addUnits: [...suggestion.addUnits, { ...DEFAULT_NEW_UNIT }],
    });
  };

  const deleteAddUnit = (suggestionIdx: number, unitIdx: number) => {
    const suggestion = suggestions[suggestionIdx];
    updateSuggestion(suggestionIdx, {
      addUnits: suggestion.addUnits.filter((_, i) => i !== unitIdx),
    });
  };

  const updateEnhancement = (
    suggestionIdx: number,
    enhIdx: number,
    updates: Partial<EnhancementChange>
  ) => {
    const suggestion = suggestions[suggestionIdx];
    const newEnhancements = [...suggestion.addEnhancements];
    newEnhancements[enhIdx] = { ...newEnhancements[enhIdx], ...updates };
    updateSuggestion(suggestionIdx, { addEnhancements: newEnhancements });
  };

  const addEnhancement = (suggestionIdx: number) => {
    const suggestion = suggestions[suggestionIdx];
    updateSuggestion(suggestionIdx, {
      addEnhancements: [...suggestion.addEnhancements, { ...DEFAULT_NEW_ENHANCEMENT }],
    });
  };

  const deleteEnhancement = (suggestionIdx: number, enhIdx: number) => {
    const suggestion = suggestions[suggestionIdx];
    updateSuggestion(suggestionIdx, {
      addEnhancements: suggestion.addEnhancements.filter((_, i) => i !== enhIdx),
    });
  };

  // Calculate points delta when units change
  const recalculatePointsDelta = (suggestion: ListSuggestion): number => {
    const removeTotal = suggestion.removeUnits.reduce((sum, u) => sum + u.points, 0);
    const addTotal = suggestion.addUnits.reduce((sum, u) => sum + u.points, 0);
    const enhTotal = suggestion.addEnhancements.reduce((sum, e) => sum + e.points, 0);
    return addTotal + enhTotal - removeTotal;
  };

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className={`relative bg-grimlog-darkGray border rounded overflow-hidden ${
            isEditMode ? 'border-grimlog-orange/50' : 'border-grimlog-steel'
          }`}
        >
          {/* Corner accents - Mechanicus style */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-grimlog-orange" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-grimlog-orange" />

          {/* Remove button in edit mode */}
          {isEditMode && (
            <button
              onClick={() => removeSuggestion(idx)}
              className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-grimlog-red hover:bg-grimlog-red/20 rounded text-xs z-10"
              title="Remove suggestion"
            >
              ✕
            </button>
          )}

          {/* Header */}
          <div className="px-3 py-2 border-b border-grimlog-steel/50">
            <div className="flex items-center justify-between gap-3">
              {isEditMode ? (
                <div className="flex items-center gap-2 flex-1">
                  <EditableSelect
                    value={suggestion.priority}
                    onChange={(v) =>
                      updateSuggestion(idx, { priority: v as 'high' | 'medium' | 'low' })
                    }
                    isEditMode={isEditMode}
                    options={PRIORITY_OPTIONS}
                    className="w-24"
                  />
                  <EditableText
                    value={suggestion.title}
                    onChange={(v) => updateSuggestion(idx, { title: v })}
                    isEditMode={isEditMode}
                    placeholder="Suggestion title..."
                    className="flex-1 text-grimlog-green font-bold text-base"
                  />
                </div>
              ) : (
                <h4 className="text-grimlog-green font-bold text-base">{suggestion.title}</h4>
              )}
              <span
                className={`font-mono text-xs flex-shrink-0 ${
                  suggestion.pointsDelta > 0
                    ? 'text-grimlog-red'
                    : suggestion.pointsDelta < 0
                    ? 'text-grimlog-green'
                    : 'text-grimlog-steel'
                }`}
              >
                {suggestion.pointsDelta > 0 ? '+' : ''}
                {suggestion.pointsDelta}pts
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-2">
            {/* Units visualization - stacked */}
            <div className="flex flex-col gap-1.5 mb-2">
              {/* Units to remove */}
              <div className="flex flex-wrap items-center gap-1.5">
                {suggestion.removeUnits &&
                  suggestion.removeUnits.map((unit, j) => {
                    const iconUrl = getIcon(unit.name);
                    return (
                      <div
                        key={`remove-${j}`}
                        className="flex items-center gap-1.5 bg-red-500/10 border border-red-400/30 rounded px-2 py-1"
                      >
                        <span className="text-red-400 text-sm">-</span>
                        {iconUrl && (
                          <img src={iconUrl} alt="" className="w-5 h-5 rounded object-cover" />
                        )}
                        {isEditMode ? (
                          <>
                            <EditableText
                              value={unit.name}
                              onChange={(v) => updateRemoveUnit(idx, j, { name: v })}
                              isEditMode={isEditMode}
                              placeholder="Unit name"
                              className="text-gray-100 text-sm"
                              inputClassName="!p-0.5 !text-xs max-w-[100px]"
                            />
                            <input
                              type="number"
                              value={unit.points}
                              onChange={(e) => {
                                updateRemoveUnit(idx, j, { points: parseInt(e.target.value) || 0 });
                                updateSuggestion(idx, {
                                  pointsDelta: recalculatePointsDelta({
                                    ...suggestion,
                                    removeUnits: suggestion.removeUnits.map((u, i) =>
                                      i === j ? { ...u, points: parseInt(e.target.value) || 0 } : u
                                    ),
                                  }),
                                });
                              }}
                              className="w-12 text-red-300 text-sm font-mono bg-transparent border-b border-red-400/50 focus:outline-none focus:border-red-400"
                            />
                            <button
                              onClick={() => deleteRemoveUnit(idx, j)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-100 text-sm">{unit.name}</span>
                            <span className="text-red-300 text-sm font-mono">{unit.points}pts</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                {isEditMode && (
                  <button
                    onClick={() => addRemoveUnit(idx)}
                    className="text-red-400 text-xs border border-dashed border-red-400/50 rounded px-2 py-1 hover:border-red-400"
                  >
                    + Remove
                  </button>
                )}
              </div>

              {/* Units and enhancements to add */}
              <div className="flex flex-wrap items-center gap-1.5">
                {suggestion.addUnits &&
                  suggestion.addUnits.map((unit, j) => {
                    const iconUrl = getIcon(unit.name);
                    return (
                      <div
                        key={`add-${j}`}
                        className="flex items-center gap-1.5 bg-green-500/10 border border-green-400/30 rounded px-2 py-1"
                      >
                        <span className="text-green-400 text-sm">+</span>
                        {iconUrl && (
                          <img src={iconUrl} alt="" className="w-5 h-5 rounded object-cover" />
                        )}
                        {isEditMode ? (
                          <>
                            <EditableText
                              value={unit.name}
                              onChange={(v) => updateAddUnit(idx, j, { name: v })}
                              isEditMode={isEditMode}
                              placeholder="Unit name"
                              className="text-gray-100 text-sm"
                              inputClassName="!p-0.5 !text-xs max-w-[100px]"
                            />
                            <input
                              type="number"
                              value={unit.points}
                              onChange={(e) => {
                                updateAddUnit(idx, j, { points: parseInt(e.target.value) || 0 });
                                updateSuggestion(idx, {
                                  pointsDelta: recalculatePointsDelta({
                                    ...suggestion,
                                    addUnits: suggestion.addUnits.map((u, i) =>
                                      i === j ? { ...u, points: parseInt(e.target.value) || 0 } : u
                                    ),
                                  }),
                                });
                              }}
                              className="w-12 text-green-300 text-sm font-mono bg-transparent border-b border-green-400/50 focus:outline-none focus:border-green-400"
                            />
                            <button
                              onClick={() => deleteAddUnit(idx, j)}
                              className="text-green-400 hover:text-green-300 text-xs"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-100 text-sm">{unit.name}</span>
                            <span className="text-green-300 text-sm font-mono">
                              {unit.points}pts
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}

                {/* Enhancements to add */}
                {suggestion.addEnhancements &&
                  suggestion.addEnhancements.map((enh, j) => (
                    <div
                      key={`enh-${j}`}
                      className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-400/30 rounded px-2 py-1"
                    >
                      <span className="text-amber-400 text-sm">+</span>
                      {isEditMode ? (
                        <>
                          <EditableText
                            value={enh.name}
                            onChange={(v) => updateEnhancement(idx, j, { name: v })}
                            isEditMode={isEditMode}
                            placeholder="Enhancement"
                            className="text-gray-100 text-sm"
                            inputClassName="!p-0.5 !text-xs max-w-[80px]"
                          />
                          <span className="text-gray-400 text-sm">&rarr;</span>
                          <EditableText
                            value={enh.targetCharacter}
                            onChange={(v) => updateEnhancement(idx, j, { targetCharacter: v })}
                            isEditMode={isEditMode}
                            placeholder="Target"
                            className="text-gray-400 text-sm"
                            inputClassName="!p-0.5 !text-xs max-w-[80px]"
                          />
                          <button
                            onClick={() => deleteEnhancement(idx, j)}
                            className="text-amber-400 hover:text-amber-300 text-xs"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-100 text-sm">{enh.name}</span>
                          <span className="text-gray-400 text-sm">&rarr; {enh.targetCharacter}</span>
                        </>
                      )}
                    </div>
                  ))}

                {isEditMode && (
                  <>
                    <button
                      onClick={() => addAddUnit(idx)}
                      className="text-green-400 text-xs border border-dashed border-green-400/50 rounded px-2 py-1 hover:border-green-400"
                    >
                      + Add Unit
                    </button>
                    <button
                      onClick={() => addEnhancement(idx)}
                      className="text-amber-400 text-xs border border-dashed border-amber-400/50 rounded px-2 py-1 hover:border-amber-400"
                    >
                      + Enhancement
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Addresses - data readout style */}
            <div className="text-sm border-t border-grimlog-steel/40 pt-2 mt-2">
              <span className="text-grimlog-orange uppercase text-xs tracking-wide">Addresses:</span>{' '}
              {isEditMode ? (
                <EditableText
                  value={suggestion.addressesGap}
                  onChange={(v) => updateSuggestion(idx, { addressesGap: v })}
                  isEditMode={isEditMode}
                  placeholder="What gap does this address?"
                  className="text-grimlog-amber inline"
                />
              ) : (
                <span className="text-grimlog-amber">{suggestion.addressesGap}</span>
              )}
            </div>

            {/* Collapsible details */}
            <details className="mt-2" open={isEditMode}>
              <summary className="text-grimlog-orange text-xs cursor-pointer hover:text-grimlog-amber select-none py-1 uppercase tracking-wide">
                Analysis
              </summary>
              <div className="mt-2 pt-2 border-t border-grimlog-steel/30 space-y-2 text-sm">
                <div>
                  <span className="text-grimlog-orange uppercase text-xs tracking-wide">
                    Trade-offs:
                  </span>{' '}
                  {isEditMode ? (
                    <EditableText
                      value={suggestion.tradeoffs}
                      onChange={(v) => updateSuggestion(idx, { tradeoffs: v })}
                      isEditMode={isEditMode}
                      multiline
                      placeholder="Describe trade-offs..."
                      className="text-gray-200 w-full"
                    />
                  ) : (
                    <span className="text-gray-200">{suggestion.tradeoffs}</span>
                  )}
                </div>
                <div>
                  <span className="text-grimlog-orange uppercase text-xs tracking-wide">
                    Reasoning:
                  </span>{' '}
                  {isEditMode ? (
                    <EditableText
                      value={suggestion.reasoning}
                      onChange={(v) => updateSuggestion(idx, { reasoning: v })}
                      isEditMode={isEditMode}
                      multiline
                      placeholder="Explain reasoning..."
                      className="text-gray-200 w-full"
                    />
                  ) : (
                    suggestion.reasoning && (
                      <span className="text-gray-200">{suggestion.reasoning}</span>
                    )
                  )}
                </div>
              </div>
            </details>
          </div>
        </div>
      ))}

      {/* Add suggestion button in edit mode */}
      {isEditMode && (
        <button
          onClick={addSuggestion}
          className="w-full p-3 border-2 border-dashed border-grimlog-steel/50 rounded text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors text-sm"
        >
          + Add List Suggestion
        </button>
      )}
    </div>
  );
}
