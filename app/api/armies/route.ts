import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score from 0 to 1 (1 = identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return shorter / longer; // Returns 0.5-1.0 range for containment
  }
  
  // Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  return 1 - (distance / maxLength);
}

/**
 * Normalize faction names for comparison (handles case and common variations)
 */
function normalizeFaction(faction: string): string {
  if (!faction) return '';
  
  return faction.toLowerCase().trim()
    .replace(/[-\s_]+/g, ' ')  // Normalize separators (hyphens, underscores) to spaces
    .replace(/\s+/g, ' ')       // Collapse multiple spaces to single space
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Filter armies by userId
    const armies = await prisma.army.findMany({
      where: {
        userId: user.id
      },
      include: {
        player: true,
        stratagems: {
            select: {
                id: true,
                name: true
            }
        },
        faction: {
          select: {
            name: true,
            parentFactionId: true
          }
        },
        _count: {
          select: {
            units: true,
            stratagems: true
          }
        }
      },
    });

    if (detailed) {
      // Return detailed format for session creation
      return NextResponse.json(armies);
    }

    // Return simplified format for armies list page with ENRICHED stratagems
    const enrichedArmies = await Promise.all(armies.map(async (army) => {
      let availableStratagems: { id: string; name: string }[] = [];

      // 1. Get Manual Stratagems
      const manualStratagems = army.stratagems.map(s => ({ id: s.id, name: s.name }));

      // 2. Get Reference Stratagems (if faction/detachment exists)
      if (army.factionId || army.player?.faction) {
        try {
          // Build query to include both faction AND parent faction stratagems
          // This allows subfactions (e.g., Space Wolves) to access parent faction detachments (e.g., Space Marines Stormlance Task Force)
          let query: any = {};
          if (army.factionId) {
            const factionIds = [army.factionId];
            if (army.faction?.parentFactionId) {
              factionIds.push(army.faction.parentFactionId);
            }
            query.factionId = { in: factionIds };
          } else if (army.player?.faction) {
            query.faction = { equals: army.player.faction, mode: 'insensitive' };
          }

          const allFactionStratagems = await prisma.stratagemData.findMany({
            where: query,
            select: { id: true, name: true, detachment: true }
          });

          // Filter by Detachment
          const armyDetachment = (army.detachment || '').toLowerCase().trim();
          
          const filtered = allFactionStratagems.filter(s => {
            const sDetachment = (s.detachment || '').toLowerCase().trim();
            // Include if Core, matches detachment, or no detachment restriction (if army has no detachment, usually only core)
            if (!armyDetachment) return sDetachment === 'core' || !sDetachment;
            return sDetachment === 'core' || sDetachment === armyDetachment || !sDetachment;
          });

          // Map to simple objects
          availableStratagems = filtered.map(s => ({ id: s.id, name: s.name }));
        } catch (err) {
          console.error(`Error fetching reference stratagems for army ${army.id}:`, err);
        }
      }

      // 3. Merge and Deduplicate
      const combined = [...manualStratagems, ...availableStratagems];
      // Simple dedupe by name to avoid clutter
      const uniqueStratagems = Array.from(new Map(combined.map(item => [item.name, item])).values());

      return {
        id: army.id,
        name: army.name,
        playerName: army.player?.name || 'Unknown',
        faction: army.faction?.name || army.player?.faction || 'Unknown',
        pointsLimit: army.pointsLimit,
        unitCount: army._count.units,
        stratagemCount: uniqueStratagems.length, // Use the true count
        stratagems: uniqueStratagems, // Pass the full list
        updatedAt: army.updatedAt,
      };
    }));

    return NextResponse.json(enrichedArmies);
  } catch (error: any) {
    console.error('Error fetching armies:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch armies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { playerName, faction, armyName, pointsLimit, units, detachment } = body;

    if (!playerName || !faction || !armyName) {
      return NextResponse.json(
        { error: 'Missing required fields: playerName, faction, or armyName' },
        { status: 400 }
      );
    }

    // Create or find player
    let player = await prisma.player.findFirst({
      where: { name: playerName, faction },
    });

    if (!player) {
      player = await prisma.player.create({
        data: { name: playerName, faction },
      });
    }

    // Resolve Faction ID
    // Try to find exact match first
    let factionRecord = await prisma.faction.findFirst({
      where: { name: { equals: faction, mode: 'insensitive' } },
      include: { parentFaction: true }
    });

    // If not found, try to extract subfaction from compound name like "Space Marines (Space Wolves)"
    if (!factionRecord) {
      const subfactionMatch = faction.match(/\(([^)]+)\)/);
      if (subfactionMatch) {
        const subfactionName = subfactionMatch[1]; // e.g., "Space Wolves"
        factionRecord = await prisma.faction.findFirst({
          where: { name: { equals: subfactionName, mode: 'insensitive' } },
          include: { parentFaction: true }
        });
      }
    }

    // If still not found, try normalize/contains match
    if (!factionRecord) {
      const normFaction = normalizeFaction(faction);
      factionRecord = await prisma.faction.findFirst({
        where: { name: { contains: normFaction, mode: 'insensitive' } },
        include: { parentFaction: true }
      });
    }

    const factionId = factionRecord?.id;
    
    // Validate datasheet IDs if provided
    const validatedUnits = units ? await Promise.all(
      units.map(async (unit: any) => {
        let datasheetId = unit.parsedDatasheet?.datasheetId || null;
        let needsReview = unit.needsReview || false;

        // If a datasheet ID was provided, verify it exists and matches faction/name
        if (datasheetId) {
          const datasheet = await prisma.datasheet.findUnique({
            where: { id: datasheetId }
          });

          if (!datasheet) {
            // Datasheet doesn't exist
            console.warn(`Datasheet ID ${datasheetId} not found for unit "${unit.name}". Setting to null and marking for review.`);
            datasheetId = null;
            needsReview = true;
          } else {
            // Validate faction matches using ID hierarchy
            let isValidFaction = false;
            
            if (factionId && datasheet.factionId) {
              // 1. Direct Match
              if (factionId === datasheet.factionId) {
                isValidFaction = true;
              } 
              // 2. Parent Match (e.g. Space Wolves taking Space Marines)
              else if (factionRecord?.parentFactionId === datasheet.factionId) {
                // Check forbidden keywords
                isValidFaction = true;
                if (factionRecord.metaData) {
                  try {
                    const meta = JSON.parse(factionRecord.metaData);
                    const forbiddenKeywords = meta.forbiddenKeywords || [];
                    const datasheetKeywords = JSON.parse(datasheet.keywords || '[]');
                    
                    // If datasheet has ANY forbidden keyword, it's invalid
                    const hasForbidden = forbiddenKeywords.some((fk: string) => 
                      datasheetKeywords.includes(fk)
                    );
                    
                    if (hasForbidden) {
                      console.warn(`Unit ${unit.name} has forbidden keywords for ${faction}: ${forbiddenKeywords.filter((k: string) => datasheetKeywords.includes(k)).join(', ')}`);
                      isValidFaction = false;
                    }
                  } catch (e) {
                    console.error('Error parsing faction metadata', e);
                  }
                }
              }
            } else {
              // Fallback to string matching if IDs are missing (legacy support)
              const normalizedArmyFaction = normalizeFaction(faction);
              const normalizedDatasheetFaction = normalizeFaction(datasheet.faction);
              isValidFaction = normalizedArmyFaction === normalizedDatasheetFaction;
            }
            
            if (!isValidFaction) {
              console.warn(
                `Faction mismatch: Unit "${unit.name}" in ${faction} army matched to ${datasheet.faction} datasheet "${datasheet.name}". ` +
                `Setting datasheetId to null and marking for review.`
              );
              datasheetId = null;
              needsReview = true;
            } else {
              // Validate name similarity (fuzzy match)
              // Strip points suffix from unit name for comparison (e.g., "Arjac Rockfist (105 Points)" -> "Arjac Rockfist")
              const rawUnitName = unit.name || unit.datasheet || '';
              const unitName = rawUnitName.replace(/\s*\(\d+\s*Points?\)\s*$/i, '').trim();
              const datasheetName = datasheet.name;
              const nameSimilarity = calculateSimilarity(unitName, datasheetName);
              
              // Require at least 70% similarity for name match
              // This allows for minor variations like "Bjorn The Fell-Handed" vs "Bjorn the Fell-Handed"
              // Only override if parser didn't explicitly set needsReview: false
              if (nameSimilarity < 0.7 && unit.needsReview !== false) {
                console.warn(
                  `Name mismatch: Unit "${unitName}" (${(nameSimilarity * 100).toFixed(0)}% similarity) matched to datasheet "${datasheetName}". ` +
                  `Marking for review.`
                );
                needsReview = true;
              }
            }
          }
        }

        return {
          name: unit.name,
          datasheet: unit.datasheet || unit.name,
          keywords: JSON.stringify(unit.keywords || []),
          pointsCost: unit.pointsCost,
          modelCount: unit.modelCount || 1,
          composition: unit.composition ? JSON.stringify(unit.composition) : null,
          wargear: unit.wargear ? JSON.stringify(unit.wargear) : null,
          enhancements: unit.enhancements ? JSON.stringify(unit.enhancements) : null,
          weapons: unit.weapons ? JSON.stringify(unit.weapons) : null,
          abilities: unit.abilities ? JSON.stringify(unit.abilities) : null,
          needsReview,
          datasheetId,
        };
      })
    ) : [];

    // Create army with validated units, linked to authenticated user
    const army = await prisma.army.create({
      data: {
        name: armyName,
        playerId: player.id,
        userId: user.id,
        factionId: factionId, // Link to Faction table
        pointsLimit: pointsLimit || 2000,
        detachment: detachment, // Save detachment if provided
        units: validatedUnits.length > 0 ? {
          create: validatedUnits,
        } : undefined,
      },
      include: {
        units: true,
        player: true,
      },
    });

    // Count units that need review
    const unitsNeedingReview = army.units?.filter((u: any) => u.needsReview).length || 0;

    return NextResponse.json({
      ...army,
      stats: {
        totalUnits: army.units?.length || 0,
        unitsNeedingReview,
        unitsWithDatasheets: army.units?.filter((u: any) => u.datasheetId).length || 0
      }
    });
  } catch (error: any) {
    console.error('Error creating army:', error);
    
    // Check for auth errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Better error messages
    if (error.code === 'P2003') {
      // Log details server-side but don't expose to client
      console.error('Foreign key constraint details:', error.meta);
      return NextResponse.json(
        { error: 'Foreign key constraint failed. One or more datasheets do not exist.' },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An army with this name already exists for this player.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to create army',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

