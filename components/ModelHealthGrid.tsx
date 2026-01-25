'use client';

/**
 * ModelHealthGrid Component
 * 
 * Displays individual model states within a unit with prominent visual design
 * Always visible for multi-wound units to show per-model damage
 * Color-coded wound states: green (healthy), yellow (damaged), red (critical), gray (dead)
 */

interface ModelState {
  role: string;
  currentWounds: number;
  maxWounds: number;
}

interface ModelHealthGridProps {
  models: ModelState[];
  woundsPerModel: number;
  compact?: boolean;
  onModelClick?: (modelIndex: number, model: ModelState) => void;
  onModelWoundChange?: (modelIndex: number, change: number) => void;
  onModelDestroy?: (modelIndex: number) => void;
  allowManualControl?: boolean;
}

const getRoleIcon = (role: string): string => {
  switch (role) {
    case 'sergeant':
    case 'leader':
      return '⭐';
    case 'heavy_weapon':
      return '🔫';
    case 'special_weapon':
      return '⚡';
    case 'regular':
    default:
      return '◆';
  }
};

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'sergeant':
    case 'leader':
      return 'Leader';
    case 'heavy_weapon':
      return 'Heavy Wpn';
    case 'special_weapon':
      return 'Special Wpn';
    case 'regular':
    default:
      return 'Trooper';
  }
};

const getRoleColor = (role: string): string => {
  switch (role) {
    case 'sergeant':
    case 'leader':
      return 'border-grimlog-amber';
    case 'heavy_weapon':
      return 'border-grimlog-red';
    case 'special_weapon':
      return 'border-grimlog-orange';
    case 'regular':
    default:
      return 'border-grimlog-steel';
  }
};

const getHealthColor = (currentWounds: number, maxWounds: number): string => {
  if (currentWounds === 0) return 'bg-grimlog-steel';
  const percent = (currentWounds / maxWounds) * 100;
  if (percent === 100) return 'bg-grimlog-green';
  if (percent > 66) return 'bg-grimlog-green';
  if (percent > 33) return 'bg-grimlog-amber';
  return 'bg-grimlog-red';
};

const getHealthFill = (currentWounds: number, maxWounds: number): string => {
  if (maxWounds === 0) return '0%';
  return `${(currentWounds / maxWounds) * 100}%`;
};

const getHealthStatusIcon = (currentWounds: number, maxWounds: number): string => {
  if (currentWounds === 0) return '💀';
  const percent = (currentWounds / maxWounds) * 100;
  if (percent === 100) return '🟢';
  if (percent > 66) return '🟢';
  if (percent > 33) return '🟡';
  return '🔴';
};

export default function ModelHealthGrid({
  models,
  woundsPerModel,
  compact = false,
  onModelClick,
  onModelWoundChange,
  onModelDestroy,
  allowManualControl = true
}: ModelHealthGridProps) {
  // Filter out dead models (0 wounds) - must be at the top before any returns
  const aliveModels = models.filter(m => m.currentWounds > 0);
  
  if (aliveModels.length === 0) {
    return (
      <div className="text-center text-grimlog-red text-sm py-2 font-bold">
        💀 ALL MODELS DESTROYED
      </div>
    );
  }

  // Compact view: Horizontal row with wound boxes
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-grimlog-light-steel font-mono uppercase mb-1">
          Per-Model Status ({aliveModels.length} Models)
        </div>
        <div className="space-y-1">
          {aliveModels.map((model, idx) => {
            const icon = getRoleIcon(model.role);
            const roleColor = getRoleColor(model.role);
            const healthColor = getHealthColor(model.currentWounds, model.maxWounds);
            const fillPercent = getHealthFill(model.currentWounds, model.maxWounds);
            const statusIcon = getHealthStatusIcon(model.currentWounds, model.maxWounds);
            const roleLabel = getRoleLabel(model.role);
            
            return (
              <div
                key={idx}
                className={`
                  flex items-center gap-2 p-1.5 bg-grimlog-black border-l-4 ${roleColor}
                  ${onModelClick ? 'cursor-pointer hover:bg-grimlog-steel' : ''}
                `}
                onClick={() => onModelClick?.(idx, model)}
                role={onModelClick ? "button" : undefined}
                aria-label={`${roleLabel}: ${model.currentWounds} of ${model.maxWounds} wounds remaining`}
              >
                {/* Status Icon */}
                <span className="text-base flex-shrink-0" aria-hidden="true">
                  {statusIcon}
                </span>
                
                {/* Role Icon & Label */}
                <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                  <span className="text-sm" aria-hidden="true">{icon}</span>
                  <span className="text-xs text-grimlog-light-steel font-mono truncate">
                    {roleLabel}
                  </span>
                </div>
                
                {/* Wound Bar */}
                <div className="flex-1 h-4 bg-grimlog-gray border border-grimlog-steel overflow-hidden relative">
                  <div
                    className={`h-full ${healthColor} transition-all duration-300`}
                    style={{ width: fillPercent }}
                  />
                </div>
                
                {/* Wounds Count */}
                <span className="text-xs font-bold text-grimlog-light-steel font-mono flex-shrink-0">
                  {model.currentWounds}/{model.maxWounds}W
                </span>
                
                {/* Manual Controls */}
                {(onModelWoundChange || onModelDestroy) && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {onModelWoundChange && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onModelWoundChange(idx, -1);
                          }}
                          disabled={model.currentWounds === 0}
                          className="w-5 h-5 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-gray text-white text-xs font-bold disabled:opacity-30 btn-depth-sm"
                          aria-label="Remove 1 wound"
                        >
                          -
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onModelWoundChange(idx, 1);
                          }}
                          disabled={model.currentWounds >= model.maxWounds}
                          className="w-5 h-5 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-gray text-grimlog-black text-xs font-bold disabled:opacity-30 btn-depth-sm"
                          aria-label="Add 1 wound"
                        >
                          +
                        </button>
                      </>
                    )}
                    {onModelDestroy && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onModelDestroy(idx);
                        }}
                        className="w-5 h-5 bg-grimlog-black hover:bg-grimlog-red border border-grimlog-red text-grimlog-red hover:text-white text-xs font-bold btn-depth-sm"
                        title="Destroy model"
                        aria-label="Destroy model"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Medium view: Larger cards with more detail and manual controls
  return (
    <div className="space-y-2">
      <div className="text-sm text-grimlog-light-steel font-mono uppercase mb-2 border-b border-grimlog-steel pb-1">
        Per-Model Status ({aliveModels.length} Models)
      </div>
      
      <div className="space-y-2">
        {aliveModels.map((model, idx) => {
          const icon = getRoleIcon(model.role);
          const roleColor = getRoleColor(model.role);
          const healthColor = getHealthColor(model.currentWounds, model.maxWounds);
          const fillPercent = getHealthFill(model.currentWounds, model.maxWounds);
          const statusIcon = getHealthStatusIcon(model.currentWounds, model.maxWounds);
          const roleLabel = getRoleLabel(model.role);
          
          return (
            <div
              key={idx}
              className={`
                p-2 bg-grimlog-black border-2 ${roleColor} btn-depth-sm
              `}
              role="region"
              aria-label={`${roleLabel}: ${model.currentWounds} of ${model.maxWounds} wounds remaining`}
            >
              <div className="flex items-center gap-2 mb-2">
                {/* Status Icon */}
                <span className="text-2xl flex-shrink-0" aria-hidden="true">
                  {statusIcon}
                </span>
                
                {/* Role Info */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg" aria-hidden="true">{icon}</span>
                  <span className="text-sm font-bold text-grimlog-light-steel truncate">
                    {roleLabel} #{idx + 1}
                  </span>
                </div>
                
                {/* Wounds Count */}
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-bold text-grimlog-light-steel font-mono">
                    {model.currentWounds}/{model.maxWounds}
                  </div>
                  <div className="text-xs text-grimlog-light-steel">WOUNDS</div>
                </div>
              </div>
              
              {/* Wound Pips - Visual representation */}
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                {Array.from({ length: model.maxWounds }).map((_, pipIdx) => {
                  const isAlive = pipIdx < model.currentWounds;
                  return (
                    <div
                      key={pipIdx}
                      className={`w-6 h-6 border-2 transition-colors ${
                        isAlive 
                          ? 'bg-grimlog-green border-grimlog-green' 
                          : 'bg-grimlog-gray border-grimlog-steel'
                      }`}
                      title={`Wound ${pipIdx + 1}${isAlive ? ' (remaining)' : ' (lost)'}`}
                      aria-hidden="true"
                    />
                  );
                })}
              </div>
              
              {/* Warning if critical */}
              {model.currentWounds > 0 && model.currentWounds <= model.maxWounds / 3 && (
                <div className="mb-2 text-xs text-grimlog-red font-bold flex items-center gap-1">
                  <span>⚠</span>
                  <span>CRITICAL DAMAGE</span>
                </div>
              )}
              
              {/* Manual Controls */}
              {(onModelWoundChange || onModelDestroy) && (
                <div className="flex items-center gap-2">
                  {onModelWoundChange && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onModelWoundChange(idx, -1);
                        }}
                        disabled={model.currentWounds === 0}
                        className="flex-1 px-3 py-1.5 bg-grimlog-red hover:bg-red-600 disabled:bg-grimlog-steel text-white disabled:text-grimlog-light-steel text-sm font-bold disabled:cursor-not-allowed btn-depth hover-lift transition-colors"
                        aria-label="Remove 1 wound"
                      >
                        -1 WOUND
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onModelWoundChange(idx, 1);
                        }}
                        disabled={model.currentWounds >= model.maxWounds}
                        className="flex-1 px-3 py-1.5 bg-grimlog-green hover:bg-green-600 disabled:bg-grimlog-steel text-grimlog-black disabled:text-grimlog-light-steel text-sm font-bold disabled:cursor-not-allowed btn-depth hover-lift transition-colors"
                        aria-label="Add 1 wound"
                      >
                        +1 WOUND
                      </button>
                    </>
                  )}
                  {onModelDestroy && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onModelDestroy(idx);
                      }}
                      className="px-3 py-1.5 bg-grimlog-black hover:bg-grimlog-red border-2 border-grimlog-red text-grimlog-red hover:text-white text-sm font-bold btn-depth hover-lift"
                      aria-label="Destroy this model"
                    >
                      DESTROY
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
