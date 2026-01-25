'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DatasheetCard from '@/components/DatasheetCard';

interface Datasheet {
  id: string;
  name: string;
  faction: string;
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
  isOfficial: boolean;
  author: { id: string; name: string } | null;
  forkedFrom: { id: string; name: string } | null;
  currentVersion: number;
  createdAt: string;
  forkCount: number;
}

interface Filters {
  factions: Array<{ name: string; count: number }>;
  roles: Array<{ name: string; count: number }>;
}

export default function DatasheetLibraryPage() {
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [filters, setFilters] = useState<Filters>({ factions: [], roles: [] });
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [selectedFaction, setSelectedFaction] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'official' | 'community'>('all');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    fetchDatasheets();
  }, [search, selectedFaction, selectedRole, selectedType, sortBy, pagination.offset]);

  const fetchDatasheets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedFaction) params.append('faction', selectedFaction);
      if (selectedRole) params.append('role', selectedRole);
      if (selectedType !== 'all') params.append('type', selectedType);
      params.append('sortBy', sortBy);
      params.append('limit', String(pagination.limit));
      params.append('offset', String(pagination.offset));

      const res = await fetch(`/api/datasheets/public?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDatasheets(data.datasheets);
        setFilters(data.filters);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch datasheets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  return (
    <div className="min-h-screen bg-grimlog-black">
      {/* Header */}
      <div className="border-b border-grimlog-steel bg-grimlog-darkGray">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/datasheets" className="text-grimlog-orange hover:text-orange-400 text-sm mb-1 block">
                ← Back to Datasheets
              </Link>
              <h1 className="text-3xl font-bold text-grimlog-orange tracking-wider">PUBLIC LIBRARY</h1>
              <p className="text-grimlog-light-steel mt-1">
                Browse and import community-created datasheets
              </p>
            </div>
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
              <form onSubmit={handleSearch} className="mb-4">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search datasheets..."
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                />
              </form>

              {/* Type Filter */}
              <div className="mb-4">
                <label className="block text-sm text-grimlog-light-steel mb-2">Type</label>
                <select
                  value={selectedType}
                  onChange={e => {
                    setSelectedType(e.target.value as any);
                    setPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                >
                  <option value="all">All Datasheets</option>
                  <option value="official">Official Only</option>
                  <option value="community">Community Only</option>
                </select>
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
                    <option key={f.name} value={f.name}>{f.name} ({f.count})</option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div className="mb-4">
                <label className="block text-sm text-grimlog-light-steel mb-2">Role</label>
                <select
                  value={selectedRole}
                  onChange={e => {
                    setSelectedRole(e.target.value);
                    setPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  className="w-full px-3 py-2 bg-grimlog-black border border-grimlog-steel text-white"
                >
                  <option value="">All Roles</option>
                  {filters.roles.map(r => (
                    <option key={r.name} value={r.name}>{r.name} ({r.count})</option>
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
                  <option value="name">Name</option>
                  <option value="pointsCost">Points Cost</option>
                  <option value="createdAt">Recently Added</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {/* Results Header */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-grimlog-light-steel">
                {loading ? 'Loading...' : `${pagination.total} datasheets found`}
              </p>
            </div>

            {/* Results Grid */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-grimlog-light-steel">Loading datasheets...</p>
              </div>
            ) : datasheets.length === 0 ? (
              <div className="text-center py-12 border border-grimlog-steel bg-grimlog-darkGray">
                <p className="text-grimlog-light-steel">No datasheets found matching your filters</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {datasheets.map(ds => (
                    <div key={ds.id} className="relative">
                      <DatasheetCard
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
                      />
                      {/* Badge */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {ds.isOfficial ? (
                          <span className="px-2 py-0.5 bg-grimlog-green text-grimlog-black text-xs font-bold">
                            OFFICIAL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold">
                            COMMUNITY
                          </span>
                        )}
                      </div>
                      {/* Author */}
                      {ds.author && !ds.isOfficial && (
                        <div className="absolute bottom-2 right-2 text-xs text-grimlog-light-steel">
                          by {ds.author.name}
                        </div>
                      )}
                    </div>
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
