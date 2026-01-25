'use client';

import { usePathname } from 'next/navigation';
import GlobalHeader from './GlobalHeader';

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show global header on the home page (battle screen) as it has its own specialized header
  const isHomePage = pathname === '/';
  
  return (
    <div className="flex flex-col min-h-screen">
      {!isHomePage && <GlobalHeader />}
      <div className={`flex-1 ${!isHomePage ? '' : ''}`}>
        {children}
      </div>
    </div>
  );
}

