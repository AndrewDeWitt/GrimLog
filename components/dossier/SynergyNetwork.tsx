'use client';

import { useMemo, useState } from 'react';

// Tactical role colors for nodes
const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  hammer: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
  anvil: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  skirmisher: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400' },
  support: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
  scoring: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400' },
  screening: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-white' },
};

// Supports both old string format and new structured format
type SynergyItem = string | { unit: string; why: string };

interface UnitSynergyData {
  unitName: string;
  points: number;
  role?: string;
  synergies: SynergyItem[]; // Names of units this synergizes with (or structured objects)
  tier?: string;
}

// Helper to extract synergy name from either format
function getSynergyName(synergy: SynergyItem): string {
  return typeof synergy === 'object' && synergy !== null && 'unit' in synergy
    ? synergy.unit
    : synergy;
}

interface SynergyConnection {
  from: string;
  to: string;
  bidirectional: boolean;
}

interface SynergyNetworkProps {
  units: UnitSynergyData[];
  unitsInList: string[]; // All unit names in the army for matching
}

export function SynergyNetwork({ units, unitsInList }: SynergyNetworkProps) {
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Normalize unit names for matching (handle variations)
  const normalizeUnitName = (name: string) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/squad$/i, '')
      .replace(/pack$/i, '');
  };

  // Build synergy connections
  const { connections, activeUnits, orphanUnits, synergyStats } = useMemo(() => {
    const listNormalized = new Map<string, string>();
    unitsInList.forEach(name => {
      listNormalized.set(normalizeUnitName(name), name);
    });

    const conns: SynergyConnection[] = [];
    const connSet = new Set<string>();
    const unitsWithSynergies = new Set<string>();
    const orphans: UnitSynergyData[] = [];

    units.forEach(unit => {
      let hasSynergyInList = false;
      
      unit.synergies.forEach(synergyItem => {
        // Extract unit name from either string or structured format
        const synergyTarget = getSynergyName(synergyItem);
        // Check if synergy target is in this army list
        const normalizedTarget = normalizeUnitName(synergyTarget);
        
        // Try to find a match in the list
        let matchedUnit: string | null = null;
        
        // Direct match
        if (listNormalized.has(normalizedTarget)) {
          matchedUnit = listNormalized.get(normalizedTarget)!;
        } else {
          // Fuzzy match - check if any unit in list contains the synergy target
          for (const [normalized, original] of listNormalized.entries()) {
            if (normalized.includes(normalizedTarget) || normalizedTarget.includes(normalized)) {
              matchedUnit = original;
              break;
            }
          }
        }
        
        if (matchedUnit && matchedUnit !== unit.unitName) {
          hasSynergyInList = true;
          unitsWithSynergies.add(unit.unitName);
          unitsWithSynergies.add(matchedUnit);
          
          // Create connection key (sorted to avoid duplicates)
          const key = [unit.unitName, matchedUnit].sort().join('|||');
          
          if (!connSet.has(key)) {
            connSet.add(key);
            conns.push({
              from: unit.unitName,
              to: matchedUnit,
              bidirectional: false, // Will check later
            });
          }
        }
      });
      
      if (!hasSynergyInList && unit.synergies.length > 0) {
        orphans.push(unit);
      }
    });

    // Check for bidirectional synergies
    conns.forEach(conn => {
      const reverseExists = conns.some(c => 
        (c.from === conn.to && c.to === conn.from) ||
        (c.from === conn.from && c.to === conn.to && c !== conn)
      );
      conn.bidirectional = reverseExists;
    });

    // Calculate stats
    const stats = {
      totalConnections: conns.length,
      unitsWithSynergies: unitsWithSynergies.size,
      orphanCount: orphans.length,
      synergyDensity: units.length > 1 ? 
        Math.round((conns.length / (units.length * (units.length - 1) / 2)) * 100) : 0,
    };

    return {
      connections: conns,
      activeUnits: Array.from(unitsWithSynergies),
      orphanUnits: orphans,
      synergyStats: stats,
    };
  }, [units, unitsInList]);

  // Get unit data by name
  const getUnitData = (name: string) => units.find(u => u.unitName === name);

  // Check if unit is highlighted
  const isHighlighted = (unitName: string) => {
    if (!hoveredUnit && !selectedUnit) return true;
    const targetUnit = hoveredUnit || selectedUnit;
    if (unitName === targetUnit) return true;
    return connections.some(c => 
      (c.from === targetUnit && c.to === unitName) ||
      (c.to === targetUnit && c.from === unitName)
    );
  };

  // Get connections for a unit
  const getUnitConnections = (unitName: string) => {
    return connections.filter(c => c.from === unitName || c.to === unitName);
  };

  if (connections.length === 0) {
    return (
      <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-6">
        <h3 className="text-grimlog-orange font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-xl">🔗</span> Synergy Network
        </h3>
        <div className="text-center py-8">
          <p className="text-grimlog-steel text-sm">No active synergies detected between units in this list.</p>
          {orphanUnits.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-grimlog-amber text-xs font-bold uppercase mb-2">
                Units with synergies not in list:
              </p>
              <div className="flex flex-wrap gap-2">
                {orphanUnits.slice(0, 5).map(unit => (
                  <span key={unit.unitName} className="px-2 py-1 bg-grimlog-steel/20 rounded text-xs text-grimlog-steel">
                    {unit.unitName} → {unit.synergies.slice(0, 2).map(getSynergyName).join(', ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-grimlog-orange font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-xl">🔗</span> Synergy Network
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-grimlog-steel">
            <span className="text-grimlog-green font-bold">{synergyStats.totalConnections}</span> active synergies
          </span>
          <span className="text-grimlog-steel">
            <span className="text-grimlog-amber font-bold">{synergyStats.unitsWithSynergies}</span> connected units
          </span>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="relative min-h-[300px] bg-grimlog-black/30 rounded-lg p-4 overflow-hidden">
        {/* Connection Lines (SVG layer) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="synergyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#a8c5a0" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Unit Nodes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative" style={{ zIndex: 1 }}>
          {activeUnits.map((unitName, index) => {
            const unitData = getUnitData(unitName);
            const unitConns = getUnitConnections(unitName);
            const roleColors = unitData?.role ? ROLE_COLORS[unitData.role] : ROLE_COLORS.scoring;
            const highlighted = isHighlighted(unitName);
            const isSelected = selectedUnit === unitName;
            
            return (
              <div
                key={unitName}
                className={`
                  relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300
                  ${roleColors.bg} ${roleColors.border}
                  ${highlighted ? 'opacity-100' : 'opacity-30'}
                  ${isSelected ? 'ring-2 ring-grimlog-orange ring-offset-2 ring-offset-grimlog-darkGray' : ''}
                  hover:scale-105 hover:shadow-lg
                `}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
                onMouseEnter={() => setHoveredUnit(unitName)}
                onMouseLeave={() => setHoveredUnit(null)}
                onClick={() => setSelectedUnit(isSelected ? null : unitName)}
              >
                {/* Connection Count Badge */}
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-grimlog-orange text-grimlog-black text-xs font-bold flex items-center justify-center">
                  {unitConns.length}
                </div>
                
                {/* Unit Name */}
                <p className={`font-bold text-sm truncate ${roleColors.text}`}>
                  {unitName}
                </p>
                
                {/* Points & Role */}
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-grimlog-amber font-mono">{unitData?.points}pts</span>
                  {unitData?.role && (
                    <span className={`uppercase ${roleColors.text}`}>{unitData.role}</span>
                  )}
                </div>
                
                {/* Tier Badge */}
                {unitData?.tier && (
                  <div className={`absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-xs font-bold ${
                    unitData.tier === 'S' ? 'bg-amber-500 text-black' :
                    unitData.tier === 'A' ? 'bg-green-500 text-black' :
                    unitData.tier === 'B' ? 'bg-blue-500 text-white' :
                    'bg-slate-500 text-white'
                  }`}>
                    {unitData.tier}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Synergy Details Panel */}
        {(hoveredUnit || selectedUnit) && (
          <div className="mt-4 p-3 bg-grimlog-black/50 rounded border border-grimlog-steel">
            <p className="text-grimlog-orange font-bold text-sm mb-2">
              {hoveredUnit || selectedUnit} Synergies:
            </p>
            <div className="flex flex-wrap gap-2">
              {getUnitConnections(hoveredUnit || selectedUnit || '').map((conn, i) => {
                const otherUnit = conn.from === (hoveredUnit || selectedUnit) ? conn.to : conn.from;
                return (
                  <span 
                    key={i}
                    className="px-2 py-1 bg-grimlog-green/20 text-grimlog-green rounded text-xs flex items-center gap-1"
                  >
                    {conn.bidirectional ? '↔' : '→'} {otherUnit}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-grimlog-steel/30">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-grimlog-steel font-bold uppercase">Roles:</span>
          {Object.entries(ROLE_COLORS).map(([role, colors]) => (
            <div key={role} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${colors.bg} border ${colors.border}`} />
              <span className={colors.text}>{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Missing Synergies */}
      {orphanUnits.length > 0 && (
        <div className="mt-4 p-3 bg-grimlog-amber/10 border border-grimlog-amber/30 rounded">
          <p className="text-grimlog-amber text-xs font-bold uppercase mb-2">
            💡 Synergy Opportunities (units not in list):
          </p>
          <div className="flex flex-wrap gap-2">
            {orphanUnits.slice(0, 4).map(unit => (
              <span key={unit.unitName} className="text-xs text-grimlog-steel">
                <span className="text-grimlog-green">{unit.unitName}</span> works with{' '}
                <span className="text-grimlog-amber">{unit.synergies.slice(0, 2).map(getSynergyName).join(', ')}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SynergyNetwork;

