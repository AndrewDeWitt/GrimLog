/**
 * Admin Users API Endpoint
 * 
 * GET /api/admin/users - List all users with credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          isAdmin: true,
          dossierCredits: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return NextResponse.json({
        users,
        count: users.length
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  });
}
