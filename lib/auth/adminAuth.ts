import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export interface AdminUser extends User {
  isAdmin: boolean
  dbUser: {
    id: string
    email: string
    name: string | null
    isAdmin: boolean
  }
}

/**
 * @deprecated API key auth disabled for production security
 * Keeping for reference if needed in secure environment (e.g., internal network)
 */
async function _checkAdminApiKey(): Promise<boolean> {
  // API key authentication has been disabled for production security
  // All admin access now requires session-based authentication via the UI
  return false;
}

/**
 * Requires user to be authenticated AND have admin privileges
 * Throws error if not authenticated or not admin
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Unauthorized: Not authenticated')
  }
  
  // Check admin status in database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true
    }
  })
  
  if (!dbUser) {
    throw new Error('Unauthorized: User not found in database')
  }
  
  if (!dbUser.isAdmin) {
    throw new Error('Forbidden: Admin access required')
  }
  
  return {
    ...user,
    isAdmin: true,
    dbUser
  }
}

/**
 * Check if user is admin without throwing
 * Returns null if not authenticated or not admin
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    return await requireAdmin()
  } catch {
    return null
  }
}

/**
 * Wrapper for API routes that require admin access
 * Returns appropriate error responses for auth failures
 * 
 * Uses session-based auth only (browser/UI access)
 * API key auth has been disabled for production security
 */
export async function withAdminAuth<T>(
  handler: (admin: AdminUser) => Promise<T>
): Promise<T | NextResponse> {
  // Session-based auth only - API key auth disabled for production security
  try {
    const admin = await requireAdmin()
    return await handler(admin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed'
    
    if (message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (message.includes('Admin access required') || message.includes('User not found')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }
    
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Grant admin access to a user (for seeding/setup)
 */
export async function grantAdminAccess(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: true }
  })
}

/**
 * Revoke admin access from a user
 */
export async function revokeAdminAccess(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: false }
  })
}

