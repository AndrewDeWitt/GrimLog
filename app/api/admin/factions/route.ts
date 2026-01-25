/**
 * Admin API: Factions CRUD
 * GET /api/admin/factions - List all factions with counts
 * POST /api/admin/factions - Create new faction
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'

export async function GET() {
  return withAdminAuth(async () => {
    const factions = await prisma.faction.findMany({
      include: {
        _count: {
          select: {
            datasheets: true,
            stratagemData: true,
            enhancements: true,
            detachments: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Get disabled datasheet counts per faction
    const disabledCounts = await prisma.datasheet.groupBy({
      by: ['factionId'],
      where: { isEnabled: false },
      _count: true
    })
    const disabledMap = new Map(disabledCounts.map(d => [d.factionId, d._count]))

    // Transform to include computed counts (flat structure, no hierarchy)
    const formatted = factions.map(f => ({
      id: f.id,
      name: f.name,
      metaData: f.metaData ? JSON.parse(f.metaData) : null,
      counts: {
        datasheets: f._count.datasheets,
        disabledDatasheets: disabledMap.get(f.id) || 0,
        stratagems: f._count.stratagemData,
        enhancements: f._count.enhancements,
        detachments: f._count.detachments
      },
      createdAt: f.createdAt,
      updatedAt: f.updatedAt
    }))

    return NextResponse.json({
      factions: formatted,
      total: formatted.length
    })
  })
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    const body = await request.json()
    const { name, metaData } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Faction name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existing = await prisma.faction.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Faction with this name already exists' },
        { status: 409 }
      )
    }

    const faction = await prisma.faction.create({
      data: {
        name,
        metaData: metaData ? JSON.stringify(metaData) : null
      }
    })

    return NextResponse.json(faction, { status: 201 })
  })
}

