/**
 * Admin API: Single Datasheet CRUD
 * GET /api/admin/datasheets/[id] - Get datasheet details
 * PUT /api/admin/datasheets/[id] - Update datasheet
 * PATCH /api/admin/datasheets/[id] - Toggle enabled status
 * DELETE /api/admin/datasheets/[id] - Delete datasheet
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'
import { UpdateDatasheetSchema } from '@/lib/datasheetValidation'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params

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
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
          select: {
            id: true,
            versionNumber: true,
            versionLabel: true,
            changelog: true,
            createdAt: true,
          }
        },
        // Include scoped competitive contexts from the new table
        datasheetCompetitiveContexts: {
          include: {
            faction: {
              select: { id: true, name: true }
            },
            detachment: {
              select: { id: true, name: true }
            }
          },
          orderBy: [
            { factionId: 'asc' },
            { detachmentId: 'asc' }
          ]
        }
      },
    })

    if (!datasheet) {
      return NextResponse.json(
        { error: 'Datasheet not found' },
        { status: 404 }
      )
    }

    // Transform to clean format
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
      
      // Weapons
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
        isDefault: dw.isDefault,
        quantity: dw.quantity,
        notes: dw.notes,
      })),
      
      // Abilities
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
      
      // Status
      isEnabled: datasheet.isEnabled,
      isOfficial: datasheet.isOfficial,
      
      // Competitive Context (legacy fields on Datasheet for manual override)
      competitiveTier: datasheet.competitiveTier,
      tierReasoning: datasheet.tierReasoning,
      bestTargets: datasheet.bestTargets ? JSON.parse(datasheet.bestTargets) : null,
      counters: datasheet.counters ? JSON.parse(datasheet.counters) : null,
      synergies: datasheet.synergies ? JSON.parse(datasheet.synergies) : null,
      playstyleNotes: datasheet.playstyleNotes,
      deploymentTips: datasheet.deploymentTips,
      competitiveNotes: datasheet.competitiveNotes,
      
      // Scoped competitive contexts (from aggregation pipeline)
      competitiveContexts: datasheet.datasheetCompetitiveContexts.map(ctx => ({
        id: ctx.id,
        factionId: ctx.factionId,
        factionName: ctx.faction?.name || null,
        detachmentId: ctx.detachmentId,
        detachmentName: ctx.detachment?.name || null,
        competitiveTier: ctx.competitiveTier,
        tierReasoning: ctx.tierReasoning,
        bestTargets: ctx.bestTargets ? JSON.parse(ctx.bestTargets) : null,
        counters: ctx.counters ? JSON.parse(ctx.counters) : null,
        synergies: ctx.synergies ? JSON.parse(ctx.synergies) : null,
        playstyleNotes: ctx.playstyleNotes,
        deploymentTips: ctx.deploymentTips,
        competitiveNotes: ctx.competitiveNotes,
        sourceCount: ctx.sourceCount,
        lastAggregated: ctx.lastAggregated,
      })),
      
      // Metadata
      edition: datasheet.edition,
      sourceBook: datasheet.sourceBook,
      version: datasheet.version,
      currentVersion: datasheet.currentVersion,
      lastUpdated: datasheet.lastUpdated,
      createdAt: datasheet.createdAt,
      
      // Recent versions
      recentVersions: datasheet.versions,
    }

    return NextResponse.json(transformed)
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async (admin) => {
    const { id } = await params
    const body = await request.json()

    // Check datasheet exists
    const existing = await prisma.datasheet.findUnique({
      where: { id },
      include: {
        weapons: true,
        abilities: true,
        wargearOptions: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Datasheet not found' },
        { status: 404 }
      )
    }

    // Validate input
    const validation = UpdateDatasheetSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data
    const newVersionNumber = existing.currentVersion + 1

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update datasheet
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
          // Competitive Context
          competitiveTier: data.competitiveTier !== undefined ? data.competitiveTier : existing.competitiveTier,
          tierReasoning: data.tierReasoning !== undefined ? data.tierReasoning : existing.tierReasoning,
          bestTargets: data.bestTargets !== undefined ? (data.bestTargets ? JSON.stringify(data.bestTargets) : null) : existing.bestTargets,
          counters: data.counters !== undefined ? (data.counters ? JSON.stringify(data.counters) : null) : existing.counters,
          synergies: data.synergies !== undefined ? (data.synergies ? JSON.stringify(data.synergies) : null) : existing.synergies,
          playstyleNotes: data.playstyleNotes !== undefined ? data.playstyleNotes : existing.playstyleNotes,
          deploymentTips: data.deploymentTips !== undefined ? data.deploymentTips : existing.deploymentTips,
          competitiveNotes: data.competitiveNotes !== undefined ? data.competitiveNotes : existing.competitiveNotes,
          currentVersion: newVersionNumber,
          lastUpdated: new Date(),
        },
      })

      // Update weapons if provided
      if (data.weapons) {
        await tx.datasheetWeapon.deleteMany({ where: { datasheetId: id } })
        
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
          })

          await tx.datasheetWeapon.create({
            data: {
              datasheetId: id,
              weaponId: weapon.id,
              isDefault: weaponData.isDefault,
              quantity: weaponData.quantity || null,
            },
          })
        }
      }

      // Update abilities if provided
      if (data.abilities) {
        await tx.datasheetAbility.deleteMany({ where: { datasheetId: id } })
        
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
          })

          await tx.datasheetAbility.create({
            data: {
              datasheetId: id,
              abilityId: ability.id,
              source: abilityData.type,
            },
          })
        }
      }

      // Update wargear if provided
      if (data.wargearOptions) {
        await tx.datasheetWargear.deleteMany({ where: { datasheetId: id } })
        
        for (const wargearData of data.wargearOptions) {
          const wargearOption = await tx.wargearOption.create({
            data: {
              name: wargearData.name,
              description: wargearData.description,
              pointsCost: wargearData.pointsCost,
              type: wargearData.type,
            },
          })

          await tx.datasheetWargear.create({
            data: {
              datasheetId: id,
              wargearOptionId: wargearOption.id,
            },
          })
        }
      }

      // Create version snapshot
      const fullDatasheet = await tx.datasheet.findUniqueOrThrow({
        where: { id },
        include: {
          weapons: { include: { weapon: true } },
          abilities: { include: { ability: true } },
          wargearOptions: { include: { wargearOption: true } },
        },
      })

      const snapshot = {
        id: fullDatasheet.id,
        name: fullDatasheet.name,
        faction: fullDatasheet.faction,
        role: fullDatasheet.role,
        pointsCost: fullDatasheet.pointsCost,
        weapons: fullDatasheet.weapons.map(dw => ({
          name: dw.weapon.name,
          range: dw.weapon.range,
          type: dw.weapon.type,
          attacks: dw.weapon.attacks,
          ballisticSkill: dw.weapon.ballisticSkill,
          weaponSkill: dw.weapon.weaponSkill,
          strength: dw.weapon.strength,
          armorPenetration: dw.weapon.armorPenetration,
          damage: dw.weapon.damage,
        })),
        abilities: fullDatasheet.abilities.map(da => ({
          name: da.ability.name,
          type: da.ability.type,
          description: da.ability.description,
        })),
      }

      await tx.datasheetVersion.create({
        data: {
          datasheetId: id,
          versionNumber: newVersionNumber,
          versionLabel: data.changelog ? `Update: ${data.changelog.substring(0, 50)}` : `Version ${newVersionNumber}`,
          snapshotData: JSON.stringify(snapshot),
          changelog: data.changelog || 'Updated datasheet',
          createdById: admin.dbUser.id,
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      datasheet: {
        id: result.id,
        name: result.name,
        currentVersion: newVersionNumber,
      }
    })
  })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params
    const body = await request.json()

    // Check datasheet exists
    const existing = await prisma.datasheet.findUnique({
      where: { id },
      select: { id: true, name: true, isEnabled: true }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Datasheet not found' },
        { status: 404 }
      )
    }

    // Toggle enabled status or update specific field
    const updateData: Record<string, unknown> = {}
    
    if (body.isEnabled !== undefined) {
      updateData.isEnabled = body.isEnabled
    } else if (body.toggle === 'isEnabled') {
      updateData.isEnabled = !existing.isEnabled
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid update field provided' },
        { status: 400 }
      )
    }

    const updated = await prisma.datasheet.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        isEnabled: true,
      }
    })

    return NextResponse.json({
      success: true,
      datasheet: updated,
    })
  })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params

    // Check datasheet exists
    const existing = await prisma.datasheet.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            unitInstances: true,
            units: true,
          }
        }
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Datasheet not found' },
        { status: 404 }
      )
    }

    // Warn about cascade deletions
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const warnings = []
    if (existing._count.unitInstances > 0) warnings.push(`${existing._count.unitInstances} unit instances`)
    if (existing._count.units > 0) warnings.push(`${existing._count.units} army units`)

    if (warnings.length > 0 && !force) {
      return NextResponse.json({
        error: 'Datasheet has related data',
        warnings,
        message: 'Add ?force=true to delete anyway (will cascade)'
      }, { status: 400 })
    }

    // Delete datasheet (cascade will handle weapons, abilities, etc.)
    await prisma.datasheet.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      deleted: existing.name
    })
  })
}
