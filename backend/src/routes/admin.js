'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  adminLogin,
  listUsers,
  createUser,
  deleteUser,
  getStats,
  getActivity,
  blockUser,
  unblockUser,
  getAnalytics,
  getOnlineUsers,
  getUserDetails,
  restrictUser,
  unrestrictUser,
  getPredictions,
  getSecurityEvents,
} = require('../controllers/adminController');
const adminAuthMiddleware = require('../middleware/adminAuth');

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

router.post('/login', loginRateLimiter, adminLogin);
router.get('/users', adminRateLimiter, adminAuthMiddleware, listUsers);
router.post('/users', adminRateLimiter, adminAuthMiddleware, createUser);
router.get('/users/:id', adminRateLimiter, adminAuthMiddleware, getUserDetails);
router.delete('/users/:id', adminRateLimiter, adminAuthMiddleware, deleteUser);
router.patch('/users/:id/block', adminRateLimiter, adminAuthMiddleware, blockUser);
router.patch('/users/:id/unblock', adminRateLimiter, adminAuthMiddleware, unblockUser);
router.patch('/users/:id/restrict', adminRateLimiter, adminAuthMiddleware, restrictUser);
router.patch('/users/:id/unrestrict', adminRateLimiter, adminAuthMiddleware, unrestrictUser);
router.get('/stats', adminRateLimiter, adminAuthMiddleware, getStats);
router.get('/activity', adminRateLimiter, adminAuthMiddleware, getActivity);
router.get('/analytics', adminRateLimiter, adminAuthMiddleware, getAnalytics);
router.get('/online-users', adminRateLimiter, adminAuthMiddleware, getOnlineUsers);
router.get('/predictions', adminRateLimiter, adminAuthMiddleware, getPredictions);
router.get('/security', adminRateLimiter, adminAuthMiddleware, getSecurityEvents);

module.exports = router;
