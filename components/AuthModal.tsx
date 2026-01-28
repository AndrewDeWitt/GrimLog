'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { signIn } = useAuth()

  if (!isOpen) return null

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      await signIn()
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]" onClick={onClose} />
      
      {/* Bottom Sheet */}
      <div 
        className="relative w-full max-w-md mx-auto bg-grimlog-slate-light border-t-2 border-grimlog-steel rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel rounded-t-2xl">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="text-center p-6 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <span>⚙️</span> SIGN IN
          </h2>
          <p className="text-sm text-gray-600">
            Sign in to access Tactical Brief
          </p>
          
          {/* Close button */}
          {!loading && (
            <button
              onClick={onClose}
              className="absolute top-12 right-4 text-gray-500 hover:text-gray-900 hover:bg-gray-200 w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 bg-grimlog-slate-light">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Free Tokens Banner */}
          <div className="mb-6 p-4 bg-grimlog-green/10 border border-grimlog-green/30 rounded-lg text-center">
            <div className="text-grimlog-green font-bold text-lg mb-1">🎁 3 Free Tokens</div>
            <p className="text-grimlog-steel text-sm">
              Sign in with Google to get 3 free tokens for tactical briefs!
            </p>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 px-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-300 hover:border-grimlog-orange text-lg"
          >
            {loading ? (
              <>
                <span className="animate-spin">⚙</span>
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {/* Info */}
          <p className="mt-4 text-center text-xs text-gray-500">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  )
}
