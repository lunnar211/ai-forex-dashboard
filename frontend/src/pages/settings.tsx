'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { admin } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import type { AdminStatus } from '../types';

interface KeyRowProps {
  name: string;
  label: string;
  status: { configured: boolean; masked: string | null } | undefined;
  docsUrl: string;
}

function KeyRow({ name, label, status, docsUrl }: KeyRowProps) {
  const configured = status?.configured ?? false;
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1e293b] last:border-0">
      <div className="flex items-center gap-3">
        <span className={clsx(
          'w-2.5 h-2.5 rounded-full flex-shrink-0',
          configured ? 'bg-[#22c55e]' : 'bg-[#475569]'
        )} />
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs font-mono text-[#475569]">
            {status?.masked ?? <span className="italic">not configured</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={clsx(
          'text-xs font-semibold px-2 py-0.5 rounded',
          configured
            ? 'bg-[#166534]/40 text-[#22c55e]'
            : 'bg-[#1e293b] text-[#475569]'
        )}>
          {configured ? 'Active' : 'Not Set'}
        </span>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Get key ↗
        </a>
      </div>
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    admin.getStatus()
      .then((data: AdminStatus) => setStatus(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
              <p className="text-sm text-[#94a3b8]">
                API key status and system configuration. Keys are stored server-side only — values
                are never exposed to the browser.
              </p>
            </div>

            {error && (
              <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
                {error}
              </div>
            )}

            {/* API Keys card */}
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#334155] flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <h2 className="text-sm font-semibold text-white">API Keys</h2>
                <span className="ml-auto text-xs text-[#475569]">
                  Values masked for security — set via .env file on the server
                </span>
              </div>
              <div className="px-5">
                {loading ? (
                  <div className="py-6 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-10 bg-[#334155] rounded animate-pulse" />
                    ))}
                  </div>
                ) : status ? (
                  <>
                    <KeyRow
                      name="groq"
                      label="Groq AI (Primary)"
                      status={status.apiKeys.groq}
                      docsUrl="https://console.groq.com/keys"
                    />
                    <KeyRow
                      name="openai"
                      label="OpenAI (Fallback)"
                      status={status.apiKeys.openai}
                      docsUrl="https://platform.openai.com/api-keys"
                    />
                    <KeyRow
                      name="gemini"
                      label="Google Gemini (Fallback)"
                      status={status.apiKeys.gemini}
                      docsUrl="https://aistudio.google.com/app/apikey"
                    />
                    <KeyRow
                      name="twelveData"
                      label="Twelve Data (Live Forex Prices)"
                      status={status.apiKeys.twelveData}
                      docsUrl="https://twelvedata.com/account/api-keys"
                    />
                  </>
                ) : null}
              </div>
            </div>

            {/* Services status */}
            {status && (
              <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155] flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-white">System Status</h2>
                </div>
                <div className="px-5 py-3 space-y-2.5">
                  {Object.entries(status.services).map(([key, val]) => {
                    // Convert camelCase to Title Case (e.g., 'forexData' → 'Forex Data')
                    const label = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (c) => c.toUpperCase());
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-[#94a3b8]">{label}</span>
                        <span className={clsx(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          val === 'connected' || val === 'live' || val === 'configured'
                            ? 'bg-[#166534]/40 text-[#22c55e]'
                            : 'bg-[#1e293b] text-[#94a3b8]'
                        )}>
                          {val}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-[#1e293b]">
                    <span className="text-[#94a3b8]">Environment</span>
                    <span className="text-xs font-medium text-[#94a3b8]">{status.environment}</span>
                  </div>
                </div>
              </div>
            )}

            {/* How to set keys */}
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to Configure API Keys
              </h2>
              <ol className="text-xs text-[#94a3b8] space-y-2 list-decimal list-inside leading-relaxed">
                <li>Copy <code className="bg-[#0f172a] px-1 rounded">backend/.env.example</code> to <code className="bg-[#0f172a] px-1 rounded">backend/.env</code></li>
                <li>Fill in your API keys in <code className="bg-[#0f172a] px-1 rounded">backend/.env</code> — this file is excluded from git</li>
                <li>Restart the backend server for changes to take effect</li>
                <li>At least one AI provider key (Groq, OpenAI, or Gemini) is required for predictions</li>
                <li>Twelve Data key enables live forex prices; without it the app uses realistic mock data</li>
              </ol>
              <div className="mt-4 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                <p className="text-xs font-mono text-[#22c55e]">
                  # backend/.env<br />
                  GROQ_API_KEY=gsk_your_key_here<br />
                  TWELVE_DATA_API_KEY=your_key_here<br />
                  JWT_SECRET=your_random_secret<br />
                  DATABASE_URL=postgresql://...
                </p>
              </div>
            </div>

            {/* ngrok deployment guide */}
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                Deploy with ngrok
              </h2>
              <ol className="text-xs text-[#94a3b8] space-y-2 list-decimal list-inside leading-relaxed">
                <li>Install ngrok from <a href="https://ngrok.com/download" className="text-blue-400" target="_blank" rel="noopener noreferrer">ngrok.com/download</a></li>
                <li>Get your auth token from <a href="https://dashboard.ngrok.com/get-started/your-authtoken" className="text-blue-400" target="_blank" rel="noopener noreferrer">dashboard.ngrok.com</a></li>
                <li>Set <code className="bg-[#0f172a] px-1 rounded">NGROK_AUTHTOKEN</code> in your environment (or a root <code className="bg-[#0f172a] px-1 rounded">.env</code> file)</li>
                <li>
                  Run: <code className="bg-[#0f172a] px-1 rounded">chmod +x start-ngrok.sh && ./start-ngrok.sh</code>
                </li>
                <li>For a static domain, set <code className="bg-[#0f172a] px-1 rounded">NGROK_DOMAIN=your-domain.ngrok-free.app</code></li>
              </ol>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
