'use client';

interface AudioIndicatorProps {
  status: 'idle' | 'listening' | 'processing';
  latestTranscription?: string;
  audioLevel?: number;
  threshold?: number;
  isCalibrating?: boolean;
  onOpenSettings?: () => void;
}

export default function AudioIndicator({ 
  status, 
  latestTranscription,
  audioLevel = -Infinity,
  threshold = -30,
  isCalibrating = false,
  onOpenSettings
}: AudioIndicatorProps) {
  const statusConfig = {
    idle: {
      color: 'bg-grimlog-steel',
      text: 'INACTIVE',
      icon: '○',
      pulse: false,
    },
    listening: {
      color: 'bg-grimlog-green',
      text: 'LISTENING',
      icon: '◉',
      pulse: true,
    },
    processing: {
      color: 'bg-grimlog-amber',
      text: 'PROCESSING',
      icon: '◎',
      pulse: true,
    },
  };

  const config = statusConfig[status];
  
  // Determine if audio is above threshold
  const isAboveThreshold = audioLevel > threshold;

  return (
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      <div className="flex items-center gap-3 flex-1">
        <div className={`
          w-3 h-3 rounded-full ${config.color}
          ${config.pulse ? 'pulse-animation' : ''}
        `}></div>
        <div className="flex items-center gap-2">
          <span className="text-xl text-grimlog-orange">{config.icon}</span>
          <span className="text-grimlog-orange font-bold tracking-wider uppercase text-sm">
            {isCalibrating ? 'CALIBRATING' : config.text}
          </span>
        </div>
        
        {/* Simple level indicator when listening */}
        {status === 'listening' && audioLevel > -100 && (
          <div className="hidden md:flex items-center gap-2 text-xs font-mono">
            <span className="text-grimlog-steel">|</span>
            <span className={`${isAboveThreshold ? 'text-grimlog-green' : 'text-grimlog-steel'}`}>
              {audioLevel.toFixed(0)}dB
            </span>
            {isAboveThreshold && <span className="text-grimlog-green">●</span>}
          </div>
        )}
        
        {/* Latest transcription inline */}
        {latestTranscription && (
          <span className="text-grimlog-green text-xs md:text-sm font-mono truncate hidden lg:block max-w-md">
            &gt; {latestTranscription}
          </span>
        )}
      </div>
      
      {/* Settings button */}
      {onOpenSettings && status !== 'idle' && (
        <button
          onClick={onOpenSettings}
          className="px-3 py-2 bg-grimlog-black border border-grimlog-steel text-grimlog-orange 
                   hover:bg-grimlog-steel hover:border-grimlog-orange transition-colors
                   font-mono text-xs uppercase tracking-wider flex items-center gap-2"
          title="Audio Settings"
        >
          <span>⚙</span>
          <span className="hidden md:inline">Audio</span>
        </button>
      )}
    </div>
  );
}
