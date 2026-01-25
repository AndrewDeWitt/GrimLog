/**
 * Admin API: Single Stratagem CRUD
 * GET /api/admin/stratagems/[id] - Get stratagem details
 * PUT /api/admin/stratagems/[id] - Update stratagem
 * DELETE /api/admin/stratagems/[id] - Delete stratagem
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params

    const stratagem = await prisma.stratagemData.findUnique({
      where: { id },
      include: {
        factionRel: {
          select: { id: true, name: true }
        },
        detachmentRel: {
          select: { id: true, name: true }
        }
      }
    })

    if (!stratagem) {
      return NextResponse.json(
        { error: 'Stratagem not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    return NextResponse.json({
      ...stratagem,
      restrictions: stratagem.restrictions ? JSON.parse(stratagem.restrictions) : [],
      keywords: stratagem.keywords ? JSON.parse(stratagem.keywords) : [],
      triggerPhase: stratagem.triggerPhase ? JSON.parse(stratagem.triggerPhase) : [],
      requiredKeywords: stratagem.requiredKeywords ? JSON.parse(stratagem.requiredKeywords) : []
    })
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params
    const body = await request.json()

    // Check stratagem exists
    const existing = await prisma.stratagemData.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Stratagem not found' },
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
      sourceBook,
      calculatorEffect
    } = body

    // Check for duplicate name if changing
    if (name && name !== existing.name) {
      const duplicate = await prisma.stratagemData.findFirst({
        where: {
          name,
          faction: existing.faction,
          detachment: existing.detachment,
          id: { not: id }
        }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Stratagem with this name already exists for this detachment' },
          { status: 409 }
        )
      }
    }

    const stratagem = await prisma.stratagemData.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(cpCost !== undefined && { cpCost }),
        ...(type && { type }),
        ...(when && { when }),
        ...(target && { target }),
        ...(effect && { effect }),
        ...(restrictions !== undefined && { restrictions: restrictions ? JSON.stringify(restrictions) : null }),
        ...(keywords !== undefined && { keywords: keywords ? JSON.stringify(keywords) : null }),
        ...(triggerPhase !== undefined && { triggerPhase: triggerPhase ? JSON.stringify(triggerPhase) : null }),
        ...(triggerSubphase !== undefined && { triggerSubphase: triggerSubphase || null }),
        ...(isReactive !== undefined && { isReactive }),
        ...(requiredKeywords !== undefined && { requiredKeywords: requiredKeywords ? JSON.stringify(requiredKeywords) : null }),
        ...(usageRestriction !== undefined && { usageRestriction: usageRestriction || null }),
        ...(sourceBook !== undefined && { sourceBook: sourceBook || null }),
        ...(calculatorEffect !== undefined && { calculatorEffect })
      },
      include: {
        factionRel: {
          select: { id: true, name: true }
        },
        detachmentRel: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({
      ...stratagem,
      restrictions: stratagem.restrictions ? JSON.parse(stratagem.restrictions) : [],
      keywords: stratagem.keywords ? JSON.parse(stratagem.keywords) : [],
      triggerPhase: stratagem.triggerPhase ? JSON.parse(stratagem.triggerPhase) : [],
      requiredKeywords: stratagem.requiredKeywords ? JSON.parse(stratagem.requiredKeywords) : []
    })
  })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params

    // Check stratagem exists
    const existing = await prisma.stratagemData.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Stratagem not found' },
        { status: 404 }
      )
    }

    await prisma.stratagemData.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true,
      deleted: existing.name
    })
  })
}

