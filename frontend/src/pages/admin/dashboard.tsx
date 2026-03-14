'use client';
import { useEffect, useState, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/router';
import { admin } from '../../services/api';

interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  totalPredictions: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{ email: string; name: string } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    const storedToken = sessionStorage.getItem('admin-token');
    const storedUser = sessionStorage.getItem('admin-user');
    if (!storedToken) {
      router.replace('/admin');
      return;
    }
    setToken(storedToken);
    if (storedUser) {
      try {
        setAdminUser(JSON.parse(storedUser));
      } catch {
        // ignore
      }
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
    } catch {
      // non-critical
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadUsers();
    loadStats();
  }, [token, loadUsers, loadStats]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreateError('');
    setCreateSuccess('');
    setCreateLoading(true);
    try {
      await admin.createUser(token, newEmail, newPassword, newName || undefined);
      setCreateSuccess(`User ${newEmail} created successfully.`);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setShowCreateForm(false);
      loadUsers();
      loadStats();
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
      setDeleteId(null);
      loadUsers();
      loadStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin-token');
    sessionStorage.removeItem('admin-user');
    router.replace('/admin');
  }

  if (!token) return null;

  const regularUsers = users.filter((u) => !u.is_admin);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Top nav */}
      <header className="bg-[#1e293b] border-b border-[#334155] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-white">Admin Panel</span>
            <span className="text-[#475569] text-xs ml-2">ForexAI</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#64748b]">{adminUser?.email}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] hover:border-red-500 text-[#94a3b8] hover:text-red-400 text-xs rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Registered Users" value={stats.totalUsers} color="blue" />
            <StatCard label="Total Predictions" value={stats.totalPredictions} color="green" />
            <StatCard label="Admin Accounts" value={users.filter((u) => u.is_admin).length} color="red" />
          </div>
        )}

        {/* Success message */}
        {createSuccess && (
          <div className="px-4 py-3 bg-green-900/30 border border-green-500/50 rounded-lg text-sm text-green-400">
            ✓ {createSuccess}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
            {error}
          </div>
        )}

        {/* Users section */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
            <div>
              <h2 className="text-base font-semibold text-white">Registered Users</h2>
              <p className="text-xs text-[#475569] mt-0.5">{regularUsers.length} user{regularUsers.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setCreateError('');
                setCreateSuccess('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          </div>

          {/* Create user form */}
          {showCreateForm && (
            <div className="px-6 py-4 border-b border-[#334155] bg-[#0f172a]/50">
              <h3 className="text-sm font-semibold text-white mb-3">Create New User</h3>
              {createError && (
                <div className="mb-3 px-3 py-2 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-xs text-[#fca5a5]">
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full Name (optional)"
                  className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-white placeholder-[#475569] text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="Email address *"
                  className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-white placeholder-[#475569] text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Password (min 8 chars) *"
                  className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-white placeholder-[#475569] text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {createLoading ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3 py-2 bg-[#1e293b] border border-[#334155] hover:border-[#475569] text-[#94a3b8] text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users table */}
          {loadingUsers ? (
            <div className="px-6 py-8 text-center text-[#475569] text-sm">Loading users…</div>
          ) : regularUsers.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#475569]">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">No users registered yet.</p>
              <p className="text-xs mt-1">Use the &quot;Add User&quot; button to create accounts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left px-6 py-3 text-[#475569] text-xs font-semibold uppercase tracking-wider">ID</th>
                    <th className="text-left px-6 py-3 text-[#475569] text-xs font-semibold uppercase tracking-wider">Name</th>
                    <th className="text-left px-6 py-3 text-[#475569] text-xs font-semibold uppercase tracking-wider">Email</th>
                    <th className="text-left px-6 py-3 text-[#475569] text-xs font-semibold uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]">
                  {regularUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[#0f172a]/40 transition-colors">
                      <td className="px-6 py-3 text-[#94a3b8] font-mono text-xs">#{user.id}</td>
                      <td className="px-6 py-3 text-white">{user.name || <span className="text-[#475569]">—</span>}</td>
                      <td className="px-6 py-3 text-[#94a3b8]">{user.email}</td>
                      <td className="px-6 py-3 text-[#475569] text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {deleteId === user.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-[#94a3b8]">Confirm?</span>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={deleteLoading}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
                            >
                              {deleteLoading ? '…' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="px-2 py-1 bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-xs rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteId(user.id)}
                            className="px-2 py-1 text-[#475569] hover:text-red-400 hover:bg-red-900/20 text-xs rounded transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation modal overlay (when a different row is targeted) */}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'red' }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-900/20 border-blue-500/20',
    green: 'text-green-400 bg-green-900/20 border-green-500/20',
    red: 'text-red-400 bg-red-900/20 border-red-500/20',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}
