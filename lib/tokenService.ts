/**
 * Token Service
 *
 * Core service for managing the token economy system.
 * Handles token balance checks, deductions, refunds, and grants.
 * All operations create ledger entries for audit trail.
 */

import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

export type TransactionType = 'GRANT' | 'PURCHASE' | 'USAGE' | 'REFUND';

export interface TokenCheckResult {
  allowed: boolean;
  remainingBalance: number;
  requiredTokens: number;
  isAdmin: boolean;
  error?: string;
}

export interface TokenDeductResult {
  success: boolean;
  remainingBalance: number;
  tokensDeducted: number;
  ledgerEntryId?: string;
  error?: string;
}

export interface TokenGrantResult {
  success: boolean;
  newBalance: number;
  tokensGranted: number;
  ledgerEntryId?: string;
  error?: string;
}

export interface FeatureCostInfo {
  featureKey: string;
  tokenCost: number;
  displayName: string;
  description: string | null;
  isActive: boolean;
}

export interface TokenLedgerEntry {
  id: string;
  amount: number;
  transactionType: string;
  featureKey: string | null;
  description: string | null;
  createdAt: Date;
  featureCost?: {
    displayName: string;
  } | null;
}

export interface UserTokenInfo {
  balance: number;
  accessStatus: string;
  isAdmin: boolean;
  recentTransactions: TokenLedgerEntry[];
}

// ============================================
// Feature Cost Operations
// ============================================

/**
 * Get the current cost for a feature from the database.
 * Returns null if the feature doesn't exist or is inactive.
 */
export async function getFeatureCost(featureKey: string): Promise<FeatureCostInfo | null> {
  try {
    const cost = await prisma.featureCost.findUnique({
      where: { featureKey },
    });

    if (!cost || !cost.isActive) {
      return null;
    }

    return {
      featureKey: cost.featureKey,
      tokenCost: cost.tokenCost,
      displayName: cost.displayName,
      description: cost.description,
      isActive: cost.isActive,
    };
  } catch (error) {
    console.error('Error getting feature cost:', error);
    return null;
  }
}

/**
 * Get all active feature costs.
 */
export async function getAllFeatureCosts(includeInactive = false): Promise<FeatureCostInfo[]> {
  try {
    const costs = await prisma.featureCost.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { tokenCost: 'asc' },
    });

    return costs.map((cost) => ({
      featureKey: cost.featureKey,
      tokenCost: cost.tokenCost,
      displayName: cost.displayName,
      description: cost.description,
      isActive: cost.isActive,
    }));
  } catch (error) {
    console.error('Error getting all feature costs:', error);
    return [];
  }
}

// ============================================
// Token Balance Operations
// ============================================

/**
 * Get a user's current token balance and info.
 */
export async function getUserTokenInfo(userId: string, transactionLimit = 10): Promise<UserTokenInfo | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tokenBalance: true,
        accessStatus: true,
        isAdmin: true,
        tokenLedger: {
          take: transactionLimit,
          orderBy: { createdAt: 'desc' },
          include: {
            featureCost: {
              select: { displayName: true },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      balance: user.tokenBalance,
      accessStatus: user.accessStatus,
      isAdmin: user.isAdmin,
      recentTransactions: user.tokenLedger,
    };
  } catch (error) {
    console.error('Error getting user token info:', error);
    return null;
  }
}

/**
 * Get just the token balance for a user.
 * Admins get Infinity.
 */
export async function getUserTokenBalance(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true, isAdmin: true },
    });

    if (!user) {
      return 0;
    }

    return user.isAdmin ? Infinity : user.tokenBalance;
  } catch (error) {
    console.error('Error getting user token balance:', error);
    return 0;
  }
}

// ============================================
// Token Check & Deduct Operations
// ============================================

/**
 * Check if a user can afford a feature (without deducting).
 * Use this for pre-validation before expensive operations.
 */
export async function checkTokensAvailable(
  userId: string,
  featureKey: string
): Promise<TokenCheckResult> {
  try {
    const [user, featureCost] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { tokenBalance: true, isAdmin: true },
      }),
      getFeatureCost(featureKey),
    ]);

    if (!user) {
      return {
        allowed: false,
        remainingBalance: 0,
        requiredTokens: 0,
        isAdmin: false,
        error: 'User not found',
      };
    }

    if (!featureCost) {
      return {
        allowed: false,
        remainingBalance: user.tokenBalance,
        requiredTokens: 0,
        isAdmin: user.isAdmin,
        error: `Feature '${featureKey}' not found or inactive`,
      };
    }

    // Admins bypass token checks
    if (user.isAdmin) {
      return {
        allowed: true,
        remainingBalance: Infinity,
        requiredTokens: featureCost.tokenCost,
        isAdmin: true,
      };
    }

    const canAfford = user.tokenBalance >= featureCost.tokenCost;

    return {
      allowed: canAfford,
      remainingBalance: user.tokenBalance,
      requiredTokens: featureCost.tokenCost,
      isAdmin: false,
      error: canAfford ? undefined : 'Insufficient tokens',
    };
  } catch (error) {
    console.error('Error checking tokens available:', error);
    return {
      allowed: false,
      remainingBalance: 0,
      requiredTokens: 0,
      isAdmin: false,
      error: 'Failed to check tokens',
    };
  }
}

/**
 * Check if user can afford a feature AND deduct the tokens atomically.
 * Creates a USAGE ledger entry.
 *
 * IMPORTANT: Uses conditional update to prevent race conditions.
 * If the operation fails later, call refundTokens() to restore the balance.
 */
export async function checkAndDeductTokens(
  userId: string,
  featureKey: string,
  description?: string
): Promise<TokenDeductResult> {
  try {
    const [user, featureCost] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { tokenBalance: true, isAdmin: true },
      }),
      getFeatureCost(featureKey),
    ]);

    if (!user) {
      return {
        success: false,
        remainingBalance: 0,
        tokensDeducted: 0,
        error: 'User not found',
      };
    }

    if (!featureCost) {
      return {
        success: false,
        remainingBalance: user.tokenBalance,
        tokensDeducted: 0,
        error: `Feature '${featureKey}' not found or inactive`,
      };
    }

    // Admins bypass token deduction
    if (user.isAdmin) {
      // Still create a ledger entry for tracking, but don't deduct
      const ledgerEntry = await prisma.tokenLedger.create({
        data: {
          userId,
          amount: 0, // No actual deduction for admins
          transactionType: 'USAGE',
          featureKey,
          description: description || `Admin usage: ${featureCost.displayName}`,
        },
      });

      return {
        success: true,
        remainingBalance: Infinity,
        tokensDeducted: 0,
        ledgerEntryId: ledgerEntry.id,
      };
    }

    // Early check for obviously insufficient balance (optimization)
    if (user.tokenBalance < featureCost.tokenCost) {
      return {
        success: false,
        remainingBalance: user.tokenBalance,
        tokensDeducted: 0,
        error: 'Insufficient tokens',
      };
    }

    // Use interactive transaction with conditional update to prevent race conditions
    // The updateMany with WHERE clause ensures atomic check-and-deduct
    const result = await prisma.$transaction(async (tx) => {
      // Conditional update: only deduct if balance is sufficient
      // This prevents the TOCTOU race condition
      const updateResult = await tx.user.updateMany({
        where: {
          id: userId,
          tokenBalance: { gte: featureCost.tokenCost }, // Only update if balance >= cost
        },
        data: {
          tokenBalance: { decrement: featureCost.tokenCost },
        },
      });

      // If no rows updated, insufficient balance (race condition caught)
      if (updateResult.count === 0) {
        // Get current balance for error response
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { tokenBalance: true },
        });
        return {
          success: false,
          remainingBalance: currentUser?.tokenBalance ?? 0,
          tokensDeducted: 0,
          error: 'Insufficient tokens',
        };
      }

      // Get updated balance and create ledger entry
      const [updatedUser, ledgerEntry] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { tokenBalance: true },
        }),
        tx.tokenLedger.create({
          data: {
            userId,
            amount: -featureCost.tokenCost,
            transactionType: 'USAGE',
            featureKey,
            description: description || featureCost.displayName,
          },
        }),
      ]);

      return {
        success: true,
        remainingBalance: updatedUser?.tokenBalance ?? 0,
        tokensDeducted: featureCost.tokenCost,
        ledgerEntryId: ledgerEntry.id,
      };
    });

    return result;
  } catch (error) {
    console.error('Error deducting tokens:', error);
    return {
      success: false,
      remainingBalance: 0,
      tokensDeducted: 0,
      error: 'Failed to deduct tokens',
    };
  }
}

// ============================================
// Refund Operations
// ============================================

/**
 * Refund tokens for a failed operation.
 * Creates a REFUND ledger entry.
 */
export async function refundTokens(
  userId: string,
  featureKey: string,
  reason: string
): Promise<TokenGrantResult> {
  try {
    const featureCost = await getFeatureCost(featureKey);

    if (!featureCost) {
      return {
        success: false,
        newBalance: 0,
        tokensGranted: 0,
        error: `Feature '${featureKey}' not found`,
      };
    }

    // Check if user is admin (admins weren't charged, so no refund needed)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, tokenBalance: true },
    });

    if (!user) {
      return {
        success: false,
        newBalance: 0,
        tokensGranted: 0,
        error: 'User not found',
      };
    }

    if (user.isAdmin) {
      // Admins weren't charged, just log the refund attempt
      return {
        success: true,
        newBalance: Infinity,
        tokensGranted: 0,
      };
    }

    // Atomically add tokens and create ledger entry
    const [updatedUser, ledgerEntry] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tokenBalance: { increment: featureCost.tokenCost } },
        select: { tokenBalance: true },
      }),
      prisma.tokenLedger.create({
        data: {
          userId,
          amount: featureCost.tokenCost,
          transactionType: 'REFUND',
          featureKey,
          description: `Refund: ${reason}`,
        },
      }),
    ]);

    return {
      success: true,
      newBalance: updatedUser.tokenBalance,
      tokensGranted: featureCost.tokenCost,
      ledgerEntryId: ledgerEntry.id,
    };
  } catch (error) {
    console.error('Error refunding tokens:', error);
    return {
      success: false,
      newBalance: 0,
      tokensGranted: 0,
      error: 'Failed to refund tokens',
    };
  }
}

// ============================================
// Grant Operations (Admin/Purchase)
// ============================================

/**
 * Grant tokens to a user (for admin grants or purchases).
 * Creates a GRANT or PURCHASE ledger entry.
 */
export async function grantTokens(
  userId: string,
  amount: number,
  transactionType: 'GRANT' | 'PURCHASE',
  description: string,
  metadata?: Record<string, unknown>
): Promise<TokenGrantResult> {
  try {
    if (amount <= 0) {
      return {
        success: false,
        newBalance: 0,
        tokensGranted: 0,
        error: 'Amount must be positive',
      };
    }

    // Atomically add tokens and create ledger entry
    const [updatedUser, ledgerEntry] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tokenBalance: { increment: amount } },
        select: { tokenBalance: true },
      }),
      prisma.tokenLedger.create({
        data: {
          userId,
          amount,
          transactionType,
          description,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      }),
    ]);

    return {
      success: true,
      newBalance: updatedUser.tokenBalance,
      tokensGranted: amount,
      ledgerEntryId: ledgerEntry.id,
    };
  } catch (error) {
    console.error('Error granting tokens:', error);
    return {
      success: false,
      newBalance: 0,
      tokensGranted: 0,
      error: 'Failed to grant tokens',
    };
  }
}

/**
 * Set a user's token balance to a specific value (admin function).
 * Creates a GRANT ledger entry with the difference.
 */
export async function setUserTokenBalance(
  userId: string,
  newBalance: number,
  reason: string
): Promise<TokenGrantResult> {
  try {
    if (newBalance < 0) {
      return {
        success: false,
        newBalance: 0,
        tokensGranted: 0,
        error: 'Balance cannot be negative',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    });

    if (!user) {
      return {
        success: false,
        newBalance: 0,
        tokensGranted: 0,
        error: 'User not found',
      };
    }

    const difference = newBalance - user.tokenBalance;

    // Atomically update balance and create ledger entry
    const [updatedUser, ledgerEntry] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tokenBalance: newBalance },
        select: { tokenBalance: true },
      }),
      prisma.tokenLedger.create({
        data: {
          userId,
          amount: difference,
          transactionType: 'GRANT',
          description: `Admin adjustment: ${reason}`,
        },
      }),
    ]);

    return {
      success: true,
      newBalance: updatedUser.tokenBalance,
      tokensGranted: difference,
      ledgerEntryId: ledgerEntry.id,
    };
  } catch (error) {
    console.error('Error setting user token balance:', error);
    return {
      success: false,
      newBalance: 0,
      tokensGranted: 0,
      error: 'Failed to set token balance',
    };
  }
}

// ============================================
// Transaction History
// ============================================

/**
 * Get a user's transaction history.
 */
export async function getTokenHistory(
  userId: string,
  limit = 50,
  offset = 0
): Promise<TokenLedgerEntry[]> {
  try {
    const entries = await prisma.tokenLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        featureCost: {
          select: { displayName: true },
        },
      },
    });

    return entries;
  } catch (error) {
    console.error('Error getting token history:', error);
    return [];
  }
}

/**
 * Get global transaction history (admin function).
 */
export async function getGlobalTokenHistory(
  limit = 100,
  offset = 0,
  filters?: {
    transactionType?: TransactionType;
    featureKey?: string;
    userId?: string;
  }
): Promise<TokenLedgerEntry[]> {
  try {
    const where: Record<string, unknown> = {};

    if (filters?.transactionType) {
      where.transactionType = filters.transactionType;
    }
    if (filters?.featureKey) {
      where.featureKey = filters.featureKey;
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }

    const entries = await prisma.tokenLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        featureCost: {
          select: { displayName: true },
        },
      },
    });

    return entries;
  } catch (error) {
    console.error('Error getting global token history:', error);
    return [];
  }
}

// ============================================
// Admin: Feature Cost Management
// ============================================

/**
 * Update the token cost for a feature (admin function).
 */
export async function updateFeatureCost(
  featureKey: string,
  updates: {
    tokenCost?: number;
    displayName?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<FeatureCostInfo | null> {
  try {
    const updated = await prisma.featureCost.update({
      where: { featureKey },
      data: updates,
    });

    return {
      featureKey: updated.featureKey,
      tokenCost: updated.tokenCost,
      displayName: updated.displayName,
      description: updated.description,
      isActive: updated.isActive,
    };
  } catch (error) {
    console.error('Error updating feature cost:', error);
    return null;
  }
}

// ============================================
// Backwards Compatibility
// ============================================

/**
 * Check if user is admin (for backwards compatibility).
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    return user?.isAdmin ?? false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
