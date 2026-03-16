'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '7d';

function signAdminToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: true },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Constant-time string comparison to defend against timing attacks.
 * Returns false for mismatched lengths without leaking length information.
 */
function safeEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// POST /admin/login
async function adminLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const envEmail = process.env.ADMIN_EMAIL || '';
  const envPassword = process.env.ADMIN_PASSWORD || '';
  const envCredentialsMatch =
    envEmail &&
    envPassword &&
    safeEqual(email.toLowerCase(), envEmail.toLowerCase()) &&
    safeEqual(password, envPassword);

  try {
    const result = await pool.query(
      'SELECT id, email, password, name, is_admin FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // If user does not exist yet, attempt env-var bootstrap before giving up.
    if (result.rows.length === 0) {
      if (envCredentialsMatch) {
        // Seed the admin user now and log them in.
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        const inserted = await pool.query(
          'INSERT INTO users (email, password, name, is_admin) VALUES ($1, $2, $3, TRUE) RETURNING id, email, name',
          [email.toLowerCase(), hashed, 'Admin']
        );
        const newUser = inserted.rows[0];
        const token = signAdminToken(newUser);
        return res.json({
          message: 'Admin login successful.',
          token,
          user: { id: newUser.id, email: newUser.email, name: newUser.name, isAdmin: true },
        });
      }

      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_admin) {
      // The user exists but was never promoted to admin (e.g. registered before
      // ADMIN_EMAIL/ADMIN_PASSWORD env vars were set).  If the submitted
      // credentials match the env-var admin, promote them now and log them in.
      if (envCredentialsMatch) {
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query(
          'UPDATE users SET is_admin = TRUE, password = $2 WHERE email = $1',
          [email.toLowerCase(), hashed]
        );
        const token = signAdminToken(user);
        return res.json({
          message: 'Admin login successful.',
          token,
          user: { id: user.id, email: user.email, name: user.name, isAdmin: true },
        });
      }

      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Fallback: if plain-text matches the env-var password (e.g. password
      // contains $$ or was stored with a different hash cost), rehash and sync.
      if (envCredentialsMatch) {
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query(
          'UPDATE users SET is_admin = TRUE, password = $2, is_blocked = FALSE WHERE email = $1',
          [email.toLowerCase(), hashed]
        );
        const token = signAdminToken(user);
        return res.json({
          message: 'Admin login successful.',
          token,
          user: { id: user.id, email: user.email, name: user.name, isAdmin: true },
        });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signAdminToken(user);

    return res.json({
      message: 'Admin login successful.',
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: true },
    });
  } catch (err) {
    console.error('[AdminController] adminLogin error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

// GET /admin/users
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, is_blocked, is_restricted, last_active, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('[AdminController] listUsers error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve users.' });
  }
}

// POST /admin/users
async function createUser(req, res) {
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
    return res.status(201).json({
      message: 'User created successfully.',
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
    });
  } catch (err) {
    console.error('[AdminController] createUser error:', err.message);
    return res.status(500).json({ error: 'Failed to create user. Please try again.' });
  }
}

// DELETE /admin/users/:id
async function deleteUser(req, res) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  // Prevent deleting the admin account
  if (parsedId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own admin account.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND is_admin = FALSE RETURNING id',
      [parsedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or cannot delete admin accounts.' });
    }

    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('[AdminController] deleteUser error:', err.message);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
}

// GET /admin/stats
async function getStats(req, res) {
  try {
    const [usersResult, predictionsResult, activeResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM users WHERE is_admin = FALSE'),
      pool.query('SELECT COUNT(*) AS total FROM predictions'),
      pool.query(
        `SELECT COUNT(DISTINCT user_id) AS total
         FROM user_activity
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      ),
    ]);

    return res.json({
      totalUsers: parseInt(usersResult.rows[0].total, 10),
      totalPredictions: parseInt(predictionsResult.rows[0].total, 10),
      activeUsersLast24h: parseInt(activeResult.rows[0].total, 10),
    });
  } catch (err) {
    console.error('[AdminController] getStats error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
}

// GET /admin/activity
async function getActivity(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const action = req.query.action || null;

  // Whitelist allowed action values to prevent unintended filtering
  const ALLOWED_ACTIVITY_ACTIONS = new Set([
    'login', 'register', 'logout', 'page_view', 'symbol_view',
    'timeframe_change', 'tool_use', 'market_view',
    'prediction_request', 'prediction_result', 'image_upload',
  ]);
  if (action && !ALLOWED_ACTIVITY_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'Invalid action filter.' });
  }

  try {
    const params = [limit];
    const actionFilter = action ? 'AND ua.action = $2' : '';
    if (action) params.push(action);

    const result = await pool.query(
      `SELECT ua.id, ua.action, ua.ip_address, ua.user_agent, ua.metadata, ua.created_at,
              u.id AS user_id, u.email, u.name
       FROM user_activity ua
       JOIN users u ON u.id = ua.user_id
       WHERE true ${actionFilter}
       ORDER BY ua.created_at DESC
       LIMIT $1`,
      params
    );

    return res.json({ activity: result.rows });
  } catch (err) {
    console.error('[AdminController] getActivity error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve activity.' });
  }
}

// PATCH /admin/users/:id/block
async function blockUser(req, res) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  if (parsedId === req.user.id) {
    return res.status(400).json({ error: 'Cannot block your own admin account.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET is_blocked = TRUE WHERE id = $1 AND is_admin = FALSE RETURNING id, email',
      [parsedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or cannot block admin accounts.' });
    }

    return res.json({ message: 'User blocked successfully.' });
  } catch (err) {
    console.error('[AdminController] blockUser error:', err.message);
    return res.status(500).json({ error: 'Failed to block user.' });
  }
}

// PATCH /admin/users/:id/unblock
async function unblockUser(req, res) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  if (parsedId === req.user.id) {
    return res.status(400).json({ error: 'Cannot unblock your own admin account.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET is_blocked = FALSE WHERE id = $1 AND is_admin = FALSE RETURNING id, email',
      [parsedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or cannot unblock admin accounts.' });
    }

    return res.json({ message: 'User unblocked successfully.' });
  } catch (err) {
    console.error('[AdminController] unblockUser error:', err.message);
    return res.status(500).json({ error: 'Failed to unblock user.' });
  }
}

// GET /admin/analytics
async function getAnalytics(req, res) {
  try {
    const [marketResult, toolResult] = await Promise.all([
      pool.query(`
        SELECT
          metadata->>'symbol' AS symbol,
          metadata->>'category' AS category,
          COUNT(*) AS views,
          COUNT(DISTINCT user_id) AS unique_users
        FROM user_activity
        WHERE action = 'market_view' AND metadata IS NOT NULL
        GROUP BY metadata->>'symbol', metadata->>'category'
        ORDER BY views DESC
        LIMIT 30
      `),
      pool.query(`
        SELECT
          metadata->>'tool' AS tool,
          COUNT(*) AS uses,
          COUNT(DISTINCT user_id) AS unique_users
        FROM user_activity
        WHERE action = 'tool_use' AND metadata IS NOT NULL
        GROUP BY metadata->>'tool'
        ORDER BY uses DESC
      `),
    ]);

    return res.json({
      marketInterest: marketResult.rows,
      toolUsage: toolResult.rows,
    });
  } catch (err) {
    console.error('[AdminController] getAnalytics error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve analytics.' });
  }
}

// GET /admin/online-users
async function getOnlineUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, email, name, last_active, is_blocked, is_restricted, created_at
       FROM users
       WHERE last_active >= NOW() - INTERVAL '5 minutes' AND is_admin = FALSE
       ORDER BY last_active DESC`
    );
    return res.json({ onlineUsers: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[AdminController] getOnlineUsers error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve online users.' });
  }
}

// GET /admin/users/:id
async function getUserDetails(req, res) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    const [userResult, activityResult, predictionResult] = await Promise.all([
      pool.query(
        `SELECT id, email, name, is_admin, is_blocked, is_restricted, created_at, last_active
         FROM users WHERE id = $1`,
        [parsedId]
      ),
      pool.query(
        `SELECT action, ip_address, user_agent, metadata, created_at
         FROM user_activity WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [parsedId]
      ),
      pool.query(
        `SELECT symbol, timeframe, direction, confidence, created_at
         FROM predictions WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [parsedId]
      ),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      user: userResult.rows[0],
      recentActivity: activityResult.rows,
      recentPredictions: predictionResult.rows,
    });
  } catch (err) {
    console.error('[AdminController] getUserDetails error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve user details.' });
  }
}

// PATCH /admin/users/:id/restrict
async function restrictUser(req, res) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  if (parsedId === req.user.id) {
    return res.status(400).json({ error: 'Cannot restrict your own admin account.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET is_restricted = TRUE WHERE id = $1 AND is_admin = FALSE RETURNING id, email',
      [parsedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or cannot restrict admin accounts.' });
    }

    return res.json({ message: 'User restricted successfully.' });
  } catch (err) {
    console.error('[AdminController] restrictUser error:', err.message);
    return res.status(500).json({ error: 'Failed to restrict user.' });
  }
}

// PATCH /admin/users/:id/unrestrict
async function unrestrictUser(req, res) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  if (parsedId === req.user.id) {
    return res.status(400).json({ error: 'Cannot unrestrict your own admin account.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET is_restricted = FALSE WHERE id = $1 AND is_admin = FALSE RETURNING id, email',
      [parsedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or cannot unrestrict admin accounts.' });
    }

    return res.json({ message: 'User unrestricted successfully.' });
  } catch (err) {
    console.error('[AdminController] unrestrictUser error:', err.message);
    return res.status(500).json({ error: 'Failed to unrestrict user.' });
  }
}

// GET /admin/predictions
async function getPredictions(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const symbol = req.query.symbol || null;

  try {
    const params = [];
    let where = '';
    if (symbol) {
      params.push(symbol.toUpperCase());
      where = 'WHERE p.symbol = $1';
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM predictions p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT p.id, p.symbol, p.timeframe, p.direction, p.confidence,
              p.entry_price, p.stop_loss, p.take_profit, p.ai_provider,
              p.created_at,
              u.id AS user_id, u.email, u.name
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    const predictions = result.rows.map((row) => ({
      ...row,
      confidence: row.confidence != null ? parseFloat(row.confidence) : null,
      entry_price: row.entry_price != null ? parseFloat(row.entry_price) : null,
      stop_loss: row.stop_loss != null ? parseFloat(row.stop_loss) : null,
      take_profit: row.take_profit != null ? parseFloat(row.take_profit) : null,
    }));

    return res.json({ predictions, total, limit, offset });
  } catch (err) {
    console.error('[AdminController] getPredictions error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve predictions.' });
  }
}

// GET /admin/security
async function getSecurityEvents(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  try {
    // Recent login attempts
    const loginResult = await pool.query(
      `SELECT ua.id, ua.action, ua.ip_address, ua.country, ua.country_code,
              ua.city, ua.browser, ua.os, ua.device_type, ua.created_at,
              u.id AS user_id, u.email, u.name, u.is_blocked
       FROM user_activity ua
       JOIN users u ON u.id = ua.user_id
       WHERE ua.action = 'login'
       ORDER BY ua.created_at DESC
       LIMIT $1`,
      [limit]
    );

    // Blocked users
    const blockedResult = await pool.query(
      `SELECT id, email, name, created_at, last_active
       FROM users
       WHERE is_blocked = TRUE AND is_admin = FALSE
       ORDER BY created_at DESC`
    );

    // Most active IPs
    const ipResult = await pool.query(
      `SELECT ip_address, COUNT(*) AS requests, COUNT(DISTINCT user_id) AS unique_users,
              MAX(created_at) AS last_seen
       FROM user_activity
       WHERE ip_address IS NOT NULL
       GROUP BY ip_address
       ORDER BY requests DESC
       LIMIT 20`
    );

    return res.json({
      recentLogins: loginResult.rows,
      blockedUsers: blockedResult.rows,
      topIPs: ipResult.rows,
    });
  } catch (err) {
    console.error('[AdminController] getSecurityEvents error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve security events.' });
  }
}

module.exports = {
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
};
