/**
 * Competitive Context Lookup API
 * POST /api/competitive/lookup
 * 
 * Looks up competitive context for an army list's units and faction.
 * Used to enrich the Brief with competitive insights.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUnitCompetitiveInsight,
  getFactionCompetitiveInsight,
} from '@/lib/competitiveContextLookup';

interface LookupRequest {
  units: Array<{ name: string; faction?: string }>;
  faction: string;
  subfaction?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LookupRequest = await request.json();
    const { units, faction, subfaction } = body;

    if (!faction) {
      return NextResponse.json(
        { error: 'Faction is required' },
        { status: 400 }
      );
    }

    // Look up faction context
    const factionContext = await getFactionCompetitiveInsight(faction, subfaction);

    // Look up unit contexts
    const unitContexts: Record<string, {
      context: NonNullable<Awaited<ReturnType<typeof getUnitCompetitiveInsight>>>;
      unitName: string;
    }> = {};

    let staleUnitCount = 0;

    for (const unit of units || []) {
      const insight = await getUnitCompetitiveInsight(
        unit.name,
        unit.faction || faction,
        subfaction
      );

      if (insight) {
        unitContexts[unit.name] = {
          context: insight, // Pass the full UnitCompetitiveInsight object
          unitName: unit.name,
        };

        if (insight.hasStaleData) {
          staleUnitCount++;
        }
      }
    }

    // Calculate overall stats
    const unitsWithContext = Object.keys(unitContexts).length;
    const hasAnyContext = factionContext !== null || unitsWithContext > 0;

    // Calculate overall confidence
    let totalConfidence = 0;
    let contextCount = 0;

    for (const { context } of Object.values(unitContexts)) {
      if (context.tierConfidence > 0) {
        totalConfidence += context.tierConfidence;
        contextCount++;
      }
    }

    if (factionContext && factionContext.metaConfidence > 0) {
      totalConfidence += factionContext.metaConfidence;
      contextCount++;
    }

    const overallConfidence = contextCount > 0 ? Math.round(totalConfidence / contextCount) : 0;

    return NextResponse.json({
      success: true,
      hasAnyContext,
      factionContext: factionContext ? {
        metaTier: factionContext.metaTier,
        metaTierReasoning: factionContext.metaTierReasoning,
        metaConfidence: factionContext.metaConfidence,
        playstyleArchetype: factionContext.playstyleArchetype,
        strengths: factionContext.strengths,
        weaknesses: factionContext.weaknesses,
        recommendedDetachments: factionContext.recommendedDetachments,
        mustTakeUnits: factionContext.mustTakeUnits,
        avoidUnits: factionContext.avoidUnits,
        sources: factionContext.sources.map(s => ({
          authorName: s.authorName,
          sourceType: s.sourceType,
          gameVersion: s.gameVersion,
          isStale: s.isStale,
        })),
        hasStaleData: factionContext.hasStaleData,
      } : null,
      unitContexts,
      stats: {
        unitsWithContext,
        totalUnits: units?.length || 0,
        staleUnitCount,
        factionIsStale: factionContext?.hasStaleData || false,
        overallConfidence,
      },
    });
  } catch (error) {
    console.error('Error in competitive context lookup:', error);
    return NextResponse.json(
      { error: 'Failed to look up competitive context' },
      { status: 500 }
    );
  }
}

