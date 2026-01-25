'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DatasheetCard from '@/components/DatasheetCard';
import DatasheetEditorModal from '@/components/DatasheetEditorModal';
import { CreateDatasheetInput } from '@/lib/datasheetValidation';

interface Faction {
  id: string;
  name: string;
}

interface Datasheet {
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
  pointsCost: number;
  composition: string;
  leaderRules: string | null;
  leaderAbilities: string | null;
  isOfficial?: boolean;
  iconUrl?: string | null;
}

interface ArmyUnit {
  id: string;
  datasheet: Datasheet;
  modelCount: number;
  pointsCost: number;
  wargear: string[];
  enhancements: string[];
}

interface Army {
  name: string;
  factionId: string | null;
  factionName: string;
  detachment: string | null;
  pointsLimit: number;
  units: ArmyUnit[];
}

const POINT_LIMITS = [500, 1000, 1500, 2000, 2500, 3000];

export default function ArmyBuilderPage() {
  const router = useRouter();
  
  // Army state
  const [army, setArmy] = useState<Army>({
    name: 'New Army',
    factionId: null,
    factionName: '',
    detachment: null,
    pointsLimit: 2000,
    units: [],
  });

  // UI state
  const [factions, setFactions] = useState<Faction[]>([]);
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ role: string; count: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showCustomOnly, setShowCustomOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDatasheet, setEditingDatasheet] = useState<Datasheet | null>(null);

  // Fetch factions on mount
  useEffect(() => {
    fetchFactions();
  }, []);

  // Fetch datasheets when faction changes
  useEffect(() => {
    if (army.factionId) {
      fetchDatasheets();
    }
  }, [army.factionId, searchQuery, selectedRole]);

  const fetchFactions = async () => {
    try {
      const res = await fetch('/api/factions');
      if (res.ok) {
        const data = await res.json();
        setFactions(data);
      }
    } catch (err) {
      console.error('Failed to fetch factions:', err);
    }
  };

  const fetchDatasheets = async () => {
    if (!army.factionId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        factionId: army.factionId,
        includeParent: 'true',
      });
      if (searchQuery) params.append('search', searchQuery);
      if (selectedRole) params.append('role', selectedRole);

      const res = await fetch(`/api/datasheets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDatasheets(data.datasheets);
        setAvailableRoles(data.availableRoles);
      }
    } catch (err) {
      console.error('Failed to fetch datasheets:', err);
    } finally {
      setLoading(false);
    }
  };

  const addUnit = (datasheet: Datasheet) => {
    const newUnit: ArmyUnit = {
      id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      datasheet,
      modelCount: 1,
      pointsCost: datasheet.pointsCost,
      wargear: [],
      enhancements: [],
    };
    setArmy(prev => ({
      ...prev,
      units: [...prev.units, newUnit],
    }));
  };

  const removeUnit = (unitId: string) => {
    setArmy(prev => ({
      ...prev,
      units: prev.units.filter(u => u.id !== unitId),
    }));
  };

  const updateUnitCount = (unitId: string, count: number) => {
    setArmy(prev => ({
      ...prev,
      units: prev.units.map(u => 
        u.id === unitId 
          ? { ...u, modelCount: count, pointsCost: u.datasheet.pointsCost * count }
          : u
      ),
    }));
  };

  const totalPoints = army.units.reduce((sum, u) => sum + u.pointsCost, 0);
  const isOverLimit = totalPoints > army.pointsLimit;

  const handleCreateDatasheet = async (data: CreateDatasheetInput) => {
    const res = await fetch('/api/datasheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create datasheet');
    }

    // Refresh datasheets list
    await fetchDatasheets();
  };

  const saveArmy = async () => {
    if (!army.name || !army.factionId || army.units.length === 0) {
      setError('Please provide a name, faction, and at least one unit');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const faction = factions.find(f => f.id === army.factionId);
      
      const res = await fetch('/api/armies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          armyName: army.name,
          playerName: 'Player', // Default for now
          faction: faction?.name || army.factionName,
          pointsLimit: army.pointsLimit,
          detachment: army.detachment,
          units: army.units.map(u => ({
            name: u.datasheet.name,
            datasheet: u.datasheet.name,
            parsedDatasheet: {
              datasheetId: u.datasheet.id,
              name: u.datasheet.name,
              factionId: u.datasheet.factionId,
              faction: u.datasheet.faction,
              subfaction: u.datasheet.subfaction,
              role: u.datasheet.role,
              keywords: u.datasheet.keywords,
              movement: u.datasheet.movement,
              toughness: u.datasheet.toughness,
              save: u.datasheet.save,
              invulnerableSave: u.datasheet.invulnerableSave,
              wounds: u.datasheet.wounds,
              leadership: u.datasheet.leadership,
              objectiveControl: u.datasheet.objectiveControl,
              pointsCost: u.datasheet.pointsCost,
              leaderRules: u.datasheet.leaderRules,
              leaderAbilities: u.datasheet.leaderAbilities,
              matchConfidence: 1.0,
              needsReview: false,
            },
            keywords: u.datasheet.keywords,
            pointsCost: u.pointsCost,
            modelCount: u.modelCount,
            composition: [],
            wargear: u.wargear,
            enhancements: u.enhancements,
            weapons: [],
            abilities: [],
            needsReview: false,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save army');
      }

      const result = await res.json();
      router.push(`/armies/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save army');
    } finally {
      setSaving(false);
    }
  };

  // Group units by role
  const unitsByRole = army.units.reduce((acc, unit) => {
    const role = unit.datasheet.role;
    if (!acc[role]) acc[role] = [];
    acc[role].push(unit);
    return acc;
  }, {} as Record<string, ArmyUnit[]>);

  return (
    <div className="min-h-screen bg-grimlog-black">
      {/* Header */}
      <div className="border-b border-grimlog-steel bg-grimlog-darkGray">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/armies" className="text-grimlog-orange hover:text-orange-400 text-sm mb-1 block">
                ← Back to Armies
              </Link>
              <h1 className="text-2xl font-bold text-grimlog-orange tracking-wider">ARMY BUILDER</h1>
            </div>
            <button
              onClick={saveArmy}
              disabled={saving || !army.factionId || army.units.length === 0}
              className={`px-6 py-2 font-bold ${
                saving || !army.factionId || army.units.length === 0
                  ? 'bg-grimlog-orange/50 text-grimlog-black/50 cursor-not-allowed'
                  : 'bg-grimlog-orange text-grimlog-black hover:bg-orange-600'
              }`}
            >
              {saving ? 'Saving...' : 'Save Army'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="p-3 bg-red-500/20 border border-red-500 text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-300 hover:text-white">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Datasheet Browser */}
          <div className="col-span-4 border border-grimlog-steel bg-grimlog-darkGray">
            <div className="p-4 border-b border-grimlog-steel">
              <h2 className="text-lg font-bold text-grimlog-orange mb-3">DATASHEETS</h2>
              
              {/* Faction Selector */}
              <select
                value={army.factionId || ''}
                onChange={e => {
                  const faction = factions.find(f => f.id === e.target.value);
                  setArmy(prev => ({
                    ...prev,
                    factionId: e.target.value || null,
                    factionName: faction?.name || '',
                    units: [],
                  }));
                }}
                className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white mb-3"
              >
                <option value="">Select Faction...</option>
                {factions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search datasheets..."
                className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white mb-3"
              />

              {/* Role Filter */}
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white mb-3"
              >
                <option value="">All Roles</option>
                {availableRoles.map(r => (
                  <option key={r.role} value={r.role}>{r.role} ({r.count})</option>
                ))}
              </select>

              {/* Create Custom Button */}
              <button
                onClick={() => {
                  setEditingDatasheet(null);
                  setIsEditorOpen(true);
                }}
                className="w-full px-3 py-2 bg-grimlog-gray border border-grimlog-orange text-grimlog-orange hover:bg-grimlog-orange hover:text-grimlog-black font-bold transition-colors"
              >
                + CREATE CUSTOM DATASHEET
              </button>
            </div>

            {/* Datasheet List */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {!army.factionId ? (
                <p className="text-grimlog-light-steel text-center py-8">
                  Select a faction to browse datasheets
                </p>
              ) : loading ? (
                <p className="text-grimlog-light-steel text-center py-8">Loading...</p>
              ) : datasheets.length === 0 ? (
                <p className="text-grimlog-light-steel text-center py-8">
                  No datasheets found
                </p>
              ) : (
                <div className="space-y-3">
                  {datasheets.map(ds => (
                    <div
                      key={ds.id}
                      className="border border-grimlog-steel bg-grimlog-black p-3 hover:border-grimlog-orange cursor-pointer transition-colors"
                      onClick={() => addUnit(ds)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-bold text-white">{ds.name}</h3>
                          <p className="text-xs text-grimlog-light-steel">{ds.role}</p>
                        </div>
                        <span className="text-grimlog-green font-mono text-sm">{ds.pointsCost}pts</span>
                      </div>
                      <div className="flex gap-2 mt-2 text-xs text-grimlog-light-steel">
                        <span>M:{ds.movement}</span>
                        <span>T:{ds.toughness}</span>
                        <span>SV:{ds.save}</span>
                        <span>W:{ds.wounds}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center: Army Composition */}
          <div className="col-span-5 border border-grimlog-steel bg-grimlog-darkGray">
            <div className="p-4 border-b border-grimlog-steel">
              <input
                type="text"
                value={army.name}
                onChange={e => setArmy(prev => ({ ...prev, name: e.target.value }))}
                className="text-xl font-bold text-grimlog-orange bg-transparent border-b border-grimlog-steel focus:border-grimlog-orange outline-none w-full"
                placeholder="Army Name"
              />
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {army.units.length === 0 ? (
                <p className="text-grimlog-light-steel text-center py-8">
                  Click datasheets on the left to add units to your army
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(unitsByRole).map(([role, units]) => (
                    <div key={role}>
                      <h3 className="text-sm font-bold text-grimlog-amber mb-2 uppercase">{role} ({units.length})</h3>
                      <div className="space-y-2">
                        {units.map(unit => (
                          <div
                            key={unit.id}
                            className="border border-grimlog-steel bg-grimlog-black p-3 flex justify-between items-center"
                          >
                            <div className="flex-1">
                              <h4 className="text-white font-bold">{unit.datasheet.name}</h4>
                              <div className="flex gap-4 mt-1 text-xs text-grimlog-light-steel">
                                <span>Models: 
                                  <input
                                    type="number"
                                    value={unit.modelCount}
                                    onChange={e => updateUnitCount(unit.id, parseInt(e.target.value) || 1)}
                                    min={1}
                                    max={20}
                                    className="w-12 ml-1 px-1 bg-grimlog-gray border border-grimlog-steel text-white text-center"
                                  />
                                </span>
                                <span className="text-grimlog-green">{unit.pointsCost}pts</span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeUnit(unit.id)}
                              className="text-red-400 hover:text-red-300 p-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Army Summary */}
          <div className="col-span-3 border border-grimlog-steel bg-grimlog-darkGray">
            <div className="p-4 border-b border-grimlog-steel">
              <h2 className="text-lg font-bold text-grimlog-orange">SUMMARY</h2>
            </div>

            <div className="p-4 space-y-4">
              {/* Points Limit */}
              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Points Limit</label>
                <select
                  value={army.pointsLimit}
                  onChange={e => setArmy(prev => ({ ...prev, pointsLimit: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                >
                  {POINT_LIMITS.map(pts => (
                    <option key={pts} value={pts}>{pts} points</option>
                  ))}
                </select>
              </div>

              {/* Detachment */}
              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Detachment</label>
                <input
                  type="text"
                  value={army.detachment || ''}
                  onChange={e => setArmy(prev => ({ ...prev, detachment: e.target.value || null }))}
                  placeholder="e.g., Gladius Task Force"
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                />
              </div>

              {/* Points Display */}
              <div className={`p-4 border ${isOverLimit ? 'border-red-500 bg-red-500/10' : 'border-grimlog-orange bg-grimlog-black'}`}>
                <div className="text-center">
                  <div className={`text-3xl font-bold font-mono ${isOverLimit ? 'text-red-400' : 'text-grimlog-green'}`}>
                    {totalPoints}
                  </div>
                  <div className="text-grimlog-light-steel text-sm">
                    / {army.pointsLimit} points
                  </div>
                  {isOverLimit && (
                    <div className="text-red-400 text-sm mt-2">
                      {totalPoints - army.pointsLimit} points over limit!
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-grimlog-light-steel">Total Units:</span>
                  <span className="text-white font-mono">{army.units.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-grimlog-light-steel">Total Models:</span>
                  <span className="text-white font-mono">{army.units.reduce((sum, u) => sum + u.modelCount, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-grimlog-light-steel">Points Used:</span>
                  <span className="text-white font-mono">{Math.round((totalPoints / army.pointsLimit) * 100)}%</span>
                </div>
              </div>

              {/* Role Breakdown */}
              <div>
                <h3 className="text-sm font-bold text-grimlog-light-steel mb-2">BY ROLE</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(unitsByRole).map(([role, units]) => (
                    <div key={role} className="flex justify-between">
                      <span className="text-grimlog-light-steel">{role}:</span>
                      <span className="text-white font-mono">
                        {units.length} ({units.reduce((sum, u) => sum + u.pointsCost, 0)}pts)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Datasheet Editor Modal */}
      <DatasheetEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingDatasheet(null);
        }}
        onSave={handleCreateDatasheet}
        initialData={editingDatasheet ? {
          name: editingDatasheet.name,
          faction: editingDatasheet.faction,
          factionId: editingDatasheet.factionId,
          subfaction: editingDatasheet.subfaction,
          role: editingDatasheet.role as any,
          keywords: editingDatasheet.keywords,
          movement: editingDatasheet.movement,
          toughness: editingDatasheet.toughness,
          save: editingDatasheet.save,
          invulnerableSave: editingDatasheet.invulnerableSave,
          wounds: editingDatasheet.wounds,
          leadership: editingDatasheet.leadership,
          objectiveControl: editingDatasheet.objectiveControl,
          pointsCost: editingDatasheet.pointsCost,
          composition: editingDatasheet.composition,
        } : {
          faction: army.factionName,
          factionId: army.factionId,
        }}
        mode={editingDatasheet ? 'edit' : 'create'}
        factions={factions}
      />
    </div>
  );
}
