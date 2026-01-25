'use client';

import { useState, useEffect, useMemo } from 'react';
import DatasheetCard from './DatasheetCard';
import UnitBuilder from './UnitBuilder';

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
}

interface DatasheetDetail {
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
  unitSize: string | null;
  pointsCost: number;
  weapons: any[];
  abilities: any[];
}

interface RoleCount {
  role: string;
  count: number;
}

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  factionId: string;
  factionName: string;
  includeParentFaction?: boolean;
  onAddUnit: (unit: any) => void;
}

type ModalStep = 'browse' | 'configure';

export default function AddUnitModal({
  isOpen,
  onClose,
  factionId,
  factionName,
  includeParentFaction = true,
  onAddUnit,
}: AddUnitModalProps) {
  const [step, setStep] = useState<ModalStep>('browse');
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleCount[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDatasheet, setSelectedDatasheet] = useState<DatasheetDetail | null>(null);
  const [loadingDatasheet, setLoadingDatasheet] = useState(false);

  // Fetch datasheets when modal opens
  useEffect(() => {
    if (isOpen && factionId) {
      fetchDatasheets();
    }
  }, [isOpen, factionId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('browse');
      setSelectedDatasheet(null);
      setSearchQuery('');
      setSelectedRole('');
    }
  }, [isOpen]);

  const fetchDatasheets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        factionId,
        includeParent: includeParentFaction.toString(),
      });
      
      const response = await fetch(`/api/datasheets?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDatasheets(data.datasheets);
        setAvailableRoles(data.availableRoles);
      }
    } catch (err) {
      console.error('Failed to fetch datasheets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDatasheetDetail = async (id: string) => {
    setLoadingDatasheet(true);
    try {
      const response = await fetch(`/api/datasheets/detail/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDatasheet(data);
        setStep('configure');
      }
    } catch (err) {
      console.error('Failed to fetch datasheet detail:', err);
    } finally {
      setLoadingDatasheet(false);
    }
  };

  // Filter datasheets
  const filteredDatasheets = useMemo(() => {
    let filtered = datasheets;
    
    if (selectedRole) {
      filtered = filtered.filter(ds => ds.role.toLowerCase() === selectedRole.toLowerCase());
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ds => 
        ds.name.toLowerCase().includes(query) ||
        ds.keywords.some(kw => kw.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [datasheets, selectedRole, searchQuery]);

  // Group by role
  const groupedDatasheets = useMemo(() => {
    const groups: Record<string, Datasheet[]> = {};
    
    filteredDatasheets.forEach(ds => {
      if (!groups[ds.role]) {
        groups[ds.role] = [];
      }
      groups[ds.role].push(ds);
    });
    
    const roleOrder = ['Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Elites', 'Fast Attack', 'Heavy Support'];
    const sortedRoles = Object.keys(groups).sort((a, b) => {
      const aIndex = roleOrder.indexOf(a);
      const bIndex = roleOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    return sortedRoles.map(role => ({
      role,
      datasheets: groups[role].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [filteredDatasheets]);

  const handleSelectDatasheet = (ds: Datasheet) => {
    fetchDatasheetDetail(ds.id);
  };

  const handleUnitSave = (unit: any) => {
    onAddUnit(unit);
    onClose();
  };

  const handleBack = () => {
    setStep('browse');
    setSelectedDatasheet(null);
  };

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
        className="relative w-full max-w-4xl mx-auto max-h-[85vh] bg-grimlog-slate-light border-t-2 border-grimlog-steel overflow-hidden flex flex-col rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 border-b border-grimlog-steel bg-grimlog-slate-dark flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            {step === 'configure' && (
              <button
                onClick={handleBack}
                className="text-grimlog-orange hover:text-orange-400 font-mono text-sm"
              >
                ← BACK
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900 tracking-wider">
              {step === 'browse' ? 'SELECT DATASHEET' : 'CONFIGURE UNIT'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-grimlog-slate-light">
          {step === 'browse' && (
            <div className="p-4">
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search datasheets..."
                  className="flex-1 px-4 py-2 bg-white border-2 border-gray-300 focus:border-grimlog-orange text-gray-800 outline-none transition-colors font-mono rounded-lg"
                />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-4 py-2 bg-white border-2 border-gray-300 focus:border-grimlog-orange text-gray-800 outline-none transition-colors font-mono rounded-lg"
                >
                  <option value="">All Roles</option>
                  {availableRoles.map(r => (
                    <option key={r.role} value={r.role}>
                      {r.role} ({r.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Loading */}
              {loading && (
                <div className="text-center py-8">
                  <div className="text-2xl animate-spin mb-2">⚙</div>
                  <div className="text-grimlog-orange">Loading datasheets...</div>
                </div>
              )}

              {/* Datasheets Grid */}
              {!loading && (
                <div className="space-y-6">
                  {groupedDatasheets.map(group => (
                    <div key={group.role}>
                      <h3 className="text-sm font-bold text-grimlog-orange mb-2 font-mono uppercase">
                        {group.role} ({group.datasheets.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.datasheets.map(ds => (
                          <DatasheetCard
                            key={ds.id}
                            id={ds.id}
                            name={ds.name}
                            faction={ds.faction}
                            subfaction={ds.subfaction}
                            role={ds.role}
                            keywords={ds.keywords}
                            movement={ds.movement}
                            toughness={ds.toughness}
                            save={ds.save}
                            wounds={ds.wounds}
                            leadership={ds.leadership}
                            objectiveControl={ds.objectiveControl}
                            pointsCost={ds.pointsCost}
                            onClick={() => handleSelectDatasheet(ds)}
                            showAddButton
                            onAdd={() => handleSelectDatasheet(ds)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {groupedDatasheets.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <div className="text-4xl mb-2 opacity-50">🔍</div>
                      <div className="text-gray-500">No datasheets found</div>
                    </div>
                  )}
                </div>
              )}

              {/* Loading Datasheet */}
              {loadingDatasheet && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="bg-white p-4 border border-grimlog-orange rounded-lg">
                    <div className="text-2xl animate-spin mb-2 text-center">⚙</div>
                    <div className="text-grimlog-orange">Loading datasheet...</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'configure' && selectedDatasheet && (
            <UnitBuilder
              datasheet={selectedDatasheet}
              onSave={handleUnitSave}
              onCancel={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
