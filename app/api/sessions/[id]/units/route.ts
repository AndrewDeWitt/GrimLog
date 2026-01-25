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

/**
 * GET /api/sessions/[id]/units
 * Fetch all unit instances for a game session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const sessionId = (await params).id;

    // Verify access
    const hasAccess = await verifySessionAccess(sessionId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify session exists
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attackerArmy: {
          include: {
            units: {
              include: {
                fullDatasheet: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch all unit instances for this session
    const unitInstances = await prisma.unitInstance.findMany({
      where: {
        gameSessionId: sessionId
      },
      include: {
        fullDatasheet: {
          include: {
            weapons: {
              include: {
                weapon: true
              }
            }
          }
        }
      },
      orderBy: [
        { owner: 'asc' },
        { unitName: 'asc' }
      ]
    });

    // Parse JSON fields and include faction for icon resolution
    const parsedInstances = unitInstances.map(unit => ({
      ...unit,
      faction: unit.fullDatasheet?.faction || null,
      activeEffects: unit.activeEffects ? JSON.parse(unit.activeEffects) : []
    }));

    return NextResponse.json({
      sessionId,
      attackerArmyId: session.attackerArmyId,
      unitInstances: parsedInstances
    });
  } catch (error: any) {
    console.error('Error fetching unit instances:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch unit instances' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/units
 * Create/initialize unit instances from army lists
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const sessionId = (await params).id;
    const body = await request.json();
    const { attackerArmyId, opponentUnits } = body;

    // Verify ownership (only owner can initialize units)
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, currentPhase: true }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const createdUnits: any[] = [];

    // Initialize player's units from army list
    if (attackerArmyId) {
      const army = await prisma.army.findUnique({
        where: { id: attackerArmyId },
        include: {
          units: {
            include: {
              fullDatasheet: true
            }
          }
        }
      });

      if (army) {
        // Update session with player army
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { attackerArmyId }
        });

        // Parse character attachments
        let characterAttachments: Record<string, string> = {};
        if (army.characterAttachments) {
          try {
            characterAttachments = JSON.parse(army.characterAttachments);
          } catch (e) {
            console.warn('Failed to parse character attachments');
          }
        }

        // Create unit instances for each unit in army
        for (const unit of army.units) {
          let woundsPerModel = unit.fullDatasheet?.wounds || 1;
          let modelsArray = null;
          let totalWounds = 0;
          
          // Initialize modelsArray from composition if available
          if (unit.composition) {
            try {
              const composition = JSON.parse(unit.composition);
              const models: any[] = [];
              
              // Build models array from composition for special roles
              for (const comp of composition) {
                const count = comp.count || 1;
                const role = comp.role || 'regular';
                const wounds = comp.woundsPerModel || woundsPerModel;
                
                for (let i = 0; i < count; i++) {
                  models.push({
                    role,
                    currentWounds: wounds,
                    maxWounds: wounds
                  });
                }
              }
              
              // CRITICAL: Ensure models array matches actual unit.modelCount
              // Composition might be a template for min size, but unit could have more models
              if (models.length < unit.modelCount) {
                const extraModels = unit.modelCount - models.length;
                console.log(`Adding ${extraModels} extra regular models to ${unit.name} (composition had ${models.length}, unit has ${unit.modelCount})`);
                for (let i = 0; i < extraModels; i++) {
                  models.push({
                    role: 'regular',
                    currentWounds: woundsPerModel,
                    maxWounds: woundsPerModel
                  });
                }
              } else if (models.length > unit.modelCount) {
                // Composition has more than unit - trim to match
                models.splice(unit.modelCount);
              }
              
              // Calculate actual total wounds from modelsArray
              totalWounds = models.reduce((sum, m) => sum + m.maxWounds, 0);
              modelsArray = JSON.stringify(models);
              
              // Set woundsPerModel to most common value (for display)
              const woundCounts = models.map(m => m.maxWounds);
              woundsPerModel = Math.max(...woundCounts);
            } catch (e) {
              console.warn(`Failed to parse composition for ${unit.name}:`, e);
              totalWounds = unit.modelCount * woundsPerModel;
            }
          } else {
            // No composition data, calculate simple total
            totalWounds = unit.modelCount * woundsPerModel;
          }
          
          // If no composition data, create simple array of regular models
          if (!modelsArray) {
            const models = Array.from({ length: unit.modelCount }, () => ({
              role: 'regular',
              currentWounds: woundsPerModel,
              maxWounds: woundsPerModel
            }));
            modelsArray = JSON.stringify(models);
          }

          // Check if this character is attached to a unit (using unit ID as key)
          const attachedToUnit = characterAttachments[unit.id] || null;

          const unitInstance = await prisma.unitInstance.create({
            data: {
              gameSessionId: sessionId,
              unitName: unit.name,
              owner: 'player',
              datasheet: unit.datasheet,
              datasheetId: unit.datasheetId,
              iconUrl: null,
              startingModels: unit.modelCount,
              currentModels: unit.modelCount,
              startingWounds: totalWounds,
              currentWounds: totalWounds,
              woundsPerModel: woundsPerModel,
              modelsArray: modelsArray,
              attachedToUnit: attachedToUnit,
              isDestroyed: false,
              isBattleShocked: false,
              activeEffects: JSON.stringify([])
            }
          });

          createdUnits.push(unitInstance);
        }
      }
    }

    // Initialize opponent's units (if provided)
    if (opponentUnits && Array.isArray(opponentUnits)) {
      for (const unit of opponentUnits) {
        const woundsPerModel = unit.woundsPerModel || 1;
        const totalWounds = unit.modelCount * woundsPerModel;
        
        // Create simple modelsArray for opponent units
        const models = Array.from({ length: unit.modelCount }, () => ({
          role: 'regular',
          currentWounds: woundsPerModel,
          maxWounds: woundsPerModel
        }));
        const modelsArray = JSON.stringify(models);

        const unitInstance = await prisma.unitInstance.create({
          data: {
            gameSessionId: sessionId,
            unitName: unit.name,
            owner: 'opponent',
            datasheet: unit.datasheet || unit.name,
            iconUrl: unit.iconUrl || null,
            startingModels: unit.modelCount,
            currentModels: unit.modelCount,
            startingWounds: totalWounds,
            currentWounds: totalWounds,
            woundsPerModel: woundsPerModel,
            modelsArray: modelsArray,
            attachedToUnit: null, // Opponent attachments not supported yet
            isDestroyed: false,
            isBattleShocked: false,
            activeEffects: JSON.stringify([])
          }
        });

        createdUnits.push(unitInstance);
      }
    }

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `Initialized ${createdUnits.length} units for battle tracking`,
        metadata: JSON.stringify({
          playerUnits: createdUnits.filter(u => u.owner === 'player').length,
          opponentUnits: createdUnits.filter(u => u.owner === 'opponent').length
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Initialized ${createdUnits.length} units`,
      unitInstances: createdUnits
    });
  } catch (error: any) {
    console.error('Error initializing unit instances:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to initialize units' },
      { status: 500 }
    );
  }
}
