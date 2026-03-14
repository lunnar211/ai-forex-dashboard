'use strict';

const { fetchOHLCV, fetchLivePrice } = require('../services/forexService');

const CACHE_TTL = 60; // seconds

function getCacheKey(type, symbol, interval) {
  return `forex:${type}:${symbol}:${interval || 'live'}`;
}

// GET /forex/prices?symbol=EUR/USD&interval=1h&outputsize=100
async function getPrices(req, res) {
  const { symbol = 'EUR/USD', interval = '1h', outputsize = 100 } = req.query;
  const size = Math.min(Math.max(parseInt(outputsize, 10) || 100, 1), 500);
  const cacheKey = getCacheKey('ohlcv', symbol, interval);

  try {
    // Try Redis cache
    if (req.app.locals.redis) {
      const cached = await req.app.locals.redis.get(cacheKey);
      if (cached) {
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }
    }

    const { candles, isMock } = await fetchOHLCV(symbol, interval, size);

    const payload = { symbol, interval, candles, isMock, timestamp: new Date().toISOString() };

    // Store in Redis
    if (req.app.locals.redis) {
      await req.app.locals.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    }

    return res.json(payload);
  } catch (err) {
    console.error('[ForexController] getPrices error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch price data.' });
  }
}

// GET /forex/live?symbol=EUR/USD
async function getLivePrice(req, res) {
  const { symbol = 'EUR/USD' } = req.query;
  const cacheKey = getCacheKey('live', symbol, null);

  try {
    if (req.app.locals.redis) {
      const cached = await req.app.locals.redis.get(cacheKey);
      if (cached) {
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }
    }

    const { price, isMock } = await fetchLivePrice(symbol);
    const payload = { symbol, price, isMock, timestamp: new Date().toISOString() };

    if (req.app.locals.redis) {
      await req.app.locals.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    }

    return res.json(payload);
  } catch (err) {
    console.error('[ForexController] getLivePrice error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch live price.' });
  }
}

module.exports = { getPrices, getLivePrice };
