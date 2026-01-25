// Unit Name Matching & Nickname System
// Handles fuzzy matching, common nicknames, and user-learned aliases

import { prisma } from './prisma';

/**
 * Common Warhammer 40K unit nicknames
 * Maps common shorthand → possible full names (patterns)
 */
const COMMON_NICKNAMES: Record<string, string[]> = {
  // Space Marines
  'termies': ['terminator'],
  'terminators': ['terminator squad', 'terminator'],
  'intercessors': ['intercessor squad', 'primaris intercessor'],
  'assault intercessors': ['assault intercessor squad'],
  'hellblasters': ['hellblaster squad'],
  'aggressors': ['aggressor squad'],
  'eradicators': ['eradicator squad'],
  'bladeguard': ['bladeguard veteran'],
  'scouts': ['scout squad'],
  'tacticals': ['tactical squad', 'tactical marine'],
  'devs': ['devastator squad'],
  'dreads': ['dreadnought'],
  'redemptor': ['redemptor dreadnought'],
  'repulsor': ['repulsor executioner', 'repulsor'],
  
  // Tyranids
  'gaunts': ['termagant', 'hormagaunt'],
  'termagants': ['termagant brood', 'termagant'],
  'hormagaunts': ['hormagaunt brood', 'hormagaunt'],
  'warriors': ['tyranid warrior'],
  'genestealers': ['genestealer'],
  'fex': ['carnifex'],
  'carnifex': ['carnifex', 'screamer-killer'],
  'tyrant': ['hive tyrant', 'swarmlord'],
  'exocrine': ['exocrine'],
  'tyrannofex': ['tyrannofex'],
  
  // General
  'captain': ['captain'],
  'lieutenant': ['lieutenant', 'primaris lieutenant'],
  'librarian': ['librarian', 'primaris librarian'],
  'chaplain': ['chaplain', 'primaris chaplain'],
  'techmarine': ['techmarine'],
};

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score from 0 to 1 (1 = identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return shorter / longer; // Returns 0.5-1.0 range for containment
  }
  
  // Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  return 1 - (distance / maxLength);
}

/**
 * Match result with confidence score and metadata
 */
export interface UnitMatchResult {
  success: boolean;
  unit?: any; // UnitInstance from DB
  confidence: number;
  matchedFrom?: string; // What the user said
  matchMethod?: 'exact' | 'nickname' | 'fuzzy' | 'partial';
  alternatives?: Array<{ unitName: string; confidence: number }>;
  error?: string;
}

/**
 * Find the best matching unit for a given name
 * 
 * @param searchName - Name provided by user/AI
 * @param owner - "player" or "opponent"
 * @param sessionId - Current game session
 * @param strictMode - If true, requires 80%+ confidence or exact nickname match
 */
export async function findBestUnitMatch(
  searchName: string,
  owner: string,
  sessionId: string,
  strictMode: boolean = true
): Promise<UnitMatchResult> {
  const searchLower = searchName.toLowerCase().trim();
  
  // Fetch all active units for this owner in the session
  const availableUnits = await prisma.unitInstance.findMany({
    where: {
      gameSessionId: sessionId,
      owner: owner,
      isDestroyed: false
    },
    include: {
      fullDatasheet: true  // Include datasheet for wounds per model
    }
  });
  
  if (availableUnits.length === 0) {
    return {
      success: false,
      confidence: 0,
      error: `No active units found for ${owner}. Has the army been initialized?`
    };
  }
  
  // 1. Try EXACT match first
  const exactMatch = availableUnits.find(u => 
    u.unitName.toLowerCase() === searchLower
  );
  
  if (exactMatch) {
    return {
      success: true,
      unit: exactMatch,
      confidence: 1.0,
      matchedFrom: searchName,
      matchMethod: 'exact'
    };
  }
  
  // 2. Try COMMON NICKNAMES
  if (COMMON_NICKNAMES[searchLower]) {
    const patterns = COMMON_NICKNAMES[searchLower];
    const nicknameMatches = availableUnits.filter(u => {
      const unitLower = u.unitName.toLowerCase();
      return patterns.some(pattern => unitLower.includes(pattern));
    });
    
    if (nicknameMatches.length === 1) {
      // Single match via nickname - use it!
      return {
        success: true,
        unit: nicknameMatches[0],
        confidence: 0.95,
        matchedFrom: searchName,
        matchMethod: 'nickname'
      };
    } else if (nicknameMatches.length > 1) {
      // Multiple matches - ambiguous
      return {
        success: false,
        confidence: 0,
        matchedFrom: searchName,
        alternatives: nicknameMatches.map(u => ({
          unitName: u.unitName,
          confidence: 0.95
        })),
        error: `"${searchName}" is ambiguous. Did you mean: ${nicknameMatches.map(u => `"${u.unitName}"`).join(' or ')}? Please be more specific.`
      };
    }
  }
  
  // 3. Try FUZZY matching with similarity scores
  const matches = availableUnits.map(u => ({
    unit: u,
    confidence: calculateSimilarity(searchLower, u.unitName.toLowerCase())
  })).sort((a, b) => b.confidence - a.confidence);
  
  const bestMatch = matches[0];
  const secondBest = matches[1];
  
  // Strict mode: require 80%+ confidence
  const confidenceThreshold = strictMode ? 0.80 : 0.60;
  
  if (bestMatch.confidence >= confidenceThreshold) {
    // Check if there's another similar match (ambiguous)
    if (secondBest && secondBest.confidence >= confidenceThreshold && 
        (bestMatch.confidence - secondBest.confidence) < 0.15) {
      // Too close - ambiguous
      return {
        success: false,
        confidence: bestMatch.confidence,
        matchedFrom: searchName,
        alternatives: [
          { unitName: bestMatch.unit.unitName, confidence: bestMatch.confidence },
          { unitName: secondBest.unit.unitName, confidence: secondBest.confidence }
        ],
        error: `"${searchName}" could match multiple units: "${bestMatch.unit.unitName}" or "${secondBest.unit.unitName}". Please use the full unit name.`
      };
    }
    
    // Good single match
    return {
      success: true,
      unit: bestMatch.unit,
      confidence: bestMatch.confidence,
      matchedFrom: searchName,
      matchMethod: bestMatch.confidence >= 0.95 ? 'partial' : 'fuzzy'
    };
  }
  
  // No good matches found
  const availableNames = availableUnits.map(u => `"${u.unitName}"`).join(', ');
  return {
    success: false,
    confidence: bestMatch.confidence,
    matchedFrom: searchName,
    alternatives: matches.slice(0, 3).map(m => ({
      unitName: m.unit.unitName,
      confidence: m.confidence
    })),
    error: `Unit "${searchName}" not found for ${owner}. Available units: ${availableNames}. (Best match: "${bestMatch.unit.unitName}" at ${(bestMatch.confidence * 100).toFixed(0)}% confidence)`
  };
}

/**
 * Get all active unit names for display in AI prompt
 */
export async function getSessionUnitNames(sessionId: string): Promise<{
  attacker: string[];
  defender: string[];
}> {
  const units = await prisma.unitInstance.findMany({
    where: {
      gameSessionId: sessionId,
      isDestroyed: false
    },
    select: {
      unitName: true,
      owner: true
    },
    orderBy: {
      unitName: 'asc'
    }
  });
  
  return {
    attacker: units.filter(u => u.owner === 'attacker').map(u => u.unitName),
    defender: units.filter(u => u.owner === 'defender').map(u => u.unitName)
  };
}

/**
 * Build formatted unit list for AI system prompt
 */
export function buildUnitListPrompt(playerUnits: string[], opponentUnits: string[]): string {
  if (playerUnits.length === 0 && opponentUnits.length === 0) {
    return 'No units initialized yet. Units will be available after armies are loaded.';
  }
  
  let prompt = 'AVAILABLE UNITS IN THIS BATTLE:\n';
  
  if (playerUnits.length > 0) {
    prompt += `\nPlayer's Army:\n${playerUnits.map(u => `  - ${u}`).join('\n')}`;
  }
  
  if (opponentUnits.length > 0) {
    prompt += `\n\nOpponent's Army:\n${opponentUnits.map(u => `  - ${u}`).join('\n')}`;
  }
  
  prompt += '\n\nIMPORTANT: When updating unit health, use these EXACT unit names from the list above.';
  prompt += '\nIf the player uses a nickname (e.g., "Terminators" for "Terminator Squad"), use your best judgment to match it to the correct full name from the list.';
  prompt += '\nCommon abbreviations: "Termies"→Terminators, "Intercessors"→Intercessor Squad, "Gaunts"→Termagants, etc.';
  
  prompt += '\n\n⚠️ SPEECH-TO-TEXT CONTEXT: These unit names may be transcribed phonetically incorrect.';
  prompt += '\nAlways prioritize phonetic similarity + context over exact text matching.';
  prompt += '\nExample: "tournaments" in context = Termagants, "tyranno flex" = Tyrannofex';
  
  return prompt;
}
