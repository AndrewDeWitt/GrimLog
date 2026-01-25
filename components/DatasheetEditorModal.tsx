'use client';

import { useState, useEffect } from 'react';
import { CreateDatasheetInput, WeaponInput, AbilityInput, WargearOptionInput } from '@/lib/datasheetValidation';

interface DatasheetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (datasheet: CreateDatasheetInput) => Promise<void>;
  initialData?: Partial<CreateDatasheetInput>;
  datasheetId?: string; // For edit mode - needed for sources management
  mode: 'create' | 'edit';
  factions?: Array<{ id: string; name: string }>;
}

type Step = 'basic' | 'stats' | 'weapons' | 'abilities' | 'competitive' | 'extras';

const TIER_RANKS = ['S', 'A', 'B', 'C', 'D', 'F'] as const;

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

// ============================================
// COMPETITIVE CONTEXT EDITOR COMPONENT
// ============================================

interface CompetitiveContext {
  id: string;
  factionId: string | null;
  factionName: string | null;
  detachmentId: string | null;
  detachmentName: string | null;
  competitiveTier: string | null;
  tierReasoning: string | null;
  bestTargets: string[] | null;
  counters: string[] | null;
  synergies: string[] | null;
  playstyleNotes: string | null;
  deploymentTips: string | null;
  competitiveNotes: string | null;
  sourceCount: number | null;
  lastAggregated: string | null;
}

interface CompetitiveContextEditorProps {
  contexts: CompetitiveContext[];
  datasheetId?: string;
  onUpdate: (contexts: CompetitiveContext[]) => void;
}

function CompetitiveContextEditor({ contexts, datasheetId, onUpdate }: CompetitiveContextEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<CompetitiveContext | null>(null);
  const [saving, setSaving] = useState(false);

  const handleEdit = (ctx: CompetitiveContext) => {
    setEditingId(ctx.id);
    setEditData({ ...ctx });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleSave = async () => {
    if (!editData || !datasheetId) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/datasheets/${datasheetId}/aggregate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factionId: editData.factionId,
          detachmentId: editData.detachmentId,
          competitiveTier: editData.competitiveTier,
          tierReasoning: editData.tierReasoning,
          bestTargets: editData.bestTargets ? JSON.stringify(editData.bestTargets) : null,
          counters: editData.counters ? JSON.stringify(editData.counters) : null,
          synergies: editData.synergies ? JSON.stringify(editData.synergies) : null,
          playstyleNotes: editData.playstyleNotes,
          deploymentTips: editData.deploymentTips,
          competitiveNotes: editData.competitiveNotes,
        }),
      });

      if (res.ok) {
        // Update local state
        const updatedContexts = contexts.map(ctx => 
          ctx.id === editData.id ? { ...editData, lastAggregated: new Date().toISOString() } : ctx
        );
        onUpdate(updatedContexts);
        setEditingId(null);
        setEditData(null);
      } else {
        alert('Failed to save context');
      }
    } catch (err) {
      console.error('Failed to save context:', err);
      alert('Failed to save context');
    } finally {
      setSaving(false);
    }
  };

  const getTierColor = (tier: string | null) => {
    switch (tier) {
      case 'S': return 'bg-amber-500/30 text-amber-300';
      case 'A': return 'bg-green-500/30 text-green-300';
      case 'B': return 'bg-blue-500/30 text-blue-300';
      case 'C': return 'bg-slate-500/30 text-slate-300';
      case 'D': return 'bg-orange-500/30 text-orange-300';
      case 'F': return 'bg-red-500/30 text-red-300';
      default: return 'bg-slate-500/30 text-slate-300';
    }
  };

  if (contexts.length === 0) {
    return (
      <div className="bg-grimlog-black/50 border border-grimlog-steel/30 p-4 rounded-lg text-center">
        <p className="text-grimlog-steel text-sm">No competitive context available yet.</p>
        <p className="text-grimlog-steel text-xs mt-1">Run the aggregation pipeline to generate context from sources.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 p-4 rounded-lg">
      <h3 className="text-black font-bold mb-3">🎯 Competitive Context</h3>
      <div className="space-y-3">
        {contexts.map(ctx => {
          const isEditing = editingId === ctx.id;
          const data = isEditing ? editData! : ctx;

          return (
            <div key={ctx.id} className="bg-grimlog-black/30 p-3 rounded border border-green-500/20">
              {/* Header with scope and edit button */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded">
                    {ctx.factionName || 'Generic'}
                    {ctx.detachmentName && ` → ${ctx.detachmentName}`}
                  </span>
                  {data.competitiveTier && !isEditing && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${getTierColor(data.competitiveTier)}`}>
                      {data.competitiveTier}-TIER
                    </span>
                  )}
                  {ctx.sourceCount && (
                    <span className="text-xs text-grimlog-steel">
                      ({ctx.sourceCount} source{ctx.sourceCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => handleEdit(ctx)}
                    className="px-2 py-1 text-xs bg-grimlog-orange/20 hover:bg-grimlog-orange/40 text-grimlog-orange rounded"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-2 py-1 text-xs bg-grimlog-steel/30 hover:bg-grimlog-steel/50 text-white rounded"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                  {/* Tier & Reasoning */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-grimlog-steel mb-1">Tier</label>
                      <select
                        value={editData?.competitiveTier || ''}
                        onChange={e => setEditData(prev => prev ? { ...prev, competitiveTier: e.target.value || null } : null)}
                        className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded"
                      >
                        <option value="">Not Rated</option>
                        {TIER_RANKS.map(tier => (
                          <option key={tier} value={tier}>{tier}-Tier</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-grimlog-steel mb-1">Tier Reasoning</label>
                      <input
                        type="text"
                        value={editData?.tierReasoning || ''}
                        onChange={e => setEditData(prev => prev ? { ...prev, tierReasoning: e.target.value || null } : null)}
                        className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded"
                        placeholder="Why this tier?"
                      />
                    </div>
                  </div>

                  {/* Best Targets & Counters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-grimlog-steel mb-1">Best Targets (comma-separated)</label>
                      <input
                        type="text"
                        value={(editData?.bestTargets || []).join(', ')}
                        onChange={e => setEditData(prev => prev ? { 
                          ...prev, 
                          bestTargets: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null 
                        } : null)}
                        className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded"
                        placeholder="Infantry, Vehicles..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-grimlog-steel mb-1">Countered By (comma-separated)</label>
                      <input
                        type="text"
                        value={(editData?.counters || []).join(', ')}
                        onChange={e => setEditData(prev => prev ? { 
                          ...prev, 
                          counters: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null 
                        } : null)}
                        className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded"
                        placeholder="Anti-tank, Mortals..."
                      />
                    </div>
                  </div>

                  {/* Synergies */}
                  <div>
                    <label className="block text-xs text-grimlog-steel mb-1">Synergies (comma-separated)</label>
                    <input
                      type="text"
                      value={(editData?.synergies || []).join(', ')}
                      onChange={e => setEditData(prev => prev ? { 
                        ...prev, 
                        synergies: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null 
                      } : null)}
                      className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded"
                      placeholder="Characters, combos..."
                    />
                  </div>

                  {/* Playstyle Notes */}
                  <div>
                    <label className="block text-xs text-grimlog-steel mb-1">Playstyle Notes</label>
                    <textarea
                      value={editData?.playstyleNotes || ''}
                      onChange={e => setEditData(prev => prev ? { ...prev, playstyleNotes: e.target.value || null } : null)}
                      className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded min-h-[60px]"
                      placeholder="How to play this unit..."
                    />
                  </div>

                  {/* Deployment & Notes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-grimlog-steel mb-1">Deployment Tips</label>
                      <textarea
                        value={editData?.deploymentTips || ''}
                        onChange={e => setEditData(prev => prev ? { ...prev, deploymentTips: e.target.value || null } : null)}
                        className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded min-h-[50px]"
                        placeholder="Deployment advice..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-grimlog-steel mb-1">Additional Notes</label>
                      <textarea
                        value={editData?.competitiveNotes || ''}
                        onChange={e => setEditData(prev => prev ? { ...prev, competitiveNotes: e.target.value || null } : null)}
                        className="w-full px-2 py-1.5 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded min-h-[50px]"
                        placeholder="Other notes..."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  {/* Tier Reasoning */}
                  {data.tierReasoning && (
                    <p className="text-sm text-grimlog-light-steel mb-2">{data.tierReasoning}</p>
                  )}

                  {/* Tags Grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {data.bestTargets && data.bestTargets.length > 0 && (
                      <div>
                        <span className="text-green-400 font-bold">Best Against:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {data.bestTargets.slice(0, 3).map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">{t}</span>
                          ))}
                          {data.bestTargets.length > 3 && (
                            <span className="text-grimlog-steel">+{data.bestTargets.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {data.counters && data.counters.length > 0 && (
                      <div>
                        <span className="text-red-400 font-bold">Countered By:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {data.counters.slice(0, 3).map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">{c}</span>
                          ))}
                          {data.counters.length > 3 && (
                            <span className="text-grimlog-steel">+{data.counters.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {data.synergies && data.synergies.length > 0 && (
                      <div>
                        <span className="text-blue-400 font-bold">Synergies:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {data.synergies.slice(0, 3).map((s, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">{s}</span>
                          ))}
                          {data.synergies.length > 3 && (
                            <span className="text-grimlog-steel">+{data.synergies.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Playstyle Notes */}
                  {data.playstyleNotes && (
                    <div className="mt-2 pt-2 border-t border-grimlog-steel/30">
                      <span className="text-amber-400 text-xs font-bold">How to Play:</span>
                      <p className="text-xs text-grimlog-light-steel mt-1">{data.playstyleNotes}</p>
                    </div>
                  )}

                  {/* Last Aggregated */}
                  {ctx.lastAggregated && (
                    <p className="text-xs text-grimlog-steel mt-2">
                      Last updated: {new Date(ctx.lastAggregated).toLocaleDateString()}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_DATASHEET: CreateDatasheetInput = {
  name: '',
  faction: '',
  factionId: null,
  subfaction: null,
  role: 'Battleline',
  keywords: [],
  movement: '6"',
  toughness: 4,
  save: '4+',
  invulnerableSave: null,
  wounds: 1,
  leadership: 7,
  objectiveControl: 1,
  composition: '1 Model',
  compositionData: null,
  unitSize: '1',
  leaderRules: null,
  leaderAbilities: null,
  transportCapacity: null,
  pointsCost: 0,
  edition: '10th',
  sourceBook: null,
  // Competitive Context
  competitiveTier: null,
  tierReasoning: null,
  bestTargets: null,
  counters: null,
  synergies: null,
  playstyleNotes: null,
  deploymentTips: null,
  competitiveNotes: null,
  // Related data
  weapons: [],
  abilities: [],
  wargearOptions: [],
};

export default function DatasheetEditorModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  datasheetId,
  mode,
  factions = [],
}: DatasheetEditorModalProps) {
  const [step, setStep] = useState<Step>('basic');
  const [formData, setFormData] = useState<CreateDatasheetInput>(DEFAULT_DATASHEET);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize form data when modal opens - fetch fresh data for edit mode
  useEffect(() => {
    if (isOpen) {
      setStep('basic');
      setError(null);
      
      // In edit mode with datasheetId, fetch fresh data from API to get all fields
      if (mode === 'edit' && datasheetId) {
        setLoading(true);
        fetch(`/api/admin/datasheets/${datasheetId}`)
          .then(res => res.json())
          .then(data => {
            if (data.error) {
              setError(data.error);
              setFormData({ ...DEFAULT_DATASHEET, ...initialData });
            } else {
              setFormData({ ...DEFAULT_DATASHEET, ...data });
            }
          })
          .catch(err => {
            console.error('Failed to fetch datasheet:', err);
            setFormData({ ...DEFAULT_DATASHEET, ...initialData });
          })
          .finally(() => setLoading(false));
      } else if (initialData) {
        setFormData({ ...DEFAULT_DATASHEET, ...initialData });
      } else {
        setFormData(DEFAULT_DATASHEET);
      }
    }
  }, [isOpen, datasheetId, mode, initialData]);

  if (!isOpen) return null;

  const updateField = <K extends keyof CreateDatasheetInput>(
    field: K,
    value: CreateDatasheetInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addKeyword = () => {
    const keyword = keywordInput.trim().toUpperCase();
    if (keyword && !formData.keywords.includes(keyword)) {
      updateField('keywords', [...formData.keywords, keyword]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    updateField('keywords', formData.keywords.filter(k => k !== keyword));
  };

  const addWeapon = () => {
    const newWeapon: WeaponInput = {
      name: '',
      range: 'Melee',
      type: 'Melee',
      attacks: '1',
      ballisticSkill: null,
      weaponSkill: '4+',
      strength: '4',
      armorPenetration: '0',
      damage: '1',
      abilities: [],
      isDefault: true,
      quantity: null,
    };
    updateField('weapons', [...formData.weapons, newWeapon]);
  };

  const updateWeapon = (index: number, weapon: WeaponInput) => {
    const updated = [...formData.weapons];
    updated[index] = weapon;
    updateField('weapons', updated);
  };

  const removeWeapon = (index: number) => {
    updateField('weapons', formData.weapons.filter((_, i) => i !== index));
  };

  const addAbility = () => {
    const newAbility: AbilityInput = {
      name: '',
      type: 'unit',
      description: '',
      triggerPhase: null,
      triggerSubphase: null,
      isReactive: false,
      requiredKeywords: null,
    };
    updateField('abilities', [...formData.abilities, newAbility]);
  };

  const updateAbility = (index: number, ability: AbilityInput) => {
    const updated = [...formData.abilities];
    updated[index] = ability;
    updateField('abilities', updated);
  };

  const removeAbility = (index: number) => {
    updateField('abilities', formData.abilities.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save datasheet');
    } finally {
      setSaving(false);
    }
  };

  const steps: { id: Step; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'stats', label: 'Stats' },
    { id: 'weapons', label: 'Weapons' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'competitive', label: 'Competitive' },
    { id: 'extras', label: 'Extras' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);
  const canGoBack = currentStepIndex > 0;
  const canGoNext = currentStepIndex < steps.length - 1;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" onClick={onClose} />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-4xl mx-auto max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="border-b border-grimlog-steel p-4 bg-grimlog-slate-dark">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 tracking-wider">
              {mode === 'create' ? 'CREATE DATASHEET' : 'EDIT DATASHEET'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            >
              ×
            </button>
          </div>
          
          {/* Step Indicator */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`px-3 py-1 text-sm font-mono transition-colors rounded-lg whitespace-nowrap ${
                  step === s.id
                    ? 'bg-grimlog-orange text-gray-900'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-grimlog-orange'
                }`}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-grimlog-slate-light">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grimlog-orange"></div>
              <span className="ml-3 text-gray-600">Loading datasheet...</span>
            </div>
          )}

          {/* Basic Info Step */}
          {!loading && step === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    placeholder="e.g., Tactical Squad"
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Faction *</label>
                  {factions.length > 0 ? (
                    <select
                      value={formData.factionId || ''}
                      onChange={e => {
                        const faction = factions.find(f => f.id === e.target.value);
                        updateField('factionId', e.target.value || null);
                        updateField('faction', faction?.name || '');
                      }}
                      className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    >
                      <option value="">Select Faction...</option>
                      {factions.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.faction}
                      onChange={e => updateField('faction', e.target.value)}
                      className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                      placeholder="e.g., Space Marines"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Subfaction</label>
                  <input
                    type="text"
                    value={formData.subfaction || ''}
                    onChange={e => updateField('subfaction', e.target.value || null)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    placeholder="e.g., Space Wolves (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={e => updateField('role', e.target.value as any)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Points Cost *</label>
                  <input
                    type="number"
                    value={formData.pointsCost}
                    onChange={e => updateField('pointsCost', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Unit Size</label>
                  <input
                    type="text"
                    value={formData.unitSize || ''}
                    onChange={e => updateField('unitSize', e.target.value || null)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    placeholder="e.g., 5-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Composition *</label>
                <input
                  type="text"
                  value={formData.composition}
                  onChange={e => updateField('composition', e.target.value)}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                  placeholder="e.g., 1 Sergeant, 4-9 Tactical Marines"
                />
              </div>

              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Keywords *</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    className="flex-1 px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    placeholder="Add keyword (e.g., INFANTRY)"
                  />
                  <button
                    onClick={addKeyword}
                    className="px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600"
                  >
                    ADD
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map(kw => (
                    <span
                      key={kw}
                      className="px-2 py-1 text-white bg-grimlog-gray border border-grimlog-steel text-sm flex items-center gap-2"
                    >
                      {kw}
                      <button
                        onClick={() => removeKeyword(kw)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stats Step */}
          {!loading && step === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Movement *</label>
                  <input
                    type="text"
                    value={formData.movement}
                    onChange={e => updateField('movement', e.target.value)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    placeholder='e.g., 6"'
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Toughness *</label>
                  <input
                    type="number"
                    value={formData.toughness}
                    onChange={e => updateField('toughness', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    min={1}
                    max={20}
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Save *</label>
                  <input
                    type="text"
                    value={formData.save}
                    onChange={e => updateField('save', e.target.value)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    placeholder="e.g., 3+"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Wounds *</label>
                  <input
                    type="number"
                    value={formData.wounds}
                    onChange={e => updateField('wounds', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    min={1}
                    max={50}
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">Leadership *</label>
                  <input
                    type="number"
                    value={formData.leadership}
                    onChange={e => updateField('leadership', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    min={1}
                    max={12}
                  />
                </div>
                <div>
                  <label className="block text-sm text-grimlog-light-steel mb-1">OC *</label>
                  <input
                    type="number"
                    value={formData.objectiveControl}
                    onChange={e => updateField('objectiveControl', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                    min={0}
                    max={10}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Invulnerable Save</label>
                <input
                  type="text"
                  value={formData.invulnerableSave || ''}
                  onChange={e => updateField('invulnerableSave', e.target.value || null)}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                  placeholder="e.g., 5+ (optional)"
                />
              </div>
            </div>
          )}

          {/* Weapons Step */}
          {!loading && step === 'weapons' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg text-grimlog-orange font-bold">WEAPONS</h3>
                <button
                  onClick={addWeapon}
                  className="px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600"
                >
                  + ADD WEAPON
                </button>
              </div>

              {formData.weapons.length === 0 ? (
                <p className="text-grimlog-light-steel text-center py-8">
                  No weapons added. Click &quot;Add Weapon&quot; to add one.
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.weapons.map((weapon, index) => (
                    <div key={index} className="border border-grimlog-steel p-4 bg-grimlog-black">
                      <div className="flex justify-between items-start mb-3">
                        <input
                          type="text"
                          value={weapon.name}
                          onChange={e => updateWeapon(index, { ...weapon, name: e.target.value })}
                          className="text-lg font-bold bg-transparent border-b border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                          placeholder="Weapon Name"
                        />
                        <button
                          onClick={() => removeWeapon(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <label className="text-grimlog-light-steel text-xs">Range</label>
                          <input
                            type="text"
                            value={weapon.range}
                            onChange={e => updateWeapon(index, { ...weapon, range: e.target.value })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-grimlog-light-steel text-xs">Type</label>
                          <input
                            type="text"
                            value={weapon.type}
                            onChange={e => updateWeapon(index, { ...weapon, type: e.target.value })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-grimlog-light-steel text-xs">Attacks</label>
                          <input
                            type="text"
                            value={weapon.attacks}
                            onChange={e => updateWeapon(index, { ...weapon, attacks: e.target.value })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-grimlog-light-steel text-xs">BS/WS</label>
                          <input
                            type="text"
                            value={weapon.range === 'Melee' ? (weapon.weaponSkill || '') : (weapon.ballisticSkill || '')}
                            onChange={e => {
                              if (weapon.range === 'Melee') {
                                updateWeapon(index, { ...weapon, weaponSkill: e.target.value || null });
                              } else {
                                updateWeapon(index, { ...weapon, ballisticSkill: e.target.value || null });
                              }
                            }}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                            placeholder="3+"
                          />
                        </div>
                        <div>
                          <label className="text-grimlog-light-steel text-xs">Strength</label>
                          <input
                            type="text"
                            value={weapon.strength}
                            onChange={e => updateWeapon(index, { ...weapon, strength: e.target.value })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-grimlog-light-steel text-xs">AP</label>
                          <input
                            type="text"
                            value={weapon.armorPenetration}
                            onChange={e => updateWeapon(index, { ...weapon, armorPenetration: e.target.value })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-grimlog-light-steel text-xs">Damage</label>
                          <input
                            type="text"
                            value={weapon.damage}
                            onChange={e => updateWeapon(index, { ...weapon, damage: e.target.value })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-grimlog-light-steel text-xs">
                            <input
                              type="checkbox"
                              checked={weapon.isDefault}
                              onChange={e => updateWeapon(index, { ...weapon, isDefault: e.target.checked })}
                              className="accent-grimlog-orange"
                            />
                            Default
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Abilities Step */}
          {!loading && step === 'abilities' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg text-grimlog-orange font-bold">ABILITIES</h3>
                <button
                  onClick={addAbility}
                  className="px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600"
                >
                  + ADD ABILITY
                </button>
              </div>

              {formData.abilities.length === 0 ? (
                <p className="text-grimlog-light-steel text-center py-8">
                  No abilities added. Click &quot;Add Ability&quot; to add one.
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.abilities.map((ability, index) => (
                    <div key={index} className="border border-grimlog-steel p-4 bg-grimlog-black">
                      <div className="flex justify-between items-start mb-3">
                        <input
                          type="text"
                          value={ability.name}
                          onChange={e => updateAbility(index, { ...ability, name: e.target.value })}
                          className="text-lg font-bold bg-transparent border-b border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                          placeholder="Ability Name"
                        />
                        <button
                          onClick={() => removeAbility(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-grimlog-light-steel text-xs">Type</label>
                          <select
                            value={ability.type}
                            onChange={e => updateAbility(index, { ...ability, type: e.target.value as any })}
                            className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm"
                          >
                            <option value="core">Core</option>
                            <option value="faction">Faction</option>
                            <option value="unit">Unit</option>
                            <option value="leader">Leader</option>
                            <option value="wargear">Wargear</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-grimlog-light-steel text-xs">
                            <input
                              type="checkbox"
                              checked={ability.isReactive}
                              onChange={e => updateAbility(index, { ...ability, isReactive: e.target.checked })}
                              className="accent-grimlog-orange"
                            />
                            Reactive (usable in opponent&apos;s turn)
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="text-grimlog-light-steel text-xs">Description</label>
                        <textarea
                          value={ability.description}
                          onChange={e => updateAbility(index, { ...ability, description: e.target.value })}
                          className="w-full px-2 py-1 bg-grimlog-gray border border-grimlog-steel text-white text-sm min-h-[80px]"
                          placeholder="Ability description..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Competitive Step */}
          {!loading && step === 'competitive' && (
            <CompetitiveStepContent 
              formData={formData} 
              updateField={updateField}
              unitName={formData.name}
              faction={formData.faction}
              datasheetId={datasheetId}
              isEditMode={mode === 'edit'}
              onContextsUpdate={(contexts) => {
                setFormData(prev => ({ ...prev, competitiveContexts: contexts } as any));
              }}
            />
          )}

          {/* Extras Step */}
          {!loading && step === 'extras' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Leader Rules</label>
                <textarea
                  value={formData.leaderRules || ''}
                  onChange={e => updateField('leaderRules', e.target.value || null)}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none min-h-[80px]"
                  placeholder="Who this leader can attach to (optional)"
                />
              </div>

              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Leader Abilities</label>
                <textarea
                  value={formData.leaderAbilities || ''}
                  onChange={e => updateField('leaderAbilities', e.target.value || null)}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none min-h-[80px]"
                  placeholder="Abilities granted when leading a unit (optional)"
                />
              </div>

              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Transport Capacity</label>
                <input
                  type="text"
                  value={formData.transportCapacity || ''}
                  onChange={e => updateField('transportCapacity', e.target.value || null)}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                  placeholder="e.g., 10 Infantry models (optional)"
                />
              </div>

              <div>
                <label className="block text-sm text-grimlog-light-steel mb-1">Source Book</label>
                <input
                  type="text"
                  value={formData.sourceBook || ''}
                  onChange={e => updateField('sourceBook', e.target.value || null)}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white focus:border-grimlog-orange outline-none"
                  placeholder="e.g., Codex: Space Marines (optional)"
                />
              </div>

              {/* Summary Preview */}
              <div className="border border-grimlog-orange p-4 mt-6">
                <h3 className="text-grimlog-orange font-bold mb-3">SUMMARY</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-grimlog-light-steel">Name:</span> <span className="text-white">{formData.name || '(not set)'}</span></div>
                  <div><span className="text-grimlog-light-steel">Faction:</span> <span className="text-white">{formData.faction || '(not set)'}</span></div>
                  <div><span className="text-grimlog-light-steel">Role:</span> <span className="text-white">{formData.role}</span></div>
                  <div><span className="text-grimlog-light-steel">Points:</span> <span className="text-grimlog-green">{formData.pointsCost}</span></div>
                  <div><span className="text-grimlog-light-steel">Weapons:</span> <span className="text-white">{formData.weapons.length}</span></div>
                  <div><span className="text-grimlog-light-steel">Abilities:</span> <span className="text-white">{formData.abilities.length}</span></div>
                  <div className="col-span-2">
                    <span className="text-grimlog-light-steel">Keywords:</span>{' '}
                    <span className="text-white">{formData.keywords.join(', ') || '(none)'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-grimlog-steel p-4 flex justify-between bg-grimlog-slate-dark">
          <button
            onClick={() => setStep(steps[currentStepIndex - 1]?.id)}
            disabled={!canGoBack}
            className={`px-4 py-2 font-bold rounded-lg ${
              canGoBack
                ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            ← Back
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 font-bold rounded-lg"
            >
              Cancel
            </button>
            
            {isLastStep ? (
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.faction || formData.keywords.length === 0}
                className={`px-6 py-2 font-bold rounded-lg ${
                  saving || !formData.name || !formData.faction || formData.keywords.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-grimlog-orange text-gray-900 hover:bg-grimlog-amber'
                }`}
              >
                {saving ? 'Saving...' : mode === 'create' ? 'Create Datasheet' : 'Save Changes'}
              </button>
            ) : (
              <button
                onClick={() => setStep(steps[currentStepIndex + 1]?.id)}
                className="px-6 py-2 bg-grimlog-orange text-gray-900 hover:bg-grimlog-amber font-bold rounded-lg"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPETITIVE STEP CONTENT COMPONENT
// ============================================

interface DatasheetSourceItem {
  id: string;
  sourceType: string;
  sourceUrl: string;
  sourceTitle: string | null;
  channelName: string | null;
  status: string;
  confidence: number | null;
  isOutdated: boolean;
  outdatedAt: string | null;
  outdatedReason: string | null;
  createdAt: string;
}

interface CompetitiveStepContentProps {
  formData: CreateDatasheetInput;
  updateField: <K extends keyof CreateDatasheetInput>(field: K, value: CreateDatasheetInput[K]) => void;
  unitName: string;
  faction: string;
  datasheetId?: string;
  isEditMode: boolean;
  onContextsUpdate: (contexts: CompetitiveContext[]) => void;
}

function CompetitiveStepContent({ formData, updateField, unitName, faction, datasheetId, isEditMode, onContextsUpdate }: CompetitiveStepContentProps) {
  // Sources state
  const [sources, setSources] = useState<DatasheetSourceItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [contextInfo, setContextInfo] = useState<{
    lastAggregated: string | null;
    sourceCount: number | null;
    conflicts: any[] | null;
  }>({ lastAggregated: null, sourceCount: null, conflicts: null });
  
  // Note: Sources are now added at FACTION level, not per-datasheet
  // The sources shown here are links created during the curation step
  
  // Outdate dialog
  const [outdatingSourceId, setOutdatingSourceId] = useState<string | null>(null);
  const [outdateReason, setOutdateReason] = useState('');

  // Source type options
  const sourceTypeOptions = [
    { value: 'youtube', label: 'YouTube', icon: '📺' },
    { value: 'reddit', label: 'Reddit', icon: '🔴' },
    { value: 'article', label: 'Article', icon: '📄' },
    { value: 'forum', label: 'Forum', icon: '💬' },
    { value: 'other', label: 'Other', icon: '🌐' },
  ];

  // Fetch sources when in edit mode
  useEffect(() => {
    if (isEditMode && datasheetId) {
      fetchSources();
    }
  }, [isEditMode, datasheetId]);

  const fetchSources = async () => {
    if (!datasheetId) return;
    setSourcesLoading(true);
    try {
      const res = await fetch(`/api/admin/datasheets/${datasheetId}/sources`);
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        setContextInfo({
          lastAggregated: data.datasheet?.contextLastAggregated,
          sourceCount: data.datasheet?.contextSourceCount,
          conflicts: data.datasheet?.contextConflicts ? JSON.parse(data.datasheet.contextConflicts) : null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    } finally {
      setSourcesLoading(false);
    }
  };


  const handleOutdateSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/admin/datasheet-sources/${sourceId}/outdate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: outdateReason }),
      });
      if (res.ok) {
        setOutdatingSourceId(null);
        setOutdateReason('');
        fetchSources();
      }
    } catch (err) {
      alert('Failed to outdate source');
    }
  };

  const handleRestoreSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/admin/datasheet-sources/${sourceId}/outdate`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (err) {
      alert('Failed to restore source');
    }
  };

  const getStatusBadge = (source: DatasheetSourceItem) => {
    if (source.isOutdated) return { color: 'bg-gray-600', text: '🚫 Outdated' };
    if (source.status === 'processed') return { color: 'bg-green-600', text: '✅ Processed' };
    if (source.status === 'pending') return { color: 'bg-yellow-600', text: '⏳ Pending' };
    if (source.status === 'error') return { color: 'bg-red-600', text: '❌ Error' };
    return { color: 'bg-gray-600', text: source.status };
  };

  const getSourceIcon = (type: string) => {
    return sourceTypeOptions.find(o => o.value === type)?.icon || '🌐';
  };

  return (
    <div className="space-y-4">
      {/* Sources Section - Only in Edit Mode */}
      {isEditMode && datasheetId && (
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-black font-bold">📚 Linked Sources ({sources.length})</h3>
            <a
              href={`/admin/factions`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded"
            >
              Add via Faction →
            </a>
          </div>
          
          <p className="text-black text-xs mb-3">
            Sources are added at the faction level and automatically linked to units during AI curation.
          </p>

          {/* Sources List */}
          {sourcesLoading ? (
            <p className="text-black text-sm">Loading sources...</p>
          ) : sources.length === 0 ? (
            <p className="text-black text-sm">No sources linked yet. Add sources above or via Admin → Competitive Context.</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {sources.map(source => (
                <div 
                  key={source.id} 
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    source.isOutdated ? 'bg-gray-800/50 opacity-60' : 'bg-grimlog-black/50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span>{getSourceIcon(source.sourceType)}</span>
                    <a 
                      href={source.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 truncate"
                    >
                      {source.sourceTitle || source.sourceUrl}
                    </a>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusBadge(source).color}`}>
                      {getStatusBadge(source).text}
                    </span>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {source.isOutdated ? (
                      <button
                        onClick={() => handleRestoreSource(source.id)}
                        className="px-2 py-1 text-xs bg-green-600/50 hover:bg-green-600 rounded"
                      >
                        Restore
                      </button>
                    ) : source.status === 'processed' && (
                      <button
                        onClick={() => setOutdatingSourceId(source.id)}
                        className="px-2 py-1 text-xs bg-gray-600/50 hover:bg-gray-600 rounded"
                      >
                        Outdate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Outdate Dialog */}
          {outdatingSourceId && (
            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-500/30 rounded">
              <p className="text-yellow-400 text-sm mb-2">Mark this source as outdated?</p>
              <input
                type="text"
                value={outdateReason}
                onChange={e => setOutdateReason(e.target.value)}
                placeholder="Reason (optional, e.g., 'Pre-January 2025 dataslate')"
                className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white text-sm rounded mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleOutdateSource(outdatingSourceId)}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded"
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setOutdatingSourceId(null); setOutdateReason(''); }}
                  className="px-3 py-1 bg-grimlog-steel/50 hover:bg-grimlog-steel text-white text-sm rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Aggregation Info */}
          {contextInfo.lastAggregated && (
            <div className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded text-xs">
              <p className="text-black">
                ✅ Last synthesized: {new Date(contextInfo.lastAggregated).toLocaleDateString()} 
                {contextInfo.sourceCount && ` from ${contextInfo.sourceCount} source(s)`}
              </p>
            </div>
          )}

          {/* Conflicts Display */}
          {contextInfo.conflicts && contextInfo.conflicts.length > 0 && (
            <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
              <p className="text-yellow-400 text-xs font-bold mb-1">⚡ Source Conflicts:</p>
              {contextInfo.conflicts.map((conflict: any, i: number) => (
                <div key={i} className="text-xs text-grimlog-light-steel">
                  <span className="text-yellow-300">{conflict.field}:</span> {conflict.disagreement}
                  <br />
                  <span className="text-grimlog-steel">→ {conflict.resolution}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-black text-xs mt-2">
            💡 Run <code className="bg-grimlog-black text-white px-1 rounded">python3 scripts/youtube_transcribe.py --fetch-pending</code> to process sources, then <code className="bg-grimlog-black text-white px-1 rounded">--aggregate --datasheet-name &quot;{unitName}&quot;</code> to synthesize.
          </p>
        </div>
      )}

      {/* Scoped Competitive Contexts (editable) */}
      <CompetitiveContextEditor
        contexts={(formData as any).competitiveContexts || []}
        datasheetId={datasheetId}
        onUpdate={onContextsUpdate}
      />
    </div>
  );
}
