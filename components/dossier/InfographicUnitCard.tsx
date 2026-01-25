'use client';

import { useState } from 'react';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';

// Role configuration
const ROLE_CONFIG: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  hammer: { label: 'HAMMER', icon: '⚔️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  anvil: { label: 'ANVIL', icon: '🛡️', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  skirmisher: { label: 'SKIRMISHER', icon: '⚡', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  support: { label: 'SUPPORT', icon: '✨', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  scoring: { label: 'SCORING', icon: '🎯', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  screening: { label: 'SCREEN', icon: '📍', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
};

// Tier configuration
const TIER_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; glow: string }> = {
  S: { color: 'text-amber-300', bgColor: 'bg-amber-500', borderColor: 'border-amber-400', glow: 'shadow-amber-500/50' },
  A: { color: 'text-green-300', bgColor: 'bg-green-500', borderColor: 'border-green-400', glow: 'shadow-green-500/50' },
  B: { color: 'text-blue-300', bgColor: 'bg-blue-500', borderColor: 'border-blue-400', glow: 'shadow-blue-500/50' },
  C: { color: 'text-slate-300', bgColor: 'bg-slate-500', borderColor: 'border-slate-400', glow: 'shadow-slate-500/50' },
  D: { color: 'text-orange-300', bgColor: 'bg-orange-500', borderColor: 'border-orange-400', glow: 'shadow-orange-500/50' },
  F: { color: 'text-red-300', bgColor: 'bg-red-500', borderColor: 'border-red-400', glow: 'shadow-red-500/50' },
};

export interface InfographicUnitData {
  unitName: string;
  points: number;
  models: number;
  role?: string;
  
  // Stats
  toughness?: number;
  wounds?: number;
  save?: string;
  
  // Competitive context
  tier?: string;
  tierReasoning?: string;
  bestTargets: string[];
  counters: string[];
  synergies: string[];
  activeSynergies: string[]; // Synergies that ARE in this army list
  playstyleNotes?: string;
  deploymentTips?: string;
  
  // Damage info
  bestDamageTarget?: string;
  expectedDamage?: number;
  
  // Icon
  iconUrl?: string | null;
}

interface InfographicUnitCardProps {
  unit: InfographicUnitData;
  faction: string;
  onUnitClick?: (unitName: string) => void;
  highlighted?: boolean;
}

export function InfographicUnitCard({ unit, faction, onUnitClick, highlighted = false }: InfographicUnitCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const roleConfig = unit.role ? ROLE_CONFIG[unit.role] : ROLE_CONFIG.scoring;
  const tierConfig = unit.tier ? TIER_CONFIG[unit.tier] : null;
  const icon = getUnitIcon(unit.iconUrl, unit.unitName);
  const hasCustomIcon = isCustomIcon(icon);

  const hasCompetitiveData = unit.tier || unit.bestTargets.length > 0 || unit.synergies.length > 0;

  return (
    <div
      className={`
        relative bg-grimlog-darkGray border-2 rounded-lg overflow-hidden
        transition-all duration-300 group
        ${tierConfig ? tierConfig.borderColor : 'border-grimlog-steel'}
        ${highlighted ? 'ring-2 ring-grimlog-orange ring-offset-2 ring-offset-grimlog-black' : ''}
        ${expanded ? 'shadow-lg' : ''}
        hover:shadow-md
      `}
    >
      {/* Tier Badge - Prominent Position */}
      {tierConfig && (
        <div className={`
          absolute -top-1 -right-1 z-10 px-3 py-1.5 rounded-bl-lg rounded-tr-lg
          ${tierConfig.bgColor} shadow-lg ${tierConfig.glow}
          animate-pulse-glow
        `}>
          <span className="text-white font-black text-lg drop-shadow-md">{unit.tier}</span>
        </div>
      )}

      {/* Header Bar with gradient */}
      <div className={`
        h-1 w-full
        ${tierConfig ? tierConfig.bgColor : 'bg-grimlog-steel'}
      `} />

      {/* Main Content - Clickable Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 focus:outline-none"
      >
        <div className="flex items-start gap-3">
          {/* Unit Icon */}
          <div className="flex-shrink-0">
            {hasCustomIcon ? (
              <img
                src={icon}
                alt={unit.unitName}
                className="w-14 h-14 object-cover rounded border border-grimlog-steel/50 bg-grimlog-black"
              />
            ) : (
              <div className="w-14 h-14 rounded border border-grimlog-steel/50 bg-grimlog-black flex items-center justify-center text-3xl">
                {icon}
              </div>
            )}
          </div>

          {/* Unit Info */}
          <div className="flex-1 min-w-0">
            {/* Name and Points */}
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-grimlog-green font-bold text-base truncate">
                {unit.unitName}
              </h4>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-grimlog-amber font-mono font-bold">{unit.points}pts</span>
              <span className="text-grimlog-steel">|</span>
              <span className={`${roleConfig.color} font-bold`}>
                {roleConfig.icon} {roleConfig.label}
              </span>
              <span className="text-grimlog-steel">|</span>
              <span className="text-grimlog-steel">{unit.models} model{unit.models !== 1 ? 's' : ''}</span>
            </div>

            {/* Quick Stats */}
            {(unit.toughness || unit.wounds || unit.save) && (
              <div className="flex items-center gap-2 mt-2 text-xs text-grimlog-steel">
                {unit.toughness && <span>T{unit.toughness}</span>}
                {unit.wounds && <span>{unit.wounds}W</span>}
                {unit.save && <span>{unit.save}</span>}
              </div>
            )}
          </div>

          {/* Expand Indicator */}
          <div className="flex-shrink-0 text-grimlog-steel text-xl">
            {expanded ? '−' : '+'}
          </div>
        </div>

        {/* Active Synergies Preview (always visible if present) */}
        {unit.activeSynergies.length > 0 && !expanded && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-green-400 text-xs">🔗</span>
            <div className="flex flex-wrap gap-1">
              {unit.activeSynergies.slice(0, 3).map((syn, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnitClick?.(syn);
                  }}
                >
                  {syn}
                </span>
              ))}
              {unit.activeSynergies.length > 3 && (
                <span className="text-green-400/60 text-xs">+{unit.activeSynergies.length - 3}</span>
              )}
            </div>
          </div>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && hasCompetitiveData && (
        <div className="px-4 pb-4 space-y-4 border-t border-grimlog-steel/30 pt-4 animate-fade-in">
          {/* Tier Reasoning */}
          {unit.tierReasoning && (
            <div className="text-sm">
              <span className={`font-bold ${tierConfig?.color || 'text-grimlog-amber'}`}>
                Why {unit.tier}-Tier: 
              </span>
              <span className="text-grimlog-steel ml-1">{unit.tierReasoning}</span>
            </div>
          )}

          {/* Two Column Layout for Synergies/Counters */}
          <div className="grid grid-cols-2 gap-4">
            {/* Active Synergies */}
            {unit.activeSynergies.length > 0 && (
              <div>
                <h5 className="text-green-400 text-xs font-bold uppercase mb-2 flex items-center gap-1">
                  <span>✓</span> Synergies In List
                </h5>
                <div className="flex flex-wrap gap-1">
                  {unit.activeSynergies.map((syn, i) => (
                    <button
                      key={i}
                      onClick={() => onUnitClick?.(syn)}
                      className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors"
                    >
                      {syn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Counters */}
            {unit.counters.length > 0 && (
              <div>
                <h5 className="text-red-400 text-xs font-bold uppercase mb-2 flex items-center gap-1">
                  <span>⚠️</span> Countered By
                </h5>
                <div className="flex flex-wrap gap-1">
                  {unit.counters.slice(0, 4).map((counter, i) => (
                    <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                      {counter}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Best Targets */}
          {unit.bestTargets.length > 0 && (
            <div>
              <h5 className="text-grimlog-amber text-xs font-bold uppercase mb-2">🎯 Best Against</h5>
              <div className="flex flex-wrap gap-1">
                {unit.bestTargets.slice(0, 4).map((target, i) => (
                  <span key={i} className="px-2 py-1 bg-grimlog-amber/20 text-grimlog-amber rounded text-xs">
                    {target}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Playstyle Notes */}
          {unit.playstyleNotes && (
            <div className="p-3 bg-grimlog-black/30 rounded">
              <h5 className="text-grimlog-orange text-xs font-bold uppercase mb-1">📖 How To Play</h5>
              <p className="text-grimlog-steel text-sm">{unit.playstyleNotes}</p>
            </div>
          )}

          {/* Deployment Tips */}
          {unit.deploymentTips && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
              <h5 className="text-blue-400 text-xs font-bold uppercase mb-1">📍 Deployment</h5>
              <p className="text-grimlog-steel text-sm">{unit.deploymentTips}</p>
            </div>
          )}

          {/* Other Synergies (not in list) */}
          {unit.synergies.filter(s => !unit.activeSynergies.includes(s)).length > 0 && (
            <div className="pt-2 border-t border-grimlog-steel/20">
              <h5 className="text-grimlog-steel/60 text-xs font-bold uppercase mb-2">
                💡 Other Synergies (not in list)
              </h5>
              <div className="flex flex-wrap gap-1">
                {unit.synergies.filter(s => !unit.activeSynergies.includes(s)).slice(0, 4).map((syn, i) => (
                  <span key={i} className="px-2 py-1 bg-grimlog-steel/10 text-grimlog-steel/60 rounded text-xs">
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No competitive data message */}
      {expanded && !hasCompetitiveData && (
        <div className="px-4 pb-4 pt-2 border-t border-grimlog-steel/30 text-center">
          <p className="text-grimlog-steel/60 text-sm">
            No competitive insights available for this unit yet.
          </p>
        </div>
      )}
    </div>
  );
}

export default InfographicUnitCard;

