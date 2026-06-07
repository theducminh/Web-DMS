import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { axiosClient } from '../../shared/api/axiosClient';
import { useSessionStore, SessionUser } from '../../entities/session/session.store';

/**
 * C6 (Phase 5) — Google SSO Callback Page.
 *
 * Flow:
 *   1. User click "Đăng nhập với Google" → href /api/v1/auth/google
 *   2. Backend NestJS Passport redirect Google OAuth consent screen
 *   3. Google trả về /api/v1/auth/google/callback (backend)
 *   4. Backend xử lý → set HttpOnly refresh_token cookie → redirect
 *      ${APP_BASE_URL}/dashboard?token=<accessToken>
 *   5. Frontend route /dashboard với ?token → SsoCallbackPage hoặc Dashboard trigger
 *
 * Route này attach vào /auth/sso-callback (gọn hơn /dashboard với query token).
 * Backend đã redirect tới /dashboard?token=... nên ta cũng intercept ở /dashboard
 * nhưng cleaner là dùng /auth/sso-callback. Sửa backend redirect URL sang đây.
 */
export function SsoCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useSessionStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get('token');
    if (!token) {
      setError('Thiếu access token trong callback URL.');
      return;
    }

    // Tạm set accessToken (chưa có user) để axios interceptor inject Bearer header
    setSession({ id: '', email: '', fullName: '', authProvider: 'GOOGLE' } as SessionUser, token);

    // Gọi /profile để lấy thông tin user
    axiosClient
      .get('/profile')
      .then((res) => {
        const p = res.data as {
          id: string;
          email: string;
          fullName: string;
          department?: { name: string } | null;
          title?: string | null;
          clearanceLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
          authProvider?: 'LOCAL' | 'GOOGLE';
        };
        setSession(
          {
            id: p.id,
            email: p.email,
            fullName: p.fullName,
            department: p.department?.name ?? null,
            title: p.title ?? null,
            clearanceLevel: p.clearanceLevel,
            authProvider: p.authProvider ?? 'GOOGLE',
          },
          token,
        );
        navigate('/dashboard', { replace: true });
      })
      .catch((e) => {
        setError(
          e?.response?.data?.message ??
            'Không lấy được hồ sơ. Tài khoản Google có thể chưa được Admin kích hoạt.',
        );
      });
  }, [params, navigate, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
        {error ? (
          <>
            <div className="text-5xl mb-3">🚫</div>
            <h2 className="font-semibold text-danger mb-2">Đăng nhập Google thất bại</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/auth/login', { replace: true })}
              className="px-4 py-2 bg-viettel-red text-white rounded text-sm"
            >
              Quay lại đăng nhập
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3 animate-spin">⏳</div>
            <h2 className="font-semibold mb-2">Đang xác thực Google...</h2>
            <p className="text-sm text-gray-500">
              Đang lấy thông tin tài khoản từ access token và chuyển vào dashboard.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
