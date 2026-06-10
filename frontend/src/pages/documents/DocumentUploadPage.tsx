import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * Luồng 15 — Document Upload Workspace.
 * Layout 2/3 - 1/3:
 *  - LEFT (2/3): Dropzone Canvas (drag-over animation; click chọn file; pre-validation).
 *  - RIGHT (1/3): Metadata form — title, folder đích, securityLevel, commitMessage.
 *  - Khi bấm "Bắt đầu tải lên": Dropzone ẩn → Progress Bar % + KB/s thật từ axios onUploadProgress.
 *  - File > 15MB → cảnh báo vàng "tắt Diff tự động".
 *  - File > 50MB → chặn ở client (cũng bị Gateway chặn ở 413).
 *  - Sau success: redirect về Folder page (hoặc detail page nếu có).
 *
 * URL query support:
 *  - ?folderId=<id>  : prefill folder đích (link từ FolderPage)
 *  - ?docId=<id>     : upload version mới cho document đang tồn tại
 */
type SecurityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

const ALLOWED_EXT = ['pdf', 'docx', 'md', 'txt'];
// F1 (Phase 6): Spec capstone giới hạn 5MB cứng (mentor decision).
const MAX_BYTES = 5 * 1024 * 1024; // 5MB hard cap

interface FolderNode {
  id: string;
  name: string;
  isLocked: boolean;
}

interface FolderContents {
  currentFolder: { id: string; name: string } | null;
  subFolders: FolderNode[];
}

export function DocumentUploadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const folderIdParam = params.get('folderId') ?? 'root';
  const documentId = params.get('docId') ?? '';

  // Lấy folder hiện tại để hiển thị tên + danh sách sub-folder cho dropdown đổi đích
  const folder = useQuery<FolderContents>({
    queryKey: ['folder', projectId, folderIdParam],
    queryFn: async () =>
      (await axiosClient.get(`/projects/${projectId}/folders/${folderIdParam}`)).data,
    enabled: !!projectId,
  });

  // ---------- Form state ----------
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState('');
  const [folderTargetId, setFolderTargetId] = useState<string>('');
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('INTERNAL');
  const [commitMessage, setCommitMessage] = useState('');

  // Khi folder load: nếu đang ở folder con (folderIdParam !== 'root') → default target = chính folder đó
  // Nếu đang ở root → để trống (backend cho phép folderId NULL = root)
  useEffect(() => {
    if (folder.data?.currentFolder) {
      setFolderTargetId(folder.data.currentFolder.id);
    }
  }, [folder.data]);

  // ---------- Pre-validation ----------
  const ext = file ? (file.name.split('.').pop() ?? '').toLowerCase() : '';
  const sizeMB = file ? file.size / 1024 / 1024 : 0;
  const oversized = file && file.size > MAX_BYTES;
  const noDiffWarning = false; // F1 Phase 6: 5MB = max, không còn no-diff zone
  const badExt = file && !ALLOWED_EXT.includes(ext);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!file) return e;
    if (badExt) e.push(`Định dạng .${ext} không được hỗ trợ. Chỉ chấp nhận: ${ALLOWED_EXT.join(', ')}.`);
    if (oversized)
      e.push(
        `Dung lượng file ${sizeMB.toFixed(2)}MB vượt giới hạn 5MB của hệ thống (Gateway sẽ trả 413).`,
      );
    return e;
  }, [file, ext, badExt, oversized, sizeMB]);

  const canSubmit =
    file &&
    !badExt &&
    !oversized &&
    title.trim().length >= 1 &&
    commitMessage.trim().length >= 1;

  // ---------- Drop handlers ----------
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const onPickFile = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  // ---------- Upload mutation with progress ----------
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const startTime = useRef(0);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Chưa chọn file');
      const form = new FormData();
      form.append('file', file);
      form.append('title', title);
      form.append('securityLevel', securityLevel);
      form.append('commitMessage', commitMessage);
      if (folderTargetId) form.append('folderId', folderTargetId);
      if (documentId) form.append('documentId', documentId);

      setProgress(0);
      setSpeed(0);
      startTime.current = Date.now();

      const res = await axiosClient.post(
        `/projects/${projectId}/documents/upload`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (!e.total) return;
            const pct = Math.round((e.loaded * 100) / e.total);
            setProgress(pct);
            const dt = (Date.now() - startTime.current) / 1000;
            setSpeed(dt > 0 ? e.loaded / 1024 / dt : 0); // KB/s
          },
        },
      );
      return res.data;
    },
    onSuccess: (data: { documentId: string; versionId: string }) => {
      // Sau khi upload thành công → vào DocumentDetail page
      navigate(`/documents/${data.documentId}/detail`, { replace: true });
    },
  });

  const reset = () => {
    setFile(null);
    setProgress(0);
    setSpeed(0);
    upload.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <BackButton
            to={
              documentId
                ? `/documents/${documentId}/detail`
                : `/projects/${projectId}/folders/${folderIdParam}`
            }
            label={documentId ? '← Về chi tiết tài liệu' : '← Về thư mục'}
          />
          <h1 className="text-2xl font-bold mt-1">
            {documentId ? '📤 Tải lên phiên bản mới' : '📤 Tải lên tài liệu'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Stream lên MinIO với <b>SSE-S3 AES-256</b>. File ≤ 15MB sẽ được bóc tách text qua
            BullMQ để phục vụ Diff (FR-3.3.1).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Dropzone or Progress */}
        <div className="lg:col-span-2">
          {!upload.isPending && !upload.isSuccess && (
            <Dropzone
              file={file}
              dragOver={dragOver}
              errors={errors}
              noDiffWarning={!!noDiffWarning}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onPickFile={onPickFile}
              onClear={() => setFile(null)}
            />
          )}

          {upload.isPending && (
            <UploadProgress
              file={file!}
              progress={progress}
              speedKBs={speed}
            />
          )}

          {upload.error && (
            <div className="mt-4 text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              {(upload.error as any)?.response?.data?.message ?? 'Lỗi tải lên.'}
              <button onClick={reset} className="ml-3 underline">
                Thử lại
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Metadata form */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-5 space-y-3 h-fit">
          <h2 className="font-semibold">Thông tin metadata</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Tiêu đề tài liệu *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="VD: SRS_Core_Banking_v2"
              disabled={!!documentId}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            {documentId && (
              <p className="text-xs text-gray-400 mt-1">
                (Tải version mới: title kế thừa từ document cũ — không sửa)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Thư mục đích</label>
            <select
              value={folderTargetId}
              onChange={(e) => setFolderTargetId(e.target.value)}
              disabled={!!documentId}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-50"
            >
              <option value="">📁 Thư mục gốc (root)</option>
              {folder.data?.currentFolder && (
                <option value={folder.data.currentFolder.id}>
                  📁 {folder.data.currentFolder.name} (thư mục hiện tại)
                </option>
              )}
              {folder.data?.subFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isLocked ? '🔒' : '📁'} {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Cấp độ bảo mật (ABAC)</label>
            <select
              value={securityLevel}
              onChange={(e) => setSecurityLevel(e.target.value as SecurityLevel)}
              disabled={!!documentId}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-50"
            >
              <option value="PUBLIC">PUBLIC — công khai</option>
              <option value="INTERNAL">INTERNAL — nội bộ tập đoàn</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL — MẬT</option>
            </select>
            {securityLevel === 'CONFIDENTIAL' && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Chỉ user có clearance CONFIDENTIAL mới tải về được. Mỗi lần tải sẽ bị log ZSET
                (Anomaly Detection ngưỡng 10/phút).
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Commit message *</label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              required
              rows={3}
              placeholder="VD: Cập nhật luồng thanh toán QR + sửa lỗi mã hóa OTP"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mô tả nội dung phiên bản này — hiện trong Version Timeline.
            </p>
          </div>

          <button
            type="button"
            disabled={!canSubmit || upload.isPending}
            onClick={() => upload.mutate()}
            className="w-full bg-viettel-red text-white py-2.5 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {upload.isPending ? `⏳ Đang tải (${progress}%)` : '🚀 Bắt đầu tải lên'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Giới hạn cứng <b>5MB</b> theo spec capstone. Hỗ trợ <code>.pdf .docx .md .txt</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Dropzone Canvas ----------
function Dropzone({
  file,
  dragOver,
  errors,
  noDiffWarning,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFile,
  onClear,
}: {
  file: File | null;
  dragOver: boolean;
  errors: string[];
  noDiffWarning: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onPickFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (file && errors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="text-5xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{file.name}</div>
            <div className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'unknown'}
            </div>
          </div>
          <button onClick={onClear} className="text-xs text-danger hover:underline">
            Đổi file khác
          </button>
        </div>

        {noDiffWarning && (
          <div className="text-sm bg-yellow-50 border border-yellow-300 text-yellow-800 rounded px-3 py-2">
            ⚠️ <b>Tài liệu &gt; 15MB</b>, hệ thống sẽ tắt tính năng So sánh Diff tự động và yêu cầu
            đối chiếu thủ công để tránh quá tải (NFR-2.2).
          </div>
        )}

        <div className="text-xs text-green-700 bg-green-50 rounded px-3 py-2">
          ✓ Sẵn sàng upload. Nội dung sẽ được mã hóa SSE-S3 AES-256 trước khi lưu MinIO.
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`bg-white rounded-lg shadow border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all min-h-[400px] ${
        dragOver
          ? 'border-viettel-red bg-red-50 scale-[1.01] animate-pulse'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.md,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
        }}
      />

      {file && errors.length > 0 ? (
        <div className="text-center space-y-2 p-6">
          <div className="text-5xl">⚠️</div>
          <div className="font-semibold text-danger">{file.name}</div>
          <ul className="text-sm text-danger">
            {errors.map((er) => (
              <li key={er}>• {er}</li>
            ))}
          </ul>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="mt-2 px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Chọn file khác
          </button>
        </div>
      ) : (
        <div className="text-center space-y-2">
          <div className="text-6xl">{dragOver ? '⬇️' : '☁️'}</div>
          <div className="font-semibold text-lg">
            {dragOver ? 'Thả file vào đây' : 'Kéo & thả file vào đây'}
          </div>
          <div className="text-sm text-gray-500">
            Hoặc <span className="text-viettel-red underline">click để chọn</span> từ máy tính.
          </div>
          <div className="text-xs text-gray-400 mt-3">
            Hỗ trợ: <b>.pdf .docx .md .txt</b> · Tối đa <b>5MB</b> (spec capstone)
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Progress Bar ----------
function UploadProgress({
  file,
  progress,
  speedKBs,
}: {
  file: File;
  progress: number;
  speedKBs: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-5xl">⏳</div>
        <div className="flex-1">
          <div className="font-semibold truncate">{file.name}</div>
          <div className="text-xs text-gray-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB · stream lên MinIO bằng AWS SDK v3...
          </div>
        </div>
      </div>

      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-viettel-red transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="font-semibold">{progress}%</span>
        <span className="text-gray-500">
          {speedKBs > 1024
            ? `${(speedKBs / 1024).toFixed(2)} MB/s`
            : `${speedKBs.toFixed(0)} KB/s`}
        </span>
      </div>

      <div className="text-xs text-gray-500">
        💡 Sau khi upload xong: backend sẽ encrypt SSE-S3 → ghi DocumentVersion → enqueue
        BullMQ extractor (nếu ≤ 15MB) → bạn sẽ được chuyển vào trang chi tiết tài liệu.
      </div>
    </div>
  );
}
