'use client';

import { useEffect } from 'react';
import { ValidationResult, ValidationSeverity } from '@/lib/types';

interface ValidationToastProps {
  validation: ValidationResult;
  toolName: string;
  toolMessage: string;
  isVisible: boolean;
  onClose: () => void;
  onOverride?: () => void;
  duration?: number;
}

export default function ValidationToast({ 
  validation,
  toolName,
  toolMessage,
  isVisible, 
  onClose, 
  onOverride,
  duration = 10000 // Longer duration for validation messages
}: ValidationToastProps) {
  useEffect(() => {
    // Only auto-close for info/warning that don't require override
    if (isVisible && !validation.requiresOverride) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration, validation.requiresOverride]);

  if (!isVisible) return null;

  // High contrast color schemes for better readability
  const severityStyles: Record<ValidationSeverity, { bg: string, border: string, header: string, text: string }> = {
    valid: { 
      bg: 'bg-green-900', 
      border: 'border-green-400', 
      header: 'bg-green-400 text-green-950',
      text: 'text-white'
    },
    info: { 
      bg: 'bg-blue-900', 
      border: 'border-blue-400', 
      header: 'bg-blue-400 text-blue-950',
      text: 'text-white'
    },
    warning: { 
      bg: 'bg-amber-900', 
      border: 'border-amber-400', 
      header: 'bg-amber-400 text-amber-950',
      text: 'text-white'
    },
    error: { 
      bg: 'bg-red-900', 
      border: 'border-red-400', 
      header: 'bg-red-500 text-white',
      text: 'text-white'
    },
    critical: { 
      bg: 'bg-red-950', 
      border: 'border-red-500', 
      header: 'bg-red-600 text-white',
      text: 'text-white'
    }
  };

  const severityIcons: Record<ValidationSeverity, string> = {
    valid: '✓',
    info: 'ℹ',
    warning: '⚠',
    error: '✕',
    critical: '🚨'
  };

  const severityLabels: Record<ValidationSeverity, string> = {
    valid: 'VALID',
    info: 'INFO',
    warning: 'WARNING',
    error: 'ERROR',
    critical: 'CRITICAL ERROR'
  };
  
  const styles = severityStyles[validation.severity];

  return (
    <div
      role="alert"
      aria-live={validation.severity === 'critical' || validation.severity === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="w-full animate-slide-up"
    >
      <div className={`${styles.bg} ${styles.border} border-2 shadow-2xl overflow-hidden`}>
        {/* Header Bar - High Contrast */}
        <div className={`${styles.header} px-4 py-3 flex items-center gap-3`}>
          <span className="text-2xl flex-shrink-0" aria-hidden="true">
            {severityIcons[validation.severity]}
          </span>
          <div className="flex-1">
            <div className="text-xs font-bold tracking-widest mb-0.5">
              {severityLabels[validation.severity]}
            </div>
            <div className="text-sm font-bold tracking-wide">
              {toolName.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-xl font-bold hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>

        {/* Content - White text on dark background */}
        <div className={`${styles.text} px-4 py-4 space-y-3`}>
          {/* Main Message */}
          <p className="text-base font-semibold leading-relaxed">
            {validation.message}
          </p>
          
          {/* Rule */}
          {validation.rule && (
            <div className="bg-black/20 px-3 py-2 rounded border border-white/10">
              <p className="text-xs font-mono">
                <span className="opacity-70">Rule:</span> <span className="font-bold">{validation.rule}</span>
              </p>
            </div>
          )}

          {/* Suggestion */}
          {validation.suggestion && (
            <div className="bg-black/20 px-3 py-2 rounded border border-white/10">
              <p className="text-sm leading-relaxed">
                💡 {validation.suggestion}
              </p>
            </div>
          )}

          {/* Action Executed */}
          <div className="pt-2 border-t border-white/20">
            <p className="text-xs opacity-70">
              <span className="font-bold">Action executed:</span> {toolMessage}
            </p>
          </div>

          {/* Override Buttons */}
          {validation.requiresOverride && onOverride && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={onOverride}
                className="flex-1 px-4 py-2.5 text-sm font-bold tracking-wider bg-white/20 hover:bg-white/30 transition-colors border-2 border-white/40 rounded focus:outline-none focus:ring-2 focus:ring-white"
              >
                OVERRIDE & ACCEPT
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-bold tracking-wider bg-black/30 hover:bg-black/40 transition-colors border-2 border-white/30 rounded focus:outline-none focus:ring-2 focus:ring-white"
              >
                DISMISS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

