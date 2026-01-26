'use client';

import { useState, useEffect } from 'react';

interface BriefShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefId: string | null;
  currentVisibility?: 'private' | 'link' | 'public';
  currentShareToken?: string | null;
  listName?: string | null;
  faction?: string;
}

export function BriefShareModal({
  isOpen,
  onClose,
  briefId,
  currentVisibility = 'private',
  currentShareToken,
  listName,
  faction,
}: BriefShareModalProps) {
  const [visibility, setVisibility] = useState<'private' | 'link' | 'public'>(currentVisibility);
  const [shareToken, setShareToken] = useState<string | null>(currentShareToken || null);
  const [name, setName] = useState(listName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setVisibility(currentVisibility);
      setShareToken(currentShareToken || null);
      setName(listName || '');
      setError(null);
      setCopied(false);
    }
  }, [isOpen, currentVisibility, currentShareToken, listName]);

  if (!isOpen || !briefId) return null;

  const shareUrl = shareToken 
    ? `${window.location.origin}/brief/share/${shareToken}`
    : null;

  const handleSave = async () => {
    if (!briefId) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility,
          listName: name.trim() || null,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update');
      }
      
      const updated = await response.json();
      setShareToken(updated.shareToken);
      
      // If making shareable, show the copy URL state
      if ((visibility === 'link' || visibility === 'public') && updated.shareToken) {
        // Keep modal open to show share URL
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTwitter = () => {
    if (!shareUrl) return;
    const text = `Check out my ${faction || ''} Tactical Brief!`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-grimlog-darkGray border-2 border-grimlog-steel rounded-lg max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-grimlog-black p-4 border-b border-grimlog-steel flex items-center justify-between">
          <h2 className="text-grimlog-orange font-bold uppercase tracking-wider">
            Share Brief
          </h2>
          <button
            onClick={onClose}
            className="text-grimlog-steel hover:text-grimlog-amber transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* List Name */}
          <div>
            <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
              List Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g., "${faction} Tournament List"`}
              className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-3 font-mono text-sm focus:outline-none focus:border-grimlog-orange"
            />
          </div>

          {/* Visibility Options */}
          <div>
            <label className="block text-grimlog-orange text-sm font-bold mb-3 uppercase tracking-wider">
              Visibility
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-grimlog-black border border-grimlog-steel rounded cursor-pointer hover:border-grimlog-amber transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  className="accent-grimlog-orange"
                />
                <div>
                  <span className="text-grimlog-light-steel font-bold">🔒 Private</span>
                  <p className="text-grimlog-steel text-xs mt-0.5">Only you can view this brief</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-grimlog-black border border-grimlog-steel rounded cursor-pointer hover:border-grimlog-amber transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="link"
                  checked={visibility === 'link'}
                  onChange={() => setVisibility('link')}
                  className="accent-grimlog-orange"
                />
                <div>
                  <span className="text-grimlog-light-steel font-bold">🔗 Link Sharing</span>
                  <p className="text-grimlog-steel text-xs mt-0.5">Anyone with the link can view</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-grimlog-black border border-grimlog-steel rounded cursor-pointer hover:border-grimlog-amber transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                  className="accent-grimlog-orange"
                />
                <div>
                  <span className="text-grimlog-light-steel font-bold">🌐 Public Gallery</span>
                  <p className="text-grimlog-steel text-xs mt-0.5">Listed in public gallery for everyone</p>
                </div>
              </label>
            </div>
          </div>

          {/* Share URL (if available) */}
          {shareUrl && (visibility === 'link' || visibility === 'public') && (
            <div>
              <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
                Share URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-grimlog-black border border-grimlog-steel text-grimlog-green p-3 font-mono text-xs focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 font-bold uppercase text-sm transition-all ${
                    copied
                      ? 'bg-grimlog-green text-grimlog-black'
                      : 'bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black'
                  }`}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              
              {/* Social Share Buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleShareTwitter}
                  className="flex-1 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-bold uppercase text-xs tracking-wider transition-colors rounded"
                >
                  Share on X/Twitter
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-grimlog-red/20 border border-grimlog-red text-grimlog-red text-sm rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-grimlog-steel text-grimlog-light-steel hover:border-grimlog-amber hover:text-grimlog-amber font-bold uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save & Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BriefShareModal;

