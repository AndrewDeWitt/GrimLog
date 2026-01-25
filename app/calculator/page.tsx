'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
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
    keywords?: string;
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

// Core stratagems that affect calculator
const ATTACKER_STRATAGEMS = [
  { id: 'command-reroll-hit', name: 'Command Re-roll (Hit)', cpCost: 1, description: 'Reroll one hit die', effect: 'reroll_hit' },
  { id: 'command-reroll-wound', name: 'Command Re-roll (Wound)', cpCost: 1, description: 'Reroll one wound die', effect: 'reroll_wound' },
  { id: 'fire-overwatch', name: 'Fire Overwatch', cpCost: 1, description: 'Hits on 6s only', effect: 'hit_on_6_only', restriction: 'NOT TITANIC' },
  { id: 'grenade', name: 'Grenade', cpCost: 1, description: '6D6, 4+ = MW', effect: 'grenade', restriction: 'GRENADES keyword' },
  { id: 'tank-shock', name: 'Tank Shock', cpCost: 1, description: 'T×D6, 5+ = MW (max 6)', effect: 'tank_shock', restriction: 'VEHICLE keyword' },
];

const DEFENDER_STRATAGEMS = [
  { id: 'command-reroll-save', name: 'Command Re-roll (Save)', cpCost: 1, description: 'Reroll one save', effect: 'reroll_save' },
  { id: 'go-to-ground', name: 'Go to Ground', cpCost: 1, description: '6+ invuln + Cover', effect: 'go_to_ground', restriction: 'INFANTRY only' },
  { id: 'smokescreen', name: 'Smokescreen', cpCost: 1, description: 'Cover + Stealth', effect: 'smokescreen', restriction: 'SMOKE keyword' },
];

export default function CalculatorPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  // Load current session from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSessionId = localStorage.getItem('grimlog-current-session');
      setSessionId(savedSessionId);
      if (savedSessionId) {
        fetchUnits(savedSessionId);
      }
    }
  }, []);

  const fetchUnits = async (sid: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sid}/units`);
      if (response.ok) {
        const data = await response.json();
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
  };

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
      activeStratagems.push('Go to Ground (6+ inv + Cover)');
    }
    if (activeDefenderStratagems.includes('smokescreen')) {
      calculationModifiers.cover = true;
      calculationModifiers.stealth = true;
      activeStratagems.push('Smokescreen (Cover + Stealth)');
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
        ? '6+' // Go to Ground gives 6+ invuln
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

  // Calculate total CP cost from active stratagems
  const attackerCPCost = ATTACKER_STRATAGEMS
    .filter(s => activeAttackerStratagems.includes(s.id))
    .reduce((sum, s) => sum + s.cpCost, 0);
  const defenderCPCost = DEFENDER_STRATAGEMS
    .filter(s => activeDefenderStratagems.includes(s.id))
    .reduce((sum, s) => sum + s.cpCost, 0);

  return (
    <>
      <GrimlogFrame />
      
      <main className="min-h-screen pt-4 pb-4">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <header className="py-6 border-b-2 border-grimlog-steel mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase">
                  ⚔ MATHHAMMER CALCULATOR
                </h1>
                <p className="text-grimlog-green text-sm font-mono mt-2">
                  Calculate expected damage output with probability distributions
                </p>
              </div>
            </div>
          </header>

          {/* Back Button */}
          <div className="mb-6">
            <Link
              href="/sessions/live"
              className="inline-block px-6 py-3 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border-2 border-grimlog-green transition-all uppercase"
            >
              ← BACK TO BATTLE
            </Link>
          </div>

          {/* Content */}
          <div className="bg-grimlog-black border-2 border-grimlog-steel p-6">
            {!sessionId ? (
              <div className="text-center py-12">
                <p className="text-grimlog-steel text-lg mb-4">No active session. Start a battle to use the calculator.</p>
                <Link
                  href="/sessions/new"
                  className="inline-block px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider uppercase"
                >
                  START NEW BATTLE
                </Link>
              </div>
            ) : loading ? (
              <div className="text-center py-12">
                <div className="text-grimlog-orange text-4xl mb-4">◎</div>
                <p className="text-grimlog-orange">Loading units...</p>
              </div>
            ) : units.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-grimlog-steel text-lg">No units with datasheets found. Initialize units first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                  {/* Attacker Selection */}
                  <div className="bg-grimlog-darkGray border border-grimlog-steel p-6">
                    <label className="block text-grimlog-orange text-base font-bold mb-3 uppercase tracking-wider">
                      Attacker Unit
                    </label>
                    <select
                      value={selectedAttacker}
                      onChange={(e) => {
                        setSelectedAttacker(e.target.value);
                        setSelectedWeapon('');
                        setResults(null);
                      }}
                      className="w-full bg-grimlog-black border-2 border-grimlog-steel text-grimlog-green p-3 font-mono text-base focus:outline-none focus:border-grimlog-orange"
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
                    <div className="bg-grimlog-darkGray border border-grimlog-steel p-6">
                      <label className="block text-grimlog-orange text-base font-bold mb-3 uppercase tracking-wider">
                        Weapon
                      </label>
                      <select
                        value={selectedWeapon}
                        onChange={(e) => {
                          setSelectedWeapon(e.target.value);
                          setResults(null);
                        }}
                        className="w-full bg-grimlog-black border-2 border-grimlog-steel text-grimlog-green p-3 font-mono text-base focus:outline-none focus:border-grimlog-orange"
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
                  <div className="bg-grimlog-darkGray border border-grimlog-steel p-6">
                    <label className="block text-grimlog-orange text-base font-bold mb-3 uppercase tracking-wider">
                      Defender Unit
                    </label>
                    <select
                      value={selectedDefender}
                      onChange={(e) => {
                        setSelectedDefender(e.target.value);
                        setResults(null);
                      }}
                      className="w-full bg-grimlog-black border-2 border-grimlog-steel text-grimlog-green p-3 font-mono text-base focus:outline-none focus:border-grimlog-orange"
                    >
                      <option value="">Select Defender...</option>
                      {defenderUnits.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unitName} (T{unit.fullDatasheet?.toughness} Sv{unit.fullDatasheet?.save} {unit.woundsPerModel}W)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Core Stratagems Section */}
                  <div className="bg-grimlog-darkGray border border-grimlog-steel p-6">
                    <h3 className="text-grimlog-orange text-base font-bold mb-4 uppercase tracking-wider border-b border-grimlog-steel pb-2">
                      ⚡ Core Stratagems
                    </h3>
                    
                    {/* Attacker Stratagems */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-grimlog-green text-sm font-bold uppercase">Attacker</span>
                        {attackerCPCost > 0 && (
                          <span className="text-grimlog-amber text-xs font-mono">-{attackerCPCost} CP</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {ATTACKER_STRATAGEMS.map(strat => (
                          <label 
                            key={strat.id}
                            className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-all ${
                              activeAttackerStratagems.includes(strat.id) 
                                ? 'bg-grimlog-orange/20 border border-grimlog-orange' 
                                : 'hover:bg-grimlog-steel/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={activeAttackerStratagems.includes(strat.id)}
                              onChange={() => toggleAttackerStratagem(strat.id)}
                              className="w-4 h-4 mt-0.5 accent-grimlog-orange"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-grimlog-green text-sm">{strat.name}</span>
                                <span className="text-grimlog-amber text-xs">({strat.cpCost}CP)</span>
                              </div>
                              <p className="text-grimlog-steel text-xs">{strat.description}</p>
                              {strat.restriction && (
                                <p className="text-grimlog-amber/70 text-xs italic">{strat.restriction}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Defender Stratagems */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-grimlog-green text-sm font-bold uppercase">Defender</span>
                        {defenderCPCost > 0 && (
                          <span className="text-grimlog-amber text-xs font-mono">-{defenderCPCost} CP</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {DEFENDER_STRATAGEMS.map(strat => (
                          <label 
                            key={strat.id}
                            className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-all ${
                              activeDefenderStratagems.includes(strat.id) 
                                ? 'bg-grimlog-orange/20 border border-grimlog-orange' 
                                : 'hover:bg-grimlog-steel/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={activeDefenderStratagems.includes(strat.id)}
                              onChange={() => toggleDefenderStratagem(strat.id)}
                              className="w-4 h-4 mt-0.5 accent-grimlog-orange"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-grimlog-green text-sm">{strat.name}</span>
                                <span className="text-grimlog-amber text-xs">({strat.cpCost}CP)</span>
                              </div>
                              <p className="text-grimlog-steel text-xs">{strat.description}</p>
                              {strat.restriction && (
                                <p className="text-grimlog-amber/70 text-xs italic">{strat.restriction}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Modifiers */}
                  <div className="bg-grimlog-darkGray border border-grimlog-steel p-6">
                    <h3 className="text-grimlog-orange text-base font-bold mb-4 uppercase tracking-wider">
                      Modifiers
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Hit Rerolls */}
                      <div>
                        <label className="block text-grimlog-green text-sm mb-2">Reroll Hits</label>
                        <select
                          value={modifiers.reroll_hits || ''}
                          onChange={(e) => setModifiers({ ...modifiers, reroll_hits: e.target.value as any || undefined })}
                          className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-2 font-mono text-sm"
                        >
                          <option value="">None</option>
                          <option value="ones">Reroll 1s</option>
                          <option value="all">Reroll All</option>
                        </select>
                      </div>

                      {/* Wound Rerolls */}
                      <div>
                        <label className="block text-grimlog-green text-sm mb-2">Reroll Wounds</label>
                        <select
                          value={modifiers.reroll_wounds || ''}
                          onChange={(e) => setModifiers({ ...modifiers, reroll_wounds: e.target.value as any || undefined })}
                          className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-2 font-mono text-sm"
                        >
                          <option value="">None</option>
                          <option value="ones">Reroll 1s</option>
                          <option value="all">Reroll All</option>
                        </select>
                      </div>

                      {/* Hit/Wound Modifiers */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-grimlog-green text-sm mb-2">Hit Modifier</label>
                          <select
                            value={modifiers.plus_to_hit || 0}
                            onChange={(e) => setModifiers({ ...modifiers, plus_to_hit: parseInt(e.target.value) })}
                            className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-2 font-mono text-sm"
                          >
                            <option value="-1">-1 to Hit</option>
                            <option value="0">No Modifier</option>
                            <option value="1">+1 to Hit</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-grimlog-green text-sm mb-2">Wound Modifier</label>
                          <select
                            value={modifiers.plus_to_wound || 0}
                            onChange={(e) => setModifiers({ ...modifiers, plus_to_wound: parseInt(e.target.value) })}
                            className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-2 font-mono text-sm"
                          >
                            <option value="-1">-1 to Wound</option>
                            <option value="0">No Modifier</option>
                            <option value="1">+1 to Wound</option>
                          </select>
                        </div>
                      </div>

                      {/* Toggle Modifiers */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <label className="flex items-center gap-2 text-grimlog-green cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modifiers.cover || false}
                            onChange={(e) => setModifiers({ ...modifiers, cover: e.target.checked })}
                            className="w-4 h-4"
                          />
                          Cover
                        </label>
                        <label className="flex items-center gap-2 text-grimlog-green cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modifiers.stealth || false}
                            onChange={(e) => setModifiers({ ...modifiers, stealth: e.target.checked })}
                            className="w-4 h-4"
                          />
                          Stealth
                        </label>
                        <label className="flex items-center gap-2 text-grimlog-green cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modifiers.lethal_hits || false}
                            onChange={(e) => setModifiers({ ...modifiers, lethal_hits: e.target.checked })}
                            className="w-4 h-4"
                          />
                          Lethal Hits
                        </label>
                        <label className="flex items-center gap-2 text-grimlog-green cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modifiers.devastating_wounds || false}
                            onChange={(e) => setModifiers({ ...modifiers, devastating_wounds: e.target.checked })}
                            className="w-4 h-4"
                          />
                          Dev. Wounds
                        </label>
                        <label className="flex items-center gap-2 text-grimlog-green cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modifiers.lance || false}
                            onChange={(e) => setModifiers({ ...modifiers, lance: e.target.checked })}
                            className="w-4 h-4"
                          />
                          Lance
                        </label>
                      </div>

                      {/* Sustained Hits */}
                      <div>
                        <label className="block text-grimlog-green text-sm mb-2">Sustained Hits</label>
                        <input
                          type="number"
                          min="0"
                          max="3"
                          value={modifiers.sustained_hits || 0}
                          onChange={(e) => setModifiers({ ...modifiers, sustained_hits: parseInt(e.target.value) || 0 })}
                          className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-2 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={handleCalculate}
                    disabled={!selectedAttacker || !selectedDefender || !selectedWeapon}
                    className="w-full py-4 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold text-lg uppercase tracking-wider transition-all disabled:bg-grimlog-steel disabled:text-grimlog-darkGray disabled:cursor-not-allowed"
                  >
                    Calculate Damage
                  </button>
                </div>

                {/* Right Column: Results */}
                <div className="bg-grimlog-darkGray border-2 border-grimlog-steel p-6">
                  <h3 className="text-grimlog-orange text-xl font-bold mb-6 uppercase tracking-wider border-b-2 border-grimlog-steel pb-3">
                    Results
                  </h3>
                  
                  {!results ? (
                    <div className="text-center py-20 text-grimlog-steel">
                      <p className="text-lg">Configure attack parameters and click Calculate</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary */}
                      <div className="bg-grimlog-black border-2 border-grimlog-orange p-4">
                        <div className="text-grimlog-green text-sm font-mono space-y-2">
                          <p><span className="text-grimlog-orange font-bold">Attacker:</span> {results.attacker} ({results.attackerModels} models)</p>
                          <p><span className="text-grimlog-orange font-bold">Weapon:</span> {results.weapon}</p>
                          <p><span className="text-grimlog-orange font-bold">Defender:</span> {results.defender}</p>
                          <p><span className="text-grimlog-orange font-bold">Total Attacks:</span> {results.totalAttacks}</p>
                          {results.activeStratagems.length > 0 && (
                            <p><span className="text-grimlog-amber font-bold">Active Stratagems:</span> {results.activeStratagems.join(', ')}</p>
                          )}
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b-2 border-grimlog-steel">
                          <span className="text-grimlog-green text-base">Expected Hits:</span>
                          <span className="text-grimlog-amber font-bold font-mono text-xl">{results.expected_hits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b-2 border-grimlog-steel">
                          <span className="text-grimlog-green text-base">Expected Wounds:</span>
                          <span className="text-grimlog-amber font-bold font-mono text-xl">{results.expected_wounds.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b-2 border-grimlog-steel">
                          <span className="text-grimlog-green text-base">Unsaved Wounds:</span>
                          <span className="text-grimlog-amber font-bold font-mono text-xl">{results.expected_unsaved.toFixed(2)}</span>
                        </div>
                        {results.mortal_wounds > 0 && (
                          <div className="flex justify-between items-center py-3 border-b-2 border-grimlog-steel">
                            <span className="text-red-400 text-base">Mortal Wounds:</span>
                            <span className="text-red-400 font-bold font-mono text-xl">{results.mortal_wounds.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-4 border-b-4 border-grimlog-orange bg-grimlog-black/70 px-3">
                          <span className="text-grimlog-orange text-xl font-bold uppercase">Total Damage:</span>
                          <span className="text-grimlog-orange text-3xl font-bold font-mono glow-orange">{results.expected_damage.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-4 bg-grimlog-black/70 px-3">
                          <span className="text-grimlog-amber text-xl font-bold uppercase">Models Killed:</span>
                          <span className="text-grimlog-amber text-3xl font-bold font-mono glow-amber">{results.models_killed.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Kill Probability Section */}
                      {results.probability_to_kill && (
                        <div className="bg-grimlog-black border-2 border-grimlog-green p-4 mt-6">
                          <h4 className="text-grimlog-green text-base font-bold mb-4 uppercase tracking-wider">
                            🎯 Kill Probability
                          </h4>
                          
                          {/* Probability Bars */}
                          <div className="space-y-2 mb-4">
                            {results.probability_to_kill.exactly.slice(0, 4).map((prob, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-grimlog-steel text-sm w-24">
                                  {i === 0 ? 'Kill 0:' : i === 3 ? 'Kill 3+:' : `Kill ${i}:`}
                                </span>
                                <div className="flex-1 h-4 bg-grimlog-darkGray rounded overflow-hidden">
                                  <div 
                                    className="h-full bg-grimlog-green transition-all"
                                    style={{ width: `${Math.min(prob * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-grimlog-amber text-sm font-mono w-12 text-right">
                                  {(prob * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Key Stat */}
                          <div className="bg-grimlog-darkGray p-3 rounded border border-grimlog-green/50">
                            <p className="text-grimlog-green text-center">
                              <span className="text-grimlog-amber font-bold text-xl">
                                {(results.probability_to_kill.atLeast1 * 100).toFixed(0)}%
                              </span>
                              <span className="text-sm ml-2">chance to kill at least 1 model</span>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Probabilities */}
                      <div className="bg-grimlog-black border border-grimlog-steel p-4 mt-6">
                        <h4 className="text-grimlog-green text-sm font-bold mb-3 uppercase">Roll Probabilities</h4>
                        <div className="space-y-2 text-sm font-mono text-grimlog-steel">
                          <p>Hit Rate: {(results.hit_rate * 100).toFixed(1)}%</p>
                          <p>Wound Rate: {(results.wound_rate * 100).toFixed(1)}%</p>
                          <p>Save Rate: {(results.save_rate * 100).toFixed(1)}%</p>
                          <p>Crit Hit Chance: {(results.crit_hit_chance * 100).toFixed(1)}%</p>
                          <p>Crit Wound Chance: {(results.crit_wound_chance * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
