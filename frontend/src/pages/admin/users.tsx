'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { admin } from '../../services/api';
import type { AdminUser } from '../../types';

export default function AdminUsers() {
  const router = useRouter();
  const [token, setToken]     = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('token');
    if (!t) { router.replace('/admin'); return; }
    setToken(t);
  }, [router]);

  const fetchUsers = useCallback(async (t: string) => {
    setLoading(true); setError('');
    try {
      const data = await admin.listUsers(t);
      setUsers(data.users ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (token) fetchUsers(token);
  }, [token, fetchUsers]);

  async function doAction(fn: () => Promise<unknown>, id: number) {
    setActionId(id);
    try { await fn(); fetchUsers(token!); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="flex items-center gap-4 px-6 py-4 bg-[#1e293b] border-b border-[#334155]">
        <button onClick={() => router.back()} className="text-[#94a3b8] hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">User Management</h1>
        <span className="ml-2 px-2 py-0.5 text-xs bg-[#334155] text-[#94a3b8] rounded-full">{users.length} users</span>
        <div className="ml-auto flex items-center gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg w-48 focus:outline-none focus:border-blue-500"
          />
          <button onClick={() => router.push('/admin/dashboard')}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500">
            Dashboard
          </button>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">{error}</div>
        )}

        <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  {['ID','Name','Email','Verified','Admin','Blocked','Restricted','Last Login','Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({length:5}).map((_,i) => (
                    <tr key={i} className="border-b border-[#334155]">
                      {Array.from({length:9}).map((__,j) => (
                        <td key={j} className="px-3 py-3"><div className="h-4 bg-[#334155] rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.map(u => (
                  <tr key={u.id} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                    <td className="px-3 py-3 text-[#475569] text-xs">{u.id}</td>
                    <td className="px-3 py-3 text-white">{u.name ?? '—'}</td>
                    <td className="px-3 py-3 text-[#94a3b8]">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className="text-green-400 text-xs">✓</span>
                    </td>
                    <td className="px-3 py-3">
                      {u.is_admin ? <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">Admin</span> : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {u.is_blocked ? <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Blocked</span> : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {u.is_restricted ? <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Restricted</span> : '—'}
                    </td>
                    <td className="px-3 py-3 text-[#475569] text-xs whitespace-nowrap">
                      {u.last_active ? new Date(u.last_active).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {!u.is_admin && (
                          <>
                            {u.is_blocked ? (
                              <button
                                onClick={() => doAction(() => admin.unblockUser(token!, u.id), u.id)}
                                disabled={actionId === u.id}
                                className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded hover:bg-green-600/40 transition-colors disabled:opacity-40">
                                Unblock
                              </button>
                            ) : (
                              <button
                                onClick={() => doAction(() => admin.blockUser(token!, u.id), u.id)}
                                disabled={actionId === u.id}
                                className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded hover:bg-red-600/40 transition-colors disabled:opacity-40">
                                Block
                              </button>
                            )}
                            {u.is_restricted ? (
                              <button
                                onClick={() => doAction(() => admin.unrestrictUser(token!, u.id), u.id)}
                                disabled={actionId === u.id}
                                className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded hover:bg-blue-600/40 transition-colors disabled:opacity-40">
                                Unrestrict
                              </button>
                            ) : (
                              <button
                                onClick={() => doAction(() => admin.restrictUser(token!, u.id), u.id)}
                                disabled={actionId === u.id}
                                className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded hover:bg-yellow-600/40 transition-colors disabled:opacity-40">
                                Restrict
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm(`Delete user ${u.email}?`)) doAction(() => admin.deleteUser(token!, u.id), u.id); }}
                              disabled={actionId === u.id}
                              className="px-2 py-1 bg-[#334155] text-[#94a3b8] text-xs rounded hover:text-red-400 transition-colors disabled:opacity-40">
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
