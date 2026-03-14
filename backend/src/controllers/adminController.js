'use strict';

const bcrypt = require('bcryptjs');
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

// POST /admin/login
async function adminLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password, name, is_admin FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
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
      'SELECT id, email, name, is_admin, is_blocked, created_at FROM users ORDER BY created_at DESC'
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

  try {
    const params = [limit];
    const actionFilter = action ? 'AND ua.action = $2' : '';
    if (action) params.push(action);

    const result = await pool.query(
      `SELECT ua.id, ua.action, ua.ip_address, ua.user_agent, ua.created_at,
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

module.exports = { adminLogin, listUsers, createUser, deleteUser, getStats, getActivity, blockUser, unblockUser };
