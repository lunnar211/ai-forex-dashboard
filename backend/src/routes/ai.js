'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { predict, getHistory, getSignals, analyzeImage, analyzeAdvanced } = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Multer: store in memory, max 10 MB per image
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

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
router.post('/analyze-advanced', predictRateLimiter, authMiddleware, analyzeAdvanced);
router.get('/history', readRateLimiter, authMiddleware, getHistory);
router.get('/signals', readRateLimiter, authMiddleware, getSignals);
router.post('/analyze-image', predictRateLimiter, authMiddleware, upload.single('image'), analyzeImage);

module.exports = router;
