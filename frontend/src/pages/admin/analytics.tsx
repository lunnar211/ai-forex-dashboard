'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { admin } from '../../services/api';
import type { MarketInterestRow, ToolUsageRow } from '../../types';

// Dynamic import to avoid SSR issues with recharts
const BarChart     = dynamic(() => import('recharts').then(m => m.BarChart),     { ssr: false });
const Bar          = dynamic(() => import('recharts').then(m => m.Bar),          { ssr: false });
const XAxis        = dynamic(() => import('recharts').then(m => m.XAxis),        { ssr: false });
const YAxis        = dynamic(() => import('recharts').then(m => m.YAxis),        { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip      = dynamic(() => import('recharts').then(m => m.Tooltip),      { ssr: false });
const PieChart     = dynamic(() => import('recharts').then(m => m.PieChart),     { ssr: false });
const Pie          = dynamic(() => import('recharts').then(m => m.Pie),          { ssr: false });
const Cell         = dynamic(() => import('recharts').then(m => m.Cell),         { ssr: false });
const Legend       = dynamic(() => import('recharts').then(m => m.Legend),       { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

const COLORS = ['#3b82f6','#22c55e','#ef4444','#eab308','#8b5cf6','#f97316','#06b6d4','#ec4899'];

export default function AdminAnalytics() {
  const router   = useRouter();
  const [token,   setToken]   = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [stats,   setStats]   = useState<{ totalUsers?: number; totalPredictions?: number; activeUsersLast24h?: number } | null>(null);
  const [marketData, setMarketData] = useState<MarketInterestRow[]>([]);
  const [toolData,   setToolData]   = useState<ToolUsageRow[]>([]);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('token');
    if (!t) { router.replace('/admin'); return; }
    setToken(t);
  }, [router]);

  const fetchData = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const [statsData, analyticsData] = await Promise.allSettled([
        admin.getStats(t),
        admin.getAnalytics(t),
      ]);
      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (analyticsData.status === 'fulfilled') {
        setMarketData(analyticsData.value.marketInterest ?? []);
        setToolData(analyticsData.value.toolUsage ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) fetchData(token); }, [token, fetchData]);

  // Build pie chart data from market interest (BUY vs categories)
  const topSymbols = marketData.slice(0, 8).map(r => ({
    symbol: r.symbol ?? 'Unknown',
    views: Number(r.views ?? 0),
  }));

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="flex items-center gap-4 px-6 py-4 bg-[#1e293b] border-b border-[#334155]">
        <button onClick={() => router.back()} className="text-[#94a3b8] hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Analytics</h1>
        <button onClick={() => token && fetchData(token)} className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500">
          Refresh
        </button>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Users',       value: stats?.totalUsers ?? '—' },
            { label: 'Total Predictions', value: stats?.totalPredictions ?? '—' },
            { label: 'Active (24h)',       value: stats?.activeUsersLast24h ?? '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
              <p className="text-xs text-[#64748b] mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-white">{loading ? '…' : s.value}</p>
            </div>
          ))}
        </div>

        {/* Market interest bar chart */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
          <h2 className="text-base font-bold text-white mb-4">Symbol Interest (views)</h2>
          {topSymbols.length === 0 ? (
            <p className="text-sm text-[#475569] text-center py-8">No data yet</p>
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSymbols} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="symbol" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                    cursor={{ fill: '#334155' }}
                  />
                  <Bar dataKey="views" fill="#3b82f6" radius={[4,4,0,0]}>
                    {topSymbols.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tool usage pie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-4">Tool Usage</h2>
            {toolData.length === 0 ? (
              <p className="text-sm text-[#475569] text-center py-8">No data yet</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={toolData.map(t => ({ name: t.tool ?? 'Unknown', value: Number(t.uses ?? 0) }))}
                      cx="50%" cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0)*100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {toolData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-4">Top Tools by Unique Users</h2>
            {toolData.length === 0 ? (
              <p className="text-sm text-[#475569] text-center py-8">No data yet</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={toolData.slice(0,8).map(t => ({ tool: t.tool ?? '?', users: Number(t.unique_users ?? 0) }))}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis dataKey="tool" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={60} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} />
                    <Bar dataKey="users" fill="#22c55e" radius={[0,4,4,0]}>
                      {toolData.slice(0,8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
