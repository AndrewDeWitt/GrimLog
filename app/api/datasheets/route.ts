/**
 * GET /api/datasheets?factionId=X&search=name&role=Character
 * POST /api/datasheets - Create a new custom datasheet
 * 
 * List datasheets for the datasheet browser with filtering and search
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth, requireAuth } from '@/lib/auth/apiAuth';
import { CreateDatasheetSchema } from '@/lib/datasheetValidation';
import { randomUUID } from 'crypto';
import { getPublicStorageUrl } from '@/lib/supabase/storagePublicUrl';
import fs from 'fs';
import path from 'path';

/**
 * Check if an icon exists for a unit - checks database first (user icons), then filesystem
 * Returns the URL if found, null otherwise
 */
async function getIconUrl(
  faction: string, 
  unitName: string, 
  userId: string | null
): Promise<string | null> {
  // First check database for global icon
  type GlobalIconRow = { bucket: string; path: string };
  const globalIcons = await prisma.$queryRaw<GlobalIconRow[]>`
    select bucket, path
    from public."GlobalUnitIcon"
    where faction = ${faction}
      and "unitName" = ${unitName}
    limit 1
  `;
  const globalIcon = globalIcons[0] || null;

  if (globalIcon?.bucket && globalIcon?.path) {
    return getPublicStorageUrl(globalIcon.bucket, globalIcon.path);
  }

  // First check database for user-specific icon
  if (userId) {
    const userIcon = await prisma.unitIcon.findUnique({
      where: {
        userId_unitName_faction: {
          userId,
          unitName,
          faction,
        },
      },
      select: { blobUrl: true },
    });
    
    if (userIcon?.blobUrl) {
      return userIcon.blobUrl;
    }
  }
  
  // Fall back to filesystem check (legacy icons)
  const safeFaction = faction.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const safeUnitName = unitName.replace(/[^a-z0-9]/gi, '_');
  const iconPath = path.join(process.cwd(), 'public', 'icons', safeFaction, `${safeUnitName}.png`);
  
  if (fs.existsSync(iconPath)) {
    return `/icons/${safeFaction}/${safeUnitName}.png`;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user for user-specific icons
    const user = await getOptionalAuth();
    const userId = user?.id || null;

    const searchParams = request.nextUrl.searchParams;
    const factionId = searchParams.get('factionId');
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const limit = searchParams.get('limit');
    const includeParent = searchParams.get('includeParent') === 'true';

    // Build faction filter - optionally include parent faction datasheets
    let factionFilter: { factionId?: { in: string[] } } = {};
    
    if (factionId) {
      const factionIds = [factionId];
      
      // If includeParent, also get parent faction datasheets
      if (includeParent) {
        const faction = await prisma.faction.findUnique({
          where: { id: factionId },
          select: { parentFactionId: true, metaData: true }
        });
        
        if (faction?.parentFactionId) {
          factionIds.push(faction.parentFactionId);
        }
      }
      
      factionFilter = { factionId: { in: factionIds } };
    }

    // Build search filter
    const searchFilter = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { keywords: { contains: search, mode: 'insensitive' as const } },
      ]
    } : {};

    // Build role filter
    const roleFilter = role ? { role: { equals: role, mode: 'insensitive' as const } } : {};

    // Query datasheets
    const datasheets = await prisma.datasheet.findMany({
      where: {
        ...factionFilter,
        ...searchFilter,
        ...roleFilter,
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' },
      ],
      take: limit ? parseInt(limit) : 200,
      select: {
        id: true,
        name: true,
        faction: true,
        factionId: true,
        subfaction: true,
        role: true,
        keywords: true,
        movement: true,
        toughness: true,
        save: true,
        invulnerableSave: true,
        wounds: true,
        leadership: true,
        objectiveControl: true,
        pointsCost: true,
        pointsTiers: true,
        composition: true,
        leaderRules: true,      // Who this character can attach to
        leaderAbilities: true,  // Abilities granted when leading
        // Versioning & ownership fields
        isOfficial: true,
        ownerId: true,
        forkedFromId: true,
        currentVersion: true,
        visibility: true,
      },
    });

    // Transform keywords from JSON string and add icon URLs
    const transformedDatasheets = await Promise.all(
      datasheets.map(async ds => ({
        ...ds,
        keywords: JSON.parse(ds.keywords),
        iconUrl: await getIconUrl(ds.faction, ds.name, userId),
      }))
    );

    // Get available roles for filtering UI
    const rolesResult = await prisma.datasheet.groupBy({
      by: ['role'],
      where: factionFilter,
      _count: { role: true },
    });

    const availableRoles = rolesResult.map(r => ({
      role: r.role,
      count: r._count.role,
    }));

    return NextResponse.json({
      count: transformedDatasheets.length,
      datasheets: transformedDatasheets,
      availableRoles,
    });
  } catch (error) {
    console.error('Error fetching datasheets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/datasheets
 * Create a new custom datasheet (requires authentication)
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateDatasheetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Create datasheet with weapons, abilities, and wargear in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the datasheet
      const datasheet = await tx.datasheet.create({
        data: {
          name: data.name,
          faction: data.faction,
          factionId: data.factionId || null,
          subfaction: data.subfaction || null,
          role: data.role,
          keywords: JSON.stringify(data.keywords),
          movement: data.movement,
          toughness: data.toughness,
          save: data.save,
          invulnerableSave: data.invulnerableSave || null,
          wounds: data.wounds,
          leadership: data.leadership,
          objectiveControl: data.objectiveControl,
          composition: data.composition,
          compositionData: data.compositionData || null,
          unitSize: data.unitSize || null,
          leaderRules: data.leaderRules || null,
          leaderAbilities: data.leaderAbilities || null,
          transportCapacity: data.transportCapacity || null,
          pointsCost: data.pointsCost,
          edition: data.edition,
          sourceBook: data.sourceBook || null,
          // Ownership & visibility
          isOfficial: false,
          ownerId: user.id,
          visibility: 'private',
          currentVersion: 1,
        },
      });

      // 2. Create weapons and link to datasheet
      for (const weaponData of data.weapons) {
        // Upsert weapon (in case it already exists)
        const weapon = await tx.weapon.upsert({
          where: { name: weaponData.name },
          update: {
            range: weaponData.range,
            type: weaponData.type,
            attacks: weaponData.attacks,
            ballisticSkill: weaponData.ballisticSkill || null,
            weaponSkill: weaponData.weaponSkill || null,
            strength: weaponData.strength,
            armorPenetration: weaponData.armorPenetration,
            damage: weaponData.damage,
            abilities: JSON.stringify(weaponData.abilities),
          },
          create: {
            name: weaponData.name,
            range: weaponData.range,
            type: weaponData.type,
            attacks: weaponData.attacks,
            ballisticSkill: weaponData.ballisticSkill || null,
            weaponSkill: weaponData.weaponSkill || null,
            strength: weaponData.strength,
            armorPenetration: weaponData.armorPenetration,
            damage: weaponData.damage,
            abilities: JSON.stringify(weaponData.abilities),
          },
        });

        // Create junction
        await tx.datasheetWeapon.create({
          data: {
            datasheetId: datasheet.id,
            weaponId: weapon.id,
            isDefault: weaponData.isDefault,
            quantity: weaponData.quantity || null,
          },
        });
      }

      // 3. Create abilities and link to datasheet
      for (const abilityData of data.abilities) {
        // Upsert ability
        const ability = await tx.ability.upsert({
          where: { name: abilityData.name },
          update: {
            type: abilityData.type,
            description: abilityData.description,
            triggerPhase: abilityData.triggerPhase ? JSON.stringify(abilityData.triggerPhase) : null,
            triggerSubphase: abilityData.triggerSubphase || null,
            isReactive: abilityData.isReactive,
            requiredKeywords: abilityData.requiredKeywords ? JSON.stringify(abilityData.requiredKeywords) : null,
          },
          create: {
            name: abilityData.name,
            type: abilityData.type,
            description: abilityData.description,
            triggerPhase: abilityData.triggerPhase ? JSON.stringify(abilityData.triggerPhase) : null,
            triggerSubphase: abilityData.triggerSubphase || null,
            isReactive: abilityData.isReactive,
            requiredKeywords: abilityData.requiredKeywords ? JSON.stringify(abilityData.requiredKeywords) : null,
          },
        });

        // Create junction
        await tx.datasheetAbility.create({
          data: {
            datasheetId: datasheet.id,
            abilityId: ability.id,
            source: abilityData.type,
          },
        });
      }

      // 4. Create wargear options and link to datasheet
      for (const wargearData of data.wargearOptions) {
        const wargearOption = await tx.wargearOption.create({
          data: {
            name: wargearData.name,
            description: wargearData.description,
            pointsCost: wargearData.pointsCost,
            type: wargearData.type,
          },
        });

        await tx.datasheetWargear.create({
          data: {
            datasheetId: datasheet.id,
            wargearOptionId: wargearOption.id,
          },
        });
      }

      // 5. Create initial version snapshot
      const fullDatasheet = await tx.datasheet.findUniqueOrThrow({
        where: { id: datasheet.id },
        include: {
          weapons: { include: { weapon: true } },
          abilities: { include: { ability: true } },
          wargearOptions: { include: { wargearOption: true } },
        },
      });

      const snapshot = {
        id: fullDatasheet.id,
        name: fullDatasheet.name,
        faction: fullDatasheet.faction,
        factionId: fullDatasheet.factionId,
        subfaction: fullDatasheet.subfaction,
        role: fullDatasheet.role,
        keywords: data.keywords,
        movement: fullDatasheet.movement,
        toughness: fullDatasheet.toughness,
        save: fullDatasheet.save,
        invulnerableSave: fullDatasheet.invulnerableSave,
        wounds: fullDatasheet.wounds,
        leadership: fullDatasheet.leadership,
        objectiveControl: fullDatasheet.objectiveControl,
        composition: fullDatasheet.composition,
        compositionData: fullDatasheet.compositionData,
        unitSize: fullDatasheet.unitSize,
        leaderRules: fullDatasheet.leaderRules,
        leaderAbilities: fullDatasheet.leaderAbilities,
        transportCapacity: fullDatasheet.transportCapacity,
        pointsCost: fullDatasheet.pointsCost,
        pointsTiers: fullDatasheet.pointsTiers ? JSON.parse(fullDatasheet.pointsTiers) : null,
        edition: fullDatasheet.edition,
        sourceBook: fullDatasheet.sourceBook,
        weapons: fullDatasheet.weapons.map(dw => ({
          id: dw.weapon.id,
          name: dw.weapon.name,
          range: dw.weapon.range,
          type: dw.weapon.type,
          attacks: dw.weapon.attacks,
          ballisticSkill: dw.weapon.ballisticSkill,
          weaponSkill: dw.weapon.weaponSkill,
          strength: dw.weapon.strength,
          armorPenetration: dw.weapon.armorPenetration,
          damage: dw.weapon.damage,
          abilities: JSON.parse(dw.weapon.abilities),
          isDefault: dw.isDefault,
          quantity: dw.quantity,
        })),
        abilities: fullDatasheet.abilities.map(da => ({
          id: da.ability.id,
          name: da.ability.name,
          type: da.ability.type,
          description: da.ability.description,
          triggerPhase: da.ability.triggerPhase ? JSON.parse(da.ability.triggerPhase) : null,
          source: da.source,
        })),
        wargearOptions: fullDatasheet.wargearOptions.map(dw => ({
          id: dw.wargearOption.id,
          name: dw.wargearOption.name,
          description: dw.wargearOption.description,
          pointsCost: dw.wargearOption.pointsCost,
          type: dw.wargearOption.type,
        })),
      };

      await tx.datasheetVersion.create({
        data: {
          datasheetId: datasheet.id,
          versionNumber: 1,
          versionLabel: 'Initial Version',
          snapshotData: JSON.stringify(snapshot),
          changelog: 'Initial datasheet creation',
          createdById: user.id,
        },
      });

      return fullDatasheet;
    });

    return NextResponse.json({
      success: true,
      datasheet: {
        id: result.id,
        name: result.name,
        faction: result.faction,
        role: result.role,
        pointsCost: result.pointsCost,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating datasheet:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A datasheet with this name already exists for this faction' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create datasheet' },
      { status: 500 }
    );
  }
}
