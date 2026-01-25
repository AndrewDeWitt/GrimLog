import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';
import { invalidateCachePattern } from '@/lib/requestCache';

interface RouteParams {
  params: Promise<{ id: string; eventId: string }>;
}

/**
 * Reverse the state changes caused by an event
 */
async function reverseEventStateChanges(event: any, sessionId: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });
  
  if (!session) return;
  
  const metadata = event.metadata ? JSON.parse(event.metadata) : {};
  
  // Reverse changes based on event type
  switch (event.eventType) {
    case 'phase':
      // Restore previous phase, turn, and round (if stored in metadata)
      if (metadata.previousPhase !== undefined && metadata.previousTurn !== undefined) {
        const updateData: any = {
          currentPhase: metadata.previousPhase,
          currentTurn: metadata.previousTurn
        };
        
        // If round was advanced, revert it too
        if (metadata.roundAdvancement && metadata.previousRound !== undefined) {
          updateData.battleRound = metadata.previousRound;
          console.log(`✅ Restoring phase: ${metadata.previousPhase}, turn: ${metadata.previousTurn}, round: ${metadata.previousRound}`);
        } else {
          console.log(`✅ Restoring phase: ${metadata.previousPhase}, turn: ${metadata.previousTurn}`);
        }
        
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: updateData
        });
      } else {
        console.log('⚠️ Phase change revert: Previous phase not stored in metadata, cannot auto-revert');
      }
      break;
      
    case 'stratagem':
      // Restore CP spent on stratagem
      if (metadata.cpCost && metadata.usedBy) {
        const cpField = metadata.usedBy === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            [cpField]: session[cpField] + metadata.cpCost
          }
        });
      }
      break;
      
    case 'vp':
      // Restore VP - handle both metadata.points (old format) and metadata.vp (new format)
      const vpAmount = metadata.vp || metadata.points;
      if (vpAmount && metadata.player) {
        const vpField = metadata.player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            [vpField]: Math.max(0, session[vpField] - vpAmount)
          }
        });
        console.log(`✅ Removed ${vpAmount} VP from ${metadata.player}`);
        
        // If this was secondary VP, also update secondary progress
        if (metadata.secondary) {
          const secondaryName = metadata.secondary;
          const progressField = metadata.player === 'attacker' ? 'attackerSecondaryProgress' : 'defenderSecondaryProgress';
          
          // Refetch session to get latest progress data (important for cascade mode)
          const latestSession = await prisma.gameSession.findUnique({
            where: { id: sessionId }
          });
          
          if (!latestSession) {
            console.error('Session not found when reverting secondary VP');
            break;
          }
          
          const currentProgress = latestSession[progressField] ? JSON.parse(latestSession[progressField] as string) : {};
          
          if (currentProgress[secondaryName]) {
            // Subtract VP
            currentProgress[secondaryName].vp = Math.max(0, (currentProgress[secondaryName].vp || 0) - vpAmount);
            
            // Remove the scoring entry from history that matches this event
            if (currentProgress[secondaryName].scoringHistory && Array.isArray(currentProgress[secondaryName].scoringHistory)) {
              const eventTimestamp = new Date(event.timestamp).getTime();
              const originalLength = currentProgress[secondaryName].scoringHistory.length;
              currentProgress[secondaryName].scoringHistory = currentProgress[secondaryName].scoringHistory.filter((entry: any) => {
                const entryTimestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
                // Remove entries within 1 second of the event (to handle slight timestamp differences)
                return Math.abs(entryTimestamp - eventTimestamp) > 1000;
              });
              console.log(`Removed ${originalLength - currentProgress[secondaryName].scoringHistory.length} scoring history entry(ies) for ${secondaryName}`);
            }
            
            await prisma.gameSession.update({
              where: { id: sessionId },
              data: {
                [progressField]: JSON.stringify(currentProgress)
              }
            });
            console.log(`✅ Reversed ${vpAmount} VP from ${secondaryName} secondary progress (now ${currentProgress[secondaryName].vp} VP)`);
          } else {
            console.warn(`⚠️ Secondary ${secondaryName} not found in progress when reverting`);
          }
        }
      }
      break;
      
    case 'cp':
      // Reverse CP change
      if (metadata.change && metadata.player) {
        const cpField = metadata.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            [cpField]: Math.max(0, session[cpField] - metadata.change)
          }
        });
      }
      break;
      
    case 'objective':
      // Revert objective control - restore previous state
      if (metadata.objectiveNumber !== undefined && metadata.previouslyControlledBy !== undefined) {
        await prisma.objectiveMarker.update({
          where: {
            gameSessionId_objectiveNumber: {
              gameSessionId: sessionId,
              objectiveNumber: metadata.objectiveNumber
            }
          },
          data: {
            controlledBy: metadata.previouslyControlledBy,
            lastUpdated: new Date()
          }
        });
        console.log(`✅ Restored Objective ${metadata.objectiveNumber} control to ${metadata.previouslyControlledBy}`);
      }
      break;
      
    case 'deepstrike':
      // Deepstrike is just a log event, no state to reverse
      console.log('ℹ️ Deepstrike event - no state to reverse');
      break;
      
    case 'custom':
      // Handle custom events - manual CP/VP changes from UI, unit health, etc.
      if (metadata.player) {
        // Manual CP change
        if (metadata.newCP !== undefined && metadata.change !== undefined) {
          const cpField = metadata.player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
          const oldCP = metadata.newCP - metadata.change;
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              [cpField]: Math.max(0, oldCP)
            }
          });
          console.log(`✅ Restored ${metadata.player} CP from ${metadata.newCP} back to ${oldCP}`);
        }
        // Manual VP change
        else if (metadata.newVP !== undefined && metadata.change !== undefined) {
          const vpField = metadata.player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
          const oldVP = metadata.newVP - metadata.change;
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              [vpField]: Math.max(0, oldVP)
            }
          });
          console.log(`✅ Restored ${metadata.player} VP from ${metadata.newVP} back to ${oldVP}`);
        }
        // Secondary objectives being set
        else if (metadata.secondaries !== undefined) {
          const field = metadata.player === 'attacker' ? 'attackerSecondaries' : 'defenderSecondaries';
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              [field]: JSON.stringify([])
            }
          });
          console.log(`✅ Cleared ${metadata.player} secondaries`);
        }
      } 
      // Unit health changes
      else if (metadata.unitName && metadata.owner && metadata.modelsLost !== undefined) {
        const unit = await prisma.unitInstance.findFirst({
          where: {
            gameSessionId: sessionId,
            unitName: metadata.unitName,
            owner: metadata.owner
          }
        });
        
        if (unit) {
          const restoredModels = unit.currentModels + (metadata.modelsKilled || 0);
          await prisma.unitInstance.update({
            where: { id: unit.id },
            data: {
              currentModels: Math.min(restoredModels, unit.startingModels),
              isDestroyed: false
            }
          });
          console.log(`✅ Restored ${metadata.modelsKilled || 0} models to ${metadata.unitName}`);
        }
      }
      // Unit status changes
      else if (metadata.unitName && metadata.owner && (metadata.isBattleShocked !== undefined || metadata.activeEffects !== undefined)) {
        const unit = await prisma.unitInstance.findFirst({
          where: {
            gameSessionId: sessionId,
            unitName: metadata.unitName,
            owner: metadata.owner
          }
        });
        
        if (unit) {
          let currentEffects = unit.activeEffects ? JSON.parse(unit.activeEffects) : [];
          if (metadata.addedEffects) {
            currentEffects = currentEffects.filter((e: string) => !metadata.addedEffects.includes(e));
          }
          if (metadata.removedEffects) {
            currentEffects = [...new Set([...currentEffects, ...metadata.removedEffects])];
          }
          await prisma.unitInstance.update({
            where: { id: unit.id },
            data: {
              activeEffects: JSON.stringify(currentEffects),
              isBattleShocked: metadata.isBattleShocked !== undefined ? !metadata.isBattleShocked : unit.isBattleShocked
            }
          });
          console.log(`✅ Restored ${metadata.unitName} status effects`);
        }
      }
      break;
  }
}

// PATCH - Mark event as reverted (soft delete)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { id: sessionId, eventId } = await params;
    const body = await request.json();
    
    const { revertReason, cascadeMode } = body; // 'single' or 'cascade'
    
    // Find the event
    const event = await prisma.timelineEvent.findUnique({
      where: { id: eventId }
    });
    
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    if (event.isReverted) {
      return NextResponse.json({ error: 'Event already reverted' }, { status: 400 });
    }
    
    // Find subsequent events if cascade mode
    let eventsToRevert = [event];
    let affectedEventDetails = [{
      id: event.id,
      eventType: event.eventType,
      description: event.description,
      timestamp: event.timestamp
    }];
    
    if (cascadeMode === 'cascade') {
      const subsequentEvents = await prisma.timelineEvent.findMany({
        where: {
          gameSessionId: sessionId,
          timestamp: { gt: event.timestamp },
          isReverted: false
        },
        orderBy: { timestamp: 'asc' }
      });
      eventsToRevert = [event, ...subsequentEvents];
      affectedEventDetails = eventsToRevert.map(e => ({
        id: e.id,
        eventType: e.eventType,
        description: e.description,
        timestamp: e.timestamp
      }));
    }
    
    // Mark all events as reverted
    await prisma.timelineEvent.updateMany({
      where: {
        id: { in: eventsToRevert.map(e => e.id) }
      },
      data: {
        isReverted: true,
        revertedAt: new Date(),
        revertedBy: user.id,
        revertReason: revertReason || 'User correction',
        cascadedFrom: cascadeMode === 'cascade' ? eventId : null
      }
    });
    
    // Reverse state changes for each event
    for (const evt of eventsToRevert) {
      await reverseEventStateChanges(evt, sessionId);
    }
    
    // Create revert action record
    const revertAction = await prisma.revertAction.create({
      data: {
        gameSessionId: sessionId,
        targetEventId: eventId,
        targetEventType: event.eventType,
        targetDescription: event.description,
        revertType: cascadeMode || 'single',
        triggerMethod: 'manual',
        reason: revertReason,
        affectedEventIds: JSON.stringify(eventsToRevert.map(e => e.id)),
        stateBefore: null, // Could add state snapshot
        stateAfter: null
      }
    });
    
    // Create timeline event for the revert action
    await prisma.timelineEvent.create({
      data: {
        gameSessionId: sessionId,
        eventType: 'custom',
        description: `⎌ REVERTED (Manual): ${event.description}${cascadeMode === 'cascade' ? ` and ${eventsToRevert.length - 1} subsequent events` : ''}`,
        metadata: JSON.stringify({
          isRevertAction: true,
          targetEventId: eventId,
          revertActionId: revertAction.id,
          cascadeMode,
          affectedEvents: affectedEventDetails
        })
      }
    });
    
    // Invalidate caches
    invalidateCachePattern(`/api/sessions/${sessionId}`);
    invalidateCachePattern(`/api/sessions/${sessionId}/events`);
    
    return NextResponse.json({
      success: true,
      revertedCount: eventsToRevert.length,
      revertActionId: revertAction.id
    });
    
  } catch (error: any) {
    console.error('Error reverting event:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to revert event' }, { status: 500 });
  }
}

