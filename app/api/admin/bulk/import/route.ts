/**
 * Admin API: Bulk Import
 * POST /api/admin/bulk/import - Import factions, detachments, stratagems from JSON
 * Body: JSON export format from /api/admin/bulk/export
 * Query params:
 *   - mode: 'create' (skip existing) | 'upsert' (update existing) | 'replace' (delete then create)
 *   - dryRun: 'true' to preview changes without applying
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/adminAuth'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'create'
    const dryRun = searchParams.get('dryRun') === 'true'

    if (!['create', 'upsert', 'replace'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Use: create, upsert, or replace' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { factions, detachments, stratagems, enhancements } = body

    const results: Record<string, ImportResult> = {
      factions: { created: 0, updated: 0, skipped: 0, errors: [] },
      detachments: { created: 0, updated: 0, skipped: 0, errors: [] },
      stratagems: { created: 0, updated: 0, skipped: 0, errors: [] },
      enhancements: { created: 0, updated: 0, skipped: 0, errors: [] }
    }

    // Import factions
    if (Array.isArray(factions)) {
      for (const faction of factions) {
        try {
          const existing = await prisma.faction.findUnique({
            where: { name: faction.name }
          })

          if (existing) {
            if (mode === 'create') {
              results.factions.skipped++
            } else if (mode === 'upsert' || mode === 'replace') {
              if (!dryRun) {
                await prisma.faction.update({
                  where: { name: faction.name },
                  data: {
                    metaData: faction.metaData ? JSON.stringify(faction.metaData) : null,
                    parentFactionId: faction.parentFactionId
                  }
                })
              }
              results.factions.updated++
            }
          } else {
            if (!dryRun) {
              await prisma.faction.create({
                data: {
                  name: faction.name,
                  metaData: faction.metaData ? JSON.stringify(faction.metaData) : null,
                  parentFactionId: faction.parentFactionId
                }
              })
            }
            results.factions.created++
          }
        } catch (error) {
          results.factions.errors.push(`Faction ${faction.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Import detachments
    if (Array.isArray(detachments)) {
      for (const detachment of detachments) {
        try {
          // Find faction
          const faction = await prisma.faction.findFirst({
            where: { name: detachment.faction }
          })

          if (!faction) {
            results.detachments.errors.push(`Detachment ${detachment.name}: Faction '${detachment.faction}' not found`)
            continue
          }

          const existing = await prisma.detachment.findUnique({
            where: {
              name_faction: {
                name: detachment.name,
                faction: detachment.faction
              }
            }
          })

          if (existing) {
            if (mode === 'create') {
              results.detachments.skipped++
            } else if (mode === 'upsert' || mode === 'replace') {
              if (!dryRun) {
                await prisma.detachment.update({
                  where: { id: existing.id },
                  data: {
                    subfaction: detachment.subfaction,
                    description: detachment.description,
                    abilityName: detachment.abilityName,
                    abilityDescription: detachment.abilityDescription,
                    sourceBook: detachment.sourceBook
                  }
                })
              }
              results.detachments.updated++
            }
          } else {
            if (!dryRun) {
              await prisma.detachment.create({
                data: {
                  name: detachment.name,
                  faction: detachment.faction,
                  factionId: faction.id,
                  subfaction: detachment.subfaction,
                  description: detachment.description,
                  abilityName: detachment.abilityName,
                  abilityDescription: detachment.abilityDescription,
                  sourceBook: detachment.sourceBook
                }
              })
            }
            results.detachments.created++
          }
        } catch (error) {
          results.detachments.errors.push(`Detachment ${detachment.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Import stratagems
    if (Array.isArray(stratagems)) {
      for (const strat of stratagems) {
        try {
          // Find faction
          const faction = await prisma.faction.findFirst({
            where: { name: strat.faction }
          })

          // Find detachment if exists
          let detachment = null
          if (strat.detachment) {
            detachment = await prisma.detachment.findUnique({
              where: {
                name_faction: {
                  name: strat.detachment,
                  faction: strat.faction
                }
              }
            })
          }

          const existing = await prisma.stratagemData.findFirst({
            where: {
              name: strat.name,
              faction: strat.faction,
              detachment: strat.detachment
            }
          })

          const stratagemData = {
            name: strat.name,
            faction: strat.faction,
            factionId: faction?.id || null,
            subfaction: strat.subfaction,
            detachment: strat.detachment,
            detachmentId: detachment?.id || null,
            cpCost: strat.cpCost,
            type: strat.type,
            when: strat.when,
            target: strat.target,
            effect: strat.effect,
            restrictions: Array.isArray(strat.restrictions) ? JSON.stringify(strat.restrictions) : strat.restrictions,
            keywords: Array.isArray(strat.keywords) ? JSON.stringify(strat.keywords) : strat.keywords,
            triggerPhase: Array.isArray(strat.triggerPhase) ? JSON.stringify(strat.triggerPhase) : strat.triggerPhase,
            triggerSubphase: strat.triggerSubphase,
            isReactive: strat.isReactive || false,
            requiredKeywords: Array.isArray(strat.requiredKeywords) ? JSON.stringify(strat.requiredKeywords) : strat.requiredKeywords,
            usageRestriction: strat.usageRestriction,
            sourceBook: strat.sourceBook,
            calculatorEffect: strat.calculatorEffect
          }

          if (existing) {
            if (mode === 'create') {
              results.stratagems.skipped++
            } else if (mode === 'upsert' || mode === 'replace') {
              if (!dryRun) {
                await prisma.stratagemData.update({
                  where: { id: existing.id },
                  data: stratagemData
                })
              }
              results.stratagems.updated++
            }
          } else {
            if (!dryRun) {
              await prisma.stratagemData.create({
                data: stratagemData
              })
            }
            results.stratagems.created++
          }
        } catch (error) {
          results.stratagems.errors.push(`Stratagem ${strat.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Import enhancements
    if (Array.isArray(enhancements)) {
      for (const enh of enhancements) {
        try {
          // Find faction
          const faction = await prisma.faction.findFirst({
            where: { name: enh.faction }
          })

          // Find detachment if exists
          let detachment = null
          if (enh.detachment) {
            detachment = await prisma.detachment.findUnique({
              where: {
                name_faction: {
                  name: enh.detachment,
                  faction: enh.faction
                }
              }
            })
          }

          const existing = await prisma.enhancement.findFirst({
            where: {
              name: enh.name,
              faction: enh.faction,
              detachment: enh.detachment
            }
          })

          const enhancementData = {
            name: enh.name,
            faction: enh.faction,
            factionId: faction?.id || null,
            subfaction: enh.subfaction,
            detachment: enh.detachment,
            detachmentId: detachment?.id || null,
            pointsCost: enh.pointsCost,
            description: enh.description,
            restrictions: Array.isArray(enh.restrictions) ? JSON.stringify(enh.restrictions) : enh.restrictions,
            keywords: Array.isArray(enh.keywords) ? JSON.stringify(enh.keywords) : enh.keywords,
            sourceBook: enh.sourceBook
          }

          if (existing) {
            if (mode === 'create') {
              results.enhancements.skipped++
            } else if (mode === 'upsert' || mode === 'replace') {
              if (!dryRun) {
                await prisma.enhancement.update({
                  where: { id: existing.id },
                  data: enhancementData
                })
              }
              results.enhancements.updated++
            }
          } else {
            if (!dryRun) {
              await prisma.enhancement.create({
                data: enhancementData
              })
            }
            results.enhancements.created++
          }
        } catch (error) {
          results.enhancements.errors.push(`Enhancement ${enh.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    return NextResponse.json({
      dryRun,
      mode,
      results,
      summary: {
        totalCreated: results.factions.created + results.detachments.created + results.stratagems.created + results.enhancements.created,
        totalUpdated: results.factions.updated + results.detachments.updated + results.stratagems.updated + results.enhancements.updated,
        totalSkipped: results.factions.skipped + results.detachments.skipped + results.stratagems.skipped + results.enhancements.skipped,
        totalErrors: results.factions.errors.length + results.detachments.errors.length + results.stratagems.errors.length + results.enhancements.errors.length
      }
    })
  })
}

