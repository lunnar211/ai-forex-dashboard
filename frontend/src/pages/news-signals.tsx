'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';

const TradingTerminal = dynamic(() => import('../components/TradingTerminal'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentEmoji: string;
  pair: string;
}

interface AIPrediction {
  direction?: string;
  confidence?: number;
  entry_price?: string | number | null;
  stop_loss?: string | number | null;
  take_profit_1?: string | number | null;
  take_profit_2?: string | number | null;
  reason?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtPrice(n: string | number | null | undefined, symbol: string): string {
  if (n == null || n === '' || n === 'null' || n === 'undefined') return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!num || isNaN(num)) return '—';
  const decimals = ['USD/JPY', 'EUR/JPY', 'GBP/JPY'].includes(symbol) ? 3
    : ['XAU/USD', 'XAG/USD'].includes(symbol) ? 2
    : 5;
  return num.toFixed(decimals);
}

function calcRR(
  entry: string | number | null | undefined,
  sl: string | number | null | undefined,
  tp: string | number | null | undefined,
): string {
  const e = parseFloat(String(entry || ''));
  const s = parseFloat(String(sl || ''));
  const t = parseFloat(String(tp || ''));
  if (!e || !s || !t || isNaN(e) || isNaN(s) || isNaN(t)) return '—';
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (risk === 0) return '—';
  return `1:${(reward / risk).toFixed(1)}`;
}

const SENTIMENT_STYLES: Record<string, { badge: string; ticker: string }> = {
  BULLISH: {
    badge: 'bg-green-500/20 text-green-400 border border-green-500/40',
    ticker: 'text-green-400',
  },
  BEARISH: {
    badge: 'bg-red-500/20 text-red-400 border border-red-500/40',
    ticker: 'text-red-400',
  },
  NEUTRAL: {
    badge: 'bg-slate-500/20 text-slate-400 border border-slate-500/40',
    ticker: 'text-slate-400',
  },
};

const DIR_COLOR: Record<string, string> = {
  BUY:  'text-green-400',
  SELL: 'text-red-400',
  HOLD: 'text-yellow-400',
  NEUTRAL: 'text-yellow-400',
};

const DIR_GLOW: Record<string, string> = {
  BUY:  'shadow-green-900/40',
  SELL: 'shadow-red-900/40',
  HOLD: 'shadow-yellow-900/40',
  NEUTRAL: 'shadow-yellow-900/40',
};

const TIMEFRAME_OPTIONS = [
  { label: '15m', value: '15min' },
  { label: '1H',  value: '1h'   },
  { label: '4H',  value: '4h'   },
];

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-72 bg-[#1e293b] border border-[#334155] rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-3 bg-[#334155] rounded w-20" />
        <div className="h-3 bg-[#334155] rounded w-12 ml-auto" />
      </div>
      <div className="h-4 bg-[#334155] rounded w-full mb-1" />
      <div className="h-4 bg-[#334155] rounded w-4/5 mb-3" />
      <div className="h-3 bg-[#334155] rounded w-full mb-1" />
      <div className="h-3 bg-[#334155] rounded w-3/4 mb-3" />
      <div className="flex gap-2">
        <div className="h-5 bg-[#334155] rounded w-16" />
        <div className="h-5 bg-[#334155] rounded w-16" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewsSignals() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // News feed state
  const [articles, setArticles]   = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError,   setNewsError]   = useState('');

  // Selected article + chart + AI state
  const [selected,   setSelected]   = useState<NewsArticle | null>(null);
  const [timeframe,  setTimeframe]  = useState('1h');
  const [aiLoading,  setAiLoading]  = useState(false);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [aiError,    setAiError]    = useState('');
  const [showWhy,    setShowWhy]    = useState(false);

  // Ticker ref for smooth animation restart on data change
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  // ── Fetch news ──────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      const stored = localStorage.getItem('auth-storage');
      const token = stored ? JSON.parse(stored)?.state?.token as string | undefined : undefined;
      const resp = await fetch('/api/news/world-signals', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setArticles(data.articles || []);
    } catch (err: unknown) {
      setNewsError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    fetchNews();
    const id = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, isAuthenticated, fetchNews]);

  // ── AI prediction when article or timeframe changes ─────────────────────────
  const runAiPrediction = useCallback(async (pair: string, tf: string) => {
    setAiLoading(true);
    setAiError('');
    setPrediction(null);
    setShowWhy(false);
    try {
      const data = await ai.predict(pair, tf);
      setPrediction(data.prediction ?? data);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI prediction failed');
    } finally {
      setAiLoading(false);
    }
  }, []);

  function handleSelectArticle(article: NewsArticle) {
    setSelected(article);
    setPrediction(null);
    setAiError('');
    setShowWhy(false);
    runAiPrediction(article.pair, timeframe);
  }

  function handleTimeframeChange(tf: string) {
    setTimeframe(tf);
    if (selected) runAiPrediction(selected.pair, tf);
  }

  if (!mounted || !isAuthenticated) return null;

  const dir = (prediction?.direction || '').toUpperCase();
  const conf = prediction?.confidence ?? 0;
  const rr = prediction
    ? calcRR(prediction.entry_price, prediction.stop_loss, prediction.take_profit_1)
    : '—';

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 flex flex-col gap-6">

          {/* ── Page header ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                News Signals
              </h1>
              <p className="text-xs text-[#475569] mt-0.5">
                Real-time news with AI-powered trading signals
              </p>
            </div>
            <button
              onClick={fetchNews}
              disabled={newsLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              {newsLoading && (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Refresh
            </button>
          </div>

          {/* ── SECTION 1: World News Feed ─────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-widest mb-3 flex items-center gap-2">
              World News Feed
              <span className="text-[10px] font-normal text-[#475569] normal-case tracking-normal">
                Auto-refreshes every 5 min
              </span>
            </h2>

            {newsError && (
              <div className="mb-3 px-4 py-3 bg-[#7f1d1d] border border-red-500/40 rounded-lg text-sm text-red-300">
                {newsError}
              </div>
            )}

            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-[#1e293b] scrollbar-thumb-[#334155]">
              {newsLoading && articles.length === 0
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                : articles.length === 0
                ? (
                  <div className="flex items-center justify-center w-full py-12 text-[#475569]">
                    <p>No news available. Add NEWSAPI_KEY or NEWSDATA_KEY to environment.</p>
                  </div>
                )
                : articles.map((article) => {
                  const sty = SENTIMENT_STYLES[article.sentiment] ?? SENTIMENT_STYLES['NEUTRAL'];
                  const isActive = selected?.id === article.id;
                  return (
                    <div
                      key={article.id}
                      onClick={() => handleSelectArticle(article)}
                      className={clsx(
                        'flex-shrink-0 w-72 rounded-xl border p-4 cursor-pointer transition-all duration-200',
                        isActive
                          ? 'border-blue-500 bg-[#1e3a5f] shadow-lg shadow-blue-900/30'
                          : 'border-[#334155] bg-[#1e293b] hover:border-[#475569] hover:bg-[#243447]'
                      )}
                    >
                      {/* Source + time */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="text-[11px] font-semibold text-[#64748b] truncate">
                          {article.source}
                        </span>
                        <span className="text-[10px] text-[#475569] flex-shrink-0">
                          {timeAgo(article.publishedAt)}
                        </span>
                      </div>

                      {/* Headline */}
                      <p className="text-sm font-bold text-white leading-snug mb-2 line-clamp-2">
                        {article.title}
                      </p>

                      {/* Description */}
                      {article.description && (
                        <p className="text-xs text-[#94a3b8] leading-relaxed mb-3 line-clamp-2">
                          {article.description}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold', sty.badge)}>
                          {article.sentiment}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          {article.pair}
                        </span>
                      </div>

                      {/* CTA */}
                      <button
                        className="w-full py-1.5 text-xs font-semibold rounded-lg bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/40 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleSelectArticle(article); }}
                      >
                        View Signal
                      </button>
                    </div>
                  );
                })
              }
            </div>
          </section>

          {/* ── SECTION 2: Detail panel ────────────────────────────────────── */}
          {selected && (
            <section className="flex flex-col lg:flex-row gap-4">

              {/* LEFT: TradingView chart (55%) */}
              <div className="flex-1 lg:w-[55%] min-h-[420px]">
                <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden h-full flex flex-col">
                  {/* Chart header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#334155]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{selected.pair}</span>
                      <span className="text-[10px] text-[#475569] truncate max-w-[200px]">
                        {selected.title}
                      </span>
                    </div>
                    {/* Timeframe selector */}
                    <div className="flex gap-1 bg-[#0f172a] border border-[#334155] rounded-lg p-0.5">
                      {TIMEFRAME_OPTIONS.map((tf) => (
                        <button
                          key={tf.value}
                          onClick={() => handleTimeframeChange(tf.value)}
                          className={clsx(
                            'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
                            timeframe === tf.value
                              ? 'bg-blue-600 text-white'
                              : 'text-[#94a3b8] hover:text-white'
                          )}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="flex-1" style={{ minHeight: 380 }}>
                    <TradingTerminal symbol={selected.pair} timeframe={timeframe} />
                  </div>
                </div>
              </div>

              {/* RIGHT: AI Signal Panel (45%) */}
              <div className="lg:w-[45%] bg-[#1e293b] border border-[#334155] rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">AI Signal</span>
                  <span className="text-[10px] text-[#475569]">for {selected.pair}</span>
                </div>

                {aiError && (
                  <div className="px-3 py-2 bg-[#7f1d1d] border border-red-500/40 rounded-lg text-xs text-red-300">
                    {aiError}
                  </div>
                )}

                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-[#475569]">
                    <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <p className="text-sm">AI analyzing news impact…</p>
                  </div>
                ) : prediction ? (
                  <>
                    {/* Direction */}
                    <div className={clsx(
                      'flex items-center justify-center py-4 rounded-xl shadow-lg border border-[#334155]',
                      DIR_GLOW[dir] ?? 'shadow-slate-900/30'
                    )}>
                      <span className={clsx('text-4xl font-black', DIR_COLOR[dir] ?? 'text-slate-400')}>
                        {dir}
                      </span>
                    </div>

                    {/* Confidence */}
                    <div>
                      <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                        <span>Confidence</span>
                        <span className={clsx('font-bold', DIR_COLOR[dir] ?? 'text-slate-400')}>{conf}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#334155] rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all duration-700',
                            dir === 'BUY' ? 'bg-green-500' : dir === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'
                          )}
                          style={{ width: `${conf}%` }}
                        />
                      </div>
                    </div>

                    {/* Levels */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: 'Entry',  value: fmtPrice(prediction.entry_price,  selected.pair), color: 'text-blue-300' },
                        { label: 'SL',     value: fmtPrice(prediction.stop_loss,    selected.pair), color: 'text-red-400'  },
                        { label: 'TP1',    value: fmtPrice(prediction.take_profit_1, selected.pair), color: 'text-green-400' },
                        { label: 'TP2',    value: fmtPrice(prediction.take_profit_2, selected.pair), color: 'text-green-400' },
                      ].map((item) => (
                        <div key={item.label} className="bg-[#0f172a] rounded-lg p-2.5 border border-[#334155]">
                          <p className="text-[#64748b] mb-0.5">{item.label}</p>
                          <p className={clsx('font-mono font-semibold', item.color)}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Risk:Reward */}
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg">
                      <span className="text-xs text-[#64748b]">Risk:Reward</span>
                      <span className="text-xs font-bold text-white">{rr}</span>
                    </div>

                    {/* News impact sentence */}
                    <div className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg">
                      <p className="text-[10px] text-[#64748b] mb-0.5">News Impact</p>
                      <p className="text-xs text-[#94a3b8] leading-relaxed">
                        This news is{' '}
                        <span className={clsx('font-semibold', SENTIMENT_STYLES[selected.sentiment]?.ticker)}>
                          {selected.sentiment}
                        </span>{' '}
                        for {selected.pair} based on current market conditions.
                      </p>
                    </div>

                    {/* Why button */}
                    {prediction.reason && (
                      <>
                        <button
                          onClick={() => setShowWhy((v) => !v)}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                        >
                          {showWhy ? 'Hide' : 'Why?'}
                        </button>
                        {showWhy && (
                          <div className="px-3 py-3 bg-[#0f172a] border border-blue-500/20 rounded-lg text-xs text-[#94a3b8] leading-relaxed">
                            {prediction.reason}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  !aiError && (
                    <div className="flex flex-col items-center justify-center py-10 text-[#475569] gap-2">
                      <p className="text-sm">Click a news card to see AI analysis</p>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          {/* ── SECTION 3: Ticker strip ────────────────────────────────────── */}
          {articles.length > 0 && (
            <section className="mt-auto">
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
                <div className="flex items-center">
                  <div className="flex-shrink-0 px-3 py-2 bg-[#0f172a] border-r border-[#334155] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    LIVE
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div
                      ref={tickerRef}
                      className="flex gap-8 py-2 px-4 whitespace-nowrap animate-[ticker_60s_linear_infinite]"
                    >
                      {[...articles, ...articles].map((a, i) => {
                        const sty = SENTIMENT_STYLES[a.sentiment] ?? SENTIMENT_STYLES['NEUTRAL'];
                        return (
                          <span
                            key={`${a.id}-${i}`}
                            className={clsx('text-xs font-medium cursor-pointer hover:opacity-80', sty.ticker)}
                            onClick={() => handleSelectArticle(a)}
                          >
                            {a.title}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inline keyframe for ticker */}
              <style>{`
                @keyframes ticker {
                  0%   { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
              `}</style>
            </section>
          )}

          <p className="text-xs text-[#475569] text-center">
            News signals are AI-generated for educational purposes only. Not financial advice.
          </p>
        </main>
      </div>
    </div>
  );
}
