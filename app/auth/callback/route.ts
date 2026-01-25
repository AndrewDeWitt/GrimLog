import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // Create or update user in our database
      try {
        await prisma.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name || user.user_metadata?.full_name || user.email!.split('@')[0],
            avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          },
          update: {
            email: user.email!,
            name: user.user_metadata?.name || user.user_metadata?.full_name,
            avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          },
        })
      } catch (err) {
        console.error('Error creating user in database:', err)
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/`)
}

