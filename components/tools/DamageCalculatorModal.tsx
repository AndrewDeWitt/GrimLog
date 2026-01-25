'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  calculateDamageWithProbabilities, 
  AttackerProfile, 
  DefenderProfile, 
  Modifiers, 
  parseDiceAverage,
  DamageResult 
} from '@/lib/damageCalculation';

interface UnitInstance {
  id: string;
  unitName: string;
  owner: string;
  datasheet: string;
  datasheetId: string | null;
  currentModels: number;
  woundsPerModel: number;
  fullDatasheet?: {
    id: string;
    name: string;
    faction: string;
    toughness: number;
    save: string;
    invulnerableSave: string | null;
    wounds: number;
    leadership: number;
    objectiveControl: number;
    abilities: any;
    weapons: Array<{
      id: string;
      weapon: {
        id: string;
        name: string;
        type: string;
        range: string;
        attacks: string;
        ballisticSkill: string | null;
        weaponSkill: string | null;
        strength: string;
        strengthValue: number | null;
        ap: string;
        apValue: number | null;
        damage: string;
        damageValue: number | null;
        abilities: string | null;
        structuredAbilities: string | null;
      };
      quantity: string | null;
      isDefault: boolean;
    }>;
  };
}

interface DamageCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

// Core stratagems that affect calculator
const ATTACKER_STRATAGEMS = [
  { id: 'command-reroll-hit', name: 'Command Re-roll (Hit)', cpCost: 1, description: 'Reroll one hit', effect: 'reroll_hit' },
  { id: 'fire-overwatch', name: 'Fire Overwatch', cpCost: 1, description: 'Hits on 6s only', effect: 'hit_on_6_only' },
];

const DEFENDER_STRATAGEMS = [
  { id: 'command-reroll-save', name: 'Command Re-roll (Save)', cpCost: 1, description: 'Reroll one save', effect: 'reroll_save' },
  { id: 'go-to-ground', name: 'Go to Ground', cpCost: 1, description: '6+ inv + Cover', effect: 'go_to_ground' },
  { id: 'smokescreen', name: 'Smokescreen', cpCost: 1, description: 'Cover + Stealth', effect: 'smokescreen' },
];

export default function DamageCalculatorModal({
  isOpen,
  onClose,
  sessionId
}: DamageCalculatorModalProps) {
  const [units, setUnits] = useState<UnitInstance[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [selectedAttacker, setSelectedAttacker] = useState<string>('');
  const [selectedDefender, setSelectedDefender] = useState<string>('');
  const [selectedWeapon, setSelectedWeapon] = useState<string>('');
  
  // Stratagem toggles
  const [activeAttackerStratagems, setActiveAttackerStratagems] = useState<string[]>([]);
  const [activeDefenderStratagems, setActiveDefenderStratagems] = useState<string[]>([]);
  
  // Modifiers
  const [modifiers, setModifiers] = useState<Modifiers>({
    reroll_hits: undefined,
    reroll_wounds: undefined,
    plus_to_hit: 0,
    plus_to_wound: 0,
    cover: false,
    stealth: false,
    lethal_hits: false,
    sustained_hits: 0,
    devastating_wounds: false,
    lance: false
  });
  
  // Results
  const [results, setResults] = useState<DamageResult & { 
    attacker: string; 
    defender: string; 
    weapon: string; 
    attackerModels: number; 
    totalAttacks: number;
    activeStratagems: string[];
  } | null>(null);

  const fetchUnits = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/units`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only include units that have full datasheets with weapons
        const unitsWithDatasheets = data.unitInstances.filter(
          (u: UnitInstance) => u.fullDatasheet && u.fullDatasheet.weapons && u.fullDatasheet.weapons.length > 0
        );
        setUnits(unitsWithDatasheets);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Fetch units when modal opens
  useEffect(() => {
    if (isOpen && sessionId) {
      fetchUnits();
    }
  }, [isOpen, sessionId, fetchUnits]);

  const toggleAttackerStratagem = (id: string) => {
    setActiveAttackerStratagems(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
    setResults(null);
  };

  const toggleDefenderStratagem = (id: string) => {
    setActiveDefenderStratagems(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
    setResults(null);
  };

  const handleCalculate = () => {
    const attacker = units.find(u => u.id === selectedAttacker);
    const defender = units.find(u => u.id === selectedDefender);
    const weapon = attacker?.fullDatasheet?.weapons.find(w => w.id === selectedWeapon);

    if (!attacker || !defender || !weapon || !attacker.fullDatasheet || !defender.fullDatasheet) {
      return;
    }

    // Parse weapon abilities
    let abilities: any[] = [];
    if (weapon.weapon.structuredAbilities) {
      try {
        abilities = JSON.parse(weapon.weapon.structuredAbilities);
      } catch (e) {
        console.warn('Failed to parse weapon abilities');
      }
    }

    // Calculate attacks
    const attacksPerModel = parseDiceAverage(weapon.weapon.attacks);
    const totalAttacks = attacksPerModel * attacker.currentModels;

    // Build modifiers from active stratagems
    const calculationModifiers = { ...modifiers };
    const activeStratagems: string[] = [];

    // Apply attacker stratagems
    if (activeAttackerStratagems.includes('fire-overwatch')) {
      calculationModifiers.hit_on_6_only = true;
      activeStratagems.push('Fire Overwatch');
    }

    // Apply defender stratagems
    if (activeDefenderStratagems.includes('go-to-ground')) {
      calculationModifiers.cover = true;
      activeStratagems.push('Go to Ground');
    }
    if (activeDefenderStratagems.includes('smokescreen')) {
      calculationModifiers.cover = true;
      calculationModifiers.stealth = true;
      activeStratagems.push('Smokescreen');
    }

    // Build attacker profile
    const attackerProfile: AttackerProfile = {
      bs_ws: weapon.weapon.ballisticSkill || weapon.weapon.weaponSkill || '4+',
      strength: weapon.weapon.strengthValue || parseInt(weapon.weapon.strength) || 4,
      ap: weapon.weapon.apValue || 0,
      damage: weapon.weapon.damageValue || parseDiceAverage(weapon.weapon.damage || '1'),
      attacks: totalAttacks,
      abilities: abilities
    };

    // Build defender profile
    const defenderProfile: DefenderProfile = {
      toughness: defender.fullDatasheet.toughness,
      save: defender.fullDatasheet.save,
      invuln: activeDefenderStratagems.includes('go-to-ground') 
        ? '6+' 
        : defender.fullDatasheet.invulnerableSave || undefined,
      wounds: defender.woundsPerModel,
      modelCount: defender.currentModels
    };

    // Calculate damage with probability distributions
    const result = calculateDamageWithProbabilities(attackerProfile, defenderProfile, calculationModifiers);
    
    setResults({
      attacker: attacker.unitName,
      defender: defender.unitName,
      weapon: weapon.weapon.name,
      attackerModels: attacker.currentModels,
      totalAttacks,
      activeStratagems,
      ...result
    });
  };

  const attackerUnits = units.filter(u => u.owner === 'attacker' || u.owner === 'player');
  const defenderUnits = units.filter(u => u.owner === 'defender' || u.owner === 'opponent');
  const selectedAttackerUnit = units.find(u => u.id === selectedAttacker);
  const availableWeapons = selectedAttackerUnit?.fullDatasheet?.weapons || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-4xl mx-auto max-h-[85vh] overflow-y-auto rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel sticky top-0 z-10">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-[44px] bg-grimlog-slate-dark border-b border-grimlog-steel p-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 tracking-widest uppercase flex items-center gap-2">
              <span>⚔</span> MATHHAMMER CALCULATOR
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-lg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="text-gray-600 text-xs font-mono mt-2">
            Calculate expected damage with probability distributions
          </p>
        </div>

        {/* Content */}
        <div className="p-6 bg-grimlog-slate-light">
          {!sessionId ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No active session. Start a battle to use the calculator.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="text-grimlog-orange text-4xl mb-4">◎</div>
              <p className="text-grimlog-orange">Loading units...</p>
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No units with datasheets found. Initialize units first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Inputs */}
              <div className="space-y-4">
                {/* Attacker Selection */}
                <div className="bg-white border border-gray-300 p-4 rounded-lg">
                  <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
                    Attacker Unit
                  </label>
                  <select
                    value={selectedAttacker}
                    onChange={(e) => {
                      setSelectedAttacker(e.target.value);
                      setSelectedWeapon('');
                      setResults(null);
                    }}
                    className="w-full bg-white border border-gray-300 text-gray-800 p-2 font-mono text-sm focus:outline-none focus:border-grimlog-orange rounded-lg"
                  >
                    <option value="">Select Attacker...</option>
                    {attackerUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitName} ({unit.currentModels} models)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Weapon Selection */}
                {selectedAttacker && (
                  <div className="bg-white border border-gray-300 p-4 rounded-lg">
                    <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
                      Weapon
                    </label>
                    <select
                      value={selectedWeapon}
                      onChange={(e) => {
                        setSelectedWeapon(e.target.value);
                        setResults(null);
                      }}
                      className="w-full bg-white border border-gray-300 text-gray-800 p-2 font-mono text-sm focus:outline-none focus:border-grimlog-orange rounded-lg"
                    >
                      <option value="">Select Weapon...</option>
                      {availableWeapons.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.weapon.name} - {w.weapon.attacks}A S{w.weapon.strength} AP{w.weapon.ap} D{w.weapon.damage}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Defender Selection */}
                <div className="bg-white border border-gray-300 p-4 rounded-lg">
                  <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
                    Defender Unit
                  </label>
                  <select
                    value={selectedDefender}
                    onChange={(e) => {
                      setSelectedDefender(e.target.value);
                      setResults(null);
                    }}
                    className="w-full bg-white border border-gray-300 text-gray-800 p-2 font-mono text-sm focus:outline-none focus:border-grimlog-orange rounded-lg"
                  >
                    <option value="">Select Defender...</option>
                    {defenderUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitName} (T{unit.fullDatasheet?.toughness} Sv{unit.fullDatasheet?.save} {unit.woundsPerModel}W)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Core Stratagems (Compact) */}
                <div className="bg-white border border-gray-300 p-4 rounded-lg">
                  <h3 className="text-grimlog-orange text-sm font-bold mb-3 uppercase tracking-wider">
                    ⚡ Stratagems
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Attacker */}
                    <div>
                      <span className="text-green-600 text-xs font-bold uppercase block mb-2">Attacker</span>
                      <div className="space-y-1">
                        {ATTACKER_STRATAGEMS.map(strat => (
                          <label 
                            key={strat.id}
                            className={`flex items-center gap-2 p-1.5 text-xs cursor-pointer rounded ${
                              activeAttackerStratagems.includes(strat.id) 
                                ? 'bg-orange-100 text-grimlog-orange border border-grimlog-orange' 
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={activeAttackerStratagems.includes(strat.id)}
                              onChange={() => toggleAttackerStratagem(strat.id)}
                              className="w-3 h-3 accent-grimlog-orange"
                            />
                            <span>{strat.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    {/* Defender */}
                    <div>
                      <span className="text-green-600 text-xs font-bold uppercase block mb-2">Defender</span>
                      <div className="space-y-1">
                        {DEFENDER_STRATAGEMS.map(strat => (
                          <label 
                            key={strat.id}
                            className={`flex items-center gap-2 p-1.5 text-xs cursor-pointer rounded ${
                              activeDefenderStratagems.includes(strat.id) 
                                ? 'bg-orange-100 text-grimlog-orange border border-grimlog-orange' 
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={activeDefenderStratagems.includes(strat.id)}
                              onChange={() => toggleDefenderStratagem(strat.id)}
                              className="w-3 h-3 accent-grimlog-orange"
                            />
                            <span>{strat.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modifiers */}
                <div className="bg-white border border-gray-300 p-4 rounded-lg">
                  <h3 className="text-grimlog-orange text-sm font-bold mb-3 uppercase tracking-wider">
                    Modifiers
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Hit Rerolls */}
                    <div>
                      <label className="block text-gray-700 text-xs mb-1">Reroll Hits</label>
                      <select
                        value={modifiers.reroll_hits || ''}
                        onChange={(e) => setModifiers({ ...modifiers, reroll_hits: e.target.value as any || undefined })}
                        className="w-full bg-white border border-gray-300 text-gray-800 p-1 font-mono text-xs rounded"
                      >
                        <option value="">None</option>
                        <option value="ones">Reroll 1s</option>
                        <option value="all">Reroll All</option>
                      </select>
                    </div>

                    {/* Wound Rerolls */}
                    <div>
                      <label className="block text-gray-700 text-xs mb-1">Reroll Wounds</label>
                      <select
                        value={modifiers.reroll_wounds || ''}
                        onChange={(e) => setModifiers({ ...modifiers, reroll_wounds: e.target.value as any || undefined })}
                        className="w-full bg-white border border-gray-300 text-gray-800 p-1 font-mono text-xs rounded"
                      >
                        <option value="">None</option>
                        <option value="ones">Reroll 1s</option>
                        <option value="all">Reroll All</option>
                      </select>
                    </div>

                    {/* Hit/Wound Modifiers */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-700 text-xs mb-1">Hit Modifier</label>
                        <select
                          value={modifiers.plus_to_hit || 0}
                          onChange={(e) => setModifiers({ ...modifiers, plus_to_hit: parseInt(e.target.value) })}
                          className="w-full bg-white border border-gray-300 text-gray-800 p-1 font-mono text-xs rounded"
                        >
                          <option value="-1">-1 to Hit</option>
                          <option value="0">No Modifier</option>
                          <option value="1">+1 to Hit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-700 text-xs mb-1">Wound Modifier</label>
                        <select
                          value={modifiers.plus_to_wound || 0}
                          onChange={(e) => setModifiers({ ...modifiers, plus_to_wound: parseInt(e.target.value) })}
                          className="w-full bg-white border border-gray-300 text-gray-800 p-1 font-mono text-xs rounded"
                        >
                          <option value="-1">-1 to Wound</option>
                          <option value="0">No Modifier</option>
                          <option value="1">+1 to Wound</option>
                        </select>
                      </div>
                    </div>

                    {/* Toggle Modifiers */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modifiers.cover || false}
                          onChange={(e) => setModifiers({ ...modifiers, cover: e.target.checked })}
                          className="w-4 h-4 accent-grimlog-orange"
                        />
                        Cover
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modifiers.stealth || false}
                          onChange={(e) => setModifiers({ ...modifiers, stealth: e.target.checked })}
                          className="w-4 h-4 accent-grimlog-orange"
                        />
                        Stealth
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modifiers.lethal_hits || false}
                          onChange={(e) => setModifiers({ ...modifiers, lethal_hits: e.target.checked })}
                          className="w-4 h-4 accent-grimlog-orange"
                        />
                        Lethal Hits
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modifiers.devastating_wounds || false}
                          onChange={(e) => setModifiers({ ...modifiers, devastating_wounds: e.target.checked })}
                          className="w-4 h-4 accent-grimlog-orange"
                        />
                        Dev. Wounds
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modifiers.lance || false}
                          onChange={(e) => setModifiers({ ...modifiers, lance: e.target.checked })}
                          className="w-4 h-4 accent-grimlog-orange"
                        />
                        Lance
                      </label>
                    </div>

                    {/* Sustained Hits */}
                    <div>
                      <label className="block text-gray-700 text-xs mb-1">Sustained Hits</label>
                      <input
                        type="number"
                        min="0"
                        max="3"
                        value={modifiers.sustained_hits || 0}
                        onChange={(e) => setModifiers({ ...modifiers, sustained_hits: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white border border-gray-300 text-gray-800 p-1 font-mono text-xs rounded"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculate Button */}
                <button
                  onClick={handleCalculate}
                  disabled={!selectedAttacker || !selectedDefender || !selectedWeapon}
                  className="w-full py-3 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold uppercase tracking-wider transition-all disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg"
                >
                  Calculate Damage
                </button>
              </div>

              {/* Right Column: Results */}
              <div className="bg-white border border-gray-300 p-4 rounded-lg">
                <h3 className="text-grimlog-orange text-sm font-bold mb-4 uppercase tracking-wider border-b border-gray-300 pb-2">
                  Results
                </h3>
                
                {!results ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-sm">Configure attack parameters and click Calculate</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="bg-gray-50 border border-grimlog-orange p-3 rounded-lg">
                      <div className="text-gray-700 text-xs font-mono space-y-1">
                        <p><span className="text-grimlog-orange font-bold">Attacker:</span> {results.attacker} ({results.attackerModels} models)</p>
                        <p><span className="text-grimlog-orange font-bold">Weapon:</span> {results.weapon}</p>
                        <p><span className="text-grimlog-orange font-bold">Defender:</span> {results.defender}</p>
                        <p><span className="text-grimlog-orange font-bold">Total Attacks:</span> {results.totalAttacks}</p>
                        {results.activeStratagems.length > 0 && (
                          <p><span className="text-amber-600 font-bold">Stratagems:</span> {results.activeStratagems.join(', ')}</p>
                        )}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-gray-700 text-sm">Expected Hits:</span>
                        <span className="text-amber-600 font-bold font-mono">{results.expected_hits.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-gray-700 text-sm">Expected Wounds:</span>
                        <span className="text-amber-600 font-bold font-mono">{results.expected_wounds.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-gray-700 text-sm">Unsaved Wounds:</span>
                        <span className="text-amber-600 font-bold font-mono">{results.expected_unsaved.toFixed(2)}</span>
                      </div>
                      {results.mortal_wounds > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-red-600 text-sm">Mortal Wounds:</span>
                          <span className="text-red-600 font-bold font-mono">{results.mortal_wounds.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-3 border-b-2 border-grimlog-orange bg-orange-50 px-2 rounded-lg">
                        <span className="text-grimlog-orange text-base font-bold uppercase">Total Damage:</span>
                        <span className="text-grimlog-orange text-2xl font-bold font-mono">{results.expected_damage.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 bg-amber-50 px-2 rounded-lg">
                        <span className="text-amber-600 text-base font-bold uppercase">Models Killed:</span>
                        <span className="text-amber-600 text-2xl font-bold font-mono">{results.models_killed.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Kill Probability */}
                    {results.probability_to_kill && (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                        <h4 className="text-green-700 text-xs font-bold mb-2 uppercase">🎯 Kill Probability</h4>
                        
                        <div className="space-y-1 mb-2">
                          {results.probability_to_kill.exactly.slice(0, 4).map((prob, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-gray-600 text-xs w-16">
                                {i === 0 ? 'Kill 0:' : i === 3 ? 'Kill 3+:' : `Kill ${i}:`}
                              </span>
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${Math.min(prob * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-amber-600 text-xs font-mono w-10 text-right">
                                {(prob * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="bg-white p-2 rounded text-center border border-green-200">
                          <span className="text-amber-600 font-bold">
                            {(results.probability_to_kill.atLeast1 * 100).toFixed(0)}%
                          </span>
                          <span className="text-green-600 text-xs ml-1">to kill ≥1</span>
                        </div>
                      </div>
                    )}

                    {/* Probabilities */}
                    <div className="bg-gray-50 border border-gray-200 p-3 mt-4 rounded-lg">
                      <h4 className="text-gray-700 text-xs font-bold mb-2 uppercase">Roll Rates</h4>
                      <div className="grid grid-cols-2 gap-1 text-xs font-mono text-gray-600">
                        <p>Hit: {(results.hit_rate * 100).toFixed(0)}%</p>
                        <p>Wound: {(results.wound_rate * 100).toFixed(0)}%</p>
                        <p>Save: {(results.save_rate * 100).toFixed(0)}%</p>
                        <p>Crit: {(results.crit_hit_chance * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
