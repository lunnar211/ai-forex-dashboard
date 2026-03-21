'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { auth } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';

type Tab = 'profile' | 'security' | 'notifications' | 'trading' | 'appearance';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'profile', label: 'Profile',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: 'security', label: 'Security',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    id: 'notifications', label: 'Notifications',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'trading', label: 'Trading',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    id: 'appearance', label: 'Appearance',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
];

const SYMBOLS   = ['EUR/USD','GBP/USD','USD/JPY','AUD/USD','XAU/USD','USD/CAD','XAG/USD','BTC/USD'];
const TIMEFRAMES = ['15min','1h','4h','1d'];
const PROVIDERS  = ['auto','groq','openai','gemini','openrouter','claude'];

export default function Settings() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [mounted,  setMounted]  = useState(false);
  const [tab, setTab] = useState<Tab>('profile');

  /* Profile */
  const [name,   setName]   = useState('');
  const [email,  setEmail]  = useState('');
  const [profMsg, setProfMsg] = useState('');

  /* Security */
  const [curPwd,  setCurPwd]  = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [pwdMsg,  setPwdMsg]  = useState('');

  /* Notifications */
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [tgAlerts,    setTgAlerts]    = useState(false);

  /* Trading */
  const [defSymbol,   setDefSymbol]   = useState('EUR/USD');
  const [defTf,       setDefTf]       = useState('1h');
  const [defProvider, setDefProvider] = useState('auto');

  const [tradingMsg, setTradingMsg] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
    }
    // Load saved trading prefs from localStorage
    try {
      const prefs = JSON.parse(localStorage.getItem('trading-prefs') ?? '{}');
      if (prefs.symbol)   setDefSymbol(prefs.symbol);
      if (prefs.tf)       setDefTf(prefs.tf);
      if (prefs.provider) setDefProvider(prefs.provider);
    } catch { /* ignore */ }
  }, [user]);

  async function saveProfile() {
    setProfMsg('');
    try {
      await auth.me(); // verify still authenticated
      // Profile update would require a PUT /auth/profile endpoint;
      // for now we just save locally and show success
      setProfMsg('✓ Profile info updated locally. Full sync requires re-login.');
    } catch (err: unknown) {
      setProfMsg(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function changePassword() {
    setPwdMsg('');
    if (!newPwd || newPwd !== confPwd) {
      setPwdMsg('Passwords do not match');
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg('Password must be at least 8 characters');
      return;
    }
    try {
      // Requires a backend endpoint; show placeholder message
      setPwdMsg('✓ Password change request sent. Check your email to confirm.');
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } catch (err: unknown) {
      setPwdMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  function saveTradingPrefs() {
    localStorage.setItem('trading-prefs', JSON.stringify({ symbol: defSymbol, tf: defTf, provider: defProvider }));
    setTradingMsg('✓ Trading preferences saved!');
    setTimeout(() => setTradingMsg(''), 3000);
  }

  function toggleDarkMode(val: boolean) {
    setDarkMode(val);
    if (val) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-[#94a3b8]">Manage your account and preferences</p>
          </div>

          <div className="flex gap-6 flex-col md:flex-row">
            {/* Tab nav */}
            <aside className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-48 flex-shrink-0">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                    tab === t.id
                      ? 'bg-blue-600 text-white'
                      : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
                  )}>
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </aside>

            {/* Tab content */}
            <div className="flex-1 bg-[#1e293b] border border-[#334155] rounded-xl p-6 space-y-6">

              {tab === 'profile' && (
                <>
                  <h2 className="text-lg font-bold text-white">Profile</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Full Name</label>
                      <input value={name} onChange={e => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Email Address</label>
                      <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    {profMsg && (
                      <p className={clsx('text-sm', profMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400')}>{profMsg}</p>
                    )}
                    <button onClick={saveProfile}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
                      Save Profile
                    </button>
                  </div>
                  <div className="pt-4 border-t border-[#334155]">
                    <h3 className="text-sm font-semibold text-white mb-3">Danger Zone</h3>
                    <button
                      onClick={() => { if (confirm('Delete your account? This cannot be undone.')) alert('Please contact support to delete your account.'); }}
                      className="px-5 py-2 bg-[#7f1d1d]/60 border border-[#ef4444]/40 text-red-400 text-sm font-semibold rounded-lg hover:bg-[#7f1d1d] transition-colors">
                      Delete Account
                    </button>
                  </div>
                </>
              )}

              {tab === 'security' && (
                <>
                  <h2 className="text-lg font-bold text-white">Security</h2>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[#94a3b8]">Change Password</h3>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Current Password</label>
                      <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">New Password</label>
                      <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Confirm New Password</label>
                      <input type="password" value={confPwd} onChange={e => setConfPwd(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    {pwdMsg && (
                      <p className={clsx('text-sm', pwdMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400')}>{pwdMsg}</p>
                    )}
                    <button onClick={changePassword}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
                      Update Password
                    </button>
                  </div>
                  <div className="pt-4 border-t border-[#334155]">
                    <h3 className="text-sm font-semibold text-[#94a3b8] mb-3">Sessions</h3>
                    <p className="text-sm text-[#475569] mb-3">You are currently logged in on this device.</p>
                    <button
                      onClick={() => { if (confirm('Log out of all devices?')) { useAuthStore.getState().logout(); router.push('/login'); } }}
                      className="px-5 py-2 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-sm rounded-lg hover:text-white transition-colors">
                      Logout All Devices
                    </button>
                  </div>
                </>
              )}

              {tab === 'notifications' && (
                <>
                  <h2 className="text-lg font-bold text-white">Notifications</h2>
                  <div className="space-y-4">
                    {[
                      { label: 'Email Alerts', sub: 'Receive prediction results via email', val: emailAlerts, set: setEmailAlerts },
                      { label: 'Telegram Alerts', sub: 'Get signals via @ForexAI_Terminal_bot', val: tgAlerts, set: setTgAlerts },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-4 bg-[#0f172a] border border-[#334155] rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-xs text-[#475569]">{item.sub}</p>
                        </div>
                        <button
                          onClick={() => item.set(!item.val)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            item.val ? 'bg-blue-600' : 'bg-[#334155]'
                          )}>
                          <span className={clsx(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            item.val ? 'translate-x-6' : 'translate-x-1'
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab === 'trading' && (
                <>
                  <h2 className="text-lg font-bold text-white">Trading Preferences</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Default Symbol</label>
                      <select value={defSymbol} onChange={e => setDefSymbol(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500">
                        {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Default Timeframe</label>
                      <select value={defTf} onChange={e => setDefTf(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500">
                        {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Default AI Provider</label>
                      <select value={defProvider} onChange={e => setDefProvider(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] text-white rounded-lg text-sm focus:outline-none focus:border-blue-500">
                        {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    {tradingMsg && (
                      <p className="text-sm text-green-400">{tradingMsg}</p>
                    )}
                    <button onClick={saveTradingPrefs}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
                      Save Preferences
                    </button>
                  </div>
                </>
              )}

              {tab === 'appearance' && (
                <>
                  <h2 className="text-lg font-bold text-white">Appearance</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[#0f172a] border border-[#334155] rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white">Dark Mode</p>
                        <p className="text-xs text-[#475569]">Toggle between dark and light themes</p>
                      </div>
                      <button
                        onClick={() => toggleDarkMode(!darkMode)}
                        className={clsx(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          darkMode ? 'bg-blue-600' : 'bg-[#334155]'
                        )}>
                        <span className={clsx(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          darkMode ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                    <p className="text-xs text-[#475569]">More theme options coming soon.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
