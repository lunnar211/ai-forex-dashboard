/**
 * Returns a user-friendly error message.
 * If the error looks like a network/connectivity failure (e.g. Render free-tier
 * cold start), it surfaces a "server may be starting up" hint instead of a raw
 * technical message.
 */
export function friendlyError(err: unknown, fallback = 'An unexpected error occurred'): string {
  const msg = err instanceof Error ? err.message : fallback;
  const lower = msg.toLowerCase();
  const isNetwork =
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('err_network');
  return isNetwork
    ? 'Cannot reach the server. It may be starting up — please wait a moment and try again.'
    : msg;
}
