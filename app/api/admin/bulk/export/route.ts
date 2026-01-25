/**
 * Admin API: Bulk Export
 * GET /api/admin/bulk/export - Export factions, detachments, stratagems as JSON
 * Query params:
 *   - factionId: Export specific faction (optional)
 *   - include: comma-separated list of what to include (factions,detachments,stratagems,enhancements)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url)
    const factionId = searchParams.get('factionId')
    const includeParam = searchParams.get('include') || 'factions,detachments,stratagems,enhancements'
    const includes = includeParam.split(',').map(s => s.trim())

    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    // Build faction filter
    const factionFilter = factionId ? { id: factionId } : {}
    const factionIdFilter = factionId ? { factionId } : {}

    // Export factions
    if (includes.includes('factions')) {
      const factions = await prisma.faction.findMany({
        where: factionFilter,
        select: {
          id: true,
          name: true,
          metaData: true,
          parentFactionId: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { name: 'asc' }
      })

      exportData.factions = factions.map(f => ({
        ...f,
        metaData: f.metaData ? JSON.parse(f.metaData) : null
      }))
    }

    // Export detachments
    if (includes.includes('detachments')) {
      const detachments = await prisma.detachment.findMany({
        where: factionIdFilter,
        select: {
          id: true,
          name: true,
          faction: true,
          factionId: true,
          subfaction: true,
          description: true,
          abilityName: true,
          abilityDescription: true,
          edition: true,
          sourceBook: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [
          { faction: 'asc' },
          { name: 'asc' }
        ]
      })

      exportData.detachments = detachments
    }

    // Export stratagems
    if (includes.includes('stratagems')) {
      const stratagems = await prisma.stratagemData.findMany({
        where: factionIdFilter,
        orderBy: [
          { faction: 'asc' },
          { detachment: 'asc' },
          { name: 'asc' }
        ]
      })

      exportData.stratagems = stratagems.map(s => ({
        ...s,
        restrictions: s.restrictions ? JSON.parse(s.restrictions) : [],
        keywords: s.keywords ? JSON.parse(s.keywords) : [],
        triggerPhase: s.triggerPhase ? JSON.parse(s.triggerPhase) : [],
        requiredKeywords: s.requiredKeywords ? JSON.parse(s.requiredKeywords) : []
      }))
    }

    // Export enhancements
    if (includes.includes('enhancements')) {
      const enhancements = await prisma.enhancement.findMany({
        where: factionIdFilter,
        orderBy: [
          { faction: 'asc' },
          { detachment: 'asc' },
          { name: 'asc' }
        ]
      })

      exportData.enhancements = enhancements.map(e => ({
        ...e,
        restrictions: e.restrictions ? JSON.parse(e.restrictions) : [],
        keywords: e.keywords ? JSON.parse(e.keywords) : []
      }))
    }

    // Add counts
    exportData.counts = {
      factions: Array.isArray(exportData.factions) ? exportData.factions.length : 0,
      detachments: Array.isArray(exportData.detachments) ? exportData.detachments.length : 0,
      stratagems: Array.isArray(exportData.stratagems) ? exportData.stratagems.length : 0,
      enhancements: Array.isArray(exportData.enhancements) ? exportData.enhancements.length : 0
    }

    return NextResponse.json(exportData)
  })
}

