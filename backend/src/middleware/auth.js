'use strict';

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Verifies the Bearer JWT in the Authorization header, checks that the user
 * is still active (not blocked) in the database, and attaches the decoded
 * payload plus live status flags to req.user.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check token blacklist (populated on logout when Redis is available)
    const redis = req.app.locals.redis;
    if (redis) {
      try {
        const blacklisted = await redis.get(`blacklist:${token}`);
        if (blacklisted) {
          return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
        }
      } catch {
        // Redis failure is non-fatal — continue without blacklist check
      }
    }

    // Verify user still exists and is not blocked/restricted
    const result = await pool.query(
      'SELECT is_blocked, is_restricted FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found. Please log in again.' });
    }

    const { is_blocked, is_restricted } = result.rows[0];

    if (is_blocked) {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    req.user = { ...decoded, is_restricted: Boolean(is_restricted) };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

module.exports = authMiddleware;
