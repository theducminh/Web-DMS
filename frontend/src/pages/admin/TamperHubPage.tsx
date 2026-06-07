import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

interface IntegrityStatus {
  status: 'SECURE' | 'COMPROMISED' | 'NO_SCAN' | 'PROCESSING';
  corruptedRowId?: string;
  reason?: string;
  scannedRows?: number;
  finishedAt?: string;
  message?: string;
}
interface AlertRow {
  id: string;
  timestamp: string;
  action: string;
  userId: string | null;
  ipAddress: string | null;
  failReason: string | null;
}
interface LockdownState {
  locked: boolean;
}

export function TamperHubPage() {
  const qc = useQueryClient();
  const integrity = useQuery<IntegrityStatus>({
    queryKey: ['integrity-status'],
    queryFn: async () => (await axiosClient.get('/admin/security/verify-integrity')).data,
    refetchInterval: 5000,
  });
  const alerts = useQuery<AlertRow[]>({
    queryKey: ['security-alerts'],
    queryFn: async () => (await axiosClient.get('/admin/security/alerts')).data,
    refetchInterval: 10000,
  });
  const lockdown = useQuery<LockdownState>({
    queryKey: ['lockdown-status'],
    queryFn: async () => (await axiosClient.get('/admin/security/lockdown/status')).data,
    refetchInterval: 5000,
  });

  const triggerScan = useMutation({
    mutationFn: async () => (await axiosClient.post('/admin/security/trigger-verify')).data,
    onSuccess: () =>
      setTimeout(() => qc.invalidateQueries({ queryKey: ['integrity-status'] }), 2000),
  });

  const compromised = integrity.data?.status === 'COMPROMISED';
  const locked = lockdown.data?.locked === true;

  return (
    <div className="space-y-5">
      {/* Hero Status Banner */}
      <div
        className={`rounded-lg p-6 text-white shadow ${
          compromised || locked
            ? 'bg-gradient-to-r from-danger to-red-700 animate-pulse'
            : 'bg-gradient-to-r from-green-600 to-green-700'
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl">{compromised || locked ? '⚠️' : '🛡️'}</span>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {locked
                ? 'SYSTEM LOCKED — EMERGENCY LOCKDOWN ACTIVE'
                : compromised
                  ? 'INTEGRITY COMPROMISED — SECURITY ALERT'
                  : 'SYSTEM INTEGRITY SECURE'}
            </h1>
            <p className="text-sm opacity-90 mt-1">
              {compromised
                ? `Phát hiện dấu hiệu can thiệp tại row ID #${integrity.data?.corruptedRowId}`
                : locked
                  ? 'Phong tỏa diện rộng đang được áp dụng. Mọi request đã bị 503.'
                  : 'Chuỗi Hash Chain audit_logs nguyên vẹn — không có dấu hiệu can thiệp.'}
            </p>
          </div>
          {compromised && (
            <span className="text-xs uppercase bg-white text-danger px-3 py-1 rounded font-bold">
              HIGH SEVERITY
            </span>
          )}
        </div>
      </div>

      {/* D7 (Phase 5): Explainer — giải thích chi tiết Hash Chain + cách tamper detection hoạt động */}
      <details className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5 text-sm">
        <summary className="font-semibold text-blue-800 cursor-pointer text-base">
          ❓ "SYSTEM INTEGRITY SECURE" nghĩa là gì? Hash Chain hoạt động ra sao?
        </summary>
        <div className="mt-4 space-y-4 text-gray-700">
          <div>
            <h3 className="font-semibold text-blue-700 mb-1">1. Hash Chaining cho audit_logs (FR-5.2)</h3>
            <p>
              Mỗi dòng audit log có 2 trường: <code className="bg-white px-1 rounded">previous_hash</code>{' '}
              và <code className="bg-white px-1 rounded">current_hash</code>. Khi INSERT 1 dòng mới,
              PostgreSQL <b>trigger DB tự động tính</b>:
            </p>
            <pre className="bg-gray-900 text-green-300 rounded p-3 text-xs font-mono mt-2 overflow-auto">
{`previous_hash = current_hash của dòng PREVIOUS (theo timestamp DESC, id DESC)
current_hash = SHA256(
  previous_hash || user_id || action || target_id || ip_address || timestamp || is_success
)`}
            </pre>
            <p className="mt-2">
              → Mỗi dòng "móc xích" vào dòng trước. Sửa 1 dòng giữa chuỗi sẽ phá vỡ hash của TẤT CẢ
              dòng sau nó.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-blue-700 mb-1">2. Append-only Trigger (NFR-1.3)</h3>
            <p>
              2 trigger DB ngăn UPDATE/DELETE trên audit_logs:
              <code className="bg-white px-1 rounded mx-1">trg_audit_no_update</code>,
              <code className="bg-white px-1 rounded mx-1">trg_audit_no_delete</code>. Mọi
              câu <code>UPDATE audit_logs</code> hoặc <code>DELETE FROM audit_logs</code> sẽ raise
              exception. Kẻ tấn công phải có quyền <code>session_replication_role = replica</code>
              (chỉ DB superuser) mới bypass được trigger.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-blue-700 mb-1">3. Worker quét định kỳ (BullMQ)</h3>
            <p>
              <code className="bg-white px-1 rounded">IntegrityCheckerProcessor</code> dùng Keyset
              Pagination 1000 row/lô, mỗi row recompute SHA256 và so với{' '}
              <code className="bg-white px-1 rounded">current_hash</code> stored. Nếu mismatch →
              ghi 1 dòng <code>SECURITY_ALERT</code> mới + set Redis{' '}
              <code className="bg-white px-1 rounded">system:scan-result = COMPROMISED</code>.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
            <h3 className="font-semibold text-yellow-800 mb-1">
              🧪 Demo: Bạn muốn thử "tamper" để banner đỏ xuất hiện?
            </h3>
            <p className="text-xs mb-2">
              Chạy lệnh sau trên Supabase SQL Editor để bypass trigger + sửa 1 row, rồi bấm "Quét lại
              ngay":
            </p>
            <pre className="bg-gray-900 text-yellow-300 rounded p-3 text-xs font-mono overflow-auto">
{`SET session_replication_role = replica;
UPDATE audit_logs SET fail_reason='HACKED' WHERE id=5;
RESET session_replication_role;`}
            </pre>
            <p className="text-xs mt-2 text-gray-600">
              Sau khi quét, banner sẽ chuyển <span className="text-red-600 font-bold">đỏ</span> với
              "INTEGRITY COMPROMISED" + row #5 highlighted. Để khôi phục:
            </p>
            <pre className="bg-gray-900 text-yellow-300 rounded p-3 text-xs font-mono mt-1 overflow-auto">
{`SET session_replication_role = replica;
UPDATE audit_logs SET fail_reason='Sai email hoặc mật khẩu' WHERE id=5;
RESET session_replication_role;`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-blue-700 mb-1">4. Khi nào hệ thống "tự" detect?</h3>
            <ul className="list-disc ml-6 space-y-0.5">
              <li>
                <b>Login fail liên tiếp 3 lần</b> → user IP bị Redis rate-limit + ghi
                <code className="bg-white px-1 rounded mx-1">LOGIN_BRUTE_FORCE</code>.
              </li>
              <li>
                <b>ABAC clearance fail</b> (vd: INTERNAL user thử download CONFIDENTIAL doc) →
                <code className="bg-white px-1 rounded mx-1">ACCESS_DENIED</code>.
              </li>
              <li>
                <b>Anomaly download</b> (1 user tải &gt;10 doc/phút) →{' '}
                <code className="bg-white px-1 rounded mx-1">SECURITY_ALERT</code> + 429.
              </li>
              <li>
                <b>Force unlock</b> (Admin/PM ép unlock doc của người khác) →
                <code className="bg-white px-1 rounded mx-1">DOCUMENT_FORCE_UNLOCK</code>.
              </li>
              <li>
                <b>Emergency Lockdown</b> (Admin bấm Lockdown PIN) →{' '}
                <code className="bg-white px-1 rounded mx-1">EMERGENCY_LOCKDOWN</code> + mọi request
                trả 503.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-blue-700 mb-1">5. Vì sao "lúc nào cũng SECURE"?</h3>
            <p>
              Vì <b>không có ai tamper DB thật</b>. Trigger Append-only chặn mọi UPDATE/DELETE bình
              thường. Để tamper được phải có quyền superuser Postgres — trong production điều này
              được kiểm soát qua Supabase Dashboard + IAM. Demo "thử tamper" ở mục 3 chỉ work khi bạn
              dùng connection string superuser của Supabase.
            </p>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Integrity scan */}
        <section className="bg-white rounded-lg shadow p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Hash Chain Integrity (FR-5.2)</h2>
            <button
              onClick={() => triggerScan.mutate()}
              disabled={triggerScan.isPending}
              className="text-sm bg-viettel-red text-white px-3 py-1.5 rounded disabled:opacity-50"
            >
              {triggerScan.isPending ? 'Đang gửi yêu cầu...' : 'Quét lại ngay'}
            </button>
          </div>
          <div className="space-y-1 text-sm">
            <Row label="Trạng thái">
              <StatusPill status={integrity.data?.status ?? '...'} />
            </Row>
            <Row label="Số dòng đã quét">{integrity.data?.scannedRows ?? '—'}</Row>
            <Row label="Lần quét gần nhất">
              {integrity.data?.finishedAt ? new Date(integrity.data.finishedAt).toLocaleString() : '—'}
            </Row>
            {compromised && (
              <>
                <Row label="Row bị can thiệp">
                  <span className="font-mono text-danger">#{integrity.data?.corruptedRowId}</span>
                </Row>
                <Row label="Nguyên nhân">
                  <span className="text-danger">{integrity.data?.reason ?? '—'}</span>
                </Row>
              </>
            )}
            {integrity.data?.status === 'NO_SCAN' && (
              <div className="text-xs text-gray-500 mt-2">
                Chưa có lần quét nào. Bấm "Quét lại ngay" để khởi động BullMQ scanner.
              </div>
            )}
          </div>
        </section>

        {/* Lockdown control */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold mb-3">Emergency Lockdown</h2>
          {locked ? (
            <ReleaseLockdownPanel />
          ) : (
            <LockdownPanel />
          )}
        </section>
      </div>

      {/* Alerts list */}
      <section className="bg-white rounded-lg shadow">
        <h2 className="font-semibold p-4 border-b">Cảnh báo an ninh (gần đây)</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600 text-left">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Hành động</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {alerts.data?.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs">{new Date(a.timestamp).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-50 text-danger">
                    {a.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{a.userId?.slice(0, 8) ?? '—'}…</td>
                <td className="px-3 py-2 text-xs">{a.ipAddress ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{a.failReason ?? '-'}</td>
              </tr>
            ))}
            {alerts.data && alerts.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-gray-500">
                  Chưa có cảnh báo nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    SECURE: 'bg-green-100 text-green-700',
    COMPROMISED: 'bg-red-100 text-danger',
    NO_SCAN: 'bg-gray-100 text-gray-600',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${map[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

function LockdownPanel() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doLockdown = useMutation({
    mutationFn: async () =>
      (await axiosClient.post('/admin/security/lockdown', { securityPin: pin, reason })).data,
    onSuccess: () => {
      setModal(false);
      setPin('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['lockdown-status'] });
    },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Phong tỏa thất bại.'),
  });

  const startHold = () => {
    if (!pin || reason.length < 10) {
      setErr('Cần PIN + lý do (>=10 ký tự).');
      return;
    }
    setErr(null);
    setHolding(true);
    setProgress(0);
    const start = Date.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / 3000) * 100);
      setProgress(p);
      if (p >= 100) {
        cancelHold();
        doLockdown.mutate();
      }
    }, 50) as unknown as number;
  };
  const cancelHold = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setProgress(0);
  };
  useEffect(() => () => cancelHold(), []);

  return (
    <>
      <p className="text-xs text-gray-500 mb-3">
        Khi nghi ngờ hệ thống bị xâm phạm. Phong tỏa sẽ thu hồi mọi phiên (trừ Admin).
      </p>
      <button
        onClick={() => setModal(true)}
        className="w-full bg-danger text-white py-3 rounded font-bold uppercase tracking-wide hover:bg-red-700"
      >
        🔴 Kích hoạt phong tỏa khẩn cấp
      </button>

      {modal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => !holding && setModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl border-2 border-danger"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-danger mb-1">⚠️ Xác nhận phong tỏa</h3>
            <p className="text-xs text-gray-500 mb-4">
              Nhập mã PIN cấp cao + lý do, sau đó <strong>giữ đè</strong> nút xác nhận 3 giây.
            </p>
            <label className="block text-xs mb-1">Mã PIN khẩn cấp</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            <label className="block text-xs mb-1">Lý do (&gt;=10 ký tự)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            {err && (
              <div className="text-xs text-danger bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
                {err}
              </div>
            )}
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              className="relative w-full bg-danger text-white py-3 rounded font-bold uppercase overflow-hidden select-none"
            >
              <span
                className="absolute inset-y-0 left-0 bg-red-900/40 transition-all"
                style={{ width: `${progress}%` }}
              />
              <span className="relative">
                {holding ? `Giữ... ${Math.round(progress)}%` : '🔒 Giữ đè 3 giây để xác nhận'}
              </span>
            </button>
            <button
              onClick={() => setModal(false)}
              disabled={holding}
              className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ReleaseLockdownPanel() {
  const qc = useQueryClient();
  const release = useMutation({
    mutationFn: async () => (await axiosClient.post('/admin/security/lockdown/release')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lockdown-status'] }),
  });
  return (
    <div>
      <div className="bg-red-50 border border-red-200 rounded p-3 mb-3 text-sm">
        Hệ thống đang ở chế độ phong tỏa. Mọi request từ IP không an toàn bị 503.
      </div>
      <button
        onClick={() => release.mutate()}
        disabled={release.isPending}
        className="w-full bg-green-600 text-white py-2 rounded font-medium disabled:opacity-50"
      >
        {release.isPending ? 'Đang gỡ...' : '🟢 Gỡ phong tỏa'}
      </button>
    </div>
  );
}
