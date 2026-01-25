import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicStorageUrl } from '@/lib/supabase/storagePublicUrl';
import fs from 'fs-extra';
import path from 'path';

export async function GET() {
  try {
    // 1. Fetch all datasheets
    const datasheets = await prisma.datasheet.findMany({
      select: {
        id: true,
        name: true,
        faction: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 2. Fetch global icons from database (raw SQL to avoid Prisma Client regen dependency on Windows)
    type GlobalIconRow = { unitName: string; faction: string; bucket: string; path: string; updatedAt: Date };
    const globalIcons = await prisma.$queryRaw<GlobalIconRow[]>`
      select
        "unitName" as "unitName",
        faction,
        bucket,
        path,
        "updatedAt"
      from public."GlobalUnitIcon"
    `;

    const globalIconsMap = new Map<string, { url: string; updatedAt: Date }>();
    for (const icon of globalIcons) {
      const key = `${icon.faction}:${icon.unitName}`;
      globalIconsMap.set(key, {
        url: getPublicStorageUrl(icon.bucket, icon.path),
        updatedAt: icon.updatedAt,
      });
    }

    // 3. Scan public/icons directory to find existing legacy icons
    const publicDir = path.join(process.cwd(), 'public');
    const iconsDir = path.join(publicDir, 'icons');
    const filesystemIcons = new Set<string>();

    if (await fs.pathExists(iconsDir)) {
      const factions = await fs.readdir(iconsDir);
      
      for (const factionDir of factions) {
        const factionPath = path.join(iconsDir, factionDir);
        const stat = await fs.stat(factionPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(factionPath);
          for (const file of files) {
            if (file.endsWith('.png')) {
              // key: faction_slug/unit_slug.png
              filesystemIcons.add(`${factionDir}/${file}`);
            }
          }
        }
      }
    }

    // 4. Map datasheets to status - check global database first, then filesystem
    const units = datasheets.map((ds) => {
      const safeFaction = ds.faction.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const safeUnitName = ds.name.replace(/[^a-z0-9]/gi, '_');
      const filesystemKey = `${safeFaction}/${safeUnitName}.png`;
      const dbKey = `${ds.faction}:${ds.name}`;
      
      // Check database first (global icons)
      const dbIcon = globalIconsMap.get(dbKey);
      if (dbIcon) {
        // Add cache-busting query param using updatedAt timestamp
        const cacheBuster = new Date(dbIcon.updatedAt).getTime();
        return {
          id: ds.id,
          name: ds.name,
          faction: ds.faction,
          hasIcon: true,
          iconUrl: `${dbIcon.url}?v=${cacheBuster}`,
        };
      }
      
      // Fall back to filesystem
      const hasFilesystemIcon = filesystemIcons.has(filesystemKey);
      const iconUrl = hasFilesystemIcon ? `/icons/${filesystemKey}` : null;

      return {
        id: ds.id,
        name: ds.name,
        faction: ds.faction,
        hasIcon: hasFilesystemIcon,
        iconUrl,
      };
    });

    return NextResponse.json({ units });
  } catch (error: any) {
    console.error('Unit Status Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch unit status' },
      { status: 500 }
    );
  }
}

