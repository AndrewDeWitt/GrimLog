'use client';

import { useState, useEffect } from 'react';
import IconGeneratorModal from '@/components/tools/IconGeneratorModal';

interface UnitStatus {
  id: string;
  name: string;
  faction: string;
  hasIcon: boolean;
  iconUrl: string | null;
}

export default function IconsAdminPage() {
  const [units, setUnits] = useState<UnitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFaction, setFilterFaction] = useState<string>('All');
  const [filterMissing, setFilterMissing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal State
  const [selectedUnit, setSelectedUnit] = useState<UnitStatus | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load Units
  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/icons/status');
      const data = await res.json();
      setUnits(data.units);
    } catch (err) {
      console.error('Failed to fetch units', err);
    } finally {
      setLoading(false);
    }
  };

  // Filters
  const factions = ['All', ...Array.from(new Set(units.map(u => u.faction))).sort()];
  
  const filteredUnits = units.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase());
    const matchesFaction = filterFaction === 'All' || u.faction === filterFaction;
    const matchesMissing = !filterMissing || !u.hasIcon;
    return matchesSearch && matchesFaction && matchesMissing;
  });

  // Actions
  const openGenerator = (unit: UnitStatus) => {
    setSelectedUnit(unit);
    setIsModalOpen(true);
  };

  const handleSuccess = (url: string) => {
    // Update local state to reflect new icon immediately with cache buster
    if (selectedUnit) {
      const cacheBuster = Date.now();
      setUnits(prev => prev.map(u => 
        u.id === selectedUnit.id 
          ? { ...u, hasIcon: true, iconUrl: `${url}?v=${cacheBuster}` }
          : u
      ));
    }
    setIsModalOpen(false);
    setSelectedUnit(null);
  };

  const handleDelete = async (unit: UnitStatus) => {
    if (!confirm(`Are you sure you want to delete the icon for "${unit.name}"?`)) {
      return;
    }

    setDeletingId(unit.id);
    try {
      const res = await fetch('/api/admin/icons/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitName: unit.name, faction: unit.faction }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete icon');
      }

      // Update local state to remove icon
      setUnits(prev => prev.map(u => 
        u.id === unit.id 
          ? { ...u, hasIcon: false, iconUrl: null }
          : u
      ));
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(`Failed to delete icon: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-orange-500">Unit Icon Generator</h1>
        
        {/* Controls */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6 flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Search Unit</label>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="e.g. Intercessors"
            />
          </div>
          
          <div className="min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Faction</label>
            <select 
              value={filterFaction}
              onChange={(e) => setFilterFaction(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            >
              {factions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          
          <div className="flex items-center pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filterMissing}
                onChange={(e) => setFilterMissing(e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded bg-gray-700 border-gray-600"
              />
              <span>Show Missing Only</span>
            </label>
          </div>
          
          <div className="text-gray-400 pb-2 ml-auto">
            {filteredUnits.length} units
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUnits.map(unit => (
              <div key={unit.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-orange-500/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg truncate" title={unit.name}>{unit.name}</h3>
                  {unit.hasIcon ? (
                    <span className="text-green-500 text-xs bg-green-500/10 px-2 py-1 rounded">Done</span>
                  ) : (
                    <span className="text-red-500 text-xs bg-red-500/10 px-2 py-1 rounded">Missing</span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mb-4">{unit.faction}</div>
                
                <div className="flex gap-4 items-center">
                  {unit.iconUrl ? (
                    <img src={unit.iconUrl} className="w-16 h-16 object-contain bg-black/50 rounded" alt={unit.name} />
                  ) : (
                    <div className="w-16 h-16 bg-black/30 rounded flex items-center justify-center text-gray-600">?</div>
                  )}
                  
                  <div className="flex-1 flex flex-col gap-2">
                    <button 
                      onClick={() => openGenerator(unit)}
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2 px-4 rounded font-bold text-sm"
                    >
                      {unit.hasIcon ? 'Regenerate' : 'Generate Icon'}
                    </button>
                    {unit.hasIcon && (
                      <button 
                        onClick={() => handleDelete(unit)}
                        disabled={deletingId === unit.id}
                        className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 py-1.5 px-4 rounded text-xs border border-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === unit.id ? 'Deleting...' : 'Delete Icon'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedUnit && (
        <IconGeneratorModal 
          unitName={selectedUnit.name}
          faction={selectedUnit.faction}
          datasheetId={selectedUnit.id}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
