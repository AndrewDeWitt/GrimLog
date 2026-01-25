'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DatasheetEditorModal from '@/components/DatasheetEditorModal';
import { CreateDatasheetInput } from '@/lib/datasheetValidation';
import FactionIcon from '@/components/FactionIcon';

interface Faction {
  id: string;
  name: string;
  metaData: Record<string, unknown> | null;
  parentFaction: { id: string; name: string; detachments?: Detachment[] } | null;
  subFactions: { id: string; name: string }[];
  detachments: Detachment[];
  stratagemData: Stratagem[];
  _count: {
    datasheets: number;
    stratagemData: number;
    enhancements: number;
    detachments: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Detachment {
  id: string;
  name: string;
  subfaction: string | null;
  abilityName: string | null;
  _count: {
    stratagems: number;
    enhancements: number;
  };
}

interface Stratagem {
  id: string;
  name: string;
  detachment: string | null;
  cpCost: number;
  type: string;
}

interface DatasheetSummary {
  id: string;
  name: string;
  faction: string;
  role: string;
  keywords: string[];
  pointsCost: number;
  wounds: number;
  toughness: number;
  save: string;
  isEnabled: boolean;
  isOfficial: boolean;
  iconUrl: string | null;
  _count: {
    weapons: number;
    abilities: number;
  };
}

interface CompetitiveSourceItem {
  id: string;
  sourceUrl: string;
  sourceType: string;
  contentTitle: string | null;
  authorName: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  detachment?: { id: string; name: string } | null;
  _count: {
    datasheetSources: number;
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

export default function FactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [faction, setFaction] = useState<Faction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', metaData: '' });
  const [iconUrl, setIconUrl] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Create detachment form
  const [showNewDetachment, setShowNewDetachment] = useState(false);
  const [newDetachment, setNewDetachment] = useState({
    name: '',
    subfaction: '',
    abilityName: '',
    abilityDescription: '',
    sourceBook: ''
  });

  // Datasheets state
  const [datasheets, setDatasheets] = useState<DatasheetSummary[]>([]);
  const [datasheetsLoading, setDatasheetsLoading] = useState(false);
  const [datasheetsExpanded, setDatasheetsExpanded] = useState(false);
  const [datasheetRoleFilter, setDatasheetRoleFilter] = useState<string>('');
  const [datasheetSearch, setDatasheetSearch] = useState('');
  const [togglingDatasheet, setTogglingDatasheet] = useState<string | null>(null);

  // Datasheet editor modal
  const [showDatasheetModal, setShowDatasheetModal] = useState(false);
  const [editingDatasheet, setEditingDatasheet] = useState<DatasheetDetail | null>(null);
  const [allFactions, setAllFactions] = useState<Array<{ id: string; name: string }>>([]);

  // Competitive sources state
  const [sources, setSources] = useState<CompetitiveSourceItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [sourceCounts, setSourceCounts] = useState({ total: 0, pending: 0, fetched: 0, curated: 0, extracted: 0, error: 0 });
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState('youtube');
  const [newSourceDetachmentId, setNewSourceDetachmentId] = useState<string>('');
  const [addingSource, setAddingSource] = useState(false);

  useEffect(() => {
    fetchFaction();
    fetchAllFactions();
  }, [id]);

  useEffect(() => {
    if (datasheetsExpanded && datasheets.length === 0) {
      fetchDatasheets();
    }
  }, [datasheetsExpanded]);

  useEffect(() => {
    if (sourcesExpanded && sources.length === 0) {
      fetchSources();
    }
  }, [sourcesExpanded]);

  const fetchFaction = async () => {
    try {
      const res = await fetch(`/api/admin/factions/${id}`);
      if (!res.ok) throw new Error('Failed to fetch faction');
      const data = await res.json();
      setFaction(data);
      setFormData({
        name: data.name,
        metaData: data.metaData ? JSON.stringify(data.metaData, null, 2) : ''
      });
      // Initialize iconUrl from metaData
      if (data.metaData && (data.metaData as any)?.iconUrl) {
        setIconUrl((data.metaData as any).iconUrl);
      } else {
        setIconUrl('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load faction');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllFactions = async () => {
    try {
      const res = await fetch('/api/admin/factions');
      if (res.ok) {
        const data = await res.json();
        setAllFactions(data.factions.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
      }
    } catch (err) {
      console.error('Failed to fetch factions:', err);
    }
  };

  const fetchDatasheets = async () => {
    setDatasheetsLoading(true);
    try {
      const params = new URLSearchParams({ factionId: id, limit: '100' });
      if (datasheetRoleFilter) params.set('role', datasheetRoleFilter);
      if (datasheetSearch) params.set('search', datasheetSearch);
      
      const res = await fetch(`/api/admin/datasheets?${params}`);
      if (!res.ok) throw new Error('Failed to fetch datasheets');
      const data = await res.json();
      setDatasheets(data.datasheets);
    } catch (err) {
      console.error('Failed to fetch datasheets:', err);
    } finally {
      setDatasheetsLoading(false);
    }
  };

  const fetchSources = async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch(`/api/admin/factions/${id}/sources`);
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data = await res.json();
      setSources(data.sources || []);
      setSourceCounts(data.counts || { total: 0, pending: 0, fetched: 0, curated: 0, extracted: 0, error: 0 });
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceUrl.trim()) return;
    setAddingSource(true);
    try {
      const res = await fetch(`/api/admin/factions/${id}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceUrl: newSourceUrl, 
          sourceType: newSourceType,
          detachmentId: newSourceDetachmentId || undefined,
        }),
      });
      if (res.ok) {
        setNewSourceUrl('');
        setNewSourceDetachmentId('');
        setShowAddSource(false);
        fetchSources();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add source');
      }
    } catch (err) {
      alert('Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Delete this source? This will also remove all linked datasheet contexts.')) return;
    try {
      const res = await fetch(`/api/admin/competitive-sources/${sourceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (err) {
      alert('Failed to delete source');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let parsedMetaData: Record<string, unknown> = {};
      if (formData.metaData.trim()) {
        try {
          parsedMetaData = JSON.parse(formData.metaData);
        } catch {
          alert('Invalid JSON in metadata');
          setSaving(false);
          return;
        }
      }

      // Merge iconUrl into metaData
      if (iconUrl.trim()) {
        parsedMetaData.iconUrl = iconUrl.trim();
      } else {
        delete parsedMetaData.iconUrl;
      }

      const res = await fetch(`/api/admin/factions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          metaData: Object.keys(parsedMetaData).length > 0 ? parsedMetaData : null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      await fetchFaction();
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${faction?.name}"?`)) return;
    
    try {
      const res = await fetch(`/api/admin/factions/${id}?force=true`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      router.push('/admin/factions');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleCreateDetachment = async () => {
    if (!newDetachment.name.trim()) {
      alert('Detachment name is required');
      return;
    }

    try {
      const res = await fetch(`/api/admin/factions/${id}/detachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDetachment.name,
          subfaction: newDetachment.subfaction || null,
          abilityName: newDetachment.abilityName || null,
          abilityDescription: newDetachment.abilityDescription || null,
          sourceBook: newDetachment.sourceBook || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create detachment');
      }

      setNewDetachment({
        name: '',
        subfaction: '',
        abilityName: '',
        abilityDescription: '',
        sourceBook: ''
      });
      setShowNewDetachment(false);
      await fetchFaction();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create detachment');
    }
  };

  const handleToggleDatasheet = async (datasheetId: string, currentEnabled: boolean) => {
    setTogglingDatasheet(datasheetId);
    try {
      const res = await fetch(`/api/admin/datasheets/${datasheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !currentEnabled })
      });

      if (!res.ok) throw new Error('Failed to toggle datasheet');
      
      // Update local state
      setDatasheets(prev => prev.map(ds => 
        ds.id === datasheetId ? { ...ds, isEnabled: !currentEnabled } : ds
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle datasheet');
    } finally {
      setTogglingDatasheet(null);
    }
  };

  const handleEditDatasheet = async (datasheetId: string) => {
    try {
      const res = await fetch(`/api/admin/datasheets/${datasheetId}`);
      if (!res.ok) throw new Error('Failed to fetch datasheet');
      const data = await res.json();
      setEditingDatasheet(data);
      setShowDatasheetModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load datasheet');
    }
  };

  const handleCreateDatasheet = () => {
    setEditingDatasheet(null);
    setShowDatasheetModal(true);
  };

  const handleSaveDatasheet = async (data: CreateDatasheetInput) => {
    const endpoint = editingDatasheet 
      ? `/api/admin/datasheets/${editingDatasheet.id}`
      : '/api/admin/datasheets';
    
    const method = editingDatasheet ? 'PUT' : 'POST';
    
    // Pre-fill faction if creating new
    const payload = editingDatasheet ? data : {
      ...data,
      faction: faction?.name || data.faction,
      factionId: id
    };

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save datasheet');
    }

    // Refresh datasheets list and faction counts
    await fetchDatasheets();
    await fetchFaction();
  };

  const handleDeleteDatasheet = async (datasheetId: string, datasheetName: string) => {
    if (!confirm(`Are you sure you want to delete "${datasheetName}"?`)) return;
    
    try {
      const res = await fetch(`/api/admin/datasheets/${datasheetId}?force=true`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      // Refresh datasheets list and faction counts
      await fetchDatasheets();
      await fetchFaction();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete datasheet');
    }
  };

  // Group stratagems by detachment
  const stratagemsByDetachment = faction?.stratagemData.reduce((acc, s) => {
    const key = s.detachment || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {} as Record<string, Stratagem[]>) || {};

  // Filter datasheets
  const filteredDatasheets = datasheets.filter(ds => {
    if (datasheetRoleFilter && ds.role !== datasheetRoleFilter) return false;
    if (datasheetSearch && !ds.name.toLowerCase().includes(datasheetSearch.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-1/4"></div>
          <div className="h-64 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !faction) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error || 'Faction not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/admin/factions" className="hover:text-white transition-colors">
          Factions
        </Link>
        <span>/</span>
        <span className="text-white">{faction.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          {editing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-3xl font-bold bg-slate-800 border border-slate-700 rounded px-3 py-1 text-white"
            />
          ) : (
            <h1 className="text-3xl font-bold text-white">{faction.name}</h1>
          )}
          {faction.parentFaction && (
            <p className="text-slate-400 mt-1">
              Sub-faction of{' '}
              <Link href={`/admin/factions/${faction.parentFaction.id}`} className="text-amber-500 hover:underline">
                {faction.parentFaction.name}
              </Link>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-500">{faction._count.detachments}</div>
          <div className="text-sm text-slate-400">Detachments</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{faction._count.stratagemData}</div>
          <div className="text-sm text-slate-400">Stratagems</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{faction._count.enhancements}</div>
          <div className="text-sm text-slate-400">Enhancements</div>
        </div>
        <button
          onClick={() => setDatasheetsExpanded(!datasheetsExpanded)}
          className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-green-500/50 transition-colors text-left"
        >
          <div className="text-2xl font-bold text-green-400">{faction._count.datasheets}</div>
          <div className="text-sm text-slate-400 flex items-center gap-1">
            Datasheets
            <span className="text-xs">{datasheetsExpanded ? '▼' : '▶'}</span>
          </div>
        </button>
      </div>

      {/* Faction Icon Upload */}
      {editing && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-bold text-white mb-3">Faction Icon</h3>

          {/* Preview */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 border border-slate-700 rounded bg-slate-800 flex items-center justify-center overflow-hidden">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={faction.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <FactionIcon factionName={faction.name} className="w-10 h-10 text-slate-500" />
              )}
            </div>
            <div className="text-sm text-slate-400">
              {iconUrl ? 'Custom icon' : 'Using default SVG icon'}
              {iconUrl && (
                <button
                  type="button"
                  onClick={() => setIconUrl('')}
                  className="block text-xs text-red-400 hover:text-red-300 mt-1"
                >
                  Remove custom icon
                </button>
              )}
            </div>
          </div>

          {/* URL Input */}
          <input
            type="url"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://example.com/faction-icon.png"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white mb-2"
          />
          <p className="text-xs text-slate-500">
            Paste URL to an AI-generated faction icon (recommended: 128x128 PNG with transparent background)
          </p>
        </div>
      )}

      {/* Metadata Editor */}
      {editing && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-8">
          <h3 className="text-lg font-bold text-white mb-2">Metadata (JSON)</h3>
          <p className="text-xs text-slate-500 mb-2">
            Note: iconUrl is managed above and will be merged automatically on save.
          </p>
          <textarea
            value={formData.metaData}
            onChange={(e) => setFormData({ ...formData, metaData: e.target.value })}
            className="w-full h-32 bg-slate-800 border border-slate-700 rounded p-3 text-white font-mono text-sm"
            placeholder='{"color": "#hex", "otherProperty": "value"}'
          />
        </div>
      )}

      {/* Datasheets Section (Expandable) */}
      {datasheetsExpanded && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Datasheets</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search..."
                value={datasheetSearch}
                onChange={(e) => setDatasheetSearch(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm w-48"
              />
              <select
                value={datasheetRoleFilter}
                onChange={(e) => setDatasheetRoleFilter(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All Roles</option>
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                onClick={handleCreateDatasheet}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
              >
                + Add Datasheet
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {datasheetsLoading ? (
              <div className="p-8 text-center text-slate-500">Loading datasheets...</div>
            ) : filteredDatasheets.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No datasheets found. {faction._count.datasheets > 0 ? 'Try adjusting filters.' : 'Add one using the button above.'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Pts</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">T</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">W</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Sv</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Enabled</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDatasheets.map((ds) => (
                    <tr key={ds.id} className={`hover:bg-slate-800/30 ${!ds.isEnabled ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Unit Icon */}
                          <div className="w-9 h-9 flex-shrink-0 rounded bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                            {ds.iconUrl ? (
                              <img 
                                src={ds.iconUrl} 
                                alt={ds.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-slate-600 text-sm">
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
                        <span className="text-sm text-slate-400">{ds.role}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-amber-500 font-medium">{ds.pointsCost}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">{ds.toughness}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{ds.wounds}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{ds.save}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleDatasheet(ds.id, ds.isEnabled)}
                          disabled={togglingDatasheet === ds.id}
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
                            onClick={() => handleEditDatasheet(ds.id)}
                            className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDatasheet(ds.id, ds.name)}
                            className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-white rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Link to full datasheets admin */}
          <div className="mt-3 text-right">
            <Link 
              href={`/admin/datasheets?factionId=${id}`}
              className="text-sm text-amber-500 hover:text-amber-400"
            >
              View all datasheets in full admin →
            </Link>
          </div>
        </div>
      )}

      {/* Competitive Sources Section */}
      <div className="mb-8">
        <button
          onClick={() => setSourcesExpanded(!sourcesExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div className="text-left">
              <div className="font-bold text-white">Competitive Sources</div>
              <div className="text-sm text-slate-400">
                {sourceCounts.total} sources • {sourceCounts.extracted} ready • {sourceCounts.pending + sourceCounts.fetched + sourceCounts.curated} processing
              </div>
            </div>
          </div>
          <span className="text-slate-400">{sourcesExpanded ? '▼' : '▶'}</span>
        </button>

        {sourcesExpanded && (
          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
            {/* Add Source Button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Linked Sources</h3>
              <button
                onClick={() => setShowAddSource(!showAddSource)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm"
              >
                {showAddSource ? 'Cancel' : '+ Add Source'}
              </button>
            </div>

            {/* Add Source Form */}
            {showAddSource && (
              <div className="bg-slate-800 rounded-lg p-4 mb-4">
                <div className="flex gap-2 flex-wrap mb-3">
                  {[
                    { value: 'youtube', label: 'YouTube', icon: '📺' },
                    { value: 'reddit', label: 'Reddit', icon: '🔴' },
                    { value: 'article', label: 'Article', icon: '📄' },
                    { value: 'forum', label: 'Forum', icon: '💬' },
                    { value: 'other', label: 'Other', icon: '🌐' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNewSourceType(opt.value)}
                      className={`px-3 py-1 text-sm rounded ${
                        newSourceType === opt.value ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                
                {/* Detachment selector (optional) */}
                {((faction?.detachments && faction.detachments.length > 0) ||
                  (faction?.parentFaction?.detachments && faction.parentFaction.detachments.length > 0)) && (
                  <div className="mb-3">
                    <label className="block text-xs text-slate-400 mb-1">
                      Detachment (optional - for detachment-specific content)
                    </label>
                    <select
                      value={newSourceDetachmentId}
                      onChange={e => setNewSourceDetachmentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded text-sm"
                    >
                      <option value="">All detachments / Generic</option>
                      {/* Parent faction detachments (e.g., Space Marines for Space Wolves) */}
                      {faction?.parentFaction?.detachments && faction.parentFaction.detachments.length > 0 && (
                        <optgroup label={`${faction.parentFaction.name} Detachments`}>
                          {faction.parentFaction.detachments.map(det => (
                            <option key={det.id} value={det.id}>{det.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* This faction's own detachments */}
                      {faction?.detachments && faction.detachments.length > 0 && (
                        <optgroup label={`${faction.name} Detachments`}>
                          {faction.detachments.map(det => (
                            <option key={det.id} value={det.id}>{det.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSourceUrl}
                    onChange={e => setNewSourceUrl(e.target.value)}
                    placeholder="Paste URL here..."
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded"
                  />
                  <button
                    onClick={handleAddSource}
                    disabled={addingSource || !newSourceUrl.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-50"
                  >
                    {addingSource ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Sources List */}
            {sourcesLoading ? (
              <div className="text-center text-slate-500 py-8">Loading sources...</div>
            ) : sources.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No sources yet. Add YouTube videos, Reddit posts, or articles above.
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map(source => {
                  const statusColors: Record<string, string> = {
                    pending: 'bg-yellow-600',
                    fetched: 'bg-blue-600',
                    curated: 'bg-purple-600',
                    extracted: 'bg-green-600',
                    error: 'bg-red-600',
                  };
                  const typeIcons: Record<string, string> = {
                    youtube: '📺',
                    reddit: '🔴',
                    article: '📄',
                    forum: '💬',
                    other: '🌐',
                  };
                  
                  return (
                    <div key={source.id} className="flex items-center justify-between p-3 bg-slate-800 rounded">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg">{typeIcons[source.sourceType] || '📄'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">
                            {source.contentTitle || source.sourceUrl}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                            {source.authorName && <span>{source.authorName}</span>}
                            <span className={`px-1.5 py-0.5 rounded text-white text-xs ${statusColors[source.status] || 'bg-slate-600'}`}>
                              {source.status}
                            </span>
                            {source.detachment && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-600/50 text-amber-200 text-xs">
                                {source.detachment.name}
                              </span>
                            )}
                            {source._count.datasheetSources > 0 && (
                              <span className="text-purple-400">
                                {source._count.datasheetSources} units linked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
                        >
                          Open
                        </a>
                        <button
                          onClick={() => handleDeleteSource(source.id)}
                          className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pipeline Instructions */}
            <div className="mt-4 p-3 bg-slate-800/50 rounded text-xs text-slate-400">
              <div className="font-bold text-slate-300 mb-1">📋 Processing Pipeline:</div>
              <div className="font-mono">
                python3 scripts/youtube_transcribe.py --process-all
              </div>
              <div className="mt-2">
                Or run steps individually: <code>--fetch-pending</code> → <code>--curate-pending</code> → <code>--extract-pending</code>
              </div>
              <div className="mt-2">
                Then aggregate per-unit: <code>--aggregate --datasheet-name &quot;Unit Name&quot;</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detachments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Detachments</h2>
          <button
            onClick={() => setShowNewDetachment(!showNewDetachment)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm transition-colors"
          >
            {showNewDetachment ? 'Cancel' : '+ Add Detachment'}
          </button>
        </div>

        {/* New Detachment Form */}
        {showNewDetachment && (
          <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newDetachment.name}
                  onChange={(e) => setNewDetachment({ ...newDetachment, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="e.g., Gladius Task Force"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Sub-faction</label>
                <input
                  type="text"
                  value={newDetachment.subfaction}
                  onChange={(e) => setNewDetachment({ ...newDetachment, subfaction: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="e.g., Space Wolves"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ability Name</label>
                <input
                  type="text"
                  value={newDetachment.abilityName}
                  onChange={(e) => setNewDetachment({ ...newDetachment, abilityName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="e.g., Combat Doctrines"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Source Book</label>
                <input
                  type="text"
                  value={newDetachment.sourceBook}
                  onChange={(e) => setNewDetachment({ ...newDetachment, sourceBook: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="e.g., Codex: Space Marines"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">Ability Description</label>
              <textarea
                value={newDetachment.abilityDescription}
                onChange={(e) => setNewDetachment({ ...newDetachment, abilityDescription: e.target.value })}
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                placeholder="Full ability text..."
              />
            </div>
            <button
              onClick={handleCreateDetachment}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            >
              Create Detachment
            </button>
          </div>
        )}

        {/* Detachments List */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg divide-y divide-slate-800">
          {faction.detachments.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No detachments found. Add one above or check stratagems section for unlinked detachments.
            </div>
          ) : (
            faction.detachments.map((det) => (
              <Link
                key={det.id}
                href={`/admin/detachments/${det.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div>
                  <span className="font-medium text-white">{det.name}</span>
                  {det.subfaction && (
                    <span className="text-slate-500 ml-2 text-sm">({det.subfaction})</span>
                  )}
                  {det.abilityName && (
                    <span className="text-slate-600 ml-2 text-sm">• {det.abilityName}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-blue-400">{det._count.stratagems} stratagems</span>
                  <span className="text-purple-400">{det._count.enhancements} enhancements</span>
                  <span className="text-slate-500">→</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Stratagems by Detachment */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Stratagems by Detachment</h2>
        
        {Object.entries(stratagemsByDetachment).map(([detName, strats]) => (
          <div key={detName} className="mb-6">
            <h3 className="text-lg font-medium text-amber-400 mb-2">
              {detName} ({strats.length})
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                {strats.map((strat) => (
                  <Link
                    key={strat.id}
                    href={`/admin/stratagems/${strat.id}`}
                    className="flex items-center gap-3 p-2 bg-slate-800/50 rounded hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded text-sm font-bold text-white">
                      {strat.cpCost}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white truncate">{strat.name}</div>
                      <div className="text-xs text-slate-500">{strat.type}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Datasheet Editor Modal */}
      <DatasheetEditorModal
        isOpen={showDatasheetModal}
        onClose={() => {
          setShowDatasheetModal(false);
          setEditingDatasheet(null);
        }}
        onSave={handleSaveDatasheet}
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
        } : {
          faction: faction.name,
          factionId: id,
        }}
        datasheetId={editingDatasheet?.id}
        mode={editingDatasheet ? 'edit' : 'create'}
        factions={allFactions}
      />
    </div>
  );
}
