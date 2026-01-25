'use client';

import { useState } from 'react';
import { 
  UnitCompetitiveContextSummary, 
  FactionCompetitiveContextSummary 
} from '@/lib/dossierAnalysis';

// ============================================
// UNIT COMPETITIVE CONTEXT CARD
// ============================================

interface UnitContextProps {
  unitName: string;
  context: UnitCompetitiveContextSummary;
}

export function UnitCompetitiveCard({ unitName, context }: UnitContextProps) {
  const [expanded, setExpanded] = useState(false);

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'S': return 'text-amber-400 bg-amber-500/20 border-amber-500/50';
      case 'A': return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'B': return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
      case 'C': return 'text-slate-400 bg-slate-500/20 border-slate-500/50';
      case 'D': return 'text-orange-400 bg-orange-500/20 border-orange-500/50';
      case 'F': return 'text-red-400 bg-red-500/20 border-red-500/50';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/50';
    }
  };

  if (!context.tierRank && context.bestTargets.length === 0 && !context.playstyleNotes) {
    return null;
  }

  return (
    <div className="bg-grimlog-darkGray border border-grimlog-steel rounded">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-grimlog-steel/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-grimlog-green font-bold">{unitName}</span>
          {context.tierRank && (
            <span className={`px-2 py-0.5 rounded border text-xs font-bold ${getTierColor(context.tierRank)}`}>
              {context.tierRank}-TIER
            </span>
          )}
          {context.hasStaleData && (
            <span className="text-yellow-500 text-xs" title="Some insights may be outdated">
              ⚠️ Stale
            </span>
          )}
        </div>
        <span className="text-grimlog-steel">{expanded ? '−' : '+'}</span>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 border-t border-grimlog-steel space-y-3">
          {context.tierReasoning && (
            <div>
              <p className="text-grimlog-amber text-sm">{context.tierReasoning}</p>
              <p className="text-grimlog-steel text-xs mt-1">
                Confidence: {context.tierConfidence}%
              </p>
            </div>
          )}

          {context.bestTargets.length > 0 && (
            <div>
              <h4 className="text-grimlog-green text-xs font-bold uppercase mb-1">Best Against</h4>
              <div className="flex flex-wrap gap-1">
                {context.bestTargets.map((target, i) => (
                  <span key={i} className="px-2 py-0.5 bg-grimlog-green/20 text-grimlog-green rounded text-xs">
                    {target}
                  </span>
                ))}
              </div>
            </div>
          )}

          {context.counters.length > 0 && (
            <div>
              <h4 className="text-grimlog-red text-xs font-bold uppercase mb-1">Countered By</h4>
              <div className="flex flex-wrap gap-1">
                {context.counters.map((counter, i) => (
                  <span key={i} className="px-2 py-0.5 bg-grimlog-red/20 text-grimlog-red rounded text-xs">
                    {counter}
                  </span>
                ))}
              </div>
            </div>
          )}

          {context.synergies.length > 0 && (
            <div>
              <h4 className="text-grimlog-blue text-xs font-bold uppercase mb-1">Synergizes With</h4>
              <div className="flex flex-wrap gap-1">
                {context.synergies.map((synergy, i) => {
                  // Handle both old string format and new structured format
                  const isStructured = typeof synergy === 'object' && synergy !== null && 'unit' in synergy;
                  const displayName = isStructured ? (synergy as { unit: string; why: string }).unit : synergy;
                  const tooltip = isStructured ? (synergy as { unit: string; why: string }).why : undefined;
                  return (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-grimlog-blue/20 text-grimlog-blue rounded text-xs"
                      title={tooltip}
                    >
                      {displayName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {context.playstyleNotes && (
            <div>
              <h4 className="text-grimlog-amber text-xs font-bold uppercase mb-1">How To Play</h4>
              <p className="text-grimlog-steel text-sm">{context.playstyleNotes}</p>
            </div>
          )}

          {/* Sources */}
          {context.sources.length > 0 && (
            <div className="pt-2 border-t border-grimlog-steel/50">
              <p className="text-grimlog-steel text-xs">
                Sources: {context.sources.map(s => s.authorName).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// FACTION COMPETITIVE CONTEXT CARD
// ============================================

interface FactionContextProps {
  factionName: string;
  context: FactionCompetitiveContextSummary;
}

export function FactionCompetitiveCard({ factionName, context }: FactionContextProps) {
  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'S': return 'text-amber-400';
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-slate-400';
      case 'D': return 'text-orange-400';
      case 'F': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="bg-grimlog-darkGray border border-grimlog-orange/30 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-grimlog-orange font-bold text-lg">{factionName} Meta Position</h3>
          {context.metaTier && (
            <span className={`text-2xl font-bold ${getTierColor(context.metaTier)}`}>
              {context.metaTier}-TIER
            </span>
          )}
        </div>
        {context.hasStaleData && (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded">
            ⚠️ Data may be outdated
          </span>
        )}
      </div>

      {context.metaTierReasoning && (
        <p className="text-grimlog-green text-sm mb-4">{context.metaTierReasoning}</p>
      )}

      {/* Playstyle */}
      {context.playstyleArchetype && (
        <div className="mb-4">
          <h4 className="text-grimlog-steel text-xs font-bold uppercase mb-1">Playstyle</h4>
          <p className="text-grimlog-amber capitalize">
            {context.playstyleArchetype.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Strengths & Weaknesses Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {context.strengths.length > 0 && (
          <div>
            <h4 className="text-grimlog-green text-xs font-bold uppercase mb-2">✓ Strengths</h4>
            <ul className="space-y-1">
              {context.strengths.slice(0, 4).map((s, i) => (
                <li key={i} className="text-grimlog-steel text-sm">• {s}</li>
              ))}
            </ul>
          </div>
        )}

        {context.weaknesses.length > 0 && (
          <div>
            <h4 className="text-grimlog-red text-xs font-bold uppercase mb-2">✗ Weaknesses</h4>
            <ul className="space-y-1">
              {context.weaknesses.slice(0, 4).map((w, i) => (
                <li key={i} className="text-grimlog-steel text-sm">• {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommended Detachments */}
      {context.recommendedDetachments.length > 0 && (
        <div className="mb-4">
          <h4 className="text-grimlog-amber text-xs font-bold uppercase mb-2">
            Recommended Detachments
          </h4>
          <div className="space-y-2">
            {context.recommendedDetachments.slice(0, 2).map((det, i) => (
              <div key={i} className="bg-grimlog-black/50 p-2 rounded">
                <span className="text-grimlog-green font-bold text-sm">{det.name}</span>
                <p className="text-grimlog-steel text-xs mt-1">{det.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Must-Take & Avoid */}
      <div className="grid grid-cols-2 gap-4">
        {context.mustTakeUnits.length > 0 && (
          <div>
            <h4 className="text-grimlog-green text-xs font-bold uppercase mb-2">⭐ Must-Take Units</h4>
            <div className="flex flex-wrap gap-1">
              {context.mustTakeUnits.slice(0, 5).map((unit, i) => (
                <span key={i} className="px-2 py-0.5 bg-grimlog-green/20 text-grimlog-green rounded text-xs">
                  {unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {context.avoidUnits.length > 0 && (
          <div>
            <h4 className="text-grimlog-red text-xs font-bold uppercase mb-2">❌ Avoid</h4>
            <div className="flex flex-wrap gap-1">
              {context.avoidUnits.slice(0, 5).map((unit, i) => (
                <span key={i} className="px-2 py-0.5 bg-grimlog-red/20 text-grimlog-red rounded text-xs">
                  {unit}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sources */}
      {context.sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-grimlog-steel/30">
          <p className="text-grimlog-steel text-xs">
            Based on insights from: {context.sources.map(s => s.authorName).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPETITIVE CONTEXT SECTION (Full Section)
// ============================================

interface CompetitiveContextSectionProps {
  factionContext: FactionCompetitiveContextSummary | null;
  unitContexts: Map<string, { context: UnitCompetitiveContextSummary; unitName: string }>;
  faction: string;
}

export function CompetitiveContextSection({
  factionContext,
  unitContexts,
  faction,
}: CompetitiveContextSectionProps) {
  const hasAnyContext = factionContext || unitContexts.size > 0;

  if (!hasAnyContext) {
    return null;
  }

  // Convert Map to array for rendering
  const unitContextArray = Array.from(unitContexts.entries()).map(([name, data]) => ({
    unitName: name,
    context: data.context,
  }));

  // Filter to only units with meaningful context
  const meaningfulUnits = unitContextArray.filter(
    u => u.context.tierRank || u.context.bestTargets.length > 0 || u.context.playstyleNotes
  );

  return (
    <div className="p-6 border-t border-grimlog-steel">
      <h2 className="text-grimlog-orange text-lg font-bold uppercase tracking-wider mb-4 border-b border-grimlog-steel pb-2">
        🎯 Competitive Insights
      </h2>
      <p className="text-grimlog-steel text-xs mb-4">
        Insights from competitive content creators. Data may vary based on game version.
      </p>

      {/* Faction Context */}
      {factionContext && (
        <div className="mb-6">
          <FactionCompetitiveCard factionName={faction} context={factionContext} />
        </div>
      )}

      {/* Unit Contexts */}
      {meaningfulUnits.length > 0 && (
        <div>
          <h3 className="text-grimlog-amber text-sm font-bold uppercase tracking-wider mb-3">
            Unit-Specific Insights ({meaningfulUnits.length} units)
          </h3>
          <div className="space-y-2">
            {meaningfulUnits.map(({ unitName, context }) => (
              <UnitCompetitiveCard key={unitName} unitName={unitName} context={context} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompetitiveContextSection;

