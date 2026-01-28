'use client';

import { useState, useEffect } from 'react';

interface TokenBundle {
  id: string;
  tokens: number;
  price: number;
  priceDisplay: string;
  description: string;
  savings?: string;
  popular?: boolean;
}

interface TokenPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
}

export default function TokenPurchaseModal({
  isOpen,
  onClose,
  currentBalance = 0,
}: TokenPurchaseModalProps) {
  const [bundles, setBundles] = useState<TokenBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState(false);

  // Fetch available bundles
  useEffect(() => {
    if (isOpen) {
      fetch('/api/tokens/purchase')
        .then((res) => res.json())
        .then((data) => {
          if (data.bundles) {
            setBundles(data.bundles);
            setPaymentEnabled(data.paymentEnabled);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handlePurchase = async () => {
    if (!selectedBundle) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/tokens/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId: selectedBundle }),
      });

      const data = await res.json();

      if (!data.paymentEnabled) {
        // Show coming soon message - this is expected for now
        alert('Token purchases are coming soon! Contact support for early access.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 bottom-0 z-[61] animate-slideUp sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md">
        <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-t-lg sm:rounded-lg overflow-hidden">
          {/* Drag handle (mobile) */}
          <div className="flex justify-center py-2 sm:hidden">
            <div className="w-12 h-1 bg-grimlog-steel/50 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 py-3 border-b border-grimlog-steel/50 flex items-center justify-between">
            <h2 className="text-grimlog-amber font-bold tracking-wider uppercase flex items-center gap-2">
              <span className="text-xl">⬢</span> GET TOKENS
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-grimlog-steel hover:text-grimlog-orange transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Current Balance */}
          <div className="px-4 py-3 bg-grimlog-black/40 border-b border-grimlog-steel/30">
            <div className="flex items-center justify-between">
              <span className="text-grimlog-steel text-sm uppercase tracking-wider">
                Current Balance
              </span>
              <span className="text-grimlog-amber font-bold text-lg font-mono flex items-center gap-1">
                <span className="text-sm">⬢</span> {currentBalance}
              </span>
            </div>
          </div>

          {/* Bundle Selection */}
          <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
            {bundles.map((bundle) => (
              <button
                key={bundle.id}
                onClick={() => setSelectedBundle(bundle.id)}
                className={`
                  w-full p-4 rounded border-2 transition-all relative
                  ${selectedBundle === bundle.id
                    ? 'border-grimlog-amber bg-grimlog-amber/10'
                    : 'border-grimlog-steel/50 bg-grimlog-black/40 hover:border-grimlog-steel'
                  }
                `}
              >
                {bundle.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-grimlog-amber text-grimlog-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    Most Popular
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-grimlog-amber font-bold text-lg flex items-center gap-1">
                      <span className="text-sm">⬢</span> {bundle.tokens} Tokens
                    </div>
                    {bundle.savings && (
                      <div className="text-grimlog-green text-xs mt-1">
                        {bundle.savings}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-grimlog-light-steel font-bold text-lg">
                      {bundle.priceDisplay}
                    </div>
                    <div className="text-grimlog-steel text-xs">
                      ${(bundle.price / bundle.tokens).toFixed(2)}/token
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Coming Soon Notice */}
          {!paymentEnabled && (
            <div className="px-4 py-3 bg-grimlog-amber/10 border-t border-grimlog-amber/30">
              <p className="text-grimlog-amber text-sm text-center">
                Payment integration coming soon! Contact support for early access.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-grimlog-steel/50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-grimlog-steel/20 hover:bg-grimlog-steel/30 text-grimlog-steel border border-grimlog-steel/50 transition-all uppercase text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={!selectedBundle || isLoading}
              className="flex-1 py-3 bg-grimlog-amber hover:bg-grimlog-amber/90 text-grimlog-black border border-grimlog-amber transition-all uppercase text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Purchase'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
