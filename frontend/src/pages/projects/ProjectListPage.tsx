import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { axiosClient } from '../../shared/api/axiosClient';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  role: string | null;
  isStarred: boolean;
  owner: string | null;
  documentCount: number;
  memberCount: number;
  createdAt: string;
}
interface ListResponse {
  data: ProjectRow[];
  meta: { totalItems: number; totalPages: number; currentPage: number };
}

export function ProjectListPage() {
  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['projects'],
    queryFn: async () => (await axiosClient.get('/projects?limit=24')).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dự án ({data?.meta?.totalItems ?? 0})</h1>
        <Link
          to="/projects/create"
          className="px-4 py-2 bg-viettel-red text-white rounded font-medium hover:bg-red-700"
        >
          + Tạo dự án mới
        </Link>
      </div>
      {isLoading && <div className="text-gray-500">Đang tải dự án...</div>}
      {error && <div className="text-danger">Không tải được danh sách.</div>}
      {data?.data?.length === 0 && (
        <div className="bg-white rounded p-6 text-gray-500">
          Bạn chưa được gán vào dự án nào. Vui lòng liên hệ Quản trị dự án (PM) hoặc bấm{' '}
          <Link to="/projects/create" className="text-viettel-red hover:underline font-medium">
            + Tạo dự án mới
          </Link>{' '}
          (yêu cầu title = Project Manager / Admin).
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.data?.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5"
          >
            <div className="flex items-start justify-between">
              <Link
                to={`/projects/${p.id}/folders/root`}
                className="font-semibold text-lg hover:text-viettel-red"
              >
                {p.name}
              </Link>
              <StatusBadge status={p.status} />
            </div>
            {p.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
              <span>👤 {p.owner ?? '—'}</span>
              <span>{p.role ?? '-'}</span>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-gray-500">
              <span>📄 {p.documentCount} tài liệu</span>
              <span>👥 {p.memberCount} thành viên</span>
            </div>
            <div className="mt-3 pt-3 border-t flex items-center justify-end gap-3 text-xs">
              <Link
                to={`/projects/${p.id}/team`}
                className="text-gray-500 hover:text-viettel-red"
              >
                Đội ngũ
              </Link>
              <Link
                to={`/projects/${p.id}/settings`}
                className="text-gray-500 hover:text-viettel-red"
              >
                ⚙️ Settings
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-200 text-gray-600';
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}
