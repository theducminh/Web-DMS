import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Phiên người dùng (persist localStorage để giữ qua F5). */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  department?: string | null;
  title?: string | null;
  clearanceLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  authProvider?: 'LOCAL' | 'GOOGLE';
}

interface SessionState {
  user: SessionUser | null;
  accessToken: string | null;
  setSession: (user: SessionUser, accessToken: string) => void;
  clearSession: () => void;
  isAdmin: () => boolean;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
      isAdmin: () => get().user?.title === 'Administrator',
    }),
    { name: 'vdt-session' },
  ),
);
