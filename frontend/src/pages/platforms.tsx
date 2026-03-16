'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { forex, ai, activity } from '../services/api';
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
      { symbol: 'EUR/GBP', name: 'Euro / British Pound' },
      { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen' },
      { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen' },
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
      { symbol: 'XPT/USD', name: 'Platinum / US Dollar' },
      { symbol: 'XPD/USD', name: 'Palladium / US Dollar' },
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
      { symbol: 'XRP/USD', name: 'XRP / US Dollar' },
      { symbol: 'DOGE/USD', name: 'Dogecoin / US Dollar' },
      { symbol: 'DOT/USD', name: 'Polkadot / US Dollar' },
      { symbol: 'AVAX/USD', name: 'Avalanche / US Dollar' },
      { symbol: 'MATIC/USD', name: 'Polygon / US Dollar' },
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
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NFLX', name: 'Netflix Inc.' },
      { symbol: 'AMD', name: 'Advanced Micro Devices' },
      { symbol: 'INTC', name: 'Intel Corp.' },
    ],
  },
  {
    id: 'copy',
    name: 'Copy Trading',
    description: 'Social & Copy Trading',
    color: 'teal',
    icon: '🔄',
    instruments: [
      { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
      { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
      { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
      { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
      { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
      { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
      { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar' },
      { symbol: 'EUR/GBP', name: 'Euro / British Pound' },
      { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen' },
      { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen' },
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
      { symbol: 'NIKKEI', name: 'Nikkei 225' },
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

interface TradingPlatformDef {
  name: string;
  description: string;
  tag: string;
  url: string;
}

const TRADING_PLATFORMS: { category: string; icon: string; color: string; platforms: TradingPlatformDef[] }[] = [
  {
    category: 'Forex / Multi-Asset Platforms',
    icon: '💱',
    color: 'blue',
    platforms: [
      { name: 'MetaTrader 4', description: 'Industry-standard platform for forex & CFD trading with expert advisors.', tag: 'Forex', url: 'https://www.metatrader4.com' },
      { name: 'MetaTrader 5', description: 'Advanced multi-asset trading platform with improved order management.', tag: 'Multi-Asset', url: 'https://www.metatrader5.com' },
      { name: 'cTrader', description: 'Next-generation platform for forex and CFDs with level II pricing.', tag: 'Forex', url: 'https://ctrader.com' },
      { name: 'TradingView', description: 'Web-based charting platform with social trading features and broker integration.', tag: 'Charts', url: 'https://www.tradingview.com' },
      { name: 'NinjaTrader', description: 'Advanced trading platform for futures and forex with automated strategies.', tag: 'Futures', url: 'https://ninjatrader.com' },
    ],
  },
  {
    category: 'Stock Trading Apps',
    icon: '📈',
    color: 'green',
    platforms: [
      { name: 'Robinhood', description: 'Commission-free stock, ETF and crypto trading for US investors.', tag: 'Stocks', url: 'https://robinhood.com' },
      { name: 'Interactive Brokers', description: 'Professional-grade broker with global market access and low commissions.', tag: 'Pro', url: 'https://www.interactivebrokers.com' },
      { name: 'Charles Schwab', description: 'Full-service broker offering stocks, ETFs, options and banking.', tag: 'Stocks', url: 'https://www.schwab.com' },
      { name: 'Fidelity', description: 'Leading investment platform with research tools and zero-commission trades.', tag: 'Stocks', url: 'https://www.fidelity.com' },
      { name: 'TD Ameritrade', description: 'Thinkorswim platform with advanced charting and options trading.', tag: 'Options', url: 'https://www.tdameritrade.com' },
    ],
  },
  {
    category: 'Crypto Trading Platforms',
    icon: '₿',
    color: 'purple',
    platforms: [
      { name: 'Binance', description: "World's largest crypto exchange by trading volume with 350+ coins.", tag: 'Crypto', url: 'https://www.binance.com' },
      { name: 'Coinbase', description: 'US-regulated crypto exchange ideal for beginners and institutions.', tag: 'Crypto', url: 'https://www.coinbase.com' },
      { name: 'Kraken', description: 'Secure crypto exchange with advanced trading features and low fees.', tag: 'Crypto', url: 'https://www.kraken.com' },
      { name: 'Bitstamp', description: 'Europe-based crypto exchange with strong regulatory compliance.', tag: 'Crypto', url: 'https://www.bitstamp.net' },
      { name: 'KuCoin', description: "The People's Exchange — 700+ crypto pairs with margin and futures.", tag: 'Crypto', url: 'https://www.kucoin.com' },
    ],
  },
  {
    category: 'Copy / Social Trading',
    icon: '🔄',
    color: 'teal',
    platforms: [
      { name: 'eToro', description: 'Pioneer of social trading — copy top traders automatically.', tag: 'Social', url: 'https://www.etoro.com' },
      { name: 'Plus500', description: 'CFD broker with simple interface, no commissions on trades.', tag: 'CFD', url: 'https://www.plus500.com' },
      { name: 'CMC Markets', description: 'Award-winning CFD and spread betting platform with 10,000+ instruments.', tag: 'CFD', url: 'https://www.cmcmarkets.com' },
      { name: 'ZuluTrade', description: 'Automated trading platform connecting followers with top signal providers.', tag: 'Copy', url: 'https://www.zulutrade.com' },
      { name: 'NAGA', description: 'Social trading network for stocks, crypto and forex auto-copy.', tag: 'Social', url: 'https://naga.com' },
    ],
  },
  {
    category: 'Precious Metals Brokers',
    icon: '🥇',
    color: 'yellow',
    platforms: [
      { name: 'OANDA', description: 'Trusted broker with tight spreads on gold, silver and other metals.', tag: 'Metals', url: 'https://www.oanda.com' },
      { name: 'IG Group', description: 'Global leader in CFD trading with access to spot metals.', tag: 'Metals', url: 'https://www.ig.com' },
      { name: 'Saxo Bank', description: 'Premium multi-asset broker with institutional-grade metals trading.', tag: 'Premium', url: 'https://www.home.saxo' },
      { name: 'Pepperstone', description: 'ECN/STP broker with competitive spreads on XAU/USD and XAG/USD.', tag: 'ECN', url: 'https://pepperstone.com' },
      { name: 'IC Markets', description: 'Raw spread broker offering metals, forex and index CFDs.', tag: 'Raw', url: 'https://www.icmarkets.com' },
    ],
  },
  {
    category: 'Indices & Commodities',
    icon: '📊',
    color: 'orange',
    platforms: [
      { name: 'CME Group', description: 'World leading derivatives exchange for futures on indices and commodities.', tag: 'Futures', url: 'https://www.cmegroup.com' },
      { name: 'CBOE', description: 'Options exchange with VIX futures and equity index derivatives.', tag: 'Options', url: 'https://www.cboe.com' },
      { name: 'Euronext', description: 'European exchange offering equity indices and agricultural futures.', tag: 'Indices', url: 'https://www.euronext.com' },
      { name: 'IG Index', description: 'Spread betting and CFD platform specialising in major indices.', tag: 'CFD', url: 'https://www.ig.com' },
      { name: 'Admiral Markets', description: 'Multi-asset broker with competitive pricing on index CFDs.', tag: 'CFD', url: 'https://admiralmarkets.com' },
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
  teal: {
    card: 'border-teal-500/40 bg-teal-900/10',
    active: 'border-teal-500 bg-teal-900/30',
    badge: 'bg-teal-500/20 text-teal-400',
    button: 'bg-teal-600 hover:bg-teal-500',
    text: 'text-teal-400',
  },
  indigo: {
    card: 'border-indigo-500/40 bg-indigo-900/10',
    active: 'border-indigo-500 bg-indigo-900/30',
    badge: 'bg-indigo-500/20 text-indigo-400',
    button: 'bg-indigo-600 hover:bg-indigo-500',
    text: 'text-indigo-400',
  },
};

const PLATFORM_TAB_COLORS: Record<string, { border: string; text: string; badge: string; btn: string }> = {
  blue:   { border: 'border-blue-500/40',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300',   btn: 'bg-blue-600 hover:bg-blue-500' },
  green:  { border: 'border-green-500/40',  text: 'text-green-400',  badge: 'bg-green-500/20 text-green-300',  btn: 'bg-green-600 hover:bg-green-500' },
  purple: { border: 'border-purple-500/40', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300', btn: 'bg-purple-600 hover:bg-purple-500' },
  teal:   { border: 'border-teal-500/40',   text: 'text-teal-400',   badge: 'bg-teal-500/20 text-teal-300',   btn: 'bg-teal-600 hover:bg-teal-500' },
  yellow: { border: 'border-yellow-500/40', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300', btn: 'bg-yellow-600 hover:bg-yellow-500' },
  orange: { border: 'border-orange-500/40', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300', btn: 'bg-orange-600 hover:bg-orange-500' },
  red:    { border: 'border-red-500/40',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300',    btn: 'bg-red-600 hover:bg-red-500' },
};

// Map each trading platform group to a market category and default instrument
const PLATFORM_GROUP_MARKET_MAP: Record<string, { categoryId: string; defaultSymbol: string }> = {
  'Forex / Multi-Asset Platforms': { categoryId: 'forex', defaultSymbol: 'EUR/USD' },
  'Stock Trading Apps': { categoryId: 'stocks', defaultSymbol: 'AAPL' },
  'Crypto Trading Platforms': { categoryId: 'crypto', defaultSymbol: 'BTC/USD' },
  'Copy / Social Trading': { categoryId: 'copy', defaultSymbol: 'EUR/USD' },
  'Precious Metals Brokers': { categoryId: 'metals', defaultSymbol: 'XAU/USD' },
  'Indices & Commodities': { categoryId: 'indices', defaultSymbol: 'SPX' },
};

export default function Platforms() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const predictionRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'markets' | 'platforms'>('markets');
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
  const [aiProvider, setAiProvider] = useState<'auto' | 'dual' | 'claude' | 'groq'>('dual');

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
    activity.track({ action: 'prediction_request', page: 'platforms', symbol: selectedSymbol, timeframe });
    try {
      const data: PredictResponse = await ai.predict(selectedSymbol, timeframe, aiProvider);
      setPrediction(data.prediction);
      setIndicators(data.indicators);
      setIsMockData(data.isMockData);
      activity.track({
        action: 'prediction_result',
        page: 'platforms',
        symbol: selectedSymbol,
        timeframe,
        prediction_direction: data.prediction.direction,
        prediction_confidence: data.prediction.confidence,
      });
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
    activity.track({ action: 'symbol_view', page: 'platforms', symbol });
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

  function handleTimeframeChange(tf: string) {
    setTimeframe(tf as Timeframe);
    if (selectedSymbol) {
      activity.track({ action: 'timeframe_change', page: 'platforms', symbol: selectedSymbol, timeframe: tf });
    }
  }

  function handleViewPlatformChart(platformGroupName: string) {
    const mapping = PLATFORM_GROUP_MARKET_MAP[platformGroupName];
    if (!mapping) return;
    const category = PLATFORM_CATEGORIES.find((c) => c.id === mapping.categoryId);
    if (!category) return;
    setActiveTab('markets');
    setSelectedCategory(category);
    handleSelectInstrument(mapping.defaultSymbol);
    setTimeout(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
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

          {/* Tabs */}
          <div className="flex gap-1 bg-[#1e293b] border border-[#334155] rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('markets')}
              className={clsx(
                'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                activeTab === 'markets'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-[#94a3b8] hover:text-white'
              )}
            >
              📊 Markets &amp; Analysis
            </button>
            <button
              onClick={() => setActiveTab('platforms')}
              className={clsx(
                'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                activeTab === 'platforms'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-[#94a3b8] hover:text-white'
              )}
            >
              🏢 Trading Platforms
            </button>
          </div>

          {/* ── Markets & Analysis Tab ── */}
          {activeTab === 'markets' && (
            <>
              {/* Category Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
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
                          onClick={() => handleTimeframeChange(tf.value)}
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

                  <div ref={chartRef} className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
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
                    <div className="flex flex-col items-center gap-3">
                      {/* AI Provider selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#94a3b8] font-medium">AI Engine:</span>
                        <div className="flex items-center gap-1 bg-[#0f172a] border border-[#334155] rounded-xl p-1">
                          {([
                            { value: 'dual',   label: '⚡ Dual AI',  title: 'Claude + Groq combined (highest accuracy)' },
                            { value: 'claude', label: '🧠 Claude',   title: 'Anthropic Claude — deep quantitative analysis' },
                            { value: 'groq',   label: '🚀 Groq',     title: 'Groq LLaMA — fast market analysis' },
                            { value: 'auto',   label: '🔄 Auto',     title: 'Automatically try all available providers' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              title={opt.title}
                              onClick={() => setAiProvider(opt.value)}
                              className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap',
                                aiProvider === opt.value
                                  ? 'bg-indigo-600 text-white shadow'
                                  : 'text-[#94a3b8] hover:text-white'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Predict button */}
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
                  </div>

                  {error && (
                    <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-xl text-sm text-[#fca5a5]">
                      {error}
                    </div>
                  )}

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
            </>
          )}

          {/* ── Trading Platforms Tab ── */}
          {activeTab === 'platforms' && (
            <div className="space-y-8">
              {TRADING_PLATFORMS.map((group) => {
                const c = PLATFORM_TAB_COLORS[group.color] ?? PLATFORM_TAB_COLORS.blue;
                return (
                  <div key={group.category}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">{group.icon}</span>
                      <h2 className={clsx('font-bold text-base', c.text)}>{group.category}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                      {group.platforms.map((platform) => (
                        <div
                          key={platform.name}
                          className={clsx(
                            'rounded-2xl border bg-[#1e293b]/60 p-4 flex flex-col gap-3 transition-all duration-150 hover:bg-[#1e293b]',
                            c.border
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-white leading-tight">{platform.name}</p>
                            <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex-shrink-0', c.badge)}>
                              {platform.tag}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748b] leading-relaxed flex-1">{platform.description}</p>
                          <div className="mt-auto flex gap-2">
                            <button
                              onClick={() => handleViewPlatformChart(group.category)}
                              className={clsx(
                                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all',
                                c.btn
                              )}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              View Live Chart
                            </button>
                            <a
                              href={platform.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Visit official website"
                              className="flex items-center justify-center px-2.5 py-2 rounded-lg text-[#64748b] hover:text-white border border-[#334155] hover:border-[#475569] transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
