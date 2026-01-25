/**
 * Admin API: Faction Detachments
 * GET /api/admin/factions/[id]/detachments - List detachments for faction
 * POST /api/admin/factions/[id]/detachments - Create detachment for faction
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: factionId } = await params

    // Verify faction exists
    const faction = await prisma.faction.findUnique({
      where: { id: factionId },
      select: { id: true, name: true }
    })

    if (!faction) {
      return NextResponse.json(
        { error: 'Faction not found' },
        { status: 404 }
      )
    }

    const detachments = await prisma.detachment.findMany({
      where: { factionId },
      include: {
        _count: {
          select: {
            stratagems: true,
            enhancements: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Also get "orphan" stratagems (those with detachment string but no detachmentId)
    const orphanStratagems = await prisma.stratagemData.findMany({
      where: {
        factionId,
        detachment: { not: null },
        detachmentId: null
      },
      select: {
        detachment: true
      },
      distinct: ['detachment']
    })

    const orphanDetachmentNames = orphanStratagems
      .map(s => s.detachment)
      .filter((d): d is string => d !== null)

    return NextResponse.json({
      faction,
      detachments,
      orphanDetachmentNames, // Detachments that exist in data but not as records
      total: detachments.length
    })
  })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: factionId } = await params
    const body = await request.json()
    const { name, subfaction, description, abilityName, abilityDescription, sourceBook } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Detachment name is required' },
        { status: 400 }
      )
    }

    // Verify faction exists
    const faction = await prisma.faction.findUnique({
      where: { id: factionId },
      select: { id: true, name: true }
    })

    if (!faction) {
      return NextResponse.json(
        { error: 'Faction not found' },
        { status: 404 }
      )
    }

    // Check for duplicate
    const existing = await prisma.detachment.findUnique({
      where: {
        name_faction: {
          name,
          faction: faction.name
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Detachment with this name already exists for this faction' },
        { status: 409 }
      )
    }

    const detachment = await prisma.detachment.create({
      data: {
        name,
        faction: faction.name,
        factionId,
        subfaction: subfaction || null,
        description: description || null,
        abilityName: abilityName || null,
        abilityDescription: abilityDescription || null,
        sourceBook: sourceBook || null
      },
      include: {
        _count: {
          select: {
            stratagems: true,
            enhancements: true
          }
        }
      }
    })

    return NextResponse.json(detachment, { status: 201 })
  })
}

