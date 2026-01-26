'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import { useAuth } from '@/lib/auth/AuthContext';

interface UserData {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  isAdmin: boolean;
  briefCredits: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        router.push('/');
        return;
      }
      
      try {
        const response = await fetch('/api/users/credits');
        if (response.ok) {
          const data = await response.json();
          if (!data.isAdmin) {
            router.push('/brief');
            return;
          }
          setIsAdmin(true);
        }
      } catch (err) {
        router.push('/');
      }
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [authLoading, user, router]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin) return;
      
      setLoading(true);
      try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        setUsers(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin]);

  // Adjust credits
  const handleAdjustCredits = async (userId: string, adjustment: number) => {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment }),
      });

      if (!response.ok) {
        throw new Error('Failed to adjust credits');
      }

      const result = await response.json();
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, briefCredits: result.newCredits } : u
      ));
      
      setSuccessMessage(`Credits updated to ${result.newCredits}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust credits');
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  // Set exact credits
  const handleSetCredits = async (userId: string, credits: number) => {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits }),
      });

      if (!response.ok) {
        throw new Error('Failed to set credits');
      }

      const result = await response.json();
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, briefCredits: result.newCredits } : u
      ));
      
      setEditingUserId(null);
      setCreditInput('');
      setSuccessMessage(`Credits set to ${result.newCredits}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set credits');
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <>
        <GrimlogFrame />
        <div className="min-h-screen flex items-center justify-center bg-grimlog-slate">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⚙</div>
            <p className="text-grimlog-green font-mono">Verifying admin access...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GrimlogFrame />

      <main className="min-h-screen pt-4 pb-4 bg-grimlog-slate">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <header className="py-6 border-b-2 border-grimlog-steel mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-grimlog-orange glow-orange tracking-widest uppercase">
                  👤 USER CREDITS
                </h1>
                <p className="text-grimlog-green text-sm font-mono mt-2">
                  Manage brief generation credits for users
                </p>
              </div>
              <Link
                href="/admin/factions"
                className="px-4 py-2 bg-grimlog-steel hover:bg-grimlog-light-steel text-grimlog-green font-bold tracking-wider border-2 border-grimlog-green transition-all uppercase text-sm"
              >
                ← DATA ADMIN
              </Link>
            </div>
          </header>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-grimlog-red/20 border-2 border-grimlog-red text-grimlog-red">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          {successMessage && (
            <div className="mb-6 p-4 bg-grimlog-green/20 border-2 border-grimlog-green text-grimlog-green">
              <p>{successMessage}</p>
            </div>
          )}

          {/* Users Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">⚙</div>
              <p className="text-grimlog-steel font-mono">Loading users...</p>
            </div>
          ) : (
            <div className="bg-grimlog-black border-2 border-grimlog-steel overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-grimlog-steel bg-grimlog-darkGray">
                    <th className="px-4 py-3 text-left text-grimlog-orange font-bold uppercase tracking-wider text-sm">User</th>
                    <th className="px-4 py-3 text-center text-grimlog-orange font-bold uppercase tracking-wider text-sm">Credits</th>
                    <th className="px-4 py-3 text-center text-grimlog-orange font-bold uppercase tracking-wider text-sm">Status</th>
                    <th className="px-4 py-3 text-center text-grimlog-orange font-bold uppercase tracking-wider text-sm">Joined</th>
                    <th className="px-4 py-3 text-right text-grimlog-orange font-bold uppercase tracking-wider text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-grimlog-steel/50 hover:bg-grimlog-darkGray/50 transition-colors">
                      {/* User Info */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-10 h-10 border border-grimlog-steel" />
                          ) : (
                            <div className="w-10 h-10 bg-grimlog-steel/30 border border-grimlog-steel flex items-center justify-center text-grimlog-orange font-bold">
                              {(u.name || u.email)?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <div className="text-grimlog-green font-mono text-sm">{u.name || 'No Name'}</div>
                            <div className="text-grimlog-steel text-xs">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Credits */}
                      <td className="px-4 py-4 text-center">
                        {editingUserId === u.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={creditInput}
                              onChange={(e) => setCreditInput(e.target.value)}
                              className="w-20 bg-grimlog-darkGray border border-grimlog-steel text-grimlog-green p-1 text-center font-mono text-sm"
                              min="0"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSetCredits(u.id, parseInt(creditInput) || 0)}
                              disabled={actionLoading === u.id}
                              className="px-2 py-1 bg-grimlog-green text-grimlog-black text-xs font-bold uppercase"
                            >
                              Set
                            </button>
                            <button
                              onClick={() => { setEditingUserId(null); setCreditInput(''); }}
                              className="px-2 py-1 bg-grimlog-steel text-grimlog-black text-xs font-bold uppercase"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span 
                            className={`font-mono font-bold text-lg cursor-pointer hover:underline ${
                              u.briefCredits === 0 ? 'text-grimlog-red' : 
                              u.briefCredits > 5 ? 'text-grimlog-green' : 'text-grimlog-amber'
                            }`}
                            onClick={() => {
                              setEditingUserId(u.id);
                              setCreditInput(u.briefCredits.toString());
                            }}
                            title="Click to edit"
                          >
                            {u.isAdmin ? '∞' : u.briefCredits}
                          </span>
                        )}
                      </td>
                      
                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        {u.isAdmin ? (
                          <span className="px-2 py-1 bg-grimlog-red/20 text-grimlog-red text-xs font-bold uppercase border border-grimlog-red/50">
                            ADMIN
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-grimlog-steel/20 text-grimlog-steel text-xs font-bold uppercase border border-grimlog-steel/50">
                            USER
                          </span>
                        )}
                      </td>
                      
                      {/* Joined */}
                      <td className="px-4 py-4 text-center text-grimlog-steel text-xs font-mono">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAdjustCredits(u.id, -1)}
                            disabled={actionLoading === u.id || u.isAdmin || u.briefCredits === 0}
                            className="w-8 h-8 bg-grimlog-red/20 hover:bg-grimlog-red/40 text-grimlog-red border border-grimlog-red/50 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove 1 credit"
                          >
                            −
                          </button>
                          <button
                            onClick={() => handleAdjustCredits(u.id, 1)}
                            disabled={actionLoading === u.id || u.isAdmin}
                            className="w-8 h-8 bg-grimlog-green/20 hover:bg-grimlog-green/40 text-grimlog-green border border-grimlog-green/50 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Add 1 credit"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleAdjustCredits(u.id, 5)}
                            disabled={actionLoading === u.id || u.isAdmin}
                            className="px-3 h-8 bg-grimlog-amber/20 hover:bg-grimlog-amber/40 text-grimlog-amber border border-grimlog-amber/50 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Add 5 credits"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="p-8 text-center text-grimlog-steel font-mono">
                  No users found
                </div>
              )}
            </div>
          )}
          
          {/* Stats */}
          {!loading && users.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-grimlog-black border border-grimlog-steel p-4 text-center">
                <div className="text-3xl font-bold text-grimlog-orange">{users.length}</div>
                <div className="text-grimlog-steel text-xs uppercase tracking-wider">Total Users</div>
              </div>
              <div className="bg-grimlog-black border border-grimlog-steel p-4 text-center">
                <div className="text-3xl font-bold text-grimlog-green">
                  {users.filter(u => u.briefCredits > 0 || u.isAdmin).length}
                </div>
                <div className="text-grimlog-steel text-xs uppercase tracking-wider">With Credits</div>
              </div>
              <div className="bg-grimlog-black border border-grimlog-steel p-4 text-center">
                <div className="text-3xl font-bold text-grimlog-red">
                  {users.filter(u => !u.isAdmin && u.briefCredits === 0).length}
                </div>
                <div className="text-grimlog-steel text-xs uppercase tracking-wider">No Credits</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

