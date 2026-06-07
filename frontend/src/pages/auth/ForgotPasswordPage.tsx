import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import {
  PasswordStrengthMeter,
  isPasswordStrong,
} from '../../shared/ui/PasswordStrengthMeter';
import { OtpInput } from '../../shared/ui/OtpInput';

/**
 * Luồng 03 — Password Recovery (3-step Stepper).
 *  - B1: Email — chỉ enable "Gửi mã" khi đúng cú pháp.
 *  - B2: OTP (6 ô) + đếm ngược 60s resend.
 *  - B3: Password mới + strength meter; nút Confirm chỉ sáng khi 100% rule + 2 ô trùng.
 *  - Generic message chống User Enumeration: backend luôn trả "Mã đã được gửi nếu tài khoản tồn tại".
 *  - Sau reset thành công → backend xóa toàn bộ session user → đẩy về login.
 */
type Step = 1 | 2 | 3;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Shared
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Email cú pháp đơn giản
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwdMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPwd = isPasswordStrong(newPassword) && pwdMatch;

  const requestOtp = useMutation({
    mutationFn: async () =>
      (await axiosClient.post('/auth/forgot-password-request', { email })).data,
    onSuccess: () => {
      setInfo('Nếu email tồn tại, một mã OTP đã được gửi đi (kiểm tra hộp thư + spam).');
      setStep(2);
      setResendIn(60);
    },
    onError: () => {
      // Backend luôn trả 200 OK chống User Enumeration; chỉ fail khi lỗi mạng → vẫn cho qua step 2 với thông báo chung
      setInfo('Nếu email tồn tại, một mã OTP đã được gửi đi.');
      setStep(2);
      setResendIn(60);
    },
  });

  const resetPassword = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.post('/auth/reset-password-confirm', {
          email,
          otp,
          newPassword,
        })
      ).data,
    onSuccess: () => {
      navigate('/auth/login?reset=1', { replace: true });
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.message ?? 'Mã OTP không chính xác hoặc đã hết hạn.',
      );
    },
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-viettel-red text-white px-6 py-5">
          <h1 className="text-xl font-bold">Khôi phục mật khẩu</h1>
          <p className="text-sm opacity-90 mt-1">
            Đặt lại mật khẩu cho tài khoản nội bộ Tập đoàn.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-6 py-3 border-b">
          <Dot active={step >= 1} done={step > 1} num={1} label="Email" />
          <Bar on={step >= 2} />
          <Dot active={step >= 2} done={step > 2} num={2} label="OTP" />
          <Bar on={step >= 3} />
          <Dot active={step >= 3} done={false} num={3} label="Mật khẩu mới" />
        </div>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setInfo(null);
                requestOtp.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email tài khoản *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your.name@gmail.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={!emailValid || requestOtp.isPending}
                className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-50"
              >
                {requestOtp.isPending ? 'Đang gửi...' : 'Gửi mã OTP'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Nhớ mật khẩu?{' '}
                <Link to="/auth/login" className="text-viettel-red hover:underline">
                  Quay lại đăng nhập
                </Link>
              </p>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {info && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
                  {info}
                </div>
              )}
              <p className="text-sm text-gray-600 text-center">
                Nhập mã OTP gửi tới <span className="font-semibold">{email}</span>
              </p>
              <OtpInput value={otp} onChange={setOtp} />
              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp('');
                  }}
                  className="text-gray-500 hover:text-viettel-red"
                >
                  ‹ Đổi email
                </button>
                <button
                  type="button"
                  onClick={() => requestOtp.mutate()}
                  disabled={resendIn > 0 || requestOtp.isPending}
                  className="text-viettel-red hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendIn > 0 ? `Gửi lại sau ${resendIn}s` : 'Gửi lại mã'}
                </button>
              </div>
              <button
                onClick={() => {
                  if (otp.length === 6) {
                    setStep(3);
                    setError(null);
                  }
                }}
                disabled={otp.length !== 6}
                className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-50"
              >
                Tiếp tục
              </button>
            </div>
          )}

          {step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                resetPassword.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới *</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full border rounded px-3 py-2 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {showPwd ? '👁' : '👁‍🗨'}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nhập lại mật khẩu *</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`w-full border rounded px-3 py-2 ${
                    confirmPassword && !pwdMatch ? 'border-danger' : ''
                  }`}
                />
                {confirmPassword && !pwdMatch && (
                  <p className="text-xs text-danger mt-1">Hai mật khẩu không khớp.</p>
                )}
              </div>
              {error && (
                <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={!canSubmitPwd || resetPassword.isPending}
                className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-50"
              >
                {resetPassword.isPending ? 'Đang đổi...' : 'Xác nhận đổi mật khẩu'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Mọi phiên đang đăng nhập của bạn sẽ bị thu hồi sau khi đổi mật khẩu.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Dot({
  active,
  done,
  num,
  label,
}: {
  active: boolean;
  done: boolean;
  num: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          done
            ? 'bg-green-500 text-white'
            : active
              ? 'bg-viettel-red text-white'
              : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? '✓' : num}
      </div>
      <span className={`text-xs ${active ? 'font-semibold' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

function Bar({ on }: { on: boolean }) {
  return <div className={`flex-1 h-0.5 mx-2 ${on ? 'bg-viettel-red' : 'bg-gray-200'}`} />;
}
