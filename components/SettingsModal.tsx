'use client';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Audio settings
  audioStatus: 'idle' | 'listening' | 'processing';
  audioLevel: number;
  threshold: number;
  calibrationMargin: number;
  noiseFloor: number;
  isCalibrating: boolean;
  onCalibrate: () => void;
  onMarginChange: (margin: number) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  audioStatus,
  audioLevel,
  threshold,
  calibrationMargin,
  noiseFloor,
  isCalibrating,
  onCalibrate,
  onMarginChange,
}: SettingsModalProps) {
  if (!isOpen) return null;

  // Calculate level percentage for visualization (normalize -60dB to 0dB range)
  const minDB = -60;
  const maxDB = 0;
  const levelPercent = Math.max(0, Math.min(100, ((audioLevel - minDB) / (maxDB - minDB)) * 100));
  const thresholdPercent = Math.max(0, Math.min(100, ((threshold - minDB) / (maxDB - minDB)) * 100));
  
  // Determine if audio is above threshold
  const isAboveThreshold = audioLevel > threshold;
  
  // Color based on level
  const getLevelColor = () => {
    if (isAboveThreshold) return 'bg-green-500';
    if (levelPercent > 50) return 'bg-amber-500';
    return 'bg-gray-400';
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-2xl mx-auto max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 bg-grimlog-slate-dark border-b border-grimlog-steel flex items-center justify-between flex-shrink-0">
          <h2 className="text-gray-900 text-xl font-bold tracking-wider uppercase flex items-center gap-2">
            <span>⚙</span> Audio Settings
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg text-2xl font-bold transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-grimlog-slate-light">
          {/* Audio Status */}
          <div className="space-y-2">
            <h3 className="text-grimlog-orange text-sm font-bold tracking-wider uppercase border-b border-gray-300 pb-2">
              Audio Monitor Status
            </h3>
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded-lg">
              <div className={`
                w-3 h-3 rounded-full
                ${audioStatus === 'idle' ? 'bg-gray-400' : ''}
                ${audioStatus === 'listening' ? 'bg-green-500 pulse-animation' : ''}
                ${audioStatus === 'processing' ? 'bg-amber-500 pulse-animation' : ''}
              `}></div>
              <span className="text-gray-900 font-bold tracking-wider uppercase text-sm">
                {isCalibrating ? 'CALIBRATING' : audioStatus.toUpperCase()}
              </span>
            </div>
            {isCalibrating && (
              <p className="text-gray-600 text-xs font-mono italic">
                Please remain quiet for 3 seconds...
              </p>
            )}
          </div>

          {/* Audio Level Meter */}
          {audioStatus !== 'idle' && (
            <div className="space-y-3">
              <h3 className="text-grimlog-orange text-sm font-bold tracking-wider uppercase border-b border-gray-300 pb-2">
                Audio Level Monitor
              </h3>
              
              <div className="p-4 bg-white border border-gray-300 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-600 uppercase">Current Level</span>
                  <span className={`${isAboveThreshold ? 'text-green-600' : 'text-gray-600'}`}>
                    {audioLevel > -100 ? `${audioLevel.toFixed(1)}dB` : '--'}
                  </span>
                </div>
                
                {/* Level bar */}
                <div className="relative h-8 bg-gray-200 border border-gray-300 rounded overflow-hidden">
                  {/* Current level */}
                  <div 
                    className={`absolute left-0 top-0 h-full transition-all duration-100 ${getLevelColor()}`}
                    style={{ width: `${levelPercent}%` }}
                  />
                  
                  {/* Threshold line */}
                  <div 
                    className="absolute top-0 h-full w-0.5 bg-grimlog-orange z-10"
                    style={{ left: `${thresholdPercent}%` }}
                  >
                    <div className="absolute left-1/2 -translate-x-1/2 -top-5 text-grimlog-orange text-xs font-mono whitespace-nowrap">
                      ▼
                    </div>
                  </div>
                  
                  {/* Grid lines */}
                  {[25, 50, 75].map(percent => (
                    <div 
                      key={percent}
                      className="absolute top-0 h-full w-px bg-gray-400 opacity-30"
                      style={{ left: `${percent}%` }}
                    />
                  ))}
                </div>
                
                <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                  <span>-60dB</span>
                  <span>Threshold: {threshold.toFixed(1)}dB</span>
                  <span>0dB</span>
                </div>

                <div className="p-2 bg-gray-100 border border-gray-300 rounded">
                  <p className="text-gray-600 text-xs font-mono">
                    💡 <span className="text-grimlog-orange font-semibold">Speak normally</span> - the bar should turn <span className="text-green-600 font-semibold">green</span> and cross the threshold line.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Calibration Section */}
          {audioStatus !== 'idle' && (
            <div className="space-y-3">
              <h3 className="text-grimlog-orange text-sm font-bold tracking-wider uppercase border-b border-gray-300 pb-2">
                Microphone Calibration
              </h3>
              
              <div className="p-4 bg-white border border-gray-300 rounded-lg space-y-3">
                {/* Calibration info */}
                {noiseFloor > -Infinity && (
                  <div className="p-3 bg-gray-100 border border-gray-300 rounded space-y-2">
                    <div className="flex items-center justify-between text-sm font-mono">
                      <span className="text-gray-600">Noise Floor:</span>
                      <span className="text-green-600">{noiseFloor.toFixed(1)}dB</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-mono">
                      <span className="text-gray-600">Margin:</span>
                      <span className="text-green-600">{calibrationMargin.toFixed(1)}dB</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-mono">
                      <span className="text-gray-600">Threshold:</span>
                      <span className="text-grimlog-orange">{threshold.toFixed(1)}dB</span>
                    </div>
                  </div>
                )}
                
                {/* Sensitivity adjustment */}
                {noiseFloor > -Infinity && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 text-sm font-mono uppercase">Sensitivity</span>
                      <span className="text-grimlog-orange text-lg font-bold font-mono">{calibrationMargin.toFixed(0)}dB</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => onMarginChange(Math.max(3, calibrationMargin - 1))}
                        disabled={isCalibrating || audioStatus === 'processing' || calibrationMargin <= 3}
                        className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 
                                 hover:bg-gray-100 hover:border-grimlog-orange transition-colors
                                 disabled:opacity-30 disabled:cursor-not-allowed
                                 font-mono text-sm font-bold uppercase tracking-wider rounded-lg"
                        title="More sensitive (lower margin)"
                      >
                        ← Less Margin
                      </button>
                      <button
                        onClick={() => onMarginChange(Math.min(20, calibrationMargin + 1))}
                        disabled={isCalibrating || audioStatus === 'processing' || calibrationMargin >= 20}
                        className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 
                                 hover:bg-gray-100 hover:border-grimlog-orange transition-colors
                                 disabled:opacity-30 disabled:cursor-not-allowed
                                 font-mono text-sm font-bold uppercase tracking-wider rounded-lg"
                        title="Less sensitive (higher margin)"
                      >
                        More Margin →
                      </button>
                    </div>
                    <div className="p-2 bg-gray-100 border border-gray-300 rounded">
                      <p className="text-xs font-mono text-center text-gray-600">
                        {calibrationMargin <= 5 ? '⚠ Very sensitive - may trigger on background noise' : 
                         calibrationMargin >= 15 ? '⚠ Less sensitive - may miss quiet speech' : 
                         '✓ Balanced sensitivity'}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Calibration button */}
                <button
                  onClick={onCalibrate}
                  disabled={isCalibrating || audioStatus === 'processing'}
                  className="w-full px-4 py-4 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 
                           disabled:bg-gray-300 disabled:text-gray-500
                           font-bold tracking-wider uppercase text-sm transition-all rounded-lg
                           disabled:cursor-not-allowed"
                >
                  {isCalibrating ? '⏳ Calibrating...' : noiseFloor > -Infinity ? '🔄 Re-Calibrate Microphone' : '🎯 Calibrate Microphone'}
                </button>
                
                {noiseFloor <= -Infinity && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded">
                    <p className="text-amber-800 text-xs font-mono">
                      <strong className="text-grimlog-orange">First time setup:</strong> Calibrate your microphone to measure your room&apos;s noise floor. This ensures optimal voice detection.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {audioStatus === 'idle' && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-amber-800 text-sm font-mono">
                ⚠ Audio capture is not active. Click <strong>START</strong> to enable audio monitoring and access calibration settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-grimlog-slate-dark border-t border-grimlog-steel flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 
                     font-bold tracking-wider uppercase text-sm transition-all rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
