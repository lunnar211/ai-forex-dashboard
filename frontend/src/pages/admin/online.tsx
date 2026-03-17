'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { admin } from '../../services/api';
import type { OnlineUser } from '../../types';

export default function AdminOnline() {
  const router   = useRouter();
  const [token,   setToken]   = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [users,   setUsers]   = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('token');
    if (!t) { router.replace('/admin'); return; }
    setToken(t);
  }, [router]);

  const fetchOnline = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const data = await admin.getOnlineUsers(t);
      setUsers(data.onlineUsers ?? []);
    } catch { /* non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) fetchOnline(token); }, [token, fetchOnline]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => fetchOnline(token), 10_000);
    return () => clearInterval(id);
  }, [token, fetchOnline]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="flex items-center gap-4 px-6 py-4 bg-[#1e293b] border-b border-[#334155]">
        <button onClick={() => router.back()} className="text-[#94a3b8] hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Online Users</h1>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {users.length} online
        </span>
        <span className="ml-2 text-xs text-[#475569]">Auto-refresh 10s</span>
      </header>

      <main className="p-6">
        {loading && users.length === 0 ? (
          <div className="space-y-3">
            {Array.from({length:4}).map((_,i) => (
              <div key={i} className="h-16 bg-[#1e293b] rounded-xl border border-[#334155] animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#475569]">
            <p className="text-lg">No users online right now</p>
            <p className="text-sm mt-1">Online presence updates every 30 seconds</p>
          </div>
        ) : (
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {['User','Email','Last Ping','Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const ago = Math.floor((Date.now() - new Date(u.last_active ?? '').getTime()) / 1000);
                    return (
                      <tr key={u.id} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{u.name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#94a3b8]">{u.email}</td>
                        <td className="px-4 py-3 text-[#475569] text-xs">{u.last_active ? new Date(u.last_active).toLocaleTimeString() : '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            {ago < 60 ? `${ago}s ago` : `${Math.floor(ago/60)}m ago`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
