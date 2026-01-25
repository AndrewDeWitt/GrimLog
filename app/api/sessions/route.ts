import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k !== 'string') return false;
    if (typeof v !== 'string') return false;
  }
  return true;
}

// GET - Fetch all game sessions (for session picker)
export async function GET() {
  try {
    const user = await requireAuth();
    
    // Fetch sessions owned by user or shared with user
    const sessions = await prisma.gameSession.findMany({
      where: {
        OR: [
          { userId: user.id },
          // TODO: Add shared session support with JSON contains
        ]
      },
      orderBy: { startTime: 'desc' },
      include: {
        attackerArmy: {
          include: {
            player: true
          }
        },
        _count: {
          select: {
            timelineEvents: true,
            transcripts: true
          }
        }
      },
      take: 20 // Limit to last 20 sessions
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST - Create new game session with armies
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { attackerArmyId, defenderArmyId, deploymentType, firstTurn, missionMode, attackerAttachments } = body;

    // Validate required fields
    if (!attackerArmyId || !defenderArmyId) {
      return NextResponse.json(
        { error: 'Both attacker and defender armies are required' },
        { status: 400 }
      );
    }

    if (attackerAttachments !== undefined && !isRecordOfStrings(attackerAttachments)) {
      return NextResponse.json(
        { error: 'attackerAttachments must be an object of strings' },
        { status: 400 }
      );
    }

    // Fetch both armies with their units (verify ownership)
    const [attackerArmy, defenderArmy] = await Promise.all([
      prisma.army.findFirst({
        where: { 
          id: attackerArmyId,
          userId: user.id  // Verify user owns this army
        },
        include: {
          player: true,
          units: {
            include: {
              fullDatasheet: true
            }
          }
        }
      }),
      prisma.army.findUnique({
        where: { id: defenderArmyId },
        include: {
          player: true,
          units: {
            include: {
              fullDatasheet: true
            }
          }
        }
      })
    ]);

    if (!attackerArmy || !defenderArmy) {
      return NextResponse.json(
        { error: 'One or both armies not found' },
        { status: 404 }
      );
    }

    // Resolve + sanitize attacker attachment mapping.
    // Source priority:
    // 1) Request-provided mapping (battle-ready choice)
    // 2) Army-saved characterAttachments (fallback)
    let resolvedAttachments: Record<string, string> = {};
    if (attackerAttachments) {
      resolvedAttachments = attackerAttachments as Record<string, string>;
    } else if (attackerArmy.characterAttachments) {
      try {
        const parsed = JSON.parse(attackerArmy.characterAttachments);
        if (parsed && typeof parsed === 'object') {
          resolvedAttachments = parsed as Record<string, string>;
        }
      } catch {
        // ignore
      }
    }

    const unitNames = new Set(attackerArmy.units.map(u => u.name));
    const characterUnitIds = new Set(
      attackerArmy.units
        .filter(u => {
          try {
            const kws = JSON.parse(u.keywords || '[]');
            return Array.isArray(kws) && kws.some((kw: string) => (kw || '').toUpperCase() === 'CHARACTER');
          } catch {
            return false;
          }
        })
        .map(u => u.id)
    );

    const cleanedAttachments = Object.fromEntries(
      Object.entries(resolvedAttachments).filter(([charId, targetName]) => {
        if (!characterUnitIds.has(charId)) return false;
        if (!targetName) return false;
        return unitNames.has(targetName);
      })
    );

    // Create session linked to authenticated user
    // Mission mode is now global (same for both players)
    const resolvedMissionMode = missionMode || 'tactical';
    
    const session = await prisma.gameSession.create({
      data: {
        attackerArmyId,
        defenderArmyId, // Store full defender army link for detachment/faction access
        userId: user.id,
        defenderName: defenderArmy.player?.name || 'Defender',
        defenderFaction: defenderArmy.player?.faction || 'Unknown',
        currentPhase: 'Command',
        currentTurn: firstTurn || 'attacker', // Set to whoever goes first
        battleRound: 1,
        deploymentType: deploymentType || 'crucible-of-battle',
        firstTurn: firstTurn || 'attacker', // Store who goes first each round
        attackerMissionMode: resolvedMissionMode, // Global mission mode
        defenderMissionMode: resolvedMissionMode, // Global mission mode
        isActive: true,
        sharedWith: '[]'  // Empty array initially
      }
    });

    // Initialize unit instances for attacker army
    const attackerUnitsData = attackerArmy.units.map(unit => {
      let woundsPerModel = unit.fullDatasheet?.wounds || 1;
      let totalWounds = unit.modelCount * woundsPerModel;
      let modelsArray = null;
      
      // Check for composition data with mixed wounds (e.g., leader with different wounds)
      if (unit.fullDatasheet?.compositionData) {
        try {
          const compositionData = JSON.parse(unit.fullDatasheet.compositionData);
          const models: any[] = [];
          
          // Build models from composition for special roles
          for (const comp of compositionData) {
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
          // compositionData might be a template for min size, but unit could have more models
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
            // Composition has more than unit - trim to match (unlikely but safe)
            models.splice(unit.modelCount);
          }
          
          // Calculate actual total from models
          totalWounds = models.reduce((sum: number, m: any) => sum + m.maxWounds, 0);
          modelsArray = JSON.stringify(models);
        } catch (e) {
          console.warn(`Failed to parse compositionData for ${unit.name}:`, e);
        }
      }
      
      // If no composition, create simple array
      if (!modelsArray) {
        const models = Array.from({ length: unit.modelCount }, () => ({
          role: 'regular',
          currentWounds: woundsPerModel,
          maxWounds: woundsPerModel
        }));
        modelsArray = JSON.stringify(models);
      }

      let isCharacter = false;
      try {
        const kws = JSON.parse(unit.keywords || '[]');
        isCharacter = Array.isArray(kws) && kws.some((kw: string) => (kw || '').toUpperCase() === 'CHARACTER');
      } catch {
        isCharacter = false;
      }

      return {
        gameSessionId: session.id,
        unitName: unit.name,
          owner: 'attacker',
        datasheet: unit.datasheet,
        datasheetId: unit.datasheetId,
        startingModels: unit.modelCount,
        currentModels: unit.modelCount,
        startingWounds: totalWounds,
        currentWounds: totalWounds,
        woundsPerModel: woundsPerModel,
        modelsArray: modelsArray,
        isDestroyed: false,
        isBattleShocked: false,
        activeEffects: JSON.stringify([]),
        attachedToUnit: isCharacter ? (cleanedAttachments[unit.id] || null) : null,
      };
    });

    const attackerUnitInstances = await prisma.unitInstance.createMany({
      data: attackerUnitsData
    });

    // Initialize unit instances for opponent army
    const defenderUnitsData = defenderArmy.units.map(unit => {
      let woundsPerModel = unit.fullDatasheet?.wounds || 1;
      let totalWounds = unit.modelCount * woundsPerModel;
      let modelsArray = null;
      
      // Check for composition data with mixed wounds (e.g., leader with different wounds)
      if (unit.fullDatasheet?.compositionData) {
        try {
          const compositionData = JSON.parse(unit.fullDatasheet.compositionData);
          const models: any[] = [];
          
          // Build models from composition for special roles
          for (const comp of compositionData) {
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
          // compositionData might be a template for min size, but unit could have more models
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
            // Composition has more than unit - trim to match (unlikely but safe)
            models.splice(unit.modelCount);
          }
          
          // Calculate actual total from models
          totalWounds = models.reduce((sum: number, m: any) => sum + m.maxWounds, 0);
          modelsArray = JSON.stringify(models);
        } catch (e) {
          console.warn(`Failed to parse compositionData for ${unit.name}:`, e);
        }
      }
      
      // If no composition, create simple array
      if (!modelsArray) {
        const models = Array.from({ length: unit.modelCount }, () => ({
          role: 'regular',
          currentWounds: woundsPerModel,
          maxWounds: woundsPerModel
        }));
        modelsArray = JSON.stringify(models);
      }

      return {
        gameSessionId: session.id,
        unitName: unit.name,
          owner: 'defender',
        datasheet: unit.datasheet,
        datasheetId: unit.datasheetId,
        startingModels: unit.modelCount,
        currentModels: unit.modelCount,
        startingWounds: totalWounds,
        currentWounds: totalWounds,
        woundsPerModel: woundsPerModel,
        modelsArray: modelsArray,
        isDestroyed: false,
        isBattleShocked: false,
        activeEffects: JSON.stringify([])
      };
    });

    const defenderUnitInstances = await prisma.unitInstance.createMany({
      data: defenderUnitsData
    });

    // Create initial timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: session.id,
        eventType: 'custom',
        phase: 'Command',
        description: `Battle initialized: ${attackerArmy.name} vs ${defenderArmy.name}`,
        metadata: JSON.stringify({
          attackerArmy: attackerArmy.name,
          attackerFaction: attackerArmy.player?.faction || 'Unknown',
          attackerUnits: attackerUnitInstances.count,
          defenderArmy: defenderArmy.name,
          defenderFaction: defenderArmy.player?.faction || 'Unknown',
          defenderUnits: defenderUnitInstances.count
        })
      }
    });

    return NextResponse.json({
      session,
      unitsInitialized: {
        attacker: attackerUnitInstances.count,
        defender: defenderUnitInstances.count
      }
    });
  } catch (error: any) {
    console.error('Error creating session:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

