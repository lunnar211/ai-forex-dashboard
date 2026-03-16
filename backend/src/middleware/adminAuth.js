'use strict';

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Verifies the Bearer JWT and requires the user to be an admin.
 * Always re-checks is_admin and is_blocked from the database so that
 * stale tokens or revoked admin rights are caught immediately.
 * Returns 401 when the token is missing/invalid, 403 when the user is
 * not admin or is blocked.
 */
async function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Always re-check from database — do not trust token payload alone
    const { rows } = await pool.query(
      'SELECT id, email, is_admin, is_blocked FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not found. Please log in again.' });
    }

    if (rows[0].is_blocked) {
      return res.status(403).json({ error: 'Account blocked.' });
    }

    if (!rows[0].is_admin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    req.user = { ...decoded, ...rows[0] };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

module.exports = adminAuthMiddleware;
