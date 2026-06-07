import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { useSessionStore } from '../../entities/session/session.store';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * Luồng 13 — Project Team / Resource Management.
 *  - Bảng thành viên + Inline Dropdown role (spinner per-row khi mutate).
 *  - AddMemberModal Async Select (search /admin/users), tự loại trừ đã có.
 *  - Self-Removal Protection cho PM Owner (dropdown + delete bị khóa cứng).
 *  - Casbin grouping sync ngầm ở backend.
 */
type ProjectRole = 'PM' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER';

interface MemberRow {
  userId: string;
  fullName: string;
  email: string;
  department: string | null;
  projectRole: ProjectRole;
  isOwner: boolean;
  assignedAt: string;
}

interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  title: string | null;
}

interface ProjectInfo {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  role: ProjectRole | 'ADMIN' | null;
}

const ROLES: ProjectRole[] = ['PM', 'CONTRIBUTOR', 'REVIEWER', 'VIEWER'];

const ROLE_BADGE: Record<ProjectRole, string> = {
  PM: 'bg-viettel-red text-white',
  CONTRIBUTOR: 'bg-blue-100 text-blue-700',
  REVIEWER: 'bg-yellow-100 text-yellow-700',
  VIEWER: 'bg-gray-100 text-gray-600',
};

export function ProjectTeamPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const currentUserId = useSessionStore((s) => s.user?.id);

  const project = useQuery<ProjectInfo>({
    queryKey: ['project', projectId],
    queryFn: async () => (await axiosClient.get(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  const members = useQuery<MemberRow[]>({
    queryKey: ['project-members', projectId],
    queryFn: async () => (await axiosClient.get(`/projects/${projectId}/members`)).data,
    enabled: !!projectId,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const updateRole = useMutation({
    mutationFn: async (vars: { userId: string; role: ProjectRole }) => {
      setSavingUserId(vars.userId);
      try {
        const res = await axiosClient.patch(
          `/projects/${projectId}/members/${vars.userId}`,
          { projectRole: vars.role },
        );
        return res.data;
      } finally {
        setSavingUserId(null);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) =>
      (await axiosClient.delete(`/projects/${projectId}/members/${userId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  });

  const addMember = useMutation({
    mutationFn: async (vars: { userId: string; projectRole: ProjectRole }) =>
      (await axiosClient.post(`/projects/${projectId}/members`, vars)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      setShowAdd(false);
    },
  });

  const isReadOnly = project.data?.status === 'ARCHIVED';
  // Manager = PM Owner / PM thường / Admin (assertManager backend xử lý)
  const canManage =
    !isReadOnly &&
    (project.data?.role === 'PM' || project.data?.role === 'ADMIN');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <BackButton to={`/projects/${projectId}/folders/root`} label="← Về thư mục dự án" />
          <h1 className="text-2xl font-bold mt-1">
            {project.data?.name ?? 'Đang tải...'}
            <span className="text-sm text-gray-500 ml-2">— Đội ngũ</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            {project.data?.status === 'ARCHIVED' && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                🔒 ARCHIVED (read-only)
              </span>
            )}
            <Link
              to={`/projects/${projectId}/folders/root`}
              className="hover:text-viettel-red"
            >
              📁 Thư mục
            </Link>
            <Link
              to={`/projects/${projectId}/settings`}
              className="hover:text-viettel-red"
            >
              ⚙️ Settings
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Tổng <b>{members.data?.length ?? 0}</b> thành viên
          </span>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!canManage}
            title={!canManage ? 'Chỉ PM / Admin được quản trị đội ngũ' : ''}
            className="px-4 py-2 bg-viettel-red text-white rounded font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Thêm nhân sự
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {members.isLoading && (
          <div className="p-6 text-sm text-gray-500">Đang tải đội ngũ...</div>
        )}
        {members.error && (
          <div className="p-6 text-sm text-danger">
            Không tải được đội ngũ.{' '}
            {(members.error as any)?.response?.data?.message ?? ''}
          </div>
        )}
        {members.data && members.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Nhân sự</th>
                <th className="px-4 py-2">Phòng ban</th>
                <th className="px-4 py-2 w-44">Vai trò dự án</th>
                <th className="px-4 py-2">Ngày tham gia</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.data.map((m) => {
                const isSelf = m.userId === currentUserId;
                const isOwnerRow = m.isOwner;
                const dropdownDisabled =
                  !canManage || isOwnerRow || savingUserId === m.userId;
                const deleteDisabled = !canManage || isOwnerRow || isSelf;

                return (
                  <tr key={m.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-viettel-red text-white flex items-center justify-center text-xs font-bold">
                          {m.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {m.fullName}
                            {isSelf && (
                              <span className="text-xs text-gray-500">(bạn)</span>
                            )}
                            {isOwnerRow && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                👑 Owner
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">{m.department ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={m.projectRole}
                          disabled={dropdownDisabled}
                          onChange={(e) =>
                            updateRole.mutate({
                              userId: m.userId,
                              role: e.target.value as ProjectRole,
                            })
                          }
                          className={`text-xs border rounded px-2 py-1 ${
                            ROLE_BADGE[m.projectRole]
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                          title={
                            isOwnerRow
                              ? 'Không thể đổi vai trò của PM Owner (Self-Removal Protection)'
                              : !canManage
                                ? 'Chỉ PM/Admin được sửa vai trò'
                                : ''
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        {savingUserId === m.userId && (
                          <span className="text-xs text-gray-400">⏳</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(m.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        disabled={deleteDisabled}
                        onClick={() => {
                          if (
                            confirm(
                              `Xóa ${m.fullName} khỏi dự án? Casbin grouping policy của họ cũng sẽ bị gỡ.`,
                            )
                          )
                            removeMember.mutate(m.userId);
                        }}
                        title={
                          isOwnerRow
                            ? 'Không thể xóa PM Owner khỏi dự án'
                            : isSelf
                              ? 'Không thể tự xóa bản thân (Self-Removal Protection)'
                              : !canManage
                                ? 'Chỉ PM/Admin được xóa thành viên'
                                : 'Xóa khỏi dự án'
                        }
                        className="text-danger hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {updateRole.isSuccess && (
        <div className="text-xs text-green-700">
          ✓ Đã đồng bộ Casbin grouping policy + evict ABAC cache.
        </div>
      )}
      {updateRole.error && (
        <div className="text-xs text-danger">
          {(updateRole.error as any)?.response?.data?.message ?? 'Lỗi cập nhật'}
        </div>
      )}

      {showAdd && projectId && (
        <AddMemberModal
          projectId={projectId}
          excludedIds={new Set(members.data?.map((m) => m.userId) ?? [])}
          onClose={() => setShowAdd(false)}
          onPick={(userId, projectRole) => addMember.mutate({ userId, projectRole })}
          isPending={addMember.isPending}
          error={(addMember.error as any)?.response?.data?.message}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  projectId,
  excludedIds,
  onClose,
  onPick,
  isPending,
  error,
}: {
  projectId: string;
  excludedIds: Set<string>;
  onClose: () => void;
  onPick: (userId: string, projectRole: ProjectRole) => void;
  isPending: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState<ProjectRole>('CONTRIBUTOR');
  const t = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t.current);
  }, [search]);

  // B1 (Phase 5): dùng /projects/:pid/members/searchable (PM gọi được, tự exclude existing members)
  const candidates = useQuery<AdminUserRow[]>({
    queryKey: ['member-searchable', projectId, debounced],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('limit', '15');
      if (debounced) p.set('q', debounced);
      return (await axiosClient.get(`/projects/${projectId}/members/searchable?${p}`)).data;
    },
    placeholderData: keepPreviousData,
  });

  // Backend đã exclude existing members, nhưng để chắc UI vẫn double-filter
  const list = useMemo(
    () => candidates.data?.filter((u) => !excludedIds.has(u.id)) ?? [],
    [candidates.data, excludedIds],
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">Thêm nhân sự vào dự án</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-danger">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vai trò khi thêm</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectRole)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tìm nhân sự</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gõ tên hoặc email... (debounce 300ms)"
              autoFocus
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {candidates.error && (
            <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              Không tải được danh bạ:{' '}
              {(candidates.error as any)?.response?.data?.message ?? 'Lỗi mạng'}
            </div>
          )}

          {error && (
            <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-5 pb-5">
          {candidates.isLoading && (
            <div className="text-sm text-gray-500">Đang tìm...</div>
          )}
          <ul className="space-y-1">
            {list.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 bg-gray-50 hover:bg-yellow-50 rounded px-3 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-viettel-red text-white flex items-center justify-center text-xs font-bold">
                  {u.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.fullName}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {u.email}
                    {u.department && <> · {u.department}</>}
                  </div>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => onPick(u.id, role)}
                  className="text-xs px-3 py-1 bg-viettel-red text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  + Thêm
                </button>
              </li>
            ))}
            {!candidates.isLoading && list.length === 0 && (
              <li className="text-xs text-gray-500 text-center py-6">
                {search ? 'Không có nhân sự khớp.' : 'Gõ tên để tìm...'}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
