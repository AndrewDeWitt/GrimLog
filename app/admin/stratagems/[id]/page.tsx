'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Stratagem {
  id: string;
  name: string;
  faction: string;
  subfaction: string | null;
  detachment: string | null;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
  restrictions: string[];
  keywords: string[];
  triggerPhase: string[];
  triggerSubphase: string | null;
  isReactive: boolean;
  requiredKeywords: string[];
  usageRestriction: string | null;
  sourceBook: string | null;
  calculatorEffect: Record<string, unknown> | null;
  factionRel: { id: string; name: string } | null;
  detachmentRel: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export default function StratagemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [stratagem, setStratagem] = useState<Stratagem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cpCost: 1,
    type: '',
    when: '',
    target: '',
    effect: '',
    restrictions: '',
    keywords: '',
    triggerPhase: '',
    triggerSubphase: '',
    isReactive: false,
    requiredKeywords: '',
    usageRestriction: '',
    sourceBook: '',
    calculatorEffect: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStratagem();
  }, [id]);

  const fetchStratagem = async () => {
    try {
      const res = await fetch(`/api/admin/stratagems/${id}`);
      if (!res.ok) throw new Error('Failed to fetch stratagem');
      const data = await res.json();
      setStratagem(data);
      setFormData({
        name: data.name || '',
        cpCost: data.cpCost || 1,
        type: data.type || '',
        when: data.when || '',
        target: data.target || '',
        effect: data.effect || '',
        restrictions: Array.isArray(data.restrictions) ? data.restrictions.join(', ') : '',
        keywords: Array.isArray(data.keywords) ? data.keywords.join(', ') : '',
        triggerPhase: Array.isArray(data.triggerPhase) ? data.triggerPhase.join(', ') : '',
        triggerSubphase: data.triggerSubphase || '',
        isReactive: data.isReactive || false,
        requiredKeywords: Array.isArray(data.requiredKeywords) ? data.requiredKeywords.join(', ') : '',
        usageRestriction: data.usageRestriction || '',
        sourceBook: data.sourceBook || '',
        calculatorEffect: data.calculatorEffect ? JSON.stringify(data.calculatorEffect, null, 2) : ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stratagem');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let calculatorEffect = null;
      if (formData.calculatorEffect.trim()) {
        try {
          calculatorEffect = JSON.parse(formData.calculatorEffect);
        } catch {
          alert('Invalid JSON in calculator effect');
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: formData.name,
        cpCost: formData.cpCost,
        type: formData.type,
        when: formData.when,
        target: formData.target,
        effect: formData.effect,
        restrictions: formData.restrictions ? formData.restrictions.split(',').map(s => s.trim()).filter(Boolean) : [],
        keywords: formData.keywords ? formData.keywords.split(',').map(s => s.trim()).filter(Boolean) : [],
        triggerPhase: formData.triggerPhase ? formData.triggerPhase.split(',').map(s => s.trim()).filter(Boolean) : [],
        triggerSubphase: formData.triggerSubphase || null,
        isReactive: formData.isReactive,
        requiredKeywords: formData.requiredKeywords ? formData.requiredKeywords.split(',').map(s => s.trim()).filter(Boolean) : [],
        usageRestriction: formData.usageRestriction || null,
        sourceBook: formData.sourceBook || null,
        calculatorEffect
      };

      const res = await fetch(`/api/admin/stratagems/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      await fetchStratagem();
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${stratagem?.name}"?`)) return;
    
    try {
      const res = await fetch(`/api/admin/stratagems/${id}`, {
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

  if (error || !stratagem) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error || 'Stratagem not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 flex-wrap">
        <Link href="/admin/factions" className="hover:text-white transition-colors">
          Factions
        </Link>
        <span>/</span>
        {stratagem.factionRel && (
          <>
            <Link 
              href={`/admin/factions/${stratagem.factionRel.id}`} 
              className="hover:text-white transition-colors"
            >
              {stratagem.factionRel.name}
            </Link>
            <span>/</span>
          </>
        )}
        {stratagem.detachmentRel && (
          <>
            <Link 
              href={`/admin/detachments/${stratagem.detachmentRel.id}`} 
              className="hover:text-white transition-colors"
            >
              {stratagem.detachmentRel.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-white">{stratagem.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-blue-600 rounded-lg text-3xl font-bold text-white">
            {stratagem.cpCost}
          </div>
          <div>
            {editing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-2xl font-bold bg-slate-800 border border-slate-700 rounded px-3 py-1 text-white"
              />
            ) : (
              <h1 className="text-2xl font-bold text-white">{stratagem.name}</h1>
            )}
            <p className="text-slate-400 mt-1">
              {stratagem.faction}
              {stratagem.detachment && ` • ${stratagem.detachment}`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                {stratagem.type}
              </span>
              {stratagem.isReactive && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                  Reactive
                </span>
              )}
            </div>
          </div>
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

      {/* Content */}
      {editing ? (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">CP Cost</label>
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={formData.cpCost}
                  onChange={(e) => setFormData({ ...formData, cpCost: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="Battle Tactic">Battle Tactic</option>
                  <option value="Strategic Ploy">Strategic Ploy</option>
                  <option value="Epic Deed">Epic Deed</option>
                  <option value="Wargear">Wargear</option>
                </select>
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
                <label className="block text-sm text-slate-400 mb-1">Usage Restriction</label>
                <select
                  value={formData.usageRestriction}
                  onChange={(e) => setFormData({ ...formData, usageRestriction: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">None</option>
                  <option value="once_per_battle">Once per battle</option>
                  <option value="once_per_turn">Once per turn</option>
                  <option value="once_per_phase">Once per phase</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isReactive"
                  checked={formData.isReactive}
                  onChange={(e) => setFormData({ ...formData, isReactive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isReactive" className="text-slate-300">Reactive (can be used during opponent&apos;s turn)</label>
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">Timing & Targeting</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">When</label>
                <textarea
                  value={formData.when}
                  onChange={(e) => setFormData({ ...formData, when: e.target.value })}
                  className="w-full h-20 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Target</label>
                <textarea
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  className="w-full h-20 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Effect</label>
                <textarea
                  value={formData.effect}
                  onChange={(e) => setFormData({ ...formData, effect: e.target.value })}
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">Phase & Keyword Metadata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Trigger Phase (comma-separated)</label>
                <input
                  type="text"
                  value={formData.triggerPhase}
                  onChange={(e) => setFormData({ ...formData, triggerPhase: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="Movement, Shooting, Fight"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Trigger Subphase</label>
                <input
                  type="text"
                  value={formData.triggerSubphase}
                  onChange={(e) => setFormData({ ...formData, triggerSubphase: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="Start of Phase"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Required Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.requiredKeywords}
                  onChange={(e) => setFormData({ ...formData, requiredKeywords: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="INFANTRY, VEHICLE"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Calculator Effect */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">Calculator Effect (JSON)</h3>
            <textarea
              value={formData.calculatorEffect}
              onChange={(e) => setFormData({ ...formData, calculatorEffect: e.target.value })}
              className="w-full h-32 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm"
              placeholder='{"type": "attacker_modifier", "lethal_hits": true}'
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* When/Target/Effect Display */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-1">When</h4>
              <p className="text-white">{stratagem.when}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-1">Target</h4>
              <p className="text-white">{stratagem.target}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-1">Effect</h4>
              <p className="text-white whitespace-pre-wrap">{stratagem.effect}</p>
            </div>
          </div>

          {/* Metadata Display */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {stratagem.triggerPhase.length > 0 && (
                <div>
                  <span className="text-slate-400">Trigger Phase: </span>
                  <span className="text-white">{stratagem.triggerPhase.join(', ')}</span>
                </div>
              )}
              {stratagem.triggerSubphase && (
                <div>
                  <span className="text-slate-400">Trigger Subphase: </span>
                  <span className="text-white">{stratagem.triggerSubphase}</span>
                </div>
              )}
              {stratagem.requiredKeywords.length > 0 && (
                <div>
                  <span className="text-slate-400">Required Keywords: </span>
                  <span className="text-white">{stratagem.requiredKeywords.join(', ')}</span>
                </div>
              )}
              {stratagem.usageRestriction && (
                <div>
                  <span className="text-slate-400">Usage: </span>
                  <span className="text-white">{stratagem.usageRestriction.replace(/_/g, ' ')}</span>
                </div>
              )}
              {stratagem.sourceBook && (
                <div>
                  <span className="text-slate-400">Source: </span>
                  <span className="text-white">{stratagem.sourceBook}</span>
                </div>
              )}
            </div>
          </div>

          {/* Calculator Effect Display */}
          {stratagem.calculatorEffect && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-2">Calculator Effect</h3>
              <pre className="text-sm text-slate-300 bg-slate-800 p-3 rounded overflow-x-auto">
                {JSON.stringify(stratagem.calculatorEffect, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

