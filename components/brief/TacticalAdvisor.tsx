'use client';

import { useMemo, useState } from 'react';

interface UnitTacticalData {
  unitName: string;
  points: number;
  deploymentTips?: string;
  counters: string[];
  synergies: string[];
  activeSynergies: string[];
  role?: string;
  tier?: string;
  hasDeepStrike?: boolean;
  hasScouts?: boolean;
  hasInfiltrate?: boolean;
  hasFly?: boolean;
}

interface TacticalAdvisorProps {
  units: UnitTacticalData[];
  factionStrengths?: string[];
  factionWeaknesses?: string[];
}

interface DeploymentPhase {
  phase: string;
  icon: string;
  tips: Array<{ unit: string; tip: string }>;
}

export function TacticalAdvisor({ units, factionStrengths = [], factionWeaknesses = [] }: TacticalAdvisorProps) {
  const [activeTab, setActiveTab] = useState<'deployment' | 'counters' | 'synergies'>('deployment');

  // Aggregate and organize deployment tips by phase
  const deploymentBriefing = useMemo(() => {
    const phases: DeploymentPhase[] = [
      { phase: 'Pre-Game Setup', icon: '🎯', tips: [] },
      { phase: 'Deployment', icon: '📍', tips: [] },
      { phase: 'Turn 1', icon: '1️⃣', tips: [] },
      { phase: 'Turn 2+', icon: '2️⃣', tips: [] },
    ];

    // Categorize deployment tips
    units.forEach(unit => {
      if (!unit.deploymentTips) return;
      
      const tip = unit.deploymentTips.toLowerCase();
      const entry = { unit: unit.unitName, tip: unit.deploymentTips };

      // Pre-game: Scouts, Infiltrate
      if (unit.hasScouts || unit.hasInfiltrate || tip.includes('scout') || tip.includes('infiltrate')) {
        phases[0].tips.push(entry);
      }
      // Deployment phase
      else if (tip.includes('deploy') || tip.includes('screen') || tip.includes('castle') || tip.includes('setup')) {
        phases[1].tips.push(entry);
      }
      // Turn 1
      else if (tip.includes('turn 1') || tip.includes('first turn') || tip.includes('alpha')) {
        phases[2].tips.push(entry);
      }
      // Turn 2+ (deep strike, reserves)
      else if (unit.hasDeepStrike || tip.includes('deep strike') || tip.includes('turn 2') || tip.includes('reserve')) {
        phases[3].tips.push(entry);
      }
      // Default to deployment
      else {
        phases[1].tips.push(entry);
      }
    });

    return phases.filter(p => p.tips.length > 0);
  }, [units]);

  // Aggregate counter warnings
  const counterWarnings = useMemo(() => {
    const counterMap = new Map<string, { count: number; units: string[] }>();
    
    units.forEach(unit => {
      unit.counters.forEach(counter => {
        const normalized = counter.toLowerCase();
        if (!counterMap.has(normalized)) {
          counterMap.set(normalized, { count: 0, units: [] });
        }
        const entry = counterMap.get(normalized)!;
        entry.count++;
        entry.units.push(unit.unitName);
      });
    });

    // Sort by frequency and return top threats
    return Array.from(counterMap.entries())
      .map(([counter, data]) => ({
        counter,
        ...data,
        severity: data.count >= 3 ? 'high' : data.count >= 2 ? 'medium' : 'low',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [units]);

  // Active synergies in the list
  const activeSynergiesSummary = useMemo(() => {
    const synergies: Array<{
      unit1: string;
      unit2: string;
      tier1?: string;
      tier2?: string;
    }> = [];
    
    const seen = new Set<string>();
    
    units.forEach(unit => {
      unit.activeSynergies.forEach(syn => {
        const key = [unit.unitName, syn].sort().join('|||');
        if (!seen.has(key)) {
          seen.add(key);
          const synUnit = units.find(u => u.unitName === syn);
          synergies.push({
            unit1: unit.unitName,
            unit2: syn,
            tier1: unit.tier,
            tier2: synUnit?.tier,
          });
        }
      });
    });

    return synergies;
  }, [units]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const withDeploymentTips = units.filter(u => u.deploymentTips).length;
    const totalCounterVulnerabilities = counterWarnings.reduce((sum, c) => sum + c.count, 0);
    const activeSynergyCount = activeSynergiesSummary.length;
    
    return { withDeploymentTips, totalCounterVulnerabilities, activeSynergyCount };
  }, [units, counterWarnings, activeSynergiesSummary]);

  const tabs = [
    { id: 'deployment' as const, label: 'Deployment', icon: '📍', count: stats.withDeploymentTips },
    { id: 'counters' as const, label: 'Counters', icon: '⚠️', count: counterWarnings.length },
    { id: 'synergies' as const, label: 'Synergies', icon: '🔗', count: stats.activeSynergyCount },
  ];

  return (
    <div className="bg-grimlog-darkGray border-2 border-grimlog-orange/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-grimlog-orange/20 to-transparent p-4 border-b border-grimlog-orange/30">
        <h3 className="text-grimlog-orange font-bold uppercase tracking-wider flex items-center gap-2 text-lg">
          <span className="text-2xl">🎖️</span> Tactical Advisor
        </h3>
        <p className="text-grimlog-steel text-xs mt-1">
          Aggregated tactical guidance based on competitive insights
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-grimlog-steel/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-4 py-3 text-sm font-bold uppercase transition-all
              ${activeTab === tab.id 
                ? 'bg-grimlog-steel/20 text-grimlog-orange border-b-2 border-grimlog-orange' 
                : 'text-grimlog-steel hover:bg-grimlog-steel/10 hover:text-grimlog-amber'}
            `}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
            <span className="ml-2 px-1.5 py-0.5 bg-grimlog-steel/30 rounded text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Deployment Tab */}
        {activeTab === 'deployment' && (
          <div className="space-y-4 animate-fade-in">
            {deploymentBriefing.length > 0 ? (
              deploymentBriefing.map((phase, i) => (
                <div key={i} className="border-l-2 border-grimlog-orange/50 pl-4">
                  <h4 className="text-grimlog-orange font-bold text-sm flex items-center gap-2 mb-2">
                    <span>{phase.icon}</span> {phase.phase}
                  </h4>
                  <div className="space-y-2">
                    {phase.tips.map((tip, j) => (
                      <div key={j} className="bg-grimlog-black/30 rounded p-3">
                        <span className="text-grimlog-green font-bold text-sm">{tip.unit}:</span>
                        <p className="text-grimlog-steel text-sm mt-1">{tip.tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-grimlog-steel">
                <p className="text-sm">No deployment tips available yet.</p>
                <p className="text-xs mt-1 text-grimlog-steel/60">
                  Tips are populated from competitive content creator insights.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Counters Tab */}
        {activeTab === 'counters' && (
          <div className="space-y-4 animate-fade-in">
            {counterWarnings.length > 0 ? (
              <>
                {/* High Priority Warnings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {counterWarnings.filter(c => c.severity === 'high').map((warning, i) => (
                    <div 
                      key={i}
                      className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-red-400 font-bold uppercase text-sm">
                          ⚠️ {warning.counter}
                        </span>
                        <span className="px-2 py-0.5 bg-red-500/30 text-red-300 rounded text-xs">
                          {warning.count} units vulnerable
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {warning.units.slice(0, 4).map((unit, j) => (
                          <span key={j} className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs">
                            {unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Other Warnings */}
                {counterWarnings.filter(c => c.severity !== 'high').length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-grimlog-amber text-xs font-bold uppercase mb-2">
                      Other Potential Threats
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {counterWarnings.filter(c => c.severity !== 'high').map((warning, i) => (
                        <span 
                          key={i}
                          className={`
                            px-3 py-1.5 rounded text-sm
                            ${warning.severity === 'medium' 
                              ? 'bg-orange-500/20 text-orange-400' 
                              : 'bg-grimlog-steel/20 text-grimlog-steel'}
                          `}
                          title={`Threatens: ${warning.units.join(', ')}`}
                        >
                          {warning.counter} ({warning.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Faction Weaknesses */}
                {factionWeaknesses.length > 0 && (
                  <div className="mt-4 p-3 bg-grimlog-steel/10 rounded border border-grimlog-steel/30">
                    <h4 className="text-grimlog-steel text-xs font-bold uppercase mb-2">
                      General Faction Weaknesses
                    </h4>
                    <ul className="space-y-1">
                      {factionWeaknesses.slice(0, 3).map((weakness, i) => (
                        <li key={i} className="text-grimlog-steel/80 text-sm">• {weakness}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-grimlog-steel">
                <p className="text-sm">No counter data available yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Synergies Tab */}
        {activeTab === 'synergies' && (
          <div className="space-y-4 animate-fade-in">
            {activeSynergiesSummary.length > 0 ? (
              <>
                <p className="text-grimlog-green text-sm mb-4">
                  ✓ <span className="font-bold">{activeSynergiesSummary.length}</span> active synergies detected in your list!
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeSynergiesSummary.map((syn, i) => (
                    <div 
                      key={i}
                      className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3"
                    >
                      {/* Unit 1 */}
                      <div className="flex-1 text-right">
                        <span className="text-grimlog-green font-bold text-sm">{syn.unit1}</span>
                        {syn.tier1 && (
                          <span className={`ml-1 text-xs ${
                            syn.tier1 === 'S' ? 'text-amber-400' :
                            syn.tier1 === 'A' ? 'text-green-400' :
                            'text-slate-400'
                          }`}>
                            ({syn.tier1})
                          </span>
                        )}
                      </div>
                      
                      {/* Connection */}
                      <div className="text-grimlog-orange text-lg">↔</div>
                      
                      {/* Unit 2 */}
                      <div className="flex-1">
                        <span className="text-grimlog-green font-bold text-sm">{syn.unit2}</span>
                        {syn.tier2 && (
                          <span className={`ml-1 text-xs ${
                            syn.tier2 === 'S' ? 'text-amber-400' :
                            syn.tier2 === 'A' ? 'text-green-400' :
                            'text-slate-400'
                          }`}>
                            ({syn.tier2})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Faction Strengths */}
                {factionStrengths.length > 0 && (
                  <div className="mt-4 p-3 bg-green-500/5 rounded border border-green-500/20">
                    <h4 className="text-green-400 text-xs font-bold uppercase mb-2">
                      Faction Strengths
                    </h4>
                    <ul className="space-y-1">
                      {factionStrengths.slice(0, 3).map((strength, i) => (
                        <li key={i} className="text-grimlog-steel/80 text-sm">• {strength}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-grimlog-steel">
                <p className="text-sm">No active synergies detected between units in your list.</p>
                <p className="text-xs mt-2 text-grimlog-amber">
                  💡 Tip: Check individual unit cards for synergy suggestions with units not in your list.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TacticalAdvisor;

