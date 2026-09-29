import axios from 'axios';

// Production (Netlify): set VITE_API_URL=https://<backend>.onrender.com
// Local dev: falls back to relative /api (vite proxy -> localhost:5000)
const RAW = (import.meta as any).env?.VITE_API_URL as string | undefined;
export const API_BASE = (RAW ? RAW.replace(/\/$/, '') : '') + '/api';
export const SOCKET_URL =
  ((import.meta as any).env?.VITE_SOCKET_URL as string | undefined) ||
  (RAW ? RAW.replace(/\/$/, '') : 'http://localhost:5000');

export const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      // window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
