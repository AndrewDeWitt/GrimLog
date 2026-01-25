/**
 * API Route: Import from Wahapedia
 * 
 * POST /api/admin/import/wahapedia
 * 
 * Triggers a scrape from Wahapedia and imports the data into the database.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

// Import types from our scripts (we'll inline the key logic here for serverless compatibility)
interface StratagemInput {
  name: string;
  cpCost: number;
  type: 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear';
  when: string;
  target: string;
  effect: string;
  restrictions?: string | null;
  keywords?: string[] | null;
  triggerPhase?: string[] | null;
  isReactive?: boolean;
  usageRestriction?: string | null;
}

interface EnhancementInput {
  name: string;
  pointsCost: number;
  description: string;
  restrictions?: string[] | null;
  keywords?: string[] | null;
}

interface DetachmentInput {
  name: string;
  subfaction?: string | null;
  abilityName?: string | null;
  abilityDescription?: string | null;
  description?: string | null;
  stratagems: StratagemInput[];
  enhancements?: EnhancementInput[];
}

interface FactionInput {
  name: string;
  keywords: string[];
  parentFaction?: string | null;
  isDivergent?: boolean;
}

interface ImportData {
  faction: FactionInput;
  detachments: DetachmentInput[];
}

// Faction configurations
const FACTION_CONFIGS: Record<string, { name: string; slug: string; keywords: string[]; parentFaction?: string; isDivergent?: boolean }> = {
  'tyranids': { name: 'Tyranids', slug: 'tyranids', keywords: ['TYRANIDS'] },
  'space-marines': { name: 'Space Marines', slug: 'space-marines', keywords: ['ADEPTUS ASTARTES'] },
  'space-wolves': { name: 'Space Wolves', slug: 'space-marines', keywords: ['SPACE WOLVES', 'ADEPTUS ASTARTES'], parentFaction: 'Space Marines', isDivergent: true },
  'blood-angels': { name: 'Blood Angels', slug: 'space-marines', keywords: ['BLOOD ANGELS', 'ADEPTUS ASTARTES'], parentFaction: 'Space Marines', isDivergent: true },
  'dark-angels': { name: 'Dark Angels', slug: 'space-marines', keywords: ['DARK ANGELS', 'ADEPTUS ASTARTES'], parentFaction: 'Space Marines', isDivergent: true },
  'astra-militarum': { name: 'Astra Militarum', slug: 'astra-militarum', keywords: ['ASTRA MILITARUM'] },
  'orks': { name: 'Orks', slug: 'orks', keywords: ['ORKS'] },
  'necrons': { name: 'Necrons', slug: 'necrons', keywords: ['NECRONS'] },
  'aeldari': { name: 'Aeldari', slug: 'aeldari', keywords: ['AELDARI'] },
  'chaos-space-marines': { name: 'Chaos Space Marines', slug: 'chaos-space-marines', keywords: ['HERETIC ASTARTES'] },
  'tau-empire': { name: "T'au Empire", slug: 'tau-empire', keywords: ['TAU EMPIRE'] },
  'adeptus-custodes': { name: 'Adeptus Custodes', slug: 'adeptus-custodes', keywords: ['ADEPTUS CUSTODES'] },
  'grey-knights': { name: 'Grey Knights', slug: 'grey-knights', keywords: ['GREY KNIGHTS'] },
  'adepta-sororitas': { name: 'Adepta Sororitas', slug: 'adepta-sororitas', keywords: ['ADEPTA SORORITAS'] },
};

async function checkAdminAuth(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
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

async function importFactionData(
  data: ImportData,
  options: { update: boolean }
): Promise<{ success: boolean; stats: Record<string, unknown> }> {
  const stats = {
    faction: { created: false, updated: false, name: data.faction.name },
    detachments: { created: 0, updated: 0, skipped: 0 },
    stratagems: { created: 0, updated: 0, skipped: 0 },
    enhancements: { created: 0, updated: 0, skipped: 0 },
  };

  // Step 1: Create/Update Faction
  let parentFactionId: string | null = null;
  if (data.faction.parentFaction) {
    const parent = await prisma.faction.findUnique({
      where: { name: data.faction.parentFaction }
    });
    if (parent) {
      parentFactionId = parent.id;
    }
  }

  const factionMetaData = JSON.stringify({
    keywords: data.faction.keywords,
    isDivergent: data.faction.isDivergent ?? false,
  });

  let faction = await prisma.faction.findUnique({
    where: { name: data.faction.name }
  });

  if (faction) {
    if (options.update) {
      faction = await prisma.faction.update({
        where: { id: faction.id },
        data: { metaData: factionMetaData, parentFactionId }
      });
      stats.faction.updated = true;
    }
  } else {
    faction = await prisma.faction.create({
      data: {
        name: data.faction.name,
        metaData: factionMetaData,
        parentFactionId,
      }
    });
    stats.faction.created = true;
  }

  const factionId = faction.id;

  // Step 2: Process Detachments
  for (const detInput of data.detachments) {
    let detachment = await prisma.detachment.findFirst({
      where: { name: detInput.name, faction: data.faction.name }
    });

    if (detachment) {
      if (options.update) {
        detachment = await prisma.detachment.update({
          where: { id: detachment.id },
          data: {
            subfaction: detInput.subfaction ?? null,
            abilityName: detInput.abilityName ?? null,
            abilityDescription: detInput.abilityDescription ?? null,
            description: detInput.description ?? null,
            factionId,
          }
        });
        stats.detachments.updated++;
      } else {
        stats.detachments.skipped++;
      }
    } else {
      detachment = await prisma.detachment.create({
        data: {
          name: detInput.name,
          faction: data.faction.name,
          factionId,
          subfaction: detInput.subfaction ?? null,
          abilityName: detInput.abilityName ?? null,
          abilityDescription: detInput.abilityDescription ?? null,
          description: detInput.description ?? null,
          edition: '10th',
        }
      });
      stats.detachments.created++;
    }

    const detachmentId = detachment.id;

    // Process Stratagems
    for (const stratInput of detInput.stratagems) {
      const existing = await prisma.stratagemData.findFirst({
        where: {
          name: stratInput.name,
          faction: data.faction.name,
          detachment: detInput.name,
        }
      });

      const stratData = {
        name: stratInput.name,
        faction: data.faction.name,
        factionId,
        detachment: detInput.name,
        detachmentId,
        cpCost: stratInput.cpCost,
        type: stratInput.type,
        when: stratInput.when,
        target: stratInput.target,
        effect: stratInput.effect,
        restrictions: stratInput.restrictions ?? null,
        keywords: stratInput.keywords ? JSON.stringify(stratInput.keywords) : null,
        triggerPhase: stratInput.triggerPhase ? JSON.stringify(stratInput.triggerPhase) : null,
        isReactive: stratInput.isReactive ?? false,
        usageRestriction: stratInput.usageRestriction ?? null,
        edition: '10th',
      };

      if (existing) {
        if (options.update) {
          await prisma.stratagemData.update({
            where: { id: existing.id },
            data: stratData,
          });
          stats.stratagems.updated++;
        } else {
          stats.stratagems.skipped++;
        }
      } else {
        await prisma.stratagemData.create({ data: stratData });
        stats.stratagems.created++;
      }
    }

    // Process Enhancements
    const enhancements = detInput.enhancements ?? [];
    for (const enhInput of enhancements) {
      const existing = await prisma.enhancement.findFirst({
        where: {
          name: enhInput.name,
          faction: data.faction.name,
          detachment: detInput.name,
        }
      });

      const enhData = {
        name: enhInput.name,
        faction: data.faction.name,
        factionId,
        detachment: detInput.name,
        detachmentId,
        pointsCost: enhInput.pointsCost,
        description: enhInput.description,
        restrictions: enhInput.restrictions ? JSON.stringify(enhInput.restrictions) : '[]',
        keywords: enhInput.keywords ? JSON.stringify(enhInput.keywords) : null,
        edition: '10th',
      };

      if (existing) {
        if (options.update) {
          await prisma.enhancement.update({
            where: { id: existing.id },
            data: enhData,
          });
          stats.enhancements.updated++;
        } else {
          stats.enhancements.skipped++;
        }
      } else {
        await prisma.enhancement.create({ data: enhData });
        stats.enhancements.created++;
      }
    }
  }

  return { success: true, stats };
}

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const { isAdmin } = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { factionKey, update = false, data: providedData } = body;

    if (!factionKey && !providedData) {
      return NextResponse.json(
        { error: 'Missing factionKey or data in request body' },
        { status: 400 }
      );
    }

    // If data is provided directly, use it; otherwise construct from factionKey
    let importData: ImportData;

    if (providedData) {
      importData = providedData;
    } else {
      // Use the faction config to build a basic import structure
      const config = FACTION_CONFIGS[factionKey];
      if (!config) {
        return NextResponse.json(
          { error: `Unknown faction: ${factionKey}. Available: ${Object.keys(FACTION_CONFIGS).join(', ')}` },
          { status: 400 }
        );
      }

      // Note: In a real implementation, this would call the scraper
      // For the API route, we expect the client to provide the scraped data
      // or we just create the faction shell
      importData = {
        faction: {
          name: config.name,
          keywords: config.keywords,
          parentFaction: config.parentFaction || null,
          isDivergent: config.isDivergent || false,
        },
        detachments: [],
      };
    }

    // Import the data
    const result = await importFactionData(importData, { update });

    return NextResponse.json({
      success: true,
      message: `Imported faction: ${importData.faction.name}`,
      stats: result.stats,
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Wahapedia Import API',
    availableFactions: Object.keys(FACTION_CONFIGS),
    usage: 'POST with { factionKey: "tyranids", update: false } or { data: ImportData }',
  });
}

