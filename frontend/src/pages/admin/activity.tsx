'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

interface ActivityRecord {
  id: number;
  action: string;
  page: string | null;
  symbol: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  created_at: string;
  email: string;
  name: string | null;
}

export default function AdminActivity() {
  const router   = useRouter();
  const [token,   setToken]   = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rows,    setRows]    = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState('');

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('token');
    if (!t) { router.replace('/admin'); return; }
    setToken(t);
  }, [router]);

  const fetchActivity = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/activity?limit=100', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setRows(data.activity ?? []);
    } catch { /* non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (token) fetchActivity(token);
  }, [token, fetchActivity]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => fetchActivity(token), 30_000);
    return () => clearInterval(id);
  }, [token, fetchActivity]);

  const filtered = rows.filter(r =>
    !filter || r.action.includes(filter) || (r.email ?? '').includes(filter) || (r.country ?? '').includes(filter)
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="flex items-center gap-4 px-6 py-4 bg-[#1e293b] border-b border-[#334155]">
        <button onClick={() => router.back()} className="text-[#94a3b8] hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Activity Log</h1>
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
        <span className="text-xs text-[#475569]">Auto-refresh 30s</span>
        <div className="ml-auto flex items-center gap-3">
          <input
            value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter…"
            className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg w-40 focus:outline-none focus:border-blue-500"
          />
          <button onClick={() => token && fetchActivity(token)}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500">
            Refresh
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  {['Time','User','Action','Page','IP','Country','City','Device','Browser'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({length:8}).map((_,i) => (
                    <tr key={i} className="border-b border-[#334155]">
                      {Array.from({length:9}).map((__,j) => (
                        <td key={j} className="px-3 py-3"><div className="h-4 bg-[#334155] rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[#475569]">No activity found</td></tr>
                ) : filtered.slice(0, 200).map(r => (
                  <tr key={r.id} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                    <td className="px-3 py-2.5 text-[#475569] text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-white text-xs">{r.email}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 bg-[#334155] text-[#94a3b8] text-xs rounded">{r.action}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#475569] text-xs">{r.page ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#475569] text-xs font-mono">{r.ip_address ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#94a3b8] text-xs">{r.country ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#475569] text-xs">{r.city ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#475569] text-xs">{r.device_type ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#475569] text-xs">{r.browser ?? '—'}</td>
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
