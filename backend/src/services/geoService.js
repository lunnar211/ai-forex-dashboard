'use strict';

const CACHE_TTL = 86400; // 24 hours in seconds
const TIMEOUT_MS = 3000; // 3-second timeout so we never block requests

/**
 * Extract the best client IP from the request.
 * Handles common reverse-proxy headers.
 */
function extractIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.connection?.remoteAddress || null;
}

/**
 * Parse the User-Agent string into device / browser / OS components.
 * Very lightweight — no external library required.
 */
function parseUserAgent(ua) {
  if (!ua) return { device_type: 'unknown', browser: 'unknown', os: 'unknown' };

  let device_type = 'desktop';
  if (/mobile/i.test(ua)) device_type = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device_type = 'tablet';

  let browser = 'unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  let os = 'unknown';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { device_type, browser, os };
}

/**
 * Fetch geolocation data for an IP using the free ip-api.com service.
 * Results are cached in Redis (if available) to minimise external calls.
 *
 * @param {string} ip
 * @param {object|null} redis  – app.locals.redis or null
 * @returns {Promise<object>}  geo fields (country, country_code, city, region, isp, latitude, longitude)
 */
async function geoLookup(ip, redis) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: null, country_code: null, city: null, region: null, isp: null, latitude: null, longitude: null };
  }
  // Check 172.16.0.0–172.31.255.255 private range
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) {
      return { country: null, country_code: null, city: null, region: null, isp: null, latitude: null, longitude: null };
    }
  }

  const cacheKey = `geo:${ip}`;

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore cache errors */ }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,isp,lat,lon`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) return { country: null, country_code: null, city: null, region: null, isp: null, latitude: null, longitude: null };

    const data = await res.json();

    if (data.status !== 'success') {
      return { country: null, country_code: null, city: null, region: null, isp: null, latitude: null, longitude: null };
    }

    const result = {
      country: data.country || null,
      country_code: data.countryCode || null,
      city: data.city || null,
      region: data.regionName || null,
      isp: data.isp || null,
      latitude: data.lat != null ? parseFloat(data.lat) : null,
      longitude: data.lon != null ? parseFloat(data.lon) : null,
    };

    // Cache the result
    if (redis) {
      redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {});
    }

    return result;
  } catch {
    return { country: null, country_code: null, city: null, region: null, isp: null, latitude: null, longitude: null };
  }
}

module.exports = { extractIP, parseUserAgent, geoLookup };
