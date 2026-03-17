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

  // Generate predictions for all symbols sequentially to avoid Groq rate limits
  const signals = [];
  for (let i = 0; i < VALID_SYMBOLS.length; i++) {
    const symbol = VALID_SYMBOLS[i];
    try {
      const pred = await generateMultiAIPrediction(symbol, '1h');
      signals.push({ symbol, ...pred });
    } catch {
      signals.push({
        symbol,
        setup:         false,
        direction:     'NEUTRAL',
        confidence:    0,
        entry_price:   null,
        stop_loss:     null,
        take_profit_1: null,
        take_profit_2: null,
        reason:        'Analysis unavailable',
      });
    }
    // Wait 2 seconds between each pair to avoid provider rate limits
    if (i < VALID_SYMBOLS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

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
