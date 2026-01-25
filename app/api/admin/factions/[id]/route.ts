/**
 * Admin API: Single Faction CRUD
 * GET /api/admin/factions/[id] - Get faction details
 * PUT /api/admin/factions/[id] - Update faction
 * DELETE /api/admin/factions/[id] - Delete faction
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

    const faction = await prisma.faction.findUnique({
      where: { id },
      include: {
        parentFaction: {
          select: {
            id: true,
            name: true,
            detachments: {
              select: {
                id: true,
                name: true,
                subfaction: true,
                abilityName: true,
                _count: {
                  select: {
                    stratagems: true,
                    enhancements: true
                  }
                }
              },
              orderBy: { name: 'asc' }
            }
          }
        },
        subFactions: {
          select: { id: true, name: true }
        },
        detachments: {
          select: {
            id: true,
            name: true,
            subfaction: true,
            abilityName: true,
            _count: {
              select: {
                stratagems: true,
                enhancements: true
              }
            }
          },
          orderBy: { name: 'asc' }
        },
        stratagemData: {
          select: {
            id: true,
            name: true,
            detachment: true,
            cpCost: true,
            type: true
          },
          orderBy: [
            { detachment: 'asc' },
            { name: 'asc' }
          ]
        },
        _count: {
          select: {
            datasheets: true,
            stratagemData: true,
            enhancements: true,
            detachments: true
          }
        }
      }
    })

    if (!faction) {
      return NextResponse.json(
        { error: 'Faction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...faction,
      metaData: faction.metaData ? JSON.parse(faction.metaData) : null
    })
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params
    const body = await request.json()
    const { name, metaData, parentFactionId } = body

    // Check faction exists
    const existing = await prisma.faction.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Faction not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name (excluding current)
    if (name && name !== existing.name) {
      const duplicate = await prisma.faction.findUnique({
        where: { name }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Faction with this name already exists' },
          { status: 409 }
        )
      }
    }

    const faction = await prisma.faction.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(metaData !== undefined && { metaData: metaData ? JSON.stringify(metaData) : null }),
        ...(parentFactionId !== undefined && { parentFactionId: parentFactionId || null })
      },
      include: {
        parentFaction: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(faction)
  })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params

    // Check faction exists
    const existing = await prisma.faction.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            datasheets: true,
            stratagemData: true,
            armies: true,
            subFactions: true,
            detachments: true
          }
        }
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Faction not found' },
        { status: 404 }
      )
    }

    // Warn about cascade deletions
    const warnings = []
    if (existing._count.datasheets > 0) warnings.push(`${existing._count.datasheets} datasheets`)
    if (existing._count.stratagemData > 0) warnings.push(`${existing._count.stratagemData} stratagems`)
    if (existing._count.armies > 0) warnings.push(`${existing._count.armies} armies`)
    if (existing._count.subFactions > 0) warnings.push(`${existing._count.subFactions} sub-factions`)
    if (existing._count.detachments > 0) warnings.push(`${existing._count.detachments} detachments`)

    // Check for force flag
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    if (warnings.length > 0 && !force) {
      return NextResponse.json({
        error: 'Faction has related data',
        warnings,
        message: 'Add ?force=true to delete anyway (will cascade)'
      }, { status: 400 })
    }

    await prisma.faction.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true,
      deleted: existing.name
    })
  })
}

