import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'

// Global API rate limiter - only created if Vercel KV is configured
const globalRateLimiter = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(120, '1 m'), // 120 requests per minute
      analytics: true,
      prefix: 'ratelimit:globalApi',
    })
  : null;

// Public routes - accessible without authentication
const PUBLIC_ROUTES = ['/', '/auth/callback']

// Routes that require authentication but not admin
const AUTH_ROUTES = ['/dossier']

// Admin-only routes - require isAdmin flag
const ADMIN_ROUTES = ['/sessions', '/armies', '/datasheets', '/calculator', '/admin']

// API routes that are intentionally public (read-only reference data)
const PUBLIC_API_ROUTES = [
  '/api/factions',
  '/api/stratagems',
  '/api/datasheets',
  '/api/missions',
  '/api/competitive/lookup',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response that will be modified
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Check if this is an API route
  const isApiRoute = pathname.startsWith('/api/')
  
  // Check if this is a public API route
  const isPublicApiRoute = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))

  // For API routes, apply global rate limiting then let handlers manage auth
  if (isApiRoute) {
    // Apply global rate limit if Redis is configured
    if (globalRateLimiter) {
      // Use user ID if authenticated, otherwise IP address
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') ?? 'anonymous'
      const identifier = user ? `user:${user.id}` : `ip:${ip}`

      try {
        const { success, remaining, reset } = await globalRateLimiter.limit(identifier)

        if (!success) {
          const retryAfter = Math.ceil((reset - Date.now()) / 1000)
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              message: `Too many requests. Please wait ${retryAfter} seconds.`,
            },
            {
              status: 429,
              headers: {
                'Retry-After': retryAfter.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
              },
            }
          )
        }

        // Add rate limit headers to successful response
        response.headers.set('X-RateLimit-Remaining', remaining.toString())
      } catch (error) {
        // On Redis error, allow request through (fail open)
        console.error('Global rate limit check failed:', error)
      }
    }

    return response
  }

  // Check if this is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route)

  // Check if this is an auth-required route (dossier)
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))

  // Check if this is an admin-only route
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route))

  // Public routes - allow everyone
  if (isPublicRoute) {
    return response
  }

  // For auth routes and admin routes, check authentication
  if (isAuthRoute || isAdminRoute) {
    if (!user) {
      // Not authenticated - redirect to home (which has login)
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // For admin routes, also check admin status
  if (isAdminRoute && user) {
    // We can't easily check isAdmin in middleware without a database call
    // So we'll rely on the page/API level to enforce admin status
    // The middleware just ensures the user is authenticated
    // Admin check happens in the components/APIs via checkIsAdmin()
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
