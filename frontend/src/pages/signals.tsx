'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/authStore';
import { ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import SignalPanel from '../components/SignalPanel';
import type { Signal } from '../types';

const REFRESH_INTERVAL = 5 * 60; // seconds

export default function Signals() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [signals, setSignals] = useState<Signal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ai.getSignals();
      setSignals(data.signals ?? []);
      setGeneratedAt(data.generatedAt ?? null);
      setCountdown(REFRESH_INTERVAL);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load signals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchSignals();
  }, [isAuthenticated, fetchSignals]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchSignals();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchSignals]);

  if (!isAuthenticated) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Live Signals</h1>
              {generatedAt && (
                <p className="text-xs text-[#475569]">
                  Generated at {new Date(generatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-xs text-[#94a3b8]">
                <svg className="w-3.5 h-3.5 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-refresh in {mins}:{secs.toString().padStart(2, '0')}
              </div>
              <button
                onClick={fetchSignals}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
              {error}
            </div>
          )}

          {/* Signals grid */}
          {loading && signals.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 animate-pulse">
                  <div className="h-5 bg-[#334155] rounded w-24 mb-3" />
                  <div className="h-8 bg-[#334155] rounded w-full mb-3" />
                  <div className="h-3 bg-[#334155] rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#475569]">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>No signals available. Try refreshing.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {signals.map((signal, idx) => (
                <SignalPanel key={`${signal.symbol}-${idx}`} signal={signal} />
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-8 text-xs text-[#475569] text-center">
            ⚠️ Signals are generated using technical analysis and AI. For educational purposes only. Not financial advice.
          </p>
        </main>
      </div>
    </div>
  );
}
