import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { useSessionStore } from '../../entities/session/session.store';
import {
  PasswordStrengthMeter,
  isPasswordStrong,
} from '../../shared/ui/PasswordStrengthMeter';

/**
 * Luồng 06 — Account Security.
 *  - Trái: Change Password (current + new + confirm; strength meter; chặn trùng cũ).
 *  - Phải: Active Sessions list (Redis-backed) — mỗi dòng: device, IP, last active, nút Revoke.
 *  - Panic Button: "Đăng xuất tất cả thiết bị khác".
 *  - Sau change-password: backend đã thu hồi sessions cũ + blacklist jti hiện tại → đẩy về login.
 */
interface SessionItem {
  id: string;
  userAgent: string;
  ipAddress: string | null;
  isCurrent: boolean;
  lastActiveAt: string;
}

export function SecurityPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clearSession = useSessionStore((s) => s.clearSession);

  // --- Password form ---
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [show, setShow] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const pwdMatch = newPwd.length > 0 && newPwd === confirmPwd;
  const isStrong = isPasswordStrong(newPwd);
  const notSameAsOld = newPwd.length > 0 && newPwd !== currentPwd;
  const canSubmitPwd =
    currentPwd.length > 0 && isStrong && pwdMatch && notSameAsOld;

  const changePassword = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.post('/profile/change-password', {
          currentPassword: currentPwd,
          newPassword: newPwd,
        })
      ).data,
    onSuccess: () => {
      // Backend đã revoke phiên hiện tại → clear session local + đẩy về login
      clearSession();
      navigate('/auth/login?password_changed=1', { replace: true });
    },
    onError: (err: any) => {
      setPwdError(
        err?.response?.data?.message ?? 'Đổi mật khẩu thất bại.',
      );
    },
  });

  // --- Sessions list ---
  const sessions = useQuery<SessionItem[]>({
    queryKey: ['profile-sessions'],
    queryFn: async () => (await axiosClient.get('/profile/sessions')).data,
  });

  const revokeOne = useMutation({
    mutationFn: async (sessionId: string) =>
      (await axiosClient.delete(`/profile/sessions/${sessionId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-sessions'] }),
  });

  const revokeOthers = useMutation({
    mutationFn: async () =>
      (await axiosClient.delete('/profile/sessions/others')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-sessions'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/profile" className="text-xs text-gray-500 hover:text-viettel-red">
            ‹ Hồ sơ cá nhân
          </Link>
          <h1 className="text-2xl font-bold mt-1">An toàn tài khoản</h1>
          <p className="text-sm text-gray-500 mt-1">
            Đổi mật khẩu (revoke tất cả phiên cũ + blacklist JWT). Quản lý phiên đa thiết bị.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ===== Change Password ===== */}
        <section className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold">Đổi mật khẩu</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPwdError(null);
              changePassword.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mật khẩu hiện tại *</label>
              <input
                type={show ? 'text' : 'password'}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới *</label>
              <input
                type={show ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                className="w-full border rounded px-3 py-2"
              />
              <PasswordStrengthMeter password={newPwd} />
              {newPwd.length > 0 && !notSameAsOld && (
                <p className="text-xs text-danger mt-1">
                  Mật khẩu mới không được trùng với mật khẩu cũ.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nhập lại mật khẩu mới *</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                className={`w-full border rounded px-3 py-2 ${
                  confirmPwd && !pwdMatch ? 'border-danger' : ''
                }`}
              />
              {confirmPwd && !pwdMatch && (
                <p className="text-xs text-danger mt-1">Hai mật khẩu không khớp.</p>
              )}
            </div>

            <label className="flex items-center text-xs gap-2 text-gray-500">
              <input
                type="checkbox"
                checked={show}
                onChange={(e) => setShow(e.target.checked)}
              />
              Hiển thị mật khẩu
            </label>

            {pwdError && (
              <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                {pwdError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmitPwd || changePassword.isPending}
              className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-50"
            >
              {changePassword.isPending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Sau khi đổi, mọi thiết bị (kể cả phiên hiện tại) sẽ bị đăng xuất.
            </p>
          </form>
        </section>

        {/* ===== Active Sessions ===== */}
        <section className="bg-white rounded-lg shadow p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Phiên đăng nhập đang hoạt động</h2>
            <button
              onClick={() => {
                if (
                  confirm(
                    'Đăng xuất toàn bộ thiết bị khác? Phiên hiện tại sẽ vẫn được giữ.',
                  )
                )
                  revokeOthers.mutate();
              }}
              disabled={revokeOthers.isPending || (sessions.data?.length ?? 0) <= 1}
              className="text-xs text-danger hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
              title="Panic Button — đăng xuất các phiên không phải máy này"
            >
              🚨 Đăng xuất tất cả thiết bị khác
            </button>
          </div>

          {sessions.isLoading && (
            <div className="text-sm text-gray-500">Đang tải...</div>
          )}

          <ul className="divide-y">
            {sessions.data?.map((s) => (
              <li
                key={s.id}
                className={`py-3 flex items-center gap-3 transition-opacity ${
                  revokeOne.isPending && revokeOne.variables === s.id
                    ? 'opacity-50'
                    : ''
                }`}
              >
                <div className="text-3xl">{deviceIcon(s.userAgent)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {parseDevice(s.userAgent)}
                    {s.isCurrent && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Thiết bị này
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    IP: <span className="font-mono">{s.ipAddress ?? '—'}</span> · Hoạt động:{' '}
                    {new Date(s.lastActiveAt).toLocaleString()}
                  </div>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => {
                      if (confirm('Đăng xuất phiên này?')) revokeOne.mutate(s.id);
                    }}
                    disabled={revokeOne.isPending}
                    className="text-xs text-danger hover:underline disabled:opacity-50"
                  >
                    Đăng xuất
                  </button>
                )}
              </li>
            ))}
            {sessions.data && sessions.data.length === 0 && (
              <li className="py-6 text-center text-sm text-gray-500">
                Không có phiên nào (lạ — phiên hiện tại sẽ luôn hiện ở đây).
              </li>
            )}
          </ul>

          {(revokeOne.isSuccess || revokeOthers.isSuccess) && (
            <div className="text-xs text-green-700">✓ Đã thu hồi phiên thành công.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function deviceIcon(ua: string): string {
  if (/Mobile|Android|iPhone/.test(ua)) return '📱';
  if (/Macintosh/.test(ua)) return '🖥️';
  if (/Linux/.test(ua)) return '🐧';
  if (/Windows/.test(ua)) return '🪟';
  return '💻';
}

function parseDevice(ua: string): string {
  const browser =
    /Edg\/(\d+)/.exec(ua)?.[0] ??
    /Chrome\/(\d+)/.exec(ua)?.[0] ??
    /Firefox\/(\d+)/.exec(ua)?.[0] ??
    /Safari\/(\d+)/.exec(ua)?.[0] ??
    'Unknown Browser';
  const os = /Windows NT [\d.]+/.exec(ua)?.[0]
    ?? /Mac OS X [\d_]+/.exec(ua)?.[0]
    ?? /Android \d+/.exec(ua)?.[0]
    ?? /iPhone OS [\d_]+/.exec(ua)?.[0]
    ?? /Linux/.exec(ua)?.[0]
    ?? 'Unknown OS';
  return `${browser} · ${os}`;
}
