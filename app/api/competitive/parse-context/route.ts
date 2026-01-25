/**
 * Competitive Context API: Parse Transcript
 * POST /api/competitive/parse-context
 * 
 * Parses a stored transcript using LLM to extract competitive insights.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import {
  parseCompetitiveContext,
  parseCompetitiveContextChunked,
  ExtractedUnitContext,
  ExtractedFactionContext,
} from '@/lib/competitiveContextParser';

interface ParseContextBody {
  sourceId: string;
  useChunking?: boolean;
  maxChunkSize?: number;
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const body: ParseContextBody = await request.json();
      const { sourceId, useChunking = false, maxChunkSize = 500000 } = body;

      if (!sourceId) {
        return NextResponse.json(
          { error: 'Source ID is required' },
          { status: 400 }
        );
      }

      // Get the source
      const source = await prisma.competitiveSource.findUnique({
        where: { id: sourceId },
      });

      if (!source) {
        return NextResponse.json(
          { error: 'Source not found' },
          { status: 404 }
        );
      }

      if (!source.content) {
        return NextResponse.json(
          { error: 'Source has no content - fetch it first' },
          { status: 400 }
        );
      }

      console.log(`🎯 Parsing context for: ${source.contentTitle}`);

      // Parse the content
      const result = useChunking
        ? await parseCompetitiveContextChunked(
            source.content,
            source.contentTitle || 'Unknown',
            source.authorName || 'Unknown',
            source.gameVersion || undefined,
            source.id,
            maxChunkSize
          )
        : await parseCompetitiveContext(
            source.content,
            source.contentTitle || 'Unknown',
            source.authorName || 'Unknown',
            source.gameVersion || undefined,
            source.id
          );

      if (!result.success) {
        // Update source with error
        await prisma.competitiveSource.update({
          where: { id: sourceId },
          data: {
            status: 'error',
            errorMessage: result.error,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json(
          { error: result.error || 'Parsing failed' },
          { status: 500 }
        );
      }

      // Store extracted contexts in database
      const createdUnitContexts: string[] = [];
      const createdFactionContexts: string[] = [];

      // Create unit contexts
      for (const unitCtx of result.unitContexts) {
        try {
          // Try to find matching datasheet
          const datasheet = await prisma.datasheet.findFirst({
            where: {
              name: { equals: unitCtx.unitName, mode: 'insensitive' },
              OR: [
                { faction: { equals: unitCtx.faction, mode: 'insensitive' } },
                { subfaction: { equals: unitCtx.subfaction, mode: 'insensitive' } },
              ],
            },
          });

          const created = await prisma.unitCompetitiveContext.upsert({
            where: {
              unitName_faction_sourceId: {
                unitName: unitCtx.unitName,
                faction: unitCtx.faction,
                sourceId: source.id,
              },
            },
            create: {
              unitName: unitCtx.unitName,
              faction: unitCtx.faction,
              subfaction: unitCtx.subfaction,
              datasheetId: datasheet?.id,
              tierRank: unitCtx.tierRank,
              tierReasoning: unitCtx.tierReasoning,
              tierContext: unitCtx.tierContext,
              bestTargets: unitCtx.bestTargets ? JSON.stringify(unitCtx.bestTargets) : null,
              counters: unitCtx.counters ? JSON.stringify(unitCtx.counters) : null,
              avoidTargets: unitCtx.avoidTargets ? JSON.stringify(unitCtx.avoidTargets) : null,
              synergies: unitCtx.synergies ? JSON.stringify(unitCtx.synergies) : null,
              synergyNotes: unitCtx.synergyNotes,
              playstyleNotes: unitCtx.playstyleNotes,
              deploymentTips: unitCtx.deploymentTips,
              pointsEfficiency: unitCtx.pointsEfficiency,
              pointsNotes: unitCtx.pointsNotes,
              timestamp: unitCtx.timestamp,
              confidence: unitCtx.confidence,
              needsReview: true,
              clarifyingQuestions: unitCtx.clarifyingQuestions 
                ? JSON.stringify(unitCtx.clarifyingQuestions) 
                : null,
              gameVersion: source.gameVersion,
              sourceId: source.id,
            },
            update: {
              tierRank: unitCtx.tierRank,
              tierReasoning: unitCtx.tierReasoning,
              tierContext: unitCtx.tierContext,
              bestTargets: unitCtx.bestTargets ? JSON.stringify(unitCtx.bestTargets) : null,
              counters: unitCtx.counters ? JSON.stringify(unitCtx.counters) : null,
              avoidTargets: unitCtx.avoidTargets ? JSON.stringify(unitCtx.avoidTargets) : null,
              synergies: unitCtx.synergies ? JSON.stringify(unitCtx.synergies) : null,
              synergyNotes: unitCtx.synergyNotes,
              playstyleNotes: unitCtx.playstyleNotes,
              deploymentTips: unitCtx.deploymentTips,
              pointsEfficiency: unitCtx.pointsEfficiency,
              pointsNotes: unitCtx.pointsNotes,
              timestamp: unitCtx.timestamp,
              confidence: unitCtx.confidence,
              datasheetId: datasheet?.id,
              gameVersion: source.gameVersion,
              updatedAt: new Date(),
            },
          });

          createdUnitContexts.push(created.id);
        } catch (err) {
          console.error(`Failed to store unit context for ${unitCtx.unitName}:`, err);
        }
      }

      // Create faction contexts
      for (const factionCtx of result.factionContexts) {
        try {
          const created = await prisma.factionCompetitiveContext.upsert({
            where: {
              factionName_subfaction_sourceId: {
                factionName: factionCtx.factionName,
                subfaction: factionCtx.subfaction || '',
                sourceId: source.id,
              },
            },
            create: {
              factionName: factionCtx.factionName,
              subfaction: factionCtx.subfaction,
              metaTier: factionCtx.metaTier,
              metaTierReasoning: factionCtx.metaTierReasoning,
              metaPosition: factionCtx.metaPosition,
              playstyleArchetype: factionCtx.playstyleArchetype,
              playstyleNotes: factionCtx.playstyleNotes,
              strengths: factionCtx.strengths ? JSON.stringify(factionCtx.strengths) : null,
              weaknesses: factionCtx.weaknesses ? JSON.stringify(factionCtx.weaknesses) : null,
              recommendedDetachments: factionCtx.recommendedDetachments 
                ? JSON.stringify(factionCtx.recommendedDetachments) 
                : null,
              detachmentNotes: factionCtx.detachmentNotes,
              favorableMatchups: factionCtx.favorableMatchups 
                ? JSON.stringify(factionCtx.favorableMatchups) 
                : null,
              unfavorableMatchups: factionCtx.unfavorableMatchups 
                ? JSON.stringify(factionCtx.unfavorableMatchups) 
                : null,
              matchupNotes: factionCtx.matchupNotes,
              mustTakeUnits: factionCtx.mustTakeUnits 
                ? JSON.stringify(factionCtx.mustTakeUnits) 
                : null,
              avoidUnits: factionCtx.avoidUnits 
                ? JSON.stringify(factionCtx.avoidUnits) 
                : null,
              sleepHitUnits: factionCtx.sleeperHitUnits 
                ? JSON.stringify(factionCtx.sleeperHitUnits) 
                : null,
              confidence: factionCtx.confidence,
              needsReview: true,
              clarifyingQuestions: factionCtx.clarifyingQuestions 
                ? JSON.stringify(factionCtx.clarifyingQuestions) 
                : null,
              gameVersion: source.gameVersion,
              sourceId: source.id,
            },
            update: {
              metaTier: factionCtx.metaTier,
              metaTierReasoning: factionCtx.metaTierReasoning,
              metaPosition: factionCtx.metaPosition,
              playstyleArchetype: factionCtx.playstyleArchetype,
              playstyleNotes: factionCtx.playstyleNotes,
              strengths: factionCtx.strengths ? JSON.stringify(factionCtx.strengths) : null,
              weaknesses: factionCtx.weaknesses ? JSON.stringify(factionCtx.weaknesses) : null,
              recommendedDetachments: factionCtx.recommendedDetachments 
                ? JSON.stringify(factionCtx.recommendedDetachments) 
                : null,
              detachmentNotes: factionCtx.detachmentNotes,
              favorableMatchups: factionCtx.favorableMatchups 
                ? JSON.stringify(factionCtx.favorableMatchups) 
                : null,
              unfavorableMatchups: factionCtx.unfavorableMatchups 
                ? JSON.stringify(factionCtx.unfavorableMatchups) 
                : null,
              matchupNotes: factionCtx.matchupNotes,
              mustTakeUnits: factionCtx.mustTakeUnits 
                ? JSON.stringify(factionCtx.mustTakeUnits) 
                : null,
              avoidUnits: factionCtx.avoidUnits 
                ? JSON.stringify(factionCtx.avoidUnits) 
                : null,
              sleepHitUnits: factionCtx.sleeperHitUnits 
                ? JSON.stringify(factionCtx.sleeperHitUnits) 
                : null,
              confidence: factionCtx.confidence,
              gameVersion: source.gameVersion,
              updatedAt: new Date(),
            },
          });

          createdFactionContexts.push(created.id);
        } catch (err) {
          console.error(`Failed to store faction context for ${factionCtx.factionName}:`, err);
        }
      }

      // Update source status
      await prisma.competitiveSource.update({
        where: { id: sourceId },
        data: {
          status: 'parsed',
          extractedAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        sourceId,
        result: {
          unitContextsCreated: createdUnitContexts.length,
          factionContextsCreated: createdFactionContexts.length,
          overallConfidence: result.overallConfidence,
          clarifyingQuestionsCount: result.clarifyingQuestions.length,
          parsingNotes: result.parsingNotes,
        },
        clarifyingQuestions: result.clarifyingQuestions,
      });
    } catch (error) {
      console.error('Error in parse-context:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/competitive/parse-context?sourceId=xxx
 * Get parsed contexts for a source
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId parameter required' },
        { status: 400 }
      );
    }

    const source = await prisma.competitiveSource.findUnique({
      where: { id: sourceId },
      include: {
        unitContexts: {
          orderBy: { confidence: 'desc' },
        },
        factionContexts: {
          orderBy: { confidence: 'desc' },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields for convenience
    const unitContexts = source.unitContexts.map((ctx) => ({
      ...ctx,
      bestTargets: ctx.bestTargets ? JSON.parse(ctx.bestTargets) : null,
      counters: ctx.counters ? JSON.parse(ctx.counters) : null,
      avoidTargets: ctx.avoidTargets ? JSON.parse(ctx.avoidTargets) : null,
      synergies: ctx.synergies ? JSON.parse(ctx.synergies) : null,
      clarifyingQuestions: ctx.clarifyingQuestions 
        ? JSON.parse(ctx.clarifyingQuestions) 
        : null,
      phasePriority: ctx.phasePriority ? JSON.parse(ctx.phasePriority) : null,
    }));

    const factionContexts = source.factionContexts.map((ctx) => ({
      ...ctx,
      strengths: ctx.strengths ? JSON.parse(ctx.strengths) : null,
      weaknesses: ctx.weaknesses ? JSON.parse(ctx.weaknesses) : null,
      recommendedDetachments: ctx.recommendedDetachments 
        ? JSON.parse(ctx.recommendedDetachments) 
        : null,
      favorableMatchups: ctx.favorableMatchups 
        ? JSON.parse(ctx.favorableMatchups) 
        : null,
      unfavorableMatchups: ctx.unfavorableMatchups 
        ? JSON.parse(ctx.unfavorableMatchups) 
        : null,
      mustTakeUnits: ctx.mustTakeUnits ? JSON.parse(ctx.mustTakeUnits) : null,
      avoidUnits: ctx.avoidUnits ? JSON.parse(ctx.avoidUnits) : null,
      sleepHitUnits: ctx.sleepHitUnits ? JSON.parse(ctx.sleepHitUnits) : null,
      clarifyingQuestions: ctx.clarifyingQuestions 
        ? JSON.parse(ctx.clarifyingQuestions) 
        : null,
    }));

    return NextResponse.json({
      success: true,
      source: {
        id: source.id,
        contentTitle: source.contentTitle,
        authorName: source.authorName,
        sourceType: source.sourceType,
        status: source.status,
        gameVersion: source.gameVersion,
        extractedAt: source.extractedAt,
      },
      unitContexts,
      factionContexts,
    });
  });
}

