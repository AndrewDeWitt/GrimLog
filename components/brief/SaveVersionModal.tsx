'use client';

import { useState } from 'react';

interface SaveVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (versionLabel: string, changelog: string) => void;
  isSaving: boolean;
}

/**
 * SaveVersionModal - Modal for creating a named version snapshot
 */
export function SaveVersionModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
}: SaveVersionModalProps) {
  const [versionLabel, setVersionLabel] = useState('');
  const [changelog, setChangelog] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(versionLabel.trim(), changelog.trim());
    setVersionLabel('');
    setChangelog('');
  };

  const handleClose = () => {
    setVersionLabel('');
    setChangelog('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-grimlog-darkGray border-2 border-grimlog-steel rounded-lg max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-grimlog-black p-4 border-b border-grimlog-steel flex items-center justify-between">
          <h2 className="text-grimlog-orange font-bold uppercase tracking-wider">
            Save Version
          </h2>
          <button
            onClick={handleClose}
            className="text-grimlog-steel hover:text-grimlog-amber transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Version Label */}
          <div>
            <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
              Version Label (Optional)
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder='e.g., "Pre-tournament tweaks", "v1.2"'
              className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-3 font-mono text-sm focus:outline-none focus:border-grimlog-orange"
            />
            <p className="text-grimlog-steel text-xs mt-1">
              Give this version a memorable name to find it later
            </p>
          </div>

          {/* Changelog */}
          <div>
            <label className="block text-grimlog-orange text-sm font-bold mb-2 uppercase tracking-wider">
              What Changed? (Optional)
            </label>
            <textarea
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Describe what you changed in this version..."
              rows={3}
              className="w-full bg-grimlog-black border border-grimlog-steel text-grimlog-green p-3 font-mono text-sm focus:outline-none focus:border-grimlog-orange resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-grimlog-steel text-grimlog-light-steel hover:border-grimlog-amber hover:text-grimlog-amber font-bold uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Version'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveVersionModal;
