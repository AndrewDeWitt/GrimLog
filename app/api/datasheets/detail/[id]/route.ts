/**
 * GET /api/datasheets/detail/[id]
 * PUT /api/datasheets/detail/[id] - Update datasheet (creates new version)
 * DELETE /api/datasheets/detail/[id] - Delete custom datasheet
 * 
 * Get a single datasheet with full details including weapons, abilities, and wargear options
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuth, requireAuth } from '@/lib/auth/apiAuth';
import { UpdateDatasheetSchema } from '@/lib/datasheetValidation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const datasheet = await prisma.datasheet.findUnique({
      where: { id },
      include: {
        weapons: {
          include: {
            weapon: true,
          },
          orderBy: {
            weapon: { name: 'asc' }
          }
        },
        abilities: {
          include: {
            ability: true,
          },
          orderBy: {
            ability: { name: 'asc' }
          }
        },
        wargearOptions: {
          include: {
            wargearOption: true,
          },
        },
        factionRel: {
          select: {
            id: true,
            name: true,
            parentFactionId: true,
          }
        }
      },
    });

    if (!datasheet) {
      return NextResponse.json(
        { error: 'Datasheet not found' },
        { status: 404 }
      );
    }

    // Transform to clean format with parsed JSON fields
    const transformed = {
      id: datasheet.id,
      name: datasheet.name,
      faction: datasheet.faction,
      factionId: datasheet.factionId,
      factionDetails: datasheet.factionRel,
      subfaction: datasheet.subfaction,
      role: datasheet.role,
      keywords: JSON.parse(datasheet.keywords),
      
      // Core stats
      movement: datasheet.movement,
      toughness: datasheet.toughness,
      save: datasheet.save,
      invulnerableSave: datasheet.invulnerableSave,
      wounds: datasheet.wounds,
      leadership: datasheet.leadership,
      objectiveControl: datasheet.objectiveControl,
      
      // Unit composition
      composition: datasheet.composition,
      compositionData: datasheet.compositionData ? JSON.parse(datasheet.compositionData) : null,
      unitSize: datasheet.unitSize,
      
      // Leader rules
      leaderRules: datasheet.leaderRules,
      leaderAbilities: datasheet.leaderAbilities,
      
      // Transport
      transportCapacity: datasheet.transportCapacity,
      
      // Points
      pointsCost: datasheet.pointsCost,
      pointsTiers: datasheet.pointsTiers ? JSON.parse(datasheet.pointsTiers) : null,
      
      // Weapons with full profiles
      weapons: datasheet.weapons.map(dw => ({
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
        structuredAbilities: dw.weapon.structuredAbilities ? JSON.parse(dw.weapon.structuredAbilities) : null,
        isDefault: dw.isDefault,
        quantity: dw.quantity,
        notes: dw.notes,
      })),
      
      // Abilities with descriptions
      abilities: datasheet.abilities.map(da => ({
        id: da.ability.id,
        name: da.ability.name,
        type: da.ability.type,
        description: da.ability.description,
        phase: da.ability.phase,
        triggerPhase: da.ability.triggerPhase ? JSON.parse(da.ability.triggerPhase) : null,
        triggerSubphase: da.ability.triggerSubphase,
        isReactive: da.ability.isReactive,
        source: da.source,
      })),
      
      // Wargear options
      wargearOptions: datasheet.wargearOptions.map(dw => ({
        id: dw.wargearOption.id,
        name: dw.wargearOption.name,
        description: dw.wargearOption.description,
        pointsCost: dw.wargearOption.pointsCost,
        type: dw.wargearOption.type,
        isExclusive: dw.isExclusive,
        group: dw.group,
      })),
      
      // Metadata
      edition: datasheet.edition,
      sourceBook: datasheet.sourceBook,
      version: datasheet.version,
      lastUpdated: datasheet.lastUpdated,
      
      // Ownership & Versioning
      isOfficial: datasheet.isOfficial,
      ownerId: datasheet.ownerId,
      forkedFromId: datasheet.forkedFromId,
      currentVersion: datasheet.currentVersion,
      visibility: datasheet.visibility,
      shareToken: datasheet.shareToken,
    };

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching datasheet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/datasheets/detail/[id]
 * Update a datasheet (owner or admin only). Creates a new version.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Fetch existing datasheet
    const existing = await prisma.datasheet.findUnique({
      where: { id },
      include: {
        weapons: true,
        abilities: true,
        wargearOptions: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }

    // Check ownership (only owner can edit, or admin can edit official)
    if (existing.ownerId !== user.id && !existing.isOfficial) {
      return NextResponse.json({ error: 'Not authorized to edit this datasheet' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateDatasheetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const newVersionNumber = existing.currentVersion + 1;

    // Update datasheet in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the datasheet
      const updated = await tx.datasheet.update({
        where: { id },
        data: {
          name: data.name ?? existing.name,
          faction: data.faction ?? existing.faction,
          factionId: data.factionId !== undefined ? data.factionId : existing.factionId,
          subfaction: data.subfaction !== undefined ? data.subfaction : existing.subfaction,
          role: data.role ?? existing.role,
          keywords: data.keywords ? JSON.stringify(data.keywords) : existing.keywords,
          movement: data.movement ?? existing.movement,
          toughness: data.toughness ?? existing.toughness,
          save: data.save ?? existing.save,
          invulnerableSave: data.invulnerableSave !== undefined ? data.invulnerableSave : existing.invulnerableSave,
          wounds: data.wounds ?? existing.wounds,
          leadership: data.leadership ?? existing.leadership,
          objectiveControl: data.objectiveControl ?? existing.objectiveControl,
          composition: data.composition ?? existing.composition,
          compositionData: data.compositionData !== undefined ? data.compositionData : existing.compositionData,
          unitSize: data.unitSize !== undefined ? data.unitSize : existing.unitSize,
          leaderRules: data.leaderRules !== undefined ? data.leaderRules : existing.leaderRules,
          leaderAbilities: data.leaderAbilities !== undefined ? data.leaderAbilities : existing.leaderAbilities,
          transportCapacity: data.transportCapacity !== undefined ? data.transportCapacity : existing.transportCapacity,
          pointsCost: data.pointsCost ?? existing.pointsCost,
          edition: data.edition ?? existing.edition,
          sourceBook: data.sourceBook !== undefined ? data.sourceBook : existing.sourceBook,
          currentVersion: newVersionNumber,
          lastUpdated: new Date(),
        },
      });

      // 2. Update weapons if provided
      if (data.weapons) {
        // Delete existing weapon relationships
        await tx.datasheetWeapon.deleteMany({ where: { datasheetId: id } });
        
        // Create new weapon relationships
        for (const weaponData of data.weapons) {
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

          await tx.datasheetWeapon.create({
            data: {
              datasheetId: id,
              weaponId: weapon.id,
              isDefault: weaponData.isDefault,
              quantity: weaponData.quantity || null,
            },
          });
        }
      }

      // 3. Update abilities if provided
      if (data.abilities) {
        await tx.datasheetAbility.deleteMany({ where: { datasheetId: id } });
        
        for (const abilityData of data.abilities) {
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

          await tx.datasheetAbility.create({
            data: {
              datasheetId: id,
              abilityId: ability.id,
              source: abilityData.type,
            },
          });
        }
      }

      // 4. Update wargear if provided
      if (data.wargearOptions) {
        await tx.datasheetWargear.deleteMany({ where: { datasheetId: id } });
        
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
              datasheetId: id,
              wargearOptionId: wargearOption.id,
            },
          });
        }
      }

      // 5. Create version snapshot
      const fullDatasheet = await tx.datasheet.findUniqueOrThrow({
        where: { id },
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
        keywords: JSON.parse(fullDatasheet.keywords),
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
          datasheetId: id,
          versionNumber: newVersionNumber,
          versionLabel: data.changelog ? `Update: ${data.changelog.substring(0, 50)}` : `Version ${newVersionNumber}`,
          snapshotData: JSON.stringify(snapshot),
          changelog: data.changelog || 'Updated datasheet',
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
        currentVersion: newVersionNumber,
      },
    });
  } catch (error) {
    console.error('Error updating datasheet:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to update datasheet' }, { status: 500 });
  }
}

/**
 * DELETE /api/datasheets/detail/[id]
 * Delete a custom datasheet (owner only, cannot delete official datasheets)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Fetch existing datasheet
    const existing = await prisma.datasheet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        isOfficial: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Datasheet not found' }, { status: 404 });
    }

    // Cannot delete official datasheets
    if (existing.isOfficial) {
      return NextResponse.json(
        { error: 'Cannot delete official datasheets' },
        { status: 403 }
      );
    }

    // Only owner can delete
    if (existing.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this datasheet' },
        { status: 403 }
      );
    }

    // Delete the datasheet (cascade will handle related records)
    await prisma.datasheet.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Datasheet "${existing.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting datasheet:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to delete datasheet' }, { status: 500 });
  }
}
