'use client';
import { useEffect, useRef } from 'react';

// Map app symbols to TradingView symbol identifiers
const TV_SYMBOL_MAP: Record<string, string> = {
  // Forex
  'EUR/USD': 'OANDA:EURUSD',
  'GBP/USD': 'OANDA:GBPUSD',
  'USD/JPY': 'OANDA:USDJPY',
  'AUD/USD': 'OANDA:AUDUSD',
  'USD/CAD': 'OANDA:USDCAD',
  'USD/CHF': 'OANDA:USDCHF',
  'NZD/USD': 'OANDA:NZDUSD',
  'EUR/GBP': 'OANDA:EURGBP',
  'EUR/JPY': 'OANDA:EURJPY',
  'GBP/JPY': 'OANDA:GBPJPY',
  // Metals
  'XAU/USD': 'OANDA:XAUUSD',
  'XAG/USD': 'OANDA:XAGUSD',
  'XPT/USD': 'OANDA:XPTUSD',
  'XPD/USD': 'OANDA:XPDUSD',
  // Crypto
  'BTC/USD':  'COINBASE:BTCUSD',
  'ETH/USD':  'COINBASE:ETHUSD',
  'BNB/USD':  'BINANCE:BNBUSDT',
  'SOL/USD':  'COINBASE:SOLUSD',
  'ADA/USD':  'BINANCE:ADAUSDT',
  'XRP/USD':  'COINBASE:XRPUSD',
  'DOGE/USD': 'BINANCE:DOGEUSDT',
  'DOT/USD':  'BINANCE:DOTUSDT',
  'AVAX/USD': 'COINBASE:AVAXUSD',
  'MATIC/USD':'COINBASE:MATICUSD',
  // Stocks
  'AAPL':  'NASDAQ:AAPL',
  'GOOGL': 'NASDAQ:GOOGL',
  'MSFT':  'NASDAQ:MSFT',
  'TSLA':  'NASDAQ:TSLA',
  'AMZN':  'NASDAQ:AMZN',
  'NVDA':  'NASDAQ:NVDA',
  'META':  'NASDAQ:META',
  'NFLX':  'NASDAQ:NFLX',
  'AMD':   'NASDAQ:AMD',
  'INTC':  'NASDAQ:INTC',
  // Indices
  'SPX':    'SP:SPX',
  'DJI':    'DJ:DJI',
  'NDX':    'NASDAQ:NDX',
  'FTSE':   'SPREADEX:FTSE',
  'DAX':    'XETR:DAX',
  'NIKKEI': 'OANDA:JP225USD',
  // Commodities
  'OIL/USD':    'NYMEX:CL1!',
  'NATGAS/USD': 'NYMEX:NG1!',
  'WHEAT/USD':  'CBOT:ZW1!',
  'CORN/USD':   'CBOT:ZC1!',
};

// Map timeframe strings to TradingView interval strings
const TV_INTERVAL_MAP: Record<string, string> = {
  '5min': '5',
  '15min': '15',
  '1h':   '60',
  '4h':   '240',
  '1day': 'D',
};

interface Props {
  symbol: string | null;
  timeframe: string;
}

/**
 * TradingTerminal — embeds the free TradingView Advanced Chart widget in dark
 * mode. The widget loads via an injected <script> tag (TradingView's official
 * embed approach). A React useEffect re-creates the widget whenever symbol or
 * timeframe changes.
 */
export default function TradingTerminal({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !symbol) return;

    // Remove any previous widget instance
    el.innerHTML = '';

    const tvSymbol = TV_SYMBOL_MAP[symbol] || `OANDA:${symbol.replace('/', '')}`;
    const interval = TV_INTERVAL_MAP[timeframe] || '60';

    // TradingView requires the config JSON to be placed inside the script tag
    // as text (not as an attribute).  The recommended React approach is to
    // create the element dynamically so Next.js doesn't sanitise the contents.
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    el.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol:   tvSymbol,
      interval,
      timezone:            'Etc/UTC',
      theme:               'dark',
      style:               '1',
      locale:              'en',
      allow_symbol_change: false,
      calendar:            false,
      hide_top_toolbar:    false,
      hide_legend:         false,
      save_image:          false,
      withdateranges:      true,
      studies: [
        'STD;RSI',
        'STD;MACD',
        'STD;EMA',
      ],
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
    };
  }, [symbol, timeframe]);

  if (!symbol) return null;

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container relative w-full bg-[#0f172a] rounded-xl overflow-hidden"
      style={{ height: '100%', minHeight: 480 }}
    >
      {/* Shown briefly before the widget script finishes loading */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-sm text-[#334155]">Loading TradingView chart…</span>
      </div>
    </div>
  );
}
