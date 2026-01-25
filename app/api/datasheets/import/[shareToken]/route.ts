/**
 * GET /api/datasheets/import/[shareToken] - Preview shared datasheet
 * POST /api/datasheets/import/[shareToken] - Import (fork) shared datasheet
 * 
 * Import a datasheet via share link
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, getOptionalAuth } from '@/lib/auth/apiAuth';

/**
 * GET - Preview the shared datasheet (no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    // Find datasheet by share token
    const datasheet = await prisma.datasheet.findFirst({
      where: {
        shareToken,
        OR: [
          { visibility: 'link' },
          { visibility: 'public' },
        ],
      },
      include: {
        weapons: {
          include: { weapon: true },
          orderBy: { weapon: { name: 'asc' } },
        },
        abilities: {
          include: { ability: true },
          orderBy: { ability: { name: 'asc' } },
        },
        wargearOptions: {
          include: { wargearOption: true },
        },
        owner: {
          select: { id: true, name: true },
        },
        forkedFrom: {
          select: { id: true, name: true },
        },
      },
    });

    if (!datasheet) {
      return NextResponse.json({ error: 'Shared datasheet not found or link expired' }, { status: 404 });
    }

    // Transform to clean format
    const transformed = {
      id: datasheet.id,
      name: datasheet.name,
      faction: datasheet.faction,
      subfaction: datasheet.subfaction,
      role: datasheet.role,
      keywords: JSON.parse(datasheet.keywords),
      movement: datasheet.movement,
      toughness: datasheet.toughness,
      save: datasheet.save,
      invulnerableSave: datasheet.invulnerableSave,
      wounds: datasheet.wounds,
      leadership: datasheet.leadership,
      objectiveControl: datasheet.objectiveControl,
      composition: datasheet.composition,
      unitSize: datasheet.unitSize,
      leaderRules: datasheet.leaderRules,
      leaderAbilities: datasheet.leaderAbilities,
      transportCapacity: datasheet.transportCapacity,
      pointsCost: datasheet.pointsCost,
      edition: datasheet.edition,
      isOfficial: datasheet.isOfficial,
      currentVersion: datasheet.currentVersion,
      author: datasheet.owner ? {
        id: datasheet.owner.id,
        name: datasheet.owner.name || 'Anonymous',
      } : null,
      forkedFrom: datasheet.forkedFrom ? {
        id: datasheet.forkedFrom.id,
        name: datasheet.forkedFrom.name,
      } : null,
      weapons: datasheet.weapons.map(dw => ({
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
      abilities: datasheet.abilities.map(da => ({
        name: da.ability.name,
        type: da.ability.type,
        description: da.ability.description,
        triggerPhase: da.ability.triggerPhase ? JSON.parse(da.ability.triggerPhase) : null,
        source: da.source,
      })),
      wargearOptions: datasheet.wargearOptions.map(dw => ({
        name: dw.wargearOption.name,
        description: dw.wargearOption.description,
        pointsCost: dw.wargearOption.pointsCost,
        type: dw.wargearOption.type,
      })),
    };

    // Check if user is authenticated to show import button
    const user = await getOptionalAuth();

    return NextResponse.json({
      datasheet: transformed,
      canImport: !!user,
      importMessage: user 
        ? 'Click Import to add this datasheet to your collection'
        : 'Sign in to import this datasheet to your collection',
    });
  } catch (error) {
    console.error('Error fetching shared datasheet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Import (fork) the shared datasheet (auth required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const user = await requireAuth();
    const { shareToken } = await params;

    // Find datasheet by share token
    const source = await prisma.datasheet.findFirst({
      where: {
        shareToken,
        OR: [
          { visibility: 'link' },
          { visibility: 'public' },
        ],
      },
      include: {
        weapons: { include: { weapon: true } },
        abilities: { include: { ability: true } },
        wargearOptions: { include: { wargearOption: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'Shared datasheet not found or link expired' }, { status: 404 });
    }

    // Create imported (forked) datasheet
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique name
      let forkName = `${source.name} (Imported)`;
      const existing = await tx.datasheet.findFirst({
        where: {
          name: forkName,
          faction: source.faction,
          subfaction: source.subfaction,
          ownerId: user.id,
        },
      });

      if (existing) {
        forkName = `${source.name} (Imported ${Date.now().toString(36)})`;
      }

      // Create the imported datasheet
      const imported = await tx.datasheet.create({
        data: {
          name: forkName,
          faction: source.faction,
          factionId: source.factionId,
          subfaction: source.subfaction,
          role: source.role,
          keywords: source.keywords,
          movement: source.movement,
          toughness: source.toughness,
          save: source.save,
          invulnerableSave: source.invulnerableSave,
          wounds: source.wounds,
          leadership: source.leadership,
          objectiveControl: source.objectiveControl,
          composition: source.composition,
          compositionData: source.compositionData,
          unitSize: source.unitSize,
          leaderRules: source.leaderRules,
          leaderAbilities: source.leaderAbilities,
          transportCapacity: source.transportCapacity,
          pointsCost: source.pointsCost,
          edition: source.edition,
          sourceBook: source.sourceBook,
          isOfficial: false,
          ownerId: user.id,
          forkedFromId: source.id,
          currentVersion: 1,
          visibility: 'private',
        },
      });

      // Copy weapon relationships
      for (const dw of source.weapons) {
        await tx.datasheetWeapon.create({
          data: {
            datasheetId: imported.id,
            weaponId: dw.weaponId,
            isDefault: dw.isDefault,
            quantity: dw.quantity,
            notes: dw.notes,
          },
        });
      }

      // Copy ability relationships
      for (const da of source.abilities) {
        await tx.datasheetAbility.create({
          data: {
            datasheetId: imported.id,
            abilityId: da.abilityId,
            source: da.source,
          },
        });
      }

      // Copy wargear relationships
      for (const dw of source.wargearOptions) {
        await tx.datasheetWargear.create({
          data: {
            datasheetId: imported.id,
            wargearOptionId: dw.wargearOptionId,
            isExclusive: dw.isExclusive,
            group: dw.group,
          },
        });
      }

      // Create initial version
      const fullImported = await tx.datasheet.findUniqueOrThrow({
        where: { id: imported.id },
        include: {
          weapons: { include: { weapon: true } },
          abilities: { include: { ability: true } },
          wargearOptions: { include: { wargearOption: true } },
        },
      });

      const snapshot = {
        id: fullImported.id,
        name: fullImported.name,
        faction: fullImported.faction,
        factionId: fullImported.factionId,
        subfaction: fullImported.subfaction,
        role: fullImported.role,
        keywords: JSON.parse(fullImported.keywords),
        movement: fullImported.movement,
        toughness: fullImported.toughness,
        save: fullImported.save,
        invulnerableSave: fullImported.invulnerableSave,
        wounds: fullImported.wounds,
        leadership: fullImported.leadership,
        objectiveControl: fullImported.objectiveControl,
        composition: fullImported.composition,
        pointsCost: fullImported.pointsCost,
        importedFromId: source.id,
        importedFromName: source.name,
        weapons: fullImported.weapons.map(dw => ({
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
        abilities: fullImported.abilities.map(da => ({
          id: da.ability.id,
          name: da.ability.name,
          type: da.ability.type,
          description: da.ability.description,
          source: da.source,
        })),
        wargearOptions: fullImported.wargearOptions.map(dw => ({
          id: dw.wargearOption.id,
          name: dw.wargearOption.name,
          description: dw.wargearOption.description,
          pointsCost: dw.wargearOption.pointsCost,
          type: dw.wargearOption.type,
        })),
      };

      await tx.datasheetVersion.create({
        data: {
          datasheetId: imported.id,
          versionNumber: 1,
          versionLabel: 'Imported',
          snapshotData: JSON.stringify(snapshot),
          changelog: `Imported from shared link "${source.name}"`,
          createdById: user.id,
        },
      });

      return imported;
    });

    return NextResponse.json({
      success: true,
      message: 'Datasheet imported successfully',
      datasheet: {
        id: result.id,
        name: result.name,
        faction: result.faction,
        importedFromId: source.id,
        importedFromName: source.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing shared datasheet:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required to import datasheets' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to import datasheet' }, { status: 500 });
  }
}
