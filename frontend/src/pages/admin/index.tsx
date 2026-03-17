'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const API_URL =
  typeof window !== 'undefined'
    ? '/api'
    : (process.env.NEXT_PUBLIC_API_URL || 'https://ai-forex-backend.onrender.com');

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    // Clear session_expired reason from URL without reload
    if (window.location.search.includes('reason=')) {
      window.history.replaceState({}, '', '/admin');
    }

    // If already logged in and is_admin, redirect to dashboard
    const token = localStorage.getItem('token');
    const is_admin = localStorage.getItem('is_admin');
    if (token && is_admin === 'true') {
      window.location.replace('/admin/dashboard');
    }
  }, []);

  useEffect(() => {
    if (router.query.reason === 'session_expired') {
      setNotice('Session expired. Please log in again.');
    } else if (router.query.reason === 'not_admin') {
      setNotice('Access denied. Admin privileges required.');
    }
  }, [router.query.reason]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(
        `${API_URL}/auth/login`,
        {
          email: email.trim().toLowerCase(),
          password,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const { token, user } = res.data;

      if (!token) {
        setError('No token received from server.');
        return;
      }

      if (!user?.is_admin) {
        setError('This account does not have admin privileges.');
        return;
      }

      // Save BEFORE redirecting
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('is_admin', 'true');

      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Hard redirect — clears session_expired from URL
      window.location.replace('/admin/dashboard');

    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { error?: string } }; code?: string };
      const msg = apiErr?.response?.data?.error || '';

      if (apiErr?.response?.status === 401) {
        setError('Email or password is incorrect.');
      } else if (apiErr?.response?.status === 403) {
        setError('This account does not have admin access.');
      } else if (apiErr?.code === 'ECONNABORTED') {
        setError('Server timeout. Try again.');
      } else {
        setError(msg || 'Login failed. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            <p className="text-xs text-[#475569]">ForexAI — Owner Access Only</p>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-1">Admin Sign In</h2>
          <p className="text-sm text-[#64748b] mb-6">Restricted to authorized administrators only.</p>

          {notice && (
            <div className="mb-4 px-4 py-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-300">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@example.com"
                className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-xl text-white placeholder-[#475569] text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-xl text-white placeholder-[#475569] text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8] transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign In to Admin Panel'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#334155] mt-6">
          🔒 This panel is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
