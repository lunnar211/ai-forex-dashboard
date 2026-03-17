import axios from 'axios';

// In the browser, route all requests through the Next.js /api rewrite proxy
// (same-origin, no CORS) rather than directly to the backend URL.
// During SSR the window object is absent, so fall back to the direct backend URL.
const BASE_URL =
  typeof window !== 'undefined'
    ? '/api'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  // Only inject the stored token when the caller has not already supplied one.
  // Admin API calls pass their own token explicitly; overriding it would cause
  // session-expired redirects if a regular-user token is also in storage.
  if (typeof window !== 'undefined' && !config.headers.Authorization) {
    try {
      const stored = localStorage.getItem('auth-storage');
      const parsed = stored ? JSON.parse(stored) : {};
      const token = parsed?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    const status = error.response?.status;
    const err = new Error(message) as Error & { status?: number };
    err.status = status;
    return Promise.reject(err);
  }
);

export const activity = {
  track: (data: {
    action: string;
    page?: string;
    symbol?: string;
    timeframe?: string;
    prediction_direction?: string;
    prediction_confidence?: number;
    metadata?: Record<string, unknown>;
  }) =>
    apiClient.post('/activity', data).catch(() => {
      // activity tracking is non-critical — silently ignore failures
    }),

  ping: () =>
    apiClient.post('/activity/ping').catch(() => {
      // ping is non-critical — silently ignore failures
    }),
};

export const auth = {
  register: (email: string, password: string, name?: string) =>
    apiClient.post('/auth/register', { email, password, name }).then((r) => r.data),

  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),

  me: () => apiClient.get('/auth/me').then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').catch(() => {
      // logout is best-effort — ignore network failures
    }),

  sendVerify: (email: string) =>
    apiClient.post('/auth/send-verify', { email }).then((r) => r.data),

  verifyEmail: (email: string, code: string) =>
    apiClient.post('/auth/verify-email', { email, code }).then((r) => r.data),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (email: string, code: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { email, code, newPassword }).then((r) => r.data),

  cookieConsent: (accepted: boolean) =>
    apiClient.post('/auth/cookies-consent', { accepted }).then((r) => r.data),
};

export const admin = {
  login: (email: string, password: string) =>
    apiClient.post('/admin/login', { email, password }).then((r) => r.data),

  verify: (token: string) =>
    apiClient.get('/admin/verify', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),

  listUsers: (token: string) =>
    apiClient.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),

  createUser: (token: string, email: string, password: string, name?: string) =>
    apiClient
      .post('/admin/users', { email, password, name }, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  getUserDetails: (token: string, id: number) =>
    apiClient
      .get(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  deleteUser: (token: string, id: number) =>
    apiClient
      .delete(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  blockUser: (token: string, id: number) =>
    apiClient
      .patch(`/admin/users/${id}/block`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  unblockUser: (token: string, id: number) =>
    apiClient
      .patch(`/admin/users/${id}/unblock`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  restrictUser: (token: string, id: number) =>
    apiClient
      .patch(`/admin/users/${id}/restrict`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  unrestrictUser: (token: string, id: number) =>
    apiClient
      .patch(`/admin/users/${id}/unrestrict`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  getStats: (token: string) =>
    apiClient.get('/admin/stats', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),

  getActivity: (token: string, limit?: number, action?: string) =>
    apiClient
      .get('/admin/activity', {
        params: { limit, action },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => r.data),

  getAnalytics: (token: string) =>
    apiClient.get('/admin/analytics', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),

  getOnlineUsers: (token: string) =>
    apiClient.get('/admin/online-users', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),

  getPredictions: (token: string, limit?: number, offset?: number, symbol?: string) =>
    apiClient
      .get('/admin/predictions', {
        params: { limit, offset, symbol },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => r.data),

  getSecurityEvents: (token: string) =>
    apiClient.get('/admin/security', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),
};

interface BackendCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toCandle(c: BackendCandle) {
  const ts = Math.floor(new Date(c.datetime).getTime() / 1000);
  return {
    time: isNaN(ts) ? 0 : ts,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  };
}

export const forex = {
  getPrices: (symbol: string, interval: string, outputsize = 100) =>
    apiClient
      .get('/forex/prices', { params: { symbol, interval, outputsize } })
      .then((r) => ({
        ...r.data,
        candles: (r.data.candles ?? []).map(toCandle),
      })),

  getLivePrice: (symbol: string) =>
    apiClient.get('/forex/live', { params: { symbol } }).then((r) => r.data),
};

export const ai = {
  predict: (symbol: string, timeframe: string, provider?: string) =>
    apiClient.post('/ai/predict', { symbol, timeframe, ...(provider ? { provider } : {}) }).then((r) => r.data),

  getHistory: (symbol?: string, limit = 20, offset = 0) =>
    apiClient
      .get('/ai/history', { params: { symbol, limit, offset } })
      .then((r) => r.data),

  getSignals: () => apiClient.get('/ai/signals').then((r) => r.data),

  getLiveSignals: () => apiClient.get('/signals/live').then((r) => r.data),

  analyzeImage: (formData: FormData) => {
    const file = formData.get('image');
    if (file instanceof File) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return Promise.reject(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
      }
      if (file.size > 7.5 * 1024 * 1024) {
        return Promise.reject(new Error('Image file is too large. Maximum allowed size is 7.5 MB.'));
      }
    }
    return apiClient
      .post('/ai/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export const market = {
  getQuote: (symbol: string) =>
    apiClient.get('/market/quote', { params: { symbol } }).then((r) => r.data),

  getNews: (symbol?: string) =>
    apiClient.get('/market/news', { params: { symbol: symbol || 'EUR/USD' } }).then((r) => r.data),
};

export default apiClient;
