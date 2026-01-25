'use client';

/**
 * Smart Health Display Component
 * 
 * Adapts display based on unit type:
 * - Single model with many wounds: Shows wounds prominently
 * - Multiple models with few wounds: Shows model count prominently
 * - Multiple models with many wounds each: Shows both
 */

interface UnitHealthDisplayProps {
  currentModels: number;
  startingModels: number;
  currentWounds: number | null;
  startingWounds: number | null;
  isDestroyed: boolean;
  owner: 'attacker' | 'defender';
  compact?: boolean;
}

export default function UnitHealthDisplay({
  currentModels,
  startingModels,
  currentWounds,
  startingWounds,
  isDestroyed,
  owner,
  compact = false
}: UnitHealthDisplayProps) {
  // Determine unit type and what to emphasize
  const isSingleModel = startingModels === 1;
  const hasMultipleWounds = startingWounds && startingWounds > startingModels;
  const woundsPerModel = startingWounds && startingModels > 0 ? startingWounds / startingModels : 1;
  
  // Calculate health percentages
  const modelPercent = startingModels > 0 ? (currentModels / startingModels) * 100 : 0;
  const woundPercent = startingWounds && startingWounds > 0 
    ? ((currentWounds || 0) / startingWounds) * 100 
    : 100;
  
  // Choose which metric to display primarily
  const primaryMetric = hasMultipleWounds ? 'wounds' : 'models';
  
  const ownerColor = owner === 'attacker' ? 'text-grimlog-green' : 'text-grimlog-orange';
  
  const getHealthColor = (percent: number) => {
    if (isDestroyed || percent === 0) return 'bg-grimlog-steel';
    if (percent > 66) return 'bg-grimlog-green';
    if (percent > 33) return 'bg-grimlog-amber';
    return 'bg-grimlog-red';
  };
  
  // Compact mode: Single line display
  if (compact) {
    if (isSingleModel && hasMultipleWounds) {
      // Single model, many wounds - show wounds
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-grimlog-black border border-grimlog-steel overflow-hidden">
            <div 
              className={`h-full ${getHealthColor(woundPercent)} transition-all duration-300`}
              style={{ width: `${woundPercent}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${ownerColor} whitespace-nowrap`}>
            {currentWounds || 0}/{startingWounds}W
          </span>
        </div>
      );
    } else {
      // Multiple models or single model few wounds - show models
      return (
        <div className="flex items-center gap-2">
          {/* Visual model indicators (pips) */}
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(startingModels, 10) }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 border border-grimlog-steel ${
                  i < currentModels ? getHealthColor(modelPercent) : 'bg-grimlog-black'
                }`}
                title={`Model ${i + 1}`}
              />
            ))}
            {startingModels > 10 && (
              <span className="text-xs text-grimlog-light-steel ml-1">
                +{startingModels - 10}
              </span>
            )}
          </div>
          <span className={`text-xs font-bold ${ownerColor} whitespace-nowrap`}>
            {currentModels}/{startingModels}
          </span>
        </div>
      );
    }
  }
  
  // Medium mode: Full display with bars
  return (
    <div className="space-y-2">
      {/* Primary metric (models for infantry, wounds for single-model units) */}
      {primaryMetric === 'models' ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-grimlog-light-steel font-mono">MODELS</span>
            <span className={`text-sm font-bold ${ownerColor}`}>
              {currentModels} / {startingModels}
            </span>
          </div>
          <div className="w-full h-3 bg-grimlog-black border border-grimlog-steel overflow-hidden">
            <div 
              className={`h-full ${getHealthColor(modelPercent)} transition-all duration-300`}
              style={{ width: `${modelPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-grimlog-light-steel font-mono">WOUNDS</span>
            <span className={`text-sm font-bold ${ownerColor}`}>
              {currentWounds || 0} / {startingWounds}
            </span>
          </div>
          <div className="w-full h-3 bg-grimlog-black border border-grimlog-steel overflow-hidden">
            <div 
              className={`h-full ${getHealthColor(woundPercent)} transition-all duration-300`}
              style={{ width: `${woundPercent}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Secondary metric if relevant */}
      {hasMultipleWounds && !isSingleModel && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-grimlog-light-steel font-mono">
              {primaryMetric === 'models' ? 'TOTAL WOUNDS' : 'MODELS'}
            </span>
            <span className={`text-xs font-bold ${ownerColor}`}>
              {primaryMetric === 'models' 
                ? `${currentWounds || 0} / ${startingWounds}`
                : `${currentModels} / ${startingModels}`
              }
            </span>
          </div>
          <div className="w-full h-2 bg-grimlog-black border border-grimlog-steel overflow-hidden">
            <div 
              className={`h-full ${
                primaryMetric === 'models' 
                  ? getHealthColor(woundPercent)
                  : getHealthColor(modelPercent)
              } transition-all duration-300`}
              style={{ 
                width: `${primaryMetric === 'models' ? woundPercent : modelPercent}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
