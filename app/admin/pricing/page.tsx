'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HamburgerMenu from '@/components/HamburgerMenu';

interface FeatureCost {
  featureKey: string;
  tokenCost: number;
  displayName: string;
  description: string | null;
  isActive: boolean;
}

export default function AdminPricingPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [featureCosts, setFeatureCosts] = useState<FeatureCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch feature costs
  const fetchFeatureCosts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/feature-costs');
      
      if (res.status === 401 || res.status === 403) {
        router.push('/');
        return;
      }
      
      if (!res.ok) {
        throw new Error('Failed to fetch feature costs');
      }
      
      const data = await res.json();
      setFeatureCosts(data.featureCosts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount only - fetchFeatureCosts is stable
   
  useEffect(() => {
    fetchFeatureCosts();
  }, []);

  // Start editing a feature cost
  const startEditing = (featureKey: string, currentCost: number) => {
    setEditingKey(featureKey);
    setEditValue(currentCost);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingKey(null);
    setEditValue(0);
  };

  // Save edited cost
  const saveCost = async (featureKey: string) => {
    if (editValue < 0) {
      alert('Token cost cannot be negative');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/feature-costs/${featureKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenCost: editValue }),
      });

      if (!res.ok) {
        throw new Error('Failed to update cost');
      }

      // Update local state
      setFeatureCosts((prev) =>
        prev.map((fc) =>
          fc.featureKey === featureKey ? { ...fc, tokenCost: editValue } : fc
        )
      );
      setEditingKey(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle feature active status
  const toggleActive = async (featureKey: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/feature-costs/${featureKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) {
        throw new Error('Failed to toggle status');
      }

      // Update local state
      setFeatureCosts((prev) =>
        prev.map((fc) =>
          fc.featureKey === featureKey ? { ...fc, isActive: !currentActive } : fc
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle');
    }
  };

  return (
    <div className="min-h-screen bg-grimlog-black text-grimlog-light-steel">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-grimlog-black border-b border-grimlog-steel/30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-grimlog-steel hover:text-grimlog-orange transition-colors"
            >
              ←
            </button>
            <h1 className="text-grimlog-orange font-bold tracking-wider uppercase flex items-center gap-2">
              <span>⬢</span> TOKEN PRICING
            </h1>
          </div>
          <HamburgerMenu
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onToggle={() => setIsMenuOpen(!isMenuOpen)}
            showReturnToBattle
          />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Description */}
        <div className="mb-6 p-4 bg-grimlog-darkGray border border-grimlog-steel/30 rounded">
          <p className="text-grimlog-steel text-sm">
            Manage token costs for features. Changes take effect immediately without redeploying.
            Use this to adjust pricing based on API costs.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-pulse text-grimlog-amber text-xl">⬢</div>
            <p className="text-grimlog-steel mt-2">Loading feature costs...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-grimlog-red/10 border border-grimlog-red/50 rounded text-grimlog-red">
            {error}
          </div>
        )}

        {/* Feature Costs Table */}
        {!isLoading && !error && (
          <div className="space-y-4">
            {featureCosts.map((fc) => (
              <div
                key={fc.featureKey}
                className={`
                  p-4 bg-grimlog-darkGray border rounded transition-all
                  ${fc.isActive 
                    ? 'border-grimlog-steel/50' 
                    : 'border-grimlog-red/30 opacity-60'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Feature Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-grimlog-amber font-bold">
                        {fc.displayName}
                      </span>
                      {!fc.isActive && (
                        <span className="text-[10px] bg-grimlog-red/20 text-grimlog-red px-2 py-0.5 rounded uppercase">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-grimlog-steel text-sm mb-2">
                      {fc.description || 'No description'}
                    </p>
                    <code className="text-[10px] text-grimlog-steel/50 bg-grimlog-black/40 px-2 py-1 rounded">
                      {fc.featureKey}
                    </code>
                  </div>

                  {/* Token Cost */}
                  <div className="text-right">
                    {editingKey === fc.featureKey ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-grimlog-black border border-grimlog-amber/50 rounded text-grimlog-amber text-right font-mono"
                          autoFocus
                        />
                        <button
                          onClick={() => saveCost(fc.featureKey)}
                          disabled={isSaving}
                          className="px-2 py-1 bg-grimlog-green/20 text-grimlog-green border border-grimlog-green/50 rounded text-xs hover:bg-grimlog-green/30 disabled:opacity-50"
                        >
                          {isSaving ? '...' : '✓'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-2 py-1 bg-grimlog-red/20 text-grimlog-red border border-grimlog-red/50 rounded text-xs hover:bg-grimlog-red/30"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(fc.featureKey, fc.tokenCost)}
                        className="group"
                      >
                        <div className="text-grimlog-amber font-bold text-2xl font-mono flex items-center gap-1 group-hover:text-grimlog-orange transition-colors">
                          <span className="text-sm">⬢</span>
                          {fc.tokenCost}
                        </div>
                        <div className="text-grimlog-steel text-[10px] group-hover:text-grimlog-orange transition-colors">
                          Click to edit
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-grimlog-steel/20 flex items-center justify-between">
                  <div className="text-grimlog-steel text-xs">
                    ~${(fc.tokenCost * 0.15).toFixed(2)} - ${(fc.tokenCost * 0.20).toFixed(2)} user cost
                  </div>
                  <button
                    onClick={() => toggleActive(fc.featureKey, fc.isActive)}
                    className={`
                      px-3 py-1 rounded text-xs font-bold uppercase transition-all
                      ${fc.isActive
                        ? 'bg-grimlog-red/10 text-grimlog-red border border-grimlog-red/30 hover:bg-grimlog-red/20'
                        : 'bg-grimlog-green/10 text-grimlog-green border border-grimlog-green/30 hover:bg-grimlog-green/20'
                      }
                    `}
                  >
                    {fc.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}

            {featureCosts.length === 0 && (
              <div className="text-center py-12 text-grimlog-steel">
                No feature costs configured.
              </div>
            )}
          </div>
        )}

        {/* Pricing Guide */}
        <div className="mt-8 p-4 bg-grimlog-black/40 border border-grimlog-steel/20 rounded">
          <h3 className="text-grimlog-amber font-bold uppercase mb-3">Margin Guide</h3>
          <div className="text-grimlog-steel text-sm space-y-2">
            <p>
              <strong>Token Value:</strong> 1 Token ≈ $0.15 - $0.20 (retail)
            </p>
            <p>
              <strong>Cost Basis:</strong> 1 Token ≈ $0.05 - $0.10 (API cost)
            </p>
            <p className="text-grimlog-green">
              <strong>Rule of Thumb:</strong> Set cost to 3x your API cost to maintain healthy margins.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
