import axios from 'axios';

/**
 * Production-ready API layer.
 * - baseURL from VITE_API_URL (Netlify/Azure), fallback to relative /api
 *   so the Netlify `_redirects` / proxy rule keeps working.
 * - Single-flight refresh-on-401, safe sign-out, no redirect loops.
 * - Central friendly error formatter so every page shows the same message.
 */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: false, // tokens are Bearer, never cookies — avoids CSRF surface
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'admin_token';
const REFRESH_KEY = 'admin_refresh';
const USER_KEY = 'admin_user';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full / private mode — session simply won't persist */
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const getAccessToken = () => safeGet(TOKEN_KEY);
export const getRefreshToken = () => safeGet(REFRESH_KEY);

export function saveSession(token: string, refreshToken?: string, user?: unknown) {
  if (typeof token !== 'string' || token.split('.').length !== 3) return;
  safeSet(TOKEN_KEY, token);
  if (typeof refreshToken === 'string' && refreshToken.length > 0) safeSet(REFRESH_KEY, refreshToken);
  if (user !== undefined) {
    try {
      // Strip any accidental secrets before persisting.
      const u = user as Record<string, unknown>;
      const safe = { ...u };
      delete safe.passwordHash;
      delete safe.refreshToken;
      delete safe.password;
      safeSet(USER_KEY, JSON.stringify(safe));
    } catch {
      /* ignore */
    }
  }
}
export function clearSession() {
  safeRemove(TOKEN_KEY);
  safeRemove(REFRESH_KEY);
  safeRemove(USER_KEY);
}
export const storedAdmin = (): { email?: string; role?: string } | null => {
  try {
    const raw = safeGet(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => !!getAccessToken();

/** Friendly, non-leaking message for any axios failure. Never exposes tokens. */
export function getApiErrorMessage(err: unknown, fallback = 'Request failed. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const serverMsg = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof serverMsg === 'string' && serverMsg.trim().length > 0 && serverMsg.length < 300) {
      return serverMsg;
    }
    if (err.code === 'ECONNABORTED') return 'Request timed out. Check your connection and retry.';
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return 'Cannot reach the server. Check your connection or try again later.';
    }
    switch (status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Session expired. Please sign in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'Resource not found. It may have been removed.';
      case 409:
        return 'Conflict — this record already exists.';
      case 422:
        return 'Validation failed. Please check your input.';
      case 429:
        return 'Too many requests. Please wait a moment and retry.';
      default:
        if (status && status >= 500) return 'Server error. Please try again later.';
    }
  }
  if (err instanceof Error && err.message && err.message.length < 200) return err.message;
  return fallback;
}

// ---- single-flight refresh ----
let refreshPromise: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const rt = getRefreshToken();
        if (!rt) return null;
        // Use plain axios (not `api`) to avoid interceptor recursion.
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh-token`,
          { refreshToken: rt },
          { timeout: 15000, withCredentials: false }
        );
        if (!data?.token) return null;
        saveSession(data.token, data.refreshToken);
        return data.token as string;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

function hardSignOut() {
  clearSession();
  // Avoid redirect loops when already on /login or in an embedded preview.
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = (err.config || {}) as Record<string, unknown> & { _retried?: boolean; url?: string };
    const status = err.response?.status;
    const url: string = String(original.url || '');
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh-token');

    // No response at all (server down / CORS / offline): surface friendly error, never redirect.
    if (!err.response) return Promise.reject(err);

    if ((status === 401 || status === 403) && !original._retried && !isAuthCall) {
      original._retried = true;
      const fresh = await refreshAccessToken();
      if (fresh) {
        original.headers = (original.headers || {}) as Record<string, string>;
        (original.headers as Record<string, string>).Authorization = `Bearer ${fresh}`;
        return api(original);
      }
      // 403 with a valid session = wrong role (not an admin) — sign out too.
      hardSignOut();
    }
    return Promise.reject(err);
  }
);

// ---- shared API types ----
export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const apiGet = {
  customers: (p: Record<string, any>) => api.get<Page<any>>('/admin/customers', { params: p }).then((r) => r.data),
  owners: (p: Record<string, any>) => api.get<Page<any>>('/admin/owners', { params: p }).then((r) => r.data),
  restaurants: (p: Record<string, any>) =>
    api.get<Page<any>>('/admin/restaurants', { params: p }).then((r) => r.data),
  orders: (p: Record<string, any>) => api.get<Page<any>>('/admin/orders', { params: p }).then((r) => r.data),
  payments: (p: Record<string, any>) =>
    api.get<Page<any>>('/admin/payments', { params: p }).then((r) => r.data),
  audit: (p: Record<string, any>) => api.get<Page<any>>('/admin/audit', { params: p }).then((r) => r.data),
  stats: () => api.get<any>('/admin/stats').then((r) => r.data),
};
