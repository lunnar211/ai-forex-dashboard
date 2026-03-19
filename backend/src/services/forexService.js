'use strict';

const axios = require('axios');

const BASE_URL = 'https://api.twelvedata.com';

// ─── Caches ───────────────────────────────────────────────────────────────────

const priceCache      = new Map();
const PRICE_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes

const candleCache      = new Map();
const CANDLE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Mock data generator ────────────────────────────────────────────────────

function generateMockOHLCV(symbol, count = 100) {
  const priceMap = {
    // Forex
    'EUR/USD': 1.0850,
    'GBP/USD': 1.2650,
    'USD/JPY': 149.50,
    'AUD/USD': 0.6520,
    'XAU/USD': 1985.0,
    'USD/CAD': 1.3580,
    'USD/CHF': 0.8950,
    'NZD/USD': 0.6080,
    'EUR/GBP': 0.8560,
    'EUR/JPY': 162.50,
    'GBP/JPY': 189.80,
    'XAG/USD': 23.50,
    // Additional Metals
    'XPT/USD': 995.0,
    'XPD/USD': 1120.0,
    // Crypto
    'BTC/USD': 67000.0,
    'ETH/USD': 3500.0,
    'BNB/USD': 580.0,
    'SOL/USD': 160.0,
    'ADA/USD': 0.58,
    'XRP/USD': 0.62,
    'DOGE/USD': 0.165,
    'DOT/USD': 8.5,
    'AVAX/USD': 38.0,
    'MATIC/USD': 0.85,
    // Stocks
    'AAPL': 185.0,
    'GOOGL': 175.0,
    'MSFT': 415.0,
    'TSLA': 175.0,
    'AMZN': 195.0,
    'NVDA': 880.0,
    'META': 520.0,
    'NFLX': 625.0,
    'AMD': 170.0,
    'INTC': 42.0,
    // Indices
    'SPX': 5200.0,
    'DJI': 39000.0,
    'NDX': 18200.0,
    'FTSE': 8100.0,
    'DAX': 18500.0,
    'NIKKEI': 39500.0,
    // Commodities
    'OIL/USD': 82.0,
    'NATGAS/USD': 2.85,
    'WHEAT/USD': 570.0,
    'CORN/USD': 430.0,
  };

  const basePrice = priceMap[symbol] || 1.1000;
  const volatility = basePrice * 0.003; // ~0.3 % per candle
  const candles = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.5) * 2 * volatility;
    const close = Math.max(open + change, 0.0001);
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = Math.floor(Math.random() * 50000) + 10000;
    const datetime = new Date(now - i * 60 * 60 * 1000).toISOString();

    candles.push({ datetime, open, high, low, close, volume });
    price = close;
  }

  return candles;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapTwelveDataCandles(values) {
  return values.map((v) => ({
    datetime: v.datetime,
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume) || 0,
  }));
}

// ─── Fallback price helpers ───────────────────────────────────────────────────

const MOCK_PRICES = {
  // Forex
  'EUR/USD': 1.0850, 'GBP/USD': 1.2650, 'USD/JPY': 149.50,
  'AUD/USD': 0.6520, 'XAU/USD': 1985.0, 'USD/CAD': 1.3580,
  'USD/CHF': 0.8950, 'NZD/USD': 0.6080, 'EUR/GBP': 0.8560,
  'EUR/JPY': 162.50, 'GBP/JPY': 189.80, 'XAG/USD': 23.50,
  // Additional Metals
  'XPT/USD': 995.0, 'XPD/USD': 1120.0,
  // Crypto
  'BTC/USD': 67000.0, 'ETH/USD': 3500.0, 'BNB/USD': 580.0,
  'SOL/USD': 160.0,   'ADA/USD': 0.58,   'XRP/USD': 0.62,
  'DOGE/USD': 0.165,  'DOT/USD': 8.5,    'AVAX/USD': 38.0, 'MATIC/USD': 0.85,
  // Stocks
  'AAPL': 185.0, 'GOOGL': 175.0, 'MSFT': 415.0, 'TSLA': 175.0,
  'AMZN': 195.0, 'NVDA': 880.0,  'META': 520.0,  'NFLX': 625.0,
  'AMD': 170.0,  'INTC': 42.0,
  // Indices
  'SPX': 5200.0, 'DJI': 39000.0, 'NDX': 18200.0,
  'FTSE': 8100.0, 'DAX': 18500.0, 'NIKKEI': 39500.0,
  // Commodities
  'OIL/USD': 82.0, 'NATGAS/USD': 2.85, 'WHEAT/USD': 570.0, 'CORN/USD': 430.0,
};

function getMockPrice(symbol) {
  return {
    price:     parseFloat((MOCK_PRICES[symbol] || 1.0000).toFixed(5)),
    isMock:    true,
    source:    'mock',
    timestamp: new Date().toISOString(),
  };
}

function isCreditExhausted(message) {
  const m = (message || '').toLowerCase();
  return m.includes('credits') || m.includes('api credits');
}

async function getFallbackPrice(symbol) {
  // FALLBACK 1: Frankfurter API (free, no key, forex only)
  try {
    const pair  = symbol.replace('/', '');
    const base  = pair.slice(0, 3);
    const quote = pair.slice(3, 6);
    const r = await axios.get(`https://api.frankfurter.app/latest`, {
      params: { from: base, to: quote },
      timeout: 5000,
    });
    const price = r.data?.rates?.[quote];
    if (price) {
      return { price: parseFloat(price), isMock: false, source: 'frankfurter', timestamp: new Date().toISOString() };
    }
  } catch { /* try next fallback */ }

  // FALLBACK 2: ExchangeRate-API (free, 1500 req/month)
  try {
    const base  = symbol.replace('/', '').slice(0, 3);
    const quote = symbol.replace('/', '').slice(3, 6);
    const r = await axios.get(`https://open.er-api.com/v6/latest/${base}`, { timeout: 5000 });
    if (r.data?.rates?.[quote]) {
      return { price: r.data.rates[quote], isMock: false, source: 'exchangerate-api', timestamp: new Date().toISOString() };
    }
  } catch { /* try next fallback */ }

  // FALLBACK 3: Return last known cached price (even if stale)
  const stale = priceCache.get(symbol);
  if (stale) {
    console.warn(`[ForexService] Using stale cache for ${symbol}`);
    return { ...stale.data, stale: true };
  }

  // FALLBACK 4: Return mock/demo price so UI doesn't break
  return getMockPrice(symbol);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch OHLCV candles for the given forex pair.
 * Falls back to deterministic mock data when the API call fails.
 *
 * @param {string} symbol     e.g. "EUR/USD"
 * @param {string} interval   e.g. "1h", "4h", "1day"
 * @param {number} outputsize Number of candles to return
 */
async function fetchOHLCV(symbol, interval = '1h', outputsize = 100) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  // Check candle cache first
  const cacheKey = `${symbol}-${interval}`;
  const cached   = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CANDLE_CACHE_TTL) {
    return cached.data;
  }

  if (!apiKey) {
    console.warn('[ForexService] No TWELVE_DATA_API_KEY — returning mock data');
    return { candles: generateMockOHLCV(symbol, outputsize), isMock: true };
  }

  try {
    const response = await axios.get(`${BASE_URL}/time_series`, {
      params: {
        symbol,
        interval,
        outputsize,
        apikey: apiKey,
        format: 'JSON',
      },
      timeout: 10000,
    });

    const data = response.data;

    if (data.status === 'error' || !data.values) {
      console.warn(
        `[ForexService] TwelveData error for ${symbol}: ${data.message || 'unknown'} — returning mock data`
      );
      return { candles: generateMockOHLCV(symbol, outputsize), isMock: true };
    }

    // TwelveData returns newest-first; reverse to chronological order
    const candles = mapTwelveDataCandles(data.values).reverse();
    const result  = { candles, isMock: false };
    candleCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error(`[ForexService] fetchOHLCV error: ${err.message} — returning mock data`);
    return { candles: generateMockOHLCV(symbol, outputsize), isMock: true };
  }
}

/**
 * Fetch the current mid-price for a forex pair.
 * Falls back to mock data on failure.
 *
 * @param {string} symbol  e.g. "EUR/USD"
 */
async function fetchLivePrice(symbol) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  // Check price cache first
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
    return cached.data;
  }

  if (!apiKey) {
    console.warn('[ForexService] No TWELVE_DATA_API_KEY — using fallback');
    return getFallbackPrice(symbol);
  }

  try {
    const response = await axios.get(`${BASE_URL}/price`, {
      params: { symbol, apikey: apiKey },
      timeout: 8000,
    });

    const data = response.data;

    if (data.status === 'error' || !data.price) {
      const msg = data.message || '';
      if (isCreditExhausted(msg)) {
        console.warn(`[ForexService] TwelveData credits exhausted, using fallback for ${symbol}`);
      } else {
        console.warn(`[ForexService] TwelveData error for ${symbol}: ${msg || 'unknown'} — using fallback`);
      }
      return getFallbackPrice(symbol);
    }

    const result = { price: parseFloat(data.price), isMock: false };
    priceCache.set(symbol, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    if (isCreditExhausted(err.message)) {
      console.warn(`[ForexService] TwelveData credits exhausted, using fallback for ${symbol}`);
    } else {
      console.error(`[ForexService] fetchLivePrice error: ${err.message} — using fallback`);
    }
    return getFallbackPrice(symbol);
  }
}

module.exports = { fetchOHLCV, fetchLivePrice };
