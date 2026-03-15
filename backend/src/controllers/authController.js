'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { extractIP, parseUserAgent, geoLookup } = require('../services/geoService');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: Boolean(user.is_admin) },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// POST /auth/register
async function register(req, res) {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    // Check for existing user
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const trimmedName = name ? name.trim().slice(0, 255) : null;
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email.toLowerCase(), hashed, trimmedName]
    );

    const user = result.rows[0];
    const token = signToken(user);

    // Log registration activity with geo data (non-blocking)
    const regIP = extractIP(req);
    const regUA = req.headers['user-agent'] || null;
    const { device_type, browser, os } = parseUserAgent(regUA);
    const redis = req.app.locals.redis;
    geoLookup(regIP, redis).then((geo) => {
      pool.query(
        `INSERT INTO user_activity
           (user_id, action, ip_address, country, country_code, city, region, isp,
            latitude, longitude, user_agent, device_type, browser, os)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [user.id, 'register', regIP, geo.country, geo.country_code, geo.city,
         geo.region, geo.isp, geo.latitude, geo.longitude, regUA, device_type, browser, os]
      ).catch((err) => console.error('[Auth] Failed to log registration activity:', err.message));
    }).catch(() => {});

    // Update last_active (non-blocking)
    pool.query(
      'UPDATE users SET last_active = NOW() WHERE id = $1',
      [user.id]
    ).catch((err) => console.error('[Auth] Failed to update last_active:', err.message));

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
    });
  } catch (err) {
    console.error('[AuthController] register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

// POST /auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password, name, is_admin, is_blocked, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    const token = signToken(user);

    // Log login activity with geo data (non-blocking)
    const loginIP = extractIP(req);
    const loginUA = req.headers['user-agent'] || null;
    const { device_type: dt, browser: br, os: osName } = parseUserAgent(loginUA);
    const redis = req.app.locals.redis;
    geoLookup(loginIP, redis).then((geo) => {
      pool.query(
        `INSERT INTO user_activity
           (user_id, action, ip_address, country, country_code, city, region, isp,
            latitude, longitude, user_agent, device_type, browser, os)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [user.id, 'login', loginIP, geo.country, geo.country_code, geo.city,
         geo.region, geo.isp, geo.latitude, geo.longitude, loginUA, dt, br, osName]
      ).catch((err) => console.error('[Auth] Failed to log login activity:', err.message));
    }).catch(() => {});

    // Update last_active (non-blocking)
    pool.query(
      'UPDATE users SET last_active = NOW() WHERE id = $1',
      [user.id]
    ).catch((err) => console.error('[Auth] Failed to update last_active:', err.message));

    return res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: Boolean(user.is_admin), createdAt: user.created_at },
    });
  } catch (err) {
    console.error('[AuthController] login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

// GET /auth/me  (requires auth middleware)
async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    return res.json({
      user: { id: user.id, email: user.email, name: user.name, isAdmin: Boolean(user.is_admin), createdAt: user.created_at },
    });
  } catch (err) {
    console.error('[AuthController] getMe error:', err.message);
    return res.status(500).json({ error: 'Could not retrieve user information.' });
  }
}

// POST /auth/logout  (requires auth middleware)
async function logout(req, res) {
  // If Redis is available, blacklist the token until it naturally expires.
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  // 'Bearer '.length === 7
  const token = authHeader ? authHeader.slice(7) : null;
  if (token && req.app.locals.redis) {
    try {
      // Determine remaining TTL from the decoded token
      const decoded = require('jsonwebtoken').decode(token);
      const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 3600;
      if (ttl > 0) {
        await req.app.locals.redis.setEx(`blacklist:${token}`, ttl, '1');
      }
    } catch (err) {
      console.warn('[Auth] Failed to blacklist token on logout:', err.message);
    }
  }
  return res.json({ message: 'Logged out successfully.' });
}

module.exports = { register, login, getMe, logout };
