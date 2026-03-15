'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { forex, ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import PredictionCard from '../components/PredictionCard';
import IndicatorGauges from '../components/IndicatorGauges';
import type {
  Candle, Prediction, Indicators, Timeframe, PredictResponse,
  PlatformCategoryDef,
} from '../types';

const ChartPanel = dynamic(() => import('../components/ChartPanel'), { ssr: false });

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '15m', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1day' },
];

const PLATFORM_CATEGORIES: PlatformCategoryDef[] = [
  {
    id: 'forex',
    name: 'Forex',
    description: 'Foreign Exchange Markets',
    color: 'blue',
    icon: '💱',
    instruments: [
      { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
      { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
      { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
      { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
      { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
      { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
      { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar' },
    ],
  },
  {
    id: 'metals',
    name: 'Precious Metals',
    description: 'Gold, Silver & Commodities',
    color: 'yellow',
    icon: '🥇',
    instruments: [
      { symbol: 'XAU/USD', name: 'Gold / US Dollar' },
      { symbol: 'XAG/USD', name: 'Silver / US Dollar' },
    ],
  },
  {
    id: 'crypto',
    name: 'Crypto',
    description: 'Digital Asset Markets',
    color: 'purple',
    icon: '₿',
    instruments: [
      { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar' },
      { symbol: 'ETH/USD', name: 'Ethereum / US Dollar' },
      { symbol: 'BNB/USD', name: 'BNB / US Dollar' },
      { symbol: 'SOL/USD', name: 'Solana / US Dollar' },
      { symbol: 'ADA/USD', name: 'Cardano / US Dollar' },
    ],
  },
  {
    id: 'stocks',
    name: 'Stocks',
    description: 'Global Equity Markets',
    color: 'green',
    icon: '📈',
    instruments: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
    ],
  },
  {
    id: 'indices',
    name: 'Indices',
    description: 'Major Market Indices',
    color: 'red',
    icon: '📊',
    instruments: [
      { symbol: 'SPX', name: 'S&P 500 Index' },
      { symbol: 'DJI', name: 'Dow Jones Industrial' },
      { symbol: 'NDX', name: 'NASDAQ 100' },
      { symbol: 'FTSE', name: 'FTSE 100' },
      { symbol: 'DAX', name: 'DAX 40' },
    ],
  },
  {
    id: 'commodities',
    name: 'Commodities',
    description: 'Oil, Gas & Agricultural',
    color: 'orange',
    icon: '🛢️',
    instruments: [
      { symbol: 'OIL/USD', name: 'Crude Oil / US Dollar' },
      { symbol: 'NATGAS/USD', name: 'Natural Gas / US Dollar' },
      { symbol: 'WHEAT/USD', name: 'Wheat / US Dollar' },
      { symbol: 'CORN/USD', name: 'Corn / US Dollar' },
    ],
  },
];

const CATEGORY_COLORS: Record<string, {
  card: string; active: string; badge: string; button: string; text: string;
}> = {
  blue: {
    card: 'border-blue-500/40 bg-blue-900/10',
    active: 'border-blue-500 bg-blue-900/30',
    badge: 'bg-blue-500/20 text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-500',
    text: 'text-blue-400',
  },
  yellow: {
    card: 'border-yellow-500/40 bg-yellow-900/10',
    active: 'border-yellow-500 bg-yellow-900/30',
    badge: 'bg-yellow-500/20 text-yellow-400',
    button: 'bg-yellow-600 hover:bg-yellow-500',
    text: 'text-yellow-400',
  },
  purple: {
    card: 'border-purple-500/40 bg-purple-900/10',
    active: 'border-purple-500 bg-purple-900/30',
    badge: 'bg-purple-500/20 text-purple-400',
    button: 'bg-purple-600 hover:bg-purple-500',
    text: 'text-purple-400',
  },
  green: {
    card: 'border-green-500/40 bg-green-900/10',
    active: 'border-green-500 bg-green-900/30',
    badge: 'bg-green-500/20 text-green-400',
    button: 'bg-green-600 hover:bg-green-500',
    text: 'text-green-400',
  },
  red: {
    card: 'border-red-500/40 bg-red-900/10',
    active: 'border-red-500 bg-red-900/30',
    badge: 'bg-red-500/20 text-red-400',
    button: 'bg-red-600 hover:bg-red-500',
    text: 'text-red-400',
  },
  orange: {
    card: 'border-orange-500/40 bg-orange-900/10',
    active: 'border-orange-500 bg-orange-900/30',
    badge: 'bg-orange-500/20 text-orange-400',
    button: 'bg-orange-600 hover:bg-orange-500',
    text: 'text-orange-400',
  },
};

export default function Platforms() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const predictionRef = useRef<HTMLDivElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<PlatformCategoryDef>(PLATFORM_CATEGORIES[0]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');

  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  const fetchCandles = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoadingChart(true);
    setChartError('');
    try {
      const data = await forex.getPrices(selectedSymbol, timeframe, 100);
      setCandles(data.candles ?? []);
    } catch (err: unknown) {
      setChartError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setLoadingChart(false);
    }
  }, [selectedSymbol, timeframe]);

  const fetchLivePrice = useCallback(async () => {
    if (!selectedSymbol) return;
    try {
      const data = await forex.getLivePrice(selectedSymbol);
      setLivePrice(data.price);
    } catch {
      // silently fail
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (!mounted || !isAuthenticated || !selectedSymbol) return;
    fetchCandles();
    fetchLivePrice();
    setPrediction(null);
    setIndicators(null);
  }, [selectedSymbol, timeframe, mounted, isAuthenticated, fetchCandles, fetchLivePrice]);

  useEffect(() => {
    if (!mounted || !isAuthenticated || !selectedSymbol) return;
    const id = setInterval(fetchLivePrice, 30_000);
    return () => clearInterval(id);
  }, [mounted, isAuthenticated, fetchLivePrice, selectedSymbol]);

  async function handlePredict() {
    if (!selectedSymbol) return;
    setError('');
    setLoadingPredict(true);
    try {
      const data: PredictResponse = await ai.predict(selectedSymbol, timeframe);
      setPrediction(data.prediction);
      setIndicators(data.indicators);
      setIsMockData(data.isMockData);
      setTimeout(() => {
        predictionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoadingPredict(false);
    }
  }

  function handleSelectInstrument(symbol: string) {
    setSelectedSymbol(symbol);
    setPrediction(null);
    setIndicators(null);
    setCandles([]);
    setLivePrice(null);
    setError('');
    setChartError('');
  }

  function handleSelectCategory(cat: PlatformCategoryDef) {
    setSelectedCategory(cat);
    setSelectedSymbol(null);
    setPrediction(null);
    setIndicators(null);
    setCandles([]);
    setLivePrice(null);
    setError('');
    setChartError('');
  }

  if (!mounted || !isAuthenticated) return null;

  const colors = CATEGORY_COLORS[selectedCategory.color];
  const selectedInstrument = selectedCategory.instruments.find((i) => i.symbol === selectedSymbol);

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              🌐 World Trading Platforms
            </h1>
            <p className="text-sm text-[#475569] mt-1">
              Select a market category and instrument to view live charts and AI predictions.
            </p>
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {PLATFORM_CATEGORIES.map((cat) => {
              const c = CATEGORY_COLORS[cat.color];
              const isActive = selectedCategory.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={clsx(
                    'rounded-xl border p-3 text-left transition-all duration-150',
                    isActive ? c.active : c.card,
                    'hover:opacity-90'
                  )}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <p className={clsx('text-sm font-semibold', isActive ? c.text : 'text-white')}>{cat.name}</p>
                  <p className="text-[10px] text-[#475569] mt-0.5 leading-tight">{cat.description}</p>
                </button>
              );
            })}
          </div>

          {/* Instruments */}
          <div className={clsx('rounded-2xl border p-4', colors.card)}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{selectedCategory.icon}</span>
              <h2 className={clsx('font-semibold text-sm', colors.text)}>{selectedCategory.name} Instruments</h2>
              <span className={clsx('px-2 py-0.5 rounded text-xs font-bold ml-auto', colors.badge)}>
                {selectedCategory.instruments.length} instruments
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCategory.instruments.map((inst) => (
                <button
                  key={inst.symbol}
                  onClick={() => handleSelectInstrument(inst.symbol)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150',
                    selectedSymbol === inst.symbol
                      ? `${colors.button} border-transparent text-white shadow-lg`
                      : 'border-[#334155] text-[#94a3b8] hover:border-[#475569] hover:text-white bg-[#1e293b]/50'
                  )}
                >
                  <span className="font-bold">{inst.symbol}</span>
                  <span className="ml-1.5 text-[10px] opacity-70 hidden sm:inline">{inst.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chart + Prediction */}
          {selectedSymbol && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{selectedSymbol}</h2>
                    {selectedInstrument && (
                      <span className="text-sm text-[#475569]">{selectedInstrument.name}</span>
                    )}
                    {livePrice !== null && (
                      <span className={clsx('text-base font-bold', colors.text)}>
                        {livePrice.toFixed(4)}
                      </span>
                    )}
                    {isMockData && (
                      <span className="px-2 py-0.5 bg-yellow-900/40 text-yellow-400 text-xs rounded font-bold">
                        DEMO DATA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5">
                    <span className={clsx('font-medium', colors.text)}>{selectedCategory.name}</span>
                    {' · '}AI-powered analysis
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-[#1e293b] border border-[#334155] rounded-xl p-1">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setTimeframe(tf.value)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                        timeframe === tf.value
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-[#94a3b8] hover:text-white'
                      )}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart — FIX 1: pass all 3 required props */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Live Chart</p>
                  {loadingChart && (
                    <div className="flex items-center gap-1.5 text-xs text-[#475569]">
                      <div className="w-3 h-3 border border-[#475569] border-t-blue-400 rounded-full animate-spin" />
                      Loading…
                    </div>
                  )}
                </div>
                {chartError ? (
                  <div className="p-6 text-sm text-red-400">{chartError}</div>
                ) : (
                  <ChartPanel
                    candles={candles}
                    symbol={selectedSymbol}
                    timeframe={timeframe}
                  />
                )}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handlePredict}
                  disabled={loadingPredict}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50',
                    colors.button
                  )}
                >
                  {loadingPredict ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analysing…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Get AI Prediction
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-xl text-sm text-[#fca5a5]">
                  {error}
                </div>
              )}

              {/* FIX 2 & 3: correct props for IndicatorGauges and PredictionCard */}
              <div ref={predictionRef} className="space-y-5">
                {indicators && (
                  <IndicatorGauges
                    rsi={indicators.rsi ?? null}
                    macd={indicators.macd ?? null}
                  />
                )}
                {prediction && (
                  <PredictionCard
                    prediction={prediction}
                    indicators={indicators}
                    loading={false}
                    symbol={selectedSymbol}
                  />
                )}
              </div>
            </div>
          )}

          {!selectedSymbol && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">{selectedCategory.icon}</div>
              <p className="text-white font-semibold text-lg">Select an instrument above</p>
              <p className="text-[#475569] text-sm mt-2">
                Choose any {selectedCategory.name} instrument to view its live chart and get AI predictions.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
