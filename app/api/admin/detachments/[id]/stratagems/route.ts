/**
 * Admin API: Detachment Stratagems
 * GET /api/admin/detachments/[id]/stratagems - List stratagems for detachment
 * POST /api/admin/detachments/[id]/stratagems - Create stratagem for detachment
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: detachmentId } = await params

    // Verify detachment exists
    const detachment = await prisma.detachment.findUnique({
      where: { id: detachmentId },
      select: { id: true, name: true, faction: true, factionId: true }
    })

    if (!detachment) {
      return NextResponse.json(
        { error: 'Detachment not found' },
        { status: 404 }
      )
    }

    const stratagems = await prisma.stratagemData.findMany({
      where: { detachmentId },
      orderBy: [
        { cpCost: 'asc' },
        { type: 'asc' },
        { name: 'asc' }
      ]
    })

    // Format stratagems
    const formatted = stratagems.map(s => ({
      ...s,
      restrictions: s.restrictions ? JSON.parse(s.restrictions) : [],
      keywords: s.keywords ? JSON.parse(s.keywords) : [],
      triggerPhase: s.triggerPhase ? JSON.parse(s.triggerPhase) : [],
      requiredKeywords: s.requiredKeywords ? JSON.parse(s.requiredKeywords) : []
    }))

    return NextResponse.json({
      detachment,
      stratagems: formatted,
      total: formatted.length
    })
  })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id: detachmentId } = await params
    const body = await request.json()

    // Verify detachment exists
    const detachment = await prisma.detachment.findUnique({
      where: { id: detachmentId },
      select: { id: true, name: true, faction: true, factionId: true }
    })

    if (!detachment) {
      return NextResponse.json(
        { error: 'Detachment not found' },
        { status: 404 }
      )
    }

    const {
      name,
      cpCost,
      type,
      when,
      target,
      effect,
      restrictions,
      keywords,
      triggerPhase,
      triggerSubphase,
      isReactive,
      requiredKeywords,
      usageRestriction,
      sourceBook
    } = body

    // Validate required fields
    if (!name || cpCost === undefined || !type || !when || !target || !effect) {
      return NextResponse.json(
        { error: 'Missing required fields: name, cpCost, type, when, target, effect' },
        { status: 400 }
      )
    }

    // Check for duplicate
    const existing = await prisma.stratagemData.findUnique({
      where: {
        name_faction_detachment: {
          name,
          faction: detachment.faction,
          detachment: detachment.name
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Stratagem with this name already exists for this detachment' },
        { status: 409 }
      )
    }

    const stratagem = await prisma.stratagemData.create({
      data: {
        name,
        faction: detachment.faction,
        factionId: detachment.factionId,
        detachment: detachment.name,
        detachmentId,
        cpCost,
        type,
        when,
        target,
        effect,
        restrictions: restrictions ? JSON.stringify(restrictions) : null,
        keywords: keywords ? JSON.stringify(keywords) : null,
        triggerPhase: triggerPhase ? JSON.stringify(triggerPhase) : null,
        triggerSubphase: triggerSubphase || null,
        isReactive: isReactive || false,
        requiredKeywords: requiredKeywords ? JSON.stringify(requiredKeywords) : null,
        usageRestriction: usageRestriction || null,
        sourceBook: sourceBook || null
      }
    })

    return NextResponse.json(stratagem, { status: 201 })
  })
}

