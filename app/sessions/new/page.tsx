'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import Toast from '@/components/Toast';
import SearchableSelect from '@/components/SearchableSelect';
import { useArmies } from '@/lib/hooks/useArmies';
import { invalidateCache } from '@/lib/requestCache';
import { DEPLOYMENT_TYPES } from '@/components/TacticalMapView';
import type { MissionMode } from '@/lib/types';

interface Army {
  id: string;
  name: string;
  player: {
    name: string;
    faction: string;
  };
  pointsLimit: number;
  _count?: {
    units: number;
  };
}

interface ArmyUnit {
  id: string;
  name: string;
  datasheet: string;
  datasheetId?: string | null;
  pointsCost: number;
  keywords: string;
  modelCount: number;
}

interface ArmyDetail extends Army {
  characterAttachments: string | null;
  units: ArmyUnit[];
}

interface AttachmentPreset {
  id: string;
  name: string;
  isDefault: boolean;
  attachmentsJson: string;
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

function isCharacter(unit: ArmyUnit): boolean {
  try {
    const kws = JSON.parse(unit.keywords || '[]');
    return Array.isArray(kws) && kws.some((kw: string) => (kw || '').toUpperCase() === 'CHARACTER');
  } catch {
    return false;
  }
}

export default function NewSessionPage() {
  const router = useRouter();
  
  // Use custom hook for cached armies data
  const { armies, loading, error: armiesError } = useArmies({
    detailed: true,
    ttl: 60000, // 60 second cache
    autoFetch: true
  });
  
  const [creating, setCreating] = useState(false);
  
  const [attackerArmyId, setAttackerArmyId] = useState<string>('');
  const [defenderArmyId, setDefenderArmyId] = useState<string>('');
  const [deploymentType, setDeploymentType] = useState<string>('crucible-of-battle');
  const [firstTurn, setFirstTurn] = useState<'attacker' | 'defender'>('attacker');
  const [missionMode, setMissionMode] = useState<MissionMode>('tactical');

  // Battle Ready (attachments) for attacker
  const [attackerArmyDetail, setAttackerArmyDetail] = useState<ArmyDetail | null>(null);
  const [attachmentPresets, setAttachmentPresets] = useState<AttachmentPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(''); // '' = use army-saved attachments
  const [attackerAttachments, setAttackerAttachments] = useState<Record<string, string>>({});
  
  const [toast, setToast] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isVisible: false,
    message: '',
    type: 'info',
  });
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ isVisible: true, message, type });
  };

  // Show error toast if armies fail to load
  useEffect(() => {
    if (armiesError) {
      showToast('Failed to load armies', 'error');
    }
  }, [armiesError]);

  // Load attacker army detail + presets for battle-ready attachments
  useEffect(() => {
    const load = async () => {
      if (!attackerArmyId) {
        setAttackerArmyDetail(null);
        setAttachmentPresets([]);
        setSelectedPresetId('');
        setAttackerAttachments({});
        return;
      }

      try {
        const [armyRes, presetsRes] = await Promise.all([
          fetch(`/api/armies/${attackerArmyId}`),
          fetch(`/api/armies/${attackerArmyId}/attachment-presets`),
        ]);

        if (armyRes.ok) {
          const army = (await armyRes.json()) as ArmyDetail;
          setAttackerArmyDetail(army);
          setAttackerAttachments(parseAttachmentsJson(army.characterAttachments));
        } else {
          setAttackerArmyDetail(null);
          setAttackerAttachments({});
        }

        if (presetsRes.ok) {
          const j = await presetsRes.json();
          const presets: AttachmentPreset[] =
            Array.isArray(j) ? j : (j?.data?.presets ?? []);
          setAttachmentPresets(presets);

          const defaultPreset = presets.find(p => p.isDefault) || null;
          if (defaultPreset && !selectedPresetId) {
            // Keep UI default as "Use army saved" unless user explicitly chooses a preset.
            // Presets are available for quick switching.
          }
        } else {
          setAttachmentPresets([]);
        }
      } catch (e) {
        setAttackerArmyDetail(null);
        setAttachmentPresets([]);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attackerArmyId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!attackerArmyId || !defenderArmyId) {
      showToast('Please select armies for both attacker and defender', 'warning');
      return;
    }

    if (attackerArmyId === defenderArmyId) {
      showToast('Attacker and defender must have different armies', 'warning');
      return;
    }

    setCreating(true);
    try {
      // Create session with both armies, deployment type, and first player
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attackerArmyId,
          defenderArmyId,
          deploymentType,
          firstTurn,
          missionMode,
          attackerAttachments: attackerAttachments
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Set as current session
        localStorage.setItem('grimlog-current-session', data.session.id);
        
        // Invalidate sessions cache so the list shows the new session
        invalidateCache('/api/sessions');
        
        showToast('Battle initialized successfully!', 'success');
        
        // Navigate to live session page
        setTimeout(() => router.push('/sessions/live'), 500);
      } else {
        const error = await response.json();
        showToast(error.error || 'Failed to create session', 'error');
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      showToast('Failed to create session', 'error');
    } finally {
      setCreating(false);
    }
  };

  const selectedAttackerArmy = armies.find(a => a.id === attackerArmyId);
  const selectedDefenderArmy = armies.find(a => a.id === defenderArmyId);

  return (
    <>
      <GrimlogFrame />
      
      <div className="min-h-screen pt-4 pb-4">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <header className="text-center py-6 border-b-2 border-grimlog-steel mb-8" role="banner">
            <h1 className="text-4xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase">
              NEW BATTLE
            </h1>
            <p className="text-grimlog-green text-sm font-mono mt-2" aria-hidden="true">
              [[ INITIALIZE COMBAT SCENARIO ]]
            </p>
          </header>

          {/* Back Button */}
          <nav className="mb-6" aria-label="Page navigation">
            <Link
              href="/sessions"
              className="min-h-[48px] px-6 py-3 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border-2 border-grimlog-green transition-all uppercase inline-flex items-center focus:outline-none focus:ring-2 focus:ring-grimlog-green focus:ring-offset-2 focus:ring-offset-grimlog-black"
              aria-label="Back to sessions"
            >
              <span aria-hidden="true">← </span>BACK TO SESSIONS
            </Link>
          </nav>

          {loading ? (
            <div className="text-center text-grimlog-orange py-12" role="status" aria-live="polite">
              <div className="text-4xl mb-4" aria-hidden="true">◎</div>
              <p className="font-mono">LOADING ARMIES...</p>
            </div>
          ) : armies.length < 2 ? (
            <div className="text-center p-8 border-2 border-grimlog-red bg-grimlog-gray" role="alert">
              <div className="text-4xl text-grimlog-red mb-4">⚠</div>
              <h2 className="text-xl font-bold text-grimlog-red mb-4">INSUFFICIENT ARMIES</h2>
              <p className="text-grimlog-light-steel mb-6">
                You need at least 2 armies to start a battle. Create armies first.
              </p>
              <Link
                href="/armies/new"
                className="min-h-[48px] px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider border-2 border-grimlog-orange transition-all uppercase inline-flex items-center focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black"
              >
                <span aria-hidden="true">+ </span>CREATE ARMY
              </Link>
            </div>
          ) : (
            <main id="main-content" role="main">
              <form onSubmit={handleCreateSession} className="space-y-6">
                {/* Attacker Army Selection */}
                <section className="p-6 bg-grimlog-gray border-2 border-grimlog-red">
                  <h2 className="text-xl font-bold text-grimlog-red mb-4 tracking-wider uppercase">
                    <span aria-hidden="true">◈ </span>ATTACKER
                  </h2>
                  
                  <label htmlFor="attacker-army" className="block text-sm text-grimlog-light-steel font-mono mb-2">
                    SELECT ARMY
                  </label>
                  <select
                    id="attacker-army"
                    value={attackerArmyId}
                    onChange={(e) => setAttackerArmyId(e.target.value)}
                    required
                    className="w-full min-h-[48px] px-4 py-3 bg-grimlog-black border-2 border-grimlog-steel text-grimlog-red font-bold tracking-wider focus:outline-none focus:border-grimlog-red focus:ring-2 focus:ring-grimlog-red"
                  >
                    <option value="">-- SELECT ARMY --</option>
                    {armies.map(army => (
                      <option key={army.id} value={army.id}>
                        {army.name} - {army.player.name} ({army.player.faction}) - {army.pointsLimit}pts
                      </option>
                    ))}
                  </select>

                  {selectedAttackerArmy && (
                    <div className="mt-4 p-4 bg-grimlog-black border border-grimlog-red">
                      <div className="text-sm text-grimlog-red space-y-1">
                        <p><strong>Army:</strong> {selectedAttackerArmy.name}</p>
                        <p><strong>Commander:</strong> {selectedAttackerArmy.player.name}</p>
                        <p><strong>Faction:</strong> {selectedAttackerArmy.player.faction}</p>
                        <p><strong>Points:</strong> {selectedAttackerArmy.pointsLimit}</p>
                        <p><strong>Units:</strong> {selectedAttackerArmy._count?.units || 0}</p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Defender Army Selection */}
                <section className="p-6 bg-grimlog-gray border-2 border-grimlog-green">
                  <h2 className="text-xl font-bold text-grimlog-green mb-4 tracking-wider uppercase">
                    <span aria-hidden="true">◆ </span>DEFENDER
                  </h2>
                  
                  <label htmlFor="defender-army" className="block text-sm text-grimlog-light-steel font-mono mb-2">
                    SELECT ARMY
                  </label>
                  <select
                    id="defender-army"
                    value={defenderArmyId}
                    onChange={(e) => setDefenderArmyId(e.target.value)}
                    required
                    className="w-full min-h-[48px] px-4 py-3 bg-grimlog-black border-2 border-grimlog-steel text-grimlog-green font-bold tracking-wider focus:outline-none focus:border-grimlog-green focus:ring-2 focus:ring-grimlog-green"
                  >
                    <option value="">-- SELECT ARMY --</option>
                    {armies
                      .filter(army => army.id !== attackerArmyId)
                      .map(army => (
                        <option key={army.id} value={army.id}>
                          {army.name} - {army.player.name} ({army.player.faction}) - {army.pointsLimit}pts
                        </option>
                      ))}
                  </select>

                  {selectedDefenderArmy && (
                    <div className="mt-4 p-4 bg-grimlog-black border border-grimlog-green">
                      <div className="text-sm text-grimlog-green space-y-1">
                        <p><strong>Army:</strong> {selectedDefenderArmy.name}</p>
                        <p><strong>Commander:</strong> {selectedDefenderArmy.player.name}</p>
                        <p><strong>Faction:</strong> {selectedDefenderArmy.player.faction}</p>
                        <p><strong>Points:</strong> {selectedDefenderArmy.pointsLimit}</p>
                        <p><strong>Units:</strong> {selectedDefenderArmy._count?.units || 0}</p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Battle Ready (Attachments) */}
                {attackerArmyDetail && (
                  <section className="p-6 bg-grimlog-gray border-2 border-grimlog-orange">
                    <h2 className="text-xl font-bold text-grimlog-orange mb-4 tracking-wider uppercase">
                      <span aria-hidden="true">⭐ </span>BATTLE READY (ATTACHMENTS)
                    </h2>

                    <div className="text-xs text-grimlog-light-steel font-mono mb-4">
                      Pick an attachment preset for this battle and tweak as needed. This selection is applied at session start.
                    </div>

                    <label htmlFor="attachment-preset" className="block text-sm text-grimlog-light-steel font-mono mb-2">
                      ATTACHMENT PRESET
                    </label>
                    <select
                      id="attachment-preset"
                      value={selectedPresetId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedPresetId(nextId);
                        if (!nextId) {
                          // Back to army-saved attachments
                          setAttackerAttachments(parseAttachmentsJson(attackerArmyDetail.characterAttachments));
                          return;
                        }
                        const p = attachmentPresets.find(x => x.id === nextId);
                        if (p) {
                          setAttackerAttachments(parseAttachmentsJson(p.attachmentsJson));
                        }
                      }}
                      className="w-full min-h-[48px] px-4 py-3 bg-grimlog-black border-2 border-grimlog-steel text-grimlog-orange font-bold tracking-wider focus:outline-none focus:border-grimlog-orange focus:ring-2 focus:ring-grimlog-orange"
                    >
                      <option value="">-- USE ARMY SAVED ATTACHMENTS --</option>
                      {attachmentPresets.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>

                    {(() => {
                      const characterUnits = attackerArmyDetail.units.filter(isCharacter);
                      const nonCharacterUnits = attackerArmyDetail.units.filter(u => !isCharacter(u));

                      if (characterUnits.length === 0) {
                        return (
                          <div className="mt-4 p-4 bg-grimlog-black border border-grimlog-steel text-grimlog-steel text-sm">
                            No characters detected in this army.
                          </div>
                        );
                      }

                      if (nonCharacterUnits.length === 0) {
                        return (
                          <div className="mt-4 p-4 bg-grimlog-black border border-grimlog-steel text-grimlog-amber text-sm">
                            No non-character units to attach to.
                          </div>
                        );
                      }

                      const options = nonCharacterUnits
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(u => ({
                          value: u.name,
                          label: u.name,
                          description: `${u.modelCount} models • ${u.pointsCost}pts`,
                        }));

                      return (
                        <div className="mt-4 space-y-3">
                          {characterUnits
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(charUnit => (
                              <div key={charUnit.id} className="p-4 bg-grimlog-black border border-grimlog-steel">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-grimlog-orange font-bold truncate">{charUnit.name}</div>
                                    <div className="text-xs text-grimlog-light-steel font-mono">
                                      {charUnit.datasheet} • {charUnit.modelCount} models
                                    </div>
                                  </div>
                                  <div className="text-grimlog-amber font-mono text-sm">
                                    {charUnit.pointsCost}pts
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <div className="text-[10px] text-grimlog-amber font-mono mb-2 uppercase tracking-wider">
                                    Attach to unit
                                  </div>
                                  <SearchableSelect
                                    value={attackerAttachments[charUnit.id] || null}
                                    onChange={(v) => {
                                      setAttackerAttachments(prev => {
                                        const next = { ...prev };
                                        if (!v) delete next[charUnit.id];
                                        else next[charUnit.id] = v;
                                        return next;
                                      });
                                    }}
                                    options={options}
                                    placeholder="-- No Attachment --"
                                    searchPlaceholder="Search units..."
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      );
                    })()}
                  </section>
                )}

                {/* Deployment Type Selection */}
                <section className="p-6 bg-grimlog-gray border-2 border-grimlog-amber">
                  <h2 className="text-xl font-bold text-grimlog-amber mb-4 tracking-wider uppercase">
                    <span aria-hidden="true">📍 </span>DEPLOYMENT TYPE
                  </h2>
                  
                  <label htmlFor="deployment-type" className="block text-sm text-grimlog-light-steel font-mono mb-2">
                    SELECT DEPLOYMENT
                  </label>
                  <select
                    id="deployment-type"
                    value={deploymentType}
                    onChange={(e) => setDeploymentType(e.target.value)}
                    required
                    className="w-full min-h-[48px] px-4 py-3 bg-grimlog-black border-2 border-grimlog-steel text-grimlog-amber font-bold tracking-wider focus:outline-none focus:border-grimlog-amber focus:ring-2 focus:ring-grimlog-amber"
                  >
                    {DEPLOYMENT_TYPES.map(deployment => (
                      <option key={deployment.value} value={deployment.value}>
                        {deployment.label}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 p-3 bg-grimlog-black border border-grimlog-amber">
                    <p className="text-grimlog-light-steel text-xs">
                      <span className="font-bold text-grimlog-amber">Note:</span> Determines objective placement and deployment zones on the tactical map.
                    </p>
                  </div>
                </section>

                {/* First Player Selection (Roll-off Result) */}
                <section className="p-6 bg-grimlog-gray border-2 border-grimlog-cyan">
                  <h2 className="text-xl font-bold text-grimlog-cyan mb-4 tracking-wider uppercase">
                    <span aria-hidden="true">🎲 </span>TURN ORDER (ROLL-OFF)
                  </h2>
                  
                  <label className="block text-sm text-grimlog-light-steel font-mono mb-3">
                    WHO GOES FIRST?
                  </label>
                  
                  <div className="space-y-3">
                    <label 
                      htmlFor="first-player-attacker"
                      className={`flex items-center gap-3 p-4 cursor-pointer border-2 transition-all ${
                        firstTurn === 'attacker' 
                          ? 'bg-grimlog-red bg-opacity-30 border-grimlog-red' 
                          : 'bg-grimlog-black border-grimlog-steel hover:border-grimlog-red'
                      }`}
                    >
                      <input
                        type="radio"
                        id="first-player-attacker"
                        name="firstTurn"
                        value="attacker"
                        checked={firstTurn === 'attacker'}
                        onChange={(e) => setFirstTurn(e.target.value as 'attacker' | 'defender')}
                        className="w-5 h-5 accent-black focus:ring-2 focus:ring-grimlog-red"
                      />
                      <div className="flex-1">
                        <div className={`font-bold tracking-wider ${firstTurn === 'attacker' ? 'text-black font-bold' : 'text-grimlog-red'}`}>
                          ATTACKER GOES FIRST
                        </div>
                      </div>
                    </label>
                    
                    <label 
                      htmlFor="first-player-defender"
                      className={`flex items-center gap-3 p-4 cursor-pointer border-2 transition-all ${
                        firstTurn === 'defender' 
                          ? 'bg-grimlog-green bg-opacity-30 border-grimlog-green' 
                          : 'bg-grimlog-black border-grimlog-steel hover:border-grimlog-green'
                      }`}
                    >
                      <input
                        type="radio"
                        id="first-player-defender"
                        name="firstTurn"
                        value="defender"
                        checked={firstTurn === 'defender'}
                        onChange={(e) => setFirstTurn(e.target.value as 'attacker' | 'defender')}
                        className="w-5 h-5 accent-black focus:ring-2 focus:ring-grimlog-green"
                      />
                      <div className="flex-1">
                        <div className={`font-bold tracking-wider ${firstTurn === 'defender' ? 'text-black font-bold' : 'text-grimlog-green'}`}>
                          DEFENDER GOES FIRST
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="mt-4 p-3 bg-grimlog-black border border-grimlog-cyan">
                    <p className="text-grimlog-light-steel text-xs">
                      <span className="font-bold text-grimlog-cyan">Note:</span> Determines who takes the first turn each round. The same player goes first every round.
                    </p>
                  </div>
                </section>

                {/* Mission Mode */}
                <section className="p-6 bg-grimlog-gray border-2 border-grimlog-steel">
                  <h2 className="text-xl font-bold text-grimlog-orange mb-2 tracking-wider uppercase">
                    Mission Mode
                  </h2>
                  <p className="text-grimlog-light-steel text-sm mb-4">
                    How will secondary objectives be handled?
                  </p>
                  
                  <div className="space-y-3">
                    <label 
                      htmlFor="mission-mode-tactical"
                      className={`flex items-center gap-3 p-4 cursor-pointer border-2 transition-all ${
                        missionMode === 'tactical' 
                          ? 'bg-blue-600 bg-opacity-30 border-blue-500' 
                          : 'bg-grimlog-black border-grimlog-steel hover:border-blue-500'
                      }`}
                    >
                      <input
                        type="radio"
                        id="mission-mode-tactical"
                        name="missionMode"
                        value="tactical"
                        checked={missionMode === 'tactical'}
                        onChange={() => setMissionMode('tactical')}
                        className="w-5 h-5 accent-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className={`font-bold tracking-wider flex items-center gap-2 ${missionMode === 'tactical' ? 'text-white' : 'text-blue-400'}`}>
                          <span className="text-xl">🎲</span> TACTICAL
                        </div>
                        <p className={`text-sm mt-1 ${missionMode === 'tactical' ? 'text-blue-100' : 'text-grimlog-light-steel'}`}>
                          Draw random cards from deck, complete & redraw
                        </p>
                      </div>
                    </label>
                    
                    <label 
                      htmlFor="mission-mode-fixed"
                      className={`flex items-center gap-3 p-4 cursor-pointer border-2 transition-all ${
                        missionMode === 'fixed' 
                          ? 'bg-amber-600 bg-opacity-30 border-amber-500' 
                          : 'bg-grimlog-black border-grimlog-steel hover:border-amber-500'
                      }`}
                    >
                      <input
                        type="radio"
                        id="mission-mode-fixed"
                        name="missionMode"
                        value="fixed"
                        checked={missionMode === 'fixed'}
                        onChange={() => setMissionMode('fixed')}
                        className="w-5 h-5 accent-amber-500 focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <div className={`font-bold tracking-wider flex items-center gap-2 ${missionMode === 'fixed' ? 'text-white' : 'text-amber-400'}`}>
                          <span className="text-xl">📋</span> FIXED
                        </div>
                        <p className={`text-sm mt-1 ${missionMode === 'fixed' ? 'text-amber-100' : 'text-grimlog-light-steel'}`}>
                          Select 2 secondaries at game start, score throughout
                        </p>
                      </div>
                    </label>
                  </div>
                </section>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={creating || !attackerArmyId || !defenderArmyId}
                    className="flex-1 min-h-[56px] px-6 py-4 bg-grimlog-orange hover:bg-grimlog-amber disabled:bg-grimlog-gray text-grimlog-black font-bold tracking-wider border-2 border-grimlog-orange disabled:border-grimlog-steel transition-all uppercase text-lg focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <>
                        <span className="animate-pulse">◎ INITIALIZING...</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">⚔ </span>START BATTLE
                      </>
                    )}
                  </button>
                </div>
              </form>
            </main>
          )}
        </div>
      </div>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </>
  );
}
