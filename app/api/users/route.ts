import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/apiAuth'

/**
 * POST /api/users - Sync authenticated user to database
 * 
 * This endpoint is called after OAuth login to sync user profile to our database.
 * It requires authentication and only allows users to create/update their own profile.
 */
export async function POST(request: Request) {
  try {
    // Require authentication - this ensures only authenticated users can sync
    const authUser = await requireAuth();
    
    const body = await request.json()
    const { id, email, name, avatar } = body

    // Validate required fields
    if (!id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // CRITICAL: Only allow users to create/update their OWN profile
    // This prevents attackers from creating users with arbitrary IDs
    if (id !== authUser.id) {
      return NextResponse.json(
        { error: 'User ID does not match authenticated user' },
        { status: 403 }
      )
    }

    // Create user in database
    const user = await prisma.user.upsert({
      where: { id },
      create: {
        id,
        email,
        name: name || email.split('@')[0],
        avatar,
      },
      update: {
        email,
        name: name || email.split('@')[0],
        avatar,
      },
    })

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Error creating user:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await requireAuth()
    
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(dbUser)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 401 }
    )
  }
}
