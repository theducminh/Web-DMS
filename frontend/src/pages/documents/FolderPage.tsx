import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { axiosClient } from '../../shared/api/axiosClient';
import { UploadFolderModal } from '../../features/folder-upload/UploadFolderModal';
import { CreateEmptyFileModal } from '../../features/empty-file/CreateEmptyFileModal';

interface FolderContents {
  currentFolder: { id: string; name: string } | null;
  breadcrumbs: { id: string; name: string }[];
  subFolders: { id: string; name: string; isLocked: boolean; createdAt: string }[];
  documents: Array<{
    id: string;
    title: string;
    securityLevel: string;
    status: string;
    currentVersion: number;
    lockedBy: string | null;
    updatedAt: string;
  }>;
}

export function FolderPage() {
  const { projectId, folderId } = useParams<{ projectId: string; folderId: string }>();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<FolderContents>({
    queryKey: ['folder', projectId, folderId],
    queryFn: async () =>
      (await axiosClient.get(`/projects/${projectId}/folders/${folderId}`)).data,
    enabled: !!projectId && !!folderId,
  });

  // B3 (Phase 5): UI tạo thư mục mới — dialog inline
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // D2/D5 (Phase 5): Upload folder + Create empty file modal
  const [showUploadFolder, setShowUploadFolder] = useState(false);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const createFolder = useMutation({
    mutationFn: async (name: string) =>
      (
        await axiosClient.post(`/projects/${projectId}/folders`, {
          name,
          parentId: data?.currentFolder?.id ?? undefined,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder', projectId, folderId] });
      setShowCreate(false);
      setNewFolderName('');
      setCreateError(null);
    },
    onError: (err: any) => {
      setCreateError(err?.response?.data?.message ?? 'Không tạo được thư mục.');
    },
  });

  if (isLoading) return <div className="text-gray-500">Đang tải nội dung thư mục...</div>;
  if (error) return <div className="text-danger">Không truy cập được thư mục.</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-600 flex flex-wrap items-center gap-1">
        {data.breadcrumbs.map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-400">›</span>}
            {i === 0 ? (
              <Link to={`/projects/${projectId}/folders/root`} className="hover:text-viettel-red">
                {b.name}
              </Link>
            ) : (
              <Link
                to={`/projects/${projectId}/folders/${b.id}`}
                className="hover:text-viettel-red"
              >
                {b.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">{data.currentFolder?.name ?? 'Thư mục gốc'}</h1>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 border border-viettel-red text-viettel-red rounded hover:bg-red-50"
          >
            + Tạo thư mục
          </button>
          <button
            onClick={() => setShowCreateFile(true)}
            className="px-3 py-1.5 border border-viettel-red text-viettel-red rounded hover:bg-red-50"
          >
            📄 Tạo file trống
          </button>
          <button
            onClick={() => setShowUploadFolder(true)}
            className="px-3 py-1.5 border border-viettel-red text-viettel-red rounded hover:bg-red-50"
          >
            📂 Upload thư mục
          </button>
          <Link
            to={`/projects/${projectId}/documents/upload?folderId=${folderId ?? 'root'}`}
            className="px-3 py-1.5 bg-viettel-red text-white rounded hover:bg-red-700"
          >
            📤 Tải lên file
          </Link>
          <Link
            to={`/projects/${projectId}/team`}
            className="text-viettel-red hover:underline"
          >
            👥 Đội ngũ
          </Link>
          <Link
            to={`/projects/${projectId}/settings`}
            className="text-viettel-red hover:underline"
          >
            ⚙️ Settings
          </Link>
          <Link
            to={`/projects/${projectId}/releases`}
            className="text-viettel-red hover:underline"
          >
            📦 Đợt phát hành →
          </Link>
        </div>
      </div>

      {/* Sub-folders */}
      <section>
        <h2 className="font-semibold text-sm text-gray-500 uppercase mb-2">Thư mục con</h2>
        {data.subFolders.length === 0 ? (
          <div className="text-sm text-gray-400">(không có)</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.subFolders.map((f) => (
              <Link
                key={f.id}
                to={`/projects/${projectId}/folders/${f.id}`}
                className="bg-white rounded shadow hover:shadow-md p-3 flex items-center gap-2"
              >
                <span className="text-2xl">{f.isLocked ? '🔒' : '📁'}</span>
                <span className="text-sm font-medium truncate">{f.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Documents */}
      <section>
        <h2 className="font-semibold text-sm text-gray-500 uppercase mb-2">Tài liệu</h2>
        {data.documents.length === 0 ? (
          <div className="text-sm text-gray-400">(chưa có)</div>
        ) : (
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Tài liệu</th>
                  <th className="px-4 py-2">Cấp độ mật</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2">Version</th>
                  <th className="px-4 py-2">Khóa bởi</th>
                  <th className="px-4 py-2">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.documents.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        to={`/documents/${d.id}/detail`}
                        className="hover:text-viettel-red"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100">
                        {d.securityLevel}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          d.status === 'RELEASED'
                            ? 'bg-green-100 text-green-700'
                            : d.status === 'UNDER_REVIEW'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">v{d.currentVersion}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {d.lockedBy ? (
                        <Link
                          to={`/users/${d.lockedBy}`}
                          className="hover:text-viettel-red"
                          title="Xem hồ sơ người đang giữ khóa"
                        >
                          🔒 {d.lockedBy.slice(0, 8)}…
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(d.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showUploadFolder && projectId && (
        <UploadFolderModal
          projectId={projectId}
          parentFolderId={data.currentFolder?.id ?? null}
          onClose={() => setShowUploadFolder(false)}
        />
      )}

      {showCreateFile && projectId && (
        <CreateEmptyFileModal
          projectId={projectId}
          folderId={data.currentFolder?.id ?? null}
          onClose={() => setShowCreateFile(false)}
        />
      )}

      {/* Create folder modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Tạo thư mục mới</h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
                className="text-gray-400 hover:text-danger"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Vị trí: <b>{data.currentFolder?.name ?? 'Thư mục gốc'}</b>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newFolderName.trim().length === 0) return;
                createFolder.mutate(newFolderName.trim());
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tên thư mục *</label>
                <input
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    setCreateError(null);
                  }}
                  autoFocus
                  required
                  minLength={1}
                  placeholder="VD: Vong_1"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              {createError && (
                <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {createError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError(null);
                  }}
                  className="flex-1 border rounded py-2 text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createFolder.isPending}
                  className="flex-1 bg-viettel-red text-white rounded py-2 text-sm font-medium disabled:opacity-50"
                >
                  {createFolder.isPending ? 'Đang tạo...' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
