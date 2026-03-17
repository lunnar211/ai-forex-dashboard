'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const { generateMultiAIPrediction } = require('../services/multiAIEngine');

const CACHE_TTL = 55 * 60; // 55 minutes in seconds

const VALID_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD',
  'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY',
  'GBP/JPY', 'XAG/USD',
];

const signalsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many live signal requests. Please wait.' },
});

/**
 * GET /signals/live
 * Generates AI predictions for all 12 valid symbols simultaneously.
 * Results are cached in Redis for 55 minutes.
 */
router.get('/live', signalsRateLimiter, authMiddleware, async (req, res) => {
  const redis = req.app.locals.redis;
  const cacheKey = 'signals:live:all';

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({ ...parsed, fromCache: true });
      }
    } catch {
      // Cache miss — proceed to generate
    }
  }

  // Generate predictions for all symbols in parallel
  const results = await Promise.allSettled(
    VALID_SYMBOLS.map((symbol) =>
      generateMultiAIPrediction(symbol, '1h').then((pred) => ({ symbol, ...pred }))
    )
  );

  const signals = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // On failure return a minimal placeholder so the array stays 12 items
    return {
      symbol: VALID_SYMBOLS[i],
      direction: 'NEUTRAL',
      confidence: 0,
      entry_price: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      error: result.reason?.message || 'Generation failed',
    };
  });

  const payload = { signals, generatedAt: new Date().toISOString() };

  // Store in Redis cache
  if (redis) {
    try {
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    } catch {
      // Non-fatal — just skip caching
    }
  }

  return res.json({ ...payload, fromCache: false });
});

module.exports = router;
