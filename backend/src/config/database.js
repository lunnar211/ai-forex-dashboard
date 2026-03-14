'use strict';

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
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

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
    `);
    console.log('[DB] Schema initialised.');
  } finally {
    client.release();
  }
}

module.exports = { pool, initSchema };
