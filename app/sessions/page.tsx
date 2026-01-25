'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GrimlogFrame from '@/components/MechanicusFrame';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast from '@/components/Toast';
import { cachedFetch, invalidateCache } from '@/lib/requestCache';

interface GameSession {
  id: string;
  startTime: string;
  endTime: string | null;
  currentPhase: string;
  battleRound: number;
  isActive: boolean;
  opponentName: string | null;
  opponentFaction: string | null;
  attackerArmy?: {
    name: string;
    player: {
      name: string;
      faction: string;
    };
  } | null;
  _count: {
    timelineEvents: number;
    transcripts: number;
  };
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  const fetchSessions = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);
      const data = await cachedFetch<GameSession[]>(
        '/api/sessions',
        { method: 'GET' },
        { ttl: 30000, skipCache } // 30 second cache
      );
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      showToast('Failed to load sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);


  const continueSession = (sessionId: string) => {
    localStorage.setItem('grimlog-current-session', sessionId);
    router.push('/sessions/live');
  };

  const deleteSession = useCallback((id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'PURGE SESSION DATA',
      message: 'Are you sure you want to purge this battle log? This action cannot be undone and all tactical data will be lost.',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const response = await fetch(`/api/sessions/${id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setSessions(sessions.filter(s => s.id !== id));
            // Invalidate sessions cache after delete
            invalidateCache('/api/sessions');
            showToast('Session purged from archives', 'success');
          } else {
            showToast('Failed to purge session', 'error');
          }
        } catch (error) {
          console.error('Failed to delete session:', error);
          showToast('Failed to delete session', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  }, [sessions]);

  const activeSessions = sessions.filter(s => s.isActive);
  const pastSessions = sessions.filter(s => !s.isActive);

  const formatDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000 / 60);
    return duration > 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`;
  };

  // Get current date in Imperial format (mock)
  const getImperialDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const day = Math.floor((now.getTime() - new Date(year, 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    // Simple check fraction approximation
    const check = Math.floor((now.getHours() * 1000) / 24);
    return `0.${check.toString().padStart(3, '0')}.${day.toString().padStart(3, '0')}.M${(year - 40000 + 1)}`;
  };

  return (
    <>
      <GrimlogFrame />
      
      <div className="min-h-screen pt-4 pb-4">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <header className="mb-8 relative" role="banner">
            <div className="flex justify-between items-end border-b-2 border-grimlog-steel pb-4">
              <div>
                <h1 className="text-4xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase">
                  SYSTEM LOGS
                </h1>
                <div className="flex items-center gap-3 mt-2 text-grimlog-green font-mono text-xs">
                  <span className="px-1 bg-grimlog-green text-grimlog-black font-bold">AUTH: VERMILION</span>
                  <span className="text-grimlog-steel">|</span>
                  <span>TERMINAL: ALPHA-9</span>
                </div>
              </div>
              <div className="text-right hidden md:block">
                <div className="text-grimlog-steel text-xs font-mono uppercase mb-1">System Date</div>
                <div className="text-grimlog-orange font-mono text-lg glow-orange">{getImperialDate()}</div>
              </div>
            </div>
          </header>

          {/* Actions */}
          <nav className="flex flex-wrap gap-4 mb-10" aria-label="Page actions">
            <Link
              href="/sessions/live"
              className="btn-depth px-6 py-3 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border border-grimlog-green transition-all uppercase inline-flex items-center focus:outline-none focus:ring-2 focus:ring-grimlog-green focus:ring-offset-2 focus:ring-offset-grimlog-black group"
              aria-label="Back to live session"
            >
              <span className="mr-2 group-hover:-translate-x-1 transition-transform">← </span> RETURN
            </Link>
            <Link
              href="/sessions/new"
              className="btn-depth px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-wider border border-grimlog-orange transition-all uppercase inline-flex items-center focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black hover-lift group ml-auto"
              aria-label="Create new game session"
            >
              <span className="mr-2 group-hover:rotate-90 transition-transform">⚔ </span> INITIATE NEW BATTLE
            </Link>
          </nav>

          {loading ? (
            <div className="text-center py-12" role="status" aria-live="polite">
              <div className="text-4xl mb-4 text-grimlog-orange animate-spin inline-block">◎</div>
              <p className="font-mono text-grimlog-green animate-pulse">ACCESSING BATTLE LOGS...</p>
            </div>
          ) : (
            <main id="main-content" className="space-y-10" role="main">
              {/* Active Sessions */}
              {activeSessions.length > 0 && (
                <section aria-label="Active game sessions">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-grimlog-orange animate-ping"></div>
                    <h2 className="text-xl font-bold text-grimlog-orange tracking-widest uppercase glow-orange">
                      CURRENT OPERATIONS ({activeSessions.length})
                    </h2>
                    <div className="h-px flex-grow bg-gradient-to-r from-grimlog-orange/50 to-transparent"></div>
                  </div>
                  
                  <div className="space-y-6">
                    {activeSessions.map(session => (
                      <article
                        key={session.id}
                        className="dataslate-frame p-6 relative overflow-hidden group"
                        aria-label={`Active session: Round ${session.battleRound}, ${session.currentPhase} phase`}
                      >
                        {/* Background scanline effect */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_4px,6px_100%] opacity-20"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
                          <div className="flex-grow">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-xl font-bold text-grimlog-orange mb-1 glow-orange flex items-center gap-2">
                                <span className="text-sm bg-grimlog-orange text-black px-1 font-mono">ACTIVE</span>
                                {session.opponentName ? `VS ${session.opponentName}` : 'UNIDENTIFIED OPPONENT'}
                              </h3>
                              <div className="font-mono text-xs text-grimlog-green/70">
                                ID: {session.id.substring(0, 8)}
                              </div>
                            </div>
                            
                            {session.opponentFaction && (
                              <div className="text-grimlog-light-steel font-bold uppercase tracking-wider text-sm mb-4 pl-2 border-l-2 border-grimlog-steel">
                                FACTION: <span className="text-grimlog-red">{session.opponentFaction}</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4 mb-4 bg-grimlog-black/40 p-3 border border-grimlog-steel/30">
                              <div>
                                <div className="text-[10px] uppercase text-grimlog-steel font-bold">Battle Round</div>
                                <div className="text-xl font-mono text-grimlog-green">{session.battleRound}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-grimlog-steel font-bold">Phase</div>
                                <div className="text-lg font-mono text-grimlog-green uppercase">{session.currentPhase}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-grimlog-steel font-bold">Duration</div>
                                <div className="text-sm font-mono text-grimlog-green">{formatDuration(session.startTime, session.endTime)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-grimlog-steel font-bold">Intel</div>
                                <div className="text-sm font-mono text-grimlog-green">{session._count.timelineEvents} Events</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 justify-center min-w-[140px]">
                            <button
                              onClick={() => continueSession(session.id)}
                              className="btn-depth px-4 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold text-center text-sm transition-all uppercase focus:outline-none focus:ring-2 focus:ring-grimlog-orange focus:ring-offset-2 focus:ring-offset-grimlog-black hover-lift flex items-center justify-center gap-2"
                              aria-label="Continue this session"
                            >
                              <span>▶</span> RESUME
                            </button>
                            <Link
                              href={`/sessions/${session.id}`}
                              className="btn-depth-sm px-4 py-2 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-green border border-grimlog-green font-bold text-center text-xs transition-all uppercase focus:outline-none focus:ring-2 focus:ring-grimlog-green focus:ring-offset-2 focus:ring-offset-grimlog-black flex items-center justify-center gap-2"
                              aria-label="View session details"
                            >
                              <span>👁</span> TACTICAL VIEW
                            </Link>
                            <button
                              onClick={() => deleteSession(session.id)}
                              disabled={isDeleting}
                              className="btn-depth-sm px-4 py-2 bg-transparent hover:bg-grimlog-red/10 text-grimlog-red border border-grimlog-red/50 font-bold text-center text-xs transition-all uppercase focus:outline-none focus:ring-2 focus:ring-grimlog-red focus:ring-offset-2 focus:ring-offset-grimlog-black disabled:opacity-50 disabled:cursor-not-allowed hover:border-grimlog-red"
                              aria-label="Delete this session"
                            >
                              ABORT
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Past Sessions */}
              {pastSessions.length > 0 && (
                <section aria-label="Past game sessions">
                  <div className="flex items-center gap-3 mb-4 pt-6">
                    <span className="text-grimlog-steel text-xl">◆</span>
                    <h2 className="text-xl font-bold text-grimlog-light-steel tracking-widest uppercase">
                      ARCHIVED LOGS ({pastSessions.length})
                    </h2>
                    <div className="h-px flex-grow bg-gradient-to-r from-grimlog-steel/50 to-transparent"></div>
                  </div>
                  
                  <div className="space-y-4">
                    {pastSessions.map(session => (
                      <article
                        key={session.id}
                        className="border border-grimlog-steel/40 bg-grimlog-darkGray/30 p-4 hover:border-grimlog-orange/50 transition-colors"
                        aria-label={`Past session from ${new Date(session.startTime).toLocaleDateString()}`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div className="flex-grow">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-grimlog-green font-mono text-sm bg-grimlog-steel/20 px-2 py-0.5 rounded-sm">
                                {new Date(session.startTime).toLocaleDateString()}
                              </span>
                              <h3 className="text-lg font-bold text-grimlog-light-steel">
                                {session.opponentName ? `VS ${session.opponentName}` : 'SKIRMISH'}
                              </h3>
                            </div>
                            
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-grimlog-steel">
                              <span className="flex items-center gap-1">
                                <span className="text-grimlog-orange/70">DUR:</span> 
                                {formatDuration(session.startTime, session.endTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-grimlog-orange/70">RND:</span> 
                                {session.battleRound}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-grimlog-orange/70">LOGS:</span> 
                                {session._count.timelineEvents}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2 items-center sm:self-center">
                            <Link
                              href={`/sessions/${session.id}`}
                              className="px-3 py-1.5 bg-grimlog-steel/10 hover:bg-grimlog-orange/10 text-grimlog-orange border border-grimlog-steel/50 hover:border-grimlog-orange transition-all uppercase text-xs font-bold tracking-wider focus:outline-none"
                              aria-label="View session replay"
                            >
                              REVIEW LOG
                            </Link>
                            <button
                              onClick={() => deleteSession(session.id)}
                              disabled={isDeleting}
                              className="px-3 py-1.5 hover:bg-grimlog-red/10 text-grimlog-red border border-transparent hover:border-grimlog-red/30 transition-all uppercase text-xs font-bold tracking-wider focus:outline-none"
                              aria-label="Delete this session"
                            >
                              PURGE
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* No sessions */}
              {sessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-grimlog-steel/30 bg-grimlog-black/20 rounded-sm" role="status">
                  <div className="text-6xl mb-6 opacity-20 animate-pulse">∅</div>
                  <h3 className="text-xl font-bold text-grimlog-green font-mono mb-2 tracking-wider">NO COMBAT DATA FOUND</h3>
                  <p className="text-sm text-grimlog-light-steel mb-8 max-w-md text-center">
                    Local data-slates are empty. Initiate a new battle sequence to begin recording tactical operations.
                  </p>
                  <Link
                    href="/sessions/new"
                    className="btn-depth px-8 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold tracking-widest border border-grimlog-orange transition-all uppercase inline-flex items-center hover-lift"
                  >
                    <span className="mr-2">⚔</span> INITIALIZE PROTOCOL
                  </Link>
                </div>
              )}
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
