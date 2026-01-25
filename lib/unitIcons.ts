/**
 * Unit Icon System
 * 
 * Provides placeholder icons for units based on their role/datasheet
 * In the future, these can be replaced with custom uploaded icons
 */

export type UnitRole = 
  | 'character'
  | 'battleline'
  | 'transport'
  | 'vehicle'
  | 'monster'
  | 'elite'
  | 'heavy'
  | 'fast'
  | 'flyer'
  | 'fortification'
  | 'other';

// Default emoji/symbol icons for each role (placeholder until we get custom icons)
export const ROLE_ICONS: Record<UnitRole, string> = {
  character: '⚔️',
  battleline: '🛡️',
  transport: '🚛',
  vehicle: '⚙️',
  monster: '👹',
  elite: '⭐',
  heavy: '💥',
  fast: '⚡',
  flyer: '✈️',
  fortification: '🏰',
  other: '◆'
};

// Map Warhammer role names to our internal role types
const ROLE_MAPPING: Record<string, UnitRole> = {
  // Standard roles
  'hq': 'character',
  'troops': 'battleline',
  'elites': 'elite',
  'fast attack': 'fast',
  'heavy support': 'heavy',
  'flyer': 'flyer',
  'dedicated transport': 'transport',
  'dedicated transports': 'transport',
  'fortification': 'fortification',
  
  // 10th edition roles
  'characters': 'character',
  'character': 'character',
  'battleline': 'battleline',
  'other datasheets': 'other',
  'allied units': 'other'
};

/**
 * Determines the role/type of a unit based on its datasheet name and role field
 */
export function determineUnitRole(datasheet: string, roleField?: string | null): UnitRole {
  const lower = datasheet.toLowerCase();
  
  // Check role field first if provided
  if (roleField) {
    const roleLower = roleField.toLowerCase();
    const mappedRole = ROLE_MAPPING[roleLower];
    if (mappedRole) return mappedRole;
  }
  
  // Character keywords
  if (
    lower.includes('captain') ||
    lower.includes('lieutenant') || 
    lower.includes('chaplain') ||
    lower.includes('librarian') ||
    lower.includes('hive tyrant') ||
    lower.includes('broodlord') ||
    lower.includes('commander') ||
    lower.includes('lord') ||
    lower.includes('archon') ||
    lower.includes('autarch') ||
    lower.includes('warboss') ||
    lower.includes('primaris') && (lower.includes('captain') || lower.includes('lieutenant'))
  ) {
    return 'character';
  }
  
  // Battleline/Troops
  if (
    lower.includes('intercessor') ||
    lower.includes('tactical squad') ||
    lower.includes('termagant') ||
    lower.includes('hormagaunt') ||
    lower.includes('warrior') && !lower.includes('wraith') ||
    lower.includes('guardians') ||
    lower.includes('boyz')
  ) {
    return 'battleline';
  }
  
  // Transports
  if (
    lower.includes('rhino') ||
    lower.includes('razorback') ||
    lower.includes('impul') ||
    lower.includes('transport') ||
    lower.includes('trukk') ||
    lower.includes('wave serpent')
  ) {
    return 'transport';
  }
  
  // Vehicles (non-transport)
  if (
    lower.includes('dreadnought') ||
    lower.includes('tank') ||
    lower.includes('predator') ||
    lower.includes('land raider') ||
    lower.includes('repulsor') ||
    lower.includes('gladiator')
  ) {
    return 'vehicle';
  }
  
  // Monsters
  if (
    lower.includes('carnifex') ||
    lower.includes('tyrannofex') ||
    lower.includes('exocrine') ||
    lower.includes('haruspex') ||
    lower.includes('maleceptor') ||
    lower.includes('wraithknight') ||
    lower.includes('ghazghkull')
  ) {
    return 'monster';
  }
  
  // Fast Attack
  if (
    lower.includes('assault squad') ||
    lower.includes('bike') ||
    lower.includes('jetbike') ||
    lower.includes('vyper') ||
    lower.includes('hellion') ||
    lower.includes('reaver')
  ) {
    return 'fast';
  }
  
  // Heavy Support
  if (
    lower.includes('devastator') ||
    lower.includes('havoc') ||
    lower.includes('obliterator') ||
    lower.includes('heavy support')
  ) {
    return 'heavy';
  }
  
  // Flyers
  if (
    lower.includes('stormraven') ||
    lower.includes('stormtalon') ||
    lower.includes('harpy') ||
    lower.includes('crone') ||
    lower.includes('crimson hunter')
  ) {
    return 'flyer';
  }
  
  // Default to other
  return 'other';
}

/**
 * Gets the icon for a unit (custom or default placeholder)
 */
export function getUnitIcon(
  customIconUrl: string | null | undefined,
  datasheet: string,
  roleField?: string | null
): string {
  // If custom icon URL is provided, return it
  // (Component will use this as img src, but for now we return emoji)
  if (customIconUrl) {
    return customIconUrl;
  }
  
  // Otherwise return placeholder emoji
  const role = determineUnitRole(datasheet, roleField);
  return ROLE_ICONS[role];
}

/**
 * Check if the icon is a URL (custom image) or emoji (placeholder)
 */
export function isCustomIcon(icon: string): boolean {
  return icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:');
}
