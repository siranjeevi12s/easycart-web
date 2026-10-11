import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Lazy load expo-constants to avoid TurboModule crash if native module missing (SDK mismatch)
let Constants: any = null;
try {
  Constants = require('expo-constants').default || require('expo-constants');
} catch {}

// Server priority: explicit env override first, then the baked-in production URL
// from app.json, then the live Metro LAN host (local dev server), then the
// emulator/localhost fallback. Production (https) wins over LAN because a
// dev phone on Wi-Fi would otherwise point at a possibly-dead :5000 and every
// call fails with a bare Network Error. Set EXPO_PUBLIC_API_URL to force LAN:
//   EXPO_PUBLIC_API_URL=http://<pc-lan-ip>:5000 npx expo start
function getBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:5000';
  const override = (process as any)?.env?.EXPO_PUBLIC_API_URL;
  if (override) return String(override).replace(/\/api\/?$/, '');
  const extraUrl = (Constants as any)?.expoConfig?.extra?.apiUrl;
  if (extraUrl && /^https:/i.test(String(extraUrl))) return String(extraUrl).replace(/\/api\/?$/, '');
  // Live debugger host (current LAN IP, e.g. 10.63.39.145:8081)
  const hostUri: string | undefined =
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:5000`;
  }
  if (extraUrl) return String(extraUrl).replace(/\/api\/?$/, '');
  // Final fallback: Android emulator -> 10.0.2.2, else localhost
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
}

export const BASE_URL = getBaseUrl();

export const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 15000 });

// Log base URL once for debugging Network Error
console.log('[EasyCart Restaurant] API BASE_URL:', BASE_URL);

// ---- session helpers (access + rotating refresh tokens) ----
export const getAccessToken = () => AsyncStorage.getItem('token');
export const getRefreshToken = () => AsyncStorage.getItem('refreshToken');
export async function saveSession(token: string, refreshToken?: string, user?: any) {
  await AsyncStorage.setItem('token', token);
  if (refreshToken) await AsyncStorage.setItem('refreshToken', refreshToken);
  if (user !== undefined) await AsyncStorage.setItem('user', JSON.stringify(user));
}
export async function clearSession() {
  await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
}

// Auth-loss subscribers (e.g. App root signs the user out when refresh dies)
type AuthLostHandler = () => void;
const authLostHandlers = new Set<AuthLostHandler>();
export const onAuthLost = (h: AuthLostHandler) => {
  authLostHandlers.add(h);
  return () => { authLostHandlers.delete(h); };
};
const emitAuthLost = () => authLostHandlers.forEach((h) => { try { h(); } catch {} });

// Single-flight refresh: concurrent 401s share one /refresh-token call
let refreshPromise: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const rt = await getRefreshToken();
        if (!rt) return null;
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh-token`, { refreshToken: rt }, { timeout: 15000 });
        if (!data?.token) return null;
        await saveSession(data.token, data.refreshToken);
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

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original: any = error.config || {};
    const status = error.response?.status;
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
      // Refresh dead (rotated elsewhere / password changed / revoked) → sign out
      await clearSession();
      emitAuthLost();
    }
    return Promise.reject(error);
  }
);
