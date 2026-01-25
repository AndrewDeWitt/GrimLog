'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FactionIcon from '@/components/FactionIcon';

interface Army {
  id: string;
  name: string;
  faction: { id: string; name: string } | null;
  detachment: string | null;
  pointsLimit: number;
  unitCount: number;
  author: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Filters {
  factions: Array<{ id: string; name: string; count: number }>;
  detachments: Array<{ name: string; count: number }>;
}

export default function ArmyLibraryPage() {
  const [armies, setArmies] = useState<Army[]>([]);
  const [filters, setFilters] = useState<Filters>({ factions: [], detachments: [] });
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [selectedFaction, setSelectedFaction] = useState('');
  const [selectedDetachment, setSelectedDetachment] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');

  useEffect(() => {
    fetchArmies();
  }, [search, selectedFaction, selectedDetachment, sortBy, pagination.offset]);

  const fetchArmies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedFaction) params.append('faction', selectedFaction);
      if (selectedDetachment) params.append('detachment', selectedDetachment);
      params.append('sortBy', sortBy);
      params.append('limit', String(pagination.limit));
      params.append('offset', String(pagination.offset));

      const res = await fetch(`/api/armies/public?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArmies(data.armies);
        setFilters(data.filters);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch armies:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-grimlog-black">
      {/* Header */}
      <div className="border-b border-grimlog-steel bg-grimlog-darkGray">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/armies" className="text-grimlog-orange hover:text-orange-400 text-sm mb-1 block">
                ← Back to Armies
              </Link>
              <h1 className="text-3xl font-bold text-grimlog-orange tracking-wider">ARMY LIBRARY</h1>
              <p className="text-grimlog-light-steel mt-1">
                Browse and import community army lists
              </p>
            </div>
            <Link
              href="/armies/builder"
              className="px-6 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600"
            >
              + CREATE ARMY
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Filters Sidebar */}
          <div className="col-span-3">
            <div className="border border-grimlog-steel bg-grimlog-darkGray p-4 sticky top-4">
              <h2 className="text-lg font-bold text-grimlog-orange mb-4">FILTERS</h2>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  placeholder="Search armies..."
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                />
              </div>

              {/* Faction Filter */}
              <div className="mb-4">
                <label className="block text-sm text-grimlog-light-steel mb-2">Faction</label>
                <select
                  value={selectedFaction}
                  onChange={e => {
                    setSelectedFaction(e.target.value);
                    setPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                >
                  <option value="">All Factions</option>
                  {filters.factions.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.count})</option>
                  ))}
                </select>
              </div>

              {/* Detachment Filter */}
              <div className="mb-4">
                <label className="block text-sm text-grimlog-light-steel mb-2">Detachment</label>
                <select
                  value={selectedDetachment}
                  onChange={e => {
                    setSelectedDetachment(e.target.value);
                    setPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                >
                  <option value="">All Detachments</option>
                  {filters.detachments.map(d => (
                    <option key={d.name} value={d.name}>{d.name} ({d.count})</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm text-grimlog-light-steel mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={e => {
                    setSortBy(e.target.value);
                    setPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                >
                  <option value="createdAt">Recently Added</option>
                  <option value="name">Name</option>
                  <option value="pointsLimit">Points</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {/* Results Header */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-grimlog-light-steel">
                {loading ? 'Loading...' : `${pagination.total} armies found`}
              </p>
            </div>

            {/* Results List */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-grimlog-light-steel">Loading armies...</p>
              </div>
            ) : armies.length === 0 ? (
              <div className="text-center py-12 border border-grimlog-steel bg-grimlog-darkGray">
                <p className="text-grimlog-light-steel">No public armies found</p>
                <Link
                  href="/armies/builder"
                  className="inline-block mt-4 px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold"
                >
                  Create the first one!
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {armies.map(army => (
                    <Link
                      key={army.id}
                      href={`/armies/${army.id}`}
                      className="block border border-grimlog-steel bg-grimlog-darkGray hover:border-grimlog-orange transition-colors"
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold text-grimlog-orange">{army.name}</h3>
                            <div className="text-grimlog-light-steel text-sm flex items-center gap-2">
                              <span className="text-grimlog-amber">
                                <FactionIcon factionName={army.faction?.name || 'Unknown'} className="w-4 h-4" />
                              </span>
                              <span>
                                {army.faction?.name || 'Unknown Faction'}
                                {army.detachment && ` • ${army.detachment}`}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-grimlog-green font-mono">
                              {army.pointsLimit}
                            </div>
                            <div className="text-grimlog-light-steel text-xs">points</div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-grimlog-steel">
                          <div className="flex gap-4 text-sm">
                            <span className="text-grimlog-light-steel">
                              <span className="text-white font-mono">{army.unitCount}</span> units
                            </span>
                          </div>
                          <div className="text-xs text-grimlog-light-steel">
                            {army.author && <span>by {army.author.name} • </span>}
                            {formatDate(army.createdAt)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                      disabled={pagination.offset === 0}
                      className="px-4 py-2 bg-grimlog-gray text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-grimlog-light-steel">
                      Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.total / pagination.limit)}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                      disabled={!pagination.hasMore}
                      className="px-4 py-2 bg-grimlog-gray text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
