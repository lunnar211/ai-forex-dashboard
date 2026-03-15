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
async function trackActivity(req, res) {
  const { action, page, symbol, timeframe, prediction_direction, prediction_confidence, metadata } = req.body;

  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'Invalid or missing action.' });
  }

  const userId = req.user.id;
  const ip = extractIP(req);
  const ua = req.headers['user-agent'] || null;
  const { device_type, browser, os } = parseUserAgent(ua);

  // Geo lookup is async and non-blocking for the response
  const redis = req.app.locals.redis;
  const geo = await geoLookup(ip, redis);

  try {
    await pool.query(
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
    );

    // Update last_active (non-blocking)
    pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [userId])
      .catch((err) => console.error('[Activity] Failed to update last_active:', err.message));

    return res.status(204).send();
  } catch (err) {
    console.error('[ActivityController] trackActivity error:', err.message);
    return res.status(500).json({ error: 'Failed to record activity.' });
  }
}

module.exports = { trackActivity };
