'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface DatasheetOption {
  id: string;
  name: string;
  faction: string;
  subfaction: string | null;
  role: string;
}

interface FactionOption {
  id: string;
  name: string;
}

interface DatasheetSource {
  id: string;
  datasheetId: string;
  sourceType: string;
  sourceUrl: string;
  sourceTitle: string | null;
  channelName: string | null;
  status: string;
  transcript: string | null;
  extractedContext: string | null;
  confidence: number | null;
  errorMessage: string | null;
  createdAt: string;
  fetchedAt: string | null;
  processedAt: string | null;
  datasheet: {
  id: string;
    name: string;
  faction: string;
    subfaction: string | null;
  };
}

interface StatusCounts {
  pending?: number;
  fetched?: number;
  processed?: number;
  error?: number;
}

export default function CompetitiveContextPage() {
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Data
  const [sources, setSources] = useState<DatasheetSource[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add new source form
  const [showAddForm, setShowAddForm] = useState(false);
  const [datasheets, setDatasheets] = useState<DatasheetOption[]>([]);
  const [factions, setFactions] = useState<FactionOption[]>([]);
  const [selectedDatasheetId, setSelectedDatasheetId] = useState<string>('');
  const [newSourceUrl, setNewSourceUrl] = useState<string>('');
  const [newSourceType, setNewSourceType] = useState<string>('youtube');
  const [adding, setAdding] = useState(false);
  
  // Source type options with labels and placeholders
  const sourceTypeOptions = [
    { value: 'youtube', label: 'YouTube Video', placeholder: 'https://www.youtube.com/watch?v=...', icon: '📺' },
    { value: 'reddit', label: 'Reddit Post', placeholder: 'https://www.reddit.com/r/WarhammerCompetitive/...', icon: '🔴' },
    { value: 'article', label: 'Article/Blog', placeholder: 'https://www.goonhammer.com/...', icon: '📄' },
    { value: 'forum', label: 'Forum Thread', placeholder: 'https://www.dakkadakka.com/...', icon: '💬' },
    { value: 'discord', label: 'Discord (Manual)', placeholder: 'Paste content manually in the app', icon: '🎮' },
    { value: 'other', label: 'Other Webpage', placeholder: 'https://...', icon: '🌐' },
  ];
  
  // Datasheet picker filters
  const [datasheetSearch, setDatasheetSearch] = useState<string>('');
  const [factionFilter, setFactionFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  
  // View transcript modal
  const [viewingSource, setViewingSource] = useState<DatasheetSource | null>(null);
  
  // Fetch sources
  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      
      const res = await fetch(`/api/admin/datasheet-sources?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sources');
      
      const data = await res.json();
      setSources(data.sources);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Fetch datasheets and factions for picker
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch datasheets
        const dsRes = await fetch('/api/admin/datasheets?limit=2000');
        if (dsRes.ok) {
          const data = await dsRes.json();
          setDatasheets(data.datasheets.map((d: any) => ({
            id: d.id,
            name: d.name,
            faction: d.faction,
            subfaction: d.subfaction,
            role: d.role || 'Unknown',
          })));
        }
        
        // Fetch factions
        const fRes = await fetch('/api/admin/factions');
        if (fRes.ok) {
          const data = await fRes.json();
          setFactions(data.factions.map((f: any) => ({
            id: f.id,
            name: f.name,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchData();
  }, []);
  
  // Filter datasheets based on search, faction, and role
  const filteredDatasheets = useMemo(() => {
    return datasheets.filter(d => {
      // Search filter
      if (datasheetSearch) {
        const search = datasheetSearch.toLowerCase();
        const matchesSearch = 
          d.name.toLowerCase().includes(search) ||
          d.faction.toLowerCase().includes(search) ||
          (d.subfaction?.toLowerCase().includes(search) ?? false);
        if (!matchesSearch) return false;
      }
      
      // Faction filter
      if (factionFilter && d.faction !== factionFilter) {
        return false;
      }
      
      // Role filter
      if (roleFilter && d.role !== roleFilter) {
        return false;
      }
      
      return true;
    }).slice(0, 100); // Limit to 100 results for performance
  }, [datasheets, datasheetSearch, factionFilter, roleFilter]);
  
  // Get unique factions from datasheets
  const uniqueFactions = useMemo(() => {
    const factionSet = new Set(datasheets.map(d => d.faction));
    return Array.from(factionSet).sort();
  }, [datasheets]);
  
  // Get unique roles from datasheets
  const uniqueRoles = useMemo(() => {
    const roleSet = new Set(datasheets.map(d => d.role));
    return Array.from(roleSet).sort();
  }, [datasheets]);
  
  // Get selected datasheet info
  const selectedDatasheet = useMemo(() => {
    return datasheets.find(d => d.id === selectedDatasheetId);
  }, [datasheets, selectedDatasheetId]);
  
  // Add new source
  const handleAddSource = async () => {
    if (!selectedDatasheetId || !newSourceUrl) return;
    
    // Discord requires manual paste
    if (newSourceType === 'discord') {
      alert('Discord content cannot be scraped automatically. Please use the "Paste Text" feature in the app instead.');
      return;
    }
    
    setAdding(true);
    try {
      const res = await fetch('/api/admin/datasheet-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          datasheetId: selectedDatasheetId,
          sourceUrl: newSourceUrl,
          sourceType: newSourceType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add source');
      }

      // Reset form and refresh
      setSelectedDatasheetId('');
      setNewSourceUrl('');
      setNewSourceType('youtube');
      setDatasheetSearch('');
      setFactionFilter('');
      setRoleFilter('');
      setShowAddForm(false);
      await fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setAdding(false);
    }
  };
  
  // Delete source
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;
    
    try {
      const res = await fetch(`/api/admin/datasheet-sources/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      await fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'fetched': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'processed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };
  
  // Filter sources by search
  const filteredSources = sources.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.datasheet.name.toLowerCase().includes(query) ||
      s.datasheet.faction.toLowerCase().includes(query) ||
      s.sourceTitle?.toLowerCase().includes(query) ||
      s.channelName?.toLowerCase().includes(query) ||
      s.sourceUrl.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitive Context Sources</h1>
          <p className="text-slate-400 text-sm mt-1">
            Attach content sources (YouTube, Reddit, articles, forums) to datasheets for AI context extraction
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Source
        </button>
      </div>
      
      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            statusFilter === 'pending' 
              ? 'bg-yellow-500/20 border-yellow-500' 
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-2xl font-bold text-yellow-400">{counts.pending || 0}</div>
          <div className="text-sm text-slate-400">Pending</div>
        </div>
        <div 
          onClick={() => setStatusFilter('fetched')}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            statusFilter === 'fetched' 
              ? 'bg-blue-500/20 border-blue-500' 
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-2xl font-bold text-blue-400">{counts.fetched || 0}</div>
          <div className="text-sm text-slate-400">Fetched</div>
        </div>
        <div 
          onClick={() => setStatusFilter('processed')}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            statusFilter === 'processed' 
              ? 'bg-green-500/20 border-green-500' 
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-2xl font-bold text-green-400">{counts.processed || 0}</div>
          <div className="text-sm text-slate-400">Processed</div>
        </div>
        <div 
          onClick={() => setStatusFilter('error')}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            statusFilter === 'error' 
              ? 'bg-red-500/20 border-red-500' 
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-2xl font-bold text-red-400">{counts.error || 0}</div>
          <div className="text-sm text-slate-400">Error</div>
        </div>
      </div>

      {/* Clear Filter */}
      {statusFilter && (
        <div className="mb-4">
          <button
            onClick={() => setStatusFilter('')}
            className="text-sm text-amber-500 hover:text-amber-400"
          >
            ← Show all sources
          </button>
        </div>
      )}

      {/* Add Source Form */}
      {showAddForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Add New Source</h3>
          
          {/* Selected Datasheet Display */}
          {selectedDatasheet && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-medium text-amber-400">{selectedDatasheet.name}</span>
                <span className="text-slate-400 ml-2">({selectedDatasheet.faction})</span>
                {selectedDatasheet.subfaction && (
                  <span className="text-slate-500 ml-1">• {selectedDatasheet.subfaction}</span>
                )}
              </div>
              <button
                onClick={() => setSelectedDatasheetId('')}
                className="text-slate-400 hover:text-white text-sm"
              >
                Change
              </button>
            </div>
          )}
          
          {/* Datasheet Picker */}
          {!selectedDatasheet && (
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Select Datasheet</label>
              
              {/* Filter Row */}
              <div className="flex flex-wrap gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search datasheets..."
                  value={datasheetSearch}
                  onChange={(e) => setDatasheetSearch(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                />
                <select
                  value={factionFilter}
                  onChange={(e) => setFactionFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">All Factions</option>
                  {uniqueFactions.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">All Roles</option>
                  {uniqueRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              
              {/* Results */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-64 overflow-y-auto">
                {filteredDatasheets.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    {datasheetSearch || factionFilter || roleFilter 
                      ? 'No datasheets match your filters' 
                      : 'Loading datasheets...'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredDatasheets.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDatasheetId(d.id)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <span className="font-medium text-white group-hover:text-amber-400 transition-colors">
                            {d.name}
                          </span>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {d.faction}
                            {d.subfaction && ` • ${d.subfaction}`}
                            {d.role && ` • ${d.role}`}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {filteredDatasheets.length >= 100 && (
                <p className="text-xs text-slate-500 mt-2">
                  Showing first 100 results. Use filters to narrow down.
                </p>
              )}
            </div>
          )}

          {/* Source Type Selector */}
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">Source Type</label>
            <div className="grid grid-cols-3 gap-2">
              {sourceTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setNewSourceType(option.value)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    newSourceType === option.value
                      ? 'bg-amber-600 text-white border border-amber-500'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* URL Input */}
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">
              {newSourceType === 'discord' ? 'Note' : 'Source URL'}
            </label>
            {newSourceType === 'discord' ? (
              <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-sm">
                <p className="flex items-center gap-2">
                  <span className="text-amber-400">⚠️</span>
                  Discord content cannot be scraped automatically.
                </p>
                <p className="mt-2">
                  Please copy the Discord content and use the &quot;Paste Text&quot; feature in the app.
                </p>
              </div>
            ) : (
              <input
                type="text"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder={sourceTypeOptions.find(o => o.value === newSourceType)?.placeholder}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedDatasheetId('');
                setNewSourceUrl('');
                setNewSourceType('youtube');
                setDatasheetSearch('');
                setFactionFilter('');
                setRoleFilter('');
              }}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSource}
              disabled={!selectedDatasheetId || (!newSourceUrl && newSourceType !== 'discord') || adding || newSourceType === 'discord'}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </div>
      )}
      
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by datasheet name, faction, video title, or channel..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
      </div>

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
          <span className="text-slate-400">Loading sources...</span>
        </div>
      )}
      
        {/* Sources List */}
      {!loading && !error && (
        <div className="space-y-4">
          {filteredSources.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500">
              No sources found. Add a YouTube video to get started.
              </div>
            ) : (
            filteredSources.map((source) => (
                  <div
                    key={source.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Datasheet Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-white">{source.datasheet.name}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 text-sm">{source.datasheet.faction}</span>
                      {source.datasheet.subfaction && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-500 text-sm">{source.datasheet.subfaction}</span>
                        </>
                      )}
                    </div>
                    
                    {/* Source Info */}
                    <div className="flex items-center gap-2 text-sm">
                      {/* Source type icon */}
                      <span className="text-base">
                        {source.sourceType === 'youtube' && '📺'}
                        {source.sourceType === 'reddit' && '🔴'}
                        {source.sourceType === 'article' && '📄'}
                        {source.sourceType === 'forum' && '💬'}
                        {source.sourceType === 'discord' && '🎮'}
                        {(!source.sourceType || source.sourceType === 'other') && '🌐'}
                      </span>
                      {source.sourceTitle ? (
                        <a 
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-500 hover:text-amber-400 truncate"
                        >
                          {source.sourceTitle}
                        </a>
                      ) : (
                        <a 
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-500 hover:text-amber-400 truncate"
                        >
                          {source.sourceUrl}
                        </a>
                      )}
                      {source.channelName && (
                        <span className="text-slate-500">by {source.channelName}</span>
                      )}
                      {/* Source type badge */}
                      <span className="px-1.5 py-0.5 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {source.sourceType || 'youtube'}
                      </span>
                    </div>

                    {/* Error Message */}
                    {source.errorMessage && (
                      <div className="mt-2 text-sm text-red-400">
                        Error: {source.errorMessage}
                          </div>
                        )}

                    {/* Context Preview */}
                    {source.extractedContext && (
                      <div className="mt-2">
                    <button
                          onClick={() => setViewingSource(source)}
                          className="text-sm text-blue-400 hover:text-blue-300"
                    >
                          View extracted context (confidence: {source.confidence}%)
                    </button>
                  </div>
                )}
              </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(source.status)}`}>
                      {source.status}
      </span>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {source.transcript && (
      <button
                          onClick={() => setViewingSource(source)}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-white rounded transition-colors"
                      >
                        Delete
      </button>
              </div>
            </div>
                </div>
            </div>
            ))
          )}
        </div>
      )}
      
      {/* Script Instructions */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📝 Offline Processing</h3>
        <p className="text-slate-400 text-sm mb-4">
          To fetch content and extract context for pending sources, run:
        </p>
        <pre className="bg-slate-800 rounded-lg p-4 text-sm text-amber-400 overflow-x-auto">
          python3 scripts/youtube_transcribe.py --fetch-pending
        </pre>
        <p className="text-slate-500 text-xs mt-4">
          This will process all pending sources (YouTube, Reddit, articles, forums), fetch/scrape content, 
          extract competitive context using AI, and update the database.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-500">
          <div>
            <span className="text-slate-400 font-medium">Supported sources:</span>
            <ul className="mt-1 space-y-0.5">
              <li>📺 YouTube (captions/Whisper)</li>
              <li>🔴 Reddit (post + comments)</li>
              <li>📄 Articles (Goonhammer, etc.)</li>
            </ul>
          </div>
          <div>
            <ul className="mt-1 space-y-0.5">
              <li>💬 Forums (DakkaDakka, etc.)</li>
              <li>🌐 Generic webpages</li>
              <li>🎮 Discord (manual paste only)</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* View Modal */}
      {viewingSource && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold text-white">{viewingSource.datasheet.name}</h3>
                <p className="text-sm text-slate-400">{viewingSource.sourceTitle || viewingSource.sourceUrl}</p>
            </div>
              <button
                onClick={() => setViewingSource(null)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {viewingSource.extractedContext ? (
            <div>
                  <h4 className="text-sm font-medium text-amber-400 mb-2">Extracted Context</h4>
                  <pre className="bg-slate-800 rounded p-4 text-sm text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(viewingSource.extractedContext), null, 2)}
                  </pre>
                </div>
              ) : viewingSource.transcript ? (
            <div>
                  <h4 className="text-sm font-medium text-amber-400 mb-2">Transcript</h4>
                  <div className="bg-slate-800 rounded p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {viewingSource.transcript.slice(0, 5000)}
                    {viewingSource.transcript.length > 5000 && (
                      <span className="text-slate-500">... (truncated)</span>
                    )}
              </div>
            </div>
              ) : (
                <p className="text-slate-500">No transcript or context available yet.</p>
              )}
            </div>
            </div>
        </div>
      )}
    </div>
  );
}
