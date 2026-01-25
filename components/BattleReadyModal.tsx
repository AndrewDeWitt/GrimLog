'use client';

import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';

interface UnitOption {
  id: string;
  name: string;
  datasheet: string;
  modelCount: number;
  pointsCost: number;
  keywords: string; // JSON array string
}

export interface AttachmentPreset {
  id: string;
  armyId: string;
  name: string;
  isDefault: boolean;
  attachmentsJson: string; // JSON string of Record<characterUnitId, targetUnitName>
  createdAt?: string;
  updatedAt?: string;
}

interface BattleReadyModalProps {
  isOpen: boolean;
  onClose: () => void;
  armyId: string;
  characterUnits: UnitOption[];
  nonCharacterUnits: UnitOption[];
  currentAttachments: Record<string, string>;
  savedAttachments: Record<string, string>;
  onChangeCurrentAttachments: (next: Record<string, string>) => void;
  onResetCurrentAttachments: () => void;
  onSaveCurrentAttachments: () => Promise<void>;
  currentAttachmentsDirty: boolean;
}

function parseAttachmentsJson(input: string | null | undefined): Record<string, string> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function normalizeAttachments(attachments: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(attachments).filter(([_, v]) => !!v));
}

export default function BattleReadyModal({
  isOpen,
  onClose,
  armyId,
  characterUnits,
  nonCharacterUnits,
  currentAttachments,
  savedAttachments,
  onChangeCurrentAttachments,
  onResetCurrentAttachments,
  onSaveCurrentAttachments,
  currentAttachmentsDirty,
}: BattleReadyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [presets, setPresets] = useState<AttachmentPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const [newPresetName, setNewPresetName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const [editingMode, setEditingMode] = useState<'current' | 'preset'>('current');
  const [presetDraft, setPresetDraft] = useState<Record<string, string>>({});

  const selectedPreset = useMemo(
    () => presets.find(p => p.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );

  const attachableOptions = useMemo(() => {
    const sorted = [...nonCharacterUnits].sort((a, b) => a.name.localeCompare(b.name));
    return sorted.map(u => ({
      value: u.name,
      label: u.name,
      description: `${u.modelCount} models • ${u.pointsCost}pts`,
    }));
  }, [nonCharacterUnits]);

  const fetchPresets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/armies/${armyId}/attachment-presets`, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`Failed to load presets (${res.status})`);
      }
      const json = await res.json();
      const list: AttachmentPreset[] =
        Array.isArray(json) ? json :
        (json?.data?.presets ?? json?.presets ?? []);
      setPresets(list);

      const defaultPreset = list.find(p => p.isDefault) || list[0] || null;
      if (defaultPreset) {
        setSelectedPresetId(defaultPreset.id);
        setRenameValue(defaultPreset.name);
        setPresetDraft(parseAttachmentsJson(defaultPreset.attachmentsJson));
      } else {
        setSelectedPresetId(null);
        setRenameValue('');
        setPresetDraft({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchPresets();
    setEditingMode('current');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedPreset) return;
    setRenameValue(selectedPreset.name);
    setPresetDraft(parseAttachmentsJson(selectedPreset.attachmentsJson));
  }, [selectedPresetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createPreset = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const body = {
        name,
        attachments: normalizeAttachments(currentAttachments),
        isDefault: presets.length === 0,
      };
      const res = await fetch(`/api/armies/${armyId}/attachment-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to create preset (${res.status})`);
      }
      setNewPresetName('');
      await fetchPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create preset');
    } finally {
      setLoading(false);
    }
  };

  const savePreset = async () => {
    if (!selectedPreset) return;
    setLoading(true);
    setError(null);
    try {
      const body = {
        name: renameValue.trim() || selectedPreset.name,
        attachments: normalizeAttachments(presetDraft),
      };
      const res = await fetch(`/api/armies/${armyId}/attachment-presets/${selectedPreset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to save preset (${res.status})`);
      }
      await fetchPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save preset');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultPreset = async () => {
    if (!selectedPreset) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/armies/${armyId}/attachment-presets/${selectedPreset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to set default (${res.status})`);
      }
      await fetchPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default preset');
    } finally {
      setLoading(false);
    }
  };

  const deletePreset = async () => {
    if (!selectedPreset) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/armies/${armyId}/attachment-presets/${selectedPreset.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to delete preset (${res.status})`);
      }
      await fetchPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete preset');
    } finally {
      setLoading(false);
    }
  };

  const applySelectedPresetToCurrent = () => {
    if (!selectedPreset) return;
    const next = parseAttachmentsJson(selectedPreset.attachmentsJson);
    onChangeCurrentAttachments(next);
    setEditingMode('current');
  };

  const handleCurrentAttachmentChange = (characterUnitId: string, targetUnitName: string | null) => {
    const next = { ...currentAttachments };
    if (!targetUnitName) delete next[characterUnitId];
    else next[characterUnitId] = targetUnitName;
    onChangeCurrentAttachments(next);
  };

  const handlePresetAttachmentChange = (characterUnitId: string, targetUnitName: string | null) => {
    setPresetDraft(prev => {
      const next = { ...prev };
      if (!targetUnitName) delete next[characterUnitId];
      else next[characterUnitId] = targetUnitName;
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" onClick={onClose} />

      {/* Bottom Sheet */}
      <div 
        className="relative w-full max-w-5xl mx-auto max-h-[85vh] bg-grimlog-slate-light border-t-2 border-grimlog-steel overflow-hidden flex flex-col rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 border-b border-grimlog-steel bg-grimlog-slate-dark flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-500">
              [[ BATTLE READY ]]
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900 tracking-widest uppercase">
              Attachments Presets
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 border-b border-grimlog-steel bg-red-50 flex-shrink-0">
            <div className="text-sm text-red-600 font-mono">{error}</div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-grimlog-slate-light">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Presets list */}
            <div className="lg:col-span-4 bg-white border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-grimlog-slate-dark border-b border-grimlog-steel px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase">Presets</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">[[ LOADOUTS ]]</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <label className="block text-[10px] text-grimlog-orange font-mono uppercase tracking-wider">
                    New preset from current
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="e.g., VS_ELITE"
                      className="flex-1 px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:border-grimlog-orange focus:outline-none font-mono text-sm rounded"
                    />
                    <button
                      type="button"
                      onClick={createPreset}
                      disabled={loading || !newPresetName.trim()}
                      className="px-3 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    >
                      CREATE
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-2">
                  {loading ? (
                    <div className="text-gray-500 font-mono text-sm">Loading...</div>
                  ) : presets.length === 0 ? (
                    <div className="text-gray-500 text-sm">
                      No presets yet. Create one from your current attachments.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {presets.map(p => {
                        const isActive = p.id === selectedPresetId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPresetId(p.id)}
                            className={`w-full text-left px-3 py-2 border rounded transition-all ${
                              isActive
                                ? 'border-grimlog-orange bg-orange-50'
                                : 'border-gray-300 hover:border-grimlog-orange/60 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-gray-800 truncate">{p.name}</div>
                                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                                  {p.isDefault ? 'DEFAULT' : 'PRESET'}
                                </div>
                              </div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-grimlog-orange">
                                {Object.keys(parseAttachmentsJson(p.attachmentsJson)).length} ATT
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editor */}
            <div className="lg:col-span-8 bg-white border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-grimlog-slate-dark border-b border-grimlog-steel px-4 py-3 flex flex-wrap items-center gap-2 justify-between">
                <h3 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase">
                  Editor
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMode('current')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider border rounded ${
                      editingMode === 'current'
                        ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-grimlog-orange'
                    }`}
                  >
                    CURRENT
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMode('preset')}
                    disabled={!selectedPreset}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider border rounded ${
                      editingMode === 'preset'
                        ? 'bg-grimlog-orange text-gray-900 border-grimlog-orange'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-grimlog-orange'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    PRESET
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {editingMode === 'preset' ? (
                  !selectedPreset ? (
                    <div className="text-gray-500 text-sm">
                      Select a preset to edit it.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[220px]">
                          <label className="block text-[10px] text-grimlog-orange font-mono mb-2 uppercase tracking-wider">
                            Preset name
                          </label>
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="w-full px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:border-grimlog-orange focus:outline-none font-mono text-sm rounded"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={setDefaultPreset}
                          disabled={loading || selectedPreset.isDefault}
                          className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          SET DEFAULT
                        </button>
                        <button
                          type="button"
                          onClick={deletePreset}
                          disabled={loading}
                          className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-300 font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          DELETE
                        </button>
                        <button
                          type="button"
                          onClick={applySelectedPresetToCurrent}
                          disabled={loading}
                          className="px-3 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          APPLY TO CURRENT
                        </button>
                      </div>

                      <div className="space-y-3">
                        {characterUnits.length === 0 ? (
                          <div className="text-gray-500 text-sm">No characters detected.</div>
                        ) : nonCharacterUnits.length === 0 ? (
                          <div className="text-gray-500 text-sm">No non-character units to attach to.</div>
                        ) : (
                          characterUnits.map(c => {
                            const currentTarget = presetDraft[c.id] || null;
                            return (
                              <div
                                key={c.id}
                                className="p-3 bg-gray-50 border border-gray-200 rounded"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold text-grimlog-orange truncate">{c.name}</div>
                                    <div className="text-[11px] text-gray-600 font-mono">
                                      {c.datasheet} • {c.modelCount} models
                                    </div>
                                  </div>
                                  <div className="text-gray-700 font-mono text-xs bg-white px-2 py-1 border border-gray-300 rounded">
                                    {c.pointsCost}pts
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <SearchableSelect
                                    value={currentTarget}
                                    onChange={(v) => handlePresetAttachmentChange(c.id, v)}
                                    options={attachableOptions}
                                    placeholder="-- No Attachment --"
                                    searchPlaceholder="Search units..."
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="flex gap-2 justify-end border-t border-gray-200 pt-3">
                        <button
                          type="button"
                          onClick={savePreset}
                          disabled={loading}
                          className="px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold tracking-wider transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          SAVE PRESET
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-mono uppercase tracking-wider">
                        {currentAttachmentsDirty ? (
                          <span className="text-amber-600">Pending attachment changes</span>
                        ) : (
                          <span className="text-gray-500">No pending attachment changes</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onResetCurrentAttachments}
                          disabled={!currentAttachmentsDirty || loading}
                          className="min-h-[36px] px-3 bg-white hover:bg-gray-100 text-gray-700 font-bold tracking-wider border border-gray-300 transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          RESET
                        </button>
                        <button
                          type="button"
                          onClick={onSaveCurrentAttachments}
                          disabled={!currentAttachmentsDirty || loading}
                          className="min-h-[36px] px-3 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold tracking-wider transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          SAVE CURRENT
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {characterUnits.length === 0 ? (
                        <div className="text-gray-500 text-sm">No characters detected.</div>
                      ) : nonCharacterUnits.length === 0 ? (
                        <div className="text-gray-500 text-sm">No non-character units to attach to.</div>
                      ) : (
                        characterUnits.map(c => {
                          const currentTarget = currentAttachments[c.id] || null;
                          return (
                            <div
                              key={c.id}
                              className="p-3 bg-gray-50 border border-gray-200 rounded"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-grimlog-orange truncate">{c.name}</div>
                                  <div className="text-[11px] text-gray-600 font-mono">
                                    {c.datasheet} • {c.modelCount} models
                                  </div>
                                </div>
                                <div className="text-gray-700 font-mono text-xs bg-white px-2 py-1 border border-gray-300 rounded">
                                  {c.pointsCost}pts
                                </div>
                              </div>

                              <div className="mt-3">
                                <SearchableSelect
                                  value={currentTarget}
                                  onChange={(v) => handleCurrentAttachmentChange(c.id, v)}
                                  options={attachableOptions}
                                  placeholder="-- No Attachment --"
                                  searchPlaceholder="Search units..."
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 border-t border-gray-200 pt-3">
                      Tip: create presets from your tuned &quot;current&quot; mapping to pivot fast between opponents.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel bg-grimlog-slate-dark flex items-center justify-between flex-shrink-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Current: {Object.keys(normalizeAttachments(currentAttachments)).length} attachments • Saved:{' '}
            {Object.keys(normalizeAttachments(savedAttachments)).length}
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
