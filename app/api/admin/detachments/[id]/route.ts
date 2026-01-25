/**
 * Admin API: Single Detachment CRUD
 * GET /api/admin/detachments/[id] - Get detachment details
 * PUT /api/admin/detachments/[id] - Update detachment
 * DELETE /api/admin/detachments/[id] - Delete detachment
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

    const detachment = await prisma.detachment.findUnique({
      where: { id },
      include: {
        factionRel: {
          select: { id: true, name: true }
        },
        stratagems: {
          select: {
            id: true,
            name: true,
            cpCost: true,
            type: true,
            when: true,
            target: true,
            effect: true,
            restrictions: true,
            triggerPhase: true,
            isReactive: true
          },
          orderBy: [
            { cpCost: 'asc' },
            { name: 'asc' }
          ]
        },
        enhancements: {
          select: {
            id: true,
            name: true,
            pointsCost: true,
            description: true,
            restrictions: true
          },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: {
            stratagems: true,
            enhancements: true
          }
        }
      }
    })

    if (!detachment) {
      return NextResponse.json(
        { error: 'Detachment not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields in stratagems before returning
    const parsedDetachment = {
      ...detachment,
      stratagems: detachment.stratagems.map(strat => {
        let triggerPhase = null
        let restrictions = null
        
        try {
          triggerPhase = strat.triggerPhase ? JSON.parse(strat.triggerPhase) : null
        } catch {
          // If parsing fails, keep as null
        }
        
        try {
          restrictions = strat.restrictions ? JSON.parse(strat.restrictions) : null
        } catch {
          // If parsing fails, keep as null
        }
        
        return {
          ...strat,
          triggerPhase,
          restrictions
        }
      })
    }

    return NextResponse.json(parsedDetachment)
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params
    const body = await request.json()
    const { name, subfaction, description, abilityName, abilityDescription, sourceBook } = body

    // Check detachment exists
    const existing = await prisma.detachment.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Detachment not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name (excluding current)
    if (name && name !== existing.name) {
      const duplicate = await prisma.detachment.findUnique({
        where: {
          name_faction: {
            name,
            faction: existing.faction
          }
        }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Detachment with this name already exists for this faction' },
          { status: 409 }
        )
      }
    }

    const detachment = await prisma.detachment.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(subfaction !== undefined && { subfaction: subfaction || null }),
        ...(description !== undefined && { description: description || null }),
        ...(abilityName !== undefined && { abilityName: abilityName || null }),
        ...(abilityDescription !== undefined && { abilityDescription: abilityDescription || null }),
        ...(sourceBook !== undefined && { sourceBook: sourceBook || null })
      },
      include: {
        factionRel: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            stratagems: true,
            enhancements: true
          }
        }
      }
    })

    return NextResponse.json(detachment)
  })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params

    // Check detachment exists
    const existing = await prisma.detachment.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stratagems: true,
            enhancements: true
          }
        }
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Detachment not found' },
        { status: 404 }
      )
    }

    // Warn about cascade deletions
    const warnings = []
    if (existing._count.stratagems > 0) warnings.push(`${existing._count.stratagems} stratagems`)
    if (existing._count.enhancements > 0) warnings.push(`${existing._count.enhancements} enhancements`)

    // Check for force flag
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    if (warnings.length > 0 && !force) {
      return NextResponse.json({
        error: 'Detachment has related data',
        warnings,
        message: 'Add ?force=true to delete anyway (will unlink stratagems/enhancements)'
      }, { status: 400 })
    }

    // Unlink stratagems and enhancements before deleting
    await prisma.$transaction([
      prisma.stratagemData.updateMany({
        where: { detachmentId: id },
        data: { detachmentId: null }
      }),
      prisma.enhancement.updateMany({
        where: { detachmentId: id },
        data: { detachmentId: null }
      }),
      prisma.detachment.delete({
        where: { id }
      })
    ])

    return NextResponse.json({ 
      success: true,
      deleted: existing.name
    })
  })
}

