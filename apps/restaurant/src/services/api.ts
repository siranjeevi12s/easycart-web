import axios from 'axios';
export const api = axios.create({ baseURL: '/api' });

// ---- session helpers (access + rotating refresh tokens) ----
export const getAccessToken = () => localStorage.getItem('token');
export const getRefreshToken = () => localStorage.getItem('refreshToken');
export function saveSession(token: string, refreshToken?: string, user?: any) {
  localStorage.setItem('token', token);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  if (user !== undefined) localStorage.setItem('user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

// Single-flight refresh: concurrent 401s share one /refresh-token call
let refreshPromise: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const rt = getRefreshToken();
        if (!rt) return null;
        const { data } = await axios.post('/api/auth/refresh-token', { refreshToken: rt }, { timeout: 15000 });
        if (!data?.token) return null;
        saveSession(data.token, data.refreshToken);
        return data.token as string;
      } catch {
        return null;
      } finally {
        setTimeout(() => { refreshPromise = null; }, 0);
      }
    })();
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original: any = err.config || {};
    const status = err.response?.status;
    const url: string = original.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh-token');
    if (status === 401 && !original._retried && !isAuthCall) {
      original._retried = true;
      const fresh = await refreshAccessToken();
      if (fresh) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${fresh}`;
        return api(original);
      }
      // Refresh dead → hard sign out to login
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
