'use strict';

const { fetchOHLCV, fetchLivePrice } = require('../services/forexService');
const { pool } = require('../config/database');

const CACHE_TTL = 60; // seconds

// Map symbols to their trading category
function getSymbolCategory(symbol) {
  const s = symbol.toUpperCase();
  if (['XAU/USD', 'XAG/USD'].includes(s)) return 'metals';
  if (['BTC/USD', 'ETH/USD', 'BNB/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD'].includes(s)) return 'crypto';
  if (['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'].includes(s)) return 'stocks';
  if (['SPX', 'DJI', 'NDX', 'FTSE', 'DAX', 'NKY'].includes(s)) return 'indices';
  if (['OIL/USD', 'NATGAS/USD', 'WHEAT/USD', 'CORN/USD'].includes(s)) return 'commodities';
  // Default: forex
  return 'forex';
}

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

    // Log market_view activity and update last_active (non-blocking)
    if (req.user) {
      const category = getSymbolCategory(symbol);
      pool.query(
        'INSERT INTO user_activity (user_id, action, ip_address, metadata) VALUES ($1, $2, $3, $4)',
        [req.user.id, 'market_view', req.ip || null,
          JSON.stringify({ symbol, category, interval })]
      ).catch((err) => console.error('[Forex] Failed to log market_view:', err.message));

      pool.query(
        'UPDATE users SET last_active = NOW() WHERE id = $1',
        [req.user.id]
      ).catch((err) => console.error('[Forex] Failed to update last_active:', err.message));
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
