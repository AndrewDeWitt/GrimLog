/**
 * API Route: Import from JSON
 * 
 * POST /api/admin/import/json
 * 
 * Imports faction data from a JSON payload.
 * Expects JSON matching the import-schema.json format.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

// Types
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
  forbiddenKeywords?: string[];
}

interface ImportData {
  faction: FactionInput;
  detachments: DetachmentInput[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

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

function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid JSON structure'], warnings: [] };
  }
  
  const d = data as Record<string, unknown>;
  
  // Check required fields
  if (!d.faction || typeof d.faction !== 'object') {
    errors.push('Missing or invalid "faction" object');
  } else {
    const faction = d.faction as Record<string, unknown>;
    if (!faction.name || typeof faction.name !== 'string') {
      errors.push('faction.name is required and must be a string');
    }
    if (!Array.isArray(faction.keywords) || faction.keywords.length === 0) {
      errors.push('faction.keywords is required and must be a non-empty array');
    }
  }
  
  if (!Array.isArray(d.detachments)) {
    errors.push('Missing or invalid "detachments" array');
  } else {
    d.detachments.forEach((det, i) => {
      const detachment = det as Record<string, unknown>;
      if (!detachment.name || typeof detachment.name !== 'string') {
        errors.push(`detachments[${i}].name is required`);
      }
      if (!Array.isArray(detachment.stratagems)) {
        errors.push(`detachments[${i}].stratagems must be an array`);
      } else {
        (detachment.stratagems as unknown[]).forEach((strat, j) => {
          const stratagem = strat as Record<string, unknown>;
          const requiredFields = ['name', 'cpCost', 'type', 'when', 'target', 'effect'];
          requiredFields.forEach(field => {
            if (stratagem[field] === undefined || stratagem[field] === null) {
              errors.push(`detachments[${i}].stratagems[${j}].${field} is required`);
            }
          });
          
          const validTypes = ['Battle Tactic', 'Strategic Ploy', 'Epic Deed', 'Wargear'];
          if (stratagem.type && !validTypes.includes(stratagem.type as string)) {
            warnings.push(`detachments[${i}].stratagems[${j}].type "${stratagem.type}" is non-standard`);
          }
        });
      }
      
      if (detachment.enhancements && Array.isArray(detachment.enhancements)) {
        (detachment.enhancements as unknown[]).forEach((enh, k) => {
          const enhancement = enh as Record<string, unknown>;
          if (!enhancement.name) {
            errors.push(`detachments[${i}].enhancements[${k}].name is required`);
          }
          if (enhancement.pointsCost === undefined) {
            errors.push(`detachments[${i}].enhancements[${k}].pointsCost is required`);
          }
          if (!enhancement.description) {
            errors.push(`detachments[${i}].enhancements[${k}].description is required`);
          }
        });
      }
    });
  }
  
  return { valid: errors.length === 0, errors, warnings };
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
    if (parent) parentFactionId = parent.id;
  }

  const factionMetaData = JSON.stringify({
    keywords: data.faction.keywords,
    isDivergent: data.faction.isDivergent ?? false,
    forbiddenKeywords: data.faction.forbiddenKeywords ?? [],
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
          await prisma.stratagemData.update({ where: { id: existing.id }, data: stratData });
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
    for (const enhInput of detInput.enhancements ?? []) {
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
          await prisma.enhancement.update({ where: { id: existing.id }, data: enhData });
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
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { data, update = false, validate = false } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Missing "data" in request body' },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateImportData(data);
    
    if (validation.warnings.length > 0) {
      console.log('Import warnings:', validation.warnings);
    }
    
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      }, { status: 400 });
    }

    // If just validating, return success
    if (validate) {
      return NextResponse.json({
        success: true,
        message: 'Validation passed',
        warnings: validation.warnings,
        summary: {
          faction: data.faction.name,
          detachments: data.detachments.length,
          stratagems: data.detachments.reduce((sum: number, d: DetachmentInput) => sum + d.stratagems.length, 0),
          enhancements: data.detachments.reduce((sum: number, d: DetachmentInput) => sum + (d.enhancements?.length ?? 0), 0),
        }
      });
    }

    // Import
    const result = await importFactionData(data as ImportData, { update });

    return NextResponse.json({
      success: true,
      message: `Imported faction: ${data.faction.name}`,
      warnings: validation.warnings,
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
    message: 'JSON Import API',
    usage: 'POST with { data: ImportData, update?: boolean, validate?: boolean }',
    schemaUrl: '/data/import-schema.json',
  });
}

