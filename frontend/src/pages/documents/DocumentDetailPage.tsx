import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { useSessionStore } from '../../entities/session/session.store';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * Luồng 16 — Document Dashboard (Tabbed Layout).
 *  - Tab Preview: render đúng từng fileType:
 *      • md  → marked.parse → HTML (sanitize-friendly)
 *      • txt → <pre>
 *      • pdf → iframe presigned (inline disposition)
 *      • docx → mammoth.convertToHtml (browser-side)
 *    Khi user đang giữ lock + fileType in {md, txt}: hiển thị textarea editable
 *    + nút "Lưu thành phiên bản mới" (upload buffer text với cùng docId).
 *  - Tab Metadata: status, securityLevel, ABAC, dates.
 *  - Tab Version Timeline: dòng thời gian + Xem inline + Download + Restore + Diff selection.
 */

type DocStatus = 'DRAFT' | 'UNDER_REVIEW' | 'RELEASED' | 'ARCHIVED';
type SecurityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

interface DocumentDetail {
  id: string;
  projectId: string;
  folderId: string | null;
  title: string;
  status: DocStatus;
  securityLevel: SecurityLevel;
  lockedBy: string | null;
  publishedVersionId: string | null;
  versions: Array<{
    id: string;
    versionNo: number;
    commitMessage: string;
    uploadedBy: string;
    fileType: string;
    textExtracted: boolean;
    createdAt: string;
  }>;
}

type Tab = 'preview' | 'metadata' | 'versions';

const STATUS_BADGE: Record<DocStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  RELEASED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

const SECURITY_BADGE: Record<SecurityLevel, string> = {
  PUBLIC: 'bg-gray-100 text-gray-600',
  INTERNAL: 'bg-yellow-100 text-yellow-700',
  CONFIDENTIAL: 'bg-red-100 text-red-700',
};

const EDITABLE_TYPES = new Set(['md', 'txt']);

export function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentUserId = useSessionStore((s) => s.user?.id);

  const [tab, setTab] = useState<Tab>('preview');

  const doc = useQuery<DocumentDetail>({
    queryKey: ['document', docId],
    queryFn: async () => (await axiosClient.get(`/documents/${docId}`)).data,
    enabled: !!docId,
    refetchInterval: 10_000,
  });

  // Pessimistic Lock
  const isLockedBySelf = doc.data?.lockedBy === currentUserId;
  const isLockedByOther = !!doc.data?.lockedBy && doc.data.lockedBy !== currentUserId;

  const lock = useMutation({
    mutationFn: async () => (await axiosClient.post(`/documents/${docId}/lock`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', docId] }),
  });
  const unlock = useMutation({
    mutationFn: async () => (await axiosClient.delete(`/documents/${docId}/lock`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', docId] }),
  });

  useEffect(() => {
    if (!isLockedBySelf) return;
    const id = setInterval(() => {
      axiosClient.patch(`/documents/${docId}/lock/heartbeat`).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [isLockedBySelf, docId]);

  const submitReview = useMutation({
    mutationFn: async () => (await axiosClient.patch(`/documents/${docId}/submit-review`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', docId] });
      navigate(`/documents/${docId}/review`);
    },
  });

  const restoreVersion = useMutation({
    mutationFn: async (versionId: string) =>
      (await axiosClient.post(`/documents/${docId}/versions/${versionId}/restore`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', docId] }),
  });

  // D4 (Phase 5): Xin trả khóa
  const [showRequestUnlock, setShowRequestUnlock] = useState(false);
  const requestUnlock = useMutation({
    mutationFn: async (reason: string) =>
      (
        await axiosClient.post(`/documents/${docId}/lock/request-release`, {
          reason,
        })
      ).data,
    onSuccess: (data) => {
      alert(data.message);
      setShowRequestUnlock(false);
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Lỗi xin trả khóa.'),
  });

  const deleteDocument = useMutation({
    mutationFn: async () => (await axiosClient.delete(`/documents/${docId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder'] });
      navigate(doc.data ? `/projects/${doc.data.projectId}/folders/root` : '/projects');
    },
  });

  const onDownload = async (versionId: string) => {
    try {
      const { data } = await axiosClient.get<{ downloadUrl: string }>(
        `/documents/${docId}/versions/${versionId}/download`,
      );
      window.open(data.downloadUrl, '_blank');
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429)
        alert('⚠️ Bạn đã tải > 10 lần/phút. Đợi cooldown 1 phút (FR-5.3.1).');
      else if (status === 403) alert('🚫 Clearance không đủ để tải tài liệu này.');
      else alert(e?.response?.data?.message ?? 'Lỗi tải file');
    }
  };

  const [diffSelection, setDiffSelection] = useState<string[]>([]);
  const toggleDiff = (versionId: string) => {
    setDiffSelection((cur) => {
      if (cur.includes(versionId)) return cur.filter((v) => v !== versionId);
      if (cur.length >= 2) return [cur[1], versionId];
      return [...cur, versionId];
    });
  };
  const diffReady = diffSelection.length === 2;

  if (doc.isLoading)
    return <div className="text-gray-500">Đang tải chi tiết tài liệu...</div>;
  if (doc.error || !doc.data) {
    const status = (doc.error as any)?.response?.status;
    return (
      <div className="bg-white rounded shadow p-6 text-center">
        <div className="text-4xl mb-2">🚫</div>
        <p className="text-danger">
          {status === 403
            ? 'Bạn không có quyền xem bản nháp tài liệu này.'
            : status === 404
              ? 'Không tìm thấy tài liệu.'
              : (doc.error as any)?.response?.data?.message ?? 'Lỗi tải tài liệu.'}
        </p>
        <Link to="/projects" className="text-viettel-red hover:underline text-sm">
          ‹ Quay lại danh sách dự án
        </Link>
      </div>
    );
  }

  const latestVersion = doc.data.versions[0];
  const canSubmitReview = doc.data.status === 'DRAFT' && !isLockedByOther;
  const isEditableType = latestVersion && EDITABLE_TYPES.has(latestVersion.fileType);

  return (
    <div className="space-y-4">
      <BackButton />

      {/* Header */}
      <div className="bg-white rounded-lg shadow px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold truncate">{doc.data.title}</h1>
            <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
              <span className={`px-2 py-0.5 rounded font-medium ${STATUS_BADGE[doc.data.status]}`}>
                {doc.data.status}
              </span>
              <span className={`px-2 py-0.5 rounded font-medium ${SECURITY_BADGE[doc.data.securityLevel]}`}>
                {doc.data.securityLevel}
              </span>
              <span className="text-gray-500">
                {doc.data.versions.length} phiên bản · mới nhất v{latestVersion?.versionNo ?? '-'}.0
              </span>
              {isLockedByOther && (
                <Link
                  to={`/users/${doc.data.lockedBy}`}
                  className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium hover:bg-orange-200"
                  title="Xem hồ sơ người đang giữ khóa"
                >
                  🔒 Đang bị sửa bởi user <span className="font-mono">{doc.data.lockedBy!.slice(0, 8)}…</span> →
                </Link>
              )}
              {isLockedBySelf && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                  🔓 Bạn đang giữ khóa biên tập
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {doc.data.status !== 'ARCHIVED' && doc.data.status !== 'UNDER_REVIEW' && (
              <>
                {!doc.data.lockedBy && (
                  <button
                    onClick={() => lock.mutate()}
                    disabled={lock.isPending}
                    className="px-3 py-2 text-sm bg-white border border-viettel-red text-viettel-red rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    {lock.isPending ? 'Đang khóa...' : '✏️ Bắt đầu chỉnh sửa'}
                  </button>
                )}
                {/* D4: Xin trả khóa nếu doc đang bị khóa bởi user khác */}
                {isLockedByOther && (
                  <button
                    onClick={() => setShowRequestUnlock(true)}
                    className="px-3 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                    title="Xin người đang giữ khóa trả lại — họ sẽ nhận email"
                  >
                    🙏 Xin trả khóa
                  </button>
                )}
                {isLockedBySelf && (
                  <>
                    <Link
                      to={`/projects/${doc.data.projectId}/documents/upload?docId=${doc.data.id}${
                        doc.data.folderId ? `&folderId=${doc.data.folderId}` : ''
                      }`}
                      className="px-3 py-2 text-sm bg-viettel-red text-white rounded hover:bg-red-700"
                    >
                      📤 Upload version mới
                    </Link>
                    <button
                      onClick={() => unlock.mutate()}
                      disabled={unlock.isPending}
                      className="px-3 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      🔓 Trả khóa
                    </button>
                  </>
                )}
              </>
            )}

            {canSubmitReview && (
              <button
                onClick={() => submitReview.mutate()}
                disabled={submitReview.isPending}
                className="px-3 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
              >
                {submitReview.isPending ? 'Đang gửi...' : '📋 Gửi duyệt'}
              </button>
            )}
            {doc.data.status === 'UNDER_REVIEW' && (
              <Link
                to={`/documents/${docId}/review`}
                className="px-3 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                👁 Xem trang Phê duyệt
              </Link>
            )}

            {/* C3 (Phase 5): nút xóa tài liệu (soft delete) */}
            {doc.data.status !== 'ARCHIVED' && !isLockedByOther && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Xóa tài liệu "${doc.data.title}" vào Thùng rác? (có thể khôi phục từ /trash trong vòng 30 ngày)`,
                    )
                  )
                    deleteDocument.mutate();
                }}
                disabled={deleteDocument.isPending}
                className="px-3 py-2 text-sm text-danger border border-danger rounded hover:bg-red-50 disabled:opacity-50"
                title="Soft delete — chuyển vào Trash"
              >
                🗑 Xóa
              </button>
            )}
          </div>
        </div>

        {(lock.error || unlock.error || submitReview.error || deleteDocument.error) && (
          <div className="mt-3 text-xs text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
            {(lock.error as any)?.response?.data?.message ??
              (unlock.error as any)?.response?.data?.message ??
              (submitReview.error as any)?.response?.data?.message ??
              (deleteDocument.error as any)?.response?.data?.message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b">
          <TabBtn active={tab === 'preview'} onClick={() => setTab('preview')}>
            📖 Preview
          </TabBtn>
          <TabBtn active={tab === 'metadata'} onClick={() => setTab('metadata')}>
            🏷️ Metadata & ABAC
          </TabBtn>
          <TabBtn active={tab === 'versions'} onClick={() => setTab('versions')}>
            🕒 Version History ({doc.data.versions.length})
          </TabBtn>
        </div>

        {tab === 'preview' && (
          <PreviewTab
            docId={doc.data.id}
            latestVersion={latestVersion}
            onDownload={onDownload}
            canEdit={!!(isLockedBySelf && isEditableType)}
            onSavedNewVersion={() => qc.invalidateQueries({ queryKey: ['document', docId] })}
            projectId={doc.data.projectId}
          />
        )}

        {tab === 'metadata' && <MetadataTab doc={doc.data} />}

        {tab === 'versions' && (
          <VersionsTab
            docId={doc.data.id}
            doc={doc.data}
            diffSelection={diffSelection}
            toggleDiff={toggleDiff}
            onRestore={(vid) => {
              if (confirm('Append-only Rollback: sẽ tạo version mới sao chép từ bản này. OK?'))
                restoreVersion.mutate(vid);
            }}
            onDownload={onDownload}
          />
        )}
      </div>

      {/* D4: Modal "Xin trả khóa" */}
      {showRequestUnlock && (
        <RequestUnlockModal
          docTitle={doc.data.title}
          onClose={() => setShowRequestUnlock(false)}
          onSubmit={(reason) => requestUnlock.mutate(reason)}
          isPending={requestUnlock.isPending}
        />
      )}

      {/* Floating Diff bar */}
      {diffReady && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-viettel-dark text-white rounded-lg shadow-xl px-5 py-3 flex items-center gap-4 z-40">
          <div className="text-sm">
            🔍 So sánh hai phiên bản đã chọn:{' '}
            <span className="font-mono">
              v
              {doc.data.versions.find((v) => v.id === diffSelection[0])?.versionNo ?? '?'} ↔ v
              {doc.data.versions.find((v) => v.id === diffSelection[1])?.versionNo ?? '?'}
            </span>
          </div>
          <Link
            to={`/documents/diff?docId=${docId}&v1=${
              doc.data.versions.find((v) => v.id === diffSelection[0])?.versionNo ?? ''
            }&v2=${doc.data.versions.find((v) => v.id === diffSelection[1])?.versionNo ?? ''}`}
            className="px-3 py-1.5 bg-viettel-red rounded text-sm font-medium hover:bg-red-700"
          >
            Mở Diff →
          </Link>
          <button
            onClick={() => setDiffSelection([])}
            className="text-xs text-gray-300 hover:text-white"
          >
            Bỏ chọn
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Tab button ----------
function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-viettel-red text-viettel-red'
          : 'border-transparent text-gray-600 hover:text-viettel-red'
      }`}
    >
      {children}
    </button>
  );
}

// ---------- Preview Tab — render đúng theo fileType ----------
function PreviewTab({
  docId,
  latestVersion,
  onDownload,
  canEdit,
  onSavedNewVersion,
  projectId,
}: {
  docId: string;
  latestVersion: DocumentDetail['versions'][number] | undefined;
  onDownload: (vid: string) => void;
  canEdit: boolean;
  onSavedNewVersion: () => void;
  projectId: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch presigned PREVIEW URL (inline disposition)
  useEffect(() => {
    if (!latestVersion) return;
    setLoading(true);
    setError(null);
    setPreviewUrl(null);
    axiosClient
      .get<{ previewUrl: string }>(
        `/documents/${docId}/versions/${latestVersion.id}/preview`,
      )
      .then((res) => setPreviewUrl(res.data.previewUrl))
      .catch((e) => {
        const s = e?.response?.status;
        setError(
          s === 403
            ? 'Clearance không đủ để xem preview.'
            : e?.response?.data?.message ?? 'Lỗi tải preview',
        );
      })
      .finally(() => setLoading(false));
  }, [docId, latestVersion]);

  if (!latestVersion)
    return (
      <div className="p-10 text-center text-gray-500 text-sm">
        Tài liệu này chưa có phiên bản nào.
      </div>
    );

  const ft = latestVersion.fileType.toLowerCase();

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          Phiên bản mới nhất: <b>v{latestVersion.versionNo}.0</b> ·{' '}
          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ft}</span>
          {latestVersion.textExtracted && (
            <span className="ml-2 text-xs text-green-700">✓ raw_text đã bóc tách</span>
          )}
        </div>
        <button
          onClick={() => onDownload(latestVersion.id)}
          className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50"
        >
          ⬇ Tải file gốc
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Đang sinh preview...</div>}
      {error && (
        <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {previewUrl && !canEdit && (
        <>
          {ft === 'pdf' && <PdfPreview url={previewUrl} />}
          {ft === 'md' && <MarkdownPreview url={previewUrl} />}
          {ft === 'txt' && <TextPreview url={previewUrl} />}
          {ft === 'docx' && <DocxPreview url={previewUrl} />}
          {!['pdf', 'md', 'txt', 'docx'].includes(ft) && (
            <div className="p-10 text-center text-sm text-gray-500 border rounded bg-gray-50">
              Định dạng .{ft} không preview được trực tiếp. Bấm <b>Tải file gốc</b> để mở.
            </div>
          )}
        </>
      )}

      {previewUrl && canEdit && (
        <OnlineTextEditor
          url={previewUrl}
          fileType={ft}
          docId={docId}
          projectId={projectId}
          originalTitle={'(version mới)'}
          onSaved={onSavedNewVersion}
        />
      )}
    </div>
  );
}

// ---------- PDF preview ----------
function PdfPreview({ url }: { url: string }) {
  return (
    <div className="border rounded overflow-hidden bg-gray-100" style={{ height: '70vh' }}>
      <iframe src={url} className="w-full h-full" title="pdf-preview" />
    </div>
  );
}

// ---------- Markdown preview (marked render) ----------
function MarkdownPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string>('');
  const [raw, setRaw] = useState<string>('');
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(async (text) => {
        setRaw(text);
        const { marked } = await import('marked');
        const out = await marked.parse(text);
        setHtml(typeof out === 'string' ? out : '');
      })
      .catch((e) => setHtml(`<p class="text-danger">Lỗi: ${e.message}</p>`));
  }, [url]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-viettel-red">
            Xem nguồn markdown
          </summary>
          <pre className="mt-2 text-xs bg-gray-50 border rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
            {raw || '(đang tải...)'}
          </pre>
        </details>
      </div>
      <div
        className="prose prose-sm max-w-none border rounded p-5 bg-white overflow-auto"
        style={{ maxHeight: '70vh' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ---------- TXT preview ----------
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch((e) => setText(`[Lỗi] ${e.message}`));
  }, [url]);
  return (
    <pre
      className="border rounded p-4 bg-gray-50 text-sm overflow-auto whitespace-pre-wrap font-mono"
      style={{ maxHeight: '70vh' }}
    >
      {text || '(đang tải...)'}
    </pre>
  );
}

// ---------- DOCX preview (mammoth.js convert blob → HTML) ----------
function DocxPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then(async (arrayBuffer) => {
        const mammoth = await import('mammoth/mammoth.browser');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtml(result.value);
      })
      .catch((e) => setError(e.message));
  }, [url]);

  if (error)
    return (
      <div className="p-5 text-sm text-danger bg-red-50 border border-red-200 rounded">
        Không convert được .docx: {error}
      </div>
    );

  return (
    <div
      className="prose prose-sm max-w-none border rounded p-5 bg-white overflow-auto"
      style={{ maxHeight: '70vh' }}
      dangerouslySetInnerHTML={{ __html: html || '<p class="text-gray-400">Đang render DOCX...</p>' }}
    />
  );
}

// ---------- Online Text Editor (textarea cho md/txt khi user holding lock) ----------
function OnlineTextEditor({
  url,
  fileType,
  docId,
  onSaved,
}: {
  url: string;
  fileType: string;
  docId: string;
  projectId: string;
  originalTitle: string;
  onSaved: () => void;
}) {
  const [content, setContent] = useState<string>('');
  const [original, setOriginal] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialFetched = useRef(false);

  useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        setOriginal(text);
      })
      .catch((e) => setError(`Lỗi tải nội dung: ${e.message}`))
      .finally(() => setLoading(false));
  }, [url]);

  const isDirty = content !== original;
  const canSave = isDirty && commitMessage.trim().length > 0 && !saving;

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const projectIdFromDoc = (await axiosClient.get(`/documents/${docId}`)).data.projectId as string;
      const ext = fileType === 'md' ? 'md' : 'txt';
      const fileBlob = new Blob([content], {
        type: ext === 'md' ? 'text/markdown' : 'text/plain;charset=utf-8',
      });
      const file = new File([fileBlob], `edit_${Date.now()}.${ext}`, { type: fileBlob.type });

      const form = new FormData();
      form.append('file', file);
      form.append('title', 'IGNORED'); // backend dùng documentId nên title bị ignore
      form.append('documentId', docId);
      form.append('commitMessage', commitMessage);

      await axiosClient.post(`/projects/${projectIdFromDoc}/documents/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCommitMessage('');
      setOriginal(content);
      onSaved();
      alert('✓ Đã lưu version mới. Lock sẽ được release tự động (theo logic backend upload).');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-5 text-sm text-gray-500">Đang tải nội dung...</div>;

  return (
    <div className="space-y-3">
      <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded">
        ✏️ <b>Chế độ chỉnh sửa online</b> — chỉnh trực tiếp nội dung, bấm "Lưu thành phiên bản mới"
        để tạo v{Date.now() > 0 ? '?' : ''} mới (append-only). Lock sẽ tự động giải phóng sau khi
        upload thành công.
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        className="w-full border-2 rounded p-3 font-mono text-sm focus:border-viettel-red focus:outline-none"
        style={{ height: '60vh' }}
      />

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <label className="block text-xs text-gray-500 mb-1">
            Commit message * <span className="text-gray-400">(bắt buộc, mô tả thay đổi)</span>
          </label>
          <input
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="VD: Sửa logic xác thực OTP cho luồng thanh toán"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-40"
        >
          {saving ? '⏳ Đang lưu...' : isDirty ? '💾 Lưu thành phiên bản mới' : 'Chưa thay đổi'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------- Metadata Tab ----------
function MetadataTab({ doc }: { doc: DocumentDetail }) {
  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <Field label="Document ID" value={<span className="font-mono">{doc.id}</span>} />
      <Field label="Tiêu đề" value={doc.title} />
      <Field
        label="Trạng thái (FSM)"
        value={
          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[doc.status]}`}>
            {doc.status}
          </span>
        }
      />
      <Field
        label="Cấp độ bảo mật (ABAC)"
        value={
          <span className={`px-2 py-0.5 rounded text-xs ${SECURITY_BADGE[doc.securityLevel]}`}>
            {doc.securityLevel}
          </span>
        }
      />
      <Field
        label="Lock đang giữ bởi"
        value={
          doc.lockedBy ? (
            <span className="font-mono text-xs">{doc.lockedBy}</span>
          ) : (
            <span className="text-gray-400">— (chưa lock)</span>
          )
        }
      />
      <Field
        label="Published Version"
        value={
          doc.publishedVersionId ? (
            <span className="font-mono text-xs">{doc.publishedVersionId.slice(0, 8)}…</span>
          ) : (
            <span className="text-gray-400">— (chưa Release)</span>
          )
        }
      />

      <div className="md:col-span-2 mt-4">
        <h3 className="font-semibold mb-2">ABAC ràng buộc lên tài liệu</h3>
        <div className="bg-gray-50 rounded p-4 text-xs space-y-2">
          <p>
            • Download yêu cầu <b>clearance ≥ {doc.securityLevel}</b>. Backend check qua{' '}
            <code>access.assertClearance()</code>.
          </p>
          <p>
            • Với CONFIDENTIAL: backend chèn watermark dynamic (email + IP + timestamp) lên PDF.
          </p>
          <p>
            • Anomaly: ZSET <code>user:download_freq:&lt;uid&gt;</code> vượt 10/phút → 429 + alert.
          </p>
          <p>
            • Mọi truy cập (allow/deny) đều ghi <code>audit_logs</code> với Hash Chaining SHA-256.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Versions Tab ----------
function VersionsTab({
  docId,
  doc,
  diffSelection,
  toggleDiff,
  onRestore,
  onDownload,
}: {
  docId: string;
  doc: DocumentDetail;
  diffSelection: string[];
  toggleDiff: (id: string) => void;
  onRestore: (versionId: string) => void;
  onDownload: (versionId: string) => void;
}) {
  const [previewing, setPreviewing] = useState<{ versionId: string; versionNo: number; fileType: string } | null>(null);

  return (
    <div className="p-5">
      <p className="text-xs text-gray-500 mb-3">
        💡 Tick 2 phiên bản để so sánh Diff. <b>Xem</b> = preview inline (modal). <b>Khôi phục</b> =
        append-only tạo version mới sao chép từ bản này (FR-3.1.3).
      </p>
      <ul className="space-y-3">
        {doc.versions.map((v, idx) => {
          const isLatest = idx === 0;
          const isPublished = v.id === doc.publishedVersionId;
          const isSelected = diffSelection.includes(v.id);
          return (
            <li
              key={v.id}
              className={`relative pl-10 ${idx < doc.versions.length - 1 ? 'pb-3 border-l-2 ml-3' : 'ml-3'}`}
              style={{ borderColor: idx < doc.versions.length - 1 ? '#e5e7eb' : 'transparent' }}
            >
              <div
                className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold -translate-x-1/2 ${
                  isPublished
                    ? 'bg-green-500 text-white'
                    : isLatest
                      ? 'bg-viettel-red text-white'
                      : 'bg-gray-300 text-gray-700'
                }`}
              >
                v{v.versionNo}
              </div>
              <div className="bg-gray-50 rounded p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleDiff(v.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">v{v.versionNo}.0</span>
                    <span className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border">
                      .{v.fileType}
                    </span>
                    {isPublished && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        ✓ Published (SSOT)
                      </span>
                    )}
                    {isLatest && !isPublished && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                        Mới nhất (chưa Release)
                      </span>
                    )}
                    {v.textExtracted && (
                      <span className="text-xs text-green-600">📑 raw_text OK</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{v.commitMessage}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    {v.uploadedBy} · {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setPreviewing({ versionId: v.id, versionNo: v.versionNo, fileType: v.fileType })}
                    className="text-xs px-2 py-1 border border-viettel-red text-viettel-red rounded hover:bg-red-50"
                    title="Xem nội dung phiên bản này"
                  >
                    👁 Xem
                  </button>
                  <button
                    onClick={() => onDownload(v.id)}
                    className="text-xs px-2 py-1 border rounded hover:bg-white"
                  >
                    ⬇ Tải
                  </button>
                  {!isLatest && (
                    <button
                      onClick={() => onRestore(v.id)}
                      className="text-xs px-2 py-1 border border-viettel-red text-viettel-red rounded hover:bg-red-50"
                      title="Append-only Rollback"
                    >
                      ↺ Khôi phục
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Modal preview version cũ */}
      {previewing && (
        <VersionPreviewModal
          docId={docId}
          versionId={previewing.versionId}
          versionNo={previewing.versionNo}
          fileType={previewing.fileType}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

// ---------- Modal Preview cho version cũ (C3 fix #3) ----------
function VersionPreviewModal({
  docId,
  versionId,
  versionNo,
  fileType,
  onClose,
}: {
  docId: string;
  versionId: string;
  versionNo: number;
  fileType: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosClient
      .get<{ previewUrl: string }>(`/documents/${docId}/versions/${versionId}/preview`)
      .then((r) => setUrl(r.data.previewUrl))
      .catch((e) =>
        setError(e?.response?.data?.message ?? `Lỗi lấy preview v${versionNo}`),
      );
  }, [docId, versionId, versionNo]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">
            Xem v{versionNo}.0 ·{' '}
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{fileType}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-danger text-xl">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {error && <div className="text-sm text-danger">{error}</div>}
          {!url && !error && <div className="text-sm text-gray-500">Đang tải...</div>}
          {url && (
            <>
              {fileType === 'pdf' && <PdfPreview url={url} />}
              {fileType === 'md' && <MarkdownPreview url={url} />}
              {fileType === 'txt' && <TextPreview url={url} />}
              {fileType === 'docx' && <DocxPreview url={url} />}
              {!['pdf', 'md', 'txt', 'docx'].includes(fileType) && (
                <div className="text-center text-sm text-gray-500 p-10">
                  Định dạng .{fileType} chưa hỗ trợ preview inline.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Modal "Xin trả khóa" (D4 Phase 5) ----------
function RequestUnlockModal({
  docTitle,
  onClose,
  onSubmit,
  isPending,
}: {
  docTitle: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  const canSubmit = reason.trim().length >= 10;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">🙏 Xin trả khóa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-danger text-xl">
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Tài liệu <b>"{docTitle}"</b> đang bị giữ khóa. Bạn có thể gửi yêu cầu kèm lý do — hệ
          thống sẽ <b>email cho người đang giữ</b> để họ chủ động trả khóa.
        </p>
        <label className="block text-xs text-gray-500 mb-1">
          Lý do cần khóa * <span className="text-gray-400">(tối thiểu 10 ký tự)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="VD: Cần sửa gấp lỗi mã hóa OTP trước cuối ngày — vui lòng trả khóa giúp tôi."
          className="w-full border rounded px-3 py-2"
        />
        <div className="text-xs text-gray-500 mt-1">
          {reason.trim().length}/10 ký tự
        </div>
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded mt-3">
          ℹ️ Anti-spam: bạn chỉ được xin 1 lần / 1 tài liệu / 1 giờ.
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 border rounded py-2 text-sm">
            Hủy
          </button>
          <button
            onClick={() => onSubmit(reason.trim())}
            disabled={!canSubmit || isPending}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {isPending ? 'Đang gửi...' : '📨 Gửi yêu cầu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
