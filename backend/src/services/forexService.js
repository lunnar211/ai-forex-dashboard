'use strict';

const axios = require('axios');

const BASE_URL = 'https://api.twelvedata.com';

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
    return { candles, isMock: false };
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

  const mockPrices = {
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

  if (!apiKey) {
    console.warn('[ForexService] No TWELVE_DATA_API_KEY — returning mock price');
    const base = mockPrices[symbol] || 1.1000;
    const jitter = base * (0.9998 + Math.random() * 0.0004);
    return { price: parseFloat(jitter.toFixed(5)), isMock: true };
  }

  try {
    const response = await axios.get(`${BASE_URL}/price`, {
      params: { symbol, apikey: apiKey },
      timeout: 8000,
    });

    const data = response.data;

    if (data.status === 'error' || !data.price) {
      const base = mockPrices[symbol] || 1.1000;
      return { price: parseFloat(base.toFixed(5)), isMock: true };
    }

    return { price: parseFloat(data.price), isMock: false };
  } catch (err) {
    console.error(`[ForexService] fetchLivePrice error: ${err.message} — returning mock price`);
    const base = mockPrices[symbol] || 1.1000;
    return { price: parseFloat(base.toFixed(5)), isMock: true };
  }
}

module.exports = { fetchOHLCV, fetchLivePrice };
