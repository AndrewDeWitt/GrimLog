/**
 * Admin API: Datasheets List
 * GET /api/admin/datasheets - List datasheets with filters, search, and pagination
 * POST /api/admin/datasheets - Create a new datasheet
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'
import { CreateDatasheetSchema } from '@/lib/datasheetValidation'
import { getPublicStorageUrl } from '@/lib/supabase/storagePublicUrl'

interface DatasheetFilters {
  factionId?: string
  faction?: string
  role?: string
  isEnabled?: boolean
  isOfficial?: boolean
  search?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url)
    
    // Parse filters from query params
    const filters: DatasheetFilters = {
      factionId: searchParams.get('factionId') || undefined,
      faction: searchParams.get('faction') || undefined,
      role: searchParams.get('role') || undefined,
      isEnabled: searchParams.get('isEnabled') !== null 
        ? searchParams.get('isEnabled') === 'true' 
        : undefined,
      isOfficial: searchParams.get('isOfficial') !== null
        ? searchParams.get('isOfficial') === 'true'
        : undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
      sortBy: searchParams.get('sortBy') || 'name',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
    }

    // Build where clause
    const where: Record<string, unknown> = {}
    
    if (filters.factionId) {
      where.factionId = filters.factionId
    }
    
    if (filters.faction) {
      where.faction = filters.faction
    }
    
    if (filters.role) {
      where.role = filters.role
    }
    
    if (filters.isEnabled !== undefined) {
      where.isEnabled = filters.isEnabled
    }
    
    if (filters.isOfficial !== undefined) {
      where.isOfficial = filters.isOfficial
    }
    
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { keywords: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Build orderBy
    const orderBy: Record<string, 'asc' | 'desc'> = {}
    const validSortFields = ['name', 'faction', 'role', 'pointsCost', 'createdAt', 'lastUpdated']
    if (validSortFields.includes(filters.sortBy || 'name')) {
      orderBy[filters.sortBy || 'name'] = filters.sortOrder || 'asc'
    } else {
      orderBy.name = 'asc'
    }

    // Get total count for pagination
    const total = await prisma.datasheet.count({ where })
    
    // Fetch datasheets
    const skip = ((filters.page || 1) - 1) * (filters.limit || 50)
    const datasheets = await prisma.datasheet.findMany({
      where,
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
        isEnabled: true,
        isOfficial: true,
        edition: true,
        createdAt: true,
        lastUpdated: true,
        // Competitive context fields
        competitiveTier: true,
        tierReasoning: true,
        bestTargets: true,
        counters: true,
        synergies: true,
        playstyleNotes: true,
        deploymentTips: true,
        competitiveNotes: true,
        _count: {
          select: {
            weapons: true,
            abilities: true,
            wargearOptions: true,
          }
        },
      },
      orderBy,
      skip,
      take: filters.limit || 50,
    })

    // Fetch global icons for all datasheets by matching unitName and faction
    const iconLookups = datasheets.map(ds => ({
      unitName: ds.name,
      faction: ds.faction,
    }))

    // Raw SQL to avoid Prisma Client regeneration issues on Windows while dev server is running
    type GlobalIconRow = { unitName: string; faction: string; bucket: string; path: string }
    const iconFactions = Array.from(new Set(iconLookups.map(l => l.faction).filter(Boolean)))
    const iconUnitNames = Array.from(new Set(iconLookups.map(l => l.unitName).filter(Boolean)))

    const icons = await prisma.$queryRaw<GlobalIconRow[]>`
      select
        "unitName" as "unitName",
        faction,
        bucket,
        path
      from public."GlobalUnitIcon"
      where faction = any(${iconFactions})
        and "unitName" = any(${iconUnitNames})
    `

    // Create a lookup map for quick icon retrieval
    const iconMap = new Map<string, string>()
    icons.forEach((icon) => {
      const key = `${icon.faction}:${icon.unitName}`
      iconMap.set(key, getPublicStorageUrl(icon.bucket, icon.path))
    })

    // Transform datasheets
    const transformedDatasheets = datasheets.map(ds => ({
      ...ds,
      keywords: JSON.parse(ds.keywords),
      // Parse competitive context arrays
      bestTargets: ds.bestTargets ? JSON.parse(ds.bestTargets) : null,
      counters: ds.counters ? JSON.parse(ds.counters) : null,
      synergies: ds.synergies ? JSON.parse(ds.synergies) : null,
      // Get icon URL by matching name and faction
      iconUrl: iconMap.get(`${ds.faction}:${ds.name}`) || null,
    }))

    return NextResponse.json({
      datasheets: transformedDatasheets,
      pagination: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 50,
        totalPages: Math.ceil(total / (filters.limit || 50)),
      }
    })
  })
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async (admin) => {
    const body = await request.json()
    
    // Validate input
    const validation = CreateDatasheetSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = validation.data

    // Create datasheet in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the datasheet
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
          edition: data.edition || '10th',
          sourceBook: data.sourceBook || null,
          // Competitive Context
          competitiveTier: data.competitiveTier || null,
          tierReasoning: data.tierReasoning || null,
          bestTargets: data.bestTargets ? JSON.stringify(data.bestTargets) : null,
          counters: data.counters ? JSON.stringify(data.counters) : null,
          synergies: data.synergies ? JSON.stringify(data.synergies) : null,
          playstyleNotes: data.playstyleNotes || null,
          deploymentTips: data.deploymentTips || null,
          competitiveNotes: data.competitiveNotes || null,
          isOfficial: true, // Admin-created datasheets are official
          isEnabled: true,
        },
      })

      // Create weapons
      if (data.weapons && data.weapons.length > 0) {
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
              datasheetId: datasheet.id,
              weaponId: weapon.id,
              isDefault: weaponData.isDefault,
              quantity: weaponData.quantity || null,
            },
          })
        }
      }

      // Create abilities
      if (data.abilities && data.abilities.length > 0) {
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
              datasheetId: datasheet.id,
              abilityId: ability.id,
              source: abilityData.type,
            },
          })
        }
      }

      // Create wargear options
      if (data.wargearOptions && data.wargearOptions.length > 0) {
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
              datasheetId: datasheet.id,
              wargearOptionId: wargearOption.id,
            },
          })
        }
      }

      // Create initial version snapshot
      const fullDatasheet = await tx.datasheet.findUniqueOrThrow({
        where: { id: datasheet.id },
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
        // Include all other fields...
      }

      await tx.datasheetVersion.create({
        data: {
          datasheetId: datasheet.id,
          versionNumber: 1,
          versionLabel: 'Initial version',
          snapshotData: JSON.stringify(snapshot),
          changelog: 'Created datasheet',
          createdById: admin.dbUser.id,
        },
      })

      return datasheet
    })

    return NextResponse.json({
      success: true,
      datasheet: {
        id: result.id,
        name: result.name,
      }
    }, { status: 201 })
  })
}
