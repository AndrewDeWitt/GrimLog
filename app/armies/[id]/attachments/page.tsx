'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MechanicusFrame from '@/components/MechanicusFrame';
import Toast from '@/components/Toast';
import FactionIcon from '@/components/FactionIcon';
import SearchableSelect from '@/components/SearchableSelect';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';
import {
  generateSquadNumbers,
  getUnitDisplayName,
  getUnitDescription,
  findUnitById,
  findUnitByName,
  type UnitForDisplay,
  type SquadNumberMap,
} from '@/lib/unitDisplayHelpers';

interface Unit {
  id: string;
  name: string;
  datasheet: string;
  datasheetId?: string | null;
  pointsCost: number;
  keywords: string;
  modelCount: number;
}

interface Army {
  id: string;
  name: string;
  pointsLimit: number;
  characterAttachments: string | null;
  detachment: string | null;
  factionId: string | null;
  player: {
    name: string;
    faction: string;
  };
  units: Unit[];
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

/**
 * Migrates name-based attachments to ID-based.
 * If a value looks like a unit name (not a UUID), tries to find the matching unit ID.
 */
function migrateAttachmentsToIds(
  attachments: Record<string, string>,
  units: Unit[]
): Record<string, string> {
  const unitIds = new Set(units.map(u => u.id));
  const migrated: Record<string, string> = {};

  for (const [charId, targetValue] of Object.entries(attachments)) {
    // Check if target is already an ID
    if (unitIds.has(targetValue)) {
      migrated[charId] = targetValue;
    } else {
      // Try to find unit by name and migrate to ID
      const matchingUnit = units.find(u => u.name === targetValue);
      if (matchingUnit) {
        migrated[charId] = matchingUnit.id;
      }
      // If no match found, skip this attachment (stale data)
    }
  }

  return migrated;
}

export default function AttachmentsPage() {
  const params = useParams();
  const router = useRouter();
  const [army, setArmy] = useState<Army | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Attachments state - now stores unit IDs instead of names
  const [characterAttachments, setCharacterAttachments] = useState<Record<string, string>>({});
  const [savedCharacterAttachments, setSavedCharacterAttachments] = useState<Record<string, string>>({});
  
  // Presets state
  const [activeTab, setActiveTab] = useState<'edit' | 'presets'>('edit');
  const [presets, setPresets] = useState<AttachmentPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isCharacter = useCallback((unit: Unit): boolean => {
    try {
      const keywords = JSON.parse(unit.keywords || '[]');
      return keywords.some((kw: string) => kw.toUpperCase() === 'CHARACTER');
    } catch {
      return false;
    }
  }, []);

  const characterUnits = useMemo(() => {
    if (!army) return [];
    return army.units.filter(u => isCharacter(u));
  }, [army, isCharacter]);

  const nonCharacterUnits = useMemo(() => {
    if (!army) return [];
    return army.units.filter(u => !isCharacter(u));
  }, [army, isCharacter]);

  // Generate squad numbers for duplicate units
  const squadNumbers = useMemo(() => {
    return generateSquadNumbers(nonCharacterUnits as UnitForDisplay[]);
  }, [nonCharacterUnits]);

  const cleanFaction = useMemo(() => {
    if (!army) return 'Unknown';
    return (army.player.faction || 'Unknown').replace(/\(.*?\)/g, '').trim() || army.player.faction || 'Unknown';
  }, [army]);

  // Unit icons
  const unitIconRequests = useMemo(() => {
    if (!army) return [];
    return army.units.map(u => ({
      faction: cleanFaction,
      unitName: u.datasheet || u.name,
    }));
  }, [army, cleanFaction]);

  const { icons: unitIcons } = useUnitIcons(unitIconRequests, { autoFetch: true });

  const areAttachmentsEqual = useCallback((a: Record<string, string>, b: Record<string, string>) => {
    const na = normalizeAttachments(a);
    const nb = normalizeAttachments(b);
    const aKeys = Object.keys(na).sort();
    const bKeys = Object.keys(nb).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      const key = aKeys[i];
      if (key !== bKeys[i]) return false;
      if (na[key] !== nb[key]) return false;
    }
    return true;
  }, []);

  const isDirty = useMemo(
    () => !areAttachmentsEqual(characterAttachments, savedCharacterAttachments),
    [characterAttachments, savedCharacterAttachments, areAttachmentsEqual]
  );

  const attachedCount = useMemo(
    () => Object.values(characterAttachments).filter(Boolean).length,
    [characterAttachments]
  );

  // Fetch army data
  useEffect(() => {
    if (params.id) {
      fetchArmy(params.id as string);
    }
  }, [params.id]);

  const fetchArmy = async (id: string) => {
    try {
      const response = await fetch(`/api/armies/${id}`);
      if (response.ok) {
        const data = await response.json();
        setArmy(data);

        // Parse and migrate attachments to ID-based
        let parsedAttachments: Record<string, string> = {};
        if (data.characterAttachments) {
          try {
            const raw = JSON.parse(data.characterAttachments);
            if (raw && typeof raw === 'object') {
              parsedAttachments = raw;
            }
          } catch {
            console.warn('Failed to parse character attachments');
          }
        }

        // Migrate name-based attachments to ID-based
        const migratedAttachments = migrateAttachmentsToIds(parsedAttachments, data.units || []);
        
        // Clean up any attachments referencing non-existent units
        const unitIds = new Set<string>((data.units || []).map((u: Unit) => u.id));
        const cleaned = Object.fromEntries(
          Object.entries(migratedAttachments).filter(([charId, targetId]) => {
            return unitIds.has(charId) && unitIds.has(targetId);
          })
        );

        setCharacterAttachments(cleaned);
        setSavedCharacterAttachments(cleaned);
        
        // Fetch presets
        fetchPresets(id);
      } else {
        router.push('/armies');
      }
    } catch (error) {
      console.error('Failed to fetch army:', error);
      router.push('/armies');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async (armyId: string) => {
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

  const handleAttachmentChange = (characterUnitId: string, targetUnitId: string | null) => {
    setCharacterAttachments(prev => {
      const updated = { ...prev };
      if (!targetUnitId) {
        delete updated[characterUnitId];
      } else {
        updated[characterUnitId] = targetUnitId;
      }
      return updated;
    });
  };

  const handleClearAll = () => {
    setCharacterAttachments({});
  };

  const handleReset = () => {
    setCharacterAttachments(savedCharacterAttachments);
  };

  const handleSave = async () => {
    if (!army) return;
    
    setSaving(true);
    try {
      const normalized = normalizeAttachments(characterAttachments);
      const response = await fetch(`/api/armies/${army.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterAttachments: JSON.stringify(normalized)
        })
      });
      
      if (response.ok) {
        setToast({ message: 'Character attachments saved!', type: 'success' });
        setSavedCharacterAttachments(normalized);
      } else {
        setToast({ message: 'Failed to save character attachments', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to save attachments:', error);
      setToast({ message: 'Failed to save character attachments', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    router.push(`/armies/${army?.id}`);
  };

  // Preset handlers
  const createPreset = async () => {
    if (!army) return;
    const name = newPresetName.trim();
    if (!name) return;
    
    setLoadingPresets(true);
    setPresetError(null);
    try {
      const body = {
        name,
        attachments: normalizeAttachments(characterAttachments),
        isDefault: presets.length === 0,
      };
      const res = await fetch(`/api/armies/${army.id}/attachment-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to create preset (${res.status})`);
      }
      setNewPresetName('');
      await fetchPresets(army.id);
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to create preset');
    } finally {
      setLoadingPresets(false);
    }
  };

  const applyPreset = (preset: AttachmentPreset) => {
    const attachments = parseAttachmentsJson(preset.attachmentsJson);
    // Migrate preset attachments in case they're name-based
    const migrated = army ? migrateAttachmentsToIds(attachments, army.units) : attachments;
    setCharacterAttachments(migrated);
    setActiveTab('edit');
  };

  const setDefaultPreset = async (presetId: string) => {
    if (!army) return;
    setLoadingPresets(true);
    setPresetError(null);
    try {
      const res = await fetch(`/api/armies/${army.id}/attachment-presets/${presetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to set default (${res.status})`);
      }
      await fetchPresets(army.id);
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to set default preset');
    } finally {
      setLoadingPresets(false);
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!army) return;
    setLoadingPresets(true);
    setPresetError(null);
    try {
      const res = await fetch(`/api/armies/${army.id}/attachment-presets/${presetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Failed to delete preset (${res.status})`);
      }
      await fetchPresets(army.id);
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to delete preset');
    } finally {
      setLoadingPresets(false);
    }
  };

  const renderUnitIcon = (unit: Unit, size: 'sm' | 'md' = 'md') => {
    const unitNameForIcon = unit.datasheet || unit.name;
    const key = `${cleanFaction}:${unitNameForIcon}`;
    const resolvedUrl = unitIcons[key] || null;
    const icon = getUnitIcon(resolvedUrl, unitNameForIcon);
    const isImage = isCustomIcon(icon);

    const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';

    if (isImage) {
      return (
        <img
          src={icon}
          alt={`${unitNameForIcon} icon`}
          className={`${sizeClasses} object-cover rounded-sm border border-grimlog-steel/50 bg-grimlog-black`}
          loading="lazy"
        />
      );
    }

    return (
      <div className={`${sizeClasses} rounded-sm border border-grimlog-steel/50 bg-grimlog-black flex items-center justify-center ${size === 'sm' ? 'text-base' : 'text-xl'}`}>
        {icon}
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <MechanicusFrame />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 text-grimlog-orange animate-spin inline-block">◎</div>
            <p className="font-mono text-grimlog-green animate-pulse">LOADING ATTACHMENT DATA...</p>
          </div>
        </div>
      </>
    );
  }

  if (!army) {
    return (
      <>
        <MechanicusFrame />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-grimlog-red text-xl mb-4">ERROR: ARMY NOT FOUND</div>
            <Link href="/armies" className="text-grimlog-orange hover:text-grimlog-amber">
              Return to Army List
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MechanicusFrame />
      
      <div className="min-h-screen flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 bg-grimlog-darkGray border-b-2 border-grimlog-orange">
          <div className="container mx-auto px-4 max-w-5xl">
            {/* Top row */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <FactionIcon factionName={army.player.faction} className="w-10 h-10 text-grimlog-amber flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-grimlog-steel">
                    [[ ATTACHMENTS ]]
                  </div>
                  <h1 className="text-lg font-bold text-grimlog-orange tracking-widest uppercase truncate">
                    {army.player.faction}
                  </h1>
                </div>
              </div>
              
              <Link
                href={`/armies/${army.id}`}
                className="btn-depth h-9 px-4 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border border-grimlog-green transition-all uppercase flex items-center gap-2 text-xs flex-shrink-0"
              >
                <span>←</span> BACK
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex border-t border-grimlog-steel/40">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
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
                className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'presets'
                    ? 'bg-grimlog-orange text-grimlog-black'
                    : 'bg-grimlog-black/60 text-grimlog-green hover:bg-grimlog-steel/20'
                }`}
              >
                Presets ({presets.length})
              </button>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {presetError && (
          <div className="bg-grimlog-red/10 border-b border-grimlog-red/30">
            <div className="container mx-auto px-4 max-w-5xl py-2">
              <div className="text-sm text-grimlog-red font-mono">{presetError}</div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="container mx-auto px-4 max-w-5xl py-6">
            {activeTab === 'edit' ? (
              <>
                {/* Status Bar */}
                <div className="mb-6 p-3 bg-grimlog-black/60 border border-grimlog-steel/50 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-6">
                    <div className="text-[11px] font-mono uppercase tracking-wider">
                      <span className="text-grimlog-steel">Characters:</span>{' '}
                      <span className="text-grimlog-green font-bold">{characterUnits.length}</span>
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider">
                      <span className="text-grimlog-steel">Attached:</span>{' '}
                      <span className="text-grimlog-amber font-bold">{attachedCount}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={attachedCount === 0}
                    className="btn-depth-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-grimlog-red/50 text-grimlog-red/80 hover:text-grimlog-red hover:border-grimlog-red disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                </div>

                {/* Character Cards */}
                {characterUnits.length === 0 ? (
                  <div className="p-8 bg-grimlog-black border border-grimlog-steel/50 text-center">
                    <div className="text-grimlog-steel text-sm">No characters detected in this roster.</div>
                    <div className="text-xs text-grimlog-light-steel mt-2">
                      Add a character unit and it will appear here.
                    </div>
                  </div>
                ) : nonCharacterUnits.length === 0 ? (
                  <div className="p-8 bg-grimlog-black border border-grimlog-steel/50 text-center">
                    <div className="text-grimlog-amber text-sm">No non-character units to attach to.</div>
                    <div className="text-xs text-grimlog-light-steel mt-2">
                      Add at least one unit (non-character) to enable attachments.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {characterUnits.map(charUnit => {
                      const attachable = nonCharacterUnits
                        .filter(u => u.id !== charUnit.id)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      const options = attachable.map(u => ({
                        value: u.id,
                        label: getUnitDisplayName(u as UnitForDisplay, squadNumbers),
                        leading: renderUnitIcon(u, 'sm'),
                        description: getUnitDescription(u as UnitForDisplay),
                      }));

                      const currentTargetId = characterAttachments[charUnit.id] || null;
                      const currentTargetUnit = currentTargetId 
                        ? findUnitById(currentTargetId, nonCharacterUnits as UnitForDisplay[])
                        : null;

                      return (
                        <div
                          key={charUnit.id}
                          className={`p-4 bg-grimlog-black/70 border card-depth transition-all ${
                            currentTargetId ? 'border-grimlog-amber/60' : 'border-grimlog-steel/50'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {renderUnitIcon(charUnit)}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <div className="text-base font-bold text-grimlog-orange truncate">{charUnit.name}</div>
                                  <div className="text-[11px] text-grimlog-green font-mono">
                                    {charUnit.datasheet} • {charUnit.modelCount} model{charUnit.modelCount !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="text-grimlog-amber font-mono text-sm bg-grimlog-black px-2 py-1 border border-grimlog-steel flex-shrink-0">
                                  {charUnit.pointsCost}pts
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-[10px] text-grimlog-amber font-mono uppercase tracking-wider">
                                    Attach to unit
                                  </label>
                                  {currentTargetId && (
                                    <button
                                      type="button"
                                      className="text-[10px] text-grimlog-red/80 hover:text-grimlog-red font-mono uppercase tracking-wider"
                                      onClick={() => handleAttachmentChange(charUnit.id, null)}
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>

                                <SearchableSelect
                                  value={currentTargetId}
                                  onChange={(v) => handleAttachmentChange(charUnit.id, v)}
                                  options={options}
                                  placeholder="-- No Attachment --"
                                  searchPlaceholder="Search units..."
                                />

                                {currentTargetUnit && (
                                  <div className="mt-2 text-[10px] text-grimlog-steel font-mono">
                                    Attached to: {getUnitDisplayName(currentTargetUnit, squadNumbers)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Presets Tab */
              <div className="space-y-6">
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
        </main>

        {/* Sticky Footer */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-grimlog-darkGray border-t-2 border-grimlog-orange">
          <div className="container mx-auto px-4 max-w-5xl py-3 flex items-center justify-between gap-4">
            <div className="text-[11px] font-mono uppercase tracking-wider">
              {isDirty ? (
                <span className="text-grimlog-amber flex items-center gap-2">
                  <span className="w-2 h-2 bg-grimlog-amber rounded-full animate-pulse"></span>
                  Unsaved changes
                </span>
              ) : (
                <span className="text-grimlog-steel">All changes saved</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || saving}
                className="btn-depth h-10 px-4 bg-grimlog-gray hover:bg-grimlog-steel text-white font-bold tracking-wider border border-grimlog-steel transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                RESET
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="btn-depth h-10 px-4 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider border border-grimlog-orange transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
              <button
                type="button"
                onClick={handleSaveAndClose}
                disabled={saving}
                className="btn-depth h-10 px-4 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border border-grimlog-green transition-all uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                SAVE & CLOSE
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          isVisible={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

