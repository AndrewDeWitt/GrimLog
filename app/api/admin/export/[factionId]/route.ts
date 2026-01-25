/**
 * API Route: Export Faction Data
 * 
 * GET /api/admin/export/[factionId]
 * 
 * Exports faction data as JSON matching the import schema.
 * Useful for backing up data or editing offline.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

async function checkAdminAuth(): Promise<{ isAdmin: boolean; userId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { isAdmin: false };
  }
  
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true }
  });
  
  return { isAdmin: dbUser?.isAdmin ?? false, userId: user.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ factionId: string }> }
) {
  try {
    // Check admin auth
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { factionId } = await params;

    // Get faction with all related data
    const faction = await prisma.faction.findUnique({
      where: { id: factionId },
      include: {
        detachments: {
          include: {
            stratagems: true,
            enhancements: true,
          }
        },
        parentFaction: {
          select: { name: true }
        }
      }
    });

    if (!faction) {
      return NextResponse.json(
        { error: 'Faction not found' },
        { status: 404 }
      );
    }

    // Parse metadata
    let metaData: { keywords?: string[]; isDivergent?: boolean; forbiddenKeywords?: string[] } = {};
    try {
      metaData = faction.metaData ? JSON.parse(faction.metaData) : {};
    } catch {
      console.warn('Failed to parse faction metadata');
    }

    // Build export structure matching import schema
    const exportData = {
      $schema: '../import-schema.json',
      _exportedAt: new Date().toISOString(),
      _factionId: faction.id,
      faction: {
        name: faction.name,
        keywords: metaData.keywords || [],
        parentFaction: faction.parentFaction?.name || null,
        isDivergent: metaData.isDivergent || false,
        forbiddenKeywords: metaData.forbiddenKeywords || [],
      },
      detachments: faction.detachments.map(det => {
        return {
          name: det.name,
          subfaction: det.subfaction,
          abilityName: det.abilityName,
          abilityDescription: det.abilityDescription,
          description: det.description,
          stratagems: det.stratagems.map(strat => {
            let keywords: string[] | null = null;
            let triggerPhase: string[] | null = null;
            
            try {
              keywords = strat.keywords ? JSON.parse(strat.keywords) : null;
            } catch { /* ignore */ }
            
            try {
              triggerPhase = strat.triggerPhase ? JSON.parse(strat.triggerPhase) : null;
            } catch { /* ignore */ }

            return {
              name: strat.name,
              cpCost: strat.cpCost,
              type: strat.type as 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear',
              when: strat.when,
              target: strat.target,
              effect: strat.effect,
              restrictions: strat.restrictions,
              keywords,
              triggerPhase,
              isReactive: strat.isReactive,
              usageRestriction: strat.usageRestriction,
            };
          }),
          enhancements: det.enhancements.map(enh => {
            let restrictions: string[] | null = null;
            let keywords: string[] | null = null;
            
            try {
              restrictions = enh.restrictions ? JSON.parse(enh.restrictions) : null;
            } catch { /* ignore */ }
            
            try {
              keywords = enh.keywords ? JSON.parse(enh.keywords) : null;
            } catch { /* ignore */ }

            return {
              name: enh.name,
              pointsCost: enh.pointsCost,
              description: enh.description,
              restrictions,
              keywords,
            };
          }),
        };
      }),
    };

    // Check if download requested
    const searchParams = request.nextUrl.searchParams;
    const download = searchParams.get('download') === 'true';

    if (download) {
      const filename = `${faction.name.toLowerCase().replace(/\s+/g, '-')}-export.json`;
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(exportData);

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

