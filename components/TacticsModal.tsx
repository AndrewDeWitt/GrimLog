'use client';

import { useMemo, useState } from 'react';

interface TacticsModalStratagem {
  id: string;
  name: string;
  cpCost: number;
  phase?: string | null;
  description?: string | null;
  keywords?: string | string[] | null;
  detachment?: string | null;
  source?: string | null;
}

interface TacticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  factionName: string;
  availableDetachments: string[];
  selectedDetachment: string;
  onSelectDetachment: (detachment: string) => void;
  loadingDetachments: boolean;
  stratagems: TacticsModalStratagem[];
}

function parseKeywords(input: TacticsModalStratagem['keywords']): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // ignore
    }
    return input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function isCoreDetachment(detachment: string | null | undefined): boolean {
  const d = (detachment || '').toLowerCase().trim();
  return !d || d === 'core';
}

export default function TacticsModal({
  isOpen,
  onClose,
  factionName,
  availableDetachments,
  selectedDetachment,
  onSelectDetachment,
  loadingDetachments,
  stratagems,
}: TacticsModalProps) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = stratagems
      .map(s => ({
        ...s,
        _keywords: parseKeywords(s.keywords),
      }))
      .filter(s => {
        if (!normalizedSearch) return true;
        const haystack = [
          s.name,
          s.phase || '',
          s.description || '',
          ...s._keywords,
          isCoreDetachment(s.detachment) ? 'core' : (s.detachment || ''),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => a.cpCost - b.cpCost || a.name.localeCompare(b.name));

    return list;
  }, [stratagems, normalizedSearch]);

  const { coreStrats, detachmentStrats, customStrats } = useMemo(() => {
    const core: typeof filtered = [];
    const det: typeof filtered = [];
    const custom: typeof filtered = [];

    for (const s of filtered) {
      if (s.source && s.source !== 'manual') {
        if (isCoreDetachment(s.detachment)) core.push(s);
        else det.push(s);
      } else {
        // Manual stratagems stored on Army model (or any unknown source)
        custom.push(s);
      }
    }

    return { coreStrats: core, detachmentStrats: det, customStrats: custom };
  }, [filtered]);

  if (!isOpen) return null;

  const renderStratList = (items: typeof filtered) => {
    if (items.length === 0) {
      return (
        <div className="p-4 bg-white border border-gray-300 rounded-lg text-center text-gray-500 text-sm">
          No results.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map(s => {
          const isExpanded = expandedId === s.id;
          const keywords = s._keywords;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setExpandedId(prev => (prev === s.id ? null : s.id))}
              className="w-full text-left bg-white border border-gray-300 hover:border-grimlog-orange transition-all rounded-lg overflow-hidden"
            >
              <div className="px-3 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-grimlog-orange uppercase tracking-wide truncate">
                    {s.name}
                  </div>
                  <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-gray-500">
                    {(s.phase || 'Any').toString()}
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-gray-700 font-mono text-xs bg-gray-100 px-2 py-1 border border-gray-300 rounded">
                    {s.cpCost}CP
                  </span>
                  <span className="text-gray-400 text-xs font-mono">{isExpanded ? '−' : '+'}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <div className="pt-3 border-t border-gray-200">
                    {s.description ? (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {s.description}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No description available.</p>
                    )}

                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {keywords.map((kw, i) => (
                          <span
                            key={`${s.id}-kw-${i}`}
                            className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 border border-gray-300 uppercase rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" onClick={onClose} />

      {/* Bottom Sheet */}
      <div 
        className="relative w-full max-w-4xl mx-auto max-h-[85vh] bg-grimlog-slate-light border-t-2 border-grimlog-steel overflow-hidden flex flex-col rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 border-b border-grimlog-steel bg-grimlog-slate-dark flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-500">
              [[ TACTICS ]]
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900 tracking-widest uppercase truncate">
              {factionName}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors">
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-grimlog-steel bg-grimlog-slate-dark flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-[10px] text-grimlog-orange font-mono mb-2 uppercase tracking-wider">
                Detachment
              </label>
              {loadingDetachments ? (
                <div className="text-gray-500 font-mono text-sm">Loading detachments...</div>
              ) : (
                <select
                  value={selectedDetachment}
                  onChange={(e) => onSelectDetachment(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-800 border border-gray-300 focus:border-grimlog-orange focus:outline-none font-mono text-sm rounded-lg"
                >
                  <option value="">-- No Detachment Selected --</option>
                  {availableDetachments.map(det => (
                    <option key={det} value={det}>
                      {det}
                    </option>
                  ))}
                </select>
              )}
              {!selectedDetachment && (
                <p className="text-[10px] text-amber-600 mt-2 font-mono uppercase tracking-wider">
                  ⚠ Select a detachment to see detachment-specific stratagems (core will still appear)
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] text-grimlog-orange font-mono mb-2 uppercase tracking-wider">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tactics..."
                className="w-full px-4 py-3 bg-white text-gray-800 border border-gray-300 focus:border-grimlog-orange focus:outline-none font-mono text-sm rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-grimlog-slate-light">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase">
                Core Stratagems ({coreStrats.length})
              </h3>
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">[[ QUICK GLANCE ]]</span>
            </div>
            {renderStratList(coreStrats)}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase">
                Detachment Stratagems ({detachmentStrats.length})
              </h3>
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                [[ {selectedDetachment ? selectedDetachment.toUpperCase() : 'NO DETACHMENT'} ]]
              </span>
            </div>
            {renderStratList(detachmentStrats)}
          </div>

          {customStrats.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase">
                  Custom Stratagems ({customStrats.length})
                </h3>
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">[[ MANUAL ]]</span>
              </div>
              {renderStratList(customStrats)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel bg-grimlog-slate-dark flex items-center justify-between flex-shrink-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Showing {filtered.length} stratagems
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold tracking-wider transition-all uppercase text-xs rounded-lg"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
