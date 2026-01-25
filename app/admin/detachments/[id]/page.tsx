'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Detachment {
  id: string;
  name: string;
  faction: string;
  factionId: string | null;
  subfaction: string | null;
  description: string | null;
  abilityName: string | null;
  abilityDescription: string | null;
  sourceBook: string | null;
  edition: string;
  factionRel: { id: string; name: string } | null;
  stratagems: Stratagem[];
  enhancements: Enhancement[];
  _count: {
    stratagems: number;
    enhancements: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Stratagem {
  id: string;
  name: string;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
  restrictions: string[] | null;
  triggerPhase: string[] | null;
  isReactive: boolean;
}

interface Enhancement {
  id: string;
  name: string;
  pointsCost: number;
  description: string;
  restrictions: string;
}

export default function DetachmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detachment, setDetachment] = useState<Detachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subfaction: '',
    description: '',
    abilityName: '',
    abilityDescription: '',
    sourceBook: ''
  });
  const [saving, setSaving] = useState(false);
  const [expandedStratagem, setExpandedStratagem] = useState<string | null>(null);

  useEffect(() => {
    fetchDetachment();
  }, [id]);

  const fetchDetachment = async () => {
    try {
      const res = await fetch(`/api/admin/detachments/${id}`);
      if (!res.ok) throw new Error('Failed to fetch detachment');
      const data = await res.json();
      setDetachment(data);
      setFormData({
        name: data.name || '',
        subfaction: data.subfaction || '',
        description: data.description || '',
        abilityName: data.abilityName || '',
        abilityDescription: data.abilityDescription || '',
        sourceBook: data.sourceBook || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detachment');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/detachments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      await fetchDetachment();
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${detachment?.name}"?`)) return;
    
    try {
      const res = await fetch(`/api/admin/detachments/${id}?force=true`, {
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

  // Group stratagems by type
  const stratagemsByType = detachment?.stratagems.reduce((acc, s) => {
    if (!acc[s.type]) acc[s.type] = [];
    acc[s.type].push(s);
    return acc;
  }, {} as Record<string, Stratagem[]>) || {};

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

  if (error || !detachment) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error || 'Detachment not found'}
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
        {detachment.factionRel && (
          <>
            <Link 
              href={`/admin/factions/${detachment.factionRel.id}`} 
              className="hover:text-white transition-colors"
            >
              {detachment.factionRel.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-white">{detachment.name}</span>
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
            <h1 className="text-3xl font-bold text-amber-500">{detachment.name}</h1>
          )}
          <p className="text-slate-400 mt-1">
            {detachment.faction}
            {detachment.subfaction && ` • ${detachment.subfaction}`}
          </p>
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
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{detachment._count.stratagems}</div>
          <div className="text-sm text-slate-400">Stratagems</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{detachment._count.enhancements}</div>
          <div className="text-sm text-slate-400">Enhancements</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400">Edition</div>
          <div className="text-lg font-bold text-white">{detachment.edition}</div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">Detachment Details</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Sub-faction</label>
              <input
                type="text"
                value={formData.subfaction}
                onChange={(e) => setFormData({ ...formData, subfaction: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Source Book</label>
              <input
                type="text"
                value={formData.sourceBook}
                onChange={(e) => setFormData({ ...formData, sourceBook: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ability Name</label>
              <input
                type="text"
                value={formData.abilityName}
                onChange={(e) => setFormData({ ...formData, abilityName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Ability Description</label>
            <textarea
              value={formData.abilityDescription}
              onChange={(e) => setFormData({ ...formData, abilityDescription: e.target.value })}
              className="w-full h-32 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
      )}

      {/* Detachment Ability Display */}
      {!editing && detachment.abilityName && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-4 mb-8">
          <h3 className="text-lg font-bold text-amber-500 mb-2">{detachment.abilityName}</h3>
          {detachment.abilityDescription && (
            <p className="text-slate-300 whitespace-pre-wrap">{detachment.abilityDescription}</p>
          )}
        </div>
      )}

      {/* Stratagems Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Stratagems</h2>
        
        {Object.entries(stratagemsByType).length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500">
            No stratagems found for this detachment
          </div>
        ) : (
          Object.entries(stratagemsByType).map(([type, strats]) => (
            <div key={type} className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-2">
                {type} ({strats.length})
              </h3>
              <div className="bg-slate-900 border border-slate-800 rounded-lg divide-y divide-slate-800">
                {strats.map((strat) => (
                  <div key={strat.id} className="p-4">
                    <div 
                      className="flex items-center gap-4 cursor-pointer"
                      onClick={() => setExpandedStratagem(expandedStratagem === strat.id ? null : strat.id)}
                    >
                      <span className="w-10 h-10 flex items-center justify-center bg-blue-600 rounded-lg text-lg font-bold text-white">
                        {strat.cpCost}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{strat.name}</span>
                          {strat.isReactive && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Reactive</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500">{strat.type}</div>
                      </div>
                      <Link
                        href={`/admin/stratagems/${strat.id}`}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                      <span className="text-slate-500">
                        {expandedStratagem === strat.id ? '▼' : '▶'}
                      </span>
                    </div>
                    
                    {expandedStratagem === strat.id && (
                      <div className="mt-4 pl-14 space-y-3 text-sm">
                        <div>
                          <span className="text-slate-500">When: </span>
                          <span className="text-slate-300">{strat.when}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Target: </span>
                          <span className="text-slate-300">{strat.target}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Effect: </span>
                          <span className="text-slate-300">{strat.effect}</span>
                        </div>
                        {strat.triggerPhase && strat.triggerPhase.length > 0 && (
                          <div>
                            <span className="text-slate-500">Phases: </span>
                            <span className="text-slate-300">{strat.triggerPhase.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Enhancements Section */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Enhancements</h2>
        
        {detachment.enhancements.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500">
            No enhancements found for this detachment
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg divide-y divide-slate-800">
            {detachment.enhancements.map((enh) => (
              <div key={enh.id} className="p-4">
                <div className="flex items-center gap-4">
                  <span className="w-16 text-center text-purple-400 font-bold">{enh.pointsCost} pts</span>
                  <div className="flex-1">
                    <div className="font-bold text-white">{enh.name}</div>
                    <div className="text-sm text-slate-400 mt-1">{enh.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

