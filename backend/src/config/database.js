'use strict';

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Runs the initial schema migrations required by the application.
 * Safe to call on every startup (uses IF NOT EXISTS).
 */
async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        name        VARCHAR(255),
        is_admin    BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- Add name column if upgrading from an older schema
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'name'
        ) THEN
          ALTER TABLE users ADD COLUMN name VARCHAR(255);
        END IF;
      END $$;

      -- Add is_admin column if upgrading from an older schema
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'is_admin'
        ) THEN
          ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS predictions (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol        VARCHAR(20) NOT NULL,
        timeframe     VARCHAR(20) NOT NULL,
        direction     VARCHAR(10) NOT NULL,
        confidence    NUMERIC(5,2),
        entry_price   NUMERIC(12,5),
        stop_loss     NUMERIC(12,5),
        take_profit   NUMERIC(12,5),
        reasoning     TEXT,
        ai_provider   VARCHAR(50),
        raw_response  JSONB,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_predictions_user_id   ON predictions(user_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_symbol    ON predictions(symbol);
      CREATE INDEX IF NOT EXISTS idx_predictions_created   ON predictions(created_at DESC);

      CREATE TABLE IF NOT EXISTS signal_analyses (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        image_name    VARCHAR(255),
        analysis      JSONB,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_signal_analyses_user_id ON signal_analyses(user_id);
      CREATE INDEX IF NOT EXISTS idx_signal_analyses_created ON signal_analyses(created_at DESC);

      CREATE TABLE IF NOT EXISTS user_activity (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action      VARCHAR(50) NOT NULL,
        ip_address  VARCHAR(45),
        user_agent  TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at DESC);
    `);
    console.log('[DB] Schema initialised.');

    // Seed admin user from environment variables
    await seedAdmin(client);
  } finally {
    client.release();
  }
}

async function seedAdmin(client) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('[DB] ADMIN_EMAIL or ADMIN_PASSWORD not set — admin user not seeded.');
    return;
  }

  const existing = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [adminEmail.toLowerCase()]
  );

  if (existing.rows.length > 0) {
    // Ensure the existing user is marked as admin
    await client.query(
      'UPDATE users SET is_admin = TRUE WHERE email = $1',
      [adminEmail.toLowerCase()]
    );
    console.log('[DB] Admin user already exists — verified admin flag.');
    return;
  }

  const hashed = await bcrypt.hash(adminPassword, 12);
  await client.query(
    'INSERT INTO users (email, password, name, is_admin) VALUES ($1, $2, $3, TRUE)',
    [adminEmail.toLowerCase(), hashed, 'Admin']
  );
  console.log('[DB] Admin user seeded.');
}

module.exports = { pool, initSchema };
