'use client';

import { useMemo } from 'react';

// Meta archetype definitions
const META_ARCHETYPES = [
  { id: 'horde', label: 'Horde', icon: '🐀', description: 'High model count armies (Orks, Tyranids, Guard)' },
  { id: 'elite', label: 'Elite', icon: '⚔️', description: 'Low model count, high quality (Custodes, Knights)' },
  { id: 'vehicle', label: 'Vehicle', icon: '🚗', description: 'Vehicle-heavy lists (Tank spam, Dread armies)' },
  { id: 'monster', label: 'Monster', icon: '🦖', description: 'Monster-heavy (Tyranid monsters, Greater Daemons)' },
  { id: 'shooting', label: 'Gunline', icon: '🎯', description: 'Ranged-focused armies (Tau, Guard)' },
  { id: 'melee', label: 'Melee Rush', icon: '⚡', description: 'Fast melee armies (World Eaters, GSC)' },
];

// Keywords that indicate good/bad matchups
const MATCHUP_KEYWORDS: Record<string, { good: string[]; bad: string[] }> = {
  horde: {
    good: ['blast', 'torrent', 'devastating wounds', 'high volume', 'flamer', 'lots of attacks', 'anti-infantry'],
    bad: ['single target', 'low attacks', 'high damage per shot'],
  },
  elite: {
    good: ['high ap', 'damage 2+', 'anti-elite', 'mortal wounds', 'dev wounds'],
    bad: ['volume fire', 'damage 1', 'low ap'],
  },
  vehicle: {
    good: ['melta', 'anti-vehicle', 'anti-tank', 'high strength', 'damage 3+', 'lance'],
    bad: ['anti-infantry', 'low strength', 'damage 1'],
  },
  monster: {
    good: ['anti-monster', 'high damage', 'mortal wounds', 'melta'],
    bad: ['low damage', 'anti-infantry'],
  },
  shooting: {
    good: ['deep strike', 'infiltrate', 'fast', 'scouts', 'fly', 'alpha strike'],
    bad: ['slow', 'static', 'no mobility'],
  },
  melee: {
    good: ['overwatch', 'fights first', 'counter-charge', 'screens', 'tough'],
    bad: ['squishy', 'no screens', 'low toughness'],
  },
};

interface UnitMatchupData {
  unitName: string;
  bestTargets: string[];
  counters: string[];
  keywords?: string[];
}

interface MatchupMatrixProps {
  units: UnitMatchupData[];
  armyKeywords?: string[];
}

type MatchupRating = 'very_good' | 'good' | 'neutral' | 'bad' | 'very_bad';

interface ArchetypeMatchup {
  archetype: typeof META_ARCHETYPES[0];
  rating: MatchupRating;
  score: number;
  reasons: string[];
  vulnerableUnits: string[];
  strongUnits: string[];
}

export function MatchupMatrix({ units, armyKeywords = [] }: MatchupMatrixProps) {
  // Analyze matchups against each archetype
  const matchupAnalysis = useMemo(() => {
    const analysis: ArchetypeMatchup[] = [];
    
    META_ARCHETYPES.forEach(archetype => {
      const archetypeKeywords = MATCHUP_KEYWORDS[archetype.id];
      let goodScore = 0;
      let badScore = 0;
      const reasons: string[] = [];
      const vulnerable: string[] = [];
      const strong: string[] = [];
      
      units.forEach(unit => {
        const allText = [
          ...unit.bestTargets,
          ...(unit.keywords || []),
        ].join(' ').toLowerCase();
        
        const counterText = unit.counters.join(' ').toLowerCase();
        
        // Check good matchup indicators
        archetypeKeywords.good.forEach(keyword => {
          if (allText.includes(keyword.toLowerCase())) {
            goodScore += 2;
            if (!strong.includes(unit.unitName)) {
              strong.push(unit.unitName);
            }
          }
        });
        
        // Check bad matchup indicators from counters
        archetypeKeywords.bad.forEach(keyword => {
          if (counterText.includes(keyword.toLowerCase()) || allText.includes(keyword.toLowerCase())) {
            badScore += 1;
            if (!vulnerable.includes(unit.unitName)) {
              vulnerable.push(unit.unitName);
            }
          }
        });
        
        // Check if this unit type is countered by the archetype
        if (archetype.id === 'horde' && counterText.includes('volume')) badScore += 2;
        if (archetype.id === 'elite' && counterText.includes('high ap')) badScore += 2;
        if (archetype.id === 'vehicle' && counterText.includes('melta')) badScore += 2;
        if (archetype.id === 'melee' && counterText.includes('fast melee')) badScore += 2;
        if (archetype.id === 'shooting' && counterText.includes('shooting')) badScore += 2;
      });
      
      // Calculate net score
      const netScore = goodScore - badScore;
      const normalizedScore = Math.max(-10, Math.min(10, netScore));
      
      // Determine rating
      let rating: MatchupRating;
      if (normalizedScore >= 6) rating = 'very_good';
      else if (normalizedScore >= 2) rating = 'good';
      else if (normalizedScore >= -2) rating = 'neutral';
      else if (normalizedScore >= -6) rating = 'bad';
      else rating = 'very_bad';
      
      // Generate reasons
      if (strong.length > 0) {
        reasons.push(`${strong.length} unit${strong.length > 1 ? 's' : ''} strong against ${archetype.label}`);
      }
      if (vulnerable.length > 0) {
        reasons.push(`${vulnerable.length} unit${vulnerable.length > 1 ? 's' : ''} vulnerable`);
      }
      
      analysis.push({
        archetype,
        rating,
        score: normalizedScore,
        reasons,
        vulnerableUnits: vulnerable.slice(0, 3),
        strongUnits: strong.slice(0, 3),
      });
    });
    
    return analysis;
  }, [units]);

  // Get rating display config
  const getRatingConfig = (rating: MatchupRating) => {
    switch (rating) {
      case 'very_good':
        return { label: '++', color: 'text-green-400', bg: 'bg-green-500/30', description: 'Strong Matchup' };
      case 'good':
        return { label: '+', color: 'text-green-300', bg: 'bg-green-500/20', description: 'Favorable' };
      case 'neutral':
        return { label: '=', color: 'text-slate-400', bg: 'bg-slate-500/20', description: 'Even' };
      case 'bad':
        return { label: '-', color: 'text-orange-400', bg: 'bg-orange-500/20', description: 'Unfavorable' };
      case 'very_bad':
        return { label: '--', color: 'text-red-400', bg: 'bg-red-500/30', description: 'Difficult' };
    }
  };

  // Get worst matchups for callouts
  const worstMatchups = matchupAnalysis
    .filter(m => m.rating === 'bad' || m.rating === 'very_bad')
    .sort((a, b) => a.score - b.score);

  const bestMatchups = matchupAnalysis
    .filter(m => m.rating === 'good' || m.rating === 'very_good')
    .sort((a, b) => b.score - a.score);

  return (
    <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-grimlog-orange font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-xl">⚔️</span> Matchup Analysis
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-400">++</span>
          <span className="text-green-300">+</span>
          <span className="text-slate-400">=</span>
          <span className="text-orange-400">-</span>
          <span className="text-red-400">--</span>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {matchupAnalysis.map(({ archetype, rating, score, strongUnits, vulnerableUnits }) => {
          const config = getRatingConfig(rating);
          
          return (
            <div
              key={archetype.id}
              className={`
                relative p-4 rounded-lg border transition-all duration-200 hover:scale-105 cursor-default
                ${config.bg} border-grimlog-steel/50 hover:border-grimlog-steel
              `}
              title={archetype.description}
            >
              {/* Icon & Label */}
              <div className="text-center mb-2">
                <span className="text-2xl">{archetype.icon}</span>
                <p className="text-grimlog-steel text-xs font-bold uppercase mt-1">
                  {archetype.label}
                </p>
              </div>
              
              {/* Rating */}
              <div className="text-center">
                <span className={`text-3xl font-bold ${config.color}`}>
                  {config.label}
                </span>
                <p className={`text-xs ${config.color} mt-1`}>
                  {config.description}
                </p>
              </div>
              
              {/* Score Bar */}
              <div className="mt-3 h-2 bg-grimlog-black/50 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    score >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.abs(score) * 10}%`,
                    marginLeft: score < 0 ? 'auto' : '0',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Watch Out For */}
        {worstMatchups.length > 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <h4 className="text-red-400 font-bold text-sm uppercase mb-3 flex items-center gap-2">
              <span>⚠️</span> Watch Out For
            </h4>
            <div className="space-y-2">
              {worstMatchups.slice(0, 2).map(({ archetype, vulnerableUnits }) => (
                <div key={archetype.id} className="text-sm">
                  <span className="text-red-300 font-bold">{archetype.label}</span>
                  <span className="text-grimlog-steel"> armies </span>
                  {vulnerableUnits.length > 0 && (
                    <span className="text-grimlog-steel text-xs">
                      (threatens {vulnerableUnits.slice(0, 2).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strong Against */}
        {bestMatchups.length > 0 && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <h4 className="text-green-400 font-bold text-sm uppercase mb-3 flex items-center gap-2">
              <span>✓</span> Strong Against
            </h4>
            <div className="space-y-2">
              {bestMatchups.slice(0, 2).map(({ archetype, strongUnits }) => (
                <div key={archetype.id} className="text-sm">
                  <span className="text-green-300 font-bold">{archetype.label}</span>
                  <span className="text-grimlog-steel"> armies </span>
                  {strongUnits.length > 0 && (
                    <span className="text-grimlog-steel text-xs">
                      (use {strongUnits.slice(0, 2).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-grimlog-steel/60 text-xs mt-4 text-center">
        Based on unit profiles and competitive context. Actual results depend on terrain, missions, and player skill.
      </p>
    </div>
  );
}

export default MatchupMatrix;

