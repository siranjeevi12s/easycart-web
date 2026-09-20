import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Lazy load expo-constants to avoid TurboModule crash if native module missing (SDK mismatch)
let Constants: any = null;
try {
  Constants = require('expo-constants').default || require('expo-constants');
} catch {}

// Auto-detect host IP from Expo hostUri — prioritizes live Metro host over stale app.json extra
function getBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:5000';
  // Live debugger host (current LAN IP, e.g. 10.37.96.145:8081)
  const hostUri: string | undefined =
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:5000`;
  }
  // Fallback to app.json extra / env only if hostUri unavailable (e.g. production)
  const envUrl = (Constants as any)?.expoConfig?.extra?.apiUrl || (process as any)?.env?.EXPO_PUBLIC_API_URL;
  if (envUrl) return String(envUrl).replace(/\/api\/?$/, '');
  // Final fallback: Android emulator -> 10.0.2.2, else localhost
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
}

export const BASE_URL = getBaseUrl();

export const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 15000 });

// Log base URL once for debugging Network Error
console.log('[EasyCart] API BASE_URL:', BASE_URL);

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
