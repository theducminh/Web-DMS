import { useNavigate } from 'react-router-dom';

/**
 * B6 (Phase 5) — Nút "Quay lại" thông minh.
 *  - Mặc định: history.back() (giống Chrome back button).
 *  - Truyền `to` để force navigate đến route cụ thể (không pop history).
 *  - Truyền `label` để override text.
 *
 * Đặt ở góc trên trái của các sub-page (Settings/Team/Detail/Upload/Review/Diff/Compliance/...)
 * để user không bị "kẹt" và phải dùng nút Back của trình duyệt.
 */
export function BackButton({
  to,
  label = '← Quay lại',
  className = '',
}: {
  to?: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const onClick = () => {
    if (to) navigate(to);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-viettel-red transition-colors ${className}`}
    >
      {label}
    </button>
  );
}
