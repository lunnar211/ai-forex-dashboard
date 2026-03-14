'use strict';

/**
 * Masks a secret value so the value is never exposed to the client.
 * Returns null if the key is not set.
 * Only reveals the first 2 and last 2 characters to avoid leaking key length.
 */
function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 6) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

// GET /admin/status
async function getStatus(req, res) {
  return res.json({
    apiKeys: {
      groq: {
        configured: Boolean(process.env.GROQ_API_KEY),
        masked: maskSecret(process.env.GROQ_API_KEY),
      },
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        masked: maskSecret(process.env.OPENAI_API_KEY),
      },
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        masked: maskSecret(process.env.GEMINI_API_KEY),
      },
      twelveData: {
        configured: Boolean(process.env.TWELVE_DATA_API_KEY),
        masked: maskSecret(process.env.TWELVE_DATA_API_KEY),
      },
    },
    services: {
      database: 'connected',
      redis: process.env.REDIS_URL ? 'configured' : 'not configured',
      forexData: process.env.TWELVE_DATA_API_KEY ? 'live' : 'mock mode',
    },
    environment: process.env.NODE_ENV || 'development',
  });
}

module.exports = { getStatus };
