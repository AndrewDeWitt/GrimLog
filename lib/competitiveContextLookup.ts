/**
 * Competitive Context Lookup Utility
 * 
 * Fetches and aggregates competitive insights for units and factions
 * from multiple sources, handling staleness and confidence scoring.
 */

import { prisma } from '@/lib/prisma';

// ============================================
// TYPES
// ============================================

export interface UnitCompetitiveInsight {
  unitName: string;
  faction: string;
  
  // Aggregated tier (weighted by confidence and recency)
  tierRank?: string;
  tierReasoning?: string;
  tierConfidence: number;
  
  // Aggregated tactical insights
  bestTargets: string[];
  counters: string[];
  synergies: string[];
  playstyleNotes?: string;
  deploymentTips?: string;
  
  // Source info
  sources: Array<{
    authorName: string;
    contentTitle: string;
    sourceType: string;
    gameVersion?: string;
    confidence: number;
    isStale: boolean;
  }>;
  
  // Staleness indicator
  hasStaleData: boolean;
  mostRecentVersion?: string;
}

export interface FactionCompetitiveInsight {
  factionName: string;
  subfaction?: string;
  
  // Aggregated meta position
  metaTier?: string;
  metaTierReasoning?: string;
  metaConfidence: number;
  
  // Aggregated insights
  playstyleArchetype?: string;
  playstyleNotes?: string;
  strengths: string[];
  weaknesses: string[];
  recommendedDetachments: Array<{ name: string; reasoning: string }>;
  mustTakeUnits: string[];
  avoidUnits: string[];
  
  // Source info
  sources: Array<{
    authorName: string;
    contentTitle: string;
    sourceType: string;
    gameVersion?: string;
    confidence: number;
    isStale: boolean;
  }>;
  
  hasStaleData: boolean;
  mostRecentVersion?: string;
}

export interface CompetitiveContextForArmy {
  unitInsights: Map<string, UnitCompetitiveInsight>;
  factionInsight: FactionCompetitiveInsight | null;
  overallConfidence: number;
  hasAnyContext: boolean;
  staleSummary: {
    staleUnitCount: number;
    totalUnitsWithContext: number;
    factionIsStale: boolean;
  };
}

// ============================================
// LOOKUP FUNCTIONS
// ============================================

/**
 * Look up competitive context for a single unit
 */
export async function getUnitCompetitiveInsight(
  unitName: string,
  faction: string,
  subfaction?: string
): Promise<UnitCompetitiveInsight | null> {
  // Find all contexts for this unit
  const conditions = [
    {
      unitName: { equals: unitName, mode: 'insensitive' as const },
      faction: { equals: faction, mode: 'insensitive' as const },
    },
  ];
  if (subfaction) {
    conditions.push({
      unitName: { equals: unitName, mode: 'insensitive' as const },
      faction: { equals: subfaction, mode: 'insensitive' as const },
    });
  }
  const contexts = await prisma.unitCompetitiveContext.findMany({
    where: {
      OR: conditions,
    },
    include: {
      source: {
        select: {
          authorName: true,
          contentTitle: true,
          sourceType: true,
          gameVersion: true,
        },
      },
    },
    orderBy: [
      { confidence: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (contexts.length === 0) {
    return null;
  }

  // Aggregate data from all contexts
  const allBestTargets = new Set<string>();
  const allCounters = new Set<string>();
  const allSynergies = new Set<string>();
  const sources: UnitCompetitiveInsight['sources'] = [];

  // Find the highest confidence tier ranking
  let bestTierContext = contexts.find(c => c.tierRank);
  
  for (const ctx of contexts) {
    // Aggregate arrays
    if (ctx.bestTargets) {
      JSON.parse(ctx.bestTargets).forEach((t: string) => allBestTargets.add(t));
    }
    if (ctx.counters) {
      JSON.parse(ctx.counters).forEach((c: string) => allCounters.add(c));
    }
    if (ctx.synergies) {
      JSON.parse(ctx.synergies).forEach((s: string) => allSynergies.add(s));
    }

    sources.push({
      authorName: ctx.source.authorName || 'Unknown',
      contentTitle: ctx.source.contentTitle || 'Unknown',
      sourceType: ctx.source.sourceType,
      gameVersion: ctx.source.gameVersion || undefined,
      confidence: ctx.confidence,
      isStale: ctx.isStale,
    });
  }

  // Calculate weighted confidence
  const weightedConfidence = contexts.reduce((sum, ctx) => sum + ctx.confidence, 0) / contexts.length;

  // Find most recent game version
  const gameVersions = contexts
    .map(c => c.gameVersion)
    .filter(Boolean) as string[];
  const mostRecentVersion = gameVersions[0]; // Already sorted by recency

  // Check for stale data
  const hasStaleData = contexts.some(c => c.isStale);

  // Use the highest confidence context for text fields
  const primaryContext = contexts[0];

  return {
    unitName,
    faction,
    tierRank: bestTierContext?.tierRank || undefined,
    tierReasoning: bestTierContext?.tierReasoning || undefined,
    tierConfidence: bestTierContext?.confidence || 0,
    bestTargets: Array.from(allBestTargets),
    counters: Array.from(allCounters),
    synergies: Array.from(allSynergies),
    playstyleNotes: primaryContext.playstyleNotes || undefined,
    deploymentTips: primaryContext.deploymentTips || undefined,
    sources,
    hasStaleData,
    mostRecentVersion,
  };
}

/**
 * Look up competitive context for a faction
 */
export async function getFactionCompetitiveInsight(
  factionName: string,
  subfaction?: string
): Promise<FactionCompetitiveInsight | null> {
  // Find all contexts for this faction
  const factionConditions = [
    { factionName: { equals: factionName, mode: 'insensitive' as const } },
  ];
  if (subfaction) {
    factionConditions.push({ factionName: { equals: subfaction, mode: 'insensitive' as const } });
  }
  const contexts = await prisma.factionCompetitiveContext.findMany({
    where: {
      OR: factionConditions,
    },
    include: {
      source: {
        select: {
          authorName: true,
          contentTitle: true,
          sourceType: true,
          gameVersion: true,
        },
      },
    },
    orderBy: [
      { confidence: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (contexts.length === 0) {
    return null;
  }

  // Aggregate data
  const allStrengths = new Set<string>();
  const allWeaknesses = new Set<string>();
  const allMustTake = new Set<string>();
  const allAvoid = new Set<string>();
  const detachmentMap = new Map<string, string>();
  const sources: FactionCompetitiveInsight['sources'] = [];

  let bestTierContext = contexts.find(c => c.metaTier);

  for (const ctx of contexts) {
    if (ctx.strengths) {
      JSON.parse(ctx.strengths).forEach((s: string) => allStrengths.add(s));
    }
    if (ctx.weaknesses) {
      JSON.parse(ctx.weaknesses).forEach((w: string) => allWeaknesses.add(w));
    }
    if (ctx.mustTakeUnits) {
      JSON.parse(ctx.mustTakeUnits).forEach((u: string) => allMustTake.add(u));
    }
    if (ctx.avoidUnits) {
      JSON.parse(ctx.avoidUnits).forEach((u: string) => allAvoid.add(u));
    }
    if (ctx.recommendedDetachments) {
      const dets = JSON.parse(ctx.recommendedDetachments) as Array<{ name: string; reasoning: string }>;
      for (const det of dets) {
        if (!detachmentMap.has(det.name)) {
          detachmentMap.set(det.name, det.reasoning);
        }
      }
    }

    sources.push({
      authorName: ctx.source.authorName || 'Unknown',
      contentTitle: ctx.source.contentTitle || 'Unknown',
      sourceType: ctx.source.sourceType,
      gameVersion: ctx.source.gameVersion || undefined,
      confidence: ctx.confidence,
      isStale: ctx.isStale,
    });
  }

  const weightedConfidence = contexts.reduce((sum, ctx) => sum + ctx.confidence, 0) / contexts.length;
  const hasStaleData = contexts.some(c => c.isStale);
  const primaryContext = contexts[0];

  const gameVersions = contexts
    .map(c => c.gameVersion)
    .filter(Boolean) as string[];

  return {
    factionName,
    subfaction,
    metaTier: bestTierContext?.metaTier || undefined,
    metaTierReasoning: bestTierContext?.metaTierReasoning || undefined,
    metaConfidence: bestTierContext?.confidence || 0,
    playstyleArchetype: primaryContext.playstyleArchetype || undefined,
    playstyleNotes: primaryContext.playstyleNotes || undefined,
    strengths: Array.from(allStrengths),
    weaknesses: Array.from(allWeaknesses),
    recommendedDetachments: Array.from(detachmentMap.entries()).map(([name, reasoning]) => ({
      name,
      reasoning,
    })),
    mustTakeUnits: Array.from(allMustTake),
    avoidUnits: Array.from(allAvoid),
    sources,
    hasStaleData,
    mostRecentVersion: gameVersions[0],
  };
}

/**
 * Look up competitive context for an entire army list
 */
export async function getCompetitiveContextForArmy(
  units: Array<{ name: string; faction?: string }>,
  armyFaction: string,
  armySubfaction?: string
): Promise<CompetitiveContextForArmy> {
  const unitInsights = new Map<string, UnitCompetitiveInsight>();
  let staleUnitCount = 0;

  // Look up each unit
  for (const unit of units) {
    const insight = await getUnitCompetitiveInsight(
      unit.name,
      unit.faction || armyFaction,
      armySubfaction
    );

    if (insight) {
      unitInsights.set(unit.name, insight);
      if (insight.hasStaleData) {
        staleUnitCount++;
      }
    }
  }

  // Look up faction context
  const factionInsight = await getFactionCompetitiveInsight(armyFaction, armySubfaction);

  // Calculate overall confidence
  let totalConfidence = 0;
  let contextCount = 0;

  for (const insight of unitInsights.values()) {
    totalConfidence += insight.tierConfidence;
    contextCount++;
  }

  if (factionInsight) {
    totalConfidence += factionInsight.metaConfidence;
    contextCount++;
  }

  const overallConfidence = contextCount > 0 ? totalConfidence / contextCount : 0;

  return {
    unitInsights,
    factionInsight,
    overallConfidence,
    hasAnyContext: unitInsights.size > 0 || factionInsight !== null,
    staleSummary: {
      staleUnitCount,
      totalUnitsWithContext: unitInsights.size,
      factionIsStale: factionInsight?.hasStaleData || false,
    },
  };
}

/**
 * Get a summary of all competitive context in the database
 */
export async function getCompetitiveContextStats() {
  const [unitCount, factionCount, sourceCount, staleUnitCount, staleFactionCount] = await Promise.all([
    prisma.unitCompetitiveContext.count(),
    prisma.factionCompetitiveContext.count(),
    prisma.competitiveSource.count({ where: { status: 'parsed' } }),
    prisma.unitCompetitiveContext.count({ where: { isStale: true } }),
    prisma.factionCompetitiveContext.count({ where: { isStale: true } }),
  ]);

  // Get unique factions with context
  const uniqueFactions = await prisma.factionCompetitiveContext.findMany({
    select: { factionName: true },
    distinct: ['factionName'],
  });

  return {
    totalUnitContexts: unitCount,
    totalFactionContexts: factionCount,
    totalSources: sourceCount,
    staleUnitContexts: staleUnitCount,
    staleFactionContexts: staleFactionCount,
    factionsWithContext: uniqueFactions.map(f => f.factionName),
  };
}

