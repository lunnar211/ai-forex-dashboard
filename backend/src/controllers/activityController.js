'use strict';

const { pool } = require('../config/database');
const { extractIP, parseUserAgent, geoLookup } = require('../services/geoService');

const ALLOWED_ACTIONS = new Set([
  'page_view',
  'symbol_view',
  'timeframe_change',
  'logout',
  'prediction_request',
  'prediction_result',
  'image_upload',
]);

/**
 * POST /activity
 * Accepts a tracking event from the authenticated frontend client.
 */
function trackActivity(req, res) {
  const { action, page, symbol, timeframe, prediction_direction, prediction_confidence, metadata } = req.body;

  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'Invalid or missing action.' });
  }

  const userId = req.user.id;
  const ip = extractIP(req);
  const ua = req.headers['user-agent'] || null;
  const { device_type, browser, os } = parseUserAgent(ua);

  // Respond immediately — geo lookup and DB write are fire-and-forget
  res.status(204).send();

  const redis = req.app.locals.redis;
  geoLookup(ip, redis).then((geo) => {
    pool.query(
      `INSERT INTO user_activity
         (user_id, action, page, symbol, timeframe, prediction_direction, prediction_confidence,
          ip_address, country, country_code, city, region, isp, latitude, longitude,
          user_agent, device_type, browser, os, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        userId,
        action,
        page || null,
        symbol || null,
        timeframe || null,
        prediction_direction || null,
        prediction_confidence != null ? parseFloat(prediction_confidence) : null,
        ip,
        geo.country,
        geo.country_code,
        geo.city,
        geo.region,
        geo.isp,
        geo.latitude,
        geo.longitude,
        ua,
        device_type,
        browser,
        os,
        metadata ? JSON.stringify(metadata) : null,
      ]
    ).catch((err) => console.error('[ActivityController] DB insert failed:', err.message));

    // Update last_active (non-blocking)
    pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [userId])
      .catch((err) => console.error('[Activity] Failed to update last_active:', err.message));
  }).catch((err) => console.error('[ActivityController] geo lookup failed:', err.message));
}

/**
 * POST /activity/ping
 * Lightweight heartbeat to update last_active and maintain online presence.
 */
function ping(req, res) {
  const userId = req.user.id;

  // Respond immediately, update in the background
  res.status(204).send();

  pool.query(
    'UPDATE users SET last_active = NOW() WHERE id = $1',
    [userId]
  ).catch((err) => console.error('[ActivityController] ping update failed:', err.message));
}

module.exports = { trackActivity, ping };
