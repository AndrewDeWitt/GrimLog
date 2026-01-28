'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  
  // Session state
  currentSessionId?: string | null;
  isInitialized?: boolean;
  isLoading?: boolean;
  
  // Actions
  onStart?: () => void;
  onStop?: () => void;
  onAdvanceRound?: () => void;
  onClearTimeline?: () => void;
  onEndGame?: () => void;
  onOpenTacticalAdvisor?: () => void;
  onOpenStratagemLogger?: () => void;
  onOpenDamageCalculator?: () => void;
  onOpenDamageResults?: () => void;
  onOpenTokenPurchase?: () => void;
  
  // UI state
  timelineEventsCount?: number;
  damageResultsCount?: number;
  
  // Navigation
  showReturnToBattle?: boolean;
}

export default function HamburgerMenu({
  isOpen,
  onClose,
  onToggle,
  currentSessionId,
  isInitialized = false,
  isLoading = false,
  onStart,
  onStop,
  onAdvanceRound,
  onClearTimeline,
  onEndGame,
  onOpenTacticalAdvisor,
  onOpenStratagemLogger,
  onOpenDamageCalculator,
  onOpenDamageResults,
  onOpenTokenPurchase,
  timelineEventsCount = 0,
  damageResultsCount = 0,
  showReturnToBattle = false
}: HamburgerMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Fetch token balance
  const fetchTokenBalance = useCallback(async () => {
    if (!user) {
      setTokenBalance(null);
      return;
    }
    
    setIsLoadingTokens(true);
    try {
      const res = await fetch('/api/tokens/balance');
      if (res.ok) {
        const data = await res.json();
        setTokenBalance(data.balance);
        // Also update admin status from this response
        if (data.isAdmin !== undefined) {
          setIsAdmin(data.isAdmin);
        }
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [user]);

  // Fetch token balance (and admin status) when menu opens or user changes
  // Note: /api/tokens/balance returns isAdmin, so no separate admin check needed
  useEffect(() => {
    if (user && isOpen) {
      fetchTokenBalance();
    }
    if (!user) {
      setIsAdmin(false);
      setTokenBalance(null);
    }
  }, [user, isOpen, fetchTokenBalance]);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && 
          // Don't close if clicking the toggle button (handled by toggle logic)
          !(e.target as Element).closest('button[aria-controls="hamburger-menu"]')) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);
  
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  const handleNavigation = (path: string) => {
    onClose();
    router.push(path);
  };
  
  return (
    <>
      {/* Menu Trigger (Cog Icon) */}
      <button
        type="button"
        onClick={onToggle}
        className={`
          relative z-50 w-9 h-9 p-0 flex items-center justify-center
          bg-grimlog-black border border-grimlog-steel
          text-grimlog-orange transition-all duration-300
          hover:border-grimlog-orange hover:text-grimlog-amber
          focus:outline-none touch-size-override
          ${isOpen ? 'rotate-90 border-grimlog-orange text-grimlog-amber' : ''}
        `}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="hamburger-menu"
        title="Open Menu"
      >
        {/* Cog Icon SVG */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-7 h-7"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.759 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.581-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      
      {/* Backdrop with CRT scanline effect */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 transition-opacity backdrop-blur-sm"
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-grimlog-steel/5 to-transparent opacity-20 pointer-events-none" />
        </div>
      )}
      
      {/* Dataslate Menu Panel */}
      <div
        id="hamburger-menu"
        ref={menuRef}
        className={`
          fixed top-[70px] right-4 w-[380px] max-w-[calc(100vw-2rem)] z-50
          transition-all duration-300 ease-out origin-top-right
          ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-4 pointer-events-none'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Cogitator Menu"
      >
        {/* Dataslate Frame Container */}
        <div className="dataslate-frame relative bg-grimlog-black p-1 overflow-hidden">
          {/* Rivets - removed for flatter look */}
          {/* <div className="dataslate-rivet tl" />
          <div className="dataslate-rivet tr" />
          <div className="dataslate-rivet bl" />
          <div className="dataslate-rivet br" /> */}
          
          {/* Inner Screen Container with Scanlines */}
          <div className={`
            relative bg-grimlog-darkGray border border-grimlog-steel p-4 
            ${isOpen ? 'dataslate-open-anim' : ''}
          `}>
            {/* CRT Overlay - removed for cleaner look */}
            {/* <div className="absolute inset-0 crt-overlay z-10 pointer-events-none" /> */}
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-grimlog-steel/50 pb-3 mb-4 relative z-20">
              <h2 className="text-grimlog-orange font-bold tracking-widest uppercase text-base flex items-center gap-2 glow-orange">
                <span className="text-xl">⚙</span> SYSTEM MENU
              </h2>
              <div className="text-[10px] font-mono text-grimlog-green/50">
                V.994.M42
              </div>
            </div>
            
            {/* Content */}
            <nav className="space-y-5 relative z-20 max-h-[70vh] overflow-y-auto pr-1">
              
              {/* User Profile Section */}
              {user && (
                <div className="bg-black/40 border border-grimlog-steel p-3">
                  <div className="flex items-center gap-3 mb-3">
                    {user.user_metadata?.avatar_url ? (
                      <img 
                        src={user.user_metadata.avatar_url} 
                        alt={user.user_metadata?.name || user.email || 'User'} 
                        className="w-10 h-10 border border-grimlog-orange"
                      />
                    ) : (
                      <div className="w-10 h-10 border border-grimlog-orange bg-grimlog-steel/20 flex items-center justify-center text-grimlog-orange font-bold text-lg">
                        {(user.user_metadata?.name || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-grimlog-orange font-bold text-xs truncate font-mono">
                        {user.user_metadata?.name || user.email?.split('@')[0] || 'OPERATOR'}
                      </div>
                      <div className="text-grimlog-steel text-[10px] truncate font-mono uppercase">
                        Clearance: Vermilion
                      </div>
                    </div>
                  </div>
                  
                  {/* Token Balance Display */}
                  <div className="mb-3 p-2 bg-grimlog-black/60 border border-grimlog-amber/30 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-grimlog-amber text-sm">⬢</span>
                        <span className="text-grimlog-amber text-xs font-bold uppercase tracking-wider">
                          Tokens
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLoadingTokens ? (
                          <span className="text-grimlog-steel text-xs animate-pulse">...</span>
                        ) : isAdmin ? (
                          <span className="text-grimlog-green text-sm font-bold font-mono">∞</span>
                        ) : (
                          <span className="text-grimlog-amber text-sm font-bold font-mono">
                            {tokenBalance ?? 0}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isAdmin && (
                      <button
                        onClick={() => {
                          if (onOpenTokenPurchase) {
                            onOpenTokenPurchase();
                            onClose();
                          }
                        }}
                        className="w-full mt-2 py-1.5 bg-grimlog-amber/10 hover:bg-grimlog-amber/20 text-grimlog-amber border border-grimlog-amber/30 transition-all uppercase text-[10px] tracking-wider font-bold flex items-center justify-center gap-2"
                      >
                        <span>+</span> GET MORE TOKENS
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full py-1.5 bg-grimlog-steel/20 hover:bg-grimlog-red/20 text-grimlog-red hover:text-red-400 border border-grimlog-red/30 transition-all uppercase text-[10px] tracking-wider font-bold flex items-center justify-center gap-2"
                  >
                    <span>⏻</span> LOG OUT
                  </button>
                </div>
              )}
              
              {/* Session Controls Section - Only show if actions are provided */}
              {(onStart || onStop || onAdvanceRound || onClearTimeline || onEndGame) && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-grimlog-green/60 text-xs font-bold tracking-widest uppercase border-b border-grimlog-steel/30 pb-1 mb-2">
                      BATTLE CONTROLS
                    </h3>
                    
                    {!currentSessionId ? (
                      <button
                        onClick={() => handleNavigation('/sessions/new')}
                        className="w-full p-4 bg-grimlog-orange/10 hover:bg-grimlog-orange/20 text-grimlog-orange border border-grimlog-orange transition-all uppercase text-sm font-bold tracking-wider text-left flex items-center gap-3 group"
                      >
                        <span className="group-hover:text-white transition-colors">⚔</span> NEW BATTLE
                      </button>
                    ) : !isInitialized && onStart ? (
                      <button
                        onClick={() => { onStart(); onClose(); }}
                        disabled={isLoading}
                        className="w-full p-4 bg-grimlog-orange/10 hover:bg-grimlog-orange/20 text-grimlog-orange border border-grimlog-orange disabled:border-grimlog-steel disabled:text-grimlog-steel transition-all uppercase text-sm font-bold tracking-wider text-left flex items-center gap-3 group disabled:bg-transparent"
                      >
                        <span className="group-hover:text-white transition-colors">▶</span> START SESSION
                      </button>
                    ) : onStop ? (
                      <button
                        onClick={() => { onStop(); onClose(); }}
                        disabled={isLoading}
                        className="w-full p-4 bg-grimlog-green/10 hover:bg-grimlog-green/20 text-grimlog-green border border-grimlog-green disabled:border-grimlog-steel disabled:text-grimlog-steel transition-all uppercase text-sm font-bold tracking-wider text-left flex items-center gap-3 group"
                      >
                        <span className="group-hover:text-white transition-colors">■</span> PAUSE SESSION
                      </button>
                    ) : null}
                    
                    <div className="grid grid-cols-2 gap-3">
                      {onAdvanceRound && (
                        <button
                          onClick={() => { onAdvanceRound(); onClose(); }}
                          disabled={!currentSessionId || isLoading}
                          className="p-3 bg-black/40 hover:bg-grimlog-steel/20 text-grimlog-orange border border-grimlog-steel hover:border-grimlog-orange transition-all uppercase text-xs font-bold text-center disabled:opacity-50"
                        >
                          NEXT ROUND
                        </button>
                      )}
                      
                      {onClearTimeline && (
                        <button
                          onClick={() => { onClearTimeline(); onClose(); }}
                          disabled={timelineEventsCount === 0}
                          className="p-3 bg-black/40 hover:bg-grimlog-steel/20 text-grimlog-orange border border-grimlog-steel hover:border-grimlog-orange transition-all uppercase text-xs font-bold text-center disabled:opacity-50"
                        >
                          CLEAR LOG
                        </button>
                      )}
                    </div>
                    
                    {onOpenTacticalAdvisor && (
                      <button
                        onClick={() => { onOpenTacticalAdvisor(); onClose(); }}
                        disabled={!currentSessionId}
                        className="w-full p-3.5 bg-grimlog-amber/10 hover:bg-grimlog-amber/20 text-grimlog-amber border border-grimlog-amber/50 transition-all uppercase text-xs font-bold tracking-wider text-left flex items-center gap-2 group disabled:opacity-50"
                      >
                        <span className="opacity-70 group-hover:opacity-100">🧠</span> TACTICAL ADVISOR
                      </button>
                    )}
                    
                    {onOpenStratagemLogger && (
                      <button
                        onClick={() => { onOpenStratagemLogger(); onClose(); }}
                        disabled={!currentSessionId}
                        className="w-full p-3.5 bg-grimlog-green/10 hover:bg-grimlog-green/20 text-grimlog-green border border-grimlog-green/50 transition-all uppercase text-xs font-bold tracking-wider text-left flex items-center gap-2 group disabled:opacity-50"
                      >
                        <span className="opacity-70 group-hover:opacity-100">⚡</span> LOG STRATAGEM
                      </button>
                    )}
                    
                    {onOpenDamageCalculator && (
                      <button
                        onClick={() => { onOpenDamageCalculator(); onClose(); }}
                        disabled={!currentSessionId}
                        className="w-full p-3.5 bg-grimlog-orange/10 hover:bg-grimlog-orange/20 text-grimlog-orange border border-grimlog-orange/50 transition-all uppercase text-xs font-bold tracking-wider text-left flex items-center gap-2 group disabled:opacity-50"
                      >
                        <span className="opacity-70 group-hover:opacity-100">⚔</span> MATHHAMMER CALC (QUICK)
                      </button>
                    )}
                    
                    {onOpenDamageResults && damageResultsCount > 0 && (
                      <button
                        onClick={() => { onOpenDamageResults(); onClose(); }}
                        className="w-full p-3.5 bg-grimlog-amber/10 hover:bg-grimlog-amber/20 text-grimlog-amber border border-grimlog-amber/50 transition-all uppercase text-xs font-bold tracking-wider text-left flex items-center gap-2 group"
                      >
                        <span className="opacity-70 group-hover:opacity-100">📊</span> 
                        VIEW DAMAGE RESULTS
                        <span className="ml-auto bg-grimlog-amber text-grimlog-black text-xs px-1.5 py-0.5 rounded-sm font-bold">
                          {damageResultsCount}
                        </span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleNavigation('/calculator')}
                      disabled={!currentSessionId}
                      className="w-full p-3.5 bg-grimlog-orange/10 hover:bg-grimlog-orange/20 text-grimlog-orange border border-grimlog-orange/50 transition-all uppercase text-xs font-bold tracking-wider text-left flex items-center gap-2 group disabled:opacity-50"
                    >
                      <span className="opacity-70 group-hover:opacity-100">⚔</span> MATHHAMMER CALC (FULL)
                    </button>
                    
                    {currentSessionId && onEndGame && (
                      <button
                        onClick={() => { onEndGame(); onClose(); }}
                        disabled={isLoading}
                        className="w-full mt-2 p-3 bg-grimlog-red/10 hover:bg-grimlog-red/20 text-grimlog-red border border-grimlog-red transition-all uppercase text-xs font-bold tracking-wider text-center disabled:opacity-50 hover:shadow-[0_0_10px_rgba(184,74,74,0.2)]"
                      >
                        END GAME
                      </button>
                    )}
                  </div>
                </>
              )}
              
              {/* Navigation Section */}
              <div className="space-y-3 pt-2 border-t border-grimlog-steel/30">
                <h3 className="text-grimlog-green/60 text-xs font-bold tracking-widest uppercase border-b border-grimlog-steel/30 pb-1 mb-2">
                  NAVIGATION
                </h3>
                
                {showReturnToBattle && isAdmin && (
                  <button
                    onClick={() => handleNavigation('/')}
                    className="w-full p-3.5 bg-grimlog-orange hover:bg-grimlog-amber text-black font-bold tracking-wider uppercase text-sm text-center mb-2 hover:shadow-[0_0_15px_rgba(255,107,0,0.4)] transition-all"
                  >
                    RETURN TO BATTLE
                  </button>
                )}
                
                {/* Brief - Available to all users */}
                <button
                  onClick={() => handleNavigation('/brief')}
                  className="w-full p-3.5 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-amber border border-grimlog-steel/50 hover:border-grimlog-amber transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                >
                  <span className="text-grimlog-steel">📋</span> TACTICAL BRIEF
                </button>
                
                {/* My Briefs - Only for authenticated users */}
                {user && (
                  <button
                    onClick={() => handleNavigation('/brief/history')}
                    className="w-full p-3.5 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-green border border-grimlog-steel/50 hover:border-grimlog-green transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                  >
                    <span className="text-grimlog-steel">📚</span> MY BRIEFS
                  </button>
                )}
                
                {/* Public Gallery - Available to everyone */}
                <button
                  onClick={() => handleNavigation('/brief/gallery')}
                  className="w-full p-3.5 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-light-steel border border-grimlog-steel/50 hover:border-grimlog-light-steel transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                >
                  <span className="text-grimlog-steel">🌐</span> PUBLIC GALLERY
                </button>
                
                {/* Admin-only features */}
                {isAdmin && (
                  <>
                    <div className="pt-2 mt-2 border-t border-grimlog-steel/20">
                      <h4 className="text-grimlog-red/60 text-[10px] font-bold tracking-widest uppercase mb-2">
                        ADMIN ACCESS
                      </h4>
                    </div>
                    
                    <button
                      onClick={() => handleNavigation('/sessions')}
                      className="w-full p-3.5 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-green border border-grimlog-steel/50 hover:border-grimlog-green transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                    >
                      <span className="text-grimlog-steel">◆</span> SESSIONS
                    </button>
                    
                    <button
                      onClick={() => handleNavigation('/armies')}
                      className="w-full p-3.5 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-orange border border-grimlog-steel/50 hover:border-grimlog-orange transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                    >
                      <span className="text-grimlog-steel">◆</span> ARMIES
                    </button>
                    
                    <button
                      onClick={() => handleNavigation('/datasheets')}
                      className="w-full p-3.5 bg-transparent hover:bg-grimlog-steel/20 text-grimlog-amber border border-grimlog-steel/50 hover:border-grimlog-amber transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                    >
                      <span className="text-grimlog-steel">◆</span> DATASHEETS
                    </button>
                    
                    <button
                      onClick={() => handleNavigation('/admin/factions')}
                      className="w-full p-3.5 bg-grimlog-red/10 hover:bg-grimlog-red/20 text-grimlog-red border border-grimlog-red/50 hover:border-grimlog-red transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                    >
                      <span className="text-grimlog-red">⚙</span> DATA ADMIN
                    </button>
                    
                    <button
                      onClick={() => handleNavigation('/admin/users')}
                      className="w-full p-3.5 bg-grimlog-red/10 hover:bg-grimlog-red/20 text-grimlog-red border border-grimlog-red/50 hover:border-grimlog-red transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                    >
                      <span className="text-grimlog-red">👤</span> USER TOKENS
                    </button>
                    
                    <button
                      onClick={() => handleNavigation('/admin/pricing')}
                      className="w-full p-3.5 bg-grimlog-red/10 hover:bg-grimlog-red/20 text-grimlog-red border border-grimlog-red/50 hover:border-grimlog-red transition-all uppercase text-sm font-bold text-left flex items-center gap-3 px-3"
                    >
                      <span className="text-grimlog-red">⬢</span> TOKEN PRICING
                    </button>
                  </>
                )}
              </div>
              
            </nav>
            
            {/* Footer decoration */}
            <div className="mt-4 pt-2 border-t border-grimlog-steel/30 flex justify-between items-center opacity-50 relative z-20">
              <div className="h-1 w-1 bg-grimlog-red rounded-full animate-pulse"></div>
              <div className="text-[8px] font-mono text-grimlog-green uppercase">
                ONLINE
              </div>
              <div className="h-1 w-1 bg-grimlog-red rounded-full animate-pulse"></div>
            </div>
            
          </div>
        </div>
      </div>
    </>
  );
}
