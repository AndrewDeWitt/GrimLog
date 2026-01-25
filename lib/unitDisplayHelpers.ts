/**
 * Unit Display Helpers
 * 
 * Utilities for generating display names that differentiate duplicate units
 * (e.g., "Wolf Guard Terminators (Squad 1)", "Wolf Guard Terminators (Squad 2)")
 */

export interface UnitForDisplay {
  id: string;
  name: string;
  datasheet: string;
  modelCount: number;
  pointsCost: number;
}

/**
 * Map of unit IDs to their squad numbers (1-indexed).
 * Only units that have duplicates will have entries.
 */
export type SquadNumberMap = Map<string, number>;

/**
 * Generates a map of unit IDs to squad numbers for units that share the same datasheet.
 * Units are numbered in the order they appear in the array.
 * 
 * @param units - Array of units to process
 * @returns Map of unitId -> squadNumber (1-indexed)
 */
export function generateSquadNumbers(units: UnitForDisplay[]): SquadNumberMap {
  const squadMap = new Map<string, number>();
  
  // Group units by datasheet name
  const datasheetGroups = new Map<string, UnitForDisplay[]>();
  
  for (const unit of units) {
    const key = unit.datasheet || unit.name;
    const group = datasheetGroups.get(key) || [];
    group.push(unit);
    datasheetGroups.set(key, group);
  }
  
  // For groups with more than one unit, assign squad numbers
  for (const [, group] of datasheetGroups) {
    if (group.length > 1) {
      group.forEach((unit, idx) => {
        squadMap.set(unit.id, idx + 1); // 1-indexed
      });
    }
  }
  
  return squadMap;
}

/**
 * Gets the display name for a unit, including squad number if there are duplicates.
 * 
 * @param unit - The unit to get display name for
 * @param squadNumbers - Map from generateSquadNumbers()
 * @returns Display name like "Wolf Guard Terminators" or "Wolf Guard Terminators (Squad 2)"
 */
export function getUnitDisplayName(
  unit: UnitForDisplay,
  squadNumbers: SquadNumberMap
): string {
  const squadNum = squadNumbers.get(unit.id);
  if (squadNum !== undefined) {
    return `${unit.name} (Squad ${squadNum})`;
  }
  return unit.name;
}

/**
 * Gets a detailed display label for a unit including squad number, model count, and points.
 * Useful for dropdown options.
 * 
 * @param unit - The unit to get label for
 * @param squadNumbers - Map from generateSquadNumbers()
 * @returns Label like "Wolf Guard Terminators (Squad 2) - 10 models • 170pts"
 */
export function getUnitDisplayLabel(
  unit: UnitForDisplay,
  squadNumbers: SquadNumberMap
): string {
  const baseName = getUnitDisplayName(unit, squadNumbers);
  return baseName;
}

/**
 * Gets a description string for a unit with model count and points.
 * 
 * @param unit - The unit to describe
 * @returns Description like "10 models • 170pts"
 */
export function getUnitDescription(unit: UnitForDisplay): string {
  return `${unit.modelCount} models • ${unit.pointsCost}pts`;
}

/**
 * Finds a unit by ID from a list of units.
 * 
 * @param unitId - The unit ID to find
 * @param units - Array of units to search
 * @returns The unit if found, undefined otherwise
 */
export function findUnitById(
  unitId: string,
  units: UnitForDisplay[]
): UnitForDisplay | undefined {
  return units.find(u => u.id === unitId);
}

/**
 * Finds a unit by name from a list of units.
 * Returns the first match if multiple units have the same name.
 * 
 * @param name - The unit name to find
 * @param units - Array of units to search
 * @returns The first matching unit if found, undefined otherwise
 */
export function findUnitByName(
  name: string,
  units: UnitForDisplay[]
): UnitForDisplay | undefined {
  return units.find(u => u.name === name);
}

