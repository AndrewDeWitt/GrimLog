'use client';

interface CompactAudioStatusProps {
  status: 'idle' | 'listening' | 'processing';
}

export default function CompactAudioStatus({ status }: CompactAudioStatusProps) {
  const statusConfig = {
    idle: {
      color: 'bg-grimlog-steel',
      text: 'INACTIVE',
      textColor: 'text-grimlog-steel',
      label: 'Audio capture inactive'
    },
    listening: {
      color: 'bg-grimlog-green',
      text: 'ACTIVE',
      textColor: 'text-grimlog-green',
      label: 'Audio capture active',
      pulse: true
    },
    processing: {
      color: 'bg-grimlog-orange',
      text: 'PROCESSING',
      textColor: 'text-grimlog-orange',
      label: 'Processing audio',
      pulse: true
    }
  };
  
  const config = statusConfig[status];
  
  return (
    <div 
      className="flex items-center gap-2"
      role="status"
      aria-label={config.label}
    >
      <div 
        className={`
          w-2 h-2 rounded-full ${config.color}
          ${'pulse' in config && config.pulse ? 'animate-pulse' : ''}
        `}
        aria-hidden="true"
      />
    </div>
  );
}
