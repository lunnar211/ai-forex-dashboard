'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { forex, ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import PredictionCard from '../components/PredictionCard';
import IndicatorGauges from '../components/IndicatorGauges';
import type { Candle, Prediction, Indicators, ForexSymbol, Timeframe, PredictResponse } from '../types';

const ChartPanel = dynamic(() => import('../components/ChartPanel'), { ssr: false });

const SYMBOLS: ForexSymbol[] = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD'];
const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '15m', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1day' },
];

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const predictionRef = useRef<HTMLDivElement>(null);

  const [symbol, setSymbol] = useState<ForexSymbol>('EUR/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ remaining: number; resetInSeconds: number } | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  const fetchCandles = useCallback(async () => {
    setLoadingChart(true);
    setChartError('');
    try {
      const data = await forex.getPrices(symbol, timeframe, 100);
      setCandles(data.candles ?? []);
    } catch (err: unknown) {
      setChartError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setLoadingChart(false);
    }
  }, [symbol, timeframe]);

  const fetchLivePrice = useCallback(async () => {
    try {
      const data = await forex.getLivePrice(symbol);
      setLivePrice(data.price);
    } catch {
      // silently fail for live price
    }
  }, [symbol]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCandles();
    fetchLivePrice();
    setPrediction(null);
    setIndicators(null);
  }, [symbol, timeframe, isAuthenticated, fetchCandles, fetchLivePrice]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(fetchLivePrice, 30_000);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchLivePrice]);

  async function handlePredict() {
    setError('');
    setLoadingPredict(true);
    try {
      const data: PredictResponse = await ai.predict(symbol, timeframe);
      setPrediction(data.prediction);
      setIndicators(data.indicators);
      setIsMockData(data.isMockData);
      setRateLimit(data.rateLimit);
      setTimeout(() => {
        predictionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoadingPredict(false);
    }
  }

  if (!isAuthenticated) return null;

  const decimals = symbol === 'USD/JPY' ? 3 : symbol === 'XAU/USD' ? 2 : 5;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 space-y-5">

          {/* Symbol + Live Price */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-colors border',
                    symbol === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white hover:border-[#475569]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {livePrice !== null && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-[#334155] rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  <span className="text-xs text-[#94a3b8]">LIVE</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {livePrice.toFixed(decimals)}
                  </span>
                </div>
              )}
              {isMockData && (
                <span className="px-3 py-1.5 bg-[#713f12] text-[#fbbf24] text-xs font-semibold rounded-lg border border-[#eab308]">
                  ⚠ MOCK DATA
                </span>
              )}
            </div>
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
          </div>

          {/* Chart */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden" style={{ height: 400 }}>
            {loadingChart ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex items-center gap-2 text-[#94a3b8]">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading chart…
                </div>
              </div>
            ) : chartError ? (
              <div className="w-full h-full flex items-center justify-center text-[#ef4444] text-sm">
                {chartError}
              </div>
            ) : (
              <ChartPanel candles={candles} symbol={symbol} timeframe={timeframe} />
            )}
          </div>

          {/* AI Predict button */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handlePredict}
              disabled={loadingPredict}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/30 text-sm"
            >
              {loadingPredict ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analysing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  GET AI PREDICTION
                </>
              )}
            </button>
            {rateLimit !== null && (
              <div className="text-xs text-[#94a3b8]">
                <span className={clsx(rateLimit.remaining <= 2 ? 'text-[#ef4444]' : 'text-[#22c55e]')}>
                  {rateLimit.remaining}
                </span>{' '}
                predictions remaining · resets in {Math.floor(rateLimit.resetInSeconds / 60)}m
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
              {error}
            </div>
          )}

          {/* Indicator Gauges */}
          {indicators && (
            <IndicatorGauges
              rsi={indicators.rsi ?? null}
              macd={indicators.macd ?? null}
            />
          )}

          {/* Prediction Card */}
          <div ref={predictionRef}>
            <PredictionCard
              prediction={prediction}
              indicators={indicators}
              loading={loadingPredict}
              symbol={symbol}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
