import { axiosClient } from '../../../shared/api/axiosClient';
import { SessionUser, useSessionStore } from '../../../entities/session/session.store';

interface LoginResponse {
  message: string;
  accessToken: string;
  user: SessionUser;
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const res = await axiosClient.post<LoginResponse>('/auth/login', { email, password });
  useSessionStore.getState().setSession(res.data.user, res.data.accessToken);
  return res.data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await axiosClient.post('/auth/logout');
  } finally {
    useSessionStore.getState().clearSession();
  }
}
