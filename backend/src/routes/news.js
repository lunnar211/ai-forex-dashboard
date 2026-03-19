'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DESC_LEN = 140;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Keyword map per symbol ────────────────────────────────────────────────────
const SYMBOL_KEYWORDS = {
  'EUR/USD':   'Euro EUR USD ECB Federal Reserve',
  'GBP/USD':   'British Pound GBP Bank of England',
  'USD/JPY':   'USD JPY Bank of Japan Yen',
  'AUD/USD':   'Australian Dollar AUD Reserve Bank Australia',
  'USD/CAD':   'USD CAD Bank of Canada oil',
  'USD/CHF':   'Swiss Franc CHF SNB',
  'NZD/USD':   'New Zealand Dollar NZD RBNZ',
  'EUR/GBP':   'Euro Pound ECB Bank of England',
  'EUR/JPY':   'Euro Yen ECB Japan',
  'GBP/JPY':   'British Pound Yen Bank of England Japan',
  'XAU/USD':   'Gold XAU precious metals inflation',
  'XAG/USD':   'Silver XAG precious metals',
  'XPT/USD':   'Platinum XPT precious metals',
  'XPD/USD':   'Palladium XPD precious metals',
  'BTC/USD':   'Bitcoin BTC cryptocurrency',
  'ETH/USD':   'Ethereum ETH crypto',
  'BNB/USD':   'Binance BNB cryptocurrency',
  'SOL/USD':   'Solana SOL crypto',
  'ADA/USD':   'Cardano ADA crypto',
  'XRP/USD':   'XRP Ripple cryptocurrency',
  'DOGE/USD':  'Dogecoin DOGE crypto',
  'AAPL':      'Apple AAPL stock earnings',
  'GOOGL':     'Google Alphabet GOOGL stock',
  'MSFT':      'Microsoft MSFT stock earnings',
  'TSLA':      'Tesla TSLA stock',
  'AMZN':      'Amazon AMZN stock',
  'NVDA':      'NVIDIA NVDA stock AI chips',
  'META':      'Meta Facebook META stock',
  'NFLX':      'Netflix NFLX stock',
  'AMD':       'AMD semiconductor stock',
  'INTC':      'Intel INTC semiconductor stock',
  'SPX':       'S&P 500 US stocks market',
  'DJI':       'Dow Jones US stocks market',
  'NDX':       'NASDAQ tech stocks',
  'OIL/USD':   'crude oil WTI OPEC energy',
  'NATGAS/USD':'natural gas energy prices',
};

// ── Simple sentiment scorer ───────────────────────────────────────────────────
const BULLISH_WORDS = ['rise','rises','surge','surges','gain','gains','bull','bullish','strong','beat','beats','rally','rallies','up','high','hawkish','growth','positive','boost','increase'];
const BEARISH_WORDS = ['fall','falls','drop','drops','decline','declines','bear','bearish','weak','miss','misses','crash','crashes','down','low','dovish','recession','negative','cut','decrease'];

function getSentiment(text) {
  const t = (text || '').toLowerCase();
  const bullCount = BULLISH_WORDS.filter((w) => t.includes(w)).length;
  const bearCount = BEARISH_WORDS.filter((w) => t.includes(w)).length;
  if (bullCount > bearCount) {
    return { label: 'BULLISH', score: bullCount - bearCount, color: '#00ff88', emoji: '🟢' };
  }
  if (bearCount > bullCount) {
    return { label: 'BEARISH', score: bearCount - bullCount, color: '#ff4444', emoji: '🔴' };
  }
  return { label: 'NEUTRAL', score: 0, color: '#aaaaaa', emoji: '⚪' };
}

// ── In-memory cache (5-min TTL) ───────────────────────────────────────────────
const cache = new Map();

// GET /news/forex?symbol=EURUSD  (or EUR/USD — normalised internally)
router.get('/forex', async (req, res) => {
  const rawSymbol = String(req.query.symbol || 'EUR/USD').toUpperCase();
  // Accept both "EURUSD" and "EUR/USD" formats
  const symbol = rawSymbol.includes('/')
    ? rawSymbol
    : rawSymbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');

  const cacheKey = symbol;
  if (cache.has(cacheKey)) {
    const { data, ts } = cache.get(cacheKey);
    if (Date.now() - ts < CACHE_TTL_MS) return res.json(data);
  }

  const keywords = SYMBOL_KEYWORDS[symbol] || 'forex trading markets';

  // ── Primary: NewsAPI ───────────────────────────────────────────────────────
  if (process.env.NEWSAPI_KEY) {
    try {
      const r = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q:        keywords,
          language: 'en',
          sortBy:   'publishedAt',
          pageSize: 8,
          from:     new Date(Date.now() - ONE_DAY_MS).toISOString(),
        },
        headers: { 'X-Api-Key': process.env.NEWSAPI_KEY },
        timeout: 8000,
      });

      const articles = (r.data.articles || [])
        .filter((a) => a.title && !a.title.includes('[Removed]'))
        .map((a) => ({
          title:       a.title,
          description: a.description ? a.description.slice(0, MAX_DESC_LEN) : undefined,
          url:         a.url,
          source:      a.source?.name,
          published:   a.publishedAt,
          sentiment:   getSentiment(a.title + ' ' + (a.description || '')).label,
        }));

      const bullCount = articles.filter((a) => a.sentiment === 'BULLISH').length;
      const bearCount = articles.filter((a) => a.sentiment === 'BEARISH').length;
      const overallScore = bullCount - bearCount;
      const overall =
        overallScore > 1 ? 'BULLISH' : overallScore < -1 ? 'BEARISH' : 'MIXED';

      const result = {
        symbol,
        articles,
        overall_sentiment: overall,
        sentiment_score:   overallScore,
        count:             articles.length,
        source:            'newsapi',
      };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.json(result);
    } catch (err) {
      console.warn('[News] NewsAPI failed:', err.message);
      // fall through to newsdata.io
    }
  }

  // ── Fallback: newsdata.io ──────────────────────────────────────────────────
  if (process.env.NEWSDATA_KEY || process.env.NEWSDATA_API_KEY) {
    try {
      const key = process.env.NEWSDATA_KEY || process.env.NEWSDATA_API_KEY;
      const r2 = await axios.get('https://newsdata.io/api/1/news', {
        params: { apikey: key, q: keywords, language: 'en', size: 6 },
        timeout: 8000,
      });

      const articles = (r2.data.results || []).map((a) => ({
        title:     a.title,
        description: a.description ? a.description.slice(0, MAX_DESC_LEN) : undefined,
        url:       a.link,
        source:    a.source_id,
        published: a.pubDate,
        sentiment: getSentiment(a.title + ' ' + (a.description || '')).label,
      }));

      const bullCount = articles.filter((a) => a.sentiment === 'BULLISH').length;
      const bearCount = articles.filter((a) => a.sentiment === 'BEARISH').length;
      const overallScore = bullCount - bearCount;
      const overall =
        overallScore > 1 ? 'BULLISH' : overallScore < -1 ? 'BEARISH' : 'MIXED';

      const result = {
        symbol,
        articles,
        overall_sentiment: overall,
        sentiment_score:   overallScore,
        count:             articles.length,
        source:            'newsdata',
      };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.json(result);
    } catch (err) {
      console.warn('[News] newsdata.io failed:', err.message);
    }
  }

  // ── No API keys or all sources failed ────────────────────────────────────
  return res.status(503).json({
    error:             'News unavailable — set NEWSAPI_KEY or NEWSDATA_KEY in environment.',
    articles:          [],
    symbol,
    overall_sentiment: 'NEUTRAL',
    sentiment_score:   0,
    count:             0,
  });
});

module.exports = router;
