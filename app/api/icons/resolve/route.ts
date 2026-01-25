/**
 * GET /api/icons/resolve?unitName=X&faction=Y&datasheetId=Z
 * 
 * Resolves the icon URL for a unit, checking user's custom icons first
 * Returns null if no custom icon exists
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOptionalAuth } from '@/lib/auth/apiAuth';
import { prisma } from '@/lib/prisma';
import { getPublicStorageUrl } from '@/lib/supabase/storagePublicUrl';
import fs from 'fs';
import path from 'path';

function getFactionVariants(faction: string): string[] {
  const raw = (faction || '').trim();
  const variants = new Set<string>();
  if (raw) variants.add(raw);

  // If "Space Marines (Space Wolves)" style, try base and inner
  const paren = raw.match(/\((.*?)\)/);
  const base = raw.replace(/\(.*?\)/g, '').trim();
  const inner = (paren?.[1] || '').trim();

  if (base) variants.add(base);
  if (inner) variants.add(inner);
  
  // Handle Space Marines subfactions - they may be stored as "Space Marines" globally
  const spaceMarineSubfactions = [
    'Space Wolves', 'Blood Angels', 'Dark Angels', 'Black Templars',
    'Salamanders', 'Imperial Fists', 'Iron Hands', 'Ultramarines',
    'White Scars', 'Raven Guard', 'Deathwatch'
  ];
  
  const lowerFaction = raw.toLowerCase();
  const isSubfaction = spaceMarineSubfactions.some(sf => lowerFaction.includes(sf.toLowerCase()));
  if (isSubfaction) {
    variants.add('Space Marines');
  }
  
  // Also handle case variations
  const titleCase = raw.replace(/\b\w/g, l => l.toUpperCase());
  if (titleCase !== raw) variants.add(titleCase);
  
  const lowerCase = raw.toLowerCase();
  if (lowerCase !== raw) variants.add(lowerCase);

  return Array.from(variants);
}

function getUnitNameVariants(unitName: string): string[] {
  const raw = (unitName || '').trim();
  const variants = new Set<string>();
  if (raw) variants.add(raw);

  // If the name includes a trailing count "(10)" or similar, strip it as a fallback.
  const stripped = raw.replace(/\s*\(\s*\d+\s*\)\s*$/g, '').trim();
  if (stripped && stripped !== raw) variants.add(stripped);

  // Handle case variations: "with" vs "With", "in" vs "In", etc.
  // Try Title Case version
  const titleCase = raw.replace(/\b\w/g, l => l.toUpperCase());
  if (titleCase !== raw) variants.add(titleCase);
  
  // Try lowercasing common prepositions that might differ
  const normalizedPrepositions = raw
    .replace(/\bWith\b/gi, 'with')
    .replace(/\bIn\b/gi, 'in')
    .replace(/\bOf\b/gi, 'of')
    .replace(/\bThe\b/gi, 'the')
    .replace(/\bAnd\b/gi, 'and');
  if (normalizedPrepositions !== raw) {
    variants.add(normalizedPrepositions);
    // Also try title case with normalized prepositions
    const titleNormalized = normalizedPrepositions.replace(/\b\w/g, l => l.toUpperCase());
    if (titleNormalized !== normalizedPrepositions) variants.add(titleNormalized);
  }
  
  // Also add a fully title-cased version where prepositions stay lowercase (proper title case)
  const properTitleCase = raw
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\b(With|In|Of|The|And|On|For|To|A|An)\b/gi, m => m.toLowerCase());
  if (properTitleCase !== raw) variants.add(properTitleCase);
  
  // Handle hyphenated names - try with and without proper capitalization
  if (raw.includes('-')) {
    const hyphenNormalized = raw.replace(/-(\w)/g, (_, c) => `-${c.toUpperCase()}`);
    if (hyphenNormalized !== raw) variants.add(hyphenNormalized);
  }

  return Array.from(variants);
}

function getFilesystemIconUrl(faction: string, unitName: string): string | null {
  const factionCandidates = getFactionVariants(faction);
  const unitCandidates = getUnitNameVariants(unitName);

  for (const f of factionCandidates) {
    const safeFaction = f.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    for (const u of unitCandidates) {
      const safeUnitName = u.replace(/[^a-z0-9]/gi, '_');
      const iconPath = path.join(process.cwd(), 'public', 'icons', safeFaction, `${safeUnitName}.png`);
      if (fs.existsSync(iconPath)) {
        return `/icons/${safeFaction}/${safeUnitName}.png`;
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const unitName = searchParams.get('unitName');
    const faction = searchParams.get('faction');
    const datasheetId = searchParams.get('datasheetId');

    if (!unitName || !faction) {
      return NextResponse.json(
        { error: 'Missing required parameters: unitName, faction' },
        { status: 400 }
      );
    }

    // 1) Global icons (shared) - prefer these for everyone
    const factionCandidates = getFactionVariants(faction);
    const unitCandidates = getUnitNameVariants(unitName);

    type GlobalIconRow = { bucket: string; path: string; updatedAt: Date };
    let globalIcon: GlobalIconRow | null = null;

    if (datasheetId) {
      const byDs = await prisma.$queryRaw<GlobalIconRow[]>`
        select bucket, path, "updatedAt"
        from public."GlobalUnitIcon"
        where "datasheetId" = ${datasheetId}
        limit 1
      `;
      globalIcon = byDs[0] || null;
    }

    if (!globalIcon) {
      const fCandidates = factionCandidates.map((x) => x.toLowerCase().trim());
      const uCandidates = unitCandidates.map((x) => x.toLowerCase().trim());

      const byName = await prisma.$queryRaw<GlobalIconRow[]>`
        select bucket, path, "updatedAt"
        from public."GlobalUnitIcon"
        where lower(faction) = any(${fCandidates})
          and lower("unitName") = any(${uCandidates})
        limit 1
      `;
      globalIcon = byName[0] || null;
    }

    if (globalIcon?.bucket && globalIcon?.path) {
      const cacheBuster = new Date(globalIcon.updatedAt).getTime();
      return NextResponse.json({ iconUrl: `${getPublicStorageUrl(globalIcon.bucket, globalIcon.path)}?v=${cacheBuster}` });
    }

    // Get authenticated user
    const user = await getOptionalAuth();

    if (!user) {
      // No user = filesystem fallback only
      return NextResponse.json({ iconUrl: getFilesystemIconUrl(faction, unitName) });
    }

    // 2) User icon (future override support)
    const orCombos = factionCandidates.flatMap(f =>
      unitCandidates.map(u => ({
        faction: { equals: f, mode: 'insensitive' as const },
        unitName: { equals: u, mode: 'insensitive' as const },
      }))
    );

    const icon = await prisma.unitIcon.findFirst({
      where: {
        userId: user.id,
        OR: orCombos.length > 0 ? orCombos : undefined,
      },
      select: {
        blobUrl: true,
      },
    });

    return NextResponse.json({
      iconUrl: icon?.blobUrl || getFilesystemIconUrl(faction, unitName),
    });

  } catch (error) {
    console.error('Error resolving icon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/icons/resolve
 * 
 * Batch resolve icons for multiple units
 * Body: { units: [{ unitName, faction }] }
 */
export async function POST(request: NextRequest) {
  try {
    const { units } = await request.json();

    if (!units || !Array.isArray(units)) {
      return NextResponse.json(
        { error: 'Missing required field: units (array)' },
        { status: 400 }
      );
    }

    if (units.length === 0) {
      return NextResponse.json({ icons: {} });
    }

    // Build response map
    const iconMap: Record<string, string | null> = {};
    const globalResolved = new Set<string>();

    // Initialize all with filesystem fallback
    units.forEach((unit: { unitName: string; faction: string }) => {
      const key = `${unit.faction}:${unit.unitName}`;
      iconMap[key] = getFilesystemIconUrl(unit.faction, unit.unitName);
    });

    // Fetch global icons (shared)
    type GlobalIconListRow = { unitName: string; faction: string; bucket: string; path: string; updatedAt: Date };
    const allFactionCandidates = Array.from(
      new Set(
        units
          .flatMap((u: { unitName: string; faction: string }) => getFactionVariants(u.faction))
          .map((x) => x.toLowerCase().trim())
          .filter(Boolean)
      )
    );
    const allUnitCandidates = Array.from(
      new Set(
        units
          .flatMap((u: { unitName: string; faction: string }) => getUnitNameVariants(u.unitName))
          .map((x) => x.toLowerCase().trim())
          .filter(Boolean)
      )
    );

    const globalIcons = await prisma.$queryRaw<GlobalIconListRow[]>`
      select faction, "unitName" as "unitName", bucket, path, "updatedAt"
      from public."GlobalUnitIcon"
      where lower(faction) = any(${allFactionCandidates})
        and lower("unitName") = any(${allUnitCandidates})
    `;

    // Get authenticated user
    const user = await getOptionalAuth();

    const icons = user
      ? await prisma.unitIcon.findMany({
          where: {
            userId: user.id,
            OR: units.flatMap((unit: { unitName: string; faction: string }) => {
              const fCandidates = getFactionVariants(unit.faction);
              const uCandidates = getUnitNameVariants(unit.unitName);
              return fCandidates.flatMap(f =>
                uCandidates.map(u => ({
                  faction: { equals: f, mode: 'insensitive' as const },
                  unitName: { equals: u, mode: 'insensitive' as const },
                }))
              );
            }),
          },
          select: {
            unitName: true,
            faction: true,
            blobUrl: true,
          },
        })
      : [];

    // Fill in found global icons by best-effort match back to each request key
    units.forEach((unit: { unitName: string; faction: string }) => {
      const requestKey = `${unit.faction}:${unit.unitName}`;
      const fCandidates = getFactionVariants(unit.faction).map(x => x.toLowerCase().trim());
      const uCandidates = getUnitNameVariants(unit.unitName).map(x => x.toLowerCase().trim());

      const foundGlobal = globalIcons.find((i) => {
        const f = (i.faction || '').toLowerCase().trim();
        const u = (i.unitName || '').toLowerCase().trim();
        return fCandidates.includes(f) && uCandidates.includes(u);
      });

      if (foundGlobal?.bucket && foundGlobal?.path) {
        const cacheBuster = new Date(foundGlobal.updatedAt).getTime();
        iconMap[requestKey] = `${getPublicStorageUrl(foundGlobal.bucket, foundGlobal.path)}?v=${cacheBuster}`;
        globalResolved.add(requestKey);
      }
    });

    // Fill in found user icons by best-effort match back to each request key (only if no global icon)
    units.forEach((unit: { unitName: string; faction: string }) => {
      const requestKey = `${unit.faction}:${unit.unitName}`;
      if (globalResolved.has(requestKey)) {
        return;
      }

      const fCandidates = getFactionVariants(unit.faction).map(x => x.toLowerCase().trim());
      const uCandidates = getUnitNameVariants(unit.unitName).map(x => x.toLowerCase().trim());

      const found = icons.find(i => {
        const f = (i.faction || '').toLowerCase().trim();
        const u = (i.unitName || '').toLowerCase().trim();
        return fCandidates.includes(f) && uCandidates.includes(u);
      });

      if (found?.blobUrl) {
        iconMap[requestKey] = found.blobUrl;
      }
    });

    return NextResponse.json({ icons: iconMap });

  } catch (error) {
    console.error('Error batch resolving icons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
