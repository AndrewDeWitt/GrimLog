'use client';

import { useState } from 'react';
import sampleData from '@/data/sample-dossier-response.json';

// Type the sample data
const strategicAnalysis = sampleData.strategicAnalysis;
const listSuggestions = sampleData.listSuggestions;
const spiritIconUrl = sampleData.spiritIconUrl;
const faction = sampleData.faction;
const detachment = sampleData.detachment;

// Playstyle config matching DossierReport
const PLAYSTYLE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  alpha_strike: { label: 'Alpha Strike', icon: '⚡', color: 'from-red-500 to-orange-500' },
  counterpunch: { label: 'Counterpunch', icon: '🥊', color: 'from-blue-500 to-purple-500' },
  castle: { label: 'Castle', icon: '🏰', color: 'from-gray-500 to-slate-500' },
  skirmisher: { label: 'Skirmisher', icon: '🏃', color: 'from-green-500 to-teal-500' },
  grinder: { label: 'Grinder', icon: '⚙️', color: 'from-amber-500 to-yellow-500' },
  glass_cannon: { label: 'Glass Cannon', icon: '💎', color: 'from-pink-500 to-red-500' },
  none: { label: 'None', icon: '', color: 'from-gray-400 to-gray-500' },
};

interface DossierSamplePreviewProps {
  onGenerateClick: () => void;
  ctaLabel?: string;
  ctaVariant?: 'orange' | 'green';
}

export function DossierSamplePreview({ onGenerateClick, ctaLabel = '⚔ Generate Your Own Dossier', ctaVariant = 'orange' }: DossierSamplePreviewProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('spirit');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const viralInsights = strategicAnalysis.viralInsights;
  const primaryStyle = viralInsights.playstyleBlend.primary.style;
  const secondaryStyle = viralInsights.playstyleBlend.secondary?.style;

  return (
    <section className="py-6 md:py-6 bg-grimlog-darkGray">
      <div className="container mx-auto px-2 md:px-4 max-w-5xl">
        {/* Section Header */}
        <div className="text-center mb-6 md:mb-10 px-2">
          <h2 className="text-xl md:text-3xl font-bold text-grimlog-orange tracking-wider uppercase mb-2">
            Sample Tactical Dossier
          </h2>
          <p className="text-grimlog-light-steel font-mono text-sm md:text-sm max-w-2xl mx-auto">
            Real AI output. Tap any section to expand.
          </p>
        </div>

        {/* Sample Dossier - matches DossierReport styling */}
        <div className="bg-grimlog-black border border-grimlog-steel md:border-2 relative overflow-hidden">
          {/* Sample Badge */}
          <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-grimlog-amber text-grimlog-black text-xs font-bold uppercase tracking-wider rounded-sm">
            Sample
          </div>

          {/* Army Spirit Section - Always visible hero */}
          <div className="relative overflow-hidden border-b-2 md:border-b-4 border-grimlog-orange">
            <div className="absolute inset-0 bg-gradient-to-br from-grimlog-black via-grimlog-darkGray to-grimlog-black" />
            <div className="absolute inset-0 bg-gradient-to-t from-grimlog-orange/5 to-transparent" />
            
            <div className="relative p-4 md:p-6">
              <div className="flex flex-col items-center gap-4 md:gap-6">
                {/* Spirit Icon */}
                <div className="flex-shrink-0">
                  <div className="relative w-28 h-28 md:w-36 md:h-36">
                    <img
                      src={spiritIconUrl}
                      alt={viralInsights.tagline}
                      className="w-full h-full object-contain rounded-lg border-2 border-grimlog-orange shadow-lg shadow-grimlog-orange/20"
                    />
                  </div>
                </div>

                {/* Army Identity */}
                <div className="flex-1 text-center">
                  <h3 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-grimlog-orange via-grimlog-amber to-grimlog-orange tracking-wide uppercase">
                    {viralInsights.tagline}
                  </h3>
                  <p className="text-grimlog-green text-sm md:text-base font-bold mt-1">
                    {faction} • {detachment}
                  </p>
                  <p className="text-grimlog-light-steel text-sm md:text-sm italic mt-2 max-w-lg mx-auto">
                    &ldquo;{viralInsights.spiritDescription}&rdquo;
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs md:text-sm">
                    <span className="px-2 py-1 bg-grimlog-orange/10 border border-grimlog-orange/30 rounded text-grimlog-orange font-mono">
                      2000 PTS
                    </span>
                    <span className="px-2 py-1 bg-grimlog-steel/10 border border-grimlog-steel/30 rounded text-grimlog-light-steel font-mono">
                      12 UNITS
                    </span>
                    <span className="px-2 py-1 bg-grimlog-steel/10 border border-grimlog-steel/30 rounded text-grimlog-light-steel font-mono">
                      50 MODELS
                    </span>
                  </div>
                </div>
              </div>

              {/* Playstyle & Combat Spectrum */}
              <div className="mt-4 grid grid-cols-1 gap-3">
                {/* Playstyle */}
                <div className="bg-grimlog-black/50 border border-grimlog-steel rounded p-3">
                  <h4 className="text-grimlog-orange text-xs md:text-sm font-bold uppercase tracking-wider mb-2">Playstyle</h4>
                  
                  {/* Primary */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base md:text-lg">{PLAYSTYLE_CONFIG[primaryStyle]?.icon || '⚔️'}</span>
                        <span className="text-white font-bold text-sm md:text-sm">{PLAYSTYLE_CONFIG[primaryStyle]?.label || primaryStyle}</span>
                      </div>
                      <span className="text-grimlog-orange font-bold text-sm md:text-sm">{viralInsights.playstyleBlend.primary.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-grimlog-darkGray rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${PLAYSTYLE_CONFIG[primaryStyle]?.color || 'from-grimlog-orange to-grimlog-amber'}`}
                        style={{ width: `${viralInsights.playstyleBlend.primary.percentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Secondary */}
                  {secondaryStyle && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm md:text-base">{PLAYSTYLE_CONFIG[secondaryStyle]?.icon || '⚔️'}</span>
                          <span className="text-grimlog-light-steel font-bold text-sm">{PLAYSTYLE_CONFIG[secondaryStyle]?.label || secondaryStyle}</span>
                        </div>
                        <span className="text-grimlog-amber font-bold text-sm">{viralInsights.playstyleBlend.secondary?.percentage}%</span>
                      </div>
                      <div className="h-1 bg-grimlog-darkGray rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${PLAYSTYLE_CONFIG[secondaryStyle]?.color || 'from-grimlog-steel to-grimlog-amber'} opacity-70`}
                          style={{ width: `${viralInsights.playstyleBlend.secondary?.percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Combat Spectrum */}
                <div className="bg-grimlog-black/50 border border-grimlog-steel rounded p-3">
                  <h4 className="text-grimlog-orange text-xs md:text-sm font-bold uppercase tracking-wider mb-2">Combat Focus</h4>
                  <div className="flex items-center justify-between text-xs md:text-sm mb-1.5">
                    <span className="text-red-400 font-bold">⚔️ MELEE</span>
                    <span className="text-blue-400 font-bold">🎯 SHOOTING</span>
                  </div>
                  <div className="relative h-2 bg-gradient-to-r from-red-500/20 via-grimlog-darkGray to-blue-500/20 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow-lg transform -translate-x-1/2"
                      style={{ left: `${viralInsights.combatSpectrum}%` }}
                    />
                  </div>
                  <p className="text-center text-grimlog-light-steel text-xs md:text-sm mt-1.5">
                    {viralInsights.combatSpectrum <= 30 ? 'Melee-focused army' :
                     viralInsights.combatSpectrum >= 70 ? 'Shooting-focused army' :
                     'Balanced combat approach'}
                  </p>
                </div>
              </div>

              {/* Army Quirks - full width, no truncation */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {viralInsights.funStats.slice(0, 2).map((stat, i) => (
                  <div key={i} className="bg-grimlog-darkGray/80 border border-grimlog-steel/50 rounded p-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-grimlog-black/30 border border-grimlog-steel/40 text-xl leading-none shrink-0">
                        {stat.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-grimlog-light-steel text-sm font-mono leading-tight break-words">
                            {stat.name}
                        </div>
                        <div
                          className="mt-2 inline-flex max-w-full items-center rounded-md border border-grimlog-amber/30 bg-grimlog-amber/10 px-2 py-1"
                          title={stat.value}
                        >
                          <div className="text-grimlog-amber font-bold text-base leading-none break-words">
                            {stat.value}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div className="divide-y divide-grimlog-steel/30">
            {/* Strategic Assessment */}
            <CollapsibleSection
              title="Strategic Assessment"
              icon="📋"
              isExpanded={expandedSection === 'assessment'}
              onToggle={() => toggleSection('assessment')}
            >
              <div className="bg-gradient-to-r from-grimlog-darkGray to-grimlog-black p-3 md:p-4 rounded">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-grimlog-orange text-grimlog-black text-xs font-bold uppercase">
                    {strategicAnalysis.armyArchetype.primary.replace(/_/g, ' ')}
                  </span>
                  <span className="px-2 py-0.5 bg-grimlog-amber text-grimlog-black text-xs font-bold uppercase">
                    {strategicAnalysis.armyArchetype.secondary.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-grimlog-green text-sm md:text-sm leading-relaxed">
                  {strategicAnalysis.executiveSummary}
                </p>
              </div>
            </CollapsibleSection>

            {/* Strengths & Weaknesses */}
            <CollapsibleSection
              title="Strengths & Weaknesses"
              icon="⚡"
              isExpanded={expandedSection === 'strengths'}
              onToggle={() => toggleSection('strengths')}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-4">
                  <h5 className="text-green-400 font-bold uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                    <span>✓</span> Strengths
                  </h5>
                  <ul className="space-y-2">
                    {strategicAnalysis.strategicStrengths.slice(0, 3).map((s, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-green-300 font-bold">{s.title}</span>
                        {s.relevantUnits?.length > 0 && (
                          <span className="text-grimlog-light-steel/70 text-xs ml-2">
                            ({s.relevantUnits.slice(0, 2).join(', ')})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
                  <h5 className="text-red-400 font-bold uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                    <span>⚠</span> Weaknesses
                  </h5>
                  <ul className="space-y-2">
                    {strategicAnalysis.strategicWeaknesses.slice(0, 3).map((w, i) => (
                      <li key={i} className="text-sm">
                        <span className={`font-bold ${
                          w.severity === 'critical' ? 'text-red-400' :
                          w.severity === 'major' ? 'text-orange-400' : 'text-amber-400'
                        }`}>{w.title}</span>
                        <span className="text-grimlog-light-steel/70 text-xs ml-2 capitalize">({w.severity})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CollapsibleSection>

            {/* Matchups */}
            <CollapsibleSection
              title="Matchup Analysis"
              icon="🎯"
              isExpanded={expandedSection === 'matchups'}
              onToggle={() => toggleSection('matchups')}
            >
              <div className="space-y-3">
                {strategicAnalysis.matchupConsiderations.slice(0, 3).map((m, i) => (
                  <div key={i} className="flex items-start gap-3 bg-grimlog-darkGray/50 p-3 rounded">
                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase flex-shrink-0 ${
                      m.matchupRating.includes('favorable') ? 'bg-green-500/20 text-green-400' :
                      m.matchupRating.includes('unfavorable') ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {m.matchupRating.replace(/_/g, ' ')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-grimlog-orange font-bold text-sm capitalize">
                        vs {m.opponentArchetype.replace(/_/g, ' ')}
                      </div>
                      <p className="text-grimlog-light-steel text-sm mt-1">{m.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Unit Summaries */}
            <CollapsibleSection
              title="Unit Summaries"
              icon="⚔️"
              isExpanded={expandedSection === 'units'}
              onToggle={() => toggleSection('units')}
            >
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(strategicAnalysis.unitTacticalSummaries).slice(0, 3).map(([unitName, summary], i) => {
                  const roleData = strategicAnalysis.unitRoleAssignments[unitName as keyof typeof strategicAnalysis.unitRoleAssignments];
                  return (
                    <div key={i} className="bg-grimlog-darkGray border border-grimlog-steel/50 rounded p-2 md:p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-grimlog-orange font-bold text-xs md:text-sm">{unitName}</span>
                        {roleData && (
                          <span className="text-grimlog-amber text-[10px] md:text-xs uppercase">{roleData.role}</span>
                        )}
                      </div>
                      <p className="text-grimlog-light-steel text-sm md:text-sm leading-relaxed">
                        {summary}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-grimlog-light-steel/70 text-xs md:text-sm text-center mt-2 font-mono">
                + {Object.keys(strategicAnalysis.unitTacticalSummaries).length - 3} more units in full report
              </p>
            </CollapsibleSection>

            {/* List Suggestions Preview */}
            <CollapsibleSection
              title="List Improvements"
              icon="🔧"
              isExpanded={expandedSection === 'suggestions'}
              onToggle={() => toggleSection('suggestions')}
            >
              <div className="space-y-4">
                {listSuggestions.slice(0, 1).map((suggestion, i) => (
                  <div key={i} className="bg-grimlog-darkGray/50 border border-grimlog-steel/50 rounded p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        suggestion.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        suggestion.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {suggestion.priority} Priority
                      </span>
                      <span className="text-grimlog-light-steel/70 text-xs uppercase">{suggestion.type}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {/* Remove */}
                      <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                        <div className="text-red-400 text-xs font-bold mb-1">REMOVE</div>
                        {suggestion.removeUnits.map((u, j) => (
                          <div key={j} className="text-grimlog-light-steel text-xs">
                            {u.name} <span className="text-red-400">-{u.points}pts</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Add */}
                      <div className="bg-green-500/5 border border-green-500/20 rounded p-2">
                        <div className="text-green-400 text-xs font-bold mb-1">ADD</div>
                        {suggestion.addUnits.map((u, j) => (
                          <div key={j} className="text-grimlog-light-steel text-xs">
                            {u.name} <span className="text-green-400">+{u.points}pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-grimlog-amber text-xs italic">
                      Addresses: {suggestion.addressesGap}
                    </p>
                  </div>
                ))}
                <p className="text-grimlog-light-steel/70 text-sm text-center font-mono">
                  Full report includes {listSuggestions.length} improvement options with synergy analysis
                </p>
              </div>
            </CollapsibleSection>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-6 md:mt-10">
          <button
            onClick={onGenerateClick}
            className={`w-full md:w-auto px-6 md:px-8 py-4 font-bold text-base md:text-lg uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] min-h-[56px] btn-depth-lg ${
              ctaVariant === 'green' 
                ? 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/50' 
                : 'bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black'
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  icon, 
  isExpanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  icon: string; 
  isExpanded: boolean; 
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-grimlog-darkGray/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="text-grimlog-orange font-bold uppercase tracking-wider text-sm">
            {title}
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-grimlog-light-steel/80 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default DossierSamplePreview;
