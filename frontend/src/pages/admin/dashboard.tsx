'use client';
import { useEffect, useState, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/router';
import { admin } from '../../services/api';
import type { MarketInterestRow, ToolUsageRow, OnlineUser } from '../../types';

interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  is_blocked: boolean;
  is_restricted: boolean;
  last_active: string | null;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  totalPredictions: number;
  activeUsersLast24h: number;
}

interface ActivityRecord {
  id: number;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, string> | null;
  created_at: string;
  user_id: number;
  email: string;
  name: string | null;
}

interface UserDetails {
  user: AdminUser;
  recentActivity: ActivityRecord[];
  recentPredictions: Array<{
    symbol: string;
    timeframe: string;
    direction: string;
    confidence: number;
    created_at: string;
  }>;
}

type ActiveTab = 'users' | 'activity' | 'analytics' | 'online';

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-900/40 text-blue-400',
  register: 'bg-green-900/40 text-green-400',
  market_view: 'bg-purple-900/40 text-purple-400',
  tool_use: 'bg-orange-900/40 text-orange-400',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{ email: string; name: string } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');

  // Activity state
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('all');

  // Analytics state
  const [marketInterest, setMarketInterest] = useState<MarketInterestRow[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsageRow[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Online users state
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);

  // User details modal
  const [detailsUser, setDetailsUser] = useState<UserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<number | null>(null);

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Block/unblock + restrict/unrestrict
  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [restrictingId, setRestrictingId] = useState<number | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('admin-token');
    const storedUser = sessionStorage.getItem('admin-user');
    if (!storedToken) {
      router.replace('/admin');
      return;
    }
    setToken(storedToken);
    if (storedUser) {
      try { setAdminUser(JSON.parse(storedUser)); } catch { /* ignore */ }
    }
  }, [router]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    setError('');
    try {
      const data = await admin.listUsers(token);
      setUsers(data.users);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await admin.getStats(token);
      setStats(data);
    } catch { /* non-critical */ }
  }, [token]);

  const loadActivity = useCallback(async () => {
    if (!token) return;
    setLoadingActivity(true);
    try {
      const action = activityFilter === 'all' ? undefined : activityFilter;
      const data = await admin.getActivity(token, 100, action);
      setActivity(data.activity ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoadingActivity(false);
    }
  }, [token, activityFilter]);

  const loadAnalytics = useCallback(async () => {
    if (!token) return;
    setLoadingAnalytics(true);
    try {
      const data = await admin.getAnalytics(token);
      setMarketInterest(data.marketInterest ?? []);
      setToolUsage(data.toolUsage ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  }, [token]);

  const loadOnlineUsers = useCallback(async () => {
    if (!token) return;
    setLoadingOnline(true);
    try {
      const data = await admin.getOnlineUsers(token);
      setOnlineUsers(data.onlineUsers ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load online users');
    } finally {
      setLoadingOnline(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadUsers();
    loadStats();
  }, [token, loadUsers, loadStats]);

  useEffect(() => {
    if (!token || activeTab !== 'activity') return;
    loadActivity();
  }, [token, activeTab, loadActivity]);

  useEffect(() => {
    if (!token || activeTab !== 'analytics') return;
    loadAnalytics();
  }, [token, activeTab, loadAnalytics]);

  useEffect(() => {
    if (!token || activeTab !== 'online') return;
    loadOnlineUsers();
    const id = setInterval(loadOnlineUsers, 15_000);
    return () => clearInterval(id);
  }, [token, activeTab, loadOnlineUsers]);

  useEffect(() => {
    if (!token || activeTab !== 'activity') return;
    const id = setInterval(loadActivity, 30_000);
    return () => clearInterval(id);
  }, [token, activeTab, loadActivity]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreateError('');
    setCreateSuccess('');
    setCreateLoading(true);
    try {
      await admin.createUser(token, newEmail, newPassword, newName || undefined);
      setCreateSuccess(`User ${newEmail} created successfully.`);
      setNewEmail(''); setNewPassword(''); setNewName('');
      setShowCreateForm(false);
      loadUsers(); loadStats();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDeleteUser(id: number) {
    if (!token) return;
    setDeleteLoading(true);
    try {
      await admin.deleteUser(token, id);
      setDeleteId(null); loadUsers(); loadStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally { setDeleteLoading(false); }
  }

  async function handleBlockUser(id: number) {
    if (!token) return;
    setBlockingId(id);
    try { await admin.blockUser(token, id); loadUsers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to block user'); }
    finally { setBlockingId(null); }
  }

  async function handleUnblockUser(id: number) {
    if (!token) return;
    setBlockingId(id);
    try { await admin.unblockUser(token, id); loadUsers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to unblock user'); }
    finally { setBlockingId(null); }
  }

  async function handleRestrictUser(id: number) {
    if (!token) return;
    setRestrictingId(id);
    try { await admin.restrictUser(token, id); loadUsers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to restrict user'); }
    finally { setRestrictingId(null); }
  }

  async function handleUnrestrictUser(id: number) {
    if (!token) return;
    setRestrictingId(id);
    try { await admin.unrestrictUser(token, id); loadUsers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to unrestrict user'); }
    finally { setRestrictingId(null); }
  }

  async function handleViewUserDetails(id: number) {
    if (!token) return;
    setLoadingDetails(id);
    try {
      const data = await admin.getUserDetails(token, id);
      setDetailsUser(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load user details');
    } finally { setLoadingDetails(null); }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin-token');
    sessionStorage.removeItem('admin-user');
    router.replace('/admin');
  }

  const regularUsers = users.filter((u) => !u.is_admin);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top bar */}
      <div className="border-b border-[#334155] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Admin Panel</h1>
            <p className="text-[11px] text-[#475569]">{adminUser?.email || 'Administrator'}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1e293b] border border-[#334155] hover:border-red-500/50 text-[#94a3b8] hover:text-red-400 text-xs rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>

      <main className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {error && (
          <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-xl text-sm text-[#fca5a5] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-[#fca5a5] hover:text-white ml-3">&#x2715;</button>
          </div>
        )}
        {createSuccess && (
          <div className="px-4 py-3 bg-green-900/40 border border-green-500/40 rounded-xl text-sm text-green-400">
            {createSuccess}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Users" value={stats.totalUsers} color="blue" />
            <StatCard label="Total Predictions" value={stats.totalPredictions} color="green" />
            <StatCard label="Active (24h)" value={stats.activeUsersLast24h} color="yellow" />
            <StatCard label="Online Now" value={onlineUsers.length} color="red"
              onClick={() => setActiveTab('online')} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { id: 'users' as ActiveTab, label: 'Users' },
              { id: 'activity' as ActiveTab, label: 'Activity Log', dot: true },
              { id: 'analytics' as ActiveTab, label: 'Analytics' },
              { id: 'online' as ActiveTab, label: 'Online Now', dot: true },
            ]
          ).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:text-white'}`}>
              {tab.label}
              {tab.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
              <div>
                <h2 className="text-base font-semibold text-white">Registered Users</h2>
                <p className="text-xs text-[#475569] mt-0.5">{regularUsers.length} user{regularUsers.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(''); setCreateSuccess(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add User
              </button>
            </div>

            {showCreateForm && (
              <div className="px-6 py-4 border-b border-[#334155] bg-[#0f172a]/50">
                <h3 className="text-sm font-semibold text-white mb-3">Create New User</h3>
                {createError && (
                  <div className="mb-3 px-3 py-2 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-xs text-[#fca5a5]">{createError}</div>
                )}
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full Name (optional)"
                    className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-white placeholder-[#475569] text-sm focus:outline-none focus:border-blue-500" />
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required
                    placeholder="Email address *"
                    className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-white placeholder-[#475569] text-sm focus:outline-none focus:border-blue-500" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
                    placeholder="Password (min 8 chars) *"
                    className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-white placeholder-[#475569] text-sm focus:outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={createLoading}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                      {createLoading ? 'Creating\u2026' : 'Create'}
                    </button>
                    <button type="button" onClick={() => setShowCreateForm(false)}
                      className="px-3 py-2 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-sm rounded-lg">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {loadingUsers ? (
              <div className="px-6 py-8 text-center text-[#475569] text-sm">Loading users\u2026</div>
            ) : regularUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-[#475569] text-sm">No users registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      {['ID', 'Name / Email', 'Status', 'Last Active', 'Joined', 'Actions'].map((h) => (
                        <th key={h}
                          className={`${h === 'Actions' ? 'text-right' : 'text-left'} px-4 py-3 text-[#475569] text-xs font-semibold uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {regularUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#0f172a]/40 transition-colors">
                        <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">#{user.id}</td>
                        <td className="px-4 py-3">
                          <p className="text-white text-sm">{user.name || <span className="text-[#475569]">&mdash;</span>}</p>
                          <p className="text-[#475569] text-xs">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.is_blocked
                              ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/40 text-red-400">Blocked</span>
                              : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/40 text-green-400">Active</span>}
                            {user.is_restricted && <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-900/40 text-orange-400">Restricted</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#475569] text-xs">
                          {user.last_active ? new Date(user.last_active).toLocaleString() : '\u2014'}
                        </td>
                        <td className="px-4 py-3 text-[#475569] text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          {deleteId === user.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-[#94a3b8]">Confirm?</span>
                              <button onClick={() => handleDeleteUser(user.id)} disabled={deleteLoading}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded">
                                {deleteLoading ? '\u2026' : 'Delete'}
                              </button>
                              <button onClick={() => setDeleteId(null)}
                                className="px-2 py-1 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-xs rounded">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button onClick={() => handleViewUserDetails(user.id)} disabled={loadingDetails === user.id}
                                className="px-2 py-1 bg-[#0f172a] border border-[#334155] hover:border-blue-500 text-[#94a3b8] hover:text-blue-400 text-xs rounded">
                                {loadingDetails === user.id ? '\u2026' : 'View'}
                              </button>
                              {user.is_blocked
                                ? <button onClick={() => handleUnblockUser(user.id)} disabled={blockingId === user.id}
                                    className="px-2 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs rounded">
                                    {blockingId === user.id ? '\u2026' : 'Unblock'}
                                  </button>
                                : <button onClick={() => handleBlockUser(user.id)} disabled={blockingId === user.id}
                                    className="px-2 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs rounded">
                                    {blockingId === user.id ? '\u2026' : 'Block'}
                                  </button>}
                              {user.is_restricted
                                ? <button onClick={() => handleUnrestrictUser(user.id)} disabled={restrictingId === user.id}
                                    className="px-2 py-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-xs rounded">
                                    {restrictingId === user.id ? '\u2026' : 'Unrestrict'}
                                  </button>
                                : <button onClick={() => handleRestrictUser(user.id)} disabled={restrictingId === user.id}
                                    className="px-2 py-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-xs rounded">
                                    {restrictingId === user.id ? '\u2026' : 'Restrict'}
                                  </button>}
                              <button onClick={() => setDeleteId(user.id)}
                                className="px-2 py-1 text-[#475569] hover:text-red-400 hover:bg-red-900/20 text-xs rounded">Remove</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity tab */}
        {activeTab === 'activity' && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  User Activity Log
                  <span className="flex items-center gap-1 text-xs text-green-400 font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                </h2>
                <p className="text-xs text-[#475569] mt-0.5">Auto-refreshes every 30 seconds &middot; IP = user location</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'login', 'register', 'market_view', 'tool_use'] as const).map((f) => (
                  <button key={f} onClick={() => setActivityFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      activityFilter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#0f172a] text-[#94a3b8] border-[#334155] hover:text-white'}`}>
                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                  </button>
                ))}
                <button onClick={loadActivity} disabled={loadingActivity}
                  className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] hover:border-blue-500 text-[#94a3b8] hover:text-blue-400 text-xs rounded-lg disabled:opacity-50">
                  &#8635; Refresh
                </button>
              </div>
            </div>

            {loadingActivity ? (
              <div className="px-6 py-8 text-center text-[#475569] text-sm">Loading activity\u2026</div>
            ) : activity.length === 0 ? (
              <div className="px-6 py-12 text-center text-[#475569] text-sm">No activity recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      {['Time', 'Action', 'User', 'IP / Location', 'Details', 'Browser / Device'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[#475569] text-xs font-semibold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0f172a]">
                    {activity.map((item) => (
                      <tr key={item.id} className="hover:bg-[#0f172a]/40 transition-colors">
                        <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${ACTION_COLORS[item.action] ?? 'bg-[#334155] text-[#94a3b8]'}`}>
                            {item.action.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white text-xs">{item.name || '\u2014'}</p>
                          <p className="text-[#475569] text-xs">{item.email}</p>
                        </td>
                        <td className="px-4 py-3 text-[#475569] font-mono text-xs">{item.ip_address || '\u2014'}</td>
                        <td className="px-4 py-3 text-[#475569] text-xs">
                          {item.metadata
                            ? Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(' \u00b7 ')
                            : '\u2014'}
                        </td>
                        <td className="px-4 py-3 text-[#475569] text-xs max-w-xs truncate" title={item.user_agent || undefined}>
                          {item.user_agent || '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Analytics tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Usage Analytics</h2>
              <button onClick={loadAnalytics} disabled={loadingAnalytics}
                className="px-3 py-1.5 bg-[#1e293b] border border-[#334155] hover:border-blue-500 text-[#94a3b8] hover:text-blue-400 text-xs rounded-lg disabled:opacity-50">
                &#8635; Refresh
              </button>
            </div>
            {loadingAnalytics ? (
              <div className="text-center text-[#475569] text-sm py-12">Loading analytics\u2026</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#334155]">
                    <h3 className="text-sm font-semibold text-white">Market Interest</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Which symbols users view most</p>
                  </div>
                  {marketInterest.length === 0 ? (
                    <div className="px-6 py-10 text-center text-[#475569] text-sm">
                      No data yet. Appears after users view markets on the Platforms page.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#334155]">
                            <th className="text-left px-4 py-3 text-[#475569] text-xs font-semibold">Symbol</th>
                            <th className="text-left px-4 py-3 text-[#475569] text-xs font-semibold">Category</th>
                            <th className="text-right px-4 py-3 text-[#475569] text-xs font-semibold">Views</th>
                            <th className="text-right px-4 py-3 text-[#475569] text-xs font-semibold">Users</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0f172a]">
                          {marketInterest.map((row, i) => (
                            <tr key={i} className="hover:bg-[#0f172a]/40">
                              <td className="px-4 py-2.5 text-white font-mono text-xs font-semibold">{row.symbol || '\u2014'}</td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-900/40 text-purple-400 capitalize">{row.category || '\u2014'}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-blue-400 font-bold text-xs">{row.views}</td>
                              <td className="px-4 py-2.5 text-right text-[#94a3b8] text-xs">{row.unique_users}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#334155]">
                    <h3 className="text-sm font-semibold text-white">Tool Usage</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Which features users use most</p>
                  </div>
                  {toolUsage.length === 0 ? (
                    <div className="px-6 py-10 text-center text-[#475569] text-sm">
                      No data yet. Appears after users make predictions or analyse images.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#334155]">
                            <th className="text-left px-4 py-3 text-[#475569] text-xs font-semibold">Tool</th>
                            <th className="text-right px-4 py-3 text-[#475569] text-xs font-semibold">Uses</th>
                            <th className="text-right px-4 py-3 text-[#475569] text-xs font-semibold">Unique Users</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0f172a]">
                          {toolUsage.map((row, i) => (
                            <tr key={i} className="hover:bg-[#0f172a]/40">
                              <td className="px-4 py-2.5 text-white text-xs capitalize">{row.tool?.replace('_', ' ') || '\u2014'}</td>
                              <td className="px-4 py-2.5 text-right text-green-400 font-bold text-xs">{row.uses}</td>
                              <td className="px-4 py-2.5 text-right text-[#94a3b8] text-xs">{row.unique_users}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Online Users tab */}
        {activeTab === 'online' && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  Online Users
                  <span className="flex items-center gap-1 text-xs text-green-400 font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                </h2>
                <p className="text-xs text-[#475569] mt-0.5">Active in the last 5 minutes &middot; {onlineUsers.length} online</p>
              </div>
              <button onClick={loadOnlineUsers} disabled={loadingOnline}
                className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] hover:border-blue-500 text-[#94a3b8] hover:text-blue-400 text-xs rounded-lg disabled:opacity-50">
                &#8635; Refresh
              </button>
            </div>
            {loadingOnline ? (
              <div className="px-6 py-8 text-center text-[#475569] text-sm">Loading\u2026</div>
            ) : onlineUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-[#475569]">
                <p className="text-sm">No users online right now.</p>
                <p className="text-xs mt-1 opacity-70">Users appear here when active in the last 5 minutes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      {['Status', 'Name / Email', 'Last Active', 'Account Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[#475569] text-xs font-semibold uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0f172a]">
                    {onlineUsers.map((user) => {
                      const secAgo = Math.floor((Date.now() - new Date(user.last_active).getTime()) / 1000);
                      const isJustNow = secAgo < 60;
                      return (
                        <tr key={user.id} className="hover:bg-[#0f172a]/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isJustNow ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                              <span className="text-xs text-[#94a3b8]">{isJustNow ? 'Just now' : `${Math.floor(secAgo / 60)}m ago`}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white text-xs">{user.name || '\u2014'}</p>
                            <p className="text-[#475569] text-xs">{user.email}</p>
                          </td>
                          <td className="px-4 py-3 text-[#475569] text-xs">{new Date(user.last_active).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {user.is_blocked
                                ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/40 text-red-400">Blocked</span>
                                : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/40 text-green-400">Active</span>}
                              {user.is_restricted && <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-900/40 text-orange-400">Restricted</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* User Details Modal */}
      {detailsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155] sticky top-0 bg-[#1e293b]">
              <h3 className="text-base font-semibold text-white">User Details &mdash; #{detailsUser.user.id}</h3>
              <button onClick={() => setDetailsUser(null)} className="text-[#475569] hover:text-white text-xl leading-none">&#x2715;</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'User ID', value: `#${detailsUser.user.id}`, mono: true },
                  { label: 'Email', value: detailsUser.user.email },
                  { label: 'Name', value: detailsUser.user.name || '\u2014' },
                  { label: 'Registered', value: new Date(detailsUser.user.created_at).toLocaleString() },
                  { label: 'Last Active', value: detailsUser.user.last_active ? new Date(detailsUser.user.last_active).toLocaleString() : '\u2014' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0f172a] rounded-xl p-3">
                    <p className="text-[#475569] mb-0.5">{item.label}</p>
                    <p className={`text-white ${item.mono ? 'font-mono font-bold' : ''}`}>{item.value}</p>
                  </div>
                ))}
                <div className="bg-[#0f172a] rounded-xl p-3">
                  <p className="text-[#475569] mb-1">Status</p>
                  <div className="flex gap-1 flex-wrap">
                    {detailsUser.user.is_blocked
                      ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/40 text-red-400">Blocked</span>
                      : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/40 text-green-400">Active</span>}
                    {detailsUser.user.is_restricted && <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-900/40 text-orange-400">Restricted</span>}
                  </div>
                </div>
              </div>

              {detailsUser.recentActivity.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Recent Activity</h4>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {detailsUser.recentActivity.map((act, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-[#0f172a] rounded-lg px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${ACTION_COLORS[act.action] ?? 'bg-[#334155] text-[#94a3b8]'}`}>
                          {act.action.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-[#475569] flex-1">
                          {act.metadata ? Object.entries(act.metadata).map(([k, v]) => `${k}:${v}`).join(' ') : ''}
                          {act.ip_address ? ` \u00b7 IP: ${act.ip_address}` : ''}
                        </span>
                        <span className="text-[#334155] flex-shrink-0">{new Date(act.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailsUser.recentPredictions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Recent Predictions</h4>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {detailsUser.recentPredictions.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-[#0f172a] rounded-lg px-3 py-2">
                        <span className="text-white font-mono font-bold">{p.symbol}</span>
                        <span className="text-[#475569]">{p.timeframe}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          p.direction === 'BUY' ? 'bg-green-900/40 text-green-400'
                          : p.direction === 'SELL' ? 'bg-red-900/40 text-red-400'
                          : 'bg-yellow-900/40 text-yellow-400'
                        }`}>{p.direction}</span>
                        <span className="text-[#475569]">{p.confidence}%</span>
                        <span className="text-[#334155] ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }: {
  label: string; value: number;
  color: 'blue' | 'green' | 'red' | 'yellow';
  onClick?: () => void;
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-900/20 border-blue-500/20',
    green: 'text-green-400 bg-green-900/20 border-green-500/20',
    red: 'text-red-400 bg-red-900/20 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/20',
  };
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-xl border p-4 ${colors[color]} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500' : ''}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}
