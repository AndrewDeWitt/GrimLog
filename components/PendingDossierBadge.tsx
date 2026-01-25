'use client';

/**
 * PendingDossierBadge
 *
 * Shows a badge in the header for dossier status:
 * - While generating: Shows "X Generating" (amber, spinning)
 * - When completed: Shows "Ready!" (green, checkmark) - clickable to go to dossier
 * - When failed: Shows "Failed" (red)
 */

import { useRouter } from 'next/navigation';
import { useDossierNotifications } from '@/lib/dossier/DossierNotificationContext';

export default function PendingDossierBadge() {
  const router = useRouter();
  const {
    pendingCount,
    recentlyCompleted,
    recentlyFailed,
    clearCompletedNotification,
    clearFailedNotification,
  } = useDossierNotifications();

  // Priority: pending > completed > failed
  // Show generating state if any pending
  if (pendingCount > 0) {
    return (
      <button
        onClick={() => router.push('/dossier/gallery')}
        className="relative flex items-center gap-2 px-3 py-1.5 bg-grimlog-amber/20 border border-grimlog-amber/50 text-grimlog-amber text-xs font-mono uppercase tracking-wider hover:bg-grimlog-amber/30 transition-colors"
        title={`${pendingCount} dossier${pendingCount > 1 ? 's' : ''} generating`}
      >
        {/* Spinning indicator */}
        <span className="animate-spin text-sm">&#9678;</span>
        {/* Count */}
        <span>{pendingCount} Generating</span>
      </button>
    );
  }

  // Show completed state if any recently completed
  if (recentlyCompleted.length > 0) {
    const latestCompleted = recentlyCompleted[0];

    const handleClick = () => {
      // Clear the notification and navigate to the dossier
      clearCompletedNotification(latestCompleted.id);
      router.push(`/dossier/${latestCompleted.id}`);
    };

    return (
      <button
        onClick={handleClick}
        className="relative flex items-center gap-2 px-3 py-1.5 bg-grimlog-dark-green/30 border border-grimlog-green text-grimlog-green text-xs font-mono uppercase tracking-wider hover:bg-grimlog-dark-green/50 transition-colors animate-pulse"
        title={`${latestCompleted.faction || 'Dossier'} ready! Click to view.`}
      >
        {/* Checkmark */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {/* Text */}
        <span>Ready!</span>
        {/* Badge count if more than one */}
        {recentlyCompleted.length > 1 && (
          <span className="ml-1 px-1.5 py-0.5 bg-grimlog-dark-green rounded-full text-[10px] text-white">
            +{recentlyCompleted.length - 1}
          </span>
        )}
      </button>
    );
  }

  // Show failed state if any recently failed
  if (recentlyFailed.length > 0) {
    const latestFailed = recentlyFailed[0];

    const handleClick = () => {
      // Clear the notification and navigate to dossier page to retry
      clearFailedNotification(latestFailed.id);
      router.push('/dossier');
    };

    return (
      <button
        onClick={handleClick}
        className="relative flex items-center gap-2 px-3 py-1.5 bg-grimlog-dark-red border border-grimlog-red text-grimlog-light-steel text-xs font-mono uppercase tracking-wider hover:bg-grimlog-dark-red/80 transition-colors"
        title={`Dossier failed: ${latestFailed.errorMessage || 'Unknown error'}`}
      >
        {/* X icon */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        {/* Text */}
        <span>Failed</span>
      </button>
    );
  }

  // Nothing to show
  return null;
}
