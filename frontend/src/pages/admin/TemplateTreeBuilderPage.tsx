import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * Luồng 26 — Template Master Data + Folder Tree Builder.
 *  - Master-Detail:
 *      Cột trái: list templates (toggle Active/Inactive bằng status PATCH).
 *      Cột phải: cây thư mục của template đang chọn, recursive nodes với menu hover (+/✎/🔒/🗑).
 *  - Path Materialization: backend tự cập nhật parent_path khi đổi tên.
 *  - Locked Root Prevention: nút Xóa folder is_locked → shake + alert.
 *  - No Cascade Delete on Active Projects: API DELETE template cứng không có; chỉ status toggle.
 */
interface FolderNode {
  id: string;
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
  isActive: boolean;
  createdAt: string;
  folders: FolderNode[];
}

export function TemplateTreeBuilderPage() {
  const qc = useQueryClient();
  const templates = useQuery<Template[]>({
    queryKey: ['admin-templates'],
    queryFn: async () => (await axiosClient.get('/admin/project-templates')).data,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateTpl, setShowCreateTpl] = useState(false);

  const selected = templates.data?.find((t) => t.id === selectedId) ?? null;

  // Auto-select first template once data lands
  if (!selectedId && templates.data && templates.data.length > 0) {
    setSelectedId(templates.data[0].id);
  }

  // ===== Mutations =====
  const createTemplate = useMutation({
    mutationFn: async (dto: { name: string; templateType: string; description?: string }) =>
      (await axiosClient.post('/admin/project-templates', dto)).data,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] });
      setShowCreateTpl(false);
      if (data?.id) setSelectedId(data.id);
    },
  });

  const toggleTemplateStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await axiosClient.patch(`/admin/project-templates/${id}/status`, { isActive })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  const addFolder = useMutation({
    mutationFn: async (vars: { templateId: string; dto: any }) =>
      (await axiosClient.post(`/admin/project-templates/${vars.templateId}/folders`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  const updateFolder = useMutation({
    mutationFn: async (vars: { templateId: string; folderId: string; dto: any }) =>
      (
        await axiosClient.patch(
          `/admin/project-templates/${vars.templateId}/folders/${vars.folderId}`,
          vars.dto,
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  const removeFolder = useMutation({
    mutationFn: async (vars: { templateId: string; folderId: string }) =>
      (
        await axiosClient.delete(
          `/admin/project-templates/${vars.templateId}/folders/${vars.folderId}`,
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? 'Không xóa được thư mục.');
    },
  });

  // Helpers
  const onAddRoot = () => {
    if (!selected) return;
    const name = prompt('Tên thư mục gốc mới:', '06_NewFolder');
    if (!name) return;
    addFolder.mutate({
      templateId: selected.id,
      dto: { name, parentId: null, isLocked: false },
    });
  };

  const onAddChild = (parent: FolderNode) => {
    const name = prompt(`Tên thư mục con (cha = "${parent.name}"):`, '');
    if (!name) return;
    addFolder.mutate({
      templateId: selected!.id,
      dto: { name, parentId: parent.id, isLocked: false },
    });
  };

  const onRenameFolder = (folder: FolderNode) => {
    if (folder.isLocked) {
      alert('Thư mục đã khóa không thể đổi tên (is_locked = true).');
      return;
    }
    const name = prompt('Đổi tên thư mục:', folder.name);
    if (!name || name === folder.name) return;
    updateFolder.mutate({
      templateId: selected!.id,
      folderId: folder.id,
      dto: { name },
    });
  };

  const onToggleLock = (folder: FolderNode) => {
    updateFolder.mutate({
      templateId: selected!.id,
      folderId: folder.id,
      dto: { isLocked: !folder.isLocked },
    });
  };

  const onDeleteFolder = (folder: FolderNode) => {
    if (folder.isLocked) {
      // Shake animation via temporary class — đơn giản dùng alert đỏ
      alert('Không thể xóa thư mục chuẩn của tập đoàn (is_locked = true).');
      return;
    }
    if (
      !confirm(
        `Xóa thư mục "${folder.name}" và toàn bộ thư mục con bên dưới? Hành động này không thể hoàn tác.`,
      )
    )
      return;
    removeFolder.mutate({ templateId: selected!.id, folderId: folder.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mẫu dự án (Template Master)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cây thư mục chuẩn dùng khi PM khởi tạo dự án mới (Luồng 11). Cập nhật ở đây không ảnh hưởng dự án cũ.
          </p>
        </div>
        <button
          onClick={() => setShowCreateTpl(true)}
          className="px-3 py-2 bg-viettel-red text-white rounded text-sm font-medium hover:bg-red-700"
        >
          + Thêm mẫu mới
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar: list templates */}
        <aside className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-3 py-2 border-b bg-gray-50 text-xs uppercase text-gray-600 font-semibold">
            Templates ({templates.data?.length ?? 0})
          </div>
          {templates.isLoading && (
            <div className="p-4 text-sm text-gray-500">Đang tải...</div>
          )}
          <ul className="divide-y">
            {templates.data?.map((t) => (
              <li
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                  selectedId === t.id ? 'bg-yellow-50 border-l-4 border-viettel-red' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{t.name}</div>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="relative inline-flex items-center cursor-pointer"
                    title={t.isActive ? 'Đang Active' : 'Inactive'}
                  >
                    <input
                      type="checkbox"
                      checked={t.isActive}
                      onChange={() =>
                        toggleTemplateStatus.mutate({ id: t.id, isActive: !t.isActive })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-transform peer-checked:after:translate-x-4" />
                  </label>
                </div>
                <div className="text-xs text-gray-500 font-mono mt-1">{t.templateType}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {t.folders.length} folder gốc
                </div>
              </li>
            ))}
            {templates.data && templates.data.length === 0 && (
              <li className="p-4 text-sm text-gray-500 text-center">
                Chưa có template — bấm <span className="font-semibold">+ Thêm mẫu mới</span> bên trên.
              </li>
            )}
          </ul>
        </aside>

        {/* Folder Tree Canvas */}
        <main className="lg:col-span-3 bg-white rounded-lg shadow p-4">
          {!selected && (
            <div className="text-sm text-gray-500 text-center py-10">
              Chọn 1 template từ danh sách bên trái.
            </div>
          )}
          {selected && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{selected.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{selected.templateType}</div>
                </div>
                <button
                  onClick={onAddRoot}
                  className="px-3 py-1.5 border border-viettel-red text-viettel-red rounded text-sm hover:bg-red-50"
                >
                  + Thêm thư mục gốc
                </button>
              </div>

              {selected.folders.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">
                  📂 Mẫu này chưa có thư mục — bấm "+ Thêm thư mục gốc" để bắt đầu.
                </div>
              ) : (
                <div className="border rounded p-3 bg-gray-50">
                  <ul className="space-y-1">
                    {selected.folders.map((root) => (
                      <FolderNodeItem
                        key={root.id}
                        node={root}
                        depth={0}
                        onAddChild={onAddChild}
                        onRename={onRenameFolder}
                        onToggleLock={onToggleLock}
                        onDelete={onDeleteFolder}
                      />
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">
                💡 <span className="font-medium">Path Materialization:</span> đổi tên một thư mục sẽ tự
                cập nhật <code>parent_path</code> cho mọi thư mục con bên dưới. 🔒 = thư mục chuẩn không thể xóa/đổi tên.
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal Create Template */}
      {showCreateTpl && (
        <CreateTemplateModal
          onClose={() => setShowCreateTpl(false)}
          onSubmit={(dto) => createTemplate.mutate(dto)}
          isPending={createTemplate.isPending}
          error={(createTemplate.error as any)?.response?.data?.message}
        />
      )}
    </div>
  );
}

function FolderNodeItem({
  node,
  depth,
  onAddChild,
  onRename,
  onToggleLock,
  onDelete,
}: {
  node: FolderNode;
  depth: number;
  onAddChild: (n: FolderNode) => void;
  onRename: (n: FolderNode) => void;
  onToggleLock: (n: FolderNode) => void;
  onDelete: (n: FolderNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className="group flex items-center gap-2 py-1 px-2 rounded hover:bg-white"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen(!open)}
            className="text-gray-400 hover:text-gray-700 w-4 text-xs"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-base">{node.isLocked ? '🔒' : '📁'}</span>
        <span className="text-sm font-medium">{node.name}</span>
        {node.description && (
          <span className="text-xs text-gray-400 italic truncate max-w-[200px]">
            — {node.description}
          </span>
        )}

        <span className="flex-1" />

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs">
          <button
            onClick={() => onAddChild(node)}
            className="px-1.5 py-0.5 hover:bg-gray-100 rounded text-blue-600"
            title="Thêm thư mục con"
          >
            ＋
          </button>
          <button
            onClick={() => onRename(node)}
            className={`px-1.5 py-0.5 rounded ${
              node.isLocked
                ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title={node.isLocked ? 'Đã khóa' : 'Đổi tên'}
            disabled={node.isLocked}
          >
            ✎
          </button>
          <button
            onClick={() => onToggleLock(node)}
            className="px-1.5 py-0.5 hover:bg-gray-100 rounded"
            title={node.isLocked ? 'Mở khóa' : 'Khóa (is_locked)'}
          >
            {node.isLocked ? '🔓' : '🔒'}
          </button>
          <button
            onClick={() => onDelete(node)}
            className={`px-1.5 py-0.5 rounded ${
              node.isLocked
                ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-red-100 text-danger'
            }`}
            title={
              node.isLocked
                ? 'Không thể xóa thư mục chuẩn của tập đoàn'
                : 'Xóa (kèm thư mục con)'
            }
          >
            🗑
          </button>
        </div>
      </div>
      {hasChildren && open && (
        <ul className="space-y-1">
          {node.children
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((c) => (
              <FolderNodeItem
                key={c.id}
                node={c}
                depth={depth + 1}
                onAddChild={onAddChild}
                onRename={onRename}
                onToggleLock={onToggleLock}
                onDelete={onDelete}
              />
            ))}
        </ul>
      )}
    </li>
  );
}

function CreateTemplateModal({
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  onClose: () => void;
  onSubmit: (dto: { name: string; templateType: string; description?: string }) => void;
  isPending: boolean;
  error?: string;
}) {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Tạo mẫu dự án mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-danger">
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, templateType, description: description || undefined });
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tên mẫu *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              placeholder="VD: Triển khai Hạ tầng"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Mã định danh (UPPER_SNAKE_CASE) *
            </label>
            <input
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              required
              pattern="^[A-Z][A-Z0-9_]+$"
              placeholder="VD: INFRA_DEPLOY"
              className="w-full border rounded px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded py-2"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-viettel-red text-white rounded py-2 disabled:opacity-50"
            >
              {isPending ? 'Đang tạo...' : 'Tạo mẫu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
