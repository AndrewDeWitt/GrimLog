/**
 * GET /api/sessions/[id]/units/abilities
 * 
 * Fetch abilities for all units in a game session, optionally filtered by phase
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

/**
 * Helper to verify session access (owner or shared)
 */
async function verifySessionAccess(sessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, sharedWith: true }
  });

  if (!session) return false;
  if (session.userId === userId) return true;

  // Check shared access
  if (session.sharedWith) {
    try {
      const sharedWith = JSON.parse(session.sharedWith);
      if (Array.isArray(sharedWith) && sharedWith.includes(userId)) {
        return true;
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const sessionId = (await params).id;
    const searchParams = request.nextUrl.searchParams;
    const phaseFilter = searchParams.get('phase'); // Optional phase filter

    // Verify access
    const hasAccess = await verifySessionAccess(sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify session exists
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch all unit instances with their datasheet abilities
    const unitInstances = await prisma.unitInstance.findMany({
      where: {
        gameSessionId: sessionId,
        isDestroyed: false, // Only include alive units
      },
      include: {
        fullDatasheet: {
          include: {
            abilities: {
              include: {
                ability: true,
              },
            },
          },
        },
      },
      orderBy: [
        { owner: 'asc' },
        { unitName: 'asc' },
      ],
    });

    // Helper function to check if ability is phase-relevant
    const isAbilityPhaseRelevant = (ability: {
      triggerPhase: string[];
      type: string;
      isReactive: boolean;
    }, phase: string | null): boolean => {
      if (!phase) return true;
      
      // Exclude special phase values (Deployment, Keyword, General)
      const hasSpecialPhase = ability.triggerPhase.some(p => 
        ['Deployment', 'Keyword', 'General'].includes(p)
      );
      if (hasSpecialPhase) {
        return false;
      }
      
      // Include if ability matches current phase
      if (ability.triggerPhase.includes(phase)) {
        return true;
      }
      
      // Include "Any" abilities only if they're faction abilities or reactive
      if (ability.triggerPhase.includes('Any')) {
        return ability.type === 'faction' || ability.isReactive;
      }
      
      return false;
    };

    // Helper function to check if ability description indicates unit-specific language
    const isUnitSpecificAbility = (description: string): boolean => {
      const unitSpecificPatterns = [
        /this unit/i,
        /this model/i,
        /models in this unit/i,
        /weapons equipped by models in this unit/i,
      ];
      return unitSpecificPatterns.some(pattern => pattern.test(description));
    };

    // Helper function to validate ability matches datasheet faction/keywords
    const abilityMatchesDatasheet = (
      ability: { requiredKeywords: string[] },
      datasheet: { faction: string; keywords: string } | null
    ): boolean => {
      if (!datasheet) return true; // If no datasheet, allow ability (shouldn't happen)
      
      // If ability has no required keywords, it's valid
      if (ability.requiredKeywords.length === 0) return true;
      
      // Parse datasheet keywords
      let datasheetKeywords: string[] = [];
      try {
        datasheetKeywords = JSON.parse(datasheet.keywords) as string[];
      } catch (e) {
        console.warn(`Failed to parse keywords for datasheet ${datasheet.faction}:`, e);
        return true; // If we can't parse, allow it (fail open)
      }
      
      // Check if any required keyword matches datasheet keywords (case-insensitive)
      const datasheetKeywordsUpper = datasheetKeywords.map(k => k.toUpperCase());
      return ability.requiredKeywords.some(reqKeyword => 
        datasheetKeywordsUpper.includes(reqKeyword.toUpperCase())
      );
    };

    // Transform to response format with parsed JSON fields
    const unitsWithAbilities = unitInstances.map(unit => {
      const abilities = unit.fullDatasheet?.abilities
        .map(da => {
          const triggerPhase = da.ability.triggerPhase 
            ? JSON.parse(da.ability.triggerPhase as string) as string[]
            : ['Any'];
          
          const requiredKeywords = da.ability.requiredKeywords
            ? JSON.parse(da.ability.requiredKeywords as string) as string[]
            : [];

          return {
            name: da.ability.name,
            type: da.ability.type,
            description: da.ability.description,
            triggerPhase,
            triggerSubphase: da.ability.triggerSubphase,
            isReactive: da.ability.isReactive,
            requiredKeywords,
            source: da.source,
          };
        })
        // Filter out abilities that don't match the datasheet's faction/keywords
        .filter(ability => {
          if (!unit.fullDatasheet) return false;
          return abilityMatchesDatasheet(ability, {
            faction: unit.fullDatasheet.faction,
            keywords: unit.fullDatasheet.keywords,
          });
        }) || [];

      // Filter by phase if specified
      const filteredAbilities = phaseFilter
        ? abilities.filter(ability => isAbilityPhaseRelevant(ability, phaseFilter))
        : abilities;

      return {
        unitId: unit.id,
        unitName: unit.unitName,
        owner: unit.owner as 'attacker' | 'defender',
        datasheet: unit.datasheet,
        abilities: filteredAbilities,
      };
    });

    // Group units by owner
    const attackerUnits = unitsWithAbilities.filter(u => u.owner === 'attacker');
    const defenderUnits = unitsWithAbilities.filter(u => u.owner === 'defender');

    // Helper function to compute army vs unit abilities for a set of units
    const computeAbilitiesForOwner = (units: typeof unitsWithAbilities) => {
      // Count how many units have each ability
      const abilityCounts = new Map<string, { count: number; ability: typeof unitsWithAbilities[0]['abilities'][0] }>();
      
      units.forEach(unit => {
        unit.abilities.forEach(ability => {
          const key = ability.name;
          if (!abilityCounts.has(key)) {
            abilityCounts.set(key, { count: 0, ability });
          }
          abilityCounts.get(key)!.count++;
        });
      });

      // Separate into army abilities (appear on multiple units) and unit abilities (appear on one unit)
      // Also check description for unit-specific language
      const armyAbilitiesMap = new Map<string, typeof unitsWithAbilities[0]['abilities'][0]>();
      const unitAbilitiesByUnit = new Map<string, typeof unitsWithAbilities[0]['abilities']>();

      units.forEach(unit => {
        const unitSpecificAbilities: typeof unitsWithAbilities[0]['abilities'] = [];
        
        unit.abilities.forEach(ability => {
          const count = abilityCounts.get(ability.name)!.count;
          const hasUnitSpecificLanguage = isUnitSpecificAbility(ability.description);
          
          // If ability appears on only one unit OR has unit-specific language, it's a unit ability
          if (count === 1 || hasUnitSpecificLanguage) {
            unitSpecificAbilities.push(ability);
          } else {
            // Army ability - deduplicate by name
            if (!armyAbilitiesMap.has(ability.name)) {
              armyAbilitiesMap.set(ability.name, ability);
            }
          }
        });

        if (unitSpecificAbilities.length > 0) {
          unitAbilitiesByUnit.set(unit.unitId, unitSpecificAbilities);
        }
      });

      return {
        armyAbilities: Array.from(armyAbilitiesMap.values()),
        units: units.map(unit => ({
          unitId: unit.unitId,
          unitName: unit.unitName,
          datasheet: unit.datasheet,
          abilities: unitAbilitiesByUnit.get(unit.unitId) || [],
        })),
      };
    };

    const attackerData = computeAbilitiesForOwner(attackerUnits);
    const defenderData = computeAbilitiesForOwner(defenderUnits);

    return NextResponse.json({
      sessionId,
      currentPhase: phaseFilter || undefined,
      attacker: {
        armyAbilities: attackerData.armyAbilities,
        units: attackerData.units.filter(u => u.abilities.length > 0),
      },
      defender: {
        armyAbilities: defenderData.armyAbilities,
        units: defenderData.units.filter(u => u.abilities.length > 0),
      },
    });
  } catch (error: any) {
    console.error('Error fetching unit abilities:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch unit abilities' },
      { status: 500 }
    );
  }
}
