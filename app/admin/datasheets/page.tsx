'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DatasheetEditorModal from '@/components/DatasheetEditorModal';
import { CreateDatasheetInput } from '@/lib/datasheetValidation';

interface FactionOption {
  id: string;
  name: string;
}

interface DatasheetSummary {
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
  isEnabled: boolean;
  isOfficial: boolean;
  edition: string;
  createdAt: string;
  lastUpdated: string;
  iconUrl: string | null;
  _count: {
    weapons: number;
    abilities: number;
    wargearOptions: number;
  };
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
  compositionData: unknown;
  unitSize: string | null;
  leaderRules: string | null;
  leaderAbilities: string | null;
  transportCapacity: string | null;
  pointsCost: number;
  edition: string;
  sourceBook: string | null;
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
    isDefault: boolean;
    quantity: string | null;
  }>;
  abilities: Array<{
    name: string;
    type: string;
    description: string;
    triggerPhase: string[] | null;
    triggerSubphase: string | null;
    isReactive: boolean;
  }>;
  wargearOptions: Array<{
    name: string;
    description: string;
    pointsCost: number;
    type: string;
  }>;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ROLES = [
  'Character',
  'Battleline',
  'Elites',
  'Fast Attack',
  'Heavy Support',
  'Dedicated Transport',
  'Fortification',
  'Allied Units',
];

export default function DatasheetsAdminPage() {
  // Filters state
  const [factionFilter, setFactionFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [enabledFilter, setEnabledFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  // Data state
  const [factions, setFactions] = useState<FactionOption[]>([]);
  const [datasheets, setDatasheets] = useState<DatasheetSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingDatasheet, setEditingDatasheet] = useState<DatasheetDetail | null>(null);

  // Toast state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Initialize from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const factionId = params.get('factionId');
    if (factionId) {
      setFactionFilter(factionId);
    }
  }, []);

  // Fetch factions for filter dropdown
  useEffect(() => {
    const fetchFactions = async () => {
      try {
        const res = await fetch('/api/admin/factions');
        if (res.ok) {
          const data = await res.json();
          setFactions(data.factions.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
        }
      } catch (err) {
        console.error('Failed to fetch factions:', err);
      }
    };
    fetchFactions();
  }, []);

  // Fetch datasheets
  const fetchDatasheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      
      if (factionFilter) params.set('factionId', factionFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (enabledFilter) params.set('isEnabled', enabledFilter);
      if (searchQuery) params.set('search', searchQuery);
      
      const res = await fetch(`/api/admin/datasheets?${params}`);
      if (!res.ok) throw new Error('Failed to fetch datasheets');
      
      const data = await res.json();
      setDatasheets(data.datasheets);
      setPagination(data.pagination);
      setSelectedIds(new Set()); // Clear selection on fetch
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasheets');
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, factionFilter, roleFilter, enabledFilter, searchQuery]);

  useEffect(() => {
    fetchDatasheets();
  }, [fetchDatasheets]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [factionFilter, roleFilter, enabledFilter, searchQuery]);

  // Handle sort
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Handle toggle enabled
  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/admin/datasheets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !currentEnabled })
      });
      
      if (!res.ok) throw new Error('Failed to toggle');
      
      setDatasheets(prev => prev.map(ds =>
        ds.id === id ? { ...ds, isEnabled: !currentEnabled } : ds
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setTogglingId(null);
    }
  };

  // Handle selection
  const handleSelectAll = () => {
    if (selectedIds.size === datasheets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(datasheets.map(ds => ds.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk actions
  const handleBulkEnable = async (enable: boolean) => {
    if (selectedIds.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch(`/api/admin/datasheets/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isEnabled: enable })
        })
      );
      
      await Promise.all(promises);
      await fetchDatasheets();
    } catch (err) {
      alert('Some updates failed. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Edit datasheet
  const handleEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/datasheets/${id}`);
      if (!res.ok) throw new Error('Failed to fetch datasheet');
      const data = await res.json();
      setEditingDatasheet(data);
      setShowModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load datasheet');
    }
  };

  // Create new datasheet
  const handleCreate = () => {
    setEditingDatasheet(null);
    setShowModal(true);
  };

  // Save datasheet
  const handleSave = async (data: CreateDatasheetInput) => {
    const endpoint = editingDatasheet
      ? `/api/admin/datasheets/${editingDatasheet.id}`
      : '/api/admin/datasheets';
    
    const method = editingDatasheet ? 'PUT' : 'POST';
    
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save datasheet');
    }

    await fetchDatasheets();
  };

  // Delete datasheet
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const res = await fetch(`/api/admin/datasheets/${id}?force=true`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      await fetchDatasheets();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Get sort indicator
  const getSortIndicator = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Datasheets</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage unit datasheets across all factions
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Datasheet
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          
          <select
            value={factionFilter}
            onChange={(e) => setFactionFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">All Factions</option>
            {factions.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">All Roles</option>
            {ROLES.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          
          <select
            value={enabledFilter}
            onChange={(e) => setEnabledFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">All Status</option>
            <option value="true">Enabled Only</option>
            <option value="false">Disabled Only</option>
          </select>
        </div>
        
        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => handleBulkEnable(true)}
              disabled={bulkActionLoading}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors disabled:opacity-50"
            >
              Enable Selected
            </button>
            <button
              onClick={() => handleBulkEnable(false)}
              disabled={bulkActionLoading}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition-colors disabled:opacity-50"
            >
              Disable Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {pagination && (
        <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
          <span>
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} datasheets
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <span className="text-slate-400">Loading datasheets...</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === datasheets.length && datasheets.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('name')}
                >
                  Name{getSortIndicator('name')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('faction')}
                >
                  Faction{getSortIndicator('faction')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('role')}
                >
                  Role{getSortIndicator('role')}
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('pointsCost')}
                >
                  Pts{getSortIndicator('pointsCost')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Stats</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Enabled</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {datasheets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No datasheets found. Try adjusting your filters or create a new one.
                  </td>
                </tr>
              ) : (
                datasheets.map((ds) => (
                  <tr key={ds.id} className={`hover:bg-slate-800/30 ${!ds.isEnabled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ds.id)}
                        onChange={() => handleSelect(ds.id)}
                        className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Unit Icon */}
                        <div className="w-10 h-10 flex-shrink-0 rounded bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                          {ds.iconUrl ? (
                            <img 
                              src={ds.iconUrl} 
                              alt={ds.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-600 text-lg">
                              {ds.role === 'Character' ? '👤' : 
                               ds.role === 'Battleline' ? '⚔️' : 
                               ds.role === 'Monster' ? '🐉' : 
                               ds.role === 'Vehicle' ? '🚗' : '📋'}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{ds.name}</div>
                          <div className="text-xs text-slate-500">
                            {ds._count.weapons} weapons • {ds._count.abilities} abilities
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ds.factionId ? (
                        <Link 
                          href={`/admin/factions/${ds.factionId}`}
                          className="text-amber-500 hover:text-amber-400 text-sm"
                        >
                          {ds.faction}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">{ds.faction}</span>
                      )}
                      {ds.subfaction && (
                        <div className="text-xs text-slate-500">{ds.subfaction}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">{ds.role}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-amber-500 font-medium">{ds.pointsCost}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="text-slate-400" title="Toughness">T{ds.toughness}</span>
                        <span className="text-slate-400" title="Wounds">W{ds.wounds}</span>
                        <span className="text-slate-400" title="Save">{ds.save}</span>
                        {ds.invulnerableSave && (
                          <span className="text-purple-400" title="Invulnerable Save">{ds.invulnerableSave}++</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(ds.id, ds.isEnabled)}
                        disabled={togglingId === ds.id}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          ds.isEnabled ? 'bg-green-600' : 'bg-slate-600'
                        } relative`}
                      >
                        <span 
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            ds.isEnabled ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(ds.id)}
                          className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ds.id, ds.name)}
                          className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-white rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded ${
                    page === pageNum
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Datasheet Editor Modal */}
      <DatasheetEditorModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDatasheet(null);
        }}
        onSave={handleSave}
        initialData={editingDatasheet ? {
          name: editingDatasheet.name,
          faction: editingDatasheet.faction,
          factionId: editingDatasheet.factionId,
          subfaction: editingDatasheet.subfaction,
          role: editingDatasheet.role as 'Character' | 'Battleline' | 'Elites' | 'Fast Attack' | 'Heavy Support' | 'Dedicated Transport' | 'Fortification' | 'Allied Units',
          keywords: editingDatasheet.keywords,
          movement: editingDatasheet.movement,
          toughness: editingDatasheet.toughness,
          save: editingDatasheet.save,
          invulnerableSave: editingDatasheet.invulnerableSave,
          wounds: editingDatasheet.wounds,
          leadership: editingDatasheet.leadership,
          objectiveControl: editingDatasheet.objectiveControl,
          composition: editingDatasheet.composition,
          compositionData: editingDatasheet.compositionData ? JSON.stringify(editingDatasheet.compositionData) : null,
          unitSize: editingDatasheet.unitSize,
          leaderRules: editingDatasheet.leaderRules,
          leaderAbilities: editingDatasheet.leaderAbilities,
          transportCapacity: editingDatasheet.transportCapacity,
          pointsCost: editingDatasheet.pointsCost,
          edition: editingDatasheet.edition,
          sourceBook: editingDatasheet.sourceBook,
          weapons: editingDatasheet.weapons,
          abilities: editingDatasheet.abilities.map(a => ({
            name: a.name,
            type: a.type as 'core' | 'faction' | 'unit' | 'leader' | 'wargear',
            description: a.description,
            triggerPhase: a.triggerPhase,
            triggerSubphase: a.triggerSubphase,
            isReactive: a.isReactive,
            requiredKeywords: null,
          })),
          wargearOptions: editingDatasheet.wargearOptions.map(w => ({
            name: w.name,
            description: w.description,
            pointsCost: w.pointsCost,
            type: w.type as 'weapon' | 'equipment' | 'upgrade',
          })),
        } : undefined}
        datasheetId={editingDatasheet?.id}
        mode={editingDatasheet ? 'edit' : 'create'}
        factions={factions}
      />
    </div>
  );
}
