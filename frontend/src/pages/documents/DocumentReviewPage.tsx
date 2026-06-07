import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';
import { BackButton } from '../../shared/ui/BackButton';

/**
 * Luồng 17 — Approval Workflow (Split Screen).
 *  - LEFT: Document Content Sidebar — iframe preview latest version.
 *  - RIGHT: Decision Maker Panel — submitter info + comment + Approve/Reject buttons.
 *  - Reject: Strict Validation comment ≥ 10 ký tự + viền đỏ + tooltip.
 *  - Action Block Out Loading: full-page overlay khi mutate, chống double-submit.
 *  - Chỉ hoạt động khi status = UNDER_REVIEW (FSM gate).
 */

type Decision = 'APPROVE' | 'REJECT';

interface DocumentDetail {
  id: string;
  title: string;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'RELEASED' | 'ARCHIVED';
  securityLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
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

export function DocumentReviewPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const doc = useQuery<DocumentDetail>({
    queryKey: ['document', docId],
    queryFn: async () => (await axiosClient.get(`/documents/${docId}`)).data,
    enabled: !!docId,
  });

  // Sinh presigned URL cho version mới nhất
  useEffect(() => {
    if (!doc.data || doc.data.versions.length === 0) return;
    const latest = doc.data.versions[0];
    axiosClient
      .get<{ downloadUrl: string }>(
        `/documents/${doc.data.id}/versions/${latest.id}/download`,
      )
      .then((res) => setPreviewUrl(res.data.downloadUrl))
      .catch((e) => {
        const s = e?.response?.status;
        setPreviewError(
          s === 403
            ? 'Clearance không đủ — không thể preview tài liệu.'
            : e?.response?.data?.message ?? 'Lỗi tải preview',
        );
      });
  }, [doc.data]);

  const submitDecision = useMutation({
    mutationFn: async (vars: { action: Decision; comment: string }) =>
      (
        await axiosClient.post(`/documents/${docId}/review`, {
          action: vars.action,
          comment: vars.comment || undefined,
        })
      ).data,
    onSuccess: () => {
      // Quay về detail page sau khi quyết định
      setTimeout(() => navigate(`/documents/${docId}/detail`), 1500);
    },
  });

  const trimmedLen = comment.trim().length;
  const canReject = trimmedLen >= 10;
  const isSubmitting = submitDecision.isPending;
  const decided = submitDecision.isSuccess;

  if (doc.isLoading)
    return <div className="text-gray-500">Đang tải tài liệu chờ duyệt...</div>;
  if (doc.error || !doc.data) {
    const status = (doc.error as any)?.response?.status;
    return (
      <div className="bg-white rounded shadow p-6 text-center">
        <div className="text-4xl mb-2">🚫</div>
        <p className="text-danger">
          {status === 403
            ? 'Bạn không có quyền phê duyệt tài liệu này.'
            : status === 404
              ? 'Không tìm thấy tài liệu.'
              : (doc.error as any)?.response?.data?.message}
        </p>
        <Link to="/projects" className="text-viettel-red hover:underline text-sm">
          ‹ Quay lại
        </Link>
      </div>
    );
  }

  const latest = doc.data.versions[0];
  const notUnderReview = doc.data.status !== 'UNDER_REVIEW';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <BackButton to={`/documents/${docId}/detail`} label="← Về chi tiết tài liệu" />
          <h1 className="text-2xl font-bold mt-1">
            ⚖️ Phê duyệt: {doc.data.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            FSM Gate: chỉ xử lý khi <code>status = UNDER_REVIEW</code>. APPROVE → RELEASED,
            REJECT → DRAFT + giải phóng lock.
          </p>
        </div>
      </div>

      {notUnderReview && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-4 text-sm text-yellow-800">
          ⚠️ Tài liệu này hiện <b>không ở trạng thái UNDER_REVIEW</b> (đang là{' '}
          <code>{doc.data.status}</code>). Workflow FSM sẽ từ chối API submit. Bạn vẫn xem được
          UI để demo, nhưng nút bấm sẽ trả lỗi.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT — Document Content Sidebar */}
        <section className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b flex items-center justify-between bg-gray-50">
            <div>
              <h2 className="font-semibold text-sm">
                Phiên bản đang thẩm định: v{latest?.versionNo}.0
              </h2>
              <p className="text-xs text-gray-500">
                {latest?.uploadedBy} · {latest && new Date(latest.createdAt).toLocaleString()}
              </p>
            </div>
            {latest && (
              <a
                href={previewUrl ?? '#'}
                target="_blank"
                rel="noopener"
                onClick={(e) => {
                  if (!previewUrl) e.preventDefault();
                }}
                className="text-xs px-3 py-1.5 border rounded hover:bg-white disabled:opacity-50"
              >
                ⬇ Mở file gốc
              </a>
            )}
          </div>

          <div className="flex-1 bg-gray-100" style={{ minHeight: '70vh' }}>
            {previewError && (
              <div className="p-6 text-sm text-danger">{previewError}</div>
            )}
            {!previewError && !previewUrl && (
              <div className="p-6 text-sm text-gray-500">Đang sinh presigned URL...</div>
            )}
            {previewUrl && latest && (
              <>
                {/pdf|txt|md/.test(latest.fileType) ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="document-review-preview"
                  />
                ) : (
                  <div className="p-10 text-center text-sm text-gray-500">
                    Định dạng <code>.{latest.fileType}</code> không preview được trực tiếp. Bấm{' '}
                    <b>Mở file gốc</b> ở góc phải trên.
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* RIGHT — Decision Maker Panel */}
        <aside className="lg:col-span-2 bg-white rounded-lg shadow p-5 space-y-4 h-fit">
          <div>
            <h2 className="font-semibold">Hội đồng phê duyệt</h2>
            <p className="text-xs text-gray-500 mt-1">
              Quyết định sẽ được hash-chained vào audit_logs + bắn email tới tác giả qua
              BullMQ mailer.
            </p>
          </div>

          {/* Submitter info */}
          {latest && (
            <div className="bg-gray-50 rounded p-3 text-sm">
              <div className="font-semibold mb-1">Người nộp</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-viettel-red text-white flex items-center justify-center text-xs font-bold">
                  {latest.uploadedBy.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div>{latest.uploadedBy}</div>
                  <div className="text-xs text-gray-500">
                    Nộp {new Date(latest.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t">
                <div className="text-xs text-gray-500">Lý do cập nhật / Commit message:</div>
                <p className="text-sm italic mt-1">"{latest.commitMessage}"</p>
              </div>
            </div>
          )}

          {/* Lịch sử phê duyệt — show all versions thay vì gọi API mới */}
          <details className="bg-gray-50 rounded p-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              📜 Lịch sử ({doc.data.versions.length} version)
            </summary>
            <ul className="mt-2 space-y-2 text-xs">
              {doc.data.versions.map((v) => (
                <li key={v.id} className="border-l-2 pl-2 border-gray-300">
                  <div>
                    <span className="font-medium">v{v.versionNo}.0</span> · {v.uploadedBy}
                  </div>
                  <div className="text-gray-500">
                    {new Date(v.createdAt).toLocaleString()} — {v.commitMessage}
                  </div>
                </li>
              ))}
            </ul>
          </details>

          {/* Comment */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Ý kiến phản hồi / Lý do từ chối{' '}
              <span className="text-gray-400">(REJECT bắt buộc ≥ 10 ký tự)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              disabled={isSubmitting || decided || notUnderReview}
              placeholder="VD: Tài liệu thiết kế API thiếu trường mã hóa OTP ở luồng thanh toán chính. Yêu cầu bổ sung..."
              className={`w-full border rounded px-3 py-2 disabled:bg-gray-50 ${
                decision === 'REJECT' && !canReject ? 'border-danger' : ''
              }`}
            />
            <div className="flex justify-between text-xs mt-1">
              <span
                className={
                  decision === 'REJECT' && !canReject
                    ? 'text-danger'
                    : trimmedLen >= 10
                      ? 'text-green-600'
                      : 'text-gray-400'
                }
              >
                {trimmedLen} / 10 ký tự
              </span>
              {decision === 'REJECT' && !canReject && (
                <span className="text-danger">
                  Bắt buộc nhập lý do từ chối để Contributor biết phải sửa gì.
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                setDecision('APPROVE');
                submitDecision.mutate({ action: 'APPROVE', comment });
              }}
              disabled={isSubmitting || decided || notUnderReview}
              className="bg-green-600 hover:bg-green-700 text-white py-3 rounded font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              ✓ Phê duyệt (Approve)
            </button>
            <button
              onClick={() => {
                setDecision('REJECT');
                if (canReject)
                  submitDecision.mutate({ action: 'REJECT', comment });
              }}
              disabled={isSubmitting || decided || notUnderReview || (decision === 'REJECT' && !canReject)}
              className="bg-danger hover:bg-red-700 text-white py-3 rounded font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              ✗ Từ chối (Reject)
            </button>
          </div>

          {submitDecision.error && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              {(submitDecision.error as any)?.response?.data?.message ?? 'Lỗi gửi quyết định.'}
            </div>
          )}
          {decided && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
              ✓ Đã ghi nhận quyết định. Email thông báo đã enqueue qua BullMQ. Đang chuyển hướng...
            </div>
          )}
        </aside>
      </div>

      {/* Action Block Out Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm text-center">
            <div className="text-5xl mb-3 animate-pulse">⏳</div>
            <h3 className="font-semibold mb-1">Đang ghi quyết định...</h3>
            <p className="text-sm text-gray-600">
              Backend đang chạy FSM transition + hash-chain audit log + enqueue notification.
              Vui lòng KHÔNG đóng tab.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
