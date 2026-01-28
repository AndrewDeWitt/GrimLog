'use client';

import { useEffect } from 'react';

interface InsufficientTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetTokens: () => void;
  requiredTokens: number;
  currentBalance: number;
  featureName?: string;
}

export default function InsufficientTokensModal({
  isOpen,
  onClose,
  onGetTokens,
  requiredTokens,
  currentBalance,
  featureName = 'this feature',
}: InsufficientTokensModalProps) {
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

  if (!isOpen) return null;

  const tokensNeeded = requiredTokens - currentBalance;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 bottom-0 z-[61] animate-slideUp sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm">
        <div className="bg-grimlog-darkGray border border-grimlog-red/50 rounded-t-lg sm:rounded-lg overflow-hidden">
          {/* Drag handle (mobile) */}
          <div className="flex justify-center py-2 sm:hidden">
            <div className="w-12 h-1 bg-grimlog-steel/50 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 py-3 border-b border-grimlog-red/30 bg-grimlog-red/10">
            <h2 className="text-grimlog-red font-bold tracking-wider uppercase text-center flex items-center justify-center gap-2">
              <span className="text-xl">⚠</span> INSUFFICIENT TOKENS
            </h2>
          </div>

          {/* Content */}
          <div className="p-6 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">⬢</div>
              <p className="text-grimlog-light-steel mb-4">
                You need <span className="text-grimlog-amber font-bold">{requiredTokens} tokens</span> to use {featureName}.
              </p>
              <p className="text-grimlog-steel text-sm">
                Current balance: <span className="text-grimlog-amber font-mono">{currentBalance}</span>
              </p>
            </div>

            {/* Token Comparison */}
            <div className="bg-grimlog-black/40 p-4 rounded border border-grimlog-steel/30 mb-6">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-grimlog-steel text-xs uppercase mb-1">Have</div>
                  <div className="text-grimlog-red font-bold text-2xl font-mono">{currentBalance}</div>
                </div>
                <div className="text-grimlog-steel text-2xl">→</div>
                <div className="text-center">
                  <div className="text-grimlog-steel text-xs uppercase mb-1">Need</div>
                  <div className="text-grimlog-amber font-bold text-2xl font-mono">{requiredTokens}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-grimlog-steel/30">
                <span className="text-grimlog-steel text-sm">
                  Short by <span className="text-grimlog-red font-bold">{tokensNeeded}</span> token{tokensNeeded !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-grimlog-steel/50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-grimlog-steel/20 hover:bg-grimlog-steel/30 text-grimlog-steel border border-grimlog-steel/50 transition-all uppercase text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                onGetTokens();
              }}
              className="flex-1 py-3 bg-grimlog-amber hover:bg-grimlog-amber/90 text-grimlog-black border border-grimlog-amber transition-all uppercase text-sm font-bold"
            >
              Get Tokens
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
