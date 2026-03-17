'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { ai, forex, market } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import type { HistoryRecord } from '../types';

const PRICE_SYMBOLS = [
  'EUR/USD','GBP/USD','USD/JPY','AUD/USD','XAU/USD',
  'USD/CAD','USD/CHF','NZD/USD','EUR/GBP','EUR/JPY','GBP/JPY','XAG/USD',
];
const TIMEFRAMES = ['1h','4h','1d','15min'];
const PROVIDERS  = ['auto','groq','openai','gemini','openrouter','claude'];

function getPriceDecimals(symbol: string): number {
  if (['USD/JPY','EUR/JPY','GBP/JPY'].includes(symbol)) return 3;
  if (['XAU/USD','XAG/USD'].includes(symbol)) return 2;
  return 5;
}
function fmtP(n: number | null | undefined, sym: string) {
  return n == null ? '—' : n.toFixed(getPriceDecimals(sym));
}

interface LiveQuote { current_price?: number; currentPrice?: number; change_pct?: number; changePercent?: number }
interface NewsArticle { title: string; link?: string; sentiment?: string; source?: string }
type PredResult = {
  direction?: string; confidence?: number; entry_price?: number;
  stop_loss?: number; take_profit_1?: number; reasoning?: string;
};
const DIR_STYLES: Record<string, string> = {
  BUY:     'text-[#22c55e] bg-[#14532d]/60 border-[#22c55e]/40',
  SELL:    'text-[#ef4444] bg-[#7f1d1d]/60 border-[#ef4444]/40',
  HOLD:    'text-[#eab308] bg-[#713f12]/60 border-[#eab308]/40',
  NEUTRAL: 'text-[#eab308] bg-[#713f12]/60 border-[#eab308]/40',
};

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [statsLoading, setStatsLoading] = useState(true);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [buyCount, setBuyCount]   = useState(0);
  const [sellCount, setSellCount] = useState(0);
  const [topSymbol, setTopSymbol] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});

  const [pSymbol,   setPSymbol]   = useState('EUR/USD');
  const [pTf,       setPTf]       = useState('1h');
  const [pProvider, setPProvider] = useState('auto');
  const [predLoading, setPredLoading] = useState(false);
  const [predResult,  setPredResult]  = useState<PredResult | null>(null);
  const [predError,   setPredError]   = useState('');

  const [records,     setRecords]     = useState<HistoryRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const [news,        setNews]        = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await ai.getHistory(undefined, 100, 0);
      const preds: HistoryRecord[] = data.predictions ?? [];
      setTotalPredictions(data.count ?? preds.length);
      const buys  = preds.filter(p => p.direction?.toUpperCase() === 'BUY').length;
      const sells = preds.filter(p => p.direction?.toUpperCase() === 'SELL').length;
      setBuyCount(buys); setSellCount(sells);
      const freq: Record<string, number> = {};
      preds.forEach(p => { freq[p.symbol] = (freq[p.symbol] || 0) + 1; });
      const top = Object.entries(freq).sort((a,b) => b[1]-a[1])[0];
      setTopSymbol(top ? top[0] : null);
    } catch { /* non-critical */ } finally { setStatsLoading(false); }
  }, []);

  const fetchQuote = useCallback(async (sym: string) => {
    try {
      const data: LiveQuote = await forex.getLivePrice(sym);
      const price = data?.currentPrice ?? data?.current_price;
      const chg   = data?.changePercent ?? data?.change_pct;
      if (price) setQuotes(prev => ({ ...prev, [sym]: { current_price: price, change_pct: chg } }));
    } catch { /* non-critical */ }
  }, []);

  const fetchAllQuotes = useCallback(async () => {
    await Promise.allSettled(PRICE_SYMBOLS.map(sym => fetchQuote(sym)));
  }, [fetchQuote]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const data = await ai.getHistory(undefined, 10, 0);
      setRecords(data.predictions ?? []);
    } catch { /* non-critical */ } finally { setHistLoading(false); }
  }, []);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const data = await market.getNews('EUR/USD');
      setNews((data?.articles ?? []).slice(0, 5));
    } catch { /* non-critical */ } finally { setNewsLoading(false); }
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    loadStats(); loadHistory(); loadNews(); fetchAllQuotes();
  }, [mounted, isAuthenticated, loadStats, loadHistory, loadNews, fetchAllQuotes]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    const id = setInterval(fetchAllQuotes, 30_000);
    return () => clearInterval(id);
  }, [mounted, isAuthenticated, fetchAllQuotes]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    const id = setInterval(loadNews, 5 * 60_000);
    return () => clearInterval(id);
  }, [mounted, isAuthenticated, loadNews]);

  async function handlePredict() {
    setPredLoading(true); setPredError(''); setPredResult(null);
    try {
      const data = await ai.predict(pSymbol, pTf, pProvider === 'auto' ? undefined : pProvider);
      setPredResult(data.prediction ?? data);
      loadStats(); loadHistory();
    } catch (err: unknown) {
      setPredError(err instanceof Error ? err.message : 'Prediction failed');
    } finally { setPredLoading(false); }
  }

  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    let pos = 0;
    const id = setInterval(() => {
      pos += 1;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
    }, 30);
    return () => clearInterval(id);
  }, [quotes]);

  const winRate = totalPredictions > 0 ? Math.round((buyCount / totalPredictions) * 100) : 0;

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 space-y-6">

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Predictions', value: statsLoading ? '…' : totalPredictions.toString(), icon: '📊', sub: 'All time' },
              { label: 'BUY Rate', value: statsLoading ? '…' : `${winRate}%`, icon: '📈', sub: `${buyCount} BUY / ${sellCount} SELL` },
              { label: 'Tracked Pairs', value: '12', icon: '🌍', sub: 'Live prices' },
              { label: 'Top Symbol', value: statsLoading ? '…' : (topSymbol ?? '—'), icon: '🏆', sub: 'Most predicted' },
            ].map((s) => (
              <div key={s.label} className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#64748b] font-medium">{s.label}</span>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-[#475569] mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Live ticker */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#334155]">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Live Prices</span>
              <span className="ml-auto text-[10px] text-[#475569]">Auto-refresh 30s</span>
            </div>
            <div
              ref={tickerRef}
              className="flex items-center gap-6 px-4 py-3 overflow-x-auto whitespace-nowrap select-none"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              {PRICE_SYMBOLS.map((sym) => {
                const q = quotes[sym];
                const chg = q?.change_pct ?? 0;
                const up  = chg >= 0;
                return (
                  <div key={sym} className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-white">{sym}</span>
                    <span className="font-mono text-sm text-white">{q ? fmtP(q.current_price, sym) : '…'}</span>
                    {q && (
                      <span className={clsx('text-xs font-medium', up ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
                        {up ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%
                      </span>
                    )}
                    <span className="text-[#334155] text-xs">|</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">

              {/* Quick prediction */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Prediction
                </h2>
                <div className="flex flex-wrap gap-3 mb-4">
                  <select value={pSymbol} onChange={e => setPSymbol(e.target.value)}
                    className="px-3 py-2 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg">
                    {PRICE_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={pTf} onChange={e => setPTf(e.target.value)}
                    className="px-3 py-2 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg">
                    {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={pProvider} onChange={e => setPProvider(e.target.value)}
                    className="px-3 py-2 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-lg">
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={handlePredict} disabled={predLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                    {predLoading && (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    {predLoading ? 'Running AI…' : 'Generate Prediction'}
                  </button>
                </div>

                {predError && (
                  <div className="px-4 py-3 bg-[#7f1d1d]/60 border border-[#ef4444]/40 rounded-lg text-sm text-[#fca5a5] mb-3">{predError}</div>
                )}
                {predResult && (() => {
                  const dir = predResult.direction?.toUpperCase() ?? 'HOLD';
                  return (
                    <div className={clsx('rounded-xl border p-4', DIR_STYLES[dir] ?? DIR_STYLES['HOLD'])}>
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-lg font-black">{dir}</span>
                        <span className="text-sm font-semibold opacity-80">{pSymbol} · {pTf}</span>
                        <span className="ml-auto text-sm font-bold">{predResult.confidence ?? 0}% confidence</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        {[
                          ['Entry', fmtP(predResult.entry_price, pSymbol), 'text-blue-300'],
                          ['Stop Loss', fmtP(predResult.stop_loss, pSymbol), 'text-red-400'],
                          ['Take Profit', fmtP(predResult.take_profit_1, pSymbol), 'text-green-400'],
                        ].map(([lbl, val, cls]) => (
                          <div key={lbl} className="bg-black/20 rounded-lg p-2">
                            <p className="text-[#94a3b8] mb-0.5">{lbl}</p>
                            <p className={clsx('font-mono font-semibold', cls)}>{val}</p>
                          </div>
                        ))}
                      </div>
                      {predResult.reasoning && <p className="mt-3 text-xs opacity-70 line-clamp-2">{predResult.reasoning}</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Recent predictions table */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
                  <h2 className="text-base font-bold text-white">Recent Predictions</h2>
                  <button onClick={() => router.push('/history')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#334155]">
                        {['Symbol','TF','Signal','Conf','Entry','Time'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histLoading ? Array.from({length:4}).map((_,i) => (
                        <tr key={i} className="border-b border-[#334155]">
                          {Array.from({length:6}).map((__,j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 bg-[#334155] rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      )) : records.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-[#475569] text-sm">No predictions yet. Use the widget above.</td></tr>
                      ) : records.map(r => {
                        const dir = r.direction?.toUpperCase() ?? 'HOLD';
                        return (
                          <tr key={r.id} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                            <td className="px-4 py-3 font-semibold text-white">{r.symbol}</td>
                            <td className="px-4 py-3 text-[#94a3b8]">{r.timeframe}</td>
                            <td className="px-4 py-3">
                              <span className={clsx('px-2 py-0.5 rounded text-xs font-bold border', DIR_STYLES[dir] ?? DIR_STYLES['HOLD'])}>{dir}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-white">{r.confidence}%</td>
                            <td className="px-4 py-3 font-mono text-blue-300 text-xs">{fmtP(r.entry_price, r.symbol)}</td>
                            <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* News sidebar */}
            <div className="space-y-4">
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#334155]">
                  <h2 className="text-sm font-bold text-white">📰 Market News</h2>
                  <span className="text-[10px] text-[#475569]">5 min refresh</span>
                </div>
                <div className="divide-y divide-[#334155]">
                  {newsLoading ? Array.from({length:4}).map((_,i) => (
                    <div key={i} className="p-4 space-y-2 animate-pulse">
                      <div className="h-3 bg-[#334155] rounded w-3/4" />
                      <div className="h-3 bg-[#334155] rounded w-1/2" />
                    </div>
                  )) : news.length === 0 ? (
                    <div className="p-4 text-sm text-[#475569] text-center">No news available</div>
                  ) : news.map((n, i) => {
                    const sent = (n.sentiment ?? '').toUpperCase();
                    const sc = sent === 'POSITIVE' ? 'text-green-400' : sent === 'NEGATIVE' ? 'text-red-400' : 'text-[#94a3b8]';
                    return (
                      <div key={i} className="p-4 hover:bg-[#0f172a] transition-colors">
                        <p className="text-sm text-white leading-snug mb-1 line-clamp-2">{n.title}</p>
                        <div className="flex items-center gap-2">
                          {n.sentiment && <span className={clsx('text-[10px] font-semibold', sc)}>{n.sentiment}</span>}
                          {n.source && <span className="text-[10px] text-[#475569]">{n.source}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Quick Links</h3>
                {[
                  { href: '/signals', label: '📡 Live Signals', sub: 'All 12 pairs' },
                  { href: '/platforms', label: '📊 Trading View', sub: 'Charts & analysis' },
                  { href: '/analyze', label: '🔍 Image Analysis', sub: 'Upload chart' },
                  { href: '/history', label: '📜 History', sub: 'All predictions' },
                ].map(l => (
                  <button key={l.href} onClick={() => router.push(l.href)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg hover:border-blue-600 transition-colors text-left">
                    <div>
                      <p className="text-sm text-white">{l.label}</p>
                      <p className="text-[10px] text-[#475569]">{l.sub}</p>
                    </div>
                    <svg className="w-4 h-4 text-[#334155]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-[#334155] text-center pb-2">
            ⚠️ For educational purposes only. Not financial advice.
          </p>

          {/* Ko-fi support banner */}
          <div className="flex justify-center pb-4">
            <a
              href="https://ko-fi.com/dipeshkarki"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, rgba(255,94,91,0.18), rgba(255,94,91,0.10))',
                border: '1px solid rgba(255,94,91,0.35)',
                color: '#ff5e5b',
                textDecoration: 'none',
              }}
            >
              ☕ Support ForexAI Terminal on Ko-fi
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
