'use strict';

const express = require('express');
const router = express.Router();
const { getStatus } = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// GET /admin/status — requires authentication; shows which keys are configured (never exposes values)
router.get('/status', adminRateLimiter, authMiddleware, getStatus);

module.exports = router;
