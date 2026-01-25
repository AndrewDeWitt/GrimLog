'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import { DossierHero, DossierSamplePreview } from '@/components/dossier';
import { useAuth } from '@/lib/auth/AuthContext';
import AuthModal from '@/components/AuthModal';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Redirect logged-in users to the public gallery
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dossier/gallery');
    }
  }, [authLoading, user, router]);
  
  // Show loading while checking auth
  if (authLoading) {
    return (
      <>
        <GrimlogFrame />
        <div className="min-h-screen flex items-center justify-center bg-grimlog-black">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4 text-grimlog-orange">◎</div>
            <p className="text-grimlog-green font-mono">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
        <GrimlogFrame />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-grimlog-black/95 backdrop-blur-sm border-b border-grimlog-steel/50">
        <div className="container mx-auto px-4 flex items-center justify-between py-2">
          <Link href="/" className="text-grimlog-orange font-bold tracking-wider text-lg uppercase">
            Grimlog
          </Link>
          
          <div className="flex items-center gap-4">
            {!user ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase tracking-wider text-xs transition-all"
              >
                Sign In
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-grimlog-light-steel text-xs font-mono hidden sm:inline">{user.email}</span>
                <span className="text-grimlog-green text-xs font-mono">Redirecting...</span>
              </div>
            )}
          </div>
          </div>
        </header>

      <main className="bg-grimlog-black">
        {/* Hero Section */}
        <DossierHero 
          onAnalyzeClick={() => setShowAuthModal(true)}
          onPreviewClick={() => {
            document.getElementById('sample-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          isAuthenticated={!!user}
        />

        {/* Sample Preview Section */}
        <div id="sample-preview">
          <DossierSamplePreview 
            onGenerateClick={() => setShowAuthModal(true)} 
            ctaLabel="Sign Up Free"
            ctaVariant="green"
          />
        </div>



        {/* Footer */}
        <footer className="py-6 bg-grimlog-black border-t border-grimlog-steel/30">
          <div className="container mx-auto px-4 text-center">
            <p className="text-grimlog-light-steel/30 text-xs font-mono mt-2">
              Not affiliated with Games Workshop. Warhammer 40,000 is a trademark of Games Workshop Ltd.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
