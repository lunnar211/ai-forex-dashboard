/**
 * Catch-all API proxy
 *
 * Forwards every /api/<anything> request from the browser to the backend
 * service. Reading NEXT_PUBLIC_API_URL here — inside an API route handler —
 * means the value is resolved from the live Node.js process environment at
 * request time, NOT baked into the bundle at build time. This makes the proxy
 * work correctly on Render (and any other platform) even when the env var was
 * only available at runtime.
 *
 * Request flow:
 *   Browser → POST /api/auth/login
 *     → Next.js routes to this handler
 *     → strips "/api" prefix
 *     → forwards to {NEXT_PUBLIC_API_URL}/auth/login
 *     → pipes response back to browser
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import http from 'http';
import https from 'https';

// Disable Next.js body parsing so we can pipe the raw stream (required for
// multipart/form-data image uploads and for faithfully forwarding any content-type).
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  // Read from the runtime Node.js environment — works at request time regardless
  // of whether the variable was present during `npm run build`.
  // Normalise the value: strip trailing slashes and prepend https:// when no
  // scheme is present (handles cases where the env var is set to just the
  // hostname, e.g. "ai-forex-backend.onrender.com").
  let rawBackendUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (rawBackendUrl && !/^https?:\/\//i.test(rawBackendUrl)) {
    // Use http:// for local addresses, https:// for everything else
    const isLocal = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0)(:\d+)?$/.test(rawBackendUrl);
    rawBackendUrl = `${isLocal ? 'http' : 'https'}://${rawBackendUrl}`;
  }
  const backendBase = rawBackendUrl || 'http://localhost:5000';

  // req.url is the original browser URL, e.g. '/api/auth/login' or
  // '/api/forex/prices?symbol=EURUSD&interval=1h'. Strip the '/api' prefix to
  // obtain the backend path.
  const backendPath = (req.url ?? '/api').slice('/api'.length) || '/';
  const targetUrl = `${backendBase}${backendPath}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    console.error('[API Proxy] Invalid backend URL:', targetUrl);
    res.status(502).json({
      error:
        'Backend URL is misconfigured. Set NEXT_PUBLIC_API_URL on the frontend service to the backend URL (e.g. https://ai-forex-backend.onrender.com).',
    });
    return;
  }

  const transport = parsedUrl.protocol === 'https:' ? https : http;

  // Forward all incoming headers but replace 'host' with the backend hostname
  // so the backend's virtual-host routing (if any) works correctly.
  const forwardHeaders: http.OutgoingHttpHeaders = {
    ...req.headers,
    host: parsedUrl.host,
  };

  const proxyReq = transport.request(
    {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: forwardHeaders,
      // 30-second socket timeout: prevents the proxy from hanging indefinitely
      // when the backend is slow to respond (e.g. cold-start on Render free tier).
      // The platform gateway typically times out after ~30 s and returns 502 on
      // its own; aborting early lets us return a meaningful JSON error instead.
      timeout: 30000,
    },
    (proxyRes) => {
      // Forward the backend's status code and headers unchanged.
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      // Pipe the response body directly to the client (handles any content-type,
      // including JSON, binary, and chunked responses).
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('timeout', () => {
    // Abort the stalled request so the 'error' handler fires immediately.
    proxyReq.destroy();
  });

  proxyReq.on('error', (err) => {
    console.error('[API Proxy] Backend unreachable:', err.message, '→', targetUrl);
    if (!res.headersSent) {
      // Distinguish between a timeout and a plain connection failure so that
      // users get an actionable message (e.g. "backend is starting up" vs
      // "URL is misconfigured").
      const isTimeout = err.message.includes('socket hang up') || (err as NodeJS.ErrnoException).code === 'ECONNRESET' || (err as NodeJS.ErrnoException).code === 'ECONNABORTED';
      res.status(502).json({
        error: isTimeout
          ? 'The backend API took too long to respond. It may still be starting up — please try again in a few seconds.'
          : 'Cannot connect to the backend API. Ensure NEXT_PUBLIC_API_URL is set on the frontend service (not the backend service) and points to the backend URL.',
      });
    }
  });

  // Pipe the incoming request body to the backend request (handles JSON,
  // form data, multipart/image uploads, etc.).
  req.pipe(proxyReq, { end: true });
}
