'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { forex, ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import PredictionCard from '../components/PredictionCard';
import type { Candle, Prediction, Indicators, ForexSymbol, Timeframe, PredictResponse } from '../types';

const ChartPanel = dynamic(() => import('../components/ChartPanel'), { ssr: false });

const SYMBOLS: ForexSymbol[] = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD'];
const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '15m', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1day' },
];

export default function Platforms() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState<ForexSymbol>('EUR/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  const fetchCandles = useCallback(async () => {
    setLoadingChart(true);
    try {
      const data = await forex.getPrices(selectedSymbol, timeframe, 100);
      setCandles(data.candles ?? []);
    } catch {
      // silently fail
    } finally {
      setLoadingChart(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    fetchCandles();
    setPrediction(null);
    setIndicators(null);
  }, [selectedSymbol, timeframe, mounted, isAuthenticated, fetchCandles]);

  async function handlePredict() {
    setError('');
    setLoadingPredict(true);
    try {
      const data: PredictResponse = await ai.predict(selectedSymbol, timeframe);
      setPrediction(data.prediction);
      setIndicators(data.indicators);
      setIsMockData(data.isMockData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoadingPredict(false);
    }
  }

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Platforms</h1>
            <p className="text-sm text-[#94a3b8]">Multi-platform trading analysis</p>
          </div>

          {/* Symbol selector */}
          <div className="flex flex-wrap gap-2">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSymbol(s)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-colors border',
                  selectedSymbol === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Timeframe:</span>
            <div className="flex gap-1">
              {TIMEFRAMES.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setTimeframe(value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    timeframe === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1e293b] text-[#94a3b8] hover:text-white'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {isMockData && (
              <span className="px-3 py-1 bg-[#713f12] text-[#fbbf24] text-xs font-semibold rounded-lg border border-[#eab308]">
                MOCK DATA
              </span>
            )}
          </div>

          {/* Chart */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden" style={{ height: 400 }}>
            {loadingChart ? (
              <div className="w-full h-full flex items-center justify-center text-[#94a3b8] text-sm">
                Loading chart...
              </div>
            ) : (
              <ChartPanel candles={candles} symbol={selectedSymbol} timeframe={timeframe} />
            )}
          </div>

          {/* Predict button */}
          <button
            onClick={handlePredict}
            disabled={loadingPredict}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm"
          >
            {loadingPredict ? 'Analysing...' : 'GET AI PREDICTION'}
          </button>

          {error && (
            <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
              {error}
            </div>
          )}

          {/* Prediction Card */}
          <PredictionCard
            prediction={prediction}
            indicators={indicators}
            loading={loadingPredict}
            symbol={selectedSymbol}
          />
        </main>
      </div>
    </div>
  );
}
