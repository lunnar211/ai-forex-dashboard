'use strict';

require('dotenv').config();

const validateEnv = require('./config/validateEnv');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');

const { pool, initSchema } = require('./config/database');
const authRoutes = require('./routes/auth');
const forexRoutes = require('./routes/forex');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const activityRoutes = require('./routes/activity');
const marketRoutes = require('./routes/market');
const { startBot } = require('./services/telegramBot');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security & Logging middleware ────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    name: 'AI Forex Dashboard API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      auth: '/auth',
      forex: '/forex',
      ai: '/ai',
      admin: '/admin',
      activity: '/activity',
      market: '/api/market',
    },
  });
});

app.use('/auth', authRoutes);
app.use('/forex', forexRoutes);
app.use('/ai', aiRoutes);
app.use('/admin', adminRoutes);
app.use('/activity', activityRoutes);
app.use('/api/market', marketRoutes);

// ─── Health endpoint ─────────────────────────────────────────────────────────

const healthRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.get('/health', healthRateLimiter, async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    redis: 'unknown',
    aiProviders: {
      groq: process.env.GROQ_API_KEY ? 'configured' : 'not configured',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not configured',
      openrouter: process.env.OPENROUTER_API_KEY ? 'configured' : 'not configured',
      anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured',
    },
    marketData: {
      finnhub:    process.env.FINNHUB_API_KEY    ? 'configured' : 'not configured',
      newsdata:   process.env.NEWSDATA_API_KEY   ? 'configured' : 'not configured',
      polymarket: process.env.POLYMARKET_API_KEY ? 'configured' : 'not configured',
    },
    forexData: process.env.TWELVE_DATA_API_KEY ? 'configured' : 'mock mode',
  };

  // DB check
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    checks.database = `error: ${err.message}`;
  }

  // Redis check
  try {
    if (app.locals.redis) {
      await app.locals.redis.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'not connected';
    }
  } catch (err) {
    checks.redis = `error: ${err.message}`;
  }

  const allOk = checks.database === 'ok';
  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global error handler ────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

async function start() {
  // Connect to PostgreSQL and run migrations
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL connected.');
    await initSchema();
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  // Connect to Redis (non-fatal — app degrades gracefully without it)
  if (process.env.REDIS_URL) {
    try {
      const redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) =>
        console.error('[Redis] Client error:', err.message)
      );
      await redisClient.connect();
      app.locals.redis = redisClient;
      console.log('[Redis] Connected.');
    } catch (err) {
      console.warn('[Redis] Could not connect — caching disabled:', err.message);
      app.locals.redis = null;
    }
  } else {
    console.warn('[Redis] REDIS_URL not set — caching disabled.');
    app.locals.redis = null;
  }

  app.listen(PORT, () => {
    console.log(`[Server] AI Forex Backend running on port ${PORT}`);
    console.log(`[Server] Health check → http://localhost:${PORT}/health`);
  });

  // Start Telegram bot (non-fatal if token not set)
  startBot();
}

start();
