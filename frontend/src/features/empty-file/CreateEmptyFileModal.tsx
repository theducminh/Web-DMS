import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * D5 (Phase 5) — Tạo file trống có định dạng (md, txt, docx).
 *
 * Cách hoạt động: tạo Blob rỗng (hoặc template tối thiểu) + name `<title>.<ext>` rồi
 * POST upload qua existing API. Không cần backend mới.
 *
 * Với DOCX: tạo minimal valid DOCX (1 paragraph rỗng) bằng cách dùng Blob template
 * — fallback: nếu user muốn nội dung phức tạp thì download bản trắng rồi upload lại.
 *
 * Limit hiện tại: chỉ md/txt được hỗ trợ tạo trống "thực sự". DOCX sẽ là file zero-byte
 * — cảnh báo user rằng họ cần upload bản DOCX hợp lệ sau.
 */
const TYPE_OPTIONS: Array<{ ext: string; label: string; mime: string; template: string | null }> = [
  { ext: 'md', label: '📝 Markdown (.md)', mime: 'text/markdown', template: '# Tài liệu mới\n\n' },
  { ext: 'txt', label: '📄 Plain Text (.txt)', mime: 'text/plain', template: '' },
  {
    ext: 'docx',
    label: '📘 Word (.docx) — placeholder',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    template: null, // không thể tạo DOCX hợp lệ ở browser; upload sẽ là 0-byte
  },
];

type SecurityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

export function CreateEmptyFileModal({
  projectId,
  folderId,
  onClose,
}: {
  projectId: string;
  folderId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [ext, setExt] = useState<string>('md');
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('INTERNAL');
  const [commitMessage, setCommitMessage] = useState('Tạo file mới (trống)');
  const [error, setError] = useState<string | null>(null);

  const typeOpt = TYPE_OPTIONS.find((t) => t.ext === ext)!;

  const create = useMutation({
    mutationFn: async () => {
      const content = typeOpt.template ?? '';
      const blob = new Blob([content], { type: typeOpt.mime });
      const file = new File([blob], `${title}.${ext}`, { type: typeOpt.mime });

      const form = new FormData();
      form.append('file', file);
      form.append('title', title);
      form.append('securityLevel', securityLevel);
      form.append('commitMessage', commitMessage);
      if (folderId) form.append('folderId', folderId);

      return (
        await axiosClient.post(`/projects/${projectId}/documents/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: (data: { documentId: string }) => {
      qc.invalidateQueries({ queryKey: ['folder'] });
      onClose();
      // Redirect tới detail để user bắt đầu edit ngay
      window.location.href = `/documents/${data.documentId}/detail`;
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Lỗi tạo file.'),
  });

  const canSubmit = title.trim().length >= 1 && commitMessage.trim().length >= 1 && !create.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">📄 Tạo file trống</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-danger text-xl">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Tạo nhanh 1 file trống/placeholder để bắt đầu chỉnh sửa online. Sau khi tạo xong, hệ
          thống tự chuyển vào trang chi tiết để bạn lock + edit.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tên file *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="VD: README"
              className="w-full border rounded px-3 py-2"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              File path:{' '}
              <code>
                {title || '<tên>'}.{ext}
              </code>
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Định dạng *</label>
            <div className="grid grid-cols-1 gap-2">
              {TYPE_OPTIONS.map((t) => (
                <label
                  key={t.ext}
                  className={`border rounded p-2 cursor-pointer text-sm ${
                    ext === t.ext ? 'border-viettel-red bg-red-50' : 'hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="filetype"
                    checked={ext === t.ext}
                    onChange={() => setExt(t.ext)}
                    className="mr-2"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            {ext === 'docx' && (
              <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-300 rounded p-2 mt-2">
                ⚠️ DOCX trống tạo bằng cách này sẽ là file 0-byte placeholder. Nên upload bản
                DOCX hợp lệ ngay sau khi tạo (qua "Upload version mới").
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Cấp độ bảo mật</label>
            <select
              value={securityLevel}
              onChange={(e) => setSecurityLevel(e.target.value as SecurityLevel)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="PUBLIC">PUBLIC — công khai</option>
              <option value="INTERNAL">INTERNAL — nội bộ</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL — MẬT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Commit message *</label>
            <input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {error && (
            <div className="text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border rounded py-2 text-sm">
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-viettel-red text-white rounded py-2 text-sm font-medium disabled:opacity-50"
            >
              {create.isPending ? '⏳ Đang tạo...' : '✚ Tạo + Vào chi tiết'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
