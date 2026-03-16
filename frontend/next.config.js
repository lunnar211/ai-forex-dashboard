/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // All /api/* requests are forwarded to the backend via the catch-all API
  // route at src/pages/api/[...proxy].ts, which reads NEXT_PUBLIC_API_URL at
  // request time (not build time). No rewrite rules are needed here.
};
module.exports = nextConfig;
