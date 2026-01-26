'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import { useAuth } from '@/lib/auth/AuthContext';
import AuthModal from '@/components/AuthModal';
import { useBriefNotifications } from '@/lib/brief/BriefNotificationContext';

export default function BriefPage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auth state
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Credits state
  const [credits, setCredits] = useState<number | 'unlimited' | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Form state
  const [textInput, setTextInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Faction state
  const [factions, setFactions] = useState<{ id: string; name: string }[]>([]);
  const [selectedFactionId, setSelectedFactionId] = useState<string>('');
  const [factionsLoading, setFactionsLoading] = useState(false);

  // Notification context
  const { triggerRefresh } = useBriefNotifications();

  // Redirect non-authenticated users to homepage
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // Fetch credits when user is authenticated
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) {
        setCredits(null);
        return;
      }

      setCreditsLoading(true);
      try {
        const response = await fetch('/api/users/credits');
        if (response.ok) {
          const data = await response.json();
          setCredits(data.credits);
        }
      } catch (err) {
        console.error('Failed to fetch credits:', err);
      } finally {
        setCreditsLoading(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Fetch factions on mount
  useEffect(() => {
    const fetchFactions = async () => {
      setFactionsLoading(true);
      try {
        const response = await fetch('/api/factions');
        if (response.ok) {
          const data = await response.json();
          setFactions(data);
        }
      } catch (err) {
        console.error('Failed to fetch factions:', err);
      } finally {
        setFactionsLoading(false);
      }
    };
    fetchFactions();
  }, []);

  // Check if user can generate (has credits or is admin)
  const canGenerate = credits === 'unlimited' || (typeof credits === 'number' && credits > 0);
  const hasNoCredits = typeof credits === 'number' && credits === 0;

  // Handle submission
  const handleSubmit = async () => {
    if (!user) {
      router.push('/');
      return;
    }

    if (!canGenerate) {
      setError('No credits remaining.');
      return;
    }

    if (!selectedFactionId) {
      setError('Please select a faction');
      return;
    }

    if (!textInput.trim()) {
      setError('Please paste an army list');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/brief/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput, factionId: selectedFactionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          const creditsRes = await fetch('/api/users/credits');
          if (creditsRes.ok) {
            const data = await creditsRes.json();
            setCredits(data.credits);
          }
          throw new Error(errorData.message || 'No credits remaining');
        }
        if (response.status === 401) {
          router.push('/');
          throw new Error('Please sign in to continue');
        }
        throw new Error(errorData.error || 'Failed to submit');
      }

      triggerRefresh();
      router.push('/brief/gallery');
    } catch (err) {
      console.error('Submit error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSubmitting(false);
    }
  };

  // Loading state
  if (authLoading || !user) {
    return (
      <>
        <GrimlogFrame />
        <div className="h-[100dvh] flex items-center justify-center bg-grimlog-black">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-grimlog-steel rounded-full animate-spin border-t-grimlog-orange mx-auto" />
            <p className="text-grimlog-green font-mono mt-4 tracking-wider text-sm">
              {authLoading ? 'LOADING...' : 'REDIRECTING...'}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GrimlogFrame />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Fixed fullscreen container - accounts for nav */}
      <main className="fixed inset-0 top-12 flex flex-col bg-grimlog-black overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-grimlog-orange/5 via-transparent to-grimlog-green/5 pointer-events-none" />

        {/* Centered max-width container */}
        <div className="relative flex-1 flex flex-col w-full max-w-[1200px] mx-auto p-2 min-h-0">
        {/* Status bar */}
        <div className="relative flex items-center gap-2 mb-2 mt-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-grimlog-green animate-pulse" />
          <span className="text-grimlog-green text-xs font-mono uppercase tracking-wider">Ready</span>
        </div>

        {/* Dataslate container - fills remaining space */}
        <div className="relative flex-1 flex flex-col min-h-0">
          {/* Main frame */}
          <div className="relative flex-1 flex flex-col min-h-0 bg-gradient-to-b from-grimlog-darkGray to-grimlog-black border-2 border-grimlog-steel rounded-lg overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-grimlog-orange z-10" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-grimlog-orange z-10" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-grimlog-orange z-10" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-grimlog-orange z-10" />

            {/* Scanline effect */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] pointer-events-none opacity-50" />

            {/* Content */}
            <div className="relative flex-1 flex flex-col min-h-0 p-3">
              {/* Label row */}
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <label className="text-grimlog-orange text-xs font-bold uppercase tracking-wider">
                  Paste Army List Below
                </label>
                <span className="text-grimlog-light-steel text-xs font-mono">
                  {textInput.length > 0 ? `${textInput.split('\n').length} lines` : 'awaiting input'}
                </span>
              </div>

              {/* Faction selector */}
              <div className="mb-3 flex-shrink-0">
                <label className="block text-grimlog-light-steel text-xs font-mono uppercase tracking-wider mb-1">
                  Select Faction <span className="text-grimlog-red">*</span>
                </label>
                <select
                  value={selectedFactionId}
                  onChange={(e) => setSelectedFactionId(e.target.value)}
                  disabled={submitting || factionsLoading}
                  className="w-full bg-grimlog-black/80 border border-grimlog-steel text-grimlog-green p-2 font-mono text-sm focus:outline-none focus:border-grimlog-orange disabled:opacity-50 rounded appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23D97706' d='M2 4l4 4 4-4H2z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                  }}
                >
                  <option value="" className="bg-grimlog-black text-grimlog-steel">
                    {factionsLoading ? 'Loading factions...' : '-- Select a faction --'}
                  </option>
                  {factions.map((faction) => (
                    <option key={faction.id} value={faction.id} className="bg-grimlog-black text-grimlog-green">
                      {faction.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea wrapper - fills space */}
              <div className="flex-1 min-h-0">
                <textarea
                  ref={textareaRef}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={`Paste your army list here...

++ Army Faction: Space Wolves ++
++ Detachment: Champions of Russ ++

Logan Grimnar (145 pts)
Wolf Guard Terminators x5 (170 pts)
Blood Claws x10 (150 pts)
Thunderwolf Cavalry x3 (100 pts)`}
                  disabled={submitting}
                  className="relative w-full h-full bg-grimlog-black/80 border border-grimlog-steel text-grimlog-green p-3 font-mono text-sm focus:outline-none focus:border-grimlog-orange resize-none disabled:opacity-50 rounded placeholder:text-grimlog-light-steel/50"
                />
              </div>

              {/* Error/Warning */}
              {error && (
                <div className="mt-2 p-2 bg-grimlog-red/10 border border-grimlog-red/50 rounded flex-shrink-0">
                  <p className="text-grimlog-red text-xs">⚠ {error}</p>
                </div>
              )}
              {hasNoCredits && !error && (
                <div className="mt-2 p-2 bg-grimlog-amber/10 border border-grimlog-amber/50 rounded flex-shrink-0">
                  <p className="text-grimlog-amber text-xs">⚡ No credits remaining.</p>
                </div>
              )}

              {/* Button area with credits */}
              <div className="mt-3 flex-shrink-0">
                {/* Credits row */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-grimlog-light-steel text-xs font-mono">Credits:</span>
                  {creditsLoading ? (
                    <span className="text-grimlog-steel text-xs">...</span>
                  ) : credits === 'unlimited' ? (
                    <span className="text-grimlog-green text-xs font-bold">∞ Unlimited</span>
                  ) : (
                    <span className={`text-xs font-bold ${hasNoCredits ? 'text-grimlog-red' : 'text-grimlog-amber'}`}>
                      {credits ?? 0} remaining
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className={`absolute -inset-1 bg-grimlog-orange/20 rounded blur-md transition-opacity duration-300 ${!submitting && textInput.trim() && !hasNoCredits && selectedFactionId ? 'opacity-50' : 'opacity-0'}`} />
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !textInput.trim() || hasNoCredits || !selectedFactionId}
                    className={`relative w-full py-3.5 font-bold text-sm uppercase tracking-wider rounded transition-all min-h-[52px] flex items-center justify-center gap-2 border-2 ${
                      submitting || !textInput.trim() || hasNoCredits || !selectedFactionId
                        ? 'bg-grimlog-darkGray border-grimlog-steel/50 text-grimlog-steel cursor-not-allowed'
                        : 'bg-gradient-to-r from-grimlog-orange to-grimlog-amber border-grimlog-orange text-grimlog-black hover:from-grimlog-amber hover:to-grimlog-orange active:scale-[0.98]'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-grimlog-black/30 rounded-full animate-spin border-t-grimlog-black" />
                        <span>Analyzing...</span>
                      </>
                    ) : hasNoCredits ? (
                      <span>No Credits Available</span>
                    ) : !selectedFactionId ? (
                      <span>Select a Faction</span>
                    ) : !textInput.trim() ? (
                      <span>Awaiting Input...</span>
                    ) : (
                      <>
                        <span>⚔</span>
                        <span>Analyze Army</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Gallery link */}
                <Link
                  href="/brief/gallery"
                  className="block text-center text-grimlog-light-steel text-sm font-mono mt-4 py-2 hover:text-grimlog-amber transition-colors"
                >
                  Browse Gallery →
                </Link>
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>
    </>
  );
}
