import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * Luồng 24 — Compliance Export Configurator.
 *  - Filter form: startTime / endTime (datetime-local), format (CSV/PDF), scope (ALL/SECURITY_ONLY).
 *  - Live count preview: hit /admin/audit-logs?limit=1&startTime=...&endTime=... để ước tính (header).
 *  - Trigger POST /admin/audit-logs/export với responseType: 'blob' → tải xuống file.
 *  - PDF có Watermark dynamic + SHA-256 footer (backend pdf-lib).
 *  - CSV streaming server-side với DB cursor → RAM < 20MB.
 *  - Quick presets: 24h gần đây, 7 ngày, 30 ngày, tháng này.
 */
type Fmt = 'CSV' | 'PDF';
type Scope = 'ALL' | 'SECURITY_ONLY';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  isSuccess: boolean;
}
interface AuditPreview {
  logs: AuditLog[];
  meta: { hasMore: boolean };
}

function isoLocalNow(offsetMs: number = 0): string {
  const d = new Date(Date.now() + offsetMs);
  const off = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

const SECURITY_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'ACCESS_DENIED',
  'DOWNLOAD_DENIED',
  'SECURITY_ALERT',
  'EMERGENCY_LOCKDOWN',
  'LOCKDOWN_RELEASE',
  'PROJECT_ARCHIVED',
];

export function AuditExportPage() {
  // Default: 7 ngày gần đây
  const [startTime, setStartTime] = useState(isoLocalNow(-7 * 24 * 60 * 60 * 1000));
  const [endTime, setEndTime] = useState(isoLocalNow());
  const [format, setFormat] = useState<Fmt>('PDF');
  const [scope, setScope] = useState<Scope>('ALL');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const startIso = useMemo(() => new Date(startTime).toISOString(), [startTime]);
  const endIso = useMemo(() => new Date(endTime).toISOString(), [endTime]);
  const rangeValid = new Date(startTime) < new Date(endTime);

  // Preview: lấy 50 log đầu để cho user thấy mẫu
  const preview = useQuery<AuditPreview>({
    queryKey: ['audit-preview', startIso, endIso, scope],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('limit', '50');
      p.set('startTime', startIso);
      p.set('endTime', endIso);
      const { data } = await axiosClient.get<AuditPreview>(`/admin/audit-logs?${p}`);
      // Client-side filter cho SECURITY_ONLY (preview only — server vẫn streaming chính xác)
      if (scope === 'SECURITY_ONLY') {
        return {
          ...data,
          logs: data.logs.filter(
            (l) =>
              SECURITY_ACTIONS.includes(l.action) ||
              !l.isSuccess ||
              l.action.includes('DENIED'),
          ),
        };
      }
      return data;
    },
    enabled: rangeValid,
  });

  const triggerDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await axiosClient.post(
        '/admin/audit-logs/export',
        {
          startTime: startIso,
          endTime: endIso,
          format,
          scope,
        },
        { responseType: 'blob' },
      );

      // Sinh tên file từ Content-Disposition hoặc fallback
      const cd: string | undefined = res.headers['content-disposition'];
      const filenameMatch = cd?.match(/filename="?([^";]+)"?/);
      const fallback = `audit-${scope.toLowerCase()}-${startTime.slice(0, 10)}_${endTime.slice(0, 10)}.${format.toLowerCase()}`;
      const filename = filenameMatch?.[1] ?? fallback;

      const blob = new Blob([res.data], {
        type:
          format === 'PDF'
            ? 'application/pdf'
            : 'text/csv; charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      // Nếu server trả JSON lỗi (vì responseType blob → convert)
      if (e?.response?.data instanceof Blob) {
        const txt = await e.response.data.text();
        try {
          const obj = JSON.parse(txt);
          setDownloadError(obj.message ?? 'Lỗi export');
        } catch {
          setDownloadError('Lỗi export — phản hồi không phải JSON.');
        }
      } else {
        setDownloadError(
          e?.response?.data?.message ?? e?.message ?? 'Lỗi export',
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  // Quick presets
  const applyPreset = (ms: number) => {
    setStartTime(isoLocalNow(-ms));
    setEndTime(isoLocalNow());
  };

  const previewCount = preview.data?.logs.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/audit-logs" className="text-xs text-gray-500 hover:text-viettel-red">
            ‹ Audit Ledger
          </Link>
          <h1 className="text-2xl font-bold mt-1">📤 Compliance Export Configurator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kết xuất audit_logs phục vụ thanh tra (FR-5.3.2). PDF có Watermark Admin+IP+Timestamp
            + chữ ký SHA-256 footer. CSV streaming server-side &lt; 20MB RAM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Filter form */}
        <section className="lg:col-span-1 bg-white rounded-lg shadow p-5 space-y-4 h-fit">
          <h2 className="font-semibold">Cấu hình xuất</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Từ thời điểm *</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Đến thời điểm *</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            {!rangeValid && (
              <p className="text-xs text-danger mt-1">
                Thời điểm bắt đầu phải trước thời điểm kết thúc.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Quick range</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyPreset(24 * 60 * 60 * 1000)}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                24 giờ qua
              </button>
              <button
                onClick={() => applyPreset(7 * 24 * 60 * 60 * 1000)}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                7 ngày qua
              </button>
              <button
                onClick={() => applyPreset(30 * 24 * 60 * 60 * 1000)}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                30 ngày qua
              </button>
              <button
                onClick={() => applyPreset(90 * 24 * 60 * 60 * 1000)}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                90 ngày qua
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Phạm vi</label>
            <div className="grid grid-cols-1 gap-2">
              <label
                className={`border rounded p-2 cursor-pointer ${
                  scope === 'ALL' ? 'border-viettel-red bg-red-50' : ''
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'ALL'}
                  onChange={() => setScope('ALL')}
                  className="mr-2"
                />
                <span className="text-sm font-medium">📋 ALL</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Toàn bộ audit logs trong khoảng thời gian.
                </p>
              </label>
              <label
                className={`border rounded p-2 cursor-pointer ${
                  scope === 'SECURITY_ONLY' ? 'border-viettel-red bg-red-50' : ''
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'SECURITY_ONLY'}
                  onChange={() => setScope('SECURITY_ONLY')}
                  className="mr-2"
                />
                <span className="text-sm font-medium">🚨 SECURITY_ONLY</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Chỉ events DENY/ALERT/LOCKDOWN/Login fail.
                </p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Định dạng</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormat('PDF')}
                className={`px-3 py-3 text-sm border-2 rounded ${
                  format === 'PDF' ? 'border-viettel-red bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="font-semibold">📄 PDF</div>
                <div className="text-xs text-gray-500 mt-1">
                  Watermark + SHA-256 footer
                </div>
              </button>
              <button
                onClick={() => setFormat('CSV')}
                className={`px-3 py-3 text-sm border-2 rounded ${
                  format === 'CSV' ? 'border-viettel-red bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="font-semibold">📊 CSV</div>
                <div className="text-xs text-gray-500 mt-1">
                  UTF-8 BOM, streaming
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={triggerDownload}
            disabled={!rangeValid || downloading}
            className="w-full bg-viettel-red text-white py-3 rounded font-medium disabled:opacity-40"
          >
            {downloading ? '⏳ Đang stream từ DB...' : `📥 Tải xuống ${format}`}
          </button>

          {downloadError && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">
              {downloadError}
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
            <p>
              ⚠️ <b>Compliance:</b> mọi lần xuất sẽ ghi log <code>AUDIT_EXPORT</code> với hash
              chain — kẻ xuất không thể chối bỏ.
            </p>
            <p>
              🔏 PDF được nhúng <b>watermark dynamic</b> ghi email + IP của Admin xuất + footer
              chữ ký SHA-256 cuối tệp.
            </p>
          </div>
        </section>

        {/* RIGHT — Preview */}
        <section className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold">Preview (50 dòng đầu)</h2>
            <div className="text-xs text-gray-500">
              {scope === 'SECURITY_ONLY'
                ? 'Filter client-side: chỉ events bảo mật'
                : 'Toàn bộ logs'}{' '}
              ·{' '}
              {preview.isLoading ? (
                <span>đang tải...</span>
              ) : (
                <>
                  <b>{previewCount}</b> dòng preview
                  {preview.data?.meta.hasMore && ' · còn nữa →'}
                </>
              )}
            </div>
          </div>
          {!rangeValid && (
            <div className="p-6 text-center text-sm text-gray-500">
              Đặt khoảng thời gian hợp lệ để xem preview.
            </div>
          )}
          {preview.isLoading && rangeValid && (
            <div className="p-6 text-sm text-gray-500">Đang truy vấn cursor pagination...</div>
          )}
          {preview.error && (
            <div className="p-6 text-sm text-danger">
              {(preview.error as any)?.response?.data?.message ?? 'Lỗi truy vấn audit logs'}
            </div>
          )}
          {preview.data && previewCount === 0 && (
            <div className="p-10 text-center">
              <div className="text-4xl mb-2">🗒</div>
              <p className="text-sm text-gray-500">
                Không có log nào khớp khoảng thời gian + phạm vi đã chọn.
              </p>
            </div>
          )}
          {preview.data && previewCount > 0 && (
            <div className="max-h-[500px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">OK</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.data.logs.map((l) => (
                    <tr key={l.id} className={!l.isSuccess ? 'bg-red-50' : ''}>
                      <td className="px-3 py-1.5 font-mono text-xs">{l.id}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 font-medium">{l.action}</td>
                      <td className="px-3 py-1.5">
                        {l.isSuccess ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-danger">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 sticky bottom-0">
                💡 Preview hiển thị tối đa 50 dòng. File xuất ra sẽ stream <b>toàn bộ</b> log
                khớp filter qua DB cursor — không bị giới hạn 50.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
