/**
 * Dossier Credits System
 * 
 * Manages the credit-based system for dossier generation.
 * - New users get 2 free generations
 * - Admin users bypass credit checks
 * - Credits are atomically deducted when generating a dossier
 */

import { prisma } from '@/lib/prisma';

export interface CreditCheckResult {
  allowed: boolean;
  remainingCredits: number;
  isAdmin: boolean;
  error?: string;
}

/**
 * Check if a user has credits available and deduct one if so.
 * Admins bypass the credit check entirely.
 * 
 * @param userId - The user's ID (from Supabase auth)
 * @returns Result indicating if the operation is allowed and remaining credits
 */
export async function checkAndDeductCredit(userId: string): Promise<CreditCheckResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dossierCredits: true, isAdmin: true }
    });

    if (!user) {
      return { 
        allowed: false, 
        remainingCredits: 0, 
        isAdmin: false,
        error: 'User not found'
      };
    }

    // Admin bypasses credit check
    if (user.isAdmin) {
      return { 
        allowed: true, 
        remainingCredits: Infinity, 
        isAdmin: true 
      };
    }

    // Check if user has credits
    if (user.dossierCredits <= 0) {
      return { 
        allowed: false, 
        remainingCredits: 0, 
        isAdmin: false 
      };
    }

    // Atomically deduct credit
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { dossierCredits: { decrement: 1 } },
      select: { dossierCredits: true }
    });

    return { 
      allowed: true, 
      remainingCredits: updatedUser.dossierCredits,
      isAdmin: false 
    };
  } catch (error) {
    console.error('Error checking/deducting credit:', error);
    return { 
      allowed: false, 
      remainingCredits: 0, 
      isAdmin: false,
      error: 'Failed to check credits'
    };
  }
}

/**
 * Check if a user can generate a dossier (has credits) WITHOUT deducting.
 * Use this for pre-validation before async processing.
 *
 * @param userId - The user's ID
 * @returns Result indicating if the user has credits available
 */
export async function checkCreditsAvailable(userId: string): Promise<CreditCheckResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dossierCredits: true, isAdmin: true }
    });

    if (!user) {
      return {
        allowed: false,
        remainingCredits: 0,
        isAdmin: false,
        error: 'User not found'
      };
    }

    // Admin bypasses credit check
    if (user.isAdmin) {
      return {
        allowed: true,
        remainingCredits: Infinity,
        isAdmin: true
      };
    }

    // Check if user has credits (without deducting)
    if (user.dossierCredits <= 0) {
      return {
        allowed: false,
        remainingCredits: 0,
        isAdmin: false
      };
    }

    return {
      allowed: true,
      remainingCredits: user.dossierCredits,
      isAdmin: false
    };
  } catch (error) {
    console.error('Error checking credits:', error);
    return {
      allowed: false,
      remainingCredits: 0,
      isAdmin: false,
      error: 'Failed to check credits'
    };
  }
}

/**
 * Get the current credit balance for a user.
 * Admins get Infinity.
 *
 * @param userId - The user's ID
 * @returns Number of remaining credits (Infinity for admins)
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dossierCredits: true, isAdmin: true }
    });

    if (!user) {
      return 0;
    }

    return user.isAdmin ? Infinity : user.dossierCredits;
  } catch (error) {
    console.error('Error getting user credits:', error);
    return 0;
  }
}

/**
 * Check if a user is an admin.
 * 
 * @param userId - The user's ID
 * @returns Boolean indicating admin status
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    });

    return user?.isAdmin ?? false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Add credits to a user's account (admin function).
 * 
 * @param userId - The target user's ID
 * @param amount - Number of credits to add (can be negative to remove)
 * @returns Updated credit balance
 */
export async function adjustUserCredits(userId: string, amount: number): Promise<number> {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { dossierCredits: { increment: amount } },
      select: { dossierCredits: true }
    });

    return updatedUser.dossierCredits;
  } catch (error) {
    console.error('Error adjusting user credits:', error);
    throw new Error('Failed to adjust credits');
  }
}

/**
 * Set a user's credits to a specific value (admin function).
 * 
 * @param userId - The target user's ID
 * @param credits - New credit balance
 * @returns Updated credit balance
 */
export async function setUserCredits(userId: string, credits: number): Promise<number> {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { dossierCredits: credits },
      select: { dossierCredits: true }
    });

    return updatedUser.dossierCredits;
  } catch (error) {
    console.error('Error setting user credits:', error);
    throw new Error('Failed to set credits');
  }
}

