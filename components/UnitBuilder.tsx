'use client';

import { useState, useEffect, useMemo } from 'react';

interface Weapon {
  id: string;
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
  isDefault: boolean;
  quantity: string | null;
}

interface Ability {
  id: string;
  name: string;
  type: string;
  description: string;
}

// Simple points tier for units with uniform model types
interface SimplePointsTier {
  models: number;
  points: number;
}

// Composition-based points tier for units with multiple model types
interface CompositionPointsTier {
  composition: Record<string, number>; // { "Model Type": count }
  points: number;
}

// Add-on model that adds extra points to base cost
interface AddOnPointsTier {
  addOn: string;        // Model type name (e.g., "Invader ATV")
  addOnPoints: number;  // Additional points cost
}

type PointsTier = SimplePointsTier | CompositionPointsTier | AddOnPointsTier;

function isCompositionTier(tier: PointsTier): tier is CompositionPointsTier {
  return 'composition' in tier;
}

function isAddOnTier(tier: PointsTier): tier is AddOnPointsTier {
  return 'addOn' in tier;
}

// Composition data from datasheet
interface DatasheetComposition {
  name: string;
  role: string;
  count: number;
  woundsPerModel: number;
}

interface DatasheetData {
  id: string;
  name: string;
  faction: string;
  factionId: string | null;
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
  compositionData?: DatasheetComposition[] | null;
  unitSize: string | null;
  pointsCost: number;
  pointsTiers?: PointsTier[] | null;
  weapons: Weapon[];
  abilities: Ability[];
}

interface CompositionEntry {
  modelType: string;
  role: 'sergeant' | 'leader' | 'heavy_weapon' | 'special_weapon' | 'regular';
  count: number;
  weapons: string[];
  woundsPerModel: number;
}

interface UnitConfig {
  name: string;
  datasheet: string;
  datasheetId: string;
  modelCount: number;
  pointsCost: number;
  composition: CompositionEntry[];
  weapons: Array<{
    weaponId: string | null;
    name: string;
    range: string | null;
    type: string | null;
    attacks: string | null;
    ballisticSkill: string | null;
    weaponSkill: string | null;
    strength: string | null;
    armorPenetration: string | null;
    damage: string | null;
    abilities: string[];
    matchConfidence: number;
    needsReview: boolean;
  }>;
  abilities: Array<{
    abilityId: string | null;
    name: string;
    type: string | null;
    description: string | null;
    matchConfidence: number;
    needsReview: boolean;
  }>;
  keywords: string[];
  enhancements: string[];
  needsReview: boolean;
}

interface UnitBuilderProps {
  datasheet: DatasheetData;
  initialUnit?: Partial<UnitConfig>;
  onSave: (unit: UnitConfig) => void;
  onCancel: () => void;
}

export default function UnitBuilder({
  datasheet,
  initialUnit,
  onSave,
  onCancel,
}: UnitBuilderProps) {
  // Parse unit size range
  const parseUnitSize = (sizeStr: string | null): { min: number; max: number } => {
    if (!sizeStr) return { min: 1, max: 1 };
    // eslint-disable-next-line security/detect-unsafe-regex -- simple pattern for unit size "X-Y"
    const match = sizeStr.match(/^(\d+)(?:-(\d+))?$/);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return { min, max };
    }
    return { min: 1, max: 10 };
  };

  const { min: minModels, max: maxModels } = parseUnitSize(datasheet.unitSize);

  // State
  const [unitName, setUnitName] = useState(initialUnit?.name || datasheet.name);
  const [modelCount, setModelCount] = useState(initialUnit?.modelCount || minModels);
  const [selectedWeapons, setSelectedWeapons] = useState<Set<string>>(() => {
    if (initialUnit?.weapons) {
      return new Set(initialUnit.weapons.map(w => w.name));
    }
    // Default: select all default weapons
    return new Set(datasheet.weapons.filter(w => w.isDefault).map(w => w.name));
  });
  const [enhancement, setEnhancement] = useState(initialUnit?.enhancements?.[0] || '');

  // Build composition map for points calculation
  const compositionMap = useMemo((): Record<string, number> => {
    const compData = datasheet.compositionData;
    if (!compData || compData.length === 0) {
      // Simple unit - just use model count
      return { [datasheet.name]: modelCount };
    }
    
    // For multi-model-type units, we need to distribute the model count
    // For now, use the base composition ratios scaled to model count
    // TODO: Add UI controls for selecting model type counts
    const baseTotal = compData.reduce((sum, c) => sum + c.count, 0);
    const map: Record<string, number> = {};
    
    if (baseTotal === 0) {
      // All optional - use first model type only
      if (compData.length > 0) {
        map[compData[0].name] = modelCount;
      }
    } else {
      // Scale each model type proportionally
      let remaining = modelCount;
      for (let i = 0; i < compData.length; i++) {
        const c = compData[i];
        if (c.count === 0) continue; // Skip optional types with 0 count
        
        if (i === compData.length - 1 || remaining <= 0) {
          // Last type gets remaining models
          map[c.name] = remaining;
        } else {
          const scaled = Math.round((c.count / baseTotal) * modelCount);
          map[c.name] = scaled;
          remaining -= scaled;
        }
      }
    }
    
    return map;
  }, [datasheet.compositionData, datasheet.name, modelCount]);

  // Calculate points based on points tiers (supports simple, composition-based, and add-on)
  const calculatedPoints = useMemo(() => {
    const tiers = datasheet.pointsTiers;
    
    if (!tiers || tiers.length === 0) {
      return datasheet.pointsCost;
    }
    
    // Helper to check if compositions match
    const compositionsMatch = (tierComp: Record<string, number>, unitComp: Record<string, number>): boolean => {
      const tierKeys = Object.keys(tierComp).filter(k => tierComp[k] > 0);
      const unitKeys = Object.keys(unitComp).filter(k => unitComp[k] > 0);
      
      if (tierKeys.length !== unitKeys.length) return false;
      
      for (const key of tierKeys) {
        if (tierComp[key] !== unitComp[key]) return false;
      }
      return true;
    };
    
    let basePoints = 0;
    let addOnPoints = 0;
    
    // Try composition-based match first
    for (const tier of tiers) {
      if (isCompositionTier(tier)) {
        if (compositionsMatch(tier.composition, compositionMap)) {
          basePoints = tier.points;
          break;
        }
      }
    }
    
    // If no composition match, try simple model count match
    if (basePoints === 0) {
      // Get add-on model types to exclude from core count
      const addOnTypes = tiers
        .filter((t): t is AddOnPointsTier => isAddOnTier(t))
        .map(t => t.addOn);
      
      // Calculate core model count (excluding add-ons)
      const coreModelCount = Object.entries(compositionMap)
        .filter(([type]) => !addOnTypes.includes(type))
        .reduce((sum, [, count]) => sum + count, 0);
      
      // Find matching simple tier
      const simpleTiers = tiers.filter((t): t is SimplePointsTier => 
        !isCompositionTier(t) && !isAddOnTier(t)
      );
      
      const exactMatch = simpleTiers.find(t => t.models === coreModelCount);
      if (exactMatch) {
        basePoints = exactMatch.points;
      } else if (simpleTiers.length > 0) {
        // Find highest tier that doesn't exceed model count
        let applicableTier = simpleTiers[0];
        for (const tier of simpleTiers) {
          if (tier.models <= coreModelCount) {
            applicableTier = tier;
          } else {
            break;
          }
        }
        basePoints = applicableTier.points;
      }
    }
    
    // Calculate add-on points for any add-on models present in composition
    for (const tier of tiers) {
      if (isAddOnTier(tier)) {
        const addOnCount = compositionMap[tier.addOn] || 0;
        if (addOnCount > 0) {
          addOnPoints += tier.addOnPoints * addOnCount;
        }
      }
    }
    
    return (basePoints || datasheet.pointsCost) + addOnPoints;
  }, [datasheet.pointsCost, datasheet.pointsTiers, compositionMap]);

  // Build composition based on model count and compositionData
  const composition = useMemo((): CompositionEntry[] => {
    const comp: CompositionEntry[] = [];
    const compData = datasheet.compositionData;
    
    // If we have compositionData, use it to build accurate composition
    if (compData && compData.length > 0) {
      for (const [modelType, count] of Object.entries(compositionMap)) {
        if (count <= 0) continue;
        
        // Find the matching model type in compositionData
        const modelInfo = compData.find(c => c.name === modelType);
        const role = modelInfo?.role === 'leader' ? 'leader' : 'regular';
        const wounds = modelInfo?.woundsPerModel || datasheet.wounds;
        
        comp.push({
          modelType,
          role: role as 'leader' | 'regular',
          count,
          weapons: Array.from(selectedWeapons),
          woundsPerModel: wounds,
        });
      }
      return comp;
    }
    
    // Fallback: simple composition for units without compositionData
    // If single model unit (character/vehicle)
    if (maxModels === 1) {
      comp.push({
        modelType: datasheet.name,
        role: datasheet.role === 'Character' ? 'leader' : 'regular',
        count: 1,
        weapons: Array.from(selectedWeapons),
        woundsPerModel: datasheet.wounds,
      });
    } else {
      // Multi-model unit - add sergeant/leader if applicable
      const hasLeader = datasheet.composition.toLowerCase().includes('sergeant') ||
                        datasheet.composition.toLowerCase().includes('leader') ||
                        datasheet.composition.toLowerCase().includes('pack leader');
      
      // Derive model type from datasheet name (e.g., "Intercessor Squad" -> "Intercessor")
      const baseModelType = datasheet.name.replace(/\s*(Squad|Pack|Unit)$/i, '').trim();
      
      if (hasLeader && modelCount > 0) {
        comp.push({
          modelType: `${baseModelType} Sergeant`,
          role: 'sergeant',
          count: 1,
          weapons: Array.from(selectedWeapons),
          woundsPerModel: datasheet.wounds,
        });
      }
      
      // Add regular models
      const regularCount = hasLeader ? modelCount - 1 : modelCount;
      if (regularCount > 0) {
        comp.push({
          modelType: baseModelType,
          role: 'regular',
          count: regularCount,
          weapons: Array.from(selectedWeapons),
          woundsPerModel: datasheet.wounds,
        });
      }
    }
    
    return comp;
  }, [modelCount, selectedWeapons, datasheet, maxModels, compositionMap]);

  // Toggle weapon selection
  const toggleWeapon = (weaponName: string) => {
    const newSet = new Set(selectedWeapons);
    if (newSet.has(weaponName)) {
      newSet.delete(weaponName);
    } else {
      newSet.add(weaponName);
    }
    setSelectedWeapons(newSet);
  };

  // Handle save
  const handleSave = () => {
    const unitConfig: UnitConfig = {
      name: unitName,
      datasheet: datasheet.name,
      datasheetId: datasheet.id,
      modelCount,
      pointsCost: calculatedPoints,
      composition,
      weapons: datasheet.weapons
        .filter(w => selectedWeapons.has(w.name))
        .map(w => ({
          weaponId: w.id,
          name: w.name,
          range: w.range,
          type: w.type,
          attacks: w.attacks,
          ballisticSkill: w.ballisticSkill,
          weaponSkill: w.weaponSkill,
          strength: w.strength,
          armorPenetration: w.armorPenetration,
          damage: w.damage,
          abilities: w.abilities,
          matchConfidence: 1.0,
          needsReview: false,
        })),
      abilities: datasheet.abilities.map(a => ({
        abilityId: a.id,
        name: a.name,
        type: a.type,
        description: a.description,
        matchConfidence: 1.0,
        needsReview: false,
      })),
      keywords: datasheet.keywords,
      enhancements: enhancement ? [enhancement] : [],
      needsReview: false,
    };
    
    onSave(unitConfig);
  };

  // Separate weapons by type
  const rangedWeapons = datasheet.weapons.filter(w => w.range !== 'Melee');
  const meleeWeapons = datasheet.weapons.filter(w => w.range === 'Melee');

  return (
    <div className="bg-grimlog-black border-2 border-grimlog-orange">
      {/* Header */}
      <div className="p-4 border-b border-grimlog-steel bg-grimlog-darkGray">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-grimlog-orange tracking-wider">
              {initialUnit ? 'EDIT UNIT' : 'CREATE UNIT'}
            </h2>
            <p className="text-sm text-grimlog-light-steel mt-1">
              Based on: {datasheet.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-grimlog-green font-mono">
              {calculatedPoints}
            </div>
            <div className="text-xs text-grimlog-light-steel">POINTS</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Reference (Collapsed) */}
        <div className="grid grid-cols-6 gap-2 bg-grimlog-darkGray p-3 border border-grimlog-steel">
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">M</div>
            <div className="text-lg font-bold text-white">{datasheet.movement}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">T</div>
            <div className="text-lg font-bold text-white">{datasheet.toughness}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">SV</div>
            <div className="text-lg font-bold text-white">{datasheet.save}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">W</div>
            <div className="text-lg font-bold text-white">{datasheet.wounds}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">LD</div>
            <div className="text-lg font-bold text-white">{datasheet.leadership}+</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-grimlog-light-steel">OC</div>
            <div className="text-lg font-bold text-white">{datasheet.objectiveControl}</div>
          </div>
        </div>

        {/* Unit Name */}
        <div>
          <label className="block text-grimlog-orange font-bold mb-2 text-sm tracking-wider">
            UNIT NAME
          </label>
          <input
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors"
            placeholder="Enter unit name"
          />
        </div>

        {/* Model Count */}
        <div>
          <label className="block text-grimlog-orange font-bold mb-2 text-sm tracking-wider">
            MODEL COUNT
            <span className="text-grimlog-light-steel font-normal ml-2">
              ({minModels}-{maxModels})
            </span>
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setModelCount(Math.max(minModels, modelCount - 1))}
              disabled={modelCount <= minModels}
              className="px-4 py-2 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-gray text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              -
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-white">{modelCount}</span>
              <span className="text-grimlog-light-steel ml-2">models</span>
            </div>
            <button
              onClick={() => setModelCount(Math.min(maxModels, modelCount + 1))}
              disabled={modelCount >= maxModels}
              className="px-4 py-2 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-gray text-grimlog-black font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Weapons Selection */}
        <div>
          <label className="block text-grimlog-orange font-bold mb-2 text-sm tracking-wider">
            WEAPONS
          </label>
          
          <div className="space-y-4">
            {/* Ranged Weapons */}
            {rangedWeapons.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-grimlog-green mb-2 font-mono">RANGED</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rangedWeapons.map((weapon) => (
                    <label
                      key={weapon.id}
                      className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                        selectedWeapons.has(weapon.name)
                          ? 'border-grimlog-orange bg-grimlog-darkGray'
                          : 'border-grimlog-steel bg-grimlog-black hover:border-grimlog-orange'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWeapons.has(weapon.name)}
                        onChange={() => toggleWeapon(weapon.name)}
                        className="mt-1 w-4 h-4 accent-grimlog-orange"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{weapon.name}</div>
                        <div className="text-xs text-grimlog-light-steel mt-0.5">
                          {weapon.range} | A{weapon.attacks} | S{weapon.strength} | AP{weapon.armorPenetration} | D{weapon.damage}
                        </div>
                        {weapon.abilities.length > 0 && (
                          <div className="text-xs text-grimlog-amber mt-0.5">
                            {weapon.abilities.join(', ')}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Melee Weapons */}
            {meleeWeapons.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-grimlog-red mb-2 font-mono">MELEE</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {meleeWeapons.map((weapon) => (
                    <label
                      key={weapon.id}
                      className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                        selectedWeapons.has(weapon.name)
                          ? 'border-grimlog-orange bg-grimlog-darkGray'
                          : 'border-grimlog-steel bg-grimlog-black hover:border-grimlog-orange'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWeapons.has(weapon.name)}
                        onChange={() => toggleWeapon(weapon.name)}
                        className="mt-1 w-4 h-4 accent-grimlog-orange"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{weapon.name}</div>
                        <div className="text-xs text-grimlog-light-steel mt-0.5">
                          Melee | A{weapon.attacks} | S{weapon.strength} | AP{weapon.armorPenetration} | D{weapon.damage}
                        </div>
                        {weapon.abilities.length > 0 && (
                          <div className="text-xs text-grimlog-amber mt-0.5">
                            {weapon.abilities.join(', ')}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composition Summary */}
        <div>
          <label className="block text-grimlog-orange font-bold mb-2 text-sm tracking-wider">
            COMPOSITION SUMMARY
          </label>
          <div className="bg-grimlog-darkGray border border-grimlog-steel p-3">
            {composition.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between py-1 text-sm">
                <span className="text-grimlog-light-steel">
                  {entry.role === 'sergeant' || entry.role === 'leader' ? '★ ' : ''}
                  {entry.modelType}
                </span>
                <span className="text-white font-mono">
                  {entry.count}x ({entry.woundsPerModel}W each)
                </span>
              </div>
            ))}
            <div className="border-t border-grimlog-steel mt-2 pt-2 flex justify-between text-sm">
              <span className="text-grimlog-orange font-bold">Total Wounds</span>
              <span className="text-white font-mono font-bold">
                {composition.reduce((sum, c) => sum + (c.count * c.woundsPerModel), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Enhancement (Optional) */}
        <div>
          <label className="block text-grimlog-orange font-bold mb-2 text-sm tracking-wider">
            ENHANCEMENT <span className="text-grimlog-light-steel font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={enhancement}
            onChange={(e) => setEnhancement(e.target.value)}
            className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors"
            placeholder="Enter enhancement name (if any)"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-grimlog-steel bg-grimlog-darkGray flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-grimlog-gray hover:bg-grimlog-steel text-white font-bold tracking-wider border-2 border-grimlog-steel transition-colors"
        >
          CANCEL
        </button>
        <button
          onClick={handleSave}
          disabled={!unitName || modelCount < minModels}
          className="flex-1 px-6 py-3 bg-grimlog-orange hover:bg-orange-600 text-grimlog-black font-bold tracking-wider border-2 border-grimlog-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initialUnit ? 'SAVE CHANGES' : 'ADD UNIT'}
        </button>
      </div>
    </div>
  );
}
