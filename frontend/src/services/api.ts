import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
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
    return Promise.reject(new Error(message));
  }
);

export const auth = {
  register: (email: string, password: string, name?: string) =>
    apiClient.post('/auth/register', { email, password, name }).then((r) => r.data),

  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),

  me: () => apiClient.get('/auth/me').then((r) => r.data),
};

export const admin = {
  login: (email: string, password: string) =>
    apiClient.post('/admin/login', { email, password }).then((r) => r.data),

  listUsers: (token: string) =>
    apiClient.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),

  createUser: (token: string, email: string, password: string, name?: string) =>
    apiClient
      .post('/admin/users', { email, password, name }, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  deleteUser: (token: string, id: number) =>
    apiClient
      .delete(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
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
  predict: (symbol: string, timeframe: string) =>
    apiClient.post('/ai/predict', { symbol, timeframe }).then((r) => r.data),

  getHistory: (symbol?: string, limit = 20, offset = 0) =>
    apiClient
      .get('/ai/history', { params: { symbol, limit, offset } })
      .then((r) => r.data),

  getSignals: () => apiClient.get('/ai/signals').then((r) => r.data),

  analyzeImage: (formData: FormData) =>
    apiClient
      .post('/ai/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
};

export default apiClient;
