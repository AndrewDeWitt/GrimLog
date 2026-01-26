'use client';

import { TacticalRole, UnitEngagementProfile, StrategicStrength, StrategicWeakness } from '@/lib/briefAnalysis';
import { getUnitIcon, isCustomIcon } from '@/lib/unitIcons';
import { SectionColor } from '@/components/ui/Collapsible';
import { EditableText } from '../EditableText';
import { EditableSelect } from '../EditableSelect';

// Role display configuration
const ROLE_CONFIG: Record<TacticalRole, { label: string; icon: string; color: string; sectionColor: SectionColor; description: string }> = {
  hammer: {
    label: 'HAMMERS',
    icon: '⚔️',
    color: 'text-grimlog-red',
    sectionColor: 'red',
    description: 'Primary damage dealers',
  },
  anvil: {
    label: 'ANVILS',
    icon: '🛡️',
    color: 'text-blue-400',
    sectionColor: 'blue',
    description: 'Durable holders',
  },
  skirmisher: {
    label: 'SKIRMISHERS',
    icon: '⚡',
    color: 'text-yellow-400',
    sectionColor: 'yellow',
    description: 'Mobile harassment',
  },
  support: {
    label: 'SUPPORT',
    icon: '✨',
    color: 'text-purple-400',
    sectionColor: 'purple',
    description: 'Force multipliers',
  },
  scoring: {
    label: 'SCORING',
    icon: '🎯',
    color: 'text-grimlog-green',
    sectionColor: 'green',
    description: 'Objective holders',
  },
  screening: {
    label: 'SCREENING',
    icon: '📍',
    color: 'text-white',
    sectionColor: 'cyan',
    description: 'Cheap blockers',
  },
  utility: {
    label: 'UTILITY',
    icon: '🔧',
    color: 'text-cyan-400',
    sectionColor: 'cyan',
    description: 'Special tricks',
  },
  specialist: {
    label: 'SPECIALISTS',
    icon: '🎖️',
    color: 'text-amber-400',
    sectionColor: 'amber',
    description: 'Single-purpose units',
  },
};

// Convert ROLE_CONFIG to options for EditableSelect
const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  icon: config.icon,
  color: config.color,
}));

interface UnitRoleGroupProps {
  role: TacticalRole;
  units: UnitEngagementProfile[];
  faction: string;
  icons: Record<string, string | null>;
  tacticalSummaries?: Record<string, string>;
  aiRoleAssignments?: Record<string, { role: TacticalRole; reasoning: string }>;
  relevantStrengths?: StrategicStrength[];
  relevantWeaknesses?: StrategicWeakness[];
  isEditMode?: boolean;
  onUpdateTacticalSummary?: (unitDisplayName: string, summary: string) => void;
  onUpdateRole?: (unitDisplayName: string, role: TacticalRole, reasoning: string) => void;
}

export default function UnitRoleGroup({
  role,
  units,
  faction,
  icons,
  tacticalSummaries,
  aiRoleAssignments,
  relevantStrengths = [],
  relevantWeaknesses = [],
  isEditMode = false,
  onUpdateTacticalSummary,
  onUpdateRole,
}: UnitRoleGroupProps) {
  const config = ROLE_CONFIG[role];
  const hasInlineInsights = relevantStrengths.length > 0 || relevantWeaknesses.length > 0;

  return (
    <div className="space-y-3">
      {/* Inline Strengths & Weaknesses for this role */}
      {hasInlineInsights && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-grimlog-steel/30">
          {relevantStrengths.slice(0, 2).map((s, i) => (
            <span
              key={`s-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-grimlog-green/10 border border-grimlog-green/30 rounded text-xs"
              title={s.description}
            >
              <span className="text-grimlog-green">✓</span>
              <span className="text-grimlog-green font-medium">{s.title}</span>
            </span>
          ))}
          {relevantWeaknesses.slice(0, 2).map((w, i) => (
            <span
              key={`w-${i}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                w.severity === 'critical'
                  ? 'bg-red-500/10 border border-red-500/30'
                  : 'bg-grimlog-amber/10 border border-grimlog-amber/30'
              }`}
              title={w.description}
            >
              <span className={w.severity === 'critical' ? 'text-red-400' : 'text-grimlog-amber'}>!</span>
              <span className={`font-medium ${w.severity === 'critical' ? 'text-red-400' : 'text-grimlog-amber'}`}>
                {w.title}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Unit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {units.map((unit, i) => {
        const key = `${faction}:${unit.unitName}`;
        const iconUrl = icons[key];
        const icon = getUnitIcon(iconUrl, unit.unitName);
        const hasCustomIcon = isCustomIcon(icon);
        const tacticalSummary = tacticalSummaries?.[unit.displayName];
        const aiRole = aiRoleAssignments?.[unit.displayName];
        const effectiveRole = aiRole?.role || unit.tacticalRole.role;
        const roleConfig = ROLE_CONFIG[effectiveRole];

        return (
          <div
            key={i}
            className={`relative bg-grimlog-darkGray border rounded overflow-hidden p-3 sm:p-4 ${
              isEditMode ? 'border-grimlog-orange/50' : 'border-grimlog-steel'
            }`}
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-grimlog-orange" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-grimlog-orange" />

            {/* Header with icon and info */}
            <div className="flex items-start gap-3">
              {/* Unit Icon */}
              {hasCustomIcon ? (
                <img
                  src={icon}
                  alt={unit.unitName}
                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded border border-grimlog-steel/50 bg-grimlog-black flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded border border-grimlog-steel/50 bg-grimlog-black flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0">
                  {icon}
                </div>
              )}

              {/* Unit Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-grimlog-green font-bold text-base sm:text-lg leading-tight">
                  {unit.unitName}
                </h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-gray-400 text-sm font-mono">{unit.pointsCost}pts</span>
                  <span className="text-gray-600">·</span>
                  {isEditMode ? (
                    <EditableSelect
                      value={effectiveRole}
                      onChange={(newRole) =>
                        onUpdateRole?.(
                          unit.displayName,
                          newRole as TacticalRole,
                          aiRole?.reasoning || unit.tacticalRole.reasoning
                        )
                      }
                      isEditMode={isEditMode}
                      options={ROLE_OPTIONS}
                      className="min-w-[100px]"
                    />
                  ) : (
                    <span className={`${roleConfig.color} font-bold text-sm uppercase`}>
                      {roleConfig.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tactical Summary */}
            <div className={`mt-3 p-2 sm:p-3 bg-grimlog-black/50 rounded border-l-2 ${
              tacticalSummary || isEditMode ? 'border-grimlog-orange' : 'border-grimlog-steel'
            }`}>
              {isEditMode ? (
                <EditableText
                  value={tacticalSummary || aiRole?.reasoning || unit.tacticalRole.reasoning}
                  onChange={(v) => onUpdateTacticalSummary?.(unit.displayName, v)}
                  isEditMode={isEditMode}
                  multiline
                  placeholder="Tactical summary for this unit..."
                  className="text-gray-200 text-sm sm:text-base leading-relaxed w-full"
                />
              ) : (
                <p className="text-gray-200 text-sm sm:text-base leading-relaxed">
                  {tacticalSummary || aiRole?.reasoning || unit.tacticalRole.reasoning}
                </p>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// Export role config for use in parent component
export { ROLE_CONFIG };
