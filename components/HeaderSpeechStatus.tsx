'use client';

import { useEffect, useRef, useState } from 'react';

interface HeaderSpeechStatusProps {
  status: 'idle' | 'listening' | 'processing';
  interimText: string;
  lastFinalText: string;
  history: string[]; // most recent first
}

export default function HeaderSpeechStatus({ status, interimText, lastFinalText, history }: HeaderSpeechStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const config = {
    idle: {
      color: 'bg-grimlog-steel',
      label: 'INACTIVE'
    },
    listening: {
      color: 'bg-grimlog-green',
      label: 'ACTIVE'
    },
    processing: {
      color: 'bg-grimlog-orange',
      label: 'PROCESSING'
    }
  }[status];

  const displayText = interimText || lastFinalText || '';

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 min-w-0" aria-live="polite" aria-atomic="false">
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full ${config.color} ${status !== 'idle' ? 'animate-pulse' : ''}`} aria-hidden="true" />

      {/* Single-line caption (truncated but uses full remaining width) */}
      <div className="flex-1 min-w-0 text-[11px] md:text-sm text-white/80 whitespace-nowrap overflow-hidden text-ellipsis" title={displayText || config.label}>
        {displayText ? `"${displayText}"` : config.label}
      </div>

      {/* Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="px-2 py-1 text-xs text-grimlog-orange border border-grimlog-steel bg-grimlog-gray hover:bg-grimlog-steel focus:outline-none focus:ring-2 focus:ring-grimlog-orange"
        aria-expanded={isOpen}
        aria-controls="speech-history"
        title="Show recent speech"
      >
        {isOpen ? '▲' : '▼'}
      </button>

      {/* Dropdown history */}
      {isOpen && (
        <div
          id="speech-history"
          className="absolute right-0 top-full mt-2 z-50 w-[280px] max-w-[80vw] bg-grimlog-black border-2 border-grimlog-steel shadow-2xl p-3"
          role="dialog"
          aria-label="Recent speech"
        >
          <div className="text-grimlog-green text-xs font-bold tracking-wider uppercase mb-2">Recent Speech</div>
          <ul className="space-y-2">
            {(history && history.length > 0 ? history : (displayText ? [displayText] : [])).slice(0, 5).map((line, idx) => (
              <li key={idx} className="text-white text-sm leading-snug">
                • {line}
              </li>
            ))}
            {(!history || history.length === 0) && !displayText && (
              <li className="text-white/60 text-sm">No recent speech</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}


