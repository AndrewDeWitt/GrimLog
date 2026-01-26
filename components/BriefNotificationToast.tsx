'use client';

/**
 * BriefNotificationToast
 *
 * Shows toast notifications when briefs complete or fail.
 * Clickable to navigate to the completed brief.
 *
 * Important: Auto-hide only hides the toast visually. The badge will still
 * show "Ready!" until the user explicitly clicks it. Only explicit user
 * actions (clicking to view, or clicking X) will persist the dismissal.
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBriefNotifications, CompletedBrief, FailedBrief } from '@/lib/brief/BriefNotificationContext';

const TOAST_DURATION = 10000; // 10 seconds before auto-hide (not dismiss)

export default function BriefNotificationToast() {
  const router = useRouter();
  const {
    recentlyCompleted,
    recentlyFailed,
    clearCompletedNotification,
    clearFailedNotification,
  } = useBriefNotifications();

  // Track which notifications we've already auto-hidden (to not show them again)
  // This is visual-only - doesn't persist to database
  const autoHiddenIdsRef = useRef<Set<string>>(new Set());

  // Get the most recent notifications (only show one at a time)
  // Filter out ones we've already auto-hidden
  const latestCompleted = recentlyCompleted.find(d => !autoHiddenIdsRef.current.has(d.id));
  const latestFailed = recentlyFailed.find(d => !autoHiddenIdsRef.current.has(d.id));

  // Prioritize showing failures over completions
  const [currentNotification, setCurrentNotification] = useState<{
    type: 'completed' | 'failed';
    brief: CompletedBrief | FailedBrief;
  } | null>(null);

  // Update current notification when new ones arrive
  useEffect(() => {
    if (latestFailed) {
      setCurrentNotification({ type: 'failed', brief: latestFailed });
    } else if (latestCompleted) {
      setCurrentNotification({ type: 'completed', brief: latestCompleted });
    } else {
      setCurrentNotification(null);
    }
  }, [latestFailed, latestCompleted]);

  // Auto-HIDE (not dismiss) for success toasts after timeout
  // This only hides the toast visually - badge still shows "Ready!"
  useEffect(() => {
    if (!currentNotification) return;
    if (currentNotification.type === 'failed') return; // Failed toasts require manual dismiss

    const timer = setTimeout(() => {
      // Just add to auto-hidden set - don't call clearCompletedNotification
      // The badge will still show "Ready!" because we didn't persist to database
      autoHiddenIdsRef.current.add(currentNotification.brief.id);
      setCurrentNotification(null);
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [currentNotification]);

  if (!currentNotification) return null;

  const { type, brief } = currentNotification;
  const isSuccess = type === 'completed';

  const handleClick = () => {
    if (isSuccess) {
      clearCompletedNotification(brief.id);
      router.push(`/brief/${brief.id}`);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSuccess) {
      clearCompletedNotification(brief.id);
    } else {
      clearFailedNotification(brief.id);
    }
  };

  const styles = {
    completed: 'bg-grimlog-dark-green/90 border-grimlog-green text-white cursor-pointer hover:bg-grimlog-dark-green',
    failed: 'bg-grimlog-dark-red border-grimlog-red text-grimlog-light-steel',
  };

  const icons = {
    completed: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    failed: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const title = isSuccess ? 'Brief Ready!' : 'Brief Failed';
  const message = isSuccess
    ? `Your ${brief.faction || 'army'} tactical brief is ready. Click to view.`
    : `Failed to generate ${brief.faction || 'army'} brief. ${(brief as FailedBrief).errorMessage || 'Please try again.'}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-20 right-4 z-50 max-w-md w-full md:w-auto animate-slide-up"
    >
      <div
        className={`${styles[type]} border-2 px-4 py-3 shadow-lg transition-colors`}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <span className="flex-shrink-0" aria-hidden="true">
            {icons[type]}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm uppercase tracking-wider mb-1">
              {title}
            </p>
            <p className="text-sm font-mono leading-relaxed">
              {message}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-lg hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 focus:ring-offset-grimlog-black"
            aria-label="Close notification"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
