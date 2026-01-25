'use client';

import { useMemo } from 'react';

// Tier configuration with colors matching Grimlog aesthetic
const TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string; glowColor: string; value: number }> = {
  S: { label: 'S-TIER', color: 'text-amber-400', bgColor: 'bg-amber-500', glowColor: 'shadow-amber-500/50', value: 6 },
  A: { label: 'A-TIER', color: 'text-green-400', bgColor: 'bg-green-500', glowColor: 'shadow-green-500/50', value: 5 },
  B: { label: 'B-TIER', color: 'text-blue-400', bgColor: 'bg-blue-500', glowColor: 'shadow-blue-500/50', value: 4 },
  C: { label: 'C-TIER', color: 'text-slate-400', bgColor: 'bg-slate-500', glowColor: 'shadow-slate-500/50', value: 3 },
  D: { label: 'D-TIER', color: 'text-orange-400', bgColor: 'bg-orange-500', glowColor: 'shadow-orange-500/50', value: 2 },
  F: { label: 'F-TIER', color: 'text-red-400', bgColor: 'bg-red-500', glowColor: 'shadow-red-500/50', value: 1 },
};

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

interface UnitTierData {
  unitName: string;
  tier?: string;
  points: number;
}

interface TierDistributionChartProps {
  units: UnitTierData[];
  onTierClick?: (tier: string) => void;
  selectedTier?: string | null;
}

export function TierDistributionChart({ units, onTierClick, selectedTier }: TierDistributionChartProps) {
  // Calculate tier distribution
  const { tierCounts, totalWithTier, avgTier, metaViablePercent, tierBreakdown } = useMemo(() => {
    const counts: Record<string, { count: number; points: number; units: string[] }> = {};
    
    // Initialize all tiers
    TIER_ORDER.forEach(tier => {
      counts[tier] = { count: 0, points: 0, units: [] };
    });
    
    let withTier = 0;
    let tierValueSum = 0;
    
    units.forEach(unit => {
      if (unit.tier && TIER_CONFIG[unit.tier]) {
        counts[unit.tier].count++;
        counts[unit.tier].points += unit.points;
        counts[unit.tier].units.push(unit.unitName);
        withTier++;
        tierValueSum += TIER_CONFIG[unit.tier].value;
      }
    });
    
    // Calculate average tier
    const avgValue = withTier > 0 ? tierValueSum / withTier : 0;
    let avgTierLabel = 'N/A';
    if (avgValue >= 5.5) avgTierLabel = 'S';
    else if (avgValue >= 4.5) avgTierLabel = 'A+';
    else if (avgValue >= 4) avgTierLabel = 'A';
    else if (avgValue >= 3.5) avgTierLabel = 'A-';
    else if (avgValue >= 3) avgTierLabel = 'B+';
    else if (avgValue >= 2.5) avgTierLabel = 'B';
    else if (avgValue >= 2) avgTierLabel = 'C';
    else if (avgValue >= 1.5) avgTierLabel = 'D';
    else if (avgValue > 0) avgTierLabel = 'F';
    
    // Meta-viable = S, A, or B tier
    const metaViable = (counts['S'].count + counts['A'].count + counts['B'].count);
    const metaPercent = withTier > 0 ? Math.round((metaViable / withTier) * 100) : 0;
    
    return {
      tierCounts: counts,
      totalWithTier: withTier,
      avgTier: avgTierLabel,
      metaViablePercent: metaPercent,
      tierBreakdown: TIER_ORDER.map(tier => ({
        tier,
        ...counts[tier],
        config: TIER_CONFIG[tier],
      })).filter(t => t.count > 0),
    };
  }, [units]);

  const maxCount = Math.max(...Object.values(tierCounts).map(t => t.count), 1);
  const unratedCount = units.length - totalWithTier;

  if (totalWithTier === 0) {
    return (
      <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-6">
        <h3 className="text-grimlog-orange font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-xl">📊</span> Army Tier Distribution
        </h3>
        <div className="text-center py-8">
          <p className="text-grimlog-steel text-sm">No competitive tier data available for units in this list.</p>
          <p className="text-grimlog-steel/60 text-xs mt-2">
            Tier data is populated from competitive content creator insights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-grimlog-orange font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-xl">📊</span> Army Tier Distribution
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-grimlog-steel">Avg:</span>
            <span className={`font-bold ${
              avgTier.startsWith('S') ? 'text-amber-400' :
              avgTier.startsWith('A') ? 'text-green-400' :
              avgTier.startsWith('B') ? 'text-blue-400' :
              avgTier.startsWith('C') ? 'text-slate-400' :
              'text-orange-400'
            }`}>
              {avgTier}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-grimlog-steel">Meta-Viable:</span>
            <span className={`font-bold ${
              metaViablePercent >= 70 ? 'text-green-400' :
              metaViablePercent >= 50 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {metaViablePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3">
        {tierBreakdown.map(({ tier, count, points, units: unitNames, config }, index) => {
          const barWidth = (count / maxCount) * 100;
          const isSelected = selectedTier === tier;
          
          return (
            <button
              key={tier}
              onClick={() => onTierClick?.(tier)}
              className={`w-full group transition-all duration-200 ${
                onTierClick ? 'cursor-pointer hover:bg-grimlog-steel/10' : ''
              } ${isSelected ? 'bg-grimlog-steel/20' : ''} rounded p-2 -m-2`}
            >
              <div className="flex items-center gap-4">
                {/* Tier Label */}
                <div className={`w-16 text-left font-bold text-sm ${config.color}`}>
                  {config.label}
                </div>
                
                {/* Bar Container */}
                <div className="flex-1 h-8 bg-grimlog-black/50 rounded overflow-hidden relative">
                  {/* Animated Bar */}
                  <div
                    className={`h-full ${config.bgColor} transition-all duration-700 ease-out relative overflow-hidden`}
                    style={{ 
                      width: `${barWidth}%`,
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
                  </div>
                  
                  {/* Count overlay */}
                  <div className="absolute inset-y-0 left-2 flex items-center">
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                      {count}
                    </span>
                  </div>
                </div>
                
                {/* Points */}
                <div className="w-20 text-right">
                  <span className="text-grimlog-amber font-mono text-sm">{points}pts</span>
                </div>
              </div>
              
              {/* Unit names on hover/select */}
              {(isSelected || count <= 3) && unitNames.length > 0 && (
                <div className="mt-2 ml-20 text-xs text-grimlog-steel">
                  {unitNames.join(', ')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t border-grimlog-steel/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="text-grimlog-steel">
            <span className="text-grimlog-green font-bold">{totalWithTier}</span> units with tier data
          </span>
          {unratedCount > 0 && (
            <span className="text-grimlog-steel/60">
              ({unratedCount} unrated)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {TIER_ORDER.map(tier => (
              <div
                key={tier}
                className={`w-4 h-4 rounded-sm ${TIER_CONFIG[tier].bgColor} ${
                  tierCounts[tier].count > 0 ? 'opacity-100' : 'opacity-20'
                }`}
                title={`${tier}: ${tierCounts[tier].count} units`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TierDistributionChart;

