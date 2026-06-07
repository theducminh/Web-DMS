import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

interface ReleaseRow {
  id: string;
  releaseName: string;
  status: 'PROCESSING' | 'VERIFIED' | 'VIOLATED';
  complianceScore: number | null;
  templateType: string | null;
  documentCount: number;
  frozenAt: string | null;
  createdAt: string;
}

export function ReleaseListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const releases = useQuery<ReleaseRow[]>({
    queryKey: ['releases', projectId],
    queryFn: async () => (await axiosClient.get(`/projects/${projectId}/releases`)).data,
    enabled: !!projectId,
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tmplType, setTmplType] = useState('SOFTWARE_DEV');
  const [description, setDescription] = useState('');
  const createRel = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.post(`/projects/${projectId}/releases`, {
          releaseName: name,
          templateType: tmplType,
          description,
        })
      ).data,
    onSuccess: () => {
      setOpen(false);
      setName('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['releases', projectId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Đợt phát hành (Release Packages)</h1>
        <button onClick={() => setOpen(true)} className="bg-viettel-red text-white px-4 py-2 rounded">
          + Khởi tạo đợt chốt
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600 text-left">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Điểm tuân thủ</th>
              <th className="px-3 py-2">Template</th>
              <th className="px-3 py-2">Tài liệu</th>
              <th className="px-3 py-2">Đóng băng lúc</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {releases.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-500">
                  Đang tải...
                </td>
              </tr>
            )}
            {releases.data?.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.releaseName}</td>
                <td className="px-3 py-2">
                  <ReleaseStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-sm font-semibold ${
                      r.complianceScore === 100 ? 'text-green-700' : 'text-danger'
                    }`}
                  >
                    {r.complianceScore ?? '—'}%
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{r.templateType ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{r.documentCount}</td>
                <td className="px-3 py-2 text-xs">
                  {r.frozenAt ? new Date(r.frozenAt).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/projects/${projectId}/releases/${r.id}`}
                    className="text-viettel-red hover:underline text-sm"
                  >
                    Xem chi tiết →
                  </Link>
                </td>
              </tr>
            ))}
            {releases.data && releases.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-gray-500 text-center">
                  Chưa có đợt phát hành nào. Bấm "Khởi tạo đợt chốt".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">Khởi tạo đợt phát hành</h3>
            <label className="block text-xs mb-1">Tên đợt</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Sprint_1_MVP"
              className="w-full border rounded px-3 py-2 mb-3"
            />
            <label className="block text-xs mb-1">Template Type</label>
            <input
              value={tmplType}
              onChange={(e) => setTmplType(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3 font-mono text-sm"
            />
            <label className="block text-xs mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 border rounded">
                Hủy
              </button>
              <button
                onClick={() => createRel.mutate()}
                disabled={createRel.isPending || !name}
                className="flex-1 py-2 bg-viettel-red text-white rounded disabled:opacity-50"
              >
                {createRel.isPending ? 'Đang chốt...' : 'Chốt hồ sơ'}
              </button>
            </div>
            {createRel.error && (
              <div className="text-xs text-danger mt-2">
                {(createRel.error as any)?.response?.data?.message ?? 'Lỗi'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReleaseStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    VERIFIED: 'bg-green-100 text-green-700',
    VIOLATED: 'bg-red-100 text-danger animate-pulse',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${map[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  );
}
