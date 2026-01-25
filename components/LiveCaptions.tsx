'use client';

import { useEffect, useState } from 'react';

interface LiveCaptionsProps {
  interimText: string; // What's currently being said (live)
  finalText: string; // Last completed sentence
  isListening: boolean;
}

export default function LiveCaptions({ interimText, finalText, isListening }: LiveCaptionsProps) {
  const [showFinal, setShowFinal] = useState(true);
  
  // Auto-hide final text after showing it briefly
  useEffect(() => {
    if (finalText) {
      setShowFinal(true);
      const timer = setTimeout(() => {
        setShowFinal(false);
      }, 3000); // Show for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [finalText]);

  // Don't show anything if not listening
  if (!isListening) return null;

  const hasContent = interimText || (finalText && showFinal);
  if (!hasContent) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl z-30 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="bg-black/80 backdrop-blur-sm border border-grimlog-steel rounded px-4 py-2 shadow-2xl">
        {/* Status Indicator */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-grimlog-green animate-pulse" aria-hidden="true" />
          <span className="text-xs text-grimlog-green font-bold tracking-wider uppercase">
            Live Captions
          </span>
        </div>

        {/* Caption Text */}
        <div className="text-white space-y-1">
          {/* Final text (fading out) */}
          {finalText && showFinal && (
            <p 
              className="text-sm md:text-base text-grimlog-green/70 italic animate-fade-out"
              aria-label="Completed text"
            >
              {finalText}
            </p>
          )}

          {/* Interim text (live) */}
          {interimText && (
            <p 
              className="text-sm md:text-base font-semibold"
              aria-label="Current speech"
            >
              {interimText}
              <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse" aria-hidden="true">|</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
