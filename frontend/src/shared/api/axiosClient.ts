import axios from 'axios';
import { useSessionStore } from '../../entities/session/session.store';

/**
 * Axios client dùng chung. Interceptor:
 *  - Tự gắn `Authorization: Bearer <accessToken>` từ zustand store.
 *  - Khi backend trả 401: clear session + chuyển về /auth/login (Zero-Trust).
 *  - withCredentials để gửi HttpOnly cookie (refresh_token) qua Vite proxy.
 */
export const axiosClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().accessToken;
  if (token && config.headers) {
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith('/auth')) {
        useSessionStore.getState().clearSession();
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);
