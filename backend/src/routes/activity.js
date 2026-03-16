'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const { trackActivity, ping } = require('../controllers/activityController');

const activityRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many activity events. Please slow down.' },
});

const pingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ping requests. Please slow down.' },
});

router.post('/', activityRateLimiter, authMiddleware, trackActivity);
router.post('/ping', pingRateLimiter, authMiddleware, ping);

module.exports = router;
