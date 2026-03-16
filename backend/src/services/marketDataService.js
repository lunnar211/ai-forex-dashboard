'use strict';

/**
 * marketDataService.js
 *
 * Fetches live market data from external APIs to enrich AI predictions:
 *   • Finnhub    — live forex quotes + news sentiment
 *   • NewsData   — latest financial news headlines
 *   • Polymarket — prediction market sentiment
 *
 * All functions are gracefully tolerant: any API failure returns null
 * rather than throwing, so the prediction pipeline is never blocked by
 * a single data-source outage.
 */

const axios = require('axios');

const FINNHUB_KEY    = process.env.FINNHUB_API_KEY;
const NEWSDATA_KEY   = process.env.NEWSDATA_API_KEY;
const POLYMARKET_KEY = process.env.POLYMARKET_API_KEY;
// STEADYAPI_KEY reserved for future expansion
// const STEADYAPI_KEY = process.env.STEADYAPI_KEY;

// ── Symbol converter: EUR/USD → OANDA:EUR_USD ─────────────────────────────────
function toFinnhubSymbol(symbol) {
  const map = {
    'EUR/USD': 'OANDA:EUR_USD',
    'GBP/USD': 'OANDA:GBP_USD',
    'USD/JPY': 'OANDA:USD_JPY',
    'AUD/USD': 'OANDA:AUD_USD',
    'USD/CAD': 'OANDA:USD_CAD',
    'USD/CHF': 'OANDA:USD_CHF',
    'NZD/USD': 'OANDA:NZD_USD',
    'EUR/GBP': 'OANDA:EUR_GBP',
    'EUR/JPY': 'OANDA:EUR_JPY',
    'GBP/JPY': 'OANDA:GBP_JPY',
    'XAU/USD': 'OANDA:XAU_USD',
    'XAG/USD': 'OANDA:XAG_USD',
  };
  return map[symbol] || `OANDA:${symbol.replace('/', '_')}`;
}

// ── 1. Live forex quote from Finnhub ─────────────────────────────────────────
async function getLiveQuote(symbol) {
  if (!FINNHUB_KEY) {
    console.warn('[MarketData] FINNHUB_API_KEY not set — skipping live quote');
    return null;
  }
  try {
    const res = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol: toFinnhubSymbol(symbol), token: FINNHUB_KEY },
      timeout: 6000,
    });
    const d = res.data;
    if (!d || !d.c) return null;
    const changePct = d.pc ? (((d.c - d.pc) / d.pc) * 100).toFixed(4) : '0.0000';
    return {
      source:         'finnhub',
      symbol,
      current_price:  d.c,
      open:           d.o,
      high:           d.h,
      low:            d.l,
      previous_close: d.pc,
      change:         +(d.c - d.pc).toFixed(6),
      change_pct:     changePct,
      timestamp:      d.t ? new Date(d.t * 1000).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    console.error('[MarketData] Finnhub quote error:', err.message);
    return null;
  }
}

// ── 2. News sentiment from Finnhub ────────────────────────────────────────────
async function getMarketSentiment(symbol) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await axios.get('https://finnhub.io/api/v1/news-sentiment', {
      params: { symbol: toFinnhubSymbol(symbol), token: FINNHUB_KEY },
      timeout: 6000,
    });
    const { buzz, sentiment } = res.data || {};
    return {
      source:          'finnhub',
      buzz_score:      buzz?.buzz           || 0,
      bullish_pct:     sentiment?.bullishPercent || 50,
      bearish_pct:     sentiment?.bearishPercent || 50,
      sentiment_score: sentiment
        ? sentiment.bullishPercent - sentiment.bearishPercent
        : 0,
    };
  } catch (err) {
    console.error('[MarketData] Finnhub sentiment error:', err.message);
    return null;
  }
}

// ── 3. Latest forex news from NewsData.io ────────────────────────────────────
async function getForexNews(symbol) {
  if (!NEWSDATA_KEY) {
    console.warn('[MarketData] NEWSDATA_API_KEY not set — skipping news');
    return null;
  }
  try {
    const currencies = symbol.replace('/', ' ');
    const res = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        apikey:   NEWSDATA_KEY,
        q:        `forex ${currencies}`,
        language: 'en',
        category: 'business',
        size:     5,
      },
      timeout: 8000,
    });
    const articles = (res.data.results || []).slice(0, 5).map((a) => ({
      title:       a.title,
      description: a.description ? a.description.slice(0, 150) : '',
      source:      a.source_id,
      published:   a.pubDate,
      sentiment:   analyzeSentiment(`${a.title} ${a.description || ''}`),
    }));
    return { source: 'newsdata', articles };
  } catch (err) {
    console.error('[MarketData] NewsData error:', err.message);
    return null;
  }
}

// ── 4. Prediction market sentiment from Polymarket ───────────────────────────
async function getPolymarketSentiment() {
  if (!POLYMARKET_KEY) {
    console.warn('[MarketData] POLYMARKET_API_KEY not set — skipping Polymarket');
    return null;
  }
  try {
    const res = await axios.get('https://clob.polymarket.com/markets', {
      headers: { Authorization: `Bearer ${POLYMARKET_KEY}` },
      params:  { limit: 10, active: true, tag: 'finance' },
      timeout: 8000,
    });
    const markets = (res.data.data || []).slice(0, 5).map((m) => ({
      question:  m.question,
      yes_price: m.tokens?.find((t) => t.outcome === 'Yes')?.price || 0,
      no_price:  m.tokens?.find((t) => t.outcome === 'No')?.price  || 0,
      volume:    m.volume,
    }));
    return { source: 'polymarket', prediction_markets: markets };
  } catch (err) {
    console.error('[MarketData] Polymarket error:', err.message);
    return null;
  }
}

// ── 5. Keyword sentiment scorer for news headlines ────────────────────────────
function analyzeSentiment(text) {
  const t = text.toLowerCase();
  const bullish = ['rise', 'rally', 'surge', 'gain', 'bullish', 'up', 'strong', 'buy', 'growth', 'positive', 'high'];
  const bearish = ['fall', 'drop', 'decline', 'lose', 'bearish', 'down', 'weak', 'sell', 'crash', 'negative', 'low'];
  let score = 0;
  bullish.forEach((w) => { if (t.includes(w)) score++; });
  bearish.forEach((w) => { if (t.includes(w)) score--; });
  if (score > 0)  return 'BULLISH';
  if (score < 0)  return 'BEARISH';
  return 'NEUTRAL';
}

// ── 6. Master function — fetch ALL market data for a symbol ───────────────────
async function getAllMarketData(symbol) {
  const [quoteRes, sentimentRes, newsRes, polymarketRes] = await Promise.allSettled([
    getLiveQuote(symbol),
    getMarketSentiment(symbol),
    getForexNews(symbol),
    getPolymarketSentiment(),
  ]);

  return {
    symbol,
    timestamp:  new Date().toISOString(),
    quote:      quoteRes.status      === 'fulfilled' ? quoteRes.value      : null,
    sentiment:  sentimentRes.status  === 'fulfilled' ? sentimentRes.value  : null,
    news:       newsRes.status       === 'fulfilled' ? newsRes.value       : null,
    polymarket: polymarketRes.status === 'fulfilled' ? polymarketRes.value : null,
  };
}

module.exports = { getAllMarketData, getLiveQuote, getForexNews };
