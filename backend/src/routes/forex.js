'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getPrices, getLivePrice } = require('../controllers/forexController');
const authMiddleware = require('../middleware/auth');

const forexRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

router.get('/prices', forexRateLimiter, authMiddleware, getPrices);
router.get('/live', forexRateLimiter, authMiddleware, getLivePrice);

module.exports = router;
