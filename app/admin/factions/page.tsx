'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface FactionCounts {
  datasheets: number;
  disabledDatasheets: number;
  stratagems: number;
  enhancements: number;
  detachments: number;
}

interface Faction {
  id: string;
  name: string;
  metaData: Record<string, unknown> | null;
  counts: FactionCounts;
  createdAt: string;
  updatedAt: string;
}

interface Detachment {
  id: string;
  name: string;
  faction: string;
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

// Available factions for import
const AVAILABLE_FACTIONS = [
  'tyranids', 'space-marines', 'space-wolves', 'blood-angels', 'dark-angels',
  'astra-militarum', 'orks', 'necrons', 'aeldari', 'chaos-space-marines',
  'tau-empire', 'adeptus-custodes', 'grey-knights', 'adepta-sororitas'
];

export default function FactionsAdminPage() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFactions, setExpandedFactions] = useState<Set<string>>(new Set());
  const [expandedDetachments, setExpandedDetachments] = useState<Set<string>>(new Set());
  const [factionDetails, setFactionDetails] = useState<Record<string, {
    detachments: Detachment[];
    stratagems: Stratagem[];
    loading: boolean;
  }>>({});
  const [search, setSearch] = useState('');
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'wahapedia' | 'json'>('wahapedia');
  const [selectedFaction, setSelectedFaction] = useState('tyranids');
  const [importUpdate, setImportUpdate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; stats?: Record<string, unknown> } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFactions();
  }, []);

  const fetchFactions = async () => {
    try {
      const res = await fetch('/api/admin/factions');
      if (!res.ok) throw new Error('Failed to fetch factions');
      const data = await res.json();
      setFactions(data.factions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load factions');
    } finally {
      setLoading(false);
    }
  };

  const fetchFactionDetails = async (factionId: string) => {
    if (factionDetails[factionId]?.detachments) return;
    
    setFactionDetails(prev => ({
      ...prev,
      [factionId]: { detachments: [], stratagems: [], loading: true }
    }));

    try {
      const res = await fetch(`/api/admin/factions/${factionId}`);
      if (!res.ok) throw new Error('Failed to fetch faction details');
      const data = await res.json();
      
      setFactionDetails(prev => ({
        ...prev,
        [factionId]: {
          detachments: data.detachments || [],
          stratagems: data.stratagemData || [],
          loading: false
        }
      }));
    } catch (err) {
      console.error('Failed to load faction details:', err);
      setFactionDetails(prev => ({
        ...prev,
        [factionId]: { detachments: [], stratagems: [], loading: false }
      }));
    }
  };

  const toggleFaction = (factionId: string) => {
    const newExpanded = new Set(expandedFactions);
    if (newExpanded.has(factionId)) {
      newExpanded.delete(factionId);
    } else {
      newExpanded.add(factionId);
      fetchFactionDetails(factionId);
    }
    setExpandedFactions(newExpanded);
  };

  const toggleDetachment = (detachmentId: string) => {
    const newExpanded = new Set(expandedDetachments);
    if (newExpanded.has(detachmentId)) {
      newExpanded.delete(detachmentId);
    } else {
      newExpanded.add(detachmentId);
    }
    setExpandedDetachments(newExpanded);
  };

  const handleImportFromWahapedia = async () => {
    setImporting(true);
    setImportResult(null);
    
    try {
      const res = await fetch('/api/admin/import/wahapedia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factionKey: selectedFaction,
          update: importUpdate,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setImportResult({
          success: true,
          message: data.message || 'Import completed successfully',
          stats: data.stats,
        });
        // Refresh factions list
        fetchFactions();
      } else {
        setImportResult({
          success: false,
          message: data.error || 'Import failed',
        });
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFromJSON = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      
      const res = await fetch('/api/admin/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          update: importUpdate,
        }),
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setImportResult({
          success: true,
          message: result.message || 'Import completed successfully',
          stats: result.stats,
        });
        fetchFactions();
      } else {
        setImportResult({
          success: false,
          message: result.error || result.errors?.join(', ') || 'Import failed',
        });
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to parse JSON file',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExportFaction = async (factionId: string, factionName: string) => {
    try {
      const res = await fetch(`/api/admin/export/${factionId}?download=true`);
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${factionName.toLowerCase().replace(/\s+/g, '-')}-export.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export faction data');
    }
  };

  const filteredFactions = factions.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

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

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Factions & Detachments</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage factions, detachments, and stratagems
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Data
          </button>
          <Link
            href="/api/admin/bulk/export"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export All
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search factions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{factions.length}</div>
          <div className="text-sm text-slate-400">Factions</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">
            {factions.reduce((sum, f) => sum + f.counts.detachments, 0)}
          </div>
          <div className="text-sm text-slate-400">Detachments</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">
            {factions.reduce((sum, f) => sum + f.counts.stratagems, 0)}
          </div>
          <div className="text-sm text-slate-400">Stratagems</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">
            {factions.reduce((sum, f) => sum + f.counts.datasheets, 0)}
          </div>
          <div className="text-sm text-slate-400">Datasheets</div>
        </div>
      </div>

      {/* Factions List */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg">
        {filteredFactions.map((faction) => (
          <FactionRow
            key={faction.id}
            faction={faction}
            isExpanded={expandedFactions.has(faction.id)}
            onToggle={() => toggleFaction(faction.id)}
            onExport={() => handleExportFaction(faction.id, faction.name)}
            details={factionDetails[faction.id]}
            expandedDetachments={expandedDetachments}
            onToggleDetachment={toggleDetachment}
          />
        ))}
        
        {filteredFactions.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No factions found
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Import Faction Data</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Import Type Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setImportType('wahapedia')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  importType === 'wahapedia'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                From Wahapedia
              </button>
              <button
                onClick={() => setImportType('json')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  importType === 'json'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                From JSON File
              </button>
            </div>

            {importType === 'wahapedia' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Select Faction</label>
                  <select
                    value={selectedFaction}
                    onChange={(e) => setSelectedFaction(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    {AVAILABLE_FACTIONS.map(f => (
                      <option key={f} value={f}>
                        {f.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateExisting"
                    checked={importUpdate}
                    onChange={(e) => setImportUpdate(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="updateExisting" className="text-sm text-slate-300">
                    Update existing records (otherwise skip)
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  Note: This creates a basic faction shell. For full data import from Wahapedia,
                  use the CLI: <code className="bg-slate-800 px-1 rounded">npx tsx scripts/importFromWahapedia.ts {selectedFaction}</code>
                </p>

                <button
                  onClick={handleImportFromWahapedia}
                  disabled={importing}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {importing ? 'Importing...' : 'Import Faction'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Upload JSON File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFromJSON(file);
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="w-full py-8 border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    {importing ? (
                      'Importing...'
                    ) : (
                      <>
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Click to upload or drag and drop
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateExistingJson"
                    checked={importUpdate}
                    onChange={(e) => setImportUpdate(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="updateExistingJson" className="text-sm text-slate-300">
                    Update existing records (otherwise skip)
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  JSON file should match the import schema. See{' '}
                  <code className="bg-slate-800 px-1 rounded">data/templates/faction-template.json</code>
                  {' '}for an example.
                </p>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                importResult.success
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                <div className="font-medium mb-1">
                  {importResult.success ? '✓ Success' : '✗ Error'}
                </div>
                <div className="text-sm">{importResult.message}</div>
                {importResult.stats && (
                  <div className="mt-2 text-xs space-y-1">
                    <div>Detachments: {(importResult.stats.detachments as Record<string, number>)?.created || 0} created, {(importResult.stats.detachments as Record<string, number>)?.skipped || 0} skipped</div>
                    <div>Stratagems: {(importResult.stats.stratagems as Record<string, number>)?.created || 0} created, {(importResult.stats.stratagems as Record<string, number>)?.skipped || 0} skipped</div>
                    <div>Enhancements: {(importResult.stats.enhancements as Record<string, number>)?.created || 0} created, {(importResult.stats.enhancements as Record<string, number>)?.skipped || 0} skipped</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface FactionRowProps {
  faction: Faction;
  isExpanded: boolean;
  onToggle: () => void;
  onExport: () => void;
  details?: {
    detachments: Detachment[];
    stratagems: Stratagem[];
    loading: boolean;
  };
  expandedDetachments: Set<string>;
  onToggleDetachment: (id: string) => void;
}

function FactionRow({
  faction,
  isExpanded,
  onToggle,
  onExport,
  details,
  expandedDetachments,
  onToggleDetachment
}: FactionRowProps) {
  return (
    <div className="border-b border-slate-800 last:border-b-0">
      {/* Faction Header */}
      <div
        className="flex items-center gap-4 p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <button className="text-slate-500 hover:text-white transition-colors w-6">
          {isExpanded ? '▼' : '▶'}
        </button>
        
        <div className="flex-1">
          <span className="font-bold text-white">{faction.name}</span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-amber-500 font-bold">{faction.counts.detachments}</div>
            <div className="text-slate-500 text-xs">Detachments</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 font-bold">{faction.counts.stratagems}</div>
            <div className="text-slate-500 text-xs">Stratagems</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-bold">
              {faction.counts.datasheets}
              {faction.counts.disabledDatasheets > 0 && (
                <span className="text-red-400 text-xs ml-1">
                  ({faction.counts.disabledDatasheets} disabled)
                </span>
              )}
            </div>
            <div className="text-slate-500 text-xs">Datasheets</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExport();
            }}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
            title="Export as JSON"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <Link
            href={`/admin/factions/${faction.id}`}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="bg-slate-950/50 border-t border-slate-800">
          {details?.loading ? (
            <div className="p-4 text-slate-500 text-center">Loading...</div>
          ) : details?.detachments.length === 0 ? (
            <div className="p-4 text-slate-500 text-center">
              No detachments found. Stratagems may be using string-based detachment names.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {details?.detachments.map((det) => (
                <DetachmentRow
                  key={det.id}
                  detachment={det}
                  stratagems={details.stratagems.filter(s => s.detachment === det.name)}
                  isExpanded={expandedDetachments.has(det.id)}
                  onToggle={() => onToggleDetachment(det.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DetachmentRowProps {
  detachment: Detachment;
  stratagems: Stratagem[];
  isExpanded: boolean;
  onToggle: () => void;
}

function DetachmentRow({ detachment, stratagems, isExpanded, onToggle }: DetachmentRowProps) {
  return (
    <div>
      {/* Detachment Header */}
      <div
        className="flex items-center gap-4 p-3 pl-12 hover:bg-slate-800/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <button className="text-slate-600 hover:text-white transition-colors w-4 text-xs">
          {isExpanded ? '▼' : '▶'}
        </button>
        
        <div className="flex-1">
          <span className="text-amber-400">{detachment.name}</span>
          {detachment.subfaction && (
            <span className="text-xs text-slate-500 ml-2">({detachment.subfaction})</span>
          )}
          {detachment.abilityName && (
            <span className="text-xs text-slate-600 ml-2">• {detachment.abilityName}</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-blue-400">{detachment._count.stratagems} stratagems</span>
          <span className="text-purple-400">{detachment._count.enhancements} enhancements</span>
        </div>

        <Link
          href={`/admin/detachments/${detachment.id}`}
          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </Link>
      </div>

      {/* Stratagems List */}
      {isExpanded && stratagems.length > 0 && (
        <div className="pl-20 pr-4 pb-3 grid grid-cols-2 gap-2">
          {stratagems.map((strat) => (
            <Link
              key={strat.id}
              href={`/admin/stratagems/${strat.id}`}
              className="flex items-center gap-2 p-2 bg-slate-800/50 rounded hover:bg-slate-800 transition-colors"
            >
              <span className="w-6 h-6 flex items-center justify-center bg-blue-600 rounded text-xs font-bold text-white">
                {strat.cpCost}
              </span>
              <span className="text-sm text-slate-300 truncate flex-1">{strat.name}</span>
              <span className="text-xs text-slate-500">{strat.type}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
