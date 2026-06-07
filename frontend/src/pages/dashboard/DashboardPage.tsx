import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { axiosClient } from '../../shared/api/axiosClient';

interface Summary {
  assignedProjectsCount: number;
  pendingMyReviewCount: number;
  recentDocuments: Array<{ id: string; title: string; updatedAt: string; status?: string }>;
}

interface MyLock {
  docId: string;
  title: string;
  projectId: string;
  projectName: string;
  ttlSeconds: number;
}
interface MyLocksResponse {
  locks: MyLock[];
}

export function DashboardPage() {
  const qc = useQueryClient();

  const summary = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await axiosClient.get('/dashboard/summary')).data,
  });

  // D1 (Phase 5): poll mỗi 60s để hiển thị doc đang lock realtime
  const locks = useQuery<MyLocksResponse>({
    queryKey: ['my-locks'],
    queryFn: async () => (await axiosClient.get('/dashboard/my-locks')).data,
    refetchInterval: 60_000,
  });

  const releaseLock = useMutation({
    mutationFn: async (docId: string) =>
      (await axiosClient.delete(`/documents/${docId}/lock`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-locks'] });
      qc.invalidateQueries({ queryKey: ['document'] });
    },
  });

  if (summary.isLoading) return <div className="text-gray-500">Đang tải số liệu tổng quan...</div>;
  if (summary.error) return <div className="text-danger">Không tải được dashboard.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Workspace</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Dự án tham gia" value={summary.data?.assignedProjectsCount ?? 0} icon="📁" />
        <StatCard label="Chờ tôi duyệt" value={summary.data?.pendingMyReviewCount ?? 0} icon="⚖️" />
        <StatCard label="Doc gần đây" value={summary.data?.recentDocuments?.length ?? 0} icon="📄" />
        <StatCard
          label="Đang giữ khóa"
          value={locks.data?.locks?.length ?? 0}
          icon="🔒"
          highlight={(locks.data?.locks?.length ?? 0) > 0}
        />
      </div>

      {/* D1 (Phase 5): Card "Tài liệu đang giữ khóa" — trả khóa inline */}
      {locks.data && locks.data.locks.length > 0 && (
        <section className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-yellow-800 flex items-center gap-2">
              🔒 Bạn đang giữ khóa biên tập {locks.data.locks.length} tài liệu
            </h2>
            <p className="text-xs text-yellow-700">
              Trả khóa khi không còn sửa để người khác có thể chỉnh sửa.
            </p>
          </div>
          <ul className="space-y-2">
            {locks.data.locks.map((l) => {
              const minutes = Math.floor(l.ttlSeconds / 60);
              const ttlBadge =
                l.ttlSeconds < 0
                  ? '∞ vĩnh viễn'
                  : minutes < 60
                    ? `${minutes}p`
                    : `${Math.floor(minutes / 60)}h${minutes % 60}p`;
              return (
                <li
                  key={l.docId}
                  className="bg-white rounded shadow-sm px-4 py-2 flex items-center gap-3"
                >
                  <span className="text-xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/documents/${l.docId}/detail`}
                      className="font-medium hover:text-viettel-red truncate block"
                    >
                      {l.title}
                    </Link>
                    <div className="text-xs text-gray-500">
                      Dự án:{' '}
                      <Link
                        to={`/projects/${l.projectId}/folders/root`}
                        className="hover:text-viettel-red"
                      >
                        {l.projectName}
                      </Link>{' '}
                      · TTL còn: <span className="font-mono">{ttlBadge}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Trả khóa cho tài liệu "${l.title}"?`))
                        releaseLock.mutate(l.docId);
                    }}
                    disabled={releaseLock.isPending}
                    className="text-xs px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium disabled:opacity-50"
                  >
                    🔓 Trả khóa
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold mb-3">Tài liệu truy cập gần đây</h2>
        {!summary.data?.recentDocuments?.length ? (
          <div className="text-sm text-gray-500">Chưa có tài liệu nào.</div>
        ) : (
          <ul className="divide-y">
            {summary.data.recentDocuments.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between">
                <Link
                  to={`/documents/${d.id}/detail`}
                  className="font-medium text-viettel-red hover:underline"
                >
                  {d.title}
                </Link>
                <span className="text-xs text-gray-500">
                  {new Date(d.updatedAt).toLocaleString()} {d.status && `· ${d.status}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg shadow p-5 ${highlight ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-white'}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div>
          <div className={`text-3xl font-bold ${highlight ? 'text-yellow-700' : 'text-viettel-red'}`}>
            {value}
          </div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
