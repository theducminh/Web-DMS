import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * Luồng 11 — Project Initialization Wizard.
 *  - Card-based 2-step Stepper:
 *    Step 1: tên/mô tả + chọn Template (radio cards) + Preview Tree.
 *    Step 2: tìm + gán initial members (role PM/CONTRIBUTOR/REVIEWER/VIEWER).
 *  - Backend ACID transaction sinh folder + Casbin grouping + audit.
 *  - User tạo dự án mặc định là PM Owner (auto-added).
 *  - Loading Placement: bấm "Khởi tạo" → khóa nút Quay lại để bảo vệ transaction.
 */
type Step = 1 | 2;
type ProjectRole = 'PM' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER';

interface FolderNode {
  name: string;
  parentPath: string | null;
  isLocked: boolean;
  displayOrder: number;
  description: string | null;
  children: FolderNode[];
}
interface Template {
  id: string;
  name: string;
  templateType: string;
  description: string | null;
  folders: FolderNode[];
}
interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  title: string | null;
}
interface InitialMember {
  userId: string;
  fullName: string;
  email: string;
  projectRole: ProjectRole;
}

const ROLES: ProjectRole[] = ['PM', 'CONTRIBUTOR', 'REVIEWER', 'VIEWER'];

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<string>('');

  // Step 2 state
  const [members, setMembers] = useState<InitialMember[]>([]);

  // Template list
  const templates = useQuery<Template[]>({
    queryKey: ['project-templates'],
    queryFn: async () => (await axiosClient.get('/project-templates')).data,
  });
  const selectedTpl = templates.data?.find((t) => t.templateType === templateType) ?? null;

  // Search nhân sự — dùng /admin/users (yêu cầu admin; với non-admin sẽ 403 — backend limitation note)
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const tRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(tRef.current);
  }, [search]);

  // B1 (Phase 5): dùng endpoint /profile/searchable (mọi user authenticated gọi được),
  // thay vì /admin/users (yêu cầu admin → PM bị 403).
  const userSearch = useQuery<AdminUserRow[]>({
    queryKey: ['profile-searchable', searchDebounced],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('limit', '15');
      if (searchDebounced) p.set('q', searchDebounced);
      return (await axiosClient.get(`/profile/searchable?${p}`)).data;
    },
    placeholderData: keepPreviousData,
  });

  const excludeIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const filteredCandidates =
    userSearch.data?.filter((u) => !excludeIds.has(u.id)) ?? [];

  const addMember = (u: AdminUserRow, role: ProjectRole = 'CONTRIBUTOR') => {
    setMembers((cur) => [
      ...cur,
      { userId: u.id, fullName: u.fullName, email: u.email, projectRole: role },
    ]);
  };
  const removeMember = (userId: string) =>
    setMembers((cur) => cur.filter((m) => m.userId !== userId));
  const changeRole = (userId: string, role: ProjectRole) =>
    setMembers((cur) => cur.map((m) => (m.userId === userId ? { ...m, projectRole: role } : m)));

  // Submit
  const create = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.post('/projects', {
          name,
          description: description || undefined,
          templateType: templateType || undefined,
          initialMembers: members.map((m) => ({ userId: m.userId, projectRole: m.projectRole })),
        })
      ).data,
    onSuccess: (data: { projectId: string }) => {
      // Sau khi tạo, vào folder gốc dự án mới
      navigate(`/projects/${data.projectId}/folders/root`, { replace: true });
    },
  });

  const canNext1 = name.trim().length >= 3;
  const submitDisabled = create.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/projects" className="text-xs text-gray-500 hover:text-viettel-red">
            ‹ Dự án
          </Link>
          <h1 className="text-2xl font-bold mt-1">Khởi tạo dự án mới</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sinh cây thư mục chuẩn theo template + Casbin grouping policy trong cùng một ACID transaction.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Stepper */}
        <div className="flex items-center px-6 py-3 border-b">
          <Dot active={step >= 1} done={step > 1} num={1} label="Thông tin & cấu trúc" />
          <Bar on={step >= 2} />
          <Dot active={step >= 2} done={false} num={2} label="Cơ cấu đội ngũ" />
        </div>

        <div className="p-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tên dự án *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    placeholder="VD: Hệ thống Quản lý Tài liệu VDT 2026"
                    className="w-full border rounded px-3 py-2"
                  />
                  {name.length > 0 && name.length < 3 && (
                    <p className="text-xs text-danger mt-1">Tên dự án tối thiểu 3 ký tự.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mô tả ngắn</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mục tiêu / phạm vi"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Chọn mẫu cây thư mục</h2>
                  <Link
                    to="/admin/project-templates"
                    className="text-xs text-gray-500 hover:text-viettel-red"
                  >
                    + Cấu hình template (Admin)
                  </Link>
                </div>
                {templates.isLoading && (
                  <div className="text-sm text-gray-500">Đang tải template...</div>
                )}
                {templates.data && templates.data.length === 0 && (
                  <div className="border-2 border-dashed rounded p-6 text-sm text-gray-500 text-center">
                    Chưa có template nào đang active. Admin vào{' '}
                    <Link to="/admin/project-templates" className="text-viettel-red hover:underline">
                      Project Templates
                    </Link>{' '}
                    để tạo.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* "Không dùng template" option */}
                  <button
                    type="button"
                    onClick={() => setTemplateType('')}
                    className={`text-left border-2 rounded-lg p-3 hover:border-gray-400 ${
                      templateType === '' ? 'border-viettel-red bg-red-50' : ''
                    }`}
                  >
                    <div className="font-semibold text-sm">📭 Không dùng template</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Tạo dự án rỗng — PM tự xây cây thư mục sau.
                    </p>
                  </button>
                  {templates.data?.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateType(t.templateType)}
                      className={`text-left border-2 rounded-lg p-3 hover:border-gray-400 ${
                        templateType === t.templateType
                          ? 'border-viettel-red bg-red-50'
                          : ''
                      }`}
                    >
                      <div className="font-semibold text-sm">📐 {t.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">{t.templateType}</div>
                      {t.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview tree */}
              {selectedTpl && (
                <div className="bg-gray-50 rounded p-4">
                  <h3 className="text-sm font-semibold mb-2">
                    Preview — cây thư mục sẽ được sinh
                  </h3>
                  {selectedTpl.folders.length === 0 ? (
                    <p className="text-xs text-gray-500">(Template này chưa cấu hình thư mục.)</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {selectedTpl.folders.map((root) => (
                        <PreviewNode key={root.name} node={root} depth={0} />
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-gray-500">
                    🔒 = thư mục cốt lõi (chuẩn tập đoàn — không xóa/đổi tên). 📁 = tùy chọn,
                    PM có thể thêm/xóa con sau.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canNext1}
                  className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-40"
                >
                  Tiếp tục → Cơ cấu đội ngũ
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold">Tìm nhân sự thêm vào dự án</h2>
                <p className="text-xs text-gray-500 mb-2">
                  PM (người tạo dự án) tự động được thêm với vai trò <b>PM Owner</b>. Có thể bỏ qua bước này và mời thêm sau ở Team page.
                </p>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Gõ tên hoặc email để tìm... (debounce 300ms)"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Candidates */}
              <div className="bg-gray-50 rounded p-3 max-h-60 overflow-auto">
                {userSearch.isLoading && (
                  <div className="text-sm text-gray-500">Đang tìm...</div>
                )}
                {userSearch.error && (
                  <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                    Không tải được danh bạ nhân sự:{' '}
                    {(userSearch.error as any)?.response?.data?.message ?? 'Lỗi mạng'}
                  </div>
                )}
                {filteredCandidates.length === 0 && !userSearch.isLoading && !userSearch.error && (
                  <div className="text-xs text-gray-500">
                    {search ? 'Không có nhân sự khớp.' : 'Gõ tên để tìm...'}
                  </div>
                )}
                <ul className="space-y-1">
                  {filteredCandidates.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 bg-white rounded px-3 py-2 hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-full bg-viettel-red text-white flex items-center justify-center text-xs font-bold">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.fullName}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.email}
                          {u.department && <> · {u.department}</>}
                          {u.title && <> · {u.title}</>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addMember(u, 'CONTRIBUTOR')}
                        className="text-xs px-3 py-1 bg-viettel-red text-white rounded hover:bg-red-700"
                      >
                        + Thêm
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Picked members */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Đã chọn ({members.length}) — bạn (PM Owner) sẽ tự động được thêm
                </h3>
                {members.length === 0 ? (
                  <p className="text-xs text-gray-500">Chưa chọn ai. Có thể tạo dự án trống và mời sau.</p>
                ) : (
                  <ul className="divide-y bg-white rounded shadow-sm overflow-hidden">
                    {members.map((m) => (
                      <li key={m.userId} className="flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-bold">
                          {m.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{m.fullName}</div>
                          <div className="text-xs text-gray-500 truncate">{m.email}</div>
                        </div>
                        <select
                          value={m.projectRole}
                          onChange={(e) => changeRole(m.userId, e.target.value as ProjectRole)}
                          className="text-xs border rounded px-2 py-1"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(m.userId)}
                          className="text-xs text-danger hover:underline"
                        >
                          Bỏ
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {create.error && (
                <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {(create.error as any)?.response?.data?.message ?? 'Lỗi khởi tạo dự án.'}
                </div>
              )}

              <div className="flex justify-between pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitDisabled}
                  className="px-4 py-2 border rounded text-sm disabled:opacity-30"
                >
                  ‹ Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => create.mutate()}
                  disabled={!canNext1 || submitDisabled}
                  className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-40"
                >
                  {create.isPending
                    ? '⏳ Đang chạy transaction...'
                    : '🚀 Khởi tạo không gian làm việc'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewNode({ node, depth }: { node: FolderNode; depth: number }) {
  return (
    <li>
      <div
        className="flex items-center gap-2 py-0.5"
        style={{ paddingLeft: depth * 16 }}
        title={node.description ?? undefined}
      >
        <span>{node.isLocked ? '🔒' : '📁'}</span>
        <span className="text-sm">{node.name}</span>
        {node.description && (
          <span className="text-xs text-gray-400 italic truncate max-w-[260px]">
            — {node.description}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((c) => (
              <PreviewNode key={`${node.name}/${c.name}`} node={c} depth={depth + 1} />
            ))}
        </ul>
      )}
    </li>
  );
}

function Dot({
  active,
  done,
  num,
  label,
}: {
  active: boolean;
  done: boolean;
  num: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          done
            ? 'bg-green-500 text-white'
            : active
              ? 'bg-viettel-red text-white'
              : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? '✓' : num}
      </div>
      <span className={`text-xs ${active ? 'font-semibold' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

function Bar({ on }: { on: boolean }) {
  return <div className={`flex-1 h-0.5 mx-2 ${on ? 'bg-viettel-red' : 'bg-gray-200'}`} />;
}
