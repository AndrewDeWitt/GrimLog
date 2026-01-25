import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

// Model state interface for per-model tracking
interface ModelState {
  role: string;
  currentWounds: number;
  maxWounds: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Distribute wounds across models (REMOVE wounds, starting from regulars)
 * Takes total wounds REMAINING and distributes to models, killing from regular->leader
 */
function distributeWoundsAcrossModels(
  models: ModelState[],
  totalWoundsRemaining: number
): ModelState[] {
  // Can't have negative wounds
  if (totalWoundsRemaining < 0) {
    totalWoundsRemaining = 0;
  }
  
  // Calculate total max wounds
  const totalMaxWounds = models.reduce((sum, m) => sum + m.maxWounds, 0);
  
  // Can't have more wounds than max
  if (totalWoundsRemaining > totalMaxWounds) {
    totalWoundsRemaining = totalMaxWounds;
  }
  
  // If no wounds remaining, all models are dead
  if (totalWoundsRemaining === 0) {
    return [];
  }
  
  // Sort models: LEADERS GET WOUNDS FIRST (so they survive)
  // Higher rank = gets wounds first = survives
  const roleRankings = { 'leader': 4, 'sergeant': 4, 'heavy_weapon': 3, 'special_weapon': 2, 'regular': 1 };
  
  const sortedModels = [...models].sort((a, b) => {
    // Healthy models get priority (wounded models die first)
    const aWounded = a.currentWounds < a.maxWounds ? 0 : 1;
    const bWounded = b.currentWounds < b.maxWounds ? 0 : 1;
    if (bWounded !== aWounded) return bWounded - aWounded;
    
    // Then by role: leaders before regulars (leaders survive)
    const aRank = roleRankings[a.role as keyof typeof roleRankings] || 1;
    const bRank = roleRankings[b.role as keyof typeof roleRankings] || 1;
    return bRank - aRank; // Reverse sort (high rank first)
  });
  
  // Distribute wounds remaining across models
  let woundsToDistribute = totalWoundsRemaining;
  const updatedModels: ModelState[] = [];
  
  for (const model of sortedModels) {
    if (woundsToDistribute >= model.maxWounds) {
      // This model gets full health
      updatedModels.push({
        ...model,
        currentWounds: model.maxWounds
      });
      woundsToDistribute -= model.maxWounds;
    } else if (woundsToDistribute > 0) {
      // This model gets partial wounds (last model standing)
      updatedModels.push({
        ...model,
        currentWounds: woundsToDistribute
      });
      woundsToDistribute = 0;
    }
    // If woundsToDistribute is 0, rest of models are dead (don't add)
  }
  
  return updatedModels;
}

/**
 * PATCH /api/sessions/[id]/units/[unitId]
 * Manually update a unit instance (for UI controls)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: sessionId, unitId } = await params;
    const body = await request.json();

    // Verify session exists and user owns it
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

    // Verify unit instance exists and fetch datasheet for wounds info
    const unitInstance = await prisma.unitInstance.findUnique({
      where: { id: unitId },
      include: {
        fullDatasheet: true
      }
    });

    if (!unitInstance || unitInstance.gameSessionId !== sessionId) {
      return NextResponse.json(
        { error: 'Unit not found in this session' },
        { status: 404 }
      );
    }

    // Get wounds per model from datasheet or existing data
    const woundsPerModel = unitInstance.woundsPerModel || 
                           unitInstance.fullDatasheet?.wounds || 
                           1;
    
    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    // Allow explicit startingWounds override (used by UI repair tools)
    if (body.startingWounds !== undefined) {
      const startingWounds = Number(body.startingWounds);
      if (!Number.isNaN(startingWounds)) {
        updateData.startingWounds = Math.max(0, Math.floor(startingWounds));
      }
    }

    // Allow explicit woundsPerModel override (used when mixed profiles exist)
    if (body.woundsPerModel !== undefined) {
      const wpm = Number(body.woundsPerModel);
      if (!Number.isNaN(wpm)) {
        updateData.woundsPerModel = Math.max(1, Math.floor(wpm));
      }
    }
    
    // Parse existing modelsArray if available
    let modelsArray: ModelState[] | null = null;
    if (unitInstance.modelsArray) {
      try {
        modelsArray = JSON.parse(unitInstance.modelsArray);
      } catch (e) {
        console.warn('Failed to parse modelsArray, will initialize if needed');
      }
    }
    
    // Initialize modelsArray if it doesn't exist (lazy initialization on first update)
    if (!modelsArray && unitInstance.currentModels > 0) {
      modelsArray = [];
      
      // Check if datasheet has composition data with mixed wounds
      if (unitInstance.fullDatasheet?.compositionData) {
        try {
          const compositionData = JSON.parse(unitInstance.fullDatasheet.compositionData);
          
          // Build models from composition (supports mixed wounds like Raveners)
          for (const comp of compositionData) {
            const count = comp.count || 1;
            const role = comp.role || 'regular';
            const wounds = comp.woundsPerModel || woundsPerModel;
            
            for (let i = 0; i < count; i++) {
              modelsArray.push({
                role,
                currentWounds: wounds,
                maxWounds: wounds
              });
            }
          }
        } catch (e) {
          console.warn('Failed to parse compositionData, using simple initialization');
          // Fallback to simple initialization
          for (let i = 0; i < unitInstance.currentModels; i++) {
            modelsArray.push({
              role: 'regular',
              currentWounds: woundsPerModel,
              maxWounds: woundsPerModel
            });
          }
        }
      } else {
        // Simple initialization: all models have same wounds
        for (let i = 0; i < unitInstance.currentModels; i++) {
          modelsArray.push({
            role: 'regular',
            currentWounds: woundsPerModel,
            maxWounds: woundsPerModel
          });
        }
      }
      
      // Save initialized modelsArray and correct woundsPerModel
      updateData.modelsArray = JSON.stringify(modelsArray);
      updateData.woundsPerModel = woundsPerModel;
      
      // Recalculate actual total wounds from modelsArray
      const actualTotalWounds = modelsArray.reduce((sum, m) => sum + m.maxWounds, 0);
      if (unitInstance.currentWounds === unitInstance.startingWounds) {
        // If unit is at full health, update to correct total
        updateData.startingWounds = actualTotalWounds;
        updateData.currentWounds = actualTotalWounds;
      }
    }

    // DIRECT MODELS ARRAY UPDATE (advanced UI operations: max-wounds edits, repair/sync)
    // If provided, this takes precedence over currentModels/currentWounds adjustments.
    if (body.modelsArray !== undefined) {
      let incoming: any = body.modelsArray;
      if (typeof incoming === 'string') {
        try {
          incoming = JSON.parse(incoming);
        } catch (e) {
          return NextResponse.json(
            { error: 'Failed to parse modelsArray override' },
            { status: 400 }
          );
        }
      }

      if (!Array.isArray(incoming)) {
        return NextResponse.json(
          { error: 'modelsArray must be an array (or JSON string array)' },
          { status: 400 }
        );
      }

      const normalized: ModelState[] = [];
      for (const m of incoming) {
        if (!m || typeof m !== 'object') continue;
        const role = typeof m.role === 'string' ? m.role : 'regular';
        const maxWoundsRaw = Number(m.maxWounds);
        const currentWoundsRaw = Number(m.currentWounds);
        if (Number.isNaN(maxWoundsRaw) || Number.isNaN(currentWoundsRaw)) continue;

        const maxWounds = Math.max(1, Math.floor(maxWoundsRaw));
        const currentWounds = clamp(Math.floor(currentWoundsRaw), 0, maxWounds);

        // Keep invariant: modelsArray represents surviving models only
        if (currentWounds <= 0) continue;

        normalized.push({ role, maxWounds, currentWounds });
      }

      const newTotalWounds = normalized.reduce((sum, m) => sum + m.currentWounds, 0);
      updateData.modelsArray = JSON.stringify(normalized);
      updateData.currentModels = normalized.length;
      updateData.currentWounds = newTotalWounds;
      updateData.isDestroyed = normalized.length === 0;

      // Update woundsPerModel to the max profile we see (helps UI label/controls)
      const maxProfile = normalized.length > 0 ? Math.max(...normalized.map(m => m.maxWounds)) : woundsPerModel;
      updateData.woundsPerModel = maxProfile;
    }

    // WOUND ADJUSTMENT: Recalculate models based on per-model tracking
    if (body.modelsArray === undefined && body.currentWounds !== undefined) {
      const newTotalWounds = Math.max(0, body.currentWounds);
      updateData.currentWounds = newTotalWounds;
      
      // If we have per-model tracking, distribute wounds properly
      if (modelsArray && modelsArray.length > 0) {
        // Redistribute wounds across models
        const updatedModels = distributeWoundsAcrossModels(modelsArray, newTotalWounds);
        
        // Update currentModels based on surviving models
        updateData.currentModels = updatedModels.length;
        updateData.modelsArray = JSON.stringify(updatedModels);
        updateData.woundsPerModel = woundsPerModel;
        
        // Auto-destroy if no models left
        if (updatedModels.length === 0) {
          updateData.isDestroyed = true;
          updateData.currentModels = 0;
          updateData.currentWounds = 0;
        }
      } else {
        // No per-model tracking, calculate models from total wounds
        const calculatedModels = Math.ceil(newTotalWounds / woundsPerModel);
        updateData.currentModels = Math.max(0, Math.min(calculatedModels, unitInstance.startingModels));
        
        // Auto-destroy if wounds reach 0
        if (newTotalWounds === 0) {
          updateData.isDestroyed = true;
          updateData.currentModels = 0;
        }
      }
    }

    // MANUAL MODEL ADJUSTMENT: Update wounds proportionally
    if (body.modelsArray === undefined && body.currentModels !== undefined && body.currentWounds === undefined) {
      const newModels = Math.max(0, body.currentModels);
      updateData.currentModels = newModels;
      
      // Calculate proportional wounds
      const woundsPerModelAvg = unitInstance.startingWounds && unitInstance.startingModels > 0
        ? unitInstance.startingWounds / unitInstance.startingModels
        : woundsPerModel;
      updateData.currentWounds = Math.round(newModels * woundsPerModelAvg);
      
      // Update modelsArray if it exists
      if (modelsArray) {
        // Adjust array length to match new model count
        if (newModels < modelsArray.length) {
          // Remove models (from end)
          modelsArray = modelsArray.slice(0, newModels);
        } else if (newModels > modelsArray.length) {
          // Add models
          const modelsToAdd = newModels - modelsArray.length;
          for (let i = 0; i < modelsToAdd; i++) {
            modelsArray.push({
              role: 'regular',
              currentWounds: woundsPerModel,
              maxWounds: woundsPerModel
            });
          }
        }
        updateData.modelsArray = JSON.stringify(modelsArray);
      }
      
      // Auto-destroy if models reach 0
      if (newModels === 0) {
        updateData.isDestroyed = true;
        updateData.currentWounds = 0;
      }
    }

    if (body.isDestroyed !== undefined) {
      updateData.isDestroyed = body.isDestroyed;
      if (body.isDestroyed) {
        updateData.currentModels = 0;
        updateData.currentWounds = 0;
      }
    }

    if (body.isBattleShocked !== undefined) {
      updateData.isBattleShocked = body.isBattleShocked;
    }

    if (body.activeEffects !== undefined) {
      updateData.activeEffects = JSON.stringify(body.activeEffects);
    }

    if (body.iconUrl !== undefined) {
      updateData.iconUrl = body.iconUrl;
    }

    // Update the unit instance
    const updatedUnit = await prisma.unitInstance.update({
      where: { id: unitId },
      data: updateData
    });

    // Create timeline event for manual update
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `Manual update: ${updatedUnit.owner}'s ${updatedUnit.unitName} - ${updatedUnit.currentModels}/${updatedUnit.startingModels} models`,
        metadata: JSON.stringify({
          unitId: updatedUnit.id,
          unitName: updatedUnit.unitName,
          owner: updatedUnit.owner,
          currentModels: updatedUnit.currentModels,
          currentWounds: updatedUnit.currentWounds,
          isDestroyed: updatedUnit.isDestroyed,
          isBattleShocked: updatedUnit.isBattleShocked,
          manualUpdate: true
        })
      }
    });

    // Parse JSON fields for response
    const responseUnit = {
      ...updatedUnit,
      activeEffects: updatedUnit.activeEffects ? JSON.parse(updatedUnit.activeEffects) : []
    };

    return NextResponse.json({
      success: true,
      unitInstance: responseUnit
    });
  } catch (error: any) {
    console.error('Error updating unit instance:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to update unit' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/units/[unitId]
 * Remove a unit instance (for corrections/mistakes)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: sessionId, unitId } = await params;

    // Verify session exists and user owns it
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

    // Verify unit instance exists
    const unitInstance = await prisma.unitInstance.findUnique({
      where: { id: unitId }
    });

    if (!unitInstance || unitInstance.gameSessionId !== sessionId) {
      return NextResponse.json(
        { error: 'Unit not found in this session' },
        { status: 404 }
      );
    }

    // Delete the unit instance
    await prisma.unitInstance.delete({
      where: { id: unitId }
    });

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `Removed unit: ${unitInstance.owner}'s ${unitInstance.unitName}`,
        metadata: JSON.stringify({
          unitId: unitInstance.id,
          unitName: unitInstance.unitName,
          owner: unitInstance.owner,
          removed: true
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Unit ${unitInstance.unitName} removed`
    });
  } catch (error: any) {
    console.error('Error deleting unit instance:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to delete unit' },
      { status: 500 }
    );
  }
}
