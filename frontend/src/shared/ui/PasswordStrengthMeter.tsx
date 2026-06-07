/**
 * Real-time password strength checklist khớp regex backend:
 *   ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$
 * Trả tuple [score, isValid] ngoài UI để parent disable nút Submit khi chưa đủ mạnh.
 */
import { useMemo } from 'react';

export interface PasswordRules {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
}

export function checkPasswordRules(pwd: string): PasswordRules {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /\d/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

export function isPasswordStrong(pwd: string): boolean {
  const r = checkPasswordRules(pwd);
  return r.length && r.upper && r.lower && r.digit && r.special;
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const passed = Object.values(rules).filter(Boolean).length;
  const pct = (passed / 5) * 100;
  const color =
    passed <= 2 ? 'bg-red-500' : passed <= 4 ? 'bg-yellow-500' : 'bg-green-500';
  const label = passed <= 2 ? 'Yếu' : passed <= 4 ? 'Trung bình' : 'Mạnh';

  return (
    <div className="space-y-2 mt-1">
      <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Độ mạnh:</span>
        <span
          className={
            passed <= 2 ? 'text-danger' : passed <= 4 ? 'text-yellow-600' : 'text-green-600'
          }
        >
          {label}
        </span>
      </div>
      <ul className="text-xs space-y-0.5">
        <Rule ok={rules.length}>≥ 8 ký tự</Rule>
        <Rule ok={rules.upper}>1 chữ hoa (A–Z)</Rule>
        <Rule ok={rules.lower}>1 chữ thường (a–z)</Rule>
        <Rule ok={rules.digit}>1 chữ số (0–9)</Rule>
        <Rule ok={rules.special}>1 ký tự đặc biệt (!@#$...)</Rule>
      </ul>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? 'text-green-600' : 'text-gray-400'}>
      {ok ? '✓' : '○'} {children}
    </li>
  );
}
