'use strict';

const express = require('express');
const router = express.Router();
const { predict, getHistory, getSignals } = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Strict limiter for the prediction endpoint (expensive AI calls)
const predictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many prediction requests. Please try again later.' },
});

// Lighter limiter for read endpoints
const readRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

router.post('/predict', predictRateLimiter, authMiddleware, predict);
router.get('/history', readRateLimiter, authMiddleware, getHistory);
router.get('/signals', readRateLimiter, authMiddleware, getSignals);

module.exports = router;
