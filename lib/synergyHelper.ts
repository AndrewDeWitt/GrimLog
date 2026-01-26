/**
 * Synergy Helper Utilities
 * 
 * Cross-references competitive context synergies with units actually in the army list
 * to identify "active" synergies that the player can leverage.
 */

import { UnitCompetitiveContextSummary } from './briefAnalysis';

interface UnitWithContext {
  unitName: string;
  context: UnitCompetitiveContextSummary;
}

interface SynergyResult {
  unitName: string;
  activeSynergies: string[]; // Synergies that exist in the list
  missingSynergies: string[]; // Synergies not in the list
}

/**
 * Normalize unit name for fuzzy matching
 * Handles common variations in unit naming
 */
function normalizeUnitName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9' ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Remove common suffixes
    .replace(/\s*(squad|pack|mob|unit)$/i, '')
    .replace(/\s*x\s*\d+$/i, '') // Remove "x5", "x10" etc.
    .trim();
}

/**
 * Check if two unit names match (with fuzzy logic)
 */
function unitNamesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeUnitName(name1);
  const n2 = normalizeUnitName(name2);
  
  // Exact match after normalization
  if (n1 === n2) return true;
  
  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Word-based partial match (at least 2 words match)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  const matchingWords = words1.filter(w1 => words2.some(w2 => w1 === w2 || w1.includes(w2) || w2.includes(w1)));
  if (matchingWords.length >= 2) return true;
  
  return false;
}

/**
 * Find active synergies for all units in the army list
 */
export function findActiveSynergies(
  unitContexts: Map<string, { context: UnitCompetitiveContextSummary; unitName: string }>,
  allUnitNames: string[]
): Map<string, SynergyResult> {
  const results = new Map<string, SynergyResult>();
  
  // Create normalized name lookup for all units in list
  const normalizedListNames = allUnitNames.map(name => ({
    original: name,
    normalized: normalizeUnitName(name),
  }));
  
  unitContexts.forEach((data, key) => {
    const { context, unitName } = data;
    const activeSynergies: string[] = [];
    const missingSynergies: string[] = [];

    // Helper to extract synergy name (handles both old string and new structured format)
    const getSynergyName = (synergy: string | { unit: string; why: string }): string => {
      return typeof synergy === 'object' && synergy !== null && 'unit' in synergy
        ? synergy.unit
        : synergy;
    };

    // Check each synergy from competitive context
    context.synergies.forEach(synergy => {
      const synergyName = getSynergyName(synergy);
      // Check if this synergy target is in the army list
      const isInList = normalizedListNames.some(listUnit =>
        unitNamesMatch(synergyName, listUnit.original) &&
        !unitNamesMatch(synergyName, unitName) // Don't match self
      );

      if (isInList) {
        // Find the actual name in the list for display
        const match = normalizedListNames.find(listUnit =>
          unitNamesMatch(synergyName, listUnit.original) &&
          !unitNamesMatch(synergyName, unitName)
        );
        activeSynergies.push(match?.original || synergyName);
      } else {
        missingSynergies.push(synergyName);
      }
    });

    results.set(unitName, {
      unitName,
      activeSynergies: [...new Set(activeSynergies)], // Remove duplicates
      missingSynergies: [...new Set(missingSynergies)],
    });
  });
  
  return results;
}

/**
 * Get synergy network edges for visualization
 */
export interface SynergyEdge {
  from: string;
  to: string;
  bidirectional: boolean;
}

export function buildSynergyNetwork(
  synergyResults: Map<string, SynergyResult>
): SynergyEdge[] {
  const edges: SynergyEdge[] = [];
  const edgeSet = new Set<string>();
  
  synergyResults.forEach((result, unitName) => {
    result.activeSynergies.forEach(synTarget => {
      // Create sorted edge key to avoid duplicates
      const key = [unitName, synTarget].sort().join('|||');
      
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        
        // Check if bidirectional
        const targetResult = synergyResults.get(synTarget);
        const bidirectional = targetResult?.activeSynergies.includes(unitName) || false;
        
        edges.push({
          from: unitName,
          to: synTarget,
          bidirectional,
        });
      }
    });
  });
  
  return edges;
}

/**
 * Calculate synergy stats for the army
 */
export interface SynergyStats {
  totalActiveSynergies: number;
  unitsWithSynergies: number;
  synergyDensity: number; // 0-100
  mostConnectedUnit: string | null;
  mostConnectedCount: number;
}

export function calculateSynergyStats(
  synergyResults: Map<string, SynergyResult>,
  totalUnits: number
): SynergyStats {
  let totalActive = 0;
  let unitsWithSynergies = 0;
  let mostConnectedUnit: string | null = null;
  let mostConnectedCount = 0;
  
  synergyResults.forEach((result, unitName) => {
    const count = result.activeSynergies.length;
    totalActive += count;
    
    if (count > 0) {
      unitsWithSynergies++;
    }
    
    if (count > mostConnectedCount) {
      mostConnectedCount = count;
      mostConnectedUnit = unitName;
    }
  });
  
  // Density: actual connections vs theoretical max connections
  const maxPossible = totalUnits * (totalUnits - 1) / 2;
  const synergyDensity = maxPossible > 0 ? Math.round((totalActive / 2 / maxPossible) * 100) : 0;
  
  return {
    totalActiveSynergies: Math.floor(totalActive / 2), // Divide by 2 to avoid double-counting
    unitsWithSynergies,
    synergyDensity,
    mostConnectedUnit,
    mostConnectedCount,
  };
}

// Named exports are preferred - default export removed

