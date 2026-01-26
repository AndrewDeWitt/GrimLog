'use client';

import { BriefWIPData } from '@/hooks/useBriefAutoSave';

interface WIPRecoveryModalProps {
  isOpen: boolean;
  wipData: BriefWIPData | null;
  currentVersion: number;
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

/**
 * WIPRecoveryModal - Prompts user to restore unsaved changes from localStorage
 */
export function WIPRecoveryModal({
  isOpen,
  wipData,
  currentVersion,
  onRestore,
  onDiscard,
  onClose,
}: WIPRecoveryModalProps) {
  if (!isOpen || !wipData) return null;

  const savedDate = new Date(wipData.savedAt);
  const isOutdated = wipData.baseVersion < currentVersion;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-grimlog-darkGray border-2 border-grimlog-amber rounded-lg max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-grimlog-black p-4 border-b border-grimlog-steel flex items-center gap-3">
          <span className="text-2xl">💾</span>
          <h2 className="text-grimlog-amber font-bold uppercase tracking-wider">
            Unsaved Changes Found
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-300">
            You have unsaved changes from a previous editing session.
          </p>

          <div className="bg-grimlog-black/50 border border-grimlog-steel rounded p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-grimlog-steel">Last saved:</span>
              <span className="text-grimlog-green font-mono">{formatDate(savedDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-grimlog-steel">Based on version:</span>
              <span className="text-grimlog-green font-mono">v{wipData.baseVersion}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-grimlog-steel">Current version:</span>
              <span className="text-grimlog-green font-mono">v{currentVersion}</span>
            </div>
          </div>

          {isOutdated && (
            <div className="p-3 bg-grimlog-amber/10 border border-grimlog-amber/30 rounded">
              <p className="text-grimlog-amber text-sm">
                <span className="font-bold">Warning:</span> The brief has been updated since
                these changes were saved. Restoring may overwrite newer changes.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-grimlog-steel flex gap-3">
          <button
            onClick={() => {
              onDiscard();
              onClose();
            }}
            className="flex-1 py-3 border border-grimlog-red/50 text-grimlog-red hover:border-grimlog-red hover:bg-grimlog-red/10 font-bold uppercase tracking-wider transition-colors"
          >
            Discard
          </button>
          <button
            onClick={() => {
              onRestore();
              onClose();
            }}
            className="flex-1 py-3 bg-grimlog-amber hover:bg-grimlog-orange text-grimlog-black font-bold uppercase tracking-wider transition-all"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

export default WIPRecoveryModal;
