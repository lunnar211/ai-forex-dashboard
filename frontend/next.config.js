/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    // Proxy all /api/* requests to the backend service.
    // This allows the browser to call a same-origin path (/api/...) instead of
    // the raw backend URL, which:
    //   1. Eliminates cross-origin (CORS) issues.
    //   2. Prevents 404s caused by NEXT_PUBLIC_API_URL being misconfigured in
    //      the browser bundle — the destination is resolved server-side at
    //      startup time from the environment variable.
    // Strip any trailing slash to avoid double-slash paths (e.g. https://host//auth/register).
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.warn('[next.config] NEXT_PUBLIC_API_URL is not set — API requests will be proxied to http://localhost:5000');
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
