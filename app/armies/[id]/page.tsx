'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MechanicusFrame from '@/components/MechanicusFrame';
import AddUnitModal from '@/components/AddUnitModal';
import Toast from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FactionIcon from '@/components/FactionIcon';
import TacticsModal from '@/components/TacticsModal';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import {
  generateSquadNumbers,
  getUnitDisplayName,
  type UnitForDisplay,
} from '@/lib/unitDisplayHelpers';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';

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
  units: Array<{
    id: string;
    name: string;
    datasheet: string;
    datasheetId?: string | null;
    pointsCost: number;
    keywords: string;
    modelCount: number;
    composition?: string | null;
    goal?: string;
    needsReview?: boolean;
  }>;
  stratagems: Array<{
    id: string;
    name: string;
    cpCost: number;
    phase: string;
    description: string;
    keywords: string;
    // Reference metadata (optional; present for StratagemData-derived entries)
    detachment?: string | null;
    source?: string | null;
  }>;
}

export default function ArmyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [army, setArmy] = useState<Army | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterAttachments, setCharacterAttachments] = useState<Record<string, string>>({});
  const [availableDetachments, setAvailableDetachments] = useState<string[]>([]);
  const [selectedDetachment, setSelectedDetachment] = useState<string>('');
  const [loadingDetachments, setLoadingDetachments] = useState(false);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
  const [isTacticsOpen, setIsTacticsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ unitId: string; unitName: string } | null>(null);

  /**
   * Migrates name-based attachments to ID-based.
   * If a value looks like a unit name (not a UUID), tries to find the matching unit ID.
   */
  const migrateAttachmentsToIds = (
    attachments: Record<string, string>,
    units: Army['units']
  ): Record<string, string> => {
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
  };

  const isCharacter = (unit: Army['units'][0]): boolean => {
    const keywords = JSON.parse(unit.keywords || '[]');
    return keywords.some((kw: string) => kw.toUpperCase() === 'CHARACTER');
  };

  // Generate squad numbers for duplicate units
  const squadNumbers = useMemo(() => {
    if (!army) return new Map<string, number>();
    const nonCharUnits = army.units.filter(u => !isCharacter(u));
    return generateSquadNumbers(nonCharUnits as UnitForDisplay[]);
  }, [army]);

  const unitIconRequests = useMemo(() => {
    if (!army) return [];
    const faction = (army.player.faction || 'Unknown').replace(/\(.*?\)/g, '').trim() || (army.player.faction || 'Unknown');
    return army.units.map(u => ({
      faction,
      unitName: u.datasheet || u.name,
    }));
  }, [army]);

  const { icons: unitIcons } = useUnitIcons(unitIconRequests, { autoFetch: true });

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
        setSelectedDetachment(data.detachment || '');

        // Attachments: parse, migrate to ID-based, and sanitize
        let parsedAttachments: Record<string, string> = {};
        if (data.characterAttachments) {
          try {
            const raw = JSON.parse(data.characterAttachments);
            if (raw && typeof raw === 'object') {
              parsedAttachments = raw;
            }
          } catch (e) {
            console.warn('Failed to parse character attachments');
          }
        }

        // Migrate name-based attachments to ID-based
        const migratedAttachments = migrateAttachmentsToIds(parsedAttachments, data.units || []);
        
        // Clean up any attachments referencing non-existent units
        const unitIds = new Set<string>((data.units || []).map((u: any) => u.id));
        const cleaned = Object.fromEntries(
          Object.entries(migratedAttachments).filter(([charId, targetId]) => {
            return unitIds.has(charId) && unitIds.has(targetId);
          })
        );

        setCharacterAttachments(cleaned);
        
        if (data.factionId) {
          setLoadingDetachments(true);
          try {
            const detRes = await fetch(`/api/factions/${data.factionId}/detachments`);
            if (detRes.ok) {
              const detachments = await detRes.json();
              setAvailableDetachments(detachments);
            } else {
              setAvailableDetachments([]);
            }
          } catch (err) {
            console.error('Failed to fetch detachments:', err);
            setAvailableDetachments([]);
          } finally {
            setLoadingDetachments(false);
          }
        } else {
          // No factionId = legacy army. Detachments will not be available until factionId can be resolved.
          setAvailableDetachments([]);
        }
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

  const handleDetachmentChange = async (newDetachment: string) => {
    if (!army) return;
    
    setSelectedDetachment(newDetachment);
    
    try {
      const response = await fetch(`/api/armies/${army.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detachment: newDetachment || null
        })
      });
      
      if (response.ok) {
        const armyResponse = await fetch(`/api/armies/${army.id}`);
        if (armyResponse.ok) {
          const updatedArmy = await armyResponse.json();
          setArmy(prev => prev ? { ...prev, stratagems: updatedArmy.stratagems, detachment: newDetachment } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update detachment:', error);
    }
  };

  const handleAddUnit = async (unitConfig: any) => {
    if (!army) return;
    
    try {
      const response = await fetch(`/api/armies/${army.id}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: unitConfig.name,
          datasheet: unitConfig.datasheet,
          datasheetId: unitConfig.datasheetId,
          modelCount: unitConfig.modelCount,
          pointsCost: unitConfig.pointsCost,
          composition: unitConfig.composition,
          weapons: unitConfig.weapons,
          abilities: unitConfig.abilities,
          keywords: unitConfig.keywords,
          enhancements: unitConfig.enhancements,
          needsReview: unitConfig.needsReview,
        }),
      });
      
      if (response.ok) {
        setToast({ message: `Added ${unitConfig.name}!`, type: 'success' });
        // Refresh army data
        fetchArmy(army.id);
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Failed to add unit', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to add unit:', error);
      setToast({ message: 'Failed to add unit', type: 'error' });
    }
  };

  const handleRemoveUnit = async (unitId: string) => {
    if (!army) return;
    
    try {
      const response = await fetch(`/api/units/${unitId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setToast({ message: 'Unit removed', type: 'success' });
        // Refresh army data
        fetchArmy(army.id);
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Failed to remove unit', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to remove unit:', error);
      setToast({ message: 'Failed to remove unit', type: 'error' });
    }
    
    setDeleteConfirm(null);
  };

  const getUnitTotalWounds = (unit: Army['units'][0]): number => {
    // Prefer unit-instance composition (built by UnitBuilder / parser) for mixed-wound units.
    if (unit.composition) {
      try {
        const composition = JSON.parse(unit.composition);
        if (Array.isArray(composition)) {
          const total = composition.reduce((sum: number, entry: any) => {
            const count = typeof entry?.count === 'number' ? entry.count : 0;
            const w = typeof entry?.woundsPerModel === 'number' ? entry.woundsPerModel : 0;
            return sum + count * w;
          }, 0);
          if (Number.isFinite(total) && total > 0) return total;
        }
      } catch {
        // ignore
      }
    }

    // Fallback: assume 1 wound per model if we don't have datasheet composition yet.
    return Math.max(1, unit.modelCount || 1);
  };

  if (loading) {
    return (
      <>
        <MechanicusFrame />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center text-mechanicus-brass">
            <div className="text-6xl mb-4 animate-spin">⚙</div>
            <p className="text-xl font-mono">LOADING DATA...</p>
          </div>
        </main>
      </>
    );
  }

  if (!army) {
    return null;
  }

  const totalPoints = army.units.reduce((sum, unit) => sum + unit.pointsCost, 0);

  const renderUnitIcon = (unit: Army['units'][0]) => {
    const faction = (army.player.faction || 'Unknown').replace(/\(.*?\)/g, '').trim() || (army.player.faction || 'Unknown');
    const unitNameForIcon = unit.datasheet || unit.name;
    const key = `${faction}:${unitNameForIcon}`;
    const resolvedUrl = unitIcons[key] || null;

    const icon = getUnitIcon(resolvedUrl, unitNameForIcon);
    const isImage = isCustomIcon(icon);

    if (isImage) {
      return (
        <img
          src={icon}
          alt={`${unitNameForIcon} icon`}
          className="w-12 h-12 object-cover rounded-sm border border-grimlog-steel/50 bg-grimlog-black"
          loading="lazy"
        />
      );
    }

    return (
      <div className="w-12 h-12 rounded-sm border border-grimlog-steel/50 bg-grimlog-black flex items-center justify-center text-2xl">
        {icon}
      </div>
    );
  };

  return (
    <>
      <MechanicusFrame />
      
      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />
      
      {army.factionId && (
        <AddUnitModal
          isOpen={isAddUnitModalOpen}
          onClose={() => setIsAddUnitModalOpen(false)}
          factionId={army.factionId}
          factionName={army.player.faction}
          onAddUnit={handleAddUnit}
        />
      )}
      
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="Remove Unit"
          message={`Are you sure you want to remove "${deleteConfirm.unitName}" from this army?`}
          confirmText="REMOVE"
          cancelText="CANCEL"
          onConfirm={() => handleRemoveUnit(deleteConfirm.unitId)}
          onClose={() => setDeleteConfirm(null)}
          variant="danger"
        />
      )}
      
      <main className="min-h-screen pt-4 pb-4">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <header className="dataslate-frame dataslate-open-anim p-6 mb-6 relative overflow-hidden" role="banner">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_4px,6px_100%] opacity-15"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-grimlog-steel">
                    [[ FORCE COGITATOR ]]
                  </div>
                  <h1 className="mt-2 text-3xl md:text-4xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase break-words">
                    {army.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-grimlog-green">
                    <span className="px-1 bg-grimlog-green text-grimlog-black font-bold uppercase">
                      AUTH: {army.player.name}
                    </span>
                    <span className="text-grimlog-steel">|</span>
                    <span className="uppercase truncate max-w-[260px]">FORCE: {army.player.faction}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] uppercase text-grimlog-steel font-bold">Points</div>
                  <div className="text-2xl font-mono text-grimlog-green">
                    {totalPoints} <span className="text-grimlog-steel">/</span> {army.pointsLimit}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-grimlog-amber">2000pt register</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-grimlog-steel/30 flex items-center gap-3">
                <div className="bg-grimlog-darkGray/80 p-1 border border-grimlog-steel/50 rounded-sm">
                  <FactionIcon factionName={army.player.faction} className="w-7 h-7 text-grimlog-amber" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-grimlog-light-steel truncate">
                  {army.player.faction}
                </div>
                <button
                  type="button"
                  onClick={() => setIsTacticsOpen(true)}
                  className="ml-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-grimlog-orange/70 text-grimlog-orange hover:bg-grimlog-orange hover:text-grimlog-black transition-all"
                  aria-label="Open tactics (detachment and stratagems)"
                >
                  TACTICS
                </button>
                <div className="hidden sm:block ml-2 text-[10px] font-mono uppercase tracking-wider text-grimlog-green/70">
                  DET: <span className="text-grimlog-amber">{selectedDetachment ? selectedDetachment : 'None'}</span>
                </div>
                <div className="ml-auto text-[10px] font-mono uppercase tracking-wider text-grimlog-green/70">
                  ID: {army.id.substring(0, 8)}
                </div>
              </div>
            </div>
          </header>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <Link
              href="/armies"
              className="btn-depth h-10 px-4 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border border-grimlog-green transition-all uppercase flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-grimlog-green focus:ring-offset-2 focus:ring-offset-grimlog-black group text-xs"
            >
              <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> RETURN
            </Link>

            {army.factionId && (
              <button
                onClick={() => setIsAddUnitModalOpen(true)}
                className="btn-depth h-10 px-4 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider border border-grimlog-orange transition-all uppercase flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black hover-lift text-xs"
              >
                <span className="mr-2">+</span> ADD UNIT
              </button>
            )}

            <Link
              href={`/armies/${army.id}/attachments`}
              className="btn-depth h-10 px-4 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-orange font-bold tracking-wider border border-grimlog-orange/70 transition-all uppercase flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black text-xs"
            >
              ⭐ ATTACHMENTS
            </Link>

            <a
              href={`/api/armies/${army.id}/export?format=download`}
              download
              className="btn-depth h-10 px-4 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-green font-bold tracking-wider border border-grimlog-green/70 transition-all uppercase flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-grimlog-green focus:ring-offset-2 focus:ring-offset-grimlog-black text-xs"
              title="Download army roster as HTML file"
            >
              📄 EXPORT
            </a>
          </div>

          {(() => {
            const rosterUnits = [...army.units].sort((a, b) => {
              const aIsChar = isCharacter(a);
              const bIsChar = isCharacter(b);
              if (aIsChar !== bIsChar) return aIsChar ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
            const totalModels = army.units.reduce((sum, u) => sum + (u.modelCount || 0), 0);
            const totalWounds = army.units.reduce((sum, u) => sum + getUnitTotalWounds(u), 0);

            // Now using ID-based attachments - find characters attached to a unit by ID
            const attachedCharactersByUnitId = (unitId: string) =>
              Object.entries(characterAttachments)
                .filter(([_, targetId]) => targetId === unitId)
                .map(([charId]) => army.units.find(u => u.id === charId)?.name || charId);

            return (
              <div className="dataslate-frame overflow-hidden relative">
                    <div className="absolute inset-0 crt-overlay opacity-20 pointer-events-none"></div>
                    <div className="bg-grimlog-darkGray border-b border-grimlog-steel/60 px-4 py-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-grimlog-orange tracking-widest uppercase flex items-center gap-2">
                        <span>🎖</span> ROSTER ({rosterUnits.length})
                      </h2>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-grimlog-steel">[[ ROSTER ]]</span>
                    </div>
                    <div className="relative z-10 p-4 bg-grimlog-black/40">

                  {rosterUnits.length === 0 ? (
                    <div className="p-6 bg-grimlog-gray border-2 border-grimlog-steel text-center">
                      <div className="text-4xl mb-4 opacity-50">⚔️</div>
                      <div className="text-grimlog-green mb-2">No non-character units yet</div>
                      {army.factionId && (
                        <button
                          onClick={() => setIsAddUnitModalOpen(true)}
                          className="btn-depth px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold text-sm transition-colors mt-2 uppercase"
                        >
                          + ADD A UNIT
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-grimlog-black/60 border border-grimlog-steel/50">
                        <div className="grid grid-cols-3 gap-3 text-xs font-mono uppercase tracking-wider">
                          <div>
                            <div className="text-grimlog-steel">Units</div>
                            <div className="text-grimlog-green text-sm font-bold">{rosterUnits.length}</div>
                          </div>
                          <div>
                            <div className="text-grimlog-steel">Models</div>
                            <div className="text-grimlog-green text-sm font-bold">{totalModels}</div>
                          </div>
                          <div>
                            <div className="text-grimlog-steel">Wounds</div>
                            <div className="text-grimlog-green text-sm font-bold">{totalWounds}</div>
                          </div>
                        </div>
                      </div>

                      {rosterUnits.map(unit => {
                        const unitIsCharacter = isCharacter(unit);
                        const attachedCharacters = unitIsCharacter ? [] : attachedCharactersByUnitId(unit.id);
                        // attachedTo is now an ID, look up the unit name for display
                        const attachedToId = unitIsCharacter ? (characterAttachments[unit.id] || null) : null;
                        const attachedToUnit = attachedToId ? army.units.find(u => u.id === attachedToId) : null;
                        const attachedToDisplayName = attachedToUnit 
                          ? getUnitDisplayName(attachedToUnit as UnitForDisplay, squadNumbers)
                          : null;
                        const totalUnitWounds = getUnitTotalWounds(unit);
                        const showReview = !!unit.needsReview || !unit.datasheetId;

                        return (
                          <div
                            key={unit.id}
                            className={`p-4 bg-grimlog-black/70 border card-depth-hover transition-all ${
                              showReview ? 'border-yellow-600 bg-yellow-900/10' : 'border-grimlog-steel'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2 gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                {renderUnitIcon(unit)}
                                <div className="min-w-0">
                                  <h3 className="text-lg font-bold text-grimlog-orange flex items-center gap-2 min-w-0">
                                    <span className="truncate">{unit.name}</span>
                                    {showReview && (
                                      <span className="text-xs text-yellow-400 font-normal whitespace-nowrap">⚠️ Review</span>
                                    )}
                                  </h3>
                                  <p className="text-sm text-grimlog-green mb-1">
                                    {unit.datasheet} • {unit.modelCount} models
                                  </p>
                                  <div className="text-[10px] font-mono uppercase tracking-wider text-grimlog-amber">
                                    WOUNDS: <span className="text-grimlog-green">{totalUnitWounds}</span>
                                    {unitIsCharacter ? <span className="text-grimlog-steel"> • CHARACTER</span> : null}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-grimlog-green font-mono text-xs bg-grimlog-black px-2 py-1 border border-grimlog-steel">
                                  {totalUnitWounds}W
                                </span>
                                <span className="text-grimlog-amber font-mono text-sm bg-grimlog-black px-2 py-1 border border-grimlog-steel">
                                  {unit.pointsCost}pts
                                </span>
                                <button
                                  onClick={() => setDeleteConfirm({ unitId: unit.id, unitName: unit.name })}
                                  className="px-2 py-1 text-grimlog-red hover:text-white border border-grimlog-red hover:bg-grimlog-red transition-all text-sm"
                                  title="Remove unit"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {unitIsCharacter && attachedToDisplayName ? (
                              <div className="mt-3 pt-3 border-t border-grimlog-steel/50">
                                <p className="text-xs text-grimlog-amber font-mono mb-2 uppercase">
                                  Attached To:
                                </p>
                                <div className="text-sm text-grimlog-green flex items-center gap-2">
                                  <span>⭐</span>
                                  <span className="truncate">{attachedToDisplayName}</span>
                                </div>
                              </div>
                            ) : null}

                            {attachedCharacters.length > 0 ? (
                              <div className="mt-3 pt-3 border-t border-grimlog-steel/50">
                                <p className="text-xs text-grimlog-amber font-mono mb-2 uppercase">
                                  Attached Characters:
                                </p>
                                <div className="space-y-1">
                                  {attachedCharacters.map((charName, idx) => (
                                    <div key={idx} className="text-sm text-grimlog-green flex items-center gap-2">
                                      <span>⭐</span>
                                      <span className="truncate">{charName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {unit.goal ? (
                              <p className="text-xs text-grimlog-green italic mt-2 pt-2 border-t border-grimlog-steel/50">
                                Goal: {unit.goal}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                    </div>
                  </div>
            );
          })()}

          {/* Browse Datasheets Link */}
          <div className="mt-8 p-6 bg-grimlog-gray border-2 border-grimlog-steel text-center">
            <p className="text-grimlog-green mb-4">
              Looking for more units? Browse the full datasheet library.
            </p>
            <Link
              href="/datasheets"
              className="inline-block px-6 py-3 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold tracking-wider transition-colors"
            >
              BROWSE DATASHEETS
            </Link>
          </div>
        </div>

        </main>

      <TacticsModal
        isOpen={isTacticsOpen}
        onClose={() => setIsTacticsOpen(false)}
        factionName={army.player.faction}
        availableDetachments={availableDetachments}
        selectedDetachment={selectedDetachment}
        loadingDetachments={loadingDetachments}
        onSelectDetachment={handleDetachmentChange}
        stratagems={army.stratagems}
      />
    </>
  );
}
