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

/**
 * Verifies the Bearer JWT and requires the user to be an admin.
 * Always re-checks is_admin and is_blocked from the database so that
 * stale tokens or revoked admin rights are caught immediately.
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Always re-check from database — do not trust token payload alone
    const { rows } = await pool.query(
      'SELECT id, email, is_admin, is_blocked FROM users WHERE id = $1',
      [decoded.id || decoded.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (rows[0].is_blocked) {
      return res.status(403).json({ error: 'Account blocked' });
    }
    if (!rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error('[Auth] requireAdmin error:', err.message);
    return res.status(500).json({ error: 'Auth check failed' });
  }
}

module.exports = authMiddleware;
// Also export requireAdmin as a named property for routes that need admin-only access
module.exports.requireAdmin = requireAdmin;
