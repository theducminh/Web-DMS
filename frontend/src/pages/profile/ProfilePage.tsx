import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { useSessionStore } from '../../entities/session/session.store';
import { OtpInput } from '../../shared/ui/OtpInput';

/**
 * Luồng 05 — My Profile.
 *  - Asymmetric two-column: identity card (read-only) trái + edit form phải.
 *  - Strict Input Locking: department/title/email/clearance disabled + tooltip.
 *  - Form Dirtiness: nút "Lưu thay đổi" chỉ sáng khi có edit ở 1 trong 4 trường được phép.
 *  - Password Confirmation Gate (modal): nhập password/OTP để xác nhận; 3 sai → khóa 60s.
 *  - Adaptive Auth: authProvider=LOCAL → PASSWORD; GOOGLE → OTP (trigger gửi mail ngầm).
 *  - Backend strip clearance/department attempt → user không tự nâng quyền.
 */
interface ProfileResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  dob: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  department: { name: string } | null;
  title: string | null;
  clearanceLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
}

export function ProfilePage() {
  const qc = useQueryClient();
  const setSession = useSessionStore((s) => s.setSession);
  const sessionUser = useSessionStore((s) => s.user);
  const accessToken = useSessionStore((s) => s.accessToken);
  const authProvider = sessionUser?.authProvider ?? 'LOCAL';

  const profile = useQuery<ProfileResponse>({
    queryKey: ['profile'],
    queryFn: async () => (await axiosClient.get('/profile')).data,
  });

  // Local form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.fullName);
      setPhone(profile.data.phone ?? '');
      setDob(profile.data.dob ? profile.data.dob.slice(0, 10) : '');
      setGender(profile.data.gender ?? 'MALE');
    }
  }, [profile.data]);

  const isDirty = useMemo(() => {
    if (!profile.data) return false;
    return (
      fullName !== profile.data.fullName ||
      phone !== (profile.data.phone ?? '') ||
      dob !== (profile.data.dob ? profile.data.dob.slice(0, 10) : '') ||
      gender !== (profile.data.gender ?? 'MALE')
    );
  }, [profile.data, fullName, phone, dob, gender]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  const onTrySave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setModalOpen(true);
  };

  const saveProfile = useMutation({
    mutationFn: async (authCtx: { type: 'PASSWORD' | 'OTP'; value: string }) =>
      (
        await axiosClient.patch('/profile', {
          fullName,
          phone: phone || undefined,
          dob: dob ? new Date(dob).toISOString() : undefined,
          gender,
          authContext: authCtx,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      // Cập nhật tên trong topbar (zustand session)
      if (sessionUser && accessToken) {
        setSession({ ...sessionUser, fullName }, accessToken);
      }
      setModalOpen(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hồ sơ cá nhân</h1>
          <p className="text-sm text-gray-500 mt-1">
            Thông tin nhân sự — các trường thuộc tính ABAC do Phòng Nhân sự/Admin quản lý.
          </p>
        </div>
        <Link
          to="/profile/security"
          className="text-sm text-viettel-red hover:underline"
        >
          🔐 An toàn tài khoản →
        </Link>
      </div>

      {profile.isLoading && <div className="text-gray-500">Đang tải hồ sơ...</div>}

      {profile.data && (
        <form onSubmit={onTrySave} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Cột trái: Identity Card */}
          <aside className="lg:col-span-2 bg-white rounded-lg shadow p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-viettel-red text-white flex items-center justify-center text-2xl font-bold">
                {profile.data.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{profile.data.fullName}</div>
                <div className="text-xs text-gray-500">{profile.data.email}</div>
              </div>
            </div>
            <hr />
            <LockedField
              label="Email công ty"
              value={profile.data.email}
              hint="Do Admin quản lý"
            />
            <LockedField
              label="Phòng ban"
              value={profile.data.department?.name ?? '—'}
              hint="Thông tin do phòng Nhân sự/Admin quản lý, không thể tự sửa đổi"
            />
            <LockedField
              label="Chức vụ"
              value={profile.data.title ?? '—'}
              hint="Thông tin do phòng Nhân sự/Admin quản lý"
            />
            <LockedField
              label="Cấp độ bảo mật (Clearance)"
              value={
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    profile.data.clearanceLevel === 'CONFIDENTIAL'
                      ? 'bg-red-100 text-red-700'
                      : profile.data.clearanceLevel === 'INTERNAL'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {profile.data.clearanceLevel}
                </span>
              }
              hint="Do Security Officer phê duyệt"
            />
            <LockedField
              label="Đăng nhập bằng"
              value={authProvider === 'GOOGLE' ? '🌐 Google SSO' : '🔐 LOCAL (mật khẩu)'}
            />
          </aside>

          {/* Cột phải: Edit form */}
          <main className="lg:col-span-3 bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="font-semibold">Thông tin cá nhân</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Họ và tên</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                minLength={2}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Số điện thoại</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  pattern="^[0-9+\-\s]{8,20}$"
                  placeholder="0988xxxxxx"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Giới tính</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full border rounded px-3 py-2 md:w-1/2"
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <div className="text-xs text-gray-500">
                {saveProfile.isSuccess && (
                  <span className="text-green-700">✓ Đã lưu thay đổi.</span>
                )}
              </div>
              <button
                type="submit"
                disabled={!isDirty}
                className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDirty ? 'Lưu thay đổi' : 'Chưa có thay đổi'}
              </button>
            </div>
          </main>
        </form>
      )}

      {modalOpen && profile.data && (
        <PasswordGateModal
          authProvider={authProvider}
          email={profile.data.email}
          isSaving={saveProfile.isPending}
          serverError={
            (saveProfile.error as any)?.response?.data?.message ??
            (saveProfile.error as any)?.response?.data?.error
          }
          onClose={() => setModalOpen(false)}
          onConfirm={(value) =>
            saveProfile.mutate({ type: authProvider === 'GOOGLE' ? 'OTP' : 'PASSWORD', value })
          }
          resetServerError={() => saveProfile.reset()}
        />
      )}
    </div>
  );
}

function LockedField({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="text-sm" title={hint}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="bg-gray-50 border rounded px-3 py-1.5 cursor-not-allowed select-none">
        {value}
      </div>
    </div>
  );
}

function PasswordGateModal({
  authProvider,
  email,
  isSaving,
  serverError,
  onClose,
  onConfirm,
  resetServerError,
}: {
  authProvider: 'LOCAL' | 'GOOGLE';
  email: string;
  isSaving: boolean;
  serverError?: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
  resetServerError: () => void;
}) {
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [show, setShow] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secLeft, setSecLeft] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  const isOtpFlow = authProvider === 'GOOGLE';
  const value = isOtpFlow ? otp : password;
  const canSubmit = isOtpFlow ? otp.length === 6 : password.length > 0;

  // Trigger gửi OTP ngầm khi mở modal (chỉ với GOOGLE flow)
  useEffect(() => {
    if (isOtpFlow && !otpSent) {
      axiosClient.post('/profile/request-update-otp').catch(() => {});
      setOtpSent(true);
    }
  }, [isOtpFlow, otpSent]);

  // Đếm ngược lock 60s
  useEffect(() => {
    if (lockedUntil == null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecLeft(left);
      if (left <= 0) {
        setLockedUntil(null);
        setWrongCount(0);
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [lockedUntil]);

  // Khi serverError xuất hiện (sai mật khẩu) → tăng wrongCount + khóa khi đạt 3
  useEffect(() => {
    if (!serverError) return;
    setWrongCount((c) => {
      const next = c + 1;
      if (next >= 3) {
        setLockedUntil(Date.now() + 60_000);
      }
      return next;
    });
  }, [serverError]);

  // Khi locked tới hết → đóng modal (theo spec)
  useEffect(() => {
    if (wrongCount >= 3 && secLeft === 0 && lockedUntil == null && wrongCount > 0) {
      // unlock complete — close
      onClose();
    }
  }, [secLeft, lockedUntil, wrongCount, onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSaving || lockedUntil != null) return;
    resetServerError();
    onConfirm(value);
  };

  const locked = lockedUntil != null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Xác nhận danh tính</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-danger">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {isOtpFlow
            ? `Để bảo vệ thông tin, vui lòng nhập mã OTP gửi đến ${email}.`
            : 'Vui lòng nhập mật khẩu hiện tại để xác nhận sửa hồ sơ.'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {isOtpFlow ? (
            <OtpInput value={otp} onChange={setOtp} disabled={locked || isSaving} />
          ) : (
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu hiện tại"
                disabled={locked || isSaving}
                autoFocus
                className="w-full border rounded px-3 py-2 pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                {show ? '👁' : '👁‍🗨'}
              </button>
            </div>
          )}

          {locked && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              ⏳ Sai quá 3 lần. Vui lòng thử lại sau <b>{secLeft}s</b>.
            </div>
          )}
          {!locked && serverError && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              {serverError} {wrongCount > 0 && `(${wrongCount}/3 lần sai)`}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSaving || locked}
            className="w-full bg-viettel-red text-white py-2 rounded font-medium disabled:opacity-50"
          >
            {isSaving ? 'Đang xác nhận...' : 'Xác nhận lưu'}
          </button>
        </form>
      </div>
    </div>
  );
}
