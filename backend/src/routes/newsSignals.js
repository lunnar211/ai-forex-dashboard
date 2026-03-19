'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DESC_LEN = 200;

// ── Sentiment word lists ───────────────────────────────────────────────────────
const BULLISH_WORDS = [
  'rise', 'rises', 'surge', 'surges', 'gain', 'gains', 'bull', 'bullish',
  'strong', 'beat', 'beats', 'rally', 'rallies', 'up', 'high', 'hawkish',
  'growth', 'positive', 'boost', 'increase', 'buy', 'record', 'higher',
];
const BEARISH_WORDS = [
  'fall', 'falls', 'drop', 'drops', 'decline', 'declines', 'bear', 'bearish',
  'weak', 'miss', 'misses', 'crash', 'crashes', 'down', 'low', 'dovish',
  'recession', 'negative', 'cut', 'decrease', 'sell', 'loss', 'lower',
];

function getSentiment(text) {
  const t = (text || '').toLowerCase();
  const bull = BULLISH_WORDS.filter((w) => t.includes(w)).length;
  const bear = BEARISH_WORDS.filter((w) => t.includes(w)).length;
  if (bull > bear) return { label: 'BULLISH', emoji: '🟢' };
  if (bear > bull) return { label: 'BEARISH', emoji: '🔴' };
  return { label: 'NEUTRAL', emoji: '⚪' };
}

// ── Detect trading pair from article text ─────────────────────────────────────
function detectPair(text) {
  const t = (text || '').toLowerCase();
  if (/\b(euro|eur\b|ecb)\b/.test(t) && !/\b(pound|gbp|yen|jpy)\b/.test(t)) return 'EUR/USD';
  if (/\b(pound|gbp|boe|bank of england)\b/.test(t)) return 'GBP/USD';
  if (/\b(gold|xau)\b/.test(t)) return 'XAU/USD';
  if (/\b(bitcoin|btc|crypto|cryptocurrency)\b/.test(t)) return 'BTC/USD';
  if (/\b(yen|jpy|boj|bank of japan)\b/.test(t)) return 'USD/JPY';
  if (/\b(fed|federal reserve|dollar|usd)\b/.test(t)) return 'EUR/USD';
  return 'EUR/USD';
}

// ── In-memory cache ───────────────────────────────────────────────────────────
const cache = new Map();
let lastSuccessfulData = null;

function truncateAtWord(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

function mapArticle(a, sourceType) {
  const title = a.title || '';
  const description = sourceType === 'newsapi'
    ? (a.description || '')
    : (a.description || a.content || '');
  const combined = title + ' ' + description;
  const sentiment = getSentiment(combined);
  const pair = detectPair(combined);

  return {
    id: a.url || a.link || `${Date.now()}-${Math.random()}`,
    title,
    description: truncateAtWord(description, MAX_DESC_LEN),
    url: sourceType === 'newsapi' ? a.url : (a.link || a.url || ''),
    source: sourceType === 'newsapi' ? (a.source?.name || 'Unknown') : (a.source_id || 'Unknown'),
    publishedAt: sourceType === 'newsapi' ? a.publishedAt : a.pubDate,
    sentiment: sentiment.label,
    sentimentEmoji: sentiment.emoji,
    pair,
  };
}

// GET /news/world-signals
router.get('/world-signals', async (req, res) => {
  const cacheKey = 'world-signals';

  // Return cached data if still fresh
  if (cache.has(cacheKey)) {
    const { data, ts } = cache.get(cacheKey);
    if (Date.now() - ts < CACHE_TTL_MS) {
      return res.json({ ...data, fromCache: true });
    }
  }

  // ── Primary: NewsAPI ───────────────────────────────────────────────────────
  if (process.env.NEWSAPI_KEY) {
    try {
      const r = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q:        'forex OR gold OR bitcoin OR stocks OR "interest rate" OR "central bank"',
          language: 'en',
          sortBy:   'publishedAt',
          pageSize: 20,
        },
        headers: { 'X-Api-Key': process.env.NEWSAPI_KEY },
        timeout: 8000,
      });

      const articles = (r.data.articles || [])
        .filter((a) => a.title && !a.title.includes('[Removed]'))
        .map((a) => mapArticle(a, 'newsapi'));

      const result = { articles, count: articles.length, source: 'newsapi' };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      lastSuccessfulData = result;
      return res.json(result);
    } catch (err) {
      console.warn('[NewsSignals] NewsAPI failed:', err.message);
    }
  }

  // ── Fallback: newsdata.io ──────────────────────────────────────────────────
  const newsdataKey = process.env.NEWSDATA_KEY || process.env.NEWSDATA_API_KEY;
  if (newsdataKey) {
    try {
      const r2 = await axios.get('https://newsdata.io/api/1/news', {
        params: {
          apikey:   newsdataKey,
          q:        'forex OR gold OR bitcoin OR stocks',
          language: 'en',
          size:     20,
        },
        timeout: 8000,
      });

      const articles = (r2.data.results || []).map((a) => mapArticle(a, 'newsdata'));

      const result = { articles, count: articles.length, source: 'newsdata' };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      lastSuccessfulData = result;
      return res.json(result);
    } catch (err) {
      console.warn('[NewsSignals] newsdata.io failed:', err.message);
    }
  }

  // ── Return last cached data if both fail ─────────────────────────────────
  if (lastSuccessfulData) {
    return res.json({ ...lastSuccessfulData, fromCache: true, stale: true });
  }

  return res.status(503).json({
    error: 'News unavailable — set NEWSAPI_KEY or NEWSDATA_KEY in environment.',
    articles: [],
    count: 0,
  });
});

module.exports = router;
