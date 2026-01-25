'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import { useSession } from '@/lib/hooks/useSession';

interface SessionDetail {
  id: string;
  startTime: string;
  endTime: string | null;
  currentPhase: string;
  battleRound: number;
  isActive: boolean;
  opponentName: string | null;
  opponentFaction: string | null;
  playerArmy?: {
    name: string;
    player: {
      name: string;
      faction: string;
    };
  } | null;
  timelineEvents: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    phase: string | null;
    description: string;
  }>;
  transcripts: Array<{
    id: string;
    timestamp: string;
    text: string;
    sequenceOrder: number;
  }>;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'events' | 'transcripts'>('events');

  const sessionId = params.id as string;
  
  // Use custom hook for cached session data
  const { session, loading, error } = useSession(sessionId, {
    ttl: 30000, // 30 second cache
    autoFetch: true
  });

  // Redirect if session not found
  useEffect(() => {
    if (error && !loading) {
      router.push('/sessions');
    }
  }, [error, loading, router]);

  if (loading) {
    return (
      <>
        <GrimlogFrame />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center text-grimlog-orange">
            <div className="text-6xl mb-4">◎</div>
            <p className="text-xl font-mono">LOADING SESSION...</p>
          </div>
        </main>
      </>
    );
  }

  if (!session) return null;

  const duration = session.endTime 
    ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000 / 60)
    : Math.floor((new Date().getTime() - new Date(session.startTime).getTime()) / 1000 / 60);

  return (
    <>
      <GrimlogFrame />
      
      <main className="min-h-screen pt-4 pb-4">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <header className="py-6 border-b-2 border-grimlog-steel mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase">
                  SESSION REPLAY
                </h1>
                <p className="text-grimlog-green text-sm font-mono mt-2">
                  {session.isActive ? '[[ ACTIVE ]]' : '[[ COMPLETED ]]'}
                </p>
              </div>
              {session.isActive && (
                <div className="w-3 h-3 rounded-full bg-grimlog-green pulse-animation"></div>
              )}
            </div>

            {/* Session Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-grimlog-gray border border-grimlog-steel">
                <p className="text-grimlog-steel text-xs mb-1">STARTED</p>
                <p className="text-grimlog-green font-mono">{new Date(session.startTime).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-grimlog-gray border border-grimlog-steel">
                <p className="text-grimlog-steel text-xs mb-1">DURATION</p>
                <p className="text-grimlog-green font-mono">
                  {duration > 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`}
                </p>
              </div>
              <div className="p-3 bg-grimlog-gray border border-grimlog-steel">
                <p className="text-grimlog-steel text-xs mb-1">STATUS</p>
                <p className="text-grimlog-green font-mono">Round {session.battleRound} • {session.currentPhase}</p>
              </div>
            </div>
          </header>

          {/* Actions */}
          <div className="flex gap-4 mb-6">
            <Link
              href="/sessions"
              className="px-6 py-3 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border-2 border-grimlog-green transition-all uppercase"
            >
              ← BACK
            </Link>
            
            {/* View Mode Toggle */}
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => setViewMode('events')}
                className={`flex-1 px-6 py-3 font-bold tracking-wider border-2 transition-all uppercase ${
                  viewMode === 'events'
                    ? 'bg-grimlog-orange text-grimlog-black border-grimlog-orange'
                    : 'bg-grimlog-gray text-grimlog-orange border-grimlog-steel'
                }`}
              >
                EVENTS ({session.timelineEvents?.length || 0})
              </button>
              <button
                onClick={() => setViewMode('transcripts')}
                className={`flex-1 px-6 py-3 font-bold tracking-wider border-2 transition-all uppercase ${
                  viewMode === 'transcripts'
                    ? 'bg-grimlog-orange text-grimlog-black border-grimlog-orange'
                    : 'bg-grimlog-gray text-grimlog-orange border-grimlog-steel'
                }`}
              >
                TRANSCRIPTS ({session.transcripts?.length || 0})
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-grimlog-black border-2 border-grimlog-steel p-6 min-h-96">
            {viewMode === 'events' ? (
              /* Timeline Events */
              <div className="space-y-3">
                {!session.timelineEvents || session.timelineEvents.length === 0 ? (
                  <p className="text-grimlog-steel text-center py-12">No events recorded</p>
                ) : (
                  session.timelineEvents.map(event => (
                    <div
                      key={event.id}
                      className="p-4 bg-grimlog-gray border-l-4 border-grimlog-orange hover:bg-grimlog-steel transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-grimlog-orange uppercase">
                          {event.eventType}
                        </span>
                        <span className="text-xs text-grimlog-steel font-mono">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-grimlog-green">{event.description}</p>
                      {event.phase && (
                        <p className="text-xs text-grimlog-light-steel font-mono mt-1">
                          Phase: {event.phase}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Transcripts */
              <div className="space-y-2">
                {!session.transcripts || session.transcripts.length === 0 ? (
                  <p className="text-grimlog-steel text-center py-12">No transcripts recorded</p>
                ) : (
                  session.transcripts.map(transcript => (
                    <div
                      key={transcript.id}
                      className="p-3 bg-grimlog-gray border-l-2 border-grimlog-green"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-grimlog-steel font-mono">
                          #{transcript.sequenceOrder}
                        </span>
                        <span className="text-xs text-grimlog-steel font-mono">
                          {new Date(transcript.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-grimlog-green font-mono text-sm">
                        &gt; {transcript.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

