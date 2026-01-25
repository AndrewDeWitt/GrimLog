'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ 
  message, 
  type, 
  isVisible, 
  onClose, 
  duration = 5000 
}: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  if (!isVisible) return null;

  const styles = {
    success: 'bg-grimlog-player-green-fill border-grimlog-player-green text-grimlog-player-green-text',
    error: 'bg-grimlog-dark-red border-grimlog-red text-grimlog-light-steel',
    warning: 'bg-amber-950 border-grimlog-amber text-grimlog-amber',
    info: 'bg-slate-950 border-slate-600 text-slate-300'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-20 right-4 z-50 max-w-md w-full md:w-auto animate-slide-up`}
    >
      <div className={`${styles[type]} border-2 px-4 py-3 shadow-lg flex items-start gap-3`}>
        <span className="text-xl flex-shrink-0" aria-hidden="true">
          {icons[type]}
        </span>
        <p className="text-base font-mono flex-1 leading-relaxed">
          {message}
        </p>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-lg hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 focus:ring-offset-grimlog-black"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

