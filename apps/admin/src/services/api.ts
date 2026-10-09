import axios from 'axios';

// Same session mechanics as the portals: access + rotating refresh, single-flight
// refresh-on-401, hard sign-out when refresh dies.
export const api = axios.create({ baseURL: '/api', timeout: 20000 });

export const getAccessToken = () => localStorage.getItem('admin_token');
export const getRefreshToken = () => localStorage.getItem('admin_refresh');
export function saveSession(token: string, refreshToken?: string, user?: any) {
  localStorage.setItem('admin_token', token);
  if (refreshToken) localStorage.setItem('admin_refresh', refreshToken);
  if (user !== undefined) localStorage.setItem('admin_user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh');
  localStorage.removeItem('admin_user');
}
export const storedAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem('admin_user') || 'null');
  } catch {
    return null;
  }
};

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
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh-token');
    if (status === 401 && !original._retried && !isAuthCall) {
      original._retried = true;
      const fresh = await refreshAccessToken();
      if (fresh) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${fresh}`;
        return api(original);
      }
      clearSession();
      window.location.href = '/login';
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
  restaurants: (p: Record<string, any>) => api.get<Page<any>>('/admin/restaurants', { params: p }).then((r) => r.data),
  orders: (p: Record<string, any>) => api.get<Page<any>>('/admin/orders', { params: p }).then((r) => r.data),
  payments: (p: Record<string, any>) => api.get<Page<any>>('/admin/payments', { params: p }).then((r) => r.data),
  audit: (p: Record<string, any>) => api.get<Page<any>>('/admin/audit', { params: p }).then((r) => r.data),
  stats: () => api.get<any>('/admin/stats').then((r) => r.data),
};
