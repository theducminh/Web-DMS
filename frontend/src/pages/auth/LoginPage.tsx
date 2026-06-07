import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginRequest } from '../../features/auth-actions/api/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const flashRegistered = params.get('registered') === '1';
  const flashReset = params.get('reset') === '1';
  const flashPwdChanged = params.get('password_changed') === '1';
  const flashSsoDenied = params.get('error') === 'sso_denied';
  const [email, setEmail] = useState('minhchoi2004@gmail.com');
  const [password, setPassword] = useState('Admin@123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginRequest(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Visual */}
      <div className="hidden md:flex md:w-1/2 bg-viettel-red text-white items-center justify-center p-12">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-4">VDT Document Management System</h1>
          <p className="opacity-90">
            Hệ thống quản lý tài liệu dự án theo mô hình Zero-Trust. ABAC + Hash Chaining + SSE-S3.
          </p>
          <ul className="mt-8 space-y-2 text-sm opacity-90 list-disc pl-5">
            <li>Single Source of Truth (SSOT) cho tài liệu dự án</li>
            <li>Mã hóa SSE-S3 AES-256 + TLS 1.3</li>
            <li>Audit Log chống chối bỏ (Hash Chaining)</li>
            <li>Diff Engine vi-dịch-vụ + BullMQ Workers</li>
          </ul>
        </div>
      </div>
      {/* Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-1">Đăng nhập</h2>
          <p className="text-sm text-gray-500 mb-4">Sử dụng tài khoản nội bộ tập đoàn.</p>

          {flashRegistered && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded mb-3">
              ✓ Đăng ký thành công. Tài khoản đang chờ Admin phê duyệt rồi mới đăng nhập được.
            </div>
          )}
          {flashReset && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded mb-3">
              ✓ Đặt lại mật khẩu thành công. Đăng nhập lại với mật khẩu mới.
            </div>
          )}
          {flashPwdChanged && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded mb-3">
              ✓ Đổi mật khẩu thành công. Mọi thiết bị đã bị đăng xuất — đăng nhập lại để tiếp tục.
            </div>
          )}
          {flashSsoDenied && (
            <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded mb-3">
              ✗ Google SSO bị từ chối. Email Google chưa được kích hoạt trong hệ thống — đăng ký tài khoản trước hoặc liên hệ Admin.
            </div>
          )}
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-viettel-red"
          />
          <label className="block text-sm font-medium mb-1">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-viettel-red"
          />
          {error && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded mb-3">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-viettel-red text-white py-2 rounded font-medium disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          {/* C6 (Phase 5): Divider + Google SSO button */}
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-3 text-xs text-gray-400">HOẶC</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>
          <a
            href="/api/v1/auth/google"
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-2 rounded font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.59.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9c0 1.45.348 2.825.957 4.039l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            <span>Đăng nhập với Google</span>
          </a>

          <div className="flex justify-between text-xs mt-3">
            <Link to="/auth/register" className="text-viettel-red hover:underline">
              Đăng ký tài khoản
            </Link>
            <Link to="/auth/forgot-password" className="text-viettel-red hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="mt-4 text-xs text-gray-400 text-center space-y-0.5">
            <p>Demo (cùng mật khẩu <b>Admin@123456</b>):</p>
            <p>• minhchoi2004@gmail.com — Admin</p>
            <p>• nguyenhuutuon2@gmail.com — PM</p>
            <p>• duccccccc123123@gmail.com — Dev</p>
          </div>
        </form>
      </div>
    </div>
  );
}
