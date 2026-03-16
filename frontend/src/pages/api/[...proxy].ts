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
  const backendBase = (
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  ).replace(/\/+$/, '');

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
    },
    (proxyRes) => {
      // Forward the backend's status code and headers unchanged.
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      // Pipe the response body directly to the client (handles any content-type,
      // including JSON, binary, and chunked responses).
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[API Proxy] Backend unreachable:', err.message, '→', targetUrl);
    if (!res.headersSent) {
      res.status(502).json({
        error:
          'Cannot connect to the backend API. Ensure NEXT_PUBLIC_API_URL is set on the frontend service (not the backend service) and points to the backend URL.',
      });
    }
  });

  // Pipe the incoming request body to the backend request (handles JSON,
  // form data, multipart/image uploads, etc.).
  req.pipe(proxyReq, { end: true });
}
