'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { admin } from '../../services/api';

interface SecurityLoginRecord {
  id: number;
  action: string;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
  email: string;
  name: string | null;
  is_blocked: boolean;
}

interface BlockedUser {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  last_active: string | null;
}

interface TopIP {
  ip_address: string;
  requests: string;
  unique_users: string;
  last_seen: string;
}

interface SecurityData {
  recentLogins: SecurityLoginRecord[];
  blockedUsers: BlockedUser[];
  topIPs: TopIP[];
}

export default function AdminSecurity() {
  const router   = useRouter();
  const [token,   setToken]   = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [data,    setData]    = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState<'logins'|'blocked'|'ips'>('logins');

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('token');
    if (!t) { router.replace('/admin'); return; }
    setToken(t);
  }, [router]);

  const fetchSecurity = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const d = await admin.getSecurityEvents(t);
      setData(d);
    } catch { /* non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) fetchSecurity(token); }, [token, fetchSecurity]);

  async function unblockUser(id: number) {
    if (!token) return;
    try { await admin.unblockUser(token, id); fetchSecurity(token); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="flex items-center gap-4 px-6 py-4 bg-[#1e293b] border-b border-[#334155]">
        <button onClick={() => router.back()} className="text-[#94a3b8] hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Security</h1>
        <div className="ml-auto flex gap-2">
          {(['logins','blocked','ips'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize',
                tab === t ? 'bg-blue-600 text-white' : 'bg-[#334155] text-[#94a3b8] hover:text-white')}>
              {t === 'logins' ? 'Recent Logins' : t === 'blocked' ? 'Blocked Users' : 'Top IPs'}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6">
        {loading && !data ? (
          <div className="space-y-3">
            {Array.from({length:5}).map((_,i) => (
              <div key={i} className="h-12 bg-[#1e293b] rounded-xl border border-[#334155] animate-pulse" />
            ))}
          </div>
        ) : tab === 'logins' ? (
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#334155]">
              <h2 className="text-sm font-bold text-white">Recent Login Attempts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {['Time','User','Action','IP','Country','Browser'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentLogins ?? []).map(r => (
                    <tr key={r.id} className={clsx('border-b border-[#334155] hover:bg-[#0f172a] transition-colors', r.is_blocked && 'bg-red-900/10')}>
                      <td className="px-3 py-2.5 text-[#475569] text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-white text-xs">{r.email}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('px-1.5 py-0.5 text-xs rounded',
                          r.action === 'login_success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                          {r.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#475569] text-xs font-mono">{r.ip_address ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[#94a3b8] text-xs">{r.country ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[#475569] text-xs">{r.browser ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'blocked' ? (
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#334155]">
              <h2 className="text-sm font-bold text-white">Blocked Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {['User','Email','Registered','Last Active','Action'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.blockedUsers ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[#475569]">No blocked users</td></tr>
                  ) : (data?.blockedUsers ?? []).map(u => (
                    <tr key={u.id} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                      <td className="px-3 py-2.5 text-white">{u.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[#94a3b8]">{u.email}</td>
                      <td className="px-3 py-2.5 text-[#475569] text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 text-[#475569] text-xs">{u.last_active ? new Date(u.last_active).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => unblockUser(u.id)}
                          className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded hover:bg-green-600/40 transition-colors">
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#334155]">
              <h2 className="text-sm font-bold text-white">Top IP Addresses</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {['IP Address','Requests','Unique Users','Last Seen'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.topIPs ?? []).length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[#475569]">No IP data</td></tr>
                  ) : (data?.topIPs ?? []).map((ip, i) => (
                    <tr key={i} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-white">{ip.ip_address}</td>
                      <td className="px-3 py-2.5 text-[#94a3b8]">{ip.requests}</td>
                      <td className="px-3 py-2.5 text-[#94a3b8]">{ip.unique_users}</td>
                      <td className="px-3 py-2.5 text-[#475569] text-xs">{ip.last_seen ? new Date(ip.last_seen).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
