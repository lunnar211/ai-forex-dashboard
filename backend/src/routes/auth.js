'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', authRateLimiter, authMiddleware, getMe);

module.exports = router;
