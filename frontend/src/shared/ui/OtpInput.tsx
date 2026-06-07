import { useEffect, useRef } from 'react';

/**
 * 6 ô vuông OTP rời rạc:
 *  - Gõ ô 1 tự nhảy ô 2; Backspace ở ô rỗng nhảy ngược.
 *  - Paste 6 số ở bất kỳ ô nào → tự tách ra 6 ô.
 *  - `onComplete` được gọi khi đủ 6 chữ số.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  length?: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Khi đủ 6 chữ số → callback
  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value);
  }, [value, length, onComplete]);

  const setChar = (idx: number, ch: string) => {
    const arr = value.padEnd(length, ' ').split('');
    arr[idx] = ch;
    onChange(arr.join('').replace(/\s+$/, '').slice(0, length));
  };

  const onCharInput = (idx: number, raw: string) => {
    const digit = raw.replace(/[^0-9]/g, '').slice(-1);
    if (!digit) return;
    setChar(idx, digit);
    if (idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        setChar(idx, '');
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        setChar(idx - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
    if (!digits) return;
    onChange(digits);
    const next = Math.min(digits.length, length - 1);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={onPaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => onCharInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-bold border-2 rounded focus:outline-none focus:border-viettel-red disabled:opacity-50 disabled:bg-gray-100"
        />
      ))}
    </div>
  );
}
