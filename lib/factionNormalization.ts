/**
 * Faction Normalization Utility
 * 
 * Handles various formats of faction names that might appear in army lists:
 * - "Space Marines (Space Wolves)" → "Space Wolves"
 * - "Space Wolves" → "Space Wolves"
 * - "SPACE WOLVES" → "Space Wolves"
 * - "Adeptus Astartes - Space Wolves" → "Space Wolves"
 * 
 * The goal is to extract the most specific faction (subfaction when present)
 * and normalize it to match database faction names.
 */

import { FACTION_DATA, FactionDefinition } from './factionConstants';

// Build lookup maps for efficient normalization
const CANONICAL_FACTIONS = new Map<string, string>();
const SUBFACTION_TO_PARENT = new Map<string, string>();

// Initialize maps from FACTION_DATA
FACTION_DATA.forEach(faction => {
  // Store lowercase → proper case mapping
  CANONICAL_FACTIONS.set(faction.name.toLowerCase(), faction.name);
  
  // Store subfaction relationships
  if (faction.parentFaction) {
    SUBFACTION_TO_PARENT.set(faction.name.toLowerCase(), faction.parentFaction);
  }
});

// Common faction aliases and alternative names
const FACTION_ALIASES: Record<string, string> = {
  // Space Marines and chapters
  'adeptus astartes': 'Space Marines',
  'astartes': 'Space Marines',
  'marines': 'Space Marines',
  'space marine': 'Space Marines',
  'wolves': 'Space Wolves',
  'sons of russ': 'Space Wolves',
  'vlka fenryka': 'Space Wolves',
  'blood angel': 'Blood Angels',
  'dark angel': 'Dark Angels',
  'black templar': 'Black Templars',
  'templars': 'Black Templars',
  
  // Tyranids
  'nids': 'Tyranids',
  'tyranid': 'Tyranids',
  'hive fleet': 'Tyranids',
  'bugs': 'Tyranids',
  
  // Astra Militarum
  'imperial guard': 'Astra Militarum',
  'guard': 'Astra Militarum',
  'astra mil': 'Astra Militarum',
  'militarum': 'Astra Militarum',
  'ig': 'Astra Militarum',
  
  // Other common aliases
  'orks': 'Orks',
  'ork': 'Orks',
  'eldar': 'Aeldari',
  'craftworlds': 'Aeldari',
  'drukhari': 'Drukhari',
  'dark eldar': 'Drukhari',
  'tau': 'T\'au Empire',
  "t'au": 'T\'au Empire',
  'chaos space marines': 'Chaos Space Marines',
  'csm': 'Chaos Space Marines',
  'heretic astartes': 'Chaos Space Marines',
  'death guard': 'Death Guard',
  'thousand sons': 'Thousand Sons',
  'world eaters': 'World Eaters',
  'necrons': 'Necrons',
  'necron': 'Necrons',
  'admech': 'Adeptus Mechanicus',
  'ad mech': 'Adeptus Mechanicus',
  'mechanicus': 'Adeptus Mechanicus',
  'knights': 'Imperial Knights',
  'imperial knights': 'Imperial Knights',
  'chaos knights': 'Chaos Knights',
  'custodes': 'Adeptus Custodes',
  'grey knights': 'Grey Knights',
  'sisters': 'Adepta Sororitas',
  'sororitas': 'Adepta Sororitas',
  'sisters of battle': 'Adepta Sororitas',
  'agents': 'Agents of the Imperium',
  'inquisition': 'Agents of the Imperium',
  'votann': 'Leagues of Votann',
  'squats': 'Leagues of Votann',
  'genestealer cults': 'Genestealer Cults',
  'gsc': 'Genestealer Cults',
  'daemons': 'Chaos Daemons',
  'chaos daemons': 'Chaos Daemons',
};

/**
 * Extract subfaction from formats like "Space Marines (Space Wolves)" or "Adeptus Astartes - Space Wolves"
 */
function extractSubfaction(factionName: string): { parentFaction: string | null; subfaction: string | null } {
  const cleaned = factionName.trim();
  
  // Pattern 1: "ParentFaction (Subfaction)" - e.g., "Space Marines (Space Wolves)"
  const parenMatch = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      parentFaction: parenMatch[1].trim(),
      subfaction: parenMatch[2].trim()
    };
  }
  
  // Pattern 2: "ParentFaction - Subfaction" - e.g., "Adeptus Astartes - Space Wolves"
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    // Check if the second part is a known subfaction
    const potentialSubfaction = dashMatch[2].trim().toLowerCase();
    if (CANONICAL_FACTIONS.has(potentialSubfaction) || FACTION_ALIASES[potentialSubfaction]) {
      return {
        parentFaction: dashMatch[1].trim(),
        subfaction: dashMatch[2].trim()
      };
    }
  }
  
  // Pattern 3: "Subfaction ParentFaction" - e.g., "Space Wolves Space Marines" (less common)
  // Skip this as it's too ambiguous
  
  return {
    parentFaction: null,
    subfaction: null
  };
}

/**
 * Normalize a faction name to its canonical database form.
 * 
 * Examples:
 * - "Space Marines (Space Wolves)" → "Space Wolves"
 * - "space wolves" → "Space Wolves"  
 * - "TYRANIDS" → "Tyranids"
 * - "Adeptus Astartes - Blood Angels" → "Blood Angels"
 * - "Imperial Guard" → "Astra Militarum"
 * 
 * @param rawFaction - The faction name as detected from the army list
 * @param preferSubfaction - If true (default), return the subfaction when a parent/subfaction combo is detected
 * @returns The normalized canonical faction name, or the original if not recognized
 */
export function normalizeFactionName(
  rawFaction: string | null | undefined,
  preferSubfaction: boolean = true
): string | null {
  if (!rawFaction) return null;
  
  const cleaned = rawFaction.trim();
  if (!cleaned) return null;
  
  // Step 1: Check for parent/subfaction composite format
  const extracted = extractSubfaction(cleaned);
  
  if (extracted.subfaction) {
    // We have a composite format like "Space Marines (Space Wolves)"
    const subfactionLower = extracted.subfaction.toLowerCase();
    
    // Try to match the subfaction
    if (CANONICAL_FACTIONS.has(subfactionLower)) {
      return preferSubfaction 
        ? CANONICAL_FACTIONS.get(subfactionLower)!
        : (CANONICAL_FACTIONS.get(extracted.parentFaction!.toLowerCase()) || extracted.parentFaction);
    }
    
    // Check aliases for subfaction
    if (FACTION_ALIASES[subfactionLower]) {
      return preferSubfaction
        ? FACTION_ALIASES[subfactionLower]
        : (CANONICAL_FACTIONS.get(extracted.parentFaction!.toLowerCase()) || extracted.parentFaction);
    }
    
    // If subfaction not recognized, try parent
    const parentLower = extracted.parentFaction!.toLowerCase();
    if (CANONICAL_FACTIONS.has(parentLower)) {
      return CANONICAL_FACTIONS.get(parentLower)!;
    }
    if (FACTION_ALIASES[parentLower]) {
      return FACTION_ALIASES[parentLower];
    }
  }
  
  // Step 2: Direct lookup (case-insensitive)
  const lower = cleaned.toLowerCase();
  
  if (CANONICAL_FACTIONS.has(lower)) {
    return CANONICAL_FACTIONS.get(lower)!;
  }
  
  // Step 3: Check aliases
  if (FACTION_ALIASES[lower]) {
    return FACTION_ALIASES[lower];
  }
  
  // Step 4: Fuzzy matching - check if any canonical faction is contained within the input
  for (const [canonicalLower, canonicalName] of CANONICAL_FACTIONS.entries()) {
    if (lower.includes(canonicalLower) || canonicalLower.includes(lower)) {
      return canonicalName;
    }
  }
  
  // Step 5: Return original (title-cased) if no match found
  // This preserves unknown factions while fixing case
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate that a detachment belongs to a given faction.
 * Takes into account parent faction relationships.
 * 
 * @param detachment - The detachment name
 * @param faction - The faction name
 * @param knownDetachments - Map of faction -> detachment names
 * @returns true if the detachment is valid for the faction
 */
export function isValidDetachmentForFaction(
  detachment: string,
  faction: string,
  knownDetachments: Map<string, string[]>
): boolean {
  const factionLower = faction.toLowerCase();
  
  // Check direct faction match
  const factionDetachments = knownDetachments.get(factionLower);
  if (factionDetachments?.some(d => d.toLowerCase() === detachment.toLowerCase())) {
    return true;
  }
  
  // Check parent faction if this is a subfaction
  const parentFaction = SUBFACTION_TO_PARENT.get(factionLower);
  if (parentFaction) {
    const parentDetachments = knownDetachments.get(parentFaction.toLowerCase());
    if (parentDetachments?.some(d => d.toLowerCase() === detachment.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the parent faction for a given subfaction.
 * 
 * @param faction - The faction name (e.g., "Space Wolves")
 * @returns The parent faction name (e.g., "Space Marines") or null if no parent
 */
export function getParentFaction(faction: string): string | null {
  const normalized = normalizeFactionName(faction);
  if (!normalized) return null;
  
  return SUBFACTION_TO_PARENT.get(normalized.toLowerCase()) || null;
}

/**
 * Check if a faction is a subfaction (has a parent faction).
 * 
 * @param faction - The faction name
 * @returns true if this is a subfaction
 */
export function isSubfaction(faction: string): boolean {
  return getParentFaction(faction) !== null;
}

/**
 * Find a matching faction from a database list.
 * Handles normalization and parent/subfaction relationships.
 * 
 * @param rawFaction - The raw faction name from army list
 * @param dbFactions - Array of factions from database with id and name
 * @returns The matching faction object or null
 */
export function findMatchingFaction<T extends { id: string; name: string }>(
  rawFaction: string | null | undefined,
  dbFactions: T[]
): T | null {
  if (!rawFaction || dbFactions.length === 0) return null;
  
  const normalized = normalizeFactionName(rawFaction);
  if (!normalized) return null;
  
  // Direct match
  const directMatch = dbFactions.find(
    f => f.name.toLowerCase() === normalized.toLowerCase()
  );
  if (directMatch) return directMatch;
  
  // Try parent faction
  const parent = getParentFaction(normalized);
  if (parent) {
    const parentMatch = dbFactions.find(
      f => f.name.toLowerCase() === parent.toLowerCase()
    );
    if (parentMatch) return parentMatch;
  }
  
  return null;
}

// Export the alias map for use in tests or other modules
export { FACTION_ALIASES };

