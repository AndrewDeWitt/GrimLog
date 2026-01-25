'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      // Try fetching admin endpoint to verify access
      const res = await fetch('/api/admin/factions');
      
      if (res.status === 401) {
        setError('Please sign in to access the admin panel');
        setLoading(false);
        return;
      }
      
      if (res.status === 403) {
        setError('You do not have admin access');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError('Failed to verify admin access');
        setLoading(false);
        return;
      }

      // Get user info
      const userRes = await fetch('/api/users');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Admin access check failed:', err);
      setError('Failed to connect to server');
      setLoading(false);
    }
  };

  const navItems = [
    { href: '/admin/factions', label: 'Factions', icon: '⚔️' },
    { href: '/admin/datasheets', label: 'Datasheets', icon: '📋' },
    { href: '/admin/icons', label: 'Icons', icon: '🎨' },
    { href: '/admin/competitive-context', label: 'Competitive Context', icon: '🎯' },
  ];

  const isActive = (href: string) => pathname?.startsWith(href);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 border border-red-500/30 rounded-lg p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link 
            href="/"
            className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <Link href="/admin/factions" className="block">
            <h1 className="text-xl font-bold text-amber-500">Grimlog Admin</h1>
            <p className="text-xs text-slate-500">Data Management</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-amber-600/20 text-amber-500 border border-amber-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-800">
          {user && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{user.name || 'Admin'}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <Link
            href="/"
            className="mt-3 block text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

