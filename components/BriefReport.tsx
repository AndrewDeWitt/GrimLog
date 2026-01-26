'use client';

import { useMemo } from 'react';
import {
  BriefAnalysis,
  BriefStrategicAnalysis,
  TacticalRole,
  UnitEngagementProfile,
  UnitCompetitiveContextSummary,
  FactionCompetitiveContextSummary,
  ListSuggestion,
} from '@/lib/briefAnalysis';
import { useUnitIcons } from '@/lib/hooks/useUnitIcon';
import { findActiveSynergies, calculateSynergyStats } from '@/lib/synergyHelper';
import { SynergyNetwork } from '@/components/brief';
import Collapsible from '@/components/ui/Collapsible';
import {
  ArmyQuirksGrid,
  UnitRoleGroup,
  ROLE_CONFIG,
  ListSuggestionsSection,
  MatchupGuide,
} from '@/components/brief/report';

// Export data structure for HTML generation
export interface BriefExportData {
  spiritIconUrl: string | null;
  unitIcons: Record<string, string | null>;
  synergyData: {
    connections: Array<{ from: string; to: string; bidirectional: boolean }>;
    activeUnits: string[];
    orphanUnits: Array<{ unitName: string; synergies: string[] }>;
    unitData: Map<string, { points: number; role?: string; tier?: string }>;
    stats: { totalConnections: number; unitsWithSynergies: number };
  } | null;
}

interface BriefReportProps {
  analysis: BriefAnalysis | null;
  strategicAnalysis?: Partial<BriefStrategicAnalysis> | null;
  listSuggestions?: ListSuggestion[];
  spiritIconUrl?: string | null;
  competitiveContext?: {
    factionContext: FactionCompetitiveContextSummary | null;
    unitContexts: Map<string, { context: UnitCompetitiveContextSummary; unitName: string }>;
  };
  onExport?: (exportData: BriefExportData) => void;
  briefId?: string | null;
  briefVisibility?: 'private' | 'link' | 'public';
  briefShareToken?: string | null;
  listName?: string;
  // Edit mode props
  isEditMode?: boolean;
  onUpdateFunStats?: (funStats: BriefStrategicAnalysis['viralInsights']['funStats']) => void;
  onUpdateTacticalSummary?: (unitDisplayName: string, summary: string) => void;
  onUpdateRole?: (unitDisplayName: string, role: TacticalRole, reasoning: string) => void;
  onUpdateListSuggestions?: (suggestions: ListSuggestion[]) => void;
  onUpdateMatchups?: (matchups: BriefStrategicAnalysis['matchupConsiderations']) => void;
}

export default function BriefReport({
  analysis,
  strategicAnalysis,
  listSuggestions,
  spiritIconUrl,
  competitiveContext,
  onExport,
  briefId,
  briefVisibility,
  briefShareToken,
  listName: initialListName,
  isEditMode = false,
  onUpdateFunStats,
  onUpdateTacticalSummary,
  onUpdateRole,
  onUpdateListSuggestions,
  onUpdateMatchups,
}: BriefReportProps) {
  // Extract values safely, handling null analysis
  const faction = analysis?.faction;
  const unitEngagementProfiles = analysis?.unitEngagementProfiles || [];

  // Batch fetch all unit icons
  const unitIconRequests = useMemo(() => {
    const requests = unitEngagementProfiles.map((u) => ({
      unitName: u.unitName,
      faction: faction || 'Unknown',
    }));

    if (listSuggestions && listSuggestions.length > 0) {
      const suggestionUnitNames = new Set<string>();
      for (const suggestion of listSuggestions) {
        if (suggestion.removeUnits) {
          for (const unit of suggestion.removeUnits) {
            suggestionUnitNames.add(unit.name);
          }
        }
        if (suggestion.addUnits) {
          for (const unit of suggestion.addUnits) {
            suggestionUnitNames.add(unit.name);
          }
        }
      }
      for (const unitName of suggestionUnitNames) {
        if (!requests.some((r) => r.unitName === unitName)) {
          requests.push({ unitName, faction: faction || 'Unknown' });
        }
      }
    }

    return requests;
  }, [unitEngagementProfiles, faction, listSuggestions]);

  const { icons } = useUnitIcons(unitIconRequests);

  // Calculate role statistics
  const roleStats = useMemo(() => {
    const aiRoles = strategicAnalysis?.unitRoleAssignments;
    const roleGroups: Record<TacticalRole, UnitEngagementProfile[]> = {
      hammer: [],
      anvil: [],
      skirmisher: [],
      support: [],
      scoring: [],
      screening: [],
      utility: [],
      specialist: [],
    };

    for (const unit of unitEngagementProfiles) {
      const role = aiRoles?.[unit.displayName]?.role || unit.tacticalRole.role;
      if (roleGroups[role]) {
        roleGroups[role].push(unit);
      }
    }

    return Object.entries(roleGroups)
      .filter(([_, units]) => units.length > 0)
      .map(([role, units]) => ({ role: role as TacticalRole, units }));
  }, [unitEngagementProfiles, strategicAnalysis?.unitRoleAssignments]);

  // Calculate synergies
  const synergyData = useMemo(() => {
    if (!competitiveContext?.unitContexts) {
      return { synergyResults: new Map(), synergyStats: null };
    }
    const allUnitNames = unitEngagementProfiles.map((u) => u.unitName);
    const synergyResults = findActiveSynergies(competitiveContext.unitContexts, allUnitNames);
    const synergyStats = calculateSynergyStats(synergyResults, allUnitNames.length);
    return { synergyResults, synergyStats };
  }, [competitiveContext?.unitContexts, unitEngagementProfiles]);

  // Prepare synergy network data
  const synergyNetworkData = useMemo(() => {
    return unitEngagementProfiles.map((unit) => {
      const context = competitiveContext?.unitContexts.get(unit.unitName)?.context;
      return {
        unitName: unit.unitName,
        points: unit.pointsCost,
        role: unit.tacticalRole.role,
        synergies: context?.synergies || [],
        tier: context?.tierRank,
      };
    });
  }, [unitEngagementProfiles, competitiveContext?.unitContexts]);

  // Prepare synergy export data
  const prepareSynergyExportData = (): BriefExportData['synergyData'] => {
    if (!competitiveContext?.unitContexts) return null;

    const connections: Array<{ from: string; to: string; bidirectional: boolean }> = [];
    const activeUnitsSet = new Set<string>();
    const orphanUnits: Array<{ unitName: string; synergies: string[] }> = [];

    synergyData.synergyResults.forEach((result, unitName) => {
      if (result.activeSynergies.length > 0) {
        result.activeSynergies.forEach((synTarget: string) => {
          activeUnitsSet.add(unitName);
          activeUnitsSet.add(synTarget);
          const exists = connections.some(
            (c) => (c.from === unitName && c.to === synTarget) || (c.from === synTarget && c.to === unitName)
          );
          if (!exists) {
            connections.push({ from: unitName, to: synTarget, bidirectional: false });
          }
        });
      } else if (result.missingSynergies.length > 0) {
        orphanUnits.push({ unitName, synergies: result.missingSynergies });
      }
    });

    const unitDataMap = new Map<string, { points: number; role?: string; tier?: string }>();
    unitEngagementProfiles.forEach((unit) => {
      const context = competitiveContext?.unitContexts.get(unit.unitName)?.context;
      unitDataMap.set(unit.unitName, {
        points: unit.pointsCost,
        role: unit.tacticalRole.role,
        tier: context?.tierRank,
      });
    });

    return {
      connections,
      activeUnits: Array.from(activeUnitsSet),
      orphanUnits: orphanUnits.slice(0, 5),
      unitData: unitDataMap,
      stats: { totalConnections: connections.length, unitsWithSynergies: activeUnitsSet.size },
    };
  };

  const hasSynergies = competitiveContext && competitiveContext.unitContexts.size > 0;

  // Guard against null analysis (can happen during loading states)
  if (!analysis) {
    return (
      <div className="bg-grimlog-black p-8 text-center">
        <p className="text-gray-400">Loading brief analysis...</p>
      </div>
    );
  }

  return (
    <div className="bg-grimlog-black pb-16">
      {/* Hidden export trigger for header button */}
      {onExport && (
        <button
          id="brief-export-trigger"
          className="hidden"
          onClick={() => {
            const synergyExportData =
              synergyNetworkData.length > 0 && competitiveContext?.unitContexts
                ? prepareSynergyExportData()
                : null;
            onExport({ spiritIconUrl: spiritIconUrl ?? null, unitIcons: icons, synergyData: synergyExportData });
          }}
        />
      )}

      {/* All Sections - Collapsible for easy scanning */}
      <div className="space-y-2 py-2">
        {/* Army Quirks */}
        {strategicAnalysis?.viralInsights && strategicAnalysis.viralInsights.funStats?.length > 0 && (
          <Collapsible
            title="Army Quirks"
            icon="✦"
            badge={strategicAnalysis.viralInsights.funStats.length}
            badgeColor="amber"
            color="amber"
            defaultOpen={true}
          >
            <ArmyQuirksGrid
              funStats={strategicAnalysis.viralInsights.funStats}
              isEditMode={isEditMode}
              onUpdate={onUpdateFunStats}
            />
          </Collapsible>
        )}

        {/* Unit Profiles by Role */}
        <Collapsible
          title="Unit Profiles"
          icon="⬢"
          badge={`${analysis.unitEngagementProfiles.length} units`}
          badgeColor="steel"
          color="green"
          defaultOpen={true}
        >
          <div className="py-2 space-y-4">
            {roleStats.map(({ role, units }) => {
              const config = ROLE_CONFIG[role];
              const totalPoints = units.reduce((sum, u) => sum + u.pointsCost, 0);
              // Find relevant strengths/weaknesses for this role group
              const unitNames = units.map(u => u.displayName.toLowerCase());
              const relevantStrengths = strategicAnalysis?.strategicStrengths?.filter(s =>
                s.relevantUnits?.some(ru => unitNames.some(un => ru.toLowerCase().includes(un) || un.includes(ru.toLowerCase())))
              ) || [];
              const relevantWeaknesses = strategicAnalysis?.strategicWeaknesses?.filter(w =>
                unitNames.some(un => w.description?.toLowerCase().includes(un) || w.title?.toLowerCase().includes(un))
              ) || [];
              return (
                <Collapsible
                  key={role}
                  title={`${config.icon} ${config.label}`}
                  badge={`${units.length} (${totalPoints}pts)`}
                  badgeColor="steel"
                  color={config.sectionColor}
                  defaultOpen={true}
                >
                  <UnitRoleGroup
                    role={role}
                    units={units}
                    faction={faction || 'Unknown'}
                    icons={icons}
                    tacticalSummaries={strategicAnalysis?.unitTacticalSummaries}
                    aiRoleAssignments={strategicAnalysis?.unitRoleAssignments}
                    relevantStrengths={relevantStrengths}
                    relevantWeaknesses={relevantWeaknesses}
                    isEditMode={isEditMode}
                    onUpdateTacticalSummary={onUpdateTacticalSummary}
                    onUpdateRole={onUpdateRole}
                  />
                </Collapsible>
              );
            })}
          </div>
        </Collapsible>

        {/* List Modifications */}
        {listSuggestions && listSuggestions.length > 0 && (
          <Collapsible
            title="List Modifications"
            icon="⇄"
            badge={listSuggestions.length}
            badgeColor="orange"
            color="orange"
            defaultOpen={true}
          >
            <ListSuggestionsSection
              suggestions={listSuggestions}
              faction={analysis.faction}
              icons={icons}
              isEditMode={isEditMode}
              onUpdate={onUpdateListSuggestions}
            />
          </Collapsible>
        )}

        {/* Matchup Guide */}
        {strategicAnalysis?.matchupConsiderations && strategicAnalysis.matchupConsiderations.length > 0 && (
          <Collapsible
            title="Matchup Guide"
            icon="⚔"
            color="blue"
            defaultOpen={true}
          >
            <MatchupGuide
              matchups={strategicAnalysis.matchupConsiderations}
              isEditMode={isEditMode}
              onUpdate={onUpdateMatchups}
            />
          </Collapsible>
        )}

        {/* Unit Synergies */}
        {hasSynergies && (
          <Collapsible title="Unit Synergies" icon="⟷" color="cyan" defaultOpen={false}>
            <SynergyNetwork
              units={synergyNetworkData}
              unitsInList={analysis.unitEngagementProfiles.map((u) => u.unitName)}
            />
          </Collapsible>
        )}

      </div>

      {/* Footer */}
      <div className="bg-grimlog-darkGray border-t-2 border-grimlog-steel p-4 text-center mt-4">
        <p className="text-gray-300 text-xs font-mono">
          Generated by Grimlog Tactical Brief Engine • {new Date().toISOString()}
        </p>
        <p className="text-gray-300 text-xs mt-1">
          This analysis is based on mathematical averages and general tactical principles.
        </p>
      </div>
    </div>
  );
}
