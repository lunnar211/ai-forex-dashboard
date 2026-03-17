'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe, logout, sendVerify, verifyEmail, forgotPassword, resetPassword, cookieConsent } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

const emailRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many email requests. Please try again later.' },
});

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', authRateLimiter, authMiddleware, getMe);
router.post('/logout', authRateLimiter, authMiddleware, logout);

// Email verification
router.post('/send-verify', emailRateLimiter, sendVerify);
router.post('/verify-email', authRateLimiter, verifyEmail);

// Password reset
router.post('/forgot-password', emailRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

// Cookie consent (authenticated)
router.post('/cookies-consent', authRateLimiter, authMiddleware, cookieConsent);

module.exports = router;
