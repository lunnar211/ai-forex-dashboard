'use strict';

const express      = require('express');
const rateLimit    = require('express-rate-limit');
const router       = express.Router();
const authMiddleware = require('../middleware/auth');
const { getLiveQuote, getForexNews } = require('../services/marketDataService');

const marketRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// GET /api/market/quote?symbol=EUR/USD
router.get('/quote', marketRateLimiter, authMiddleware, async (req, res) => {
  try {
    const { symbol = 'EUR/USD' } = req.query;
    const quote = await getLiveQuote(symbol);
    if (!quote) {
      return res.status(503).json({ success: false, error: 'Live quote unavailable (FINNHUB_API_KEY not set or API error).' });
    }
    return res.json({ success: true, data: quote });
  } catch (err) {
    console.error('[Market] /quote error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/news?symbol=EUR/USD
router.get('/news', marketRateLimiter, authMiddleware, async (req, res) => {
  try {
    const { symbol = 'EUR/USD' } = req.query;
    const news = await getForexNews(symbol);
    if (!news) {
      return res.status(503).json({ success: false, error: 'News feed unavailable (NEWSDATA_API_KEY not set or API error).' });
    }
    return res.json({ success: true, data: news });
  } catch (err) {
    console.error('[Market] /news error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
