'use client'

import { useAuth as useAuthContext } from './AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-export the main hook
export { useAuth } from './AuthContext'

// Hook for pages that require authentication
export function useRequireAuth() {
  const { user, loading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  return { user, loading }
}

