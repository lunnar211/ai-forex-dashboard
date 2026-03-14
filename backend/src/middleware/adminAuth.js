'use strict';

const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer JWT and requires the user to be an admin.
 * Returns 401 when the token is missing/invalid, 403 when the user is not admin.
 */
function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

module.exports = adminAuthMiddleware;
