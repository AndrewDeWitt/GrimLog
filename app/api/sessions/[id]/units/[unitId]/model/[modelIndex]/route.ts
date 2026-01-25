import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

// Model state interface
interface ModelState {
  role: string;
  currentWounds: number;
  maxWounds: number;
}

/**
 * PATCH /api/sessions/[id]/units/[unitId]/model/[modelIndex]
 * Update a specific model's wounds or destroy it
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string; modelIndex: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: sessionId, unitId, modelIndex } = await params;
    const body = await request.json();
    const index = parseInt(modelIndex, 10);

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

    // Parse modelsArray
    if (!unitInstance.modelsArray) {
      return NextResponse.json(
        { error: 'Unit does not have per-model tracking' },
        { status: 400 }
      );
    }

    let modelsArray: ModelState[];
    try {
      modelsArray = JSON.parse(unitInstance.modelsArray);
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to parse modelsArray' },
        { status: 500 }
      );
    }

    // Validate model index
    if (index < 0 || index >= modelsArray.length) {
      return NextResponse.json(
        { error: `Invalid model index: ${index}` },
        { status: 400 }
      );
    }

    const model = modelsArray[index];

    // Handle wound adjustment
    if (body.woundChange !== undefined) {
      const newWounds = Math.max(0, Math.min(model.maxWounds, model.currentWounds + body.woundChange));
      model.currentWounds = newWounds;

      // If wounds reach 0, mark as destroyed by removing from array
      if (newWounds === 0) {
        modelsArray.splice(index, 1);
      }
    }

    // Handle direct wound set
    if (body.currentWounds !== undefined) {
      const newWounds = Math.max(0, Math.min(model.maxWounds, body.currentWounds));
      model.currentWounds = newWounds;

      // If wounds reach 0, remove from array
      if (newWounds === 0) {
        modelsArray.splice(index, 1);
      }
    }

    // Handle destroy action
    if (body.destroy === true) {
      modelsArray.splice(index, 1);
    }

    // Recalculate totals
    const newModelCount = modelsArray.length;
    const newTotalWounds = modelsArray.reduce((sum, m) => sum + m.currentWounds, 0);
    const isDestroyed = newModelCount === 0;

    // Update unit instance
    const updatedUnit = await prisma.unitInstance.update({
      where: { id: unitId },
      data: {
        modelsArray: JSON.stringify(modelsArray),
        currentModels: newModelCount,
        currentWounds: newTotalWounds,
        isDestroyed,
        updatedAt: new Date()
      }
    });

    // Create timeline event
    const action = body.destroy 
      ? 'destroyed' 
      : body.woundChange 
        ? `adjusted wounds by ${body.woundChange > 0 ? '+' : ''}${body.woundChange}`
        : `set to ${body.currentWounds} wounds`;

    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        phase: session.currentPhase,
        description: `${unitInstance.owner}'s ${unitInstance.unitName} - Model #${index + 1} ${action}`,
        metadata: JSON.stringify({
          unitId,
          unitName: unitInstance.unitName,
          owner: unitInstance.owner,
          modelIndex: index,
          action: body.destroy ? 'destroy' : 'adjust',
          manualUpdate: true
        })
      }
    });

    return NextResponse.json({
      success: true,
      unitInstance: {
        ...updatedUnit,
        activeEffects: updatedUnit.activeEffects ? JSON.parse(updatedUnit.activeEffects) : []
      }
    });
  } catch (error: any) {
    console.error('Error updating model:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to update model' },
      { status: 500 }
    );
  }
}
