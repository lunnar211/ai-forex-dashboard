'use strict';

const axios = require('axios');

const BASE_URL = 'https://api.twelvedata.com';

// ─── Mock data generator ────────────────────────────────────────────────────

function generateMockOHLCV(symbol, count = 100) {
  const priceMap = {
    'EUR/USD': 1.0850,
    'GBP/USD': 1.2650,
    'USD/JPY': 149.50,
    'AUD/USD': 0.6520,
    'XAU/USD': 1985.0,
    'USD/CAD': 1.3580,
    'USD/CHF': 0.8950,
    'NZD/USD': 0.6080,
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
    'EUR/USD': 1.0850,
    'GBP/USD': 1.2650,
    'USD/JPY': 149.50,
    'AUD/USD': 0.6520,
    'XAU/USD': 1985.0,
    'USD/CAD': 1.3580,
    'USD/CHF': 0.8950,
    'NZD/USD': 0.6080,
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
