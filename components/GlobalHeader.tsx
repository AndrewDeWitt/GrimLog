'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import HamburgerMenu from './HamburgerMenu';
import PendingBriefBadge from './PendingBriefBadge';
import TokenPurchaseModal from './TokenPurchaseModal';

export default function GlobalHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState(0);

  // check for active session in localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSessionId = localStorage.getItem('grimlog-current-session');
      setCurrentSessionId(savedSessionId);
    }
  }, []);

  // Fetch token balance when purchase modal opens
  const handleOpenTokenPurchase = async () => {
    try {
      const res = await fetch('/api/tokens/balance');
      if (res.ok) {
        const data = await res.json();
        setTokenBalance(data.isAdmin ? 0 : data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch token balance:', err);
    }
    setShowTokenPurchase(true);
  };

  return (
    <>
      <TokenPurchaseModal
        isOpen={showTokenPurchase}
        onClose={() => setShowTokenPurchase(false)}
        currentBalance={tokenBalance}
      />
      <header className="h-12 px-4 border-b-2 border-grimlog-steel bg-grimlog-black flex-shrink-0 sticky top-0 z-50">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link href="/" className="flex items-center h-full hover:opacity-80 transition-opacity">
            <h1 className="text-2xl mt-1 font-bold text-grimlog-orange tracking-widest uppercase">
              GRIMLOG
            </h1>
          </Link>

          {/* Right Side: Pending Badge + Menu */}
          <nav className="flex items-center gap-3 mt-1" aria-label="Main navigation">
            <PendingBriefBadge />
            <HamburgerMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              onToggle={() => setIsMenuOpen(!isMenuOpen)}
              currentSessionId={currentSessionId}
              showReturnToBattle={!!currentSessionId}
              onOpenTokenPurchase={handleOpenTokenPurchase}
            />
          </nav>
        </div>
      </header>
    </>
  );
}

