'use client';

import { useState, useEffect } from 'react';

type Visibility = 'private' | 'link' | 'public';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'datasheet' | 'army';
  itemId: string;
  itemName: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  type,
  itemId,
  itemName,
}: ShareModalProps) {
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentSettings();
    }
  }, [isOpen, itemId]);

  const fetchCurrentSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === 'datasheet' 
        ? `/api/datasheets/detail/${itemId}/share`
        : `/api/armies/${itemId}/share`;
        
      const res = await fetch(endpoint);
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please sign in to manage sharing settings');
        }
        throw new Error('Failed to load sharing settings');
      }
      
      const data = await res.json();
      setVisibility(data.visibility);
      setShareUrl(data.shareUrl);
      setShareToken(data.shareToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateVisibility = async (newVisibility: Visibility) => {
    setSaving(true);
    setError(null);
    
    try {
      const endpoint = type === 'datasheet' 
        ? `/api/datasheets/detail/${itemId}/share`
        : `/api/armies/${itemId}/share`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update sharing settings');
      }

      const data = await res.json();
      setVisibility(data.visibility);
      setShareUrl(data.shareUrl);
      setShareToken(data.shareToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" onClick={onClose} />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-md mx-auto rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel rounded-t-2xl">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="border-b border-grimlog-steel p-4 flex justify-between items-center bg-grimlog-slate-dark">
          <h2 className="text-lg font-bold text-gray-900">SHARE {type.toUpperCase()}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 bg-grimlog-slate-light">
          {loading ? (
            <p className="text-gray-500 text-center py-8">Loading...</p>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchCurrentSettings}
                className="px-4 py-2 bg-grimlog-orange text-gray-900 hover:bg-grimlog-amber rounded-lg font-bold"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Item Name */}
              <div className="p-3 bg-white border border-gray-300 rounded-lg">
                <span className="text-gray-500 text-sm">Sharing:</span>
                <p className="text-gray-900 font-bold">{itemName}</p>
              </div>

              {/* Visibility Options */}
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Visibility</label>
                
                {/* Private */}
                <button
                  onClick={() => updateVisibility('private')}
                  disabled={saving}
                  className={`w-full p-3 border text-left transition-colors rounded-lg ${
                    visibility === 'private'
                      ? 'border-grimlog-orange bg-orange-50'
                      : 'border-gray-300 bg-white hover:border-grimlog-orange/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔒</span>
                    <div>
                      <p className="text-gray-900 font-bold">Private</p>
                      <p className="text-gray-500 text-sm">Only you can access</p>
                    </div>
                    {visibility === 'private' && (
                      <span className="ml-auto text-grimlog-orange">✓</span>
                    )}
                  </div>
                </button>

                {/* Link Sharing */}
                <button
                  onClick={() => updateVisibility('link')}
                  disabled={saving}
                  className={`w-full p-3 border text-left transition-colors rounded-lg ${
                    visibility === 'link'
                      ? 'border-grimlog-orange bg-orange-50'
                      : 'border-gray-300 bg-white hover:border-grimlog-orange/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔗</span>
                    <div>
                      <p className="text-gray-900 font-bold">Anyone with the link</p>
                      <p className="text-gray-500 text-sm">Share via URL</p>
                    </div>
                    {visibility === 'link' && (
                      <span className="ml-auto text-grimlog-orange">✓</span>
                    )}
                  </div>
                </button>

                {/* Public */}
                <button
                  onClick={() => updateVisibility('public')}
                  disabled={saving}
                  className={`w-full p-3 border text-left transition-colors rounded-lg ${
                    visibility === 'public'
                      ? 'border-grimlog-orange bg-orange-50'
                      : 'border-gray-300 bg-white hover:border-grimlog-orange/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🌍</span>
                    <div>
                      <p className="text-gray-900 font-bold">Public</p>
                      <p className="text-gray-500 text-sm">Listed in public library</p>
                    </div>
                    {visibility === 'public' && (
                      <span className="ml-auto text-grimlog-orange">✓</span>
                    )}
                  </div>
                </button>
              </div>

              {/* Share Link */}
              {(visibility === 'link' || visibility === 'public') && shareUrl && (
                <div className="mt-4">
                  <label className="text-sm text-gray-600 mb-2 block">Share Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-800 text-sm font-mono rounded-lg"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`px-4 py-2 font-bold transition-colors rounded-lg ${
                        copied
                          ? 'bg-green-500 text-white'
                          : 'bg-grimlog-orange text-gray-900 hover:bg-grimlog-amber'
                      }`}
                    >
                      {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {saving && (
                <p className="text-gray-500 text-sm text-center">Updating...</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-grimlog-steel p-4 bg-grimlog-slate-dark">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 font-bold rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
