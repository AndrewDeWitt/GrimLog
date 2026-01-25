/**
 * Datasheet Query Helpers
 *
 * Functions to query datasheets and build context for the AI system
 */

import { prisma } from './prisma';

/**
 * Safely parse JSON with a default fallback
 */
function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

export interface DatasheetWithRelations {
  id: string;
  name: string;
  faction: string;
  subfaction: string | null;
  role: string;
  keywords: string[];
  movement: string;
  toughness: number;
  save: string;
  invulnerableSave: string | null;
  wounds: number;
  leadership: number;
  objectiveControl: number;
  composition: string;
  leaderRules: string | null;
  pointsCost: number;
  weapons: Array<{
    name: string;
    range: string;
    type: string;
    attacks: string;
    ballisticSkill: string | null;
    weaponSkill: string | null;
    strength: string;
    armorPenetration: string;
    damage: string;
    abilities: string[];
  }>;
  abilities: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}

/**
 * Get a datasheet by name and faction (with fuzzy matching for voice recognition)
 */
export async function getDatasheetByName(
  name: string,
  faction?: string
): Promise<DatasheetWithRelations | null> {
  // Try exact match first
  let datasheet = await prisma.datasheet.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(faction && { faction: { equals: faction, mode: 'insensitive' } }),
    },
    include: {
      weapons: {
        include: {
          weapon: true,
        },
      },
      abilities: {
        include: {
          ability: true,
        },
      },
    },
  });
  
  // If no exact match, try fuzzy matching (contains)
  if (!datasheet) {
    datasheet = await prisma.datasheet.findFirst({
      where: {
        name: { contains: name, mode: 'insensitive' },
        ...(faction && { faction: { equals: faction, mode: 'insensitive' } }),
      },
      include: {
        weapons: {
          include: {
            weapon: true,
          },
        },
        abilities: {
          include: {
            ability: true,
          },
        },
      },
    });
  }
  
  if (!datasheet) return null;
  
  // Transform to clean format
  return {
    id: datasheet.id,
    name: datasheet.name,
    faction: datasheet.faction,
    subfaction: datasheet.subfaction,
    role: datasheet.role,
    keywords: safeJsonParse<string[]>(datasheet.keywords, []),
    movement: datasheet.movement,
    toughness: datasheet.toughness,
    save: datasheet.save,
    invulnerableSave: datasheet.invulnerableSave,
    wounds: datasheet.wounds,
    leadership: datasheet.leadership,
    objectiveControl: datasheet.objectiveControl,
    composition: datasheet.composition,
    leaderRules: datasheet.leaderRules,
    pointsCost: datasheet.pointsCost,
    weapons: datasheet.weapons.map(dw => ({
      name: dw.weapon.name,
      range: dw.weapon.range,
      type: dw.weapon.type,
      attacks: dw.weapon.attacks,
      ballisticSkill: dw.weapon.ballisticSkill,
      weaponSkill: dw.weapon.weaponSkill,
      strength: dw.weapon.strength,
      armorPenetration: dw.weapon.armorPenetration,
      damage: dw.weapon.damage,
      abilities: safeJsonParse<string[]>(dw.weapon.abilities, []),
    })),
    abilities: datasheet.abilities.map(da => ({
      name: da.ability.name,
      type: da.ability.type,
      description: da.ability.description,
    })),
  };
}

/**
 * Build AI context prompt with relevant datasheets
 */
export async function buildDatasheetContext(unitNames: string[]): Promise<string> {
  if (unitNames.length === 0) {
    return 'No unit datasheets loaded for this game.';
  }
  
  const datasheets: DatasheetWithRelations[] = [];
  
  for (const name of unitNames) {
    const datasheet = await getDatasheetByName(name);
    if (datasheet) {
      datasheets.push(datasheet);
    }
  }
  
  if (datasheets.length === 0) {
    return 'No matching datasheets found for the units in this game.';
  }
  
  let context = '=== UNIT DATASHEETS ===\n\n';
  
  for (const ds of datasheets) {
    context += `## ${ds.name} (${ds.role})\n`;
    context += `Faction: ${ds.faction}${ds.subfaction ? ` (${ds.subfaction})` : ''}\n`;
    context += `Keywords: ${ds.keywords.join(', ')}\n\n`;
    
    context += `Stats: M ${ds.movement} | T ${ds.toughness} | Sv ${ds.save}`;
    if (ds.invulnerableSave) context += ` (${ds.invulnerableSave} inv)`;
    context += ` | W ${ds.wounds} | Ld ${ds.leadership} | OC ${ds.objectiveControl}\n`;
    context += `Composition: ${ds.composition}\n`;
    context += `Points: ${ds.pointsCost}\n\n`;
    
    if (ds.leaderRules) {
      context += `Leader: ${ds.leaderRules}\n\n`;
    }
    
    if (ds.weapons.length > 0) {
      context += `Weapons:\n`;
      for (const w of ds.weapons) {
        const skill = w.ballisticSkill || w.weaponSkill || '';
        context += `  - ${w.name}: Range ${w.range} | ${w.type} | A ${w.attacks} | ${skill} to hit | S ${w.strength} | AP ${w.armorPenetration} | D ${w.damage}`;
        if (w.abilities.length > 0) {
          context += ` | [${w.abilities.join(', ')}]`;
        }
        context += '\n';
      }
      context += '\n';
    }
    
    if (ds.abilities.length > 0) {
      context += `Abilities:\n`;
      for (const a of ds.abilities) {
        context += `  - ${a.name} (${a.type}): ${a.description}\n`;
      }
      context += '\n';
    }
    
    context += '---\n\n';
  }
  
  return context;
}

/**
 * Get weapon profile by name
 */
export async function getWeaponProfile(weaponName: string) {
  const weapon = await prisma.weapon.findFirst({
    where: {
      name: { contains: weaponName, mode: 'insensitive' },
    },
  });
  
  if (!weapon) return null;
  
  return {
    name: weapon.name,
    range: weapon.range,
    type: weapon.type,
    attacks: weapon.attacks,
    ballisticSkill: weapon.ballisticSkill,
    weaponSkill: weapon.weaponSkill,
    strength: weapon.strength,
    armorPenetration: weapon.armorPenetration,
    damage: weapon.damage,
    abilities: safeJsonParse<string[]>(weapon.abilities, []),
  };
}

/**
 * Get ability text by name
 */
export async function getAbilityText(abilityName: string): Promise<string | null> {
  const ability = await prisma.ability.findFirst({
    where: {
      name: { contains: abilityName, mode: 'insensitive' },
    },
  });
  
  return ability?.description || null;
}

/**
 * Get stratagem details
 */
export async function getStratagemDetails(name: string, faction: string) {
  const stratagem = await prisma.stratagemData.findFirst({
    where: {
      name: { contains: name, mode: 'insensitive' },
      faction: { equals: faction, mode: 'insensitive' },
    },
  });
  
  if (!stratagem) return null;
  
  return {
    name: stratagem.name,
    faction: stratagem.faction,
    subfaction: stratagem.subfaction,
    detachment: stratagem.detachment,
    cpCost: stratagem.cpCost,
    type: stratagem.type,
    when: stratagem.when,
    target: stratagem.target,
    effect: stratagem.effect,
    restrictions: safeJsonParse<string[]>(stratagem.restrictions, []),
    keywords: safeJsonParse<string[]>(stratagem.keywords, []),
  };
}

/**
 * Search datasheets by faction and optional filters
 */
export async function searchDatasheets(params: {
  faction?: string;
  subfaction?: string;
  role?: string;
  keyword?: string;
  limit?: number;
}) {
  const datasheets = await prisma.datasheet.findMany({
    where: {
      ...(params.faction && { faction: { equals: params.faction, mode: 'insensitive' } }),
      ...(params.subfaction && { subfaction: { equals: params.subfaction, mode: 'insensitive' } }),
      ...(params.role && { role: { equals: params.role, mode: 'insensitive' } }),
      ...(params.keyword && { keywords: { contains: params.keyword, mode: 'insensitive' } }),
    },
    take: params.limit || 50,
    select: {
      id: true,
      name: true,
      faction: true,
      subfaction: true,
      role: true,
      pointsCost: true,
      keywords: true,
    },
  });
  
  return datasheets.map(ds => ({
    ...ds,
    keywords: safeJsonParse<string[]>(ds.keywords, []),
  }));
}

/**
 * Get all datasheets for a faction (light version for lists)
 */
export async function getFactionDatasheets(faction: string, subfaction?: string) {
  const datasheets = await prisma.datasheet.findMany({
    where: {
      faction: { equals: faction, mode: 'insensitive' },
      ...(subfaction && { subfaction: { equals: subfaction, mode: 'insensitive' } }),
    },
    orderBy: [
      { role: 'asc' },
      { name: 'asc' },
    ],
    select: {
      id: true,
      name: true,
      role: true,
      pointsCost: true,
      keywords: true,
    },
  });
  
  return datasheets.map(ds => ({
    ...ds,
    keywords: safeJsonParse<string[]>(ds.keywords, []),
  }));
}

