'use client';

import { useState } from 'react';

export interface WeaponStats {
  weapon: string;
  weaponStats: string;
  attacks: number;
  skill: string;
  stats: {
    expected_hits: number;
    expected_wounds: number;
    expected_unsaved: number;
    expected_damage: number;
    models_killed: number;
    mortal_wounds: number;
    hit_rate: number;
    wound_rate: number;
    save_rate: number;
    crit_hit_chance: number;
    crit_wound_chance: number;
  };
  weaponOnlyDamage: number;
  weaponOnlyKills: number;
}

export interface ExtraAttackInfo {
  weapon: string;
  damage: number;
  kills: number;
  attacks: number;
  stats: string;
}

export interface DamageCalculationResult {
  id: string;
  timestamp: Date;
  attacker: string;
  defender: string;
  weapon: string; // Best weapon (for quick reference)
  phase: string;
  modifiers: string[];
  stats: {
    expected_hits: number;
    expected_wounds: number;
    expected_unsaved: number;
    expected_damage: number;
    models_killed: number;
    mortal_wounds: number;
    hit_rate: number;
    wound_rate: number;
    save_rate: number;
    crit_hit_chance: number;
    crit_wound_chance: number;
  };
  // NEW: All weapons comparison
  allWeapons?: WeaponStats[];
  // Extra attacks breakdown
  extraAttacks?: ExtraAttackInfo[];
}

interface DamageResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: DamageCalculationResult[];
  onDismissResult: (id: string) => void;
  onClearAll: () => void;
}

export default function DamageResultsModal({
  isOpen,
  onClose,
  results,
  onDismissResult,
  onClearAll,
}: DamageResultsModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen || results.length === 0) return null;

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Sort results by timestamp (newest first)
  const sortedResults = [...results].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-lg mx-auto max-h-[70vh] overflow-hidden flex flex-col shadow-2xl rounded-t-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-grimlog-slate-dark border-b border-grimlog-steel px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔</span>
            <div>
              <h2 className="text-gray-900 text-lg font-bold tracking-wider uppercase">
                Damage Results
              </h2>
              <p className="text-gray-500 text-xs font-mono">
                {results.length} calculation{results.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-grimlog-slate-light">
          {sortedResults.map((result, index) => (
            <div 
              key={result.id}
              className={`bg-white border-2 ${index === 0 ? 'border-grimlog-orange' : 'border-gray-300'} overflow-hidden rounded-lg`}
            >
              {/* Result Header - Always Visible */}
              <div 
                className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(result.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
                      result.phase === 'Fight' 
                        ? 'bg-red-100 text-red-700 border border-red-300' 
                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                    }`}>
                      {result.phase}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissResult(result.id);
                    }}
                    className="text-gray-400 hover:text-gray-700 text-sm"
                    aria-label="Dismiss result"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Compact Summary - Units */}
                <div className="text-sm mb-3">
                  <span className="text-green-600 font-bold">{result.attacker}</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="text-amber-600">{result.defender}</span>
                </div>
                
                {/* Damage Breakdown - Main visual */}
                {result.extraAttacks && result.extraAttacks.length > 0 ? (
                  <div className="bg-gray-50 border border-gray-200 p-2 font-mono text-sm rounded">
                    {(() => {
                      const bestWeapon = result.allWeapons?.find(w => w.weapon === result.weapon);
                      const weaponOnlyDmg = bestWeapon?.weaponOnlyDamage ?? result.stats.expected_damage;
                      const weaponOnlyKills = bestWeapon?.weaponOnlyKills ?? result.stats.models_killed;
                      const extraDmg = result.extraAttacks!.reduce((sum, ea) => sum + ea.damage, 0);
                      const extraKills = result.extraAttacks!.reduce((sum, ea) => sum + ea.kills, 0);
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600 truncate max-w-[200px]">{result.weapon}</span>
                            <span className="text-amber-600">{weaponOnlyDmg.toFixed(1)} dmg</span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span>+ Extra Attacks</span>
                            <span>{extraDmg.toFixed(1)} dmg</span>
                          </div>
                          <div className="border-t border-gray-300 pt-1 flex justify-between">
                            <span className="text-grimlog-orange font-bold">TOTAL</span>
                            <div className="flex gap-4">
                              <span className="text-grimlog-orange font-bold">{result.stats.expected_damage.toFixed(1)} dmg</span>
                              <span className="text-amber-600 font-bold">{result.stats.models_killed.toFixed(1)} kills</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm font-mono">{result.weapon}</span>
                    <div className="flex gap-4 font-mono">
                      <span className="text-grimlog-orange font-bold">{result.stats.expected_damage.toFixed(1)} dmg</span>
                      <span className="text-amber-600 font-bold">{result.stats.models_killed.toFixed(1)} kills</span>
                    </div>
                  </div>
                )}
                
                {/* Expand Indicator */}
                <div className="text-center mt-2 text-gray-400 text-xs">
                  {expandedId === result.id ? '▲ Less' : '▼ Details'}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === result.id && (
                <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-3">
                  {/* Extra Attacks Info - Show at top if present */}
                  {result.extraAttacks && result.extraAttacks.length > 0 && (
                    <div className="bg-green-50 border border-green-300 p-2 rounded">
                      <div className="text-green-700 text-xs font-bold uppercase mb-1">+ Extra Attacks (added to all weapons)</div>
                      <div className="space-y-1 text-xs font-mono">
                        {result.extraAttacks.map((ea, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div>
                              <span className="text-green-600">{ea.weapon}</span>
                              <span className="text-gray-500 ml-2">({ea.stats})</span>
                              <span className="text-gray-500 ml-2">• {ea.attacks} attacks</span>
                            </div>
                            <span className="text-amber-600 font-bold">+{ea.damage.toFixed(1)} dmg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weapon Comparison */}
                  {result.allWeapons && result.allWeapons.length > 0 && (
                    <div className="bg-white border border-grimlog-orange p-2 rounded">
                      <div className="text-grimlog-orange text-xs font-bold uppercase mb-2">
                        {result.allWeapons.length > 1 ? 'Choose Your Weapon' : 'Weapon Stats'}
                      </div>
                      <div className="space-y-2">
                        {result.allWeapons.map((ws, i) => {
                          const isBest = ws.weapon === result.weapon;
                          const hasExtraAttacks = result.extraAttacks && result.extraAttacks.length > 0;
                          const extraDamage = hasExtraAttacks 
                            ? result.extraAttacks!.reduce((sum, ea) => sum + ea.damage, 0) 
                            : 0;
                          
                          return (
                            <div 
                              key={i} 
                              className={`p-2 border rounded ${isBest ? 'border-grimlog-orange bg-orange-50' : 'border-gray-300'}`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <div className="text-sm font-mono">
                                  <span className={isBest ? 'text-grimlog-orange' : 'text-gray-700'}>
                                    {ws.weapon}
                                  </span>
                                  {isBest && result.allWeapons!.length > 1 && <span className="ml-2 text-yellow-500">⭐ BEST</span>}
                                </div>
                              </div>
                              
                              {/* Weapon stats line */}
                              <div className="text-gray-500 text-xs font-mono mb-2">
                                {ws.weaponStats} • {ws.attacks.toFixed(0)} attacks @ {ws.skill}
                              </div>
                              
                              {/* Damage breakdown */}
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div className="bg-gray-100 p-1.5 border border-gray-200 rounded">
                                  <div className="text-gray-500 text-[10px] uppercase">Weapon Only</div>
                                  <div className="text-amber-600">
                                    {ws.weaponOnlyDamage.toFixed(1)} dmg / {ws.weaponOnlyKills.toFixed(1)} kills
                                  </div>
                                </div>
                                {hasExtraAttacks && (
                                  <div className="bg-orange-50 p-1.5 border border-grimlog-orange rounded">
                                    <div className="text-grimlog-orange text-[10px] uppercase">+ Extra = Total</div>
                                    <div className="text-grimlog-orange font-bold">
                                      {ws.stats.expected_damage.toFixed(1)} dmg / {ws.stats.models_killed.toFixed(1)} kills
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stats Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2 border border-gray-200 rounded">
                      <div className="text-green-600 font-bold font-mono">{result.stats.expected_hits.toFixed(1)}</div>
                      <div className="text-gray-500 text-xs">Hits</div>
                    </div>
                    <div className="bg-white p-2 border border-gray-200 rounded">
                      <div className="text-green-600 font-bold font-mono">{result.stats.expected_wounds.toFixed(1)}</div>
                      <div className="text-gray-500 text-xs">Wounds</div>
                    </div>
                    <div className="bg-white p-2 border border-gray-200 rounded">
                      <div className="text-green-600 font-bold font-mono">{result.stats.expected_unsaved.toFixed(1)}</div>
                      <div className="text-gray-500 text-xs">Unsaved</div>
                    </div>
                  </div>

                  {/* Mortal Wounds */}
                  {result.stats.mortal_wounds > 0 && (
                    <div className="bg-red-50 border border-red-300 p-2 text-center rounded">
                      <span className="text-red-600 font-bold">{result.stats.mortal_wounds.toFixed(1)}</span>
                      <span className="text-red-600 text-xs ml-2">Mortal Wounds</span>
                    </div>
                  )}

                  {/* Roll Rates */}
                  <div className="bg-white border border-gray-200 p-2 rounded">
                    <div className="text-green-600 text-xs font-bold uppercase mb-2">Roll Rates</div>
                    <div className="grid grid-cols-4 gap-1 text-xs font-mono text-gray-600">
                      <div>Hit: {(result.stats.hit_rate * 100).toFixed(0)}%</div>
                      <div>Wound: {(result.stats.wound_rate * 100).toFixed(0)}%</div>
                      <div>Save: {(result.stats.save_rate * 100).toFixed(0)}%</div>
                      <div>Crit: {(result.stats.crit_hit_chance * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Modifiers */}
                  {result.modifiers.length > 0 && (
                    <div className="bg-white border border-gray-200 p-2 rounded">
                      <div className="text-amber-600 text-xs font-bold uppercase mb-1">Active Modifiers</div>
                      <div className="flex flex-wrap gap-1">
                        {result.modifiers.map((mod, i) => (
                          <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-grimlog-slate-dark border-t border-grimlog-steel px-4 py-3 flex justify-between items-center flex-shrink-0">
          <button
            onClick={onClearAll}
            className="px-4 py-2 text-gray-500 hover:text-red-600 text-sm font-mono uppercase tracking-wider transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold tracking-wider uppercase text-sm transition-all rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
