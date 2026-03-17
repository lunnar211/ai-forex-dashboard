'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { auth } from '../services/api';

export default function VerifyEmail() {
  const router = useRouter();
  const [email, setEmail] = useState((router.query.email as string) || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.verifyEmail(email, code);
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setResending(true);
    setResendMessage('');
    setError('');
    try {
      await auth.sendVerify(email);
      setResendMessage('A new verification code has been sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/login" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <span className="text-xl font-black text-white">ForexAI Terminal</span>
          </Link>
        </div>

        <div className="bg-[#1e293b] rounded-2xl border border-[#334155] p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Email Verified!</h2>
              <p className="text-[#94a3b8] text-sm">Redirecting you to the dashboard…</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
              <p className="text-[#94a3b8] text-sm mb-6">
                Enter the 6-digit code sent to your email address to verify your account.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}
              {resendMessage && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-300 text-sm">
                  {resendMessage}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Verification Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-blue-500 transition-colors text-sm text-center tracking-widest text-lg font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Verifying…' : 'Verify Email'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <p className="text-sm text-[#64748b]">
                  Didn&apos;t receive a code?{' '}
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-medium disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : 'Resend code'}
                  </button>
                </p>
              </div>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-[#334155] text-center">
            <Link href="/login" className="text-sm text-[#64748b] hover:text-blue-400 transition-colors">
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
