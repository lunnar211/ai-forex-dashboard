'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';

const REFRESH_INTERVAL = 60 * 60; // 60 minutes in seconds

interface LiveSignal {
  symbol: string;
  direction?: string;
  confidence?: number;
  entry_price?: number;
  stop_loss?: number;
  take_profit_1?: number;
  take_profit_2?: number;
  error?: string;
}

function getPriceDecimals(symbol: string): number {
  if (['USD/JPY','EUR/JPY','GBP/JPY'].includes(symbol)) return 3;
  if (['XAU/USD','XAG/USD'].includes(symbol)) return 2;
  return 5;
}
function fmtP(n: number | null | undefined, sym: string) {
  return n == null ? '—' : n.toFixed(getPriceDecimals(sym));
}

const DIR_BORDER: Record<string, string> = {
  BUY:     'border-[#22c55e]',
  SELL:    'border-[#ef4444]',
  HOLD:    'border-[#eab308]',
  NEUTRAL: 'border-[#eab308]',
};
const DIR_BG: Record<string, string> = {
  BUY:     'bg-[#14532d]/40',
  SELL:    'bg-[#7f1d1d]/40',
  HOLD:    'bg-[#713f12]/40',
  NEUTRAL: 'bg-[#713f12]/40',
};
const DIR_TEXT: Record<string, string> = {
  BUY:     'text-[#22c55e]',
  SELL:    'text-[#ef4444]',
  HOLD:    'text-[#eab308]',
  NEUTRAL: 'text-[#eab308]',
};

export default function Signals() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted,  setMounted]  = useState(false);
  const [signals,  setSignals]  = useState<LiveSignal[]>([]);
  const [genAt,    setGenAt]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter / sort
  const [filter, setFilter] = useState<'ALL'|'BUY'|'SELL'|'NEUTRAL'>('ALL');
  const [sortBy, setSortBy] = useState<'confidence'|'symbol'|'updated'>('confidence');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  const fetchSignals = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // Try the new /signals/live endpoint; fall back to /ai/signals
      let data;
      try {
        data = await ai.getLiveSignals();
      } catch {
        data = await ai.getSignals();
      }
      setSignals(data.signals ?? []);
      setGenAt(data.generatedAt ?? null);
      setFromCache(data.fromCache ?? false);
      setCountdown(REFRESH_INTERVAL);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load signals');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    fetchSignals();
  }, [mounted, isAuthenticated, fetchSignals]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchSignals(); return REFRESH_INTERVAL; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [fetchSignals]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  // Apply filter
  const filtered = signals.filter(s => {
    const dir = s.direction?.toUpperCase() ?? 'NEUTRAL';
    if (filter === 'ALL') return true;
    if (filter === 'NEUTRAL') return dir === 'NEUTRAL' || dir === 'HOLD';
    return dir === filter;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'confidence') return (b.confidence ?? 0) - (a.confidence ?? 0);
    if (sortBy === 'symbol')     return a.symbol.localeCompare(b.symbol);
    return 0;
  });

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">Live Signals</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
                {fromCache && <span className="text-[10px] text-[#475569] font-medium">cached</span>}
              </div>
              {genAt && <p className="text-xs text-[#475569]">Generated {new Date(genAt).toLocaleTimeString()}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-[#475569] px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg">
                🔄 Refresh in {mins}:{secs.toString().padStart(2, '0')}
              </div>
              <button onClick={fetchSignals} disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                {loading && (
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                Refresh All
              </button>
            </div>
          </div>

          {/* Filter + Sort bar */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center gap-1 bg-[#1e293b] border border-[#334155] rounded-lg p-0.5">
              {(['ALL','BUY','SELL','NEUTRAL'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                    filter === f
                      ? f === 'ALL' ? 'bg-blue-600 text-white'
                        : f === 'BUY' ? 'bg-[#22c55e] text-white'
                        : f === 'SELL' ? 'bg-[#ef4444] text-white'
                        : 'bg-[#eab308] text-black'
                      : 'text-[#94a3b8] hover:text-white'
                  )}>{f}</button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'confidence'|'symbol'|'updated')}
              className="px-3 py-1.5 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-xs rounded-lg focus:outline-none">
              <option value="confidence">Sort: Confidence</option>
              <option value="symbol">Sort: Symbol</option>
              <option value="updated">Sort: Updated</option>
            </select>
            <span className="text-xs text-[#475569]">
              Showing {sorted.length} of {signals.length} signals
            </span>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">{error}</div>
          )}

          {loading && signals.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({length:12}).map((_,i) => (
                <div key={i} className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 animate-pulse">
                  <div className="h-5 bg-[#334155] rounded w-24 mb-3" />
                  <div className="h-8 bg-[#334155] rounded w-full mb-3" />
                  <div className="h-2 bg-[#334155] rounded w-3/4 mb-2" />
                  <div className="h-2 bg-[#334155] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#475569]">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>No signals match the current filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sorted.map((s, i) => {
                const dir = s.direction?.toUpperCase() ?? 'NEUTRAL';
                const border = DIR_BORDER[dir] ?? DIR_BORDER['NEUTRAL'];
                const bg     = DIR_BG[dir]     ?? DIR_BG['NEUTRAL'];
                const txt    = DIR_TEXT[dir]   ?? DIR_TEXT['NEUTRAL'];
                const conf   = s.confidence ?? 0;
                return (
                  <div key={`${s.symbol}-${i}`}
                    className={clsx('rounded-xl border-2 p-4', border, bg)}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-black text-white">{s.symbol}</span>
                      <span className={clsx('px-2 py-0.5 rounded text-xs font-black border', border, txt)}>{dir}</span>
                    </div>

                    {s.error ? (
                      <p className="text-xs text-red-400 mb-2">{s.error}</p>
                    ) : (
                      <>
                        {/* Confidence bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                            <span>Confidence</span>
                            <span className={clsx('font-bold', txt)}>{conf}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full transition-all', dir === 'BUY' ? 'bg-[#22c55e]' : dir === 'SELL' ? 'bg-[#ef4444]' : 'bg-[#eab308]')}
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                        </div>

                        {/* Prices */}
                        <div className="grid grid-cols-3 gap-1.5 text-xs">
                          <div className="bg-black/20 rounded-lg p-2">
                            <p className="text-[#94a3b8] mb-0.5">Entry</p>
                            <p className="font-mono text-blue-300 text-[11px]">{fmtP(s.entry_price, s.symbol)}</p>
                          </div>
                          <div className="bg-black/20 rounded-lg p-2">
                            <p className="text-[#94a3b8] mb-0.5">SL</p>
                            <p className="font-mono text-red-400 text-[11px]">{fmtP(s.stop_loss, s.symbol)}</p>
                          </div>
                          <div className="bg-black/20 rounded-lg p-2">
                            <p className="text-[#94a3b8] mb-0.5">TP</p>
                            <p className="font-mono text-green-400 text-[11px]">{fmtP(s.take_profit_1, s.symbol)}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-8 text-xs text-[#475569] text-center">
            ⚠️ AI signals are for educational purposes only. Not financial advice.
          </p>
        </main>
      </div>
    </div>
  );
}
