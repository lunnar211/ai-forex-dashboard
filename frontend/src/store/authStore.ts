'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User } from '../types';
import { activity, auth } from '../services/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token: string, user: User) =>
        set({ token, user, isAuthenticated: true }),
      logout: () => {
        // Track logout before clearing state
        activity.track({ action: 'logout', page: 'auth' });
        // Notify the server to revoke the JWT (best-effort — must be called
        // before set() clears the token from localStorage so the request
        // interceptor can still read it).
        auth.logout();
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
