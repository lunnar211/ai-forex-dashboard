'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import type { HistoryRecord } from '../types';

const SYMBOLS = ['All', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD'];
const LIMIT = 20;

const directionStyles: Record<string, string> = {
  BUY: 'text-[#22c55e] bg-[#166534]',
  SELL: 'text-[#ef4444] bg-[#7f1d1d]',
  HOLD: 'text-[#eab308] bg-[#713f12]',
};

export default function History() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [symbolFilter, setSymbolFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  const fetchHistory = useCallback(async (sym: string, off: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await ai.getHistory(sym === 'All' ? undefined : sym, LIMIT, off);
      setRecords(data.predictions ?? []);
      setCount(data.count ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    setOffset(0);
    fetchHistory(symbolFilter, 0);
  }, [symbolFilter, mounted, isAuthenticated, fetchHistory]);

  function handlePrev() {
    const newOff = Math.max(0, offset - LIMIT);
    setOffset(newOff);
    fetchHistory(symbolFilter, newOff);
  }

  function handleNext() {
    const newOff = offset + LIMIT;
    setOffset(newOff);
    fetchHistory(symbolFilter, newOff);
  }

  const totalPages = Math.ceil(count / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">Prediction History</h1>
            <p className="text-sm text-[#94a3b8]">Review all your past AI predictions</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbolFilter(s)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                  symbolFilter === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white'
                )}
              >
                {s}
              </button>
            ))}
            <span className="ml-auto text-xs text-[#475569] self-center">
              {count} total records
            </span>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {['Date', 'Symbol', 'TF', 'Signal', 'Conf%', 'Entry', 'Stop Loss', 'Take Profit', 'AI'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#334155]">
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-[#334155] rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-[#475569]">
                        No predictions found. Get your first AI prediction from the dashboard.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => {
                      const dir = r.direction?.toUpperCase() ?? 'HOLD';
                      const dirStyle = directionStyles[dir] ?? 'text-white';
                      return (
                        <tr key={r.id} className="border-b border-[#334155] hover:bg-[#0f172a] transition-colors">
                          <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap text-xs">
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{r.symbol}</td>
                          <td className="px-4 py-3 text-[#94a3b8]">{r.timeframe}</td>
                          <td className="px-4 py-3">
                            <span className={clsx('px-2 py-0.5 rounded text-xs font-bold', dirStyle)}>
                              {dir}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-white">{r.confidence}%</td>
                          <td className="px-4 py-3 font-mono text-blue-400 whitespace-nowrap">
                            {r.entry_price?.toFixed(5)}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#ef4444] whitespace-nowrap">
                            {r.stop_loss?.toFixed(5)}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#22c55e] whitespace-nowrap">
                            {r.take_profit?.toFixed(5)}
                          </td>
                          <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap text-xs">{r.ai_provider}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {count > LIMIT && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#334155]">
                <span className="text-xs text-[#475569]">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={offset === 0 || loading}
                    className="px-3 py-1.5 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-xs rounded-lg hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={offset + LIMIT >= count || loading}
                    className="px-3 py-1.5 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-xs rounded-lg hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
