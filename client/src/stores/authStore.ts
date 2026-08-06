import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, name: string, password: string) => Promise<void>;
  loadMe: () => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  loading: false,

  async login(email, password) {
    const data = await apiFetch<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    localStorage.setItem('accessToken', data.accessToken);
    set({ accessToken: data.accessToken, user: data.user });
    return data.user;
  },

  async register(email, name, password) {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async loadMe() {
    try {
      const data = await apiFetch<{ user: User }>('/auth/me');
      set({ user: data.user });
    } catch {
      /* ignore */
    }
  },

  async refresh() {
    try {
      const data = await apiFetch<{ accessToken: string; user: User }>('/auth/refresh', {
        method: 'POST',
      });
      localStorage.setItem('accessToken', data.accessToken);
      set({ accessToken: data.accessToken, user: data.user });
      return true;
    } catch {
      return false;
    }
  },

  async logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('accessToken');
      set({ accessToken: null, user: null });
    }
  },
}));