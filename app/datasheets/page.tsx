'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import MechanicusFrame from '@/components/MechanicusFrame';
import DatasheetCard from '@/components/DatasheetCard';
import FactionIcon from '@/components/FactionIcon';
import DatasheetEditorModal from '@/components/DatasheetEditorModal';
import ShareModal from '@/components/ShareModal';
import { CreateDatasheetInput } from '@/lib/datasheetValidation';
import { createClient } from '@/lib/supabase/client';

interface Faction {
  id: string;
  name: string;
  datasheetCount: number;
  stratagemCount: number;
  parentFaction: { id: string; name: string } | null;
}

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
  iconUrl: string | null;
  // New fields
  isOfficial?: boolean;
  ownerId?: string | null;
  currentVersion?: number;
  forkedFromId?: string | null;
}

interface RoleCount {
  role: string;
  count: number;
}

type SourceFilter = 'all' | 'official' | 'mine';

export default function DatasheetsPage() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [myDatasheets, setMyDatasheets] = useState<Datasheet[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleCount[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFactions, setLoadingFactions] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [includeParent, setIncludeParent] = useState(true);
  
  // New state for custom datasheets
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDatasheet, setEditingDatasheet] = useState<Datasheet | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingDatasheet, setSharingDatasheet] = useState<Datasheet | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch factions and check auth on mount
  useEffect(() => {
    fetchFactions();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      if (user) {
        fetchMyDatasheets();
      }
    } catch (err) {
      console.error('Failed to check auth:', err);
    }
  };

  const fetchMyDatasheets = async () => {
    try {
      const res = await fetch('/api/datasheets/mine');
      if (res.ok) {
        const data = await res.json();
        setMyDatasheets(data.datasheets || []);
      }
    } catch (err) {
      console.error('Failed to fetch my datasheets:', err);
    }
  };

  // Fetch datasheets when faction changes
  useEffect(() => {
    if (selectedFaction) {
      fetchDatasheets();
    }
  }, [selectedFaction, includeParent]);

  const fetchFactions = async () => {
    try {
      const response = await fetch('/api/factions');
      if (response.ok) {
        const data = await response.json();
        setFactions(data);
      }
    } catch (err) {
      console.error('Failed to fetch factions:', err);
    } finally {
      setLoadingFactions(false);
    }
  };

  const fetchDatasheets = async () => {
    if (!selectedFaction) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        factionId: selectedFaction.id,
        includeParent: includeParent.toString(),
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

  // Filter datasheets by search, role, and source
  const filteredDatasheets = useMemo(() => {
    // Start with appropriate source
    let baseDatasheets = datasheets;
    
    if (sourceFilter === 'mine') {
      // Filter my datasheets by faction if one is selected
      baseDatasheets = selectedFaction 
        ? myDatasheets.filter(ds => ds.factionId === selectedFaction.id || ds.faction === selectedFaction.name)
        : myDatasheets;
    } else if (sourceFilter === 'official') {
      baseDatasheets = datasheets.filter(ds => ds.isOfficial !== false);
    } else {
      // 'all' - combine official datasheets with user's custom ones for this faction
      const myForFaction = selectedFaction 
        ? myDatasheets.filter(ds => ds.factionId === selectedFaction.id || ds.faction === selectedFaction.name)
        : [];
      baseDatasheets = [...datasheets, ...myForFaction.filter(my => !datasheets.some(d => d.id === my.id))];
    }
    
    let filtered = baseDatasheets;
    
    // Filter by role
    if (selectedRole) {
      filtered = filtered.filter(ds => ds.role.toLowerCase() === selectedRole.toLowerCase());
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ds => 
        ds.name.toLowerCase().includes(query) ||
        ds.keywords.some(kw => kw.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [datasheets, myDatasheets, selectedRole, searchQuery, sourceFilter, selectedFaction]);

  // Group datasheets by role for display
  const groupedDatasheets = useMemo(() => {
    const groups: Record<string, Datasheet[]> = {};
    
    filteredDatasheets.forEach(ds => {
      if (!groups[ds.role]) {
        groups[ds.role] = [];
      }
      groups[ds.role].push(ds);
    });
    
    // Sort roles in preferred order
    const roleOrder = ['Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Elites', 'Fast Attack', 'Heavy Support', 'Fortification'];
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

  const selectFaction = (faction: Faction) => {
    setSelectedFaction(faction);
    setIsDropdownOpen(false);
    setSelectedRole('');
    setSearchQuery('');
  };

  // Action handlers
  const handleCreateDatasheet = () => {
    setEditingDatasheet(null);
    setIsEditorOpen(true);
  };

  const handleEditDatasheet = (ds: Datasheet) => {
    setEditingDatasheet(ds);
    setIsEditorOpen(true);
    setActionMenuOpen(null);
  };

  const handleForkDatasheet = async (ds: Datasheet) => {
    setActionMenuOpen(null);
    
    if (!isAuthenticated) {
      alert('Please sign in to fork datasheets');
      return;
    }
    
    try {
      const res = await fetch(`/api/datasheets/detail/${ds.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'private' }),
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Created "${data.datasheet.name}" as your custom copy!`);
        fetchMyDatasheets();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to fork datasheet');
      }
    } catch (err) {
      console.error('Failed to fork:', err);
      alert('Failed to fork datasheet');
    }
  };

  const handleShareDatasheet = (ds: Datasheet) => {
    setSharingDatasheet(ds);
    setIsShareModalOpen(true);
    setActionMenuOpen(null);
  };

  const handleDeleteDatasheet = async (ds: Datasheet) => {
    if (!confirm(`Are you sure you want to delete "${ds.name}"? This cannot be undone.`)) {
      return;
    }
    setActionMenuOpen(null);
    
    try {
      const res = await fetch(`/api/datasheets/detail/${ds.id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchMyDatasheets();
        if (selectedFaction) {
          fetchDatasheets();
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete datasheet');
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete datasheet');
    }
  };

  const handleSaveDatasheet = async (data: CreateDatasheetInput) => {
    const endpoint = editingDatasheet 
      ? `/api/datasheets/detail/${editingDatasheet.id}`
      : '/api/datasheets';
    const method = editingDatasheet ? 'PUT' : 'POST';
    
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save datasheet');
    }

    // Refresh data
    fetchMyDatasheets();
    if (selectedFaction) {
      fetchDatasheets();
    }
  };

  const toggleActionMenu = (id: string) => {
    setActionMenuOpen(actionMenuOpen === id ? null : id);
  };

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

  return (
    <>
      <MechanicusFrame />
      
      <main className="min-h-screen pt-4 pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <header className="text-center py-6 border-b-2 border-grimlog-steel mb-6">
            <h1 className="text-4xl font-bold text-grimlog-orange glow-orange tracking-widest">
              DATASHEET LIBRARY
            </h1>
            <p className="text-grimlog-light-steel text-sm font-mono mt-2">
              .:| BROWSE UNIT SPECIFICATIONS |:.
            </p>
          </header>

          {/* Top Bar: Back Link + Create Button */}
          <div className="flex justify-between items-center mb-6">
            <Link
              href="/armies"
              className="inline-flex items-center gap-2 text-grimlog-orange hover:text-orange-400 font-mono text-sm"
            >
              ← BACK TO ARMIES
            </Link>
            
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  alert('Please sign in to create custom datasheets');
                  return;
                }
                handleCreateDatasheet();
              }}
              className="px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600 transition-colors tracking-wider text-sm"
            >
              + CREATE CUSTOM
            </button>
          </div>

          {/* Source Filter Tabs */}
          {isAuthenticated && (
            <div className="flex gap-1 mb-4">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-4 py-2 font-mono text-sm transition-colors ${
                  sourceFilter === 'all'
                    ? 'bg-grimlog-orange text-grimlog-black'
                    : 'bg-grimlog-gray text-grimlog-light-steel hover:bg-grimlog-steel'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setSourceFilter('official')}
                className={`px-4 py-2 font-mono text-sm transition-colors ${
                  sourceFilter === 'official'
                    ? 'bg-grimlog-orange text-grimlog-black'
                    : 'bg-grimlog-gray text-grimlog-light-steel hover:bg-grimlog-steel'
                }`}
              >
                OFFICIAL
              </button>
              <button
                onClick={() => setSourceFilter('mine')}
                className={`px-4 py-2 font-mono text-sm transition-colors flex items-center gap-2 ${
                  sourceFilter === 'mine'
                    ? 'bg-grimlog-orange text-grimlog-black'
                    : 'bg-grimlog-gray text-grimlog-light-steel hover:bg-grimlog-steel'
                }`}
              >
                MY DATASHEETS
                {myDatasheets.length > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    sourceFilter === 'mine' ? 'bg-grimlog-black/30' : 'bg-grimlog-orange/30 text-grimlog-orange'
                  }`}>
                    {myDatasheets.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Faction Selector */}
          <div className="mb-6">
            <div className="border-2 border-grimlog-steel p-4 bg-grimlog-black relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grimlog-orange"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grimlog-orange"></div>
              
              <div className="flex flex-col md:flex-row gap-4">
                {/* Faction Dropdown */}
                <div className="flex-1">
                  <label className="block text-grimlog-orange font-bold mb-2 tracking-wider text-sm">
                    SELECT FACTION
                  </label>
                  
                  {loadingFactions ? (
                    <div className="px-4 py-3 bg-grimlog-darkGray border-2 border-grimlog-steel text-grimlog-light-steel">
                      Loading factions...
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full px-4 py-3 bg-grimlog-darkGray border-2 flex items-center justify-between transition-colors
                          ${isDropdownOpen ? 'border-grimlog-orange' : 'border-grimlog-steel hover:border-grimlog-orange'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {selectedFaction ? (
                            <>
                              <div className="text-grimlog-orange">
                                <FactionIcon factionName={selectedFaction.name} className="w-6 h-6" />
                              </div>
                              <span className="text-white font-bold">{selectedFaction.name}</span>
                              <span className="text-grimlog-light-steel text-sm">
                                ({selectedFaction.datasheetCount} datasheets)
                              </span>
                            </>
                          ) : (
                            <span className="text-grimlog-light-steel">Select faction...</span>
                          )}
                        </div>
                        <span className={`text-grimlog-orange transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-grimlog-black border-2 border-grimlog-orange max-h-96 overflow-y-auto shadow-xl">
                          {factions.map(faction => (
                            <button
                              key={faction.id}
                              onClick={() => selectFaction(faction)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-grimlog-darkGray transition-colors border-b border-grimlog-darkGray last:border-0 text-left"
                            >
                              <div className="text-grimlog-light-steel">
                                <FactionIcon factionName={faction.name} className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="text-white font-bold">{faction.name}</div>
                                <div className="text-xs text-grimlog-light-steel">
                                  {faction.datasheetCount} datasheets
                                  {faction.parentFaction && (
                                    <span className="text-grimlog-green ml-2">
                                      + {faction.parentFaction.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Include Parent Toggle */}
                {selectedFaction?.parentFaction && (
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeParent}
                        onChange={(e) => setIncludeParent(e.target.checked)}
                        className="w-5 h-5 accent-grimlog-orange"
                      />
                      <span className="text-grimlog-light-steel text-sm">
                        Include {selectedFaction.parentFaction.name} units
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          {selectedFaction && (
            <div className="mb-6 flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search datasheets..."
                  className="w-full px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors font-mono"
                />
              </div>

              {/* Role Filter */}
              <div className="flex-shrink-0">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-4 py-2 bg-grimlog-black border-2 border-grimlog-steel focus:border-grimlog-orange text-white outline-none transition-colors font-mono min-w-[200px]"
                >
                  <option value="">All Roles ({filteredDatasheets.length})</option>
                  {availableRoles.map(r => (
                    <option key={r.role} value={r.role}>
                      {r.role} ({r.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-spin">⚙</div>
              <div className="text-grimlog-orange">Loading datasheets...</div>
            </div>
          )}

          {/* Empty State */}
          {!selectedFaction && !loading && (
            <div className="text-center py-12 border-2 border-dashed border-grimlog-steel">
              <div className="text-6xl mb-4 opacity-50">📋</div>
              <div className="text-xl text-grimlog-light-steel mb-2">Select a Faction</div>
              <div className="text-sm text-grimlog-steel">
                Choose a faction above to browse available datasheets
              </div>
            </div>
          )}

          {/* Datasheets Grid - Grouped by Role */}
          {selectedFaction && !loading && (
            <div className="space-y-8">
              {groupedDatasheets.map(group => (
                <div key={group.role}>
                  {/* Role Header */}
                  <div className="flex items-center gap-3 mb-4 border-b border-grimlog-steel pb-2">
                    <h2 className="text-lg font-bold text-grimlog-orange tracking-wider uppercase">
                      {group.role}
                    </h2>
                    <span className="text-grimlog-light-steel text-sm font-mono">
                      ({group.datasheets.length})
                    </span>
                  </div>

                  {/* Datasheets Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.datasheets.map(ds => (
                      <div key={ds.id} className="relative group">
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
                          composition={ds.composition}
                          iconUrl={ds.iconUrl}
                        />
                        
                        {/* Badge overlay for custom/version */}
                        <div className="absolute top-2 right-2 flex gap-1 z-10">
                          {ds.isOfficial === false && (
                            <span className="px-1.5 py-0.5 bg-purple-500 text-white text-xs font-bold">
                              CUSTOM
                            </span>
                          )}
                          {ds.forkedFromId && (
                            <span className="px-1.5 py-0.5 bg-cyan-600 text-white text-xs font-bold">
                              FORK
                            </span>
                          )}
                          {ds.currentVersion && ds.currentVersion > 1 && (
                            <span className="px-1.5 py-0.5 bg-grimlog-steel text-white text-xs font-mono">
                              v{ds.currentVersion}
                            </span>
                          )}
                        </div>
                        
                        {/* Action Menu Button */}
                        <div className="absolute top-2 left-2 z-20">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleActionMenu(ds.id);
                            }}
                            className="w-7 h-7 bg-grimlog-black/80 border border-grimlog-steel text-grimlog-light-steel hover:text-grimlog-orange hover:border-grimlog-orange opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                          >
                            ⋮
                          </button>
                          
                          {/* Dropdown Menu */}
                          {actionMenuOpen === ds.id && (
                            <div 
                              className="absolute top-full left-0 mt-1 w-36 bg-grimlog-black border border-grimlog-orange shadow-lg z-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Fork/Copy - available for all users */}
                              <button
                                onClick={() => handleForkDatasheet(ds)}
                                className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2"
                              >
                                <span>📋</span> Copy/Fork
                              </button>
                              
                              {/* Edit - only for user's own datasheets */}
                              {isAuthenticated && ds.ownerId && ds.isOfficial === false && (
                                <>
                                  <button
                                    onClick={() => handleEditDatasheet(ds)}
                                    className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2"
                                  >
                                    <span>✏️</span> Edit
                                  </button>
                                  <button
                                    onClick={() => handleShareDatasheet(ds)}
                                    className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2"
                                  >
                                    <span>🔗</span> Share
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDatasheet(ds)}
                                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                                  >
                                    <span>🗑️</span> Delete
                                  </button>
                                </>
                              )}
                              
                              {/* View Versions - link to detail page */}
                              <Link
                                href={`/datasheets/${ds.id}`}
                                className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2 border-t border-grimlog-steel"
                              >
                                <span>📜</span> View Details
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* No Results */}
              {groupedDatasheets.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-grimlog-steel">
                  <div className="text-4xl mb-4 opacity-50">🔍</div>
                  <div className="text-xl text-grimlog-light-steel mb-2">No Datasheets Found</div>
                  <div className="text-sm text-grimlog-steel">
                    {sourceFilter === 'mine' 
                      ? 'You haven\'t created any custom datasheets yet'
                      : 'Try adjusting your search or filters'
                    }
                  </div>
                  {sourceFilter === 'mine' && (
                    <button
                      onClick={handleCreateDatasheet}
                      className="mt-4 px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600 transition-colors"
                    >
                      + CREATE YOUR FIRST DATASHEET
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* My Datasheets - when no faction selected and viewing "mine" */}
          {sourceFilter === 'mine' && !selectedFaction && !loading && myDatasheets.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center gap-3 mb-4 border-b border-grimlog-steel pb-2">
                <h2 className="text-lg font-bold text-grimlog-orange tracking-wider uppercase">
                  ALL MY DATASHEETS
                </h2>
                <span className="text-grimlog-light-steel text-sm font-mono">
                  ({myDatasheets.length})
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myDatasheets.map(ds => (
                  <div key={ds.id} className="relative group">
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
                      composition={ds.composition}
                      iconUrl={ds.iconUrl}
                    />
                    
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <span className="px-1.5 py-0.5 bg-purple-500 text-white text-xs font-bold">
                        CUSTOM
                      </span>
                      {ds.forkedFromId && (
                        <span className="px-1.5 py-0.5 bg-cyan-600 text-white text-xs font-bold">
                          FORK
                        </span>
                      )}
                    </div>
                    
                    {/* Faction label */}
                    <div className="absolute bottom-0 left-0 right-0 bg-grimlog-black/80 px-2 py-1 text-xs text-grimlog-light-steel">
                      {ds.faction}
                    </div>
                    
                    {/* Action Menu */}
                    <div className="absolute top-2 left-2 z-20">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleActionMenu(ds.id);
                        }}
                        className="w-7 h-7 bg-grimlog-black/80 border border-grimlog-steel text-grimlog-light-steel hover:text-grimlog-orange hover:border-grimlog-orange opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                      >
                        ⋮
                      </button>
                      
                      {actionMenuOpen === ds.id && (
                        <div 
                          className="absolute top-full left-0 mt-1 w-36 bg-grimlog-black border border-grimlog-orange shadow-lg z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleEditDatasheet(ds)}
                            className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2"
                          >
                            <span>✏️</span> Edit
                          </button>
                          <button
                            onClick={() => handleForkDatasheet(ds)}
                            className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2"
                          >
                            <span>📋</span> Duplicate
                          </button>
                          <button
                            onClick={() => handleShareDatasheet(ds)}
                            className="w-full px-3 py-2 text-left text-sm text-grimlog-light-steel hover:bg-grimlog-gray hover:text-white flex items-center gap-2"
                          >
                            <span>🔗</span> Share
                          </button>
                          <button
                            onClick={() => handleDeleteDatasheet(ds)}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                          >
                            <span>🗑️</span> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for My Datasheets when no faction and no datasheets */}
          {sourceFilter === 'mine' && !selectedFaction && !loading && myDatasheets.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-grimlog-steel">
              <div className="text-6xl mb-4 opacity-50">🎨</div>
              <div className="text-xl text-grimlog-light-steel mb-2">No Custom Datasheets Yet</div>
              <div className="text-sm text-grimlog-steel mb-4">
                Create your own homebrew datasheets or fork official ones
              </div>
              <button
                onClick={handleCreateDatasheet}
                className="px-4 py-2 bg-grimlog-orange text-grimlog-black font-bold hover:bg-orange-600 transition-colors"
              >
                + CREATE YOUR FIRST DATASHEET
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Datasheet Editor Modal */}
      <DatasheetEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingDatasheet(null);
        }}
        onSave={handleSaveDatasheet}
        initialData={editingDatasheet ? {
          name: editingDatasheet.name,
          faction: editingDatasheet.faction,
          factionId: editingDatasheet.factionId,
          subfaction: editingDatasheet.subfaction,
          role: editingDatasheet.role as any,
          keywords: editingDatasheet.keywords,
          movement: editingDatasheet.movement,
          toughness: editingDatasheet.toughness,
          save: editingDatasheet.save,
          invulnerableSave: editingDatasheet.invulnerableSave,
          wounds: editingDatasheet.wounds,
          leadership: editingDatasheet.leadership,
          objectiveControl: editingDatasheet.objectiveControl,
          pointsCost: editingDatasheet.pointsCost,
          composition: editingDatasheet.composition,
        } : selectedFaction ? {
          faction: selectedFaction.name,
          factionId: selectedFaction.id,
        } : undefined}
        mode={editingDatasheet ? 'edit' : 'create'}
        factions={factions}
      />

      {/* Share Modal */}
      {sharingDatasheet && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setSharingDatasheet(null);
          }}
          type="datasheet"
          itemId={sharingDatasheet.id}
          itemName={sharingDatasheet.name}
        />
      )}
    </>
  );
}
