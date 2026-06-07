import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * D2 (Phase 5) — Upload nguyên thư mục.
 *
 * Cách hoạt động:
 *   1. <input webkitDirectory> để user chọn folder local.
 *   2. Mỗi File có `webkitRelativePath` dạng "rootDir/subDir/file.ext".
 *   3. Tách path → tạo folder tree đệ quy qua POST /projects/:pid/folders
 *      (cùng API user đã dùng — tránh viết endpoint backend mới).
 *   4. Upload từng file vào folder cuối qua POST /projects/:pid/documents/upload.
 *
 * Limit:
 *   - Mỗi file áp dụng quy tắc giống upload đơn (≤ 50MB, .pdf/.docx/.md/.txt).
 *   - File ngoài whitelist → tự skip + báo warning.
 *   - Tên file trùng trong cùng folder → backend trả 400 → component hiển thị error/skip.
 */

interface ProcessedFile {
  file: File;
  relPath: string[];          // ['Phong_Dev', '2026', 'srs.pdf'] (đã loại bỏ root)
  status: 'queued' | 'creating-folder' | 'uploading' | 'done' | 'skipped' | 'error';
  message?: string;
}

const ALLOWED_EXT = ['pdf', 'docx', 'md', 'txt'];
const MAX_BYTES = 50 * 1024 * 1024;

export function UploadFolderModal({
  projectId,
  parentFolderId,
  onClose,
}: {
  projectId: string;
  parentFolderId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.file.size, 0),
    [files],
  );

  const onPickFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const processed: ProcessedFile[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      // webkitRelativePath = "selectedRoot/subDir/file.ext"
      // Tách thành mảng + bỏ root đầu tiên (user CHỌN folder đó nên nó là tên hiển thị, không cần tạo trong DB)
      const full = (f as any).webkitRelativePath ?? f.name;
      const parts: string[] = String(full).split('/').filter(Boolean);
      const relPath = parts.length > 1 ? parts : [parts[0]]; // luôn ≥ 1
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();

      let status: ProcessedFile['status'] = 'queued';
      let message: string | undefined;
      if (!ALLOWED_EXT.includes(ext)) {
        status = 'skipped';
        message = `Định dạng .${ext} không hỗ trợ`;
      } else if (f.size > MAX_BYTES) {
        status = 'skipped';
        message = `File ${(f.size / 1024 / 1024).toFixed(1)}MB > 50MB`;
      }

      processed.push({ file: f, relPath, status, message });
    }
    setFiles(processed);
    setFinished(false);
  };

  // Tạo folder nếu chưa có (cache: path string → folderId)
  const ensureFolderPath = async (
    pathSegments: string[],
    folderCache: Map<string, string | null>,
  ): Promise<string | null> => {
    // pathSegments không bao gồm filename (chỉ folder parts)
    // Nếu rỗng → parent gốc của upload (parentFolderId hoặc null = root)
    let currentParentId: string | null = parentFolderId;
    let accPath = '';
    for (const seg of pathSegments) {
      accPath = accPath ? `${accPath}/${seg}` : seg;
      if (folderCache.has(accPath)) {
        currentParentId = folderCache.get(accPath) ?? null;
        continue;
      }

      // Tạo folder mới qua API
      try {
        const res = await axiosClient.post<{ id: string }>(
          `/projects/${projectId}/folders`,
          { name: seg, parentId: currentParentId ?? undefined },
        );
        const newId = res.data.id;
        folderCache.set(accPath, newId);
        currentParentId = newId;
      } catch (err: any) {
        // Nếu trùng tên thì cần GET lại — backend chưa expose endpoint search folder by name,
        // ta tận dụng GET /folders/<parentId> để tìm sub có cùng name.
        const parentRoute = currentParentId ?? 'root';
        try {
          const contents = await axiosClient.get<{
            subFolders: { id: string; name: string }[];
          }>(`/projects/${projectId}/folders/${parentRoute}`);
          const found = contents.data.subFolders.find((f) => f.name === seg);
          if (found) {
            folderCache.set(accPath, found.id);
            currentParentId = found.id;
            continue;
          }
        } catch {
          /* ignore */
        }
        throw err;
      }
    }
    return currentParentId;
  };

  const runUpload = async () => {
    setRunning(true);
    const folderCache = new Map<string, string | null>();

    // Sort file theo độ sâu path để tạo folder cha trước
    const sortedIdx = files
      .map((_, i) => i)
      .sort(
        (a, b) =>
          (files[a].relPath.length || 0) - (files[b].relPath.length || 0),
      );

    for (const idx of sortedIdx) {
      const item = files[idx];
      if (item.status !== 'queued') continue;

      try {
        // Tách folder path + filename
        const folderParts = item.relPath.slice(0, -1);
        item.status = 'creating-folder';
        setFiles((cur) => [...cur]);

        const targetFolderId = await ensureFolderPath(folderParts, folderCache);

        // Upload file
        item.status = 'uploading';
        setFiles((cur) => [...cur]);

        const filenameNoExt = item.file.name.replace(/\.[^.]+$/, '');
        const form = new FormData();
        form.append('file', item.file);
        form.append('title', filenameNoExt);
        form.append('commitMessage', `Upload folder batch — ${item.relPath.join('/')}`);
        form.append('securityLevel', 'INTERNAL');
        if (targetFolderId) form.append('folderId', targetFolderId);

        await axiosClient.post(`/projects/${projectId}/documents/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        item.status = 'done';
      } catch (err: any) {
        item.status = 'error';
        item.message = err?.response?.data?.message ?? err.message ?? 'Lỗi không xác định';
      }
      setFiles((cur) => [...cur]);
    }
    setRunning(false);
    setFinished(true);
    qc.invalidateQueries({ queryKey: ['folder'] });
  };

  const queuedCount = files.filter((f) => f.status === 'queued').length;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const skippedCount = files.filter((f) => f.status === 'skipped').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">📂 Upload nguyên thư mục</h3>
          <button
            onClick={onClose}
            disabled={running}
            className="text-gray-400 hover:text-danger text-xl disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-auto">
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
            💡 Chọn 1 thư mục từ máy bạn. Hệ thống sẽ:
            <ol className="list-decimal ml-5 mt-1">
              <li>Tự tạo cây thư mục con tương ứng trong dự án (nếu chưa có).</li>
              <li>Upload từng file vào đúng folder đích.</li>
              <li>File &gt; 50MB hoặc định dạng không hỗ trợ sẽ bị bỏ qua.</li>
            </ol>
          </div>

          {files.length === 0 && (
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-viettel-red"
            >
              <div className="text-5xl">📂</div>
              <p className="text-sm text-gray-600 mt-2">
                Click để <b>chọn thư mục</b> từ máy tính
              </p>
              <p className="text-xs text-gray-400 mt-1">
                (Chrome/Edge/Firefox modern đều hỗ trợ webkitdirectory)
              </p>
              <input
                ref={inputRef}
                type="file"
                /* @ts-expect-error webkitdirectory không có trong React type chuẩn */
                webkitdirectory=""
                directory=""
                multiple
                hidden
                onChange={onPickFolder}
              />
            </div>
          )}

          {files.length > 0 && (
            <>
              <div className="bg-gray-50 rounded p-3 text-sm">
                Tổng <b>{files.length}</b> file ·{' '}
                <b>{(totalSize / 1024 / 1024).toFixed(2)} MB</b> ·{' '}
                {!finished && `Queued: ${queuedCount}, `}
                <span className="text-green-700">Done: {doneCount}</span>
                {errorCount > 0 && <span className="text-danger"> · Error: {errorCount}</span>}
                {skippedCount > 0 && <span className="text-yellow-700"> · Skip: {skippedCount}</span>}
              </div>

              <ul className="max-h-80 overflow-auto border rounded divide-y">
                {files.map((f, i) => (
                  <li key={i} className="px-3 py-2 flex items-center gap-3 text-xs">
                    <span className="text-lg shrink-0">
                      {f.status === 'done'
                        ? '✓'
                        : f.status === 'error'
                          ? '✗'
                          : f.status === 'skipped'
                            ? '↷'
                            : f.status === 'uploading'
                              ? '⏳'
                              : f.status === 'creating-folder'
                                ? '📁'
                                : '·'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono truncate">{f.relPath.join('/')}</div>
                      {f.message && (
                        <div
                          className={
                            f.status === 'error'
                              ? 'text-danger'
                              : f.status === 'skipped'
                                ? 'text-yellow-700'
                                : 'text-gray-500'
                          }
                        >
                          {f.message}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-400 shrink-0">
                      {(f.file.size / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          {!finished && (
            <button
              onClick={onClose}
              disabled={running}
              className="px-4 py-2 border rounded text-sm disabled:opacity-50"
            >
              Hủy
            </button>
          )}
          {!finished && files.length > 0 && (
            <button
              onClick={runUpload}
              disabled={running || queuedCount === 0}
              className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-50"
            >
              {running ? '⏳ Đang upload...' : `🚀 Upload ${queuedCount} file`}
            </button>
          )}
          {finished && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-viettel-red text-white rounded font-medium"
            >
              ✓ Xong
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
