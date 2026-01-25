'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MechanicusFrame from '@/components/MechanicusFrame';
import FactionIcon from '@/components/FactionIcon';
import IconGeneratorModal from '@/components/tools/IconGeneratorModal';

interface Weapon {
  id: string;
  name: string;
  range: string;
  type: string;
  attacks: string;
  ballisticSkill: string | null;
  weaponSkill: string | null;
  strength: string;
  armorPenetration: string;
  damage: string;
  abilities: string[];
  isDefault: boolean;
  quantity: string | null;
}

interface Ability {
  id: string;
  name: string;
  type: string;
  description: string;
  phase: string | null;
  triggerPhase: string[] | null;
  source: string;
}

interface WargearOption {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  type: string;
}

interface CompetitiveContext {
  id: string;
  competitiveTier: string | null;
  tierReasoning: string | null;
  bestTargets: string | null; // JSON array
  counters: string | null; // JSON array
  synergies: string | null; // JSON array
  playstyleNotes: string | null;
  deploymentTips: string | null;
  competitiveNotes: string | null;
  sourceCount: number | null;
  lastAggregated: string | null;
  faction?: { id: string; name: string } | null;
  detachment?: { id: string; name: string } | null;
}

interface CompetitiveContextResponse {
  datasheet: { id: string; name: string };
  context: CompetitiveContext | null;
  matchType: 'detachment' | 'faction' | 'generic' | 'none';
  requestedScope: { factionId: string | null; detachmentId: string | null };
}

interface DatasheetDetail {
  id: string;
  name: string;
  faction: string;
  factionId: string | null;
  factionDetails: { id: string; name: string; parentFactionId: string | null } | null;
  subfaction: string | null;
  role: string;
  keywords: string[];
  movement: string;
  toughness: number;
  save: string;
  invulnerableSave: string | null;
  wounds: number;
  leadership: number;
  objectiveControl: number;
  composition: string;
  compositionData: any;
  unitSize: string | null;
  leaderRules: string | null;
  leaderAbilities: string | null;
  transportCapacity: string | null;
  pointsCost: number;
  weapons: Weapon[];
  abilities: Ability[];
  wargearOptions: WargearOption[];
  edition: string;
  sourceBook: string | null;
}

export default function DatasheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [datasheet, setDatasheet] = useState<DatasheetDetail | null>(null);
  const [competitiveContext, setCompetitiveContext] = useState<CompetitiveContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDatasheet();
    }
  }, [params.id]);

  const fetchDatasheet = async () => {
    try {
      const response = await fetch(`/api/datasheets/detail/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Datasheet not found');
        } else {
          setError('Failed to load datasheet');
        }
        return;
      }
      const data = await response.json();
      setDatasheet(data);
      
      // Fetch competitive context with faction scope for better matching
      try {
        const contextParams = new URLSearchParams();
        // Use factionDetails.id (the actual linked faction) for context lookup
        const factionIdForContext = data.factionDetails?.id || data.factionId;
        if (factionIdForContext) {
          contextParams.set('factionId', factionIdForContext);
        }
        const contextUrl = `/api/datasheets/detail/${params.id}/competitive-context${contextParams.toString() ? '?' + contextParams.toString() : ''}`;
        const contextResponse = await fetch(contextUrl);
        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          setCompetitiveContext(contextData);
        }
      } catch (contextErr) {
        console.error('Failed to fetch competitive context:', contextErr);
      }
      
      // Fetch icon from resolve API (checks database first, then filesystem)
      try {
        const iconParams = new URLSearchParams({ 
          unitName: data.name, 
          faction: data.faction 
        });
        const iconResponse = await fetch(`/api/icons/resolve?${iconParams}`);
        if (iconResponse.ok) {
          const iconData = await iconResponse.json();
          if (iconData.iconUrl) {
            setIconUrl(iconData.iconUrl);
          } else {
            // Fall back to filesystem check for legacy icons
            const safeFaction = data.faction.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const safeUnitName = data.name.replace(/[^a-z0-9]/gi, '_');
            const iconPath = `/icons/${safeFaction}/${safeUnitName}.png`;
            
            const img = new Image();
            img.onload = () => setIconUrl(iconPath);
            img.src = iconPath;
          }
        }
      } catch (iconErr) {
        console.error('Failed to fetch icon:', iconErr);
      }
      
    } catch (err) {
      console.error('Failed to fetch datasheet:', err);
      setError('Failed to load datasheet');
    } finally {
      setLoading(false);
    }
  };

  // Separate weapons by type
  const rangedWeapons = datasheet?.weapons.filter(w => w.range !== 'Melee') || [];
  const meleeWeapons = datasheet?.weapons.filter(w => w.range === 'Melee') || [];

  // Group abilities by type
  const groupedAbilities = datasheet?.abilities.reduce((acc, ability) => {
    const type = ability.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(ability);
    return acc;
  }, {} as Record<string, Ability[]>) || {};

  // Helper to parse JSON arrays from competitive context
  const parseJsonArray = (jsonString: string | null): string[] => {
    if (!jsonString) return [];
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
    }
  };

  // Helper to get tier color classes
  const getTierColor = (tier: string | null): string => {
    switch (tier) {
      case 'S': return 'text-amber-400 bg-amber-500/20 border-amber-500';
      case 'A': return 'text-green-400 bg-green-500/20 border-green-500';
      case 'B': return 'text-blue-400 bg-blue-500/20 border-blue-500';
      case 'C': return 'text-slate-400 bg-slate-500/20 border-slate-500';
      case 'D': return 'text-orange-400 bg-orange-500/20 border-orange-500';
      case 'F': return 'text-red-400 bg-red-500/20 border-red-500';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500';
    }
  };

  // Parse competitive context arrays
  const bestTargets = parseJsonArray(competitiveContext?.context?.bestTargets ?? null);
  const counters = parseJsonArray(competitiveContext?.context?.counters ?? null);
  const synergies = parseJsonArray(competitiveContext?.context?.synergies ?? null);

  if (loading) {
    return (
      <>
        <MechanicusFrame />
        <main className="min-h-screen pt-4 pb-8">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-spin">⚙</div>
              <div className="text-grimlog-orange">Loading datasheet...</div>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !datasheet) {
    return (
      <>
        <MechanicusFrame />
        <main className="min-h-screen pt-4 pb-8">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">⚠️</div>
              <div className="text-grimlog-red text-xl mb-4">{error || 'Datasheet not found'}</div>
              <Link
                href="/datasheets"
                className="px-6 py-2 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold transition-colors"
              >
                BACK TO LIBRARY
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <MechanicusFrame />
      
      <main className="min-h-screen pt-4 pb-8">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Back Link */}
          <Link
            href="/datasheets"
            className="inline-flex items-center gap-2 text-grimlog-orange hover:text-orange-400 mb-6 font-mono text-sm"
          >
            ← BACK TO LIBRARY
          </Link>

          {/* Header Card */}
          <div className="border-2 border-grimlog-orange bg-grimlog-black mb-6 relative">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-grimlog-orange"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-grimlog-orange"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-grimlog-orange"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-grimlog-orange"></div>

            <div className="p-6">
              {/* Title Row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-grimlog-orange relative group">
                    {iconUrl ? (
                      <img src={iconUrl} alt={datasheet.name} className="w-24 h-24 object-contain rounded bg-white/5" />
                    ) : (
                      <FactionIcon factionName={datasheet.faction} className="w-12 h-12" />
                    )}
                    
                    {/* Generate Icon Button */}
                    <button 
                      onClick={() => setIsIconModalOpen(true)}
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-grimlog-orange hover:bg-white text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg text-xs"
                      title="Generate/Edit Icon"
                    >
                      ✏️
                    </button>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-grimlog-orange tracking-wider">
                      {datasheet.name}
                    </h1>
                    <div className="flex items-center gap-2 text-grimlog-light-steel text-sm mt-1">
                      <span>{datasheet.faction}</span>
                      {datasheet.subfaction && (
                        <>
                          <span className="text-grimlog-steel">•</span>
                          <span>{datasheet.subfaction}</span>
                        </>
                      )}
                      <span className="text-grimlog-steel">•</span>
                      <span className="text-grimlog-green">{datasheet.role}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-grimlog-green font-mono">
                    {datasheet.pointsCost}
                  </div>
                  <div className="text-sm text-grimlog-light-steel">POINTS</div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-6 gap-2 bg-grimlog-darkGray p-4 border border-grimlog-steel">
                <div className="text-center">
                  <div className="text-xs text-grimlog-light-steel font-mono mb-1">M</div>
                  <div className="text-2xl font-bold text-white">{datasheet.movement}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-grimlog-light-steel font-mono mb-1">T</div>
                  <div className="text-2xl font-bold text-white">{datasheet.toughness}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-grimlog-light-steel font-mono mb-1">SV</div>
                  <div className="text-2xl font-bold text-white">
                    {datasheet.save}
                    {datasheet.invulnerableSave && (
                      <span className="text-grimlog-amber text-lg ml-1">
                        /{datasheet.invulnerableSave}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-grimlog-light-steel font-mono mb-1">W</div>
                  <div className="text-2xl font-bold text-white">{datasheet.wounds}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-grimlog-light-steel font-mono mb-1">LD</div>
                  <div className="text-2xl font-bold text-white">{datasheet.leadership}+</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-grimlog-light-steel font-mono mb-1">OC</div>
                  <div className="text-2xl font-bold text-white">{datasheet.objectiveControl}</div>
                </div>
              </div>

              {/* Keywords */}
              <div className="mt-4 flex flex-wrap gap-2">
                {datasheet.keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-grimlog-black border border-grimlog-steel text-grimlog-light-steel text-xs font-mono uppercase"
                  >
                    {kw}
                  </span>
                ))}
              </div>

              {/* Composition */}
              {datasheet.composition && (
                <div className="mt-4 p-3 bg-grimlog-darkGray border-l-4 border-grimlog-orange">
                  <div className="text-xs text-grimlog-orange font-mono mb-1">COMPOSITION</div>
                  <div className="text-sm text-grimlog-light-steel">{datasheet.composition}</div>
                </div>
              )}

              {/* Leader Rules */}
              {datasheet.leaderRules && (
                <div className="mt-4 p-3 bg-grimlog-darkGray border-l-4 border-grimlog-amber">
                  <div className="text-xs text-grimlog-amber font-mono mb-1">LEADER</div>
                  <div className="text-sm text-grimlog-light-steel">{datasheet.leaderRules}</div>
                </div>
              )}

              {/* Transport */}
              {datasheet.transportCapacity && (
                <div className="mt-4 p-3 bg-grimlog-darkGray border-l-4 border-purple-500">
                  <div className="text-xs text-purple-400 font-mono mb-1">TRANSPORT</div>
                  <div className="text-sm text-grimlog-light-steel">{datasheet.transportCapacity}</div>
                </div>
              )}
            </div>
          </div>

          {/* Weapons Section */}
          {datasheet.weapons.length > 0 && (
            <div className="border-2 border-grimlog-steel bg-grimlog-black mb-6">
              <div className="p-4 border-b border-grimlog-steel bg-grimlog-darkGray">
                <h2 className="text-xl font-bold text-grimlog-orange tracking-wider">WEAPONS</h2>
              </div>
              
              <div className="p-4 space-y-6">
                {/* Ranged Weapons */}
                {rangedWeapons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-grimlog-green mb-3 font-mono">RANGED WEAPONS</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-grimlog-steel text-grimlog-light-steel">
                            <th className="text-left py-2 px-2 font-mono">NAME</th>
                            <th className="text-center py-2 px-2 font-mono">RANGE</th>
                            <th className="text-center py-2 px-2 font-mono">A</th>
                            <th className="text-center py-2 px-2 font-mono">BS</th>
                            <th className="text-center py-2 px-2 font-mono">S</th>
                            <th className="text-center py-2 px-2 font-mono">AP</th>
                            <th className="text-center py-2 px-2 font-mono">D</th>
                            <th className="text-left py-2 px-2 font-mono">ABILITIES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rangedWeapons.map((w, idx) => (
                            <tr key={idx} className="border-b border-grimlog-darkGray hover:bg-grimlog-darkGray">
                              <td className="py-2 px-2 text-white font-bold">{w.name}</td>
                              <td className="py-2 px-2 text-center text-grimlog-light-steel">{w.range}</td>
                              <td className="py-2 px-2 text-center text-white">{w.attacks}</td>
                              <td className="py-2 px-2 text-center text-white">{w.ballisticSkill || '-'}</td>
                              <td className="py-2 px-2 text-center text-white">{w.strength}</td>
                              <td className="py-2 px-2 text-center text-white">{w.armorPenetration}</td>
                              <td className="py-2 px-2 text-center text-white">{w.damage}</td>
                              <td className="py-2 px-2 text-grimlog-amber text-xs">
                                {w.abilities.length > 0 ? w.abilities.join(', ') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Melee Weapons */}
                {meleeWeapons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-grimlog-red mb-3 font-mono">MELEE WEAPONS</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-grimlog-steel text-grimlog-light-steel">
                            <th className="text-left py-2 px-2 font-mono">NAME</th>
                            <th className="text-center py-2 px-2 font-mono">RANGE</th>
                            <th className="text-center py-2 px-2 font-mono">A</th>
                            <th className="text-center py-2 px-2 font-mono">WS</th>
                            <th className="text-center py-2 px-2 font-mono">S</th>
                            <th className="text-center py-2 px-2 font-mono">AP</th>
                            <th className="text-center py-2 px-2 font-mono">D</th>
                            <th className="text-left py-2 px-2 font-mono">ABILITIES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meleeWeapons.map((w, idx) => (
                            <tr key={idx} className="border-b border-grimlog-darkGray hover:bg-grimlog-darkGray">
                              <td className="py-2 px-2 text-white font-bold">{w.name}</td>
                              <td className="py-2 px-2 text-center text-grimlog-light-steel">{w.range}</td>
                              <td className="py-2 px-2 text-center text-white">{w.attacks}</td>
                              <td className="py-2 px-2 text-center text-white">{w.weaponSkill || '-'}</td>
                              <td className="py-2 px-2 text-center text-white">{w.strength}</td>
                              <td className="py-2 px-2 text-center text-white">{w.armorPenetration}</td>
                              <td className="py-2 px-2 text-center text-white">{w.damage}</td>
                              <td className="py-2 px-2 text-grimlog-amber text-xs">
                                {w.abilities.length > 0 ? w.abilities.join(', ') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Abilities Section */}
          {datasheet.abilities.length > 0 && (
            <div className="border-2 border-grimlog-steel bg-grimlog-black mb-6">
              <div className="p-4 border-b border-grimlog-steel bg-grimlog-darkGray">
                <h2 className="text-xl font-bold text-grimlog-orange tracking-wider">ABILITIES</h2>
              </div>
              
              <div className="p-4 space-y-4">
                {Object.entries(groupedAbilities).map(([type, abilities]) => (
                  <div key={type}>
                    <h3 className="text-xs font-bold text-grimlog-light-steel mb-2 font-mono uppercase">
                      {type === 'core' ? 'CORE' :
                       type === 'faction' ? 'FACTION' :
                       type === 'unit' ? 'UNIT ABILITIES' :
                       type === 'leader' ? 'LEADER ABILITIES' :
                       type.toUpperCase()}
                    </h3>
                    <div className="space-y-2">
                      {abilities.map((ability, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-grimlog-darkGray border-l-4 border-grimlog-green"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white">{ability.name}</span>
                            {ability.triggerPhase && ability.triggerPhase.length > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-grimlog-black border border-grimlog-steel text-grimlog-light-steel">
                                {ability.triggerPhase.join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-grimlog-light-steel">{ability.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wargear Options */}
          {datasheet.wargearOptions.length > 0 && (
            <div className="border-2 border-grimlog-steel bg-grimlog-black mb-6">
              <div className="p-4 border-b border-grimlog-steel bg-grimlog-darkGray">
                <h2 className="text-xl font-bold text-grimlog-orange tracking-wider">WARGEAR OPTIONS</h2>
              </div>
              
              <div className="p-4 space-y-2">
                {datasheet.wargearOptions.map((option, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-grimlog-darkGray border border-grimlog-steel flex items-start justify-between gap-4"
                  >
                    <div>
                      <span className="font-bold text-white">{option.name}</span>
                      <p className="text-sm text-grimlog-light-steel mt-1">{option.description}</p>
                    </div>
                    {option.pointsCost > 0 && (
                      <span className="text-grimlog-green font-mono font-bold">
                        +{option.pointsCost}pts
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Insights Section */}
          {competitiveContext?.context && (
            <div className="border-2 border-grimlog-steel bg-grimlog-black mb-6">
              <div className="p-4 border-b border-grimlog-steel bg-grimlog-darkGray flex items-center justify-between">
                <h2 className="text-xl font-bold text-grimlog-orange tracking-wider">COMPETITIVE INSIGHTS</h2>
                {competitiveContext.context.competitiveTier && (
                  <span className={`px-3 py-1 rounded border text-sm font-bold font-mono ${getTierColor(competitiveContext.context.competitiveTier)}`}>
                    {competitiveContext.context.competitiveTier}-TIER
                  </span>
                )}
              </div>
              
              <div className="p-4 space-y-4">
                {/* Tier Reasoning */}
                {competitiveContext.context.tierReasoning && (
                  <div className="p-3 bg-grimlog-darkGray border-l-4 border-grimlog-amber">
                    <p className="text-sm text-grimlog-light-steel">{competitiveContext.context.tierReasoning}</p>
                  </div>
                )}

                {/* Best Targets & Counters Grid */}
                {(bestTargets.length > 0 || counters.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bestTargets.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-grimlog-green mb-2 font-mono uppercase">BEST AGAINST</h3>
                        <div className="flex flex-wrap gap-1">
                          {bestTargets.map((target, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-grimlog-green/20 text-grimlog-green text-xs rounded border border-grimlog-green/30"
                            >
                              {target}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {counters.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-grimlog-red mb-2 font-mono uppercase">COUNTERED BY</h3>
                        <div className="flex flex-wrap gap-1">
                          {counters.map((counter, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-grimlog-red/20 text-grimlog-red text-xs rounded border border-grimlog-red/30"
                            >
                              {counter}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Synergies */}
                {synergies.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-blue-400 mb-2 font-mono uppercase">SYNERGIZES WITH</h3>
                    <div className="flex flex-wrap gap-1">
                      {synergies.map((synergy, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30"
                        >
                          {synergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playstyle Notes */}
                {competitiveContext.context.playstyleNotes && (
                  <div>
                    <h3 className="text-xs font-bold text-grimlog-amber mb-2 font-mono uppercase">HOW TO PLAY</h3>
                    <p className="text-sm text-grimlog-light-steel">{competitiveContext.context.playstyleNotes}</p>
                  </div>
                )}

                {/* Deployment Tips */}
                {competitiveContext.context.deploymentTips && (
                  <div>
                    <h3 className="text-xs font-bold text-purple-400 mb-2 font-mono uppercase">DEPLOYMENT TIPS</h3>
                    <p className="text-sm text-grimlog-light-steel">{competitiveContext.context.deploymentTips}</p>
                  </div>
                )}

                {/* Competitive Notes */}
                {competitiveContext.context.competitiveNotes && (
                  <div>
                    <h3 className="text-xs font-bold text-grimlog-steel mb-2 font-mono uppercase">ADDITIONAL NOTES</h3>
                    <p className="text-sm text-grimlog-light-steel">{competitiveContext.context.competitiveNotes}</p>
                  </div>
                )}

                {/* Source Info */}
                <div className="pt-3 border-t border-grimlog-steel/50 flex items-center justify-between text-xs text-grimlog-steel">
                  <span>
                    {competitiveContext.context.sourceCount 
                      ? `Based on ${competitiveContext.context.sourceCount} competitive source${competitiveContext.context.sourceCount > 1 ? 's' : ''}`
                      : 'Competitive context available'}
                  </span>
                  {competitiveContext.matchType !== 'none' && (
                    <span className="px-2 py-0.5 bg-grimlog-darkGray border border-grimlog-steel rounded">
                      {competitiveContext.matchType === 'generic' ? 'Generic' :
                       competitiveContext.matchType === 'faction' ? `${competitiveContext.context.faction?.name || 'Faction'}` :
                       competitiveContext.matchType === 'detachment' ? `${competitiveContext.context.detachment?.name || 'Detachment'}` :
                       ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Unit Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => router.push(`/armies/new?datasheetId=${datasheet.id}`)}
              className="px-8 py-3 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold text-lg tracking-wider transition-colors border-2 border-grimlog-orange"
            >
              CREATE UNIT FROM THIS DATASHEET
            </button>
          </div>
        </div>
      </main>

      {/* Icon Generator Modal */}
      {datasheet && (
        <IconGeneratorModal
          unitName={datasheet.name}
          faction={datasheet.faction}
          isOpen={isIconModalOpen}
          onClose={() => setIsIconModalOpen(false)}
          onSuccess={(url) => {
            setIconUrl(url);
            setIsIconModalOpen(false);
          }}
        />
      )}
    </>
  );
}
