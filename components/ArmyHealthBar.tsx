'use client';

interface ArmyHealthBarProps {
  owner: 'attacker' | 'defender';
  totalUnits: number;
  aliveUnits: number;
  totalModels: number;
  currentModels: number;
  totalWounds: number;
  currentWounds: number;
}

export default function ArmyHealthBar({
  owner,
  totalUnits,
  aliveUnits,
  totalModels,
  currentModels,
  totalWounds,
  currentWounds
}: ArmyHealthBarProps) {
  // Calculate percentages
  const unitPercent = totalUnits > 0 ? (aliveUnits / totalUnits) * 100 : 0;
  const modelPercent = totalModels > 0 ? (currentModels / totalModels) * 100 : 0;
  const woundPercent = totalWounds > 0 ? (currentWounds / totalWounds) * 100 : 0;

  // Color coding
  const getHealthColor = (percent: number) => {
    if (percent > 66) return 'bg-grimlog-green';
    if (percent > 33) return 'bg-grimlog-amber';
    return 'bg-grimlog-red';
  };

  const ownerColor = owner === 'attacker' ? 'text-grimlog-red' : 'text-grimlog-green';
  const ownerBorder = owner === 'attacker' ? 'border-grimlog-red' : 'border-grimlog-green';

  return (
    <div 
      className={`p-4 bg-grimlog-gray border-2 ${ownerBorder}`}
      role="region"
      aria-label={`${owner} army health summary`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-bold ${ownerColor} tracking-wider uppercase`}>
          {owner === 'attacker' ? 'ATTACKER' : 'DEFENDER'}
        </h3>
        <div className={`text-sm font-mono ${ownerColor}`}>
          {aliveUnits} / {totalUnits} UNITS
        </div>
      </div>

      {/* Overall Army Health Bar (Models) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-grimlog-light-steel font-mono">ARMY STRENGTH</span>
          <span className={`text-sm font-bold ${ownerColor}`}>
            {currentModels} / {totalModels} MODELS
          </span>
        </div>
        <div className="w-full h-6 bg-grimlog-black border-2 border-grimlog-steel overflow-hidden">
          <div 
            className={`h-full ${getHealthColor(modelPercent)} transition-all duration-500 flex items-center justify-center`}
            style={{ width: `${modelPercent}%` }}
            role="progressbar"
            aria-valuenow={currentModels}
            aria-valuemin={0}
            aria-valuemax={totalModels}
            aria-label={`Army models: ${currentModels} of ${totalModels}`}
          >
            {modelPercent > 15 && (
              <span className="text-xs font-bold text-grimlog-black">
                {Math.round(modelPercent)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Total Wounds Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-grimlog-light-steel font-mono">TOTAL WOUNDS</span>
          <span className={`text-sm font-bold ${ownerColor}`}>
            {currentWounds} / {totalWounds}
          </span>
        </div>
        <div className="w-full h-4 bg-grimlog-black border border-grimlog-steel overflow-hidden">
          <div 
            className={`h-full ${getHealthColor(woundPercent)} transition-all duration-500`}
            style={{ width: `${woundPercent}%` }}
            role="progressbar"
            aria-valuenow={currentWounds}
            aria-valuemin={0}
            aria-valuemax={totalWounds}
            aria-label={`Total wounds: ${currentWounds} of ${totalWounds}`}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-grimlog-steel">
        <div className="text-center">
          <div className="text-xs text-grimlog-light-steel font-mono mb-1">UNITS</div>
          <div className={`text-lg font-bold ${ownerColor}`}>{aliveUnits}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-grimlog-light-steel font-mono mb-1">MODELS</div>
          <div className={`text-lg font-bold ${ownerColor}`}>{currentModels}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-grimlog-light-steel font-mono mb-1">WOUNDS</div>
          <div className={`text-lg font-bold ${ownerColor}`}>{currentWounds}</div>
        </div>
      </div>

      {/* Warning if army is heavily damaged */}
      {modelPercent <= 33 && modelPercent > 0 && (
        <div className="mt-3 p-2 bg-grimlog-red text-white text-xs font-bold text-center">
          ⚠ CRITICAL LOSSES - {Math.round(modelPercent)}% ARMY REMAINING
        </div>
      )}
    </div>
  );
}
