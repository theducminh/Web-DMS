import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * D3 (Phase 5) — Trang profile PUBLIC của user khác.
 *  - Hiển thị minimal info (không có phone/dob — privacy).
 *  - Truy cập qua /users/:userId (link từ "Khóa bởi <uuid>" trong FolderPage/DocumentDetailPage).
 */
interface PublicProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string | null;
  department: { name: string } | null;
  title: string | null;
  clearanceLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
  authProvider: 'LOCAL' | 'GOOGLE';
  createdAt: string;
}

const CLEARANCE_COLOR: Record<string, string> = {
  PUBLIC: 'bg-gray-100 text-gray-700',
  INTERNAL: 'bg-yellow-100 text-yellow-700',
  CONFIDENTIAL: 'bg-red-100 text-red-700',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  DISABLED: 'bg-red-100 text-red-700',
};

export function UserPublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const profile = useQuery<PublicProfile>({
    queryKey: ['public-profile', userId],
    queryFn: async () => (await axiosClient.get(`/profile/public/${userId}`)).data,
    enabled: !!userId,
  });

  if (profile.isLoading)
    return <div className="text-gray-500">Đang tải hồ sơ...</div>;
  if (profile.error || !profile.data)
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-white rounded shadow p-6 text-center">
          <div className="text-4xl mb-2">🚫</div>
          <p className="text-danger">
            {(profile.error as any)?.response?.data?.message ?? 'Không tìm thấy người dùng.'}
          </p>
        </div>
      </div>
    );

  const p = profile.data;

  return (
    <div className="space-y-4 max-w-2xl">
      <BackButton />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-viettel-red to-red-700 text-white px-6 py-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white text-viettel-red flex items-center justify-center text-3xl font-bold shrink-0">
            {p.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{p.fullName}</h1>
            <p className="text-sm opacity-90 truncate">{p.email}</p>
            {p.displayName && p.displayName !== p.fullName && (
              <p className="text-xs opacity-75 mt-1">@{p.displayName}</p>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Phòng ban"
            value={p.department?.name ?? <span className="text-gray-400">— Chưa gán —</span>}
            icon="🏢"
          />
          <Field
            label="Chức danh"
            value={p.title ?? <span className="text-gray-400">—</span>}
            icon="💼"
          />
          <Field
            label="Cấp độ bảo mật"
            value={
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${CLEARANCE_COLOR[p.clearanceLevel]}`}>
                {p.clearanceLevel}
              </span>
            }
            icon="🔐"
          />
          <Field
            label="Trạng thái"
            value={
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLOR[p.status]}`}>
                {p.status}
              </span>
            }
            icon="🟢"
          />
          <Field
            label="Đăng nhập qua"
            value={p.authProvider === 'GOOGLE' ? '🌐 Google SSO' : '🔐 LOCAL'}
            icon="🔑"
          />
          <Field
            label="Ngày tham gia"
            value={new Date(p.createdAt).toLocaleDateString('vi-VN')}
            icon="📅"
          />
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">User ID</div>
            <div className="font-mono text-xs text-gray-700 break-all">{p.id}</div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-3 text-xs text-gray-500 border-t">
          🛡️ Trang public — chỉ hiển thị thông tin định danh. Số điện thoại, ngày sinh, lịch sử
          truy cập chỉ admin xem được.
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <Link to="/projects" className="hover:text-viettel-red">
          ‹ Về danh sách dự án
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: string;
}) {
  return (
    <div className="border-l-4 border-viettel-red pl-3">
      <div className="text-xs text-gray-500 mb-0.5">
        <span className="mr-1">{icon}</span>
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
