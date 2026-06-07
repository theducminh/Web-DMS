import { useEffect, useMemo, useState } from 'react';
import { Link, useBeforeUnload, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * Luồng 14 — Project Configuration.
 *  - General block: name + description; Dirty state → enable nút "Lưu cấu hình".
 *  - Beforeunload guard nếu form dirty.
 *  - Danger Zone: Archive Project — Modal đỏ ép gõ tên dự án (case-sensitive) để mở khóa nút.
 *  - Archived: ẩn form general + đổi nút thành Unarchive.
 *  - Backend cascade: archive → unlock toàn bộ document locks (đã handle ở service).
 */
interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  role: 'PM' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER' | 'ADMIN' | null;
  owner: { id: string; fullName: string };
  documentCount: number;
  memberCount: number;
  createdAt: string;
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const project = useQuery<ProjectInfo>({
    queryKey: ['project', projectId],
    queryFn: async () => (await axiosClient.get(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  // Local form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    if (project.data) {
      setName(project.data.name);
      setDescription(project.data.description ?? '');
    }
  }, [project.data]);

  const isDirty = useMemo(() => {
    if (!project.data) return false;
    return (
      name !== project.data.name || description !== (project.data.description ?? '')
    );
  }, [project.data, name, description]);

  // Beforeunload guard
  useBeforeUnload(
    useMemo(
      () => (e: BeforeUnloadEvent) => {
        if (isDirty) {
          e.preventDefault();
          e.returnValue =
            'Thay đổi của bạn chưa được lưu. Bạn có chắc chắn muốn rời đi?';
        }
      },
      [isDirty],
    ),
  );

  const save = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.patch(`/projects/${projectId}`, {
          name,
          description: description || undefined,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const archive = useMutation({
    mutationFn: async () =>
      (await axiosClient.patch(`/projects/${projectId}`, { status: 'ARCHIVED' })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowArchive(false);
    },
  });

  const restore = useMutation({
    mutationFn: async () =>
      (await axiosClient.post(`/projects/${projectId}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (project.isLoading)
    return <div className="text-gray-500">Đang tải cấu hình dự án...</div>;
  if (project.error || !project.data)
    return (
      <div className="text-danger text-sm">
        Không truy cập được dự án.{' '}
        <Link to="/projects" className="underline">
          Quay lại danh sách
        </Link>
      </div>
    );

  const archived = project.data.status === 'ARCHIVED';
  // Backend kiểm assertManager; UI vẫn ẩn nút nếu không phải PM/ADMIN
  const canManage = project.data.role === 'PM' || project.data.role === 'ADMIN';

  return (
    <div className="space-y-4">
      <div>
        <BackButton to={`/projects/${projectId}/folders/root`} label="← Về thư mục dự án" />
        <h1 className="text-2xl font-bold mt-1">
          {project.data.name}
          <span className="text-sm text-gray-500 ml-2">— Cấu hình</span>
        </h1>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          {archived && (
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
              🔒 ARCHIVED — read-only
            </span>
          )}
          <Link
            to={`/projects/${projectId}/folders/root`}
            className="hover:text-viettel-red"
          >
            📁 Thư mục
          </Link>
          <Link to={`/projects/${projectId}/team`} className="hover:text-viettel-red">
            👥 Đội ngũ ({project.data.memberCount})
          </Link>
        </div>
      </div>

      {/* General block */}
      {!archived && (
        <section className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Thông tin chung</h2>
            <div className="text-xs text-gray-400">
              Tạo: {new Date(project.data.createdAt).toLocaleDateString()} · Owner:{' '}
              {project.data.owner.fullName} · {project.data.documentCount} tài liệu
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tên dự án *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                required
                minLength={3}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              {name.length > 0 && name.length < 3 && (
                <p className="text-xs text-danger mt-1">Tối thiểu 3 ký tự.</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!canManage}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-50"
              />
            </div>

            {save.error && (
              <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                {(save.error as any)?.response?.data?.message ?? 'Lỗi cập nhật.'}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs text-gray-500">
                {save.isSuccess && !isDirty && (
                  <span className="text-green-700">✓ Đã lưu cấu hình.</span>
                )}
                {isDirty && (
                  <span className="text-yellow-600">
                    ⚠ Thay đổi chưa lưu — F5/đóng tab sẽ mất.
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={!isDirty || !canManage || save.isPending}
                className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {save.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Archived block — read-only display */}
      {archived && (
        <section className="bg-gray-50 border-2 border-dashed rounded-lg p-5 space-y-2">
          <h2 className="font-semibold text-gray-700">Dự án đang ở trạng thái ARCHIVED</h2>
          <div className="text-sm text-gray-600">
            Toàn bộ tài liệu của dự án đang đóng băng read-only. Mọi document lock đã được giải phóng. Bấm <b>Unarchive</b> bên dưới để khôi phục.
          </div>
          <div className="text-xs text-gray-500">
            <div>Tên: {project.data.name}</div>
            <div>Mô tả: {project.data.description ?? '—'}</div>
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="border-2 border-dashed border-danger rounded-lg p-5">
        <h2 className="font-semibold text-danger flex items-center gap-2">
          ⚠️ Danger Zone
        </h2>
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            {archived ? (
              <>
                <div className="font-medium text-sm">Khôi phục dự án</div>
                <p className="text-xs text-gray-600 mt-1">
                  Đội ngũ sẽ tiếp tục thao tác được. Cây thư mục, members, policies sẽ giữ nguyên.
                </p>
              </>
            ) : (
              <>
                <div className="font-medium text-sm">Archive Project (đóng băng)</div>
                <p className="text-xs text-gray-600 mt-1">
                  Đóng băng toàn bộ tài liệu của dự án về <b>read-only</b>. Mọi document lock hiện hành sẽ bị giải phóng.
                  Audit log lưu vết hành động này (Hash Chaining, không thể xóa).
                </p>
              </>
            )}
          </div>
          {archived ? (
            <button
              onClick={() => {
                if (confirm(`Khôi phục dự án "${project.data!.name}"?`)) restore.mutate();
              }}
              disabled={!canManage || restore.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-40"
            >
              {restore.isPending ? 'Đang khôi phục...' : '🔓 Unarchive Project'}
            </button>
          ) : (
            <button
              onClick={() => setShowArchive(true)}
              disabled={!canManage}
              className="px-4 py-2 bg-danger text-white rounded font-medium hover:bg-red-700 disabled:opacity-40"
            >
              🔒 Archive Project
            </button>
          )}
        </div>
      </section>

      {restore.isSuccess && (
        <div className="text-xs text-green-700">
          ✓ Đã khôi phục — đội ngũ tiếp tục thao tác được.
        </div>
      )}

      {showArchive && (
        <ConfirmArchiveDialog
          projectName={project.data.name}
          onClose={() => setShowArchive(false)}
          onConfirm={() => archive.mutate()}
          isPending={archive.isPending}
          error={(archive.error as any)?.response?.data?.message}
        />
      )}
    </div>
  );
}

function ConfirmArchiveDialog({
  projectName,
  onClose,
  onConfirm,
  isPending,
  error,
}: {
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error?: string;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed === projectName;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 border-2 border-danger">
        <h3 className="font-semibold text-danger flex items-center gap-2 mb-3">
          ⚠️ Xác nhận đóng băng dự án
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Hành động này sẽ <b>đóng băng toàn bộ tài liệu hiện tại về trạng thái Read-only</b> đối
          với tất cả mọi người. Mọi document đang được lock sẽ được giải phóng. Audit log sẽ ghi
          vết hành động (Hash Chaining, không thể xóa).
        </p>
        <p className="text-sm text-gray-700 mb-1">
          Để xác nhận, vui lòng gõ chính xác tên dự án:
        </p>
        <p className="font-mono text-sm bg-gray-100 rounded px-2 py-1 mb-2 select-none">
          {projectName}
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Gõ tên dự án vào đây"
          autoFocus
          className={`w-full border rounded px-3 py-2 ${
            typed.length > 0 && !matches ? 'border-danger' : ''
          }`}
        />

        {error && (
          <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded mt-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 border rounded py-2 text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || isPending}
            className="flex-1 bg-danger text-white rounded py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Đang đóng băng...' : 'Tôi xác nhận đóng băng dự án'}
          </button>
        </div>
      </div>
    </div>
  );
}
