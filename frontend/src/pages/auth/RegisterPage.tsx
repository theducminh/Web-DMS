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
 * Luồng 02 — Employee Registration.
 *  - Card-based / Stepper 2 bước (info → OTP).
 *  - Smooth Transition slide (CSS transform).
 *  - Validation real-time: password strength, DOB không tương lai.
 *  - OTP: 6 ô vuông + resend cooldown 60s.
 *  - Sau verify: status PENDING, chờ Admin duyệt → đẩy về login với thông báo.
 */
type Step = 1 | 2;

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 fields
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  const requestOtp = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.post('/auth/register-request', {
          fullName,
          email,
          dob: dob || undefined,
          gender,
          password,
        })
      ).data,
    onSuccess: () => {
      setStep(2);
      setResendIn(60);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setStep1Error(
        Array.isArray(msg) ? msg.join('. ') : msg ?? 'Không gửi được mã. Thử lại.',
      );
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async () =>
      (await axiosClient.post('/auth/verify-register-otp', { email, otp })).data,
    onSuccess: () => {
      navigate('/auth/login?registered=1', { replace: true });
    },
    onError: (err: any) => {
      setOtpError(
        err?.response?.data?.message ?? 'Mã OTP không chính xác hoặc đã hết hạn.',
      );
    },
  });

  // Resend cooldown tick
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const onStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    if (!isPasswordStrong(password)) {
      setStep1Error('Mật khẩu chưa đủ mạnh — xem checklist bên dưới.');
      return;
    }
    if (dob && dob > today) {
      setStep1Error('Ngày sinh không thể ở tương lai.');
      return;
    }
    requestOtp.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-viettel-red text-white px-6 py-5">
          <h1 className="text-xl font-bold">Đăng ký tài khoản nhân sự</h1>
          <p className="text-sm opacity-90 mt-1">
            Sau khi đăng ký, tài khoản ở trạng thái <b>PENDING</b> chờ Admin phê duyệt.
          </p>
        </div>

        {/* Stepper bar */}
        <div className="flex items-center px-6 py-3 border-b">
          <StepDot active={step >= 1} done={step > 1} num={1} label="Thông tin" />
          <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-viettel-red' : 'bg-gray-200'}`} />
          <StepDot active={step >= 2} done={false} num={2} label="Xác thực email" />
        </div>

        {/* Slide content */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(${step === 1 ? '0%' : '-100%'})` }}
          >
            {/* Step 1: form */}
            <form onSubmit={onStep1Submit} className="w-full shrink-0 p-6 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Họ và tên *</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your.name@gmail.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={dob}
                    max={today}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Giới tính</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mật khẩu *</label>
                <div className="relative">
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border rounded px-3 py-2 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {passwordVisible ? '👁' : '👁‍🗨'}
                  </button>
                </div>
                <PasswordStrengthMeter password={password} />
              </div>

              {step1Error && (
                <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {step1Error}
                </div>
              )}

              <button
                type="submit"
                disabled={requestOtp.isPending}
                className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-50"
              >
                {requestOtp.isPending ? 'Đang gửi mã...' : 'Tiếp tục — Gửi mã xác thực'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Đã có tài khoản?{' '}
                <Link to="/auth/login" className="text-viettel-red hover:underline">
                  Đăng nhập
                </Link>
              </p>
            </form>

            {/* Step 2: OTP */}
            <div className="w-full shrink-0 p-6 space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-2">📧</div>
                <p className="text-sm text-gray-600">
                  Chúng tôi đã gửi mã OTP gồm 6 chữ số đến
                  <br />
                  <span className="font-semibold">{email || '(email của bạn)'}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Mã có hiệu lực trong 5 phút.</p>
              </div>

              <OtpInput value={otp} onChange={setOtp} disabled={verifyOtp.isPending} />

              {otpError && (
                <div className="text-sm text-danger text-center bg-red-50 px-3 py-2 rounded">
                  {otpError}
                </div>
              )}

              <button
                onClick={() => verifyOtp.mutate()}
                disabled={otp.length !== 6 || verifyOtp.isPending}
                className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-50"
              >
                {verifyOtp.isPending ? 'Đang xác thực...' : 'Xác thực & Tạo tài khoản'}
              </button>

              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp('');
                    setOtpError(null);
                  }}
                  className="text-gray-500 hover:text-viettel-red"
                >
                  ‹ Quay lại sửa thông tin
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDot({
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
    <div className="flex items-center gap-2">
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
