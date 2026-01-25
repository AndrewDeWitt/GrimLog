'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast from '@/components/Toast';
import FactionIcon from '@/components/FactionIcon';

interface Stratagem {
  id: string;
  name: string;
}

interface Army {
  id: string;
  name: string;
  playerName: string;
  faction: string;
  pointsLimit: number;
  unitCount: number;
  stratagemCount: number;
  stratagems?: Stratagem[];
  updatedAt?: string;
}

type SortOption = 'name' | 'points' | 'date';
type SortDirection = 'asc' | 'desc';

export default function ArmiesPage() {
  const [armies, setArmies] = useState<Army[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Sorting & Filtering
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterFaction, setFilterFaction] = useState<string>('all');
  const [expandedStratagems, setExpandedStratagems] = useState<Set<string>>(new Set());

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const [toast, setToast] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isVisible: false,
    message: '',
    type: 'info',
  });
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ isVisible: true, message, type });
  };

  useEffect(() => {
    fetchArmies();
  }, []);

  const fetchArmies = async () => {
    try {
      const response = await fetch('/api/armies');
      if (response.ok) {
        const data = await response.json();
        setArmies(data);
      } else {
        showToast('Failed to load armies', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch armies:', error);
      showToast('Failed to load armies', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteArmy = (id: string, armyName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'PURGE ARMY DATA',
      message: `Delete ${armyName}? This will remove all units and stratagems from the registry. This action cannot be undone.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const response = await fetch(`/api/armies/${id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setArmies(armies.filter(a => a.id !== id));
            showToast('Army purged from registry', 'success');
          } else {
            showToast('Failed to delete army', 'error');
          }
        } catch (error) {
          console.error('Failed to delete army:', error);
          showToast('Failed to delete army', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('desc'); // Default to descending for new sort (usually better for points/date)
    }
  };

  const toggleStratagems = (armyId: string) => {
    setExpandedStratagems(prev => {
      const next = new Set(prev);
      if (next.has(armyId)) {
        next.delete(armyId);
      } else {
        next.add(armyId);
      }
      return next;
    });
  };

  // Derive unique factions for filter dropdown
  const availableFactions = useMemo(() => {
    const factions = new Set(armies.map(a => a.faction));
    return Array.from(factions).sort();
  }, [armies]);

  // Filter and Sort logic
  const processedArmies = useMemo(() => {
    let result = [...armies];

    // Filter
    if (filterFaction !== 'all') {
      result = result.filter(a => a.faction === filterFaction);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'points':
          comparison = a.pointsLimit - b.pointsLimit;
          break;
        case 'date':
          // Fallback to 0 if date missing
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [armies, filterFaction, sortBy, sortDirection]);

  return (
    <>
      <GrimlogFrame />
      
      <div className="min-h-screen pt-4 pb-4">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <header className="mb-6" role="banner">
            <div className="flex justify-between items-center border-b border-grimlog-steel pb-4">
              <h1 className="text-3xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase">
                ARMY COGITATOR
              </h1>
              <div className="text-xs font-mono text-grimlog-steel uppercase tracking-widest">
                [[ FORCE REGISTRY ]]
              </div>
            </div>
          </header>

          {/* Unified Action & Filter Toolbar */}
          <div className="mb-8 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
            
            {/* Primary Actions Group */}
            <div className="flex gap-2 w-full lg:w-auto">
               <Link
                href="/"
                className="btn-depth h-10 px-4 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border border-grimlog-green transition-all uppercase flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-grimlog-green focus:ring-offset-2 focus:ring-offset-grimlog-black group whitespace-nowrap text-xs"
                aria-label="Back to main page"
              >
                <span className="mr-2 group-hover:-translate-x-1 transition-transform">← </span> RETURN
              </Link>
              <Link
                href="/armies/new"
                className="btn-depth h-10 px-4 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider border border-grimlog-orange transition-all uppercase flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black hover-lift group whitespace-nowrap text-xs"
                aria-label="Create new army"
              >
                <span className="mr-2 group-hover:rotate-90 transition-transform">+ </span> NEW REGISTER
              </Link>
            </div>

            {/* Spacer/Divider */}
            <div className="hidden lg:block w-px h-8 bg-grimlog-steel/30 mx-2"></div>

            {/* Filters Group */}
            <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto items-stretch sm:items-center bg-grimlog-darkGray/30 border border-grimlog-steel/30 p-1.5 rounded-sm">
              
              {/* Faction Filter */}
              <div className="flex items-center bg-grimlog-black border border-grimlog-steel/50 h-8 relative">
                <span className="text-[10px] font-bold text-grimlog-steel px-2 bg-grimlog-steel/10 h-full flex items-center uppercase tracking-wider border-r border-grimlog-steel/30">
                  FILTER
                </span>
                <div className="relative flex-grow sm:w-auto">
                  <select
                    value={filterFaction}
                    onChange={(e) => setFilterFaction(e.target.value)}
                    className="bg-transparent text-grimlog-green text-[11px] pl-2 pr-6 py-1 focus:outline-none focus:bg-grimlog-steel/10 font-mono uppercase appearance-none w-full h-full min-w-[140px] cursor-pointer"
                  >
                    <option value="all">ALL FACTIONS</option>
                    {availableFactions.map(f => (
                      <option key={f} value={f}>{f.toUpperCase()}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-grimlog-orange/70 pointer-events-none text-[8px]">▼</div>
                </div>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center bg-grimlog-black border border-grimlog-steel/50 h-8">
                <span className="text-[10px] font-bold text-grimlog-steel px-2 bg-grimlog-steel/10 h-full flex items-center uppercase tracking-wider border-r border-grimlog-steel/30">
                  SORT
                </span>
                <div className="flex h-full">
                  <button
                    onClick={() => toggleSort('name')}
                    className={`px-3 h-full text-[10px] uppercase font-bold transition-colors border-r border-grimlog-steel/30 hover:bg-grimlog-steel/20 ${sortBy === 'name' ? 'text-grimlog-orange bg-grimlog-orange/10' : 'text-grimlog-green'}`}
                  >
                    Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => toggleSort('points')}
                    className={`px-3 h-full text-[10px] uppercase font-bold transition-colors border-r border-grimlog-steel/30 hover:bg-grimlog-steel/20 ${sortBy === 'points' ? 'text-grimlog-orange bg-grimlog-orange/10' : 'text-grimlog-green'}`}
                  >
                    Pts {sortBy === 'points' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => toggleSort('date')}
                    className={`px-3 h-full text-[10px] uppercase font-bold transition-colors hover:bg-grimlog-steel/20 ${sortBy === 'date' ? 'text-grimlog-orange bg-grimlog-orange/10' : 'text-grimlog-green'}`}
                  >
                    Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Army List */}
          {loading ? (
            <div className="text-center py-12" role="status" aria-live="polite">
              <div className="text-4xl mb-4 text-grimlog-orange animate-spin inline-block">◎</div>
              <p className="font-mono text-grimlog-green animate-pulse">RETRIEVING FORCE DATA...</p>
            </div>
          ) : processedArmies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-grimlog-steel/30 bg-grimlog-black/20 rounded-sm" role="status">
              <div className="text-6xl mb-6 opacity-20 text-grimlog-steel">∅</div>
              <h3 className="text-xl font-bold text-grimlog-green font-mono mb-2 tracking-wider">NO FORCES REGISTERED</h3>
              <p className="text-sm text-grimlog-light-steel mb-8 max-w-md text-center">
                The registry is empty. Initialize a new army roster to begin force organization.
              </p>
              <Link
                href="/armies/new"
                className="btn-depth px-8 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-widest border border-grimlog-orange transition-all uppercase inline-flex items-center hover-lift"
              >
                <span className="mr-2">+</span> CREATE REGISTER
              </Link>
            </div>
          ) : (
            <main id="main-content" role="main">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {processedArmies.map(army => (
                  <article
                    key={army.id}
                    className="dataslate-frame p-6 relative overflow-hidden group flex flex-col"
                    aria-label={`Army: ${army.name}, ${army.faction}`}
                  >
                    {/* Background scanline effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_4px,6px_100%] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                    
                    {/* Card Header */}
                    <div className="relative z-10 border-b-2 border-grimlog-steel/20 pb-4 mb-4">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-xl font-bold text-grimlog-orange leading-tight glow-orange break-words">
                          {army.name}
                        </h3>
                        <div className="bg-grimlog-darkGray/80 p-1 border border-grimlog-steel/50 rounded-sm">
                          <FactionIcon factionName={army.faction} className="w-8 h-8 text-grimlog-amber" />
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                         <div className="flex justify-between text-xs font-mono border-l-2 border-grimlog-orange pl-2">
                            <span className="text-grimlog-steel uppercase">PLAYER ID</span>
                            <span className="text-grimlog-green font-bold">{army.playerName}</span>
                         </div>
                         <div className="flex justify-between text-xs font-mono border-l-2 border-grimlog-steel pl-2">
                            <span className="text-grimlog-steel uppercase">FACTION</span>
                            <span className="text-grimlog-green font-bold uppercase truncate max-w-[150px] text-right">{army.faction}</span>
                         </div>
                         <div className="flex justify-between text-xs font-mono border-l-2 border-grimlog-steel pl-2">
                            <span className="text-grimlog-steel uppercase">LIMIT</span>
                            <span className="text-grimlog-green font-bold">{army.pointsLimit} PTS</span>
                         </div>
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="relative z-10 grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-grimlog-black/40 border border-grimlog-steel/30 p-2 text-center group-hover:border-grimlog-orange/30 transition-colors">
                        <div className="text-[10px] text-grimlog-steel font-bold uppercase tracking-wider mb-1">UNITS</div>
                        <div className="text-2xl font-mono font-bold text-grimlog-green">{army.unitCount}</div>
                      </div>
                      <div className="bg-grimlog-black/40 border border-grimlog-steel/30 p-2 text-center group-hover:border-grimlog-orange/30 transition-colors">
                        <div className="text-[10px] text-grimlog-steel font-bold uppercase tracking-wider mb-1">STRATAGEMS</div>
                        <div className="text-2xl font-mono font-bold text-grimlog-green">{army.stratagemCount}</div>
                      </div>
                    </div>

                    {/* Stratagem Drawer */}
                    {army.stratagems && army.stratagems.length > 0 && (
                      <div className="relative z-10 mb-auto">
                        <button 
                          onClick={() => toggleStratagems(army.id)}
                          className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-grimlog-steel hover:text-grimlog-orange border-b border-grimlog-steel/20 pb-1 mb-2 focus:outline-none transition-colors"
                        >
                          <span>TACTICAL ASSETS</span>
                          <span>{expandedStratagems.has(army.id) ? '▼' : '▶'}</span>
                        </button>
                        
                        {expandedStratagems.has(army.id) && (
                          <div className="bg-grimlog-black/60 border border-grimlog-steel/30 p-2 mb-4 max-h-32 overflow-y-auto scrollbar-thin">
                            <ul className="space-y-1">
                              {army.stratagems.map(strat => (
                                <li key={strat.id} className="text-xs text-grimlog-green/80 hover:text-grimlog-orange transition-colors truncate font-mono pl-2 border-l border-grimlog-steel/30 hover:border-grimlog-orange">
                                  {strat.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-grimlog-steel/20">
                      <Link
                        href={`/armies/${army.id}`}
                        className="btn-depth-sm px-3 py-2 bg-grimlog-orange/10 hover:bg-grimlog-orange/20 text-grimlog-orange border border-grimlog-orange/50 hover:border-grimlog-orange font-bold text-center text-xs transition-all uppercase flex items-center justify-center gap-2 group/btn"
                        aria-label={`View details for ${army.name}`}
                      >
                        <span className="group-hover/btn:text-grimlog-amber">INSPECT</span>
                      </Link>
                      <button
                        onClick={() => deleteArmy(army.id, army.name)}
                        disabled={isDeleting}
                        className="btn-depth-sm px-3 py-2 bg-transparent hover:bg-grimlog-red/10 text-grimlog-red/70 hover:text-grimlog-red border border-grimlog-red/30 hover:border-grimlog-red/70 font-bold text-center text-xs transition-all uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Delete ${army.name}`}
                      >
                        PURGE
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </main>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="danger"
      />

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </>
  );
}
