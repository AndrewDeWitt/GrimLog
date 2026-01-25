'use client';

import { FunStat } from '@/lib/dossierAnalysis';
import { EditableText } from '../EditableText';

interface ArmyQuirksGridProps {
  funStats: FunStat[] | undefined;
  isEditMode?: boolean;
  onUpdate?: (funStats: FunStat[]) => void;
}

const DEFAULT_NEW_QUIRK: FunStat = {
  name: 'New Quirk',
  emoji: '✨',
  value: '...',
  description: 'Describe this quirk...',
  iconPrompt: '',
};

export default function ArmyQuirksGrid({
  funStats,
  isEditMode = false,
  onUpdate,
}: ArmyQuirksGridProps) {
  if (!funStats || funStats.length === 0) {
    if (!isEditMode) return null;
    // In edit mode with no stats, show add button
    return (
      <div className="py-3">
        <button
          onClick={() => onUpdate?.([DEFAULT_NEW_QUIRK])}
          className="w-full p-4 border-2 border-dashed border-grimlog-steel/50 rounded text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors"
        >
          + Add Army Quirk
        </button>
      </div>
    );
  }

  const updateStat = (index: number, field: keyof FunStat, value: string) => {
    if (!onUpdate) return;
    const newStats = [...funStats];
    newStats[index] = { ...newStats[index], [field]: value };
    onUpdate(newStats);
  };

  const removeStat = (index: number) => {
    if (!onUpdate || funStats.length <= 1) return;
    const newStats = funStats.filter((_, i) => i !== index);
    onUpdate(newStats);
  };

  const addStat = () => {
    if (!onUpdate || funStats.length >= 6) return;
    onUpdate([...funStats, DEFAULT_NEW_QUIRK]);
  };

  return (
    <div className="py-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {funStats.map((stat, i) => (
          <div
            key={i}
            className={`relative bg-grimlog-darkGray border rounded overflow-hidden ${
              isEditMode ? 'border-grimlog-orange/50' : 'border-grimlog-steel'
            }`}
          >
            {/* Corner accents - Mechanicus style */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-grimlog-orange" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-grimlog-orange" />

            {/* Header with emoji and name */}
            <div className="px-3 py-2 border-b border-grimlog-steel/50">
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      value={stat.emoji}
                      onChange={(e) => updateStat(i, 'emoji', e.target.value)}
                      className="w-8 text-xl leading-none bg-transparent border-b border-grimlog-steel/50 focus:border-grimlog-orange focus:outline-none text-center"
                      maxLength={4}
                    />
                    <EditableText
                      value={stat.name}
                      onChange={(v) => updateStat(i, 'name', v)}
                      isEditMode={isEditMode}
                      placeholder="Quirk name"
                      className="text-grimlog-green font-semibold text-sm flex-1"
                    />
                  </>
                ) : (
                  <>
                    <span className="text-xl leading-none">{stat.emoji}</span>
                    <span className="text-grimlog-green font-semibold text-sm">{stat.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-3">
              {/* Value badge */}
              {isEditMode ? (
                <EditableText
                  value={stat.value}
                  onChange={(v) => updateStat(i, 'value', v)}
                  isEditMode={isEditMode}
                  placeholder="Value"
                  className="inline-flex items-center rounded border border-grimlog-orange/40 bg-grimlog-orange/10 px-2 py-1 mb-2 text-grimlog-orange font-bold text-base leading-none"
                  inputClassName="!p-1 !text-grimlog-orange !font-bold"
                />
              ) : (
                <div className="inline-flex items-center rounded border border-grimlog-orange/40 bg-grimlog-orange/10 px-2 py-1 mb-2">
                  <span className="text-grimlog-orange font-bold text-base leading-none">
                    {stat.value}
                  </span>
                </div>
              )}

              {/* Description */}
              {isEditMode ? (
                <EditableText
                  value={stat.description}
                  onChange={(v) => updateStat(i, 'description', v)}
                  isEditMode={isEditMode}
                  multiline
                  placeholder="Description..."
                  className="text-gray-300 text-xs leading-relaxed block w-full"
                />
              ) : (
                <p className="text-gray-300 text-xs leading-relaxed">{stat.description}</p>
              )}
            </div>

            {/* Remove button - separate row in edit mode */}
            {isEditMode && funStats.length > 1 && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => removeStat(i)}
                  className="w-full py-2 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 bg-grimlog-red/20 hover:bg-grimlog-red/30 border border-grimlog-red/70 hover:border-grimlog-red rounded text-xs font-medium uppercase tracking-wider transition-colors"
                >
                  <span>✕</span>
                  <span>Remove Quirk</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add button in edit mode */}
        {isEditMode && funStats.length < 6 && (
          <button
            onClick={addStat}
            className="flex items-center justify-center p-4 border-2 border-dashed border-grimlog-steel/50 rounded text-grimlog-steel hover:border-grimlog-orange hover:text-grimlog-orange transition-colors min-h-[120px]"
          >
            + Add Quirk
          </button>
        )}
      </div>
    </div>
  );
}
