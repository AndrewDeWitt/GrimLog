'use client';

import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';

interface Unit {
  id: string;
  name: string;
  datasheet: string;
  datasheetId?: string | null;
  pointsCost: number;
  keywords: string;
  modelCount: number;
}

interface AttachmentPreset {
  id: string;
  armyId: string;
  name: string;
  isDefault: boolean;
  attachmentsJson: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  armyId: string;
  factionName: string;
  characterUnits: Unit[];
  nonCharacterUnits: Unit[];
  currentAttachments: Record<string, string>;
  savedAttachments: Record<string, string>;
  onChangeAttachment: (characterUnitId: string, targetUnitName: string | null) => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  isDirty: boolean;
  isSaving?: boolean;
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

export default function AttachmentsModal({
  isOpen,
  onClose,
  armyId,
  factionName,
  characterUnits,
  nonCharacterUnits,
  currentAttachments,
  onChangeAttachment,
  onReset,
  onSave,
  isDirty,
  isSaving = false,
}: AttachmentsModalProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'presets'>('edit');
  
  // Preset state
  const [presets, setPresets] = useState<AttachmentPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Build icon requests for character units
  const unitIconRequests = useMemo(() => {
    const cleanFaction = (factionName || 'Unknown').replace(/\(.*?\)/g, '').trim() || factionName || 'Unknown';
    const allUnits = [...characterUnits, ...nonCharacterUnits];
    return allUnits.map(u => ({
      faction: cleanFaction,
      unitName: u.datasheet || u.name,
    }));
  }, [factionName, characterUnits, nonCharacterUnits]);

  const { icons: unitIcons } = useUnitIcons(unitIconRequests, { autoFetch: isOpen });

  const cleanFaction = (factionName || 'Unknown').replace(/\(.*?\)/g, '').trim() || factionName || 'Unknown';

  const selectedPreset = useMemo(
    () => presets.find(p => p.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );

  // Fetch presets when modal opens
  const fetchPresets = async () => {
    setLoadingPresets(true);
    setPresetError(null);
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
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to load presets');
    } finally {
      setLoadingPresets(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchPresets();
    setActiveTab('edit');
  }, [isOpen, armyId]);

  const createPreset = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    setLoadingPresets(true);
    setPresetError(null);
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
      setPresetError(e instanceof Error ? e.message : 'Failed to create preset');
    } finally {
      setLoadingPresets(false);
    }
  };

  const applyPreset = (preset: AttachmentPreset) => {
    const attachments = parseAttachmentsJson(preset.attachmentsJson);
    // Clear all current attachments first, then apply preset
    characterUnits.forEach(char => {
      const newTarget = attachments[char.id] || null;
      if (currentAttachments[char.id] !== newTarget) {
        onChangeAttachment(char.id, newTarget);
      }
    });
    // Also clear any attachments for characters not in preset
    Object.keys(currentAttachments).forEach(charId => {
      if (!attachments[charId]) {
        onChangeAttachment(charId, null);
      }
    });
    setActiveTab('edit');
  };

  const setDefaultPreset = async (presetId: string) => {
    setLoadingPresets(true);
    setPresetError(null);
    try {
      const res = await fetch(`/api/armies/${armyId}/attachment-presets/${presetId}`, {
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
      setPresetError(e instanceof Error ? e.message : 'Failed to set default preset');
    } finally {
      setLoadingPresets(false);
    }
  };

  const deletePreset = async (presetId: string) => {
    setLoadingPresets(true);
    setPresetError(null);
    try {
      const res = await fetch(`/api/armies/${armyId}/attachment-presets/${presetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to delete preset (${res.status})`);
      }
      if (selectedPresetId === presetId) {
        setSelectedPresetId(null);
      }
      await fetchPresets();
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to delete preset');
    } finally {
      setLoadingPresets(false);
    }
  };

  const renderUnitIcon = (unit: Unit) => {
    const unitNameForIcon = unit.datasheet || unit.name;
    const key = `${cleanFaction}:${unitNameForIcon}`;
    const resolvedUrl = unitIcons[key] || null;
    const icon = getUnitIcon(resolvedUrl, unitNameForIcon);
    const isImage = isCustomIcon(icon);

    if (isImage) {
      return (
        <img
          src={icon}
          alt={`${unitNameForIcon} icon`}
          className="w-10 h-10 object-cover rounded-sm border border-grimlog-steel/50 bg-grimlog-black"
          loading="lazy"
        />
      );
    }

    return (
      <div className="w-10 h-10 rounded-sm border border-grimlog-steel/50 bg-grimlog-black flex items-center justify-center text-xl">
        {icon}
      </div>
    );
  };

  const optionIcon = (unit: Unit) => {
    const unitNameForIcon = unit.datasheet || unit.name;
    const key = `${cleanFaction}:${unitNameForIcon}`;
    const resolvedUrl = unitIcons[key] || null;
    const icon = getUnitIcon(resolvedUrl, unitNameForIcon);
    const isImage = isCustomIcon(icon);

    if (isImage) {
      return (
        <img
          src={icon}
          alt=""
          className="w-6 h-6 object-cover rounded-sm border border-grimlog-steel/50 bg-grimlog-black"
          loading="lazy"
        />
      );
    }

    return <span className="text-base leading-none">{icon}</span>;
  };

  const handleSaveAndClose = async () => {
    await onSave();
    onClose();
  };

  const handleClearAll = () => {
    characterUnits.forEach(char => {
      if (currentAttachments[char.id]) {
        onChangeAttachment(char.id, null);
      }
    });
  };

  if (!isOpen) return null;

  const attachedCount = Object.values(currentAttachments).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[92vh] bg-grimlog-black border-2 border-grimlog-orange overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-grimlog-steel bg-grimlog-darkGray flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-grimlog-steel">
              [[ ATTACHMENTS ]]
            </div>
            <div className="mt-1 text-lg font-bold text-grimlog-orange tracking-widest uppercase truncate">
              {factionName}
            </div>
          </div>
          <button onClick={onClose} className="text-grimlog-light-steel hover:text-white text-2xl">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-grimlog-steel/60">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'edit'
                ? 'bg-grimlog-orange text-grimlog-black'
                : 'bg-grimlog-black/60 text-grimlog-green hover:bg-grimlog-steel/20'
            }`}
          >
            Edit Attachments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'presets'
                ? 'bg-grimlog-orange text-grimlog-black'
                : 'bg-grimlog-black/60 text-grimlog-green hover:bg-grimlog-steel/20'
            }`}
          >
            Presets ({presets.length})
          </button>
        </div>

        {presetError && (
          <div className="px-4 py-2 bg-grimlog-red/10 border-b border-grimlog-red/30">
            <div className="text-sm text-grimlog-red font-mono">{presetError}</div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'edit' ? (
            <>
              {/* Status Bar */}
              <div className="px-4 py-3 border-b border-grimlog-steel/60 bg-grimlog-black/40 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-grimlog-steel">Characters:</span>{' '}
                    <span className="text-grimlog-green">{characterUnits.length}</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-grimlog-steel">Attached:</span>{' '}
                    <span className="text-grimlog-amber">{attachedCount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={attachedCount === 0}
                  className="btn-depth-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider border border-grimlog-red/50 text-grimlog-red/80 hover:text-grimlog-red hover:border-grimlog-red disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              </div>

              <div className="p-4">
                {characterUnits.length === 0 ? (
                  <div className="p-6 bg-grimlog-black border border-grimlog-steel/50 text-center">
                    <div className="text-grimlog-steel text-sm">No characters detected in this roster.</div>
                    <div className="text-xs text-grimlog-light-steel mt-2">
                      Add a character unit and it will appear here.
                    </div>
                  </div>
                ) : nonCharacterUnits.length === 0 ? (
                  <div className="p-6 bg-grimlog-black border border-grimlog-steel/50 text-center">
                    <div className="text-grimlog-amber text-sm">No non-character units to attach to.</div>
                    <div className="text-xs text-grimlog-light-steel mt-2">
                      Add at least one unit (non-character) to enable attachments.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {characterUnits.map(charUnit => {
                      const attachable = nonCharacterUnits
                        .filter(u => u.id !== charUnit.id)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      const options = attachable.map(u => ({
                        value: u.name,
                        label: u.name,
                        leading: optionIcon(u),
                        description: `${u.modelCount} models • ${u.pointsCost}pts`,
                      }));

                      const currentTarget = currentAttachments[charUnit.id] || null;

                      return (
                        <div
                          key={charUnit.id}
                          className={`p-3 bg-grimlog-black/70 border card-depth transition-all ${
                            currentTarget ? 'border-grimlog-amber/60' : 'border-grimlog-steel/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {renderUnitIcon(charUnit)}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-grimlog-orange truncate">{charUnit.name}</div>
                                  <div className="text-[11px] text-grimlog-green font-mono">
                                    {charUnit.datasheet} • {charUnit.modelCount} models
                                  </div>
                                </div>
                                <div className="text-grimlog-amber font-mono text-xs bg-grimlog-black px-2 py-1 border border-grimlog-steel">
                                  {charUnit.pointsCost}pts
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-[10px] text-grimlog-amber font-mono uppercase tracking-wider">
                                    Attach to unit
                                  </label>
                                  {currentTarget && (
                                    <button
                                      type="button"
                                      className="text-[10px] text-grimlog-red/80 hover:text-grimlog-red font-mono uppercase tracking-wider"
                                      onClick={() => onChangeAttachment(charUnit.id, null)}
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>

                                <SearchableSelect
                                  value={currentTarget}
                                  onChange={(v) => onChangeAttachment(charUnit.id, v)}
                                  options={options}
                                  placeholder="-- No Attachment --"
                                  searchPlaceholder="Search units..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 space-y-4">
              {/* Create new preset */}
              <div className="p-4 bg-grimlog-black/60 border border-grimlog-steel/50">
                <label className="block text-[10px] text-grimlog-amber font-mono mb-2 uppercase tracking-wider">
                  Save current as new preset
                </label>
                <div className="flex gap-2">
                  <input
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g., VS_ELITE, AGGRESSIVE, DEFENSIVE"
                    className="flex-1 px-3 py-2 bg-grimlog-black text-white border border-grimlog-steel focus:border-grimlog-orange focus:outline-none font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={createPreset}
                    disabled={loadingPresets || !newPresetName.trim()}
                    className="btn-depth px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    SAVE
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-grimlog-steel font-mono">
                  This will save your current {attachedCount} attachment{attachedCount !== 1 ? 's' : ''} as a reusable preset.
                </div>
              </div>

              {/* Presets list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase">
                    Saved Presets
                  </h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-grimlog-steel">
                    [[ LOADOUTS ]]
                  </span>
                </div>

                {loadingPresets ? (
                  <div className="p-4 bg-grimlog-black border border-grimlog-steel/50 text-center">
                    <div className="text-grimlog-green font-mono text-sm">Loading presets...</div>
                  </div>
                ) : presets.length === 0 ? (
                  <div className="p-4 bg-grimlog-black border border-grimlog-steel/50 text-center">
                    <div className="text-grimlog-steel text-sm">No presets saved yet.</div>
                    <div className="text-xs text-grimlog-light-steel mt-2">
                      Configure your attachments and save them as a preset to quickly switch between loadouts.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {presets.map(preset => {
                      const presetAttachments = parseAttachmentsJson(preset.attachmentsJson);
                      const presetCount = Object.keys(presetAttachments).length;
                      
                      return (
                        <div
                          key={preset.id}
                          className={`p-3 bg-grimlog-black/70 border transition-all ${
                            preset.isDefault ? 'border-grimlog-green/60' : 'border-grimlog-steel/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-grimlog-orange">{preset.name}</span>
                                {preset.isDefault && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-grimlog-green/20 text-grimlog-green border border-grimlog-green/50 uppercase">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-grimlog-steel mt-1">
                                {presetCount} attachment{presetCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {!preset.isDefault && (
                                <button
                                  type="button"
                                  onClick={() => setDefaultPreset(preset.id)}
                                  disabled={loadingPresets}
                                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-grimlog-steel/50 text-grimlog-steel hover:text-grimlog-green hover:border-grimlog-green disabled:opacity-50"
                                  title="Set as default"
                                >
                                  ★
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deletePreset(preset.id)}
                                disabled={loadingPresets}
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-grimlog-red/50 text-grimlog-red/70 hover:text-grimlog-red hover:border-grimlog-red disabled:opacity-50"
                                title="Delete preset"
                              >
                                ✕
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPreset(preset)}
                                disabled={loadingPresets}
                                className="btn-depth-sm px-3 py-1 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase text-xs disabled:opacity-50"
                              >
                                LOAD
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel/60 bg-grimlog-black/70 flex items-center justify-between gap-4">
          <div className="text-[10px] font-mono uppercase tracking-wider">
            {isDirty ? (
              <span className="text-grimlog-amber">⚠ Unsaved changes</span>
            ) : (
              <span className="text-grimlog-steel">All changes saved</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!isDirty || isSaving}
              className="btn-depth h-10 px-4 bg-grimlog-gray hover:bg-grimlog-steel text-white font-bold tracking-wider border border-grimlog-steel transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              RESET
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              disabled={!isDirty || isSaving}
              className="btn-depth h-10 px-4 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider border border-grimlog-orange transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'SAVING...' : 'SAVE'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-depth h-10 px-4 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border border-grimlog-green transition-all uppercase text-xs"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
