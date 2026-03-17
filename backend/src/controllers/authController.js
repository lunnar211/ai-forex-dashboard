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

// POST /auth/send-verify — generate 6-digit code, save to DB, send email
async function sendVerify(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const { sendVerificationEmail, generateCode } = require('../services/emailService');
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      // Don't reveal whether the email exists
      return res.json({ message: 'If an account exists, a verification code has been sent.' });
    }
    const userId = result.rows[0].id;
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'UPDATE users SET verify_code = $1, verify_code_expires = $2 WHERE id = $3',
      [code, expires, userId]
    );

    await pool.query(
      'INSERT INTO email_logs (user_id, type, email) VALUES ($1, $2, $3)',
      [userId, 'verify', email.toLowerCase()]
    ).catch(() => {});

    await sendVerificationEmail(email.toLowerCase(), code);
    return res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('[AuthController] sendVerify error:', err.message);
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
}

// POST /auth/verify-email — check code, mark email_verified = TRUE
async function verifyEmail(req, res) {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });

  try {
    const result = await pool.query(
      'SELECT id, verify_code, verify_code_expires FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or code.' });
    }
    const user = result.rows[0];
    if (!user.verify_code || user.verify_code !== code) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }
    if (new Date() > new Date(user.verify_code_expires)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, verify_code = NULL, verify_code_expires = NULL WHERE id = $1',
      [user.id]
    );
    return res.json({ message: 'Email verified successfully.' });
  } catch (err) {
    console.error('[AuthController] verifyEmail error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

// POST /auth/forgot-password — generate reset code, send email
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const { sendPasswordResetEmail, generateCode } = require('../services/emailService');
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists, a reset code has been sent.' });
    }
    const userId = result.rows[0].id;
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'UPDATE users SET reset_code = $1, reset_code_expires = $2 WHERE id = $3',
      [code, expires, userId]
    );

    await pool.query(
      'INSERT INTO email_logs (user_id, type, email) VALUES ($1, $2, $3)',
      [userId, 'reset', email.toLowerCase()]
    ).catch(() => {});

    await sendPasswordResetEmail(email.toLowerCase(), code);
    return res.json({ message: 'Password reset code sent to your email.' });
  } catch (err) {
    console.error('[AuthController] forgotPassword error:', err.message);
    return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
}

// POST /auth/reset-password — verify code, update password
async function resetPassword(req, res) {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, reset_code, reset_code_expires FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or code.' });
    }
    const user = result.rows[0];
    if (!user.reset_code || user.reset_code !== code) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }
    if (new Date() > new Date(user.reset_code_expires)) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2',
      [hashed, user.id]
    );
    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[AuthController] resetPassword error:', err.message);
    return res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
}

// POST /auth/cookies-consent — save cookie consent to database
async function cookieConsent(req, res) {
  const { accepted } = req.body;
  try {
    await pool.query(
      'UPDATE users SET cookies_accepted = $1, cookies_accepted_at = NOW() WHERE id = $2',
      [Boolean(accepted), req.user.id]
    );
    return res.json({ message: 'Cookie consent saved.' });
  } catch (err) {
    console.error('[AuthController] cookieConsent error:', err.message);
    return res.status(500).json({ error: 'Failed to save cookie consent.' });
  }
}

module.exports = { register, login, getMe, logout, sendVerify, verifyEmail, forgotPassword, resetPassword, cookieConsent };
