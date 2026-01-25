/**
 * POST /api/datasheets/detail/[id]/fork
 * 
 * Fork an existing datasheet (creates a copy owned by the user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { ForkDatasheetSchema } from '@/lib/datasheetValidation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validation = ForkDatasheetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name: customName, visibility } = validation.data;

    // Fetch the source datasheet with all related data
    const source = await prisma.datasheet.findUnique({
      where: { id },
      include: {
        weapons: { include: { weapon: true } },
        abilities: { include: { ability: true } },
        wargearOptions: { include: { wargearOption: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'Source datasheet not found' }, { status: 404 });
    }

    // Create forked datasheet in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate a unique name for the fork
      const forkName = customName || `${source.name} (Fork)`;
      
      // Check if user already has a datasheet with this name
      const existing = await tx.datasheet.findFirst({
        where: {
          name: forkName,
          faction: source.faction,
          subfaction: source.subfaction,
          ownerId: user.id,
        },
      });

      const finalName = existing 
        ? `${forkName} ${Date.now().toString(36)}` 
        : forkName;

      // 1. Create the forked datasheet
      const forked = await tx.datasheet.create({
        data: {
          name: finalName,
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
          // Fork-specific fields
          isOfficial: false,
          ownerId: user.id,
          forkedFromId: source.id,
          currentVersion: 1,
          visibility: visibility,
        },
      });

      // 2. Copy weapon relationships (weapons are shared, not duplicated)
      for (const dw of source.weapons) {
        await tx.datasheetWeapon.create({
          data: {
            datasheetId: forked.id,
            weaponId: dw.weaponId,
            isDefault: dw.isDefault,
            quantity: dw.quantity,
            notes: dw.notes,
          },
        });
      }

      // 3. Copy ability relationships (abilities are shared, not duplicated)
      for (const da of source.abilities) {
        await tx.datasheetAbility.create({
          data: {
            datasheetId: forked.id,
            abilityId: da.abilityId,
            source: da.source,
          },
        });
      }

      // 4. Copy wargear option relationships
      for (const dw of source.wargearOptions) {
        await tx.datasheetWargear.create({
          data: {
            datasheetId: forked.id,
            wargearOptionId: dw.wargearOptionId,
            isExclusive: dw.isExclusive,
            group: dw.group,
          },
        });
      }

      // 5. Create initial version snapshot
      const fullForked = await tx.datasheet.findUniqueOrThrow({
        where: { id: forked.id },
        include: {
          weapons: { include: { weapon: true } },
          abilities: { include: { ability: true } },
          wargearOptions: { include: { wargearOption: true } },
        },
      });

      const snapshot = {
        id: fullForked.id,
        name: fullForked.name,
        faction: fullForked.faction,
        factionId: fullForked.factionId,
        subfaction: fullForked.subfaction,
        role: fullForked.role,
        keywords: JSON.parse(fullForked.keywords),
        movement: fullForked.movement,
        toughness: fullForked.toughness,
        save: fullForked.save,
        invulnerableSave: fullForked.invulnerableSave,
        wounds: fullForked.wounds,
        leadership: fullForked.leadership,
        objectiveControl: fullForked.objectiveControl,
        composition: fullForked.composition,
        compositionData: fullForked.compositionData,
        unitSize: fullForked.unitSize,
        leaderRules: fullForked.leaderRules,
        leaderAbilities: fullForked.leaderAbilities,
        transportCapacity: fullForked.transportCapacity,
        pointsCost: fullForked.pointsCost,
        edition: fullForked.edition,
        sourceBook: fullForked.sourceBook,
        forkedFromId: source.id,
        forkedFromName: source.name,
        weapons: fullForked.weapons.map(dw => ({
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
        abilities: fullForked.abilities.map(da => ({
          id: da.ability.id,
          name: da.ability.name,
          type: da.ability.type,
          description: da.ability.description,
          triggerPhase: da.ability.triggerPhase ? JSON.parse(da.ability.triggerPhase) : null,
          source: da.source,
        })),
        wargearOptions: fullForked.wargearOptions.map(dw => ({
          id: dw.wargearOption.id,
          name: dw.wargearOption.name,
          description: dw.wargearOption.description,
          pointsCost: dw.wargearOption.pointsCost,
          type: dw.wargearOption.type,
        })),
      };

      await tx.datasheetVersion.create({
        data: {
          datasheetId: forked.id,
          versionNumber: 1,
          versionLabel: 'Initial Fork',
          snapshotData: JSON.stringify(snapshot),
          changelog: `Forked from "${source.name}" (${source.isOfficial ? 'Official' : 'Custom'})`,
          createdById: user.id,
        },
      });

      return fullForked;
    });

    return NextResponse.json({
      success: true,
      datasheet: {
        id: result.id,
        name: result.name,
        faction: result.faction,
        forkedFromId: source.id,
        forkedFromName: source.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error forking datasheet:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fork datasheet' }, { status: 500 });
  }
}
