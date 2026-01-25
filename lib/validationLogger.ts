/**
 * Validation Event Logger
 * Logs validation warnings and overrides to the database for analytics
 */

import { prisma } from './prisma';
import { ToolExecutionResult } from './types';

/**
 * Log a validation event to the database
 */
export async function logValidationEvent(
  sessionId: string,
  toolResult: ToolExecutionResult,
  currentPhase: string,
  battleRound: number
): Promise<void> {
  if (!toolResult.validation) return;

  try {
    await prisma.validationEvent.create({
      data: {
        gameSessionId: sessionId,
        toolName: toolResult.toolName,
        severity: toolResult.validation.severity,
        message: toolResult.validation.message,
        rule: toolResult.validation.rule || null,
        suggestion: toolResult.validation.suggestion || null,
        wasOverridden: false,
        overriddenAt: null,
        battleRound,
        phase: currentPhase,
        toolArgs: JSON.stringify(toolResult.data || {}),
        toolResult: JSON.stringify({
          success: toolResult.success,
          message: toolResult.message,
        }),
      },
    });
  } catch (error) {
    console.error('Failed to log validation event:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Mark a validation event as overridden
 */
export async function markValidationOverridden(
  sessionId: string,
  validationId: string
): Promise<void> {
  try {
    await prisma.validationEvent.update({
      where: { id: validationId },
      data: {
        wasOverridden: true,
        overriddenAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to mark validation as overridden:', error);
  }
}

/**
 * Get validation statistics for a session
 */
export async function getValidationStats(sessionId: string) {
  try {
    const events = await prisma.validationEvent.findMany({
      where: { gameSessionId: sessionId },
    });

    return {
      total: events.length,
      bySeverity: {
        info: events.filter((e) => e.severity === 'info').length,
        warning: events.filter((e) => e.severity === 'warning').length,
        error: events.filter((e) => e.severity === 'error').length,
        critical: events.filter((e) => e.severity === 'critical').length,
      },
      overridden: events.filter((e) => e.wasOverridden).length,
      byRule: events.reduce((acc, e) => {
        if (e.rule) {
          acc[e.rule] = (acc[e.rule] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    };
  } catch (error) {
    console.error('Failed to get validation stats:', error);
    return null;
  }
}




