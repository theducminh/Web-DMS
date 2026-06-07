import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

interface ComplianceRow {
  requiredCategory: string;
  mappedDocument: string | null;
  docStatus: string;
  compliant: boolean;
}
interface ComplianceResponse {
  releaseId: string;
  releaseName: string;
  templateApplied: string | null;
  status: 'VERIFIED' | 'VIOLATED' | 'PROCESSING';
  isCompliant: boolean;
  summary: { totalRequired: number; passed: number; failed: number };
  checklist: ComplianceRow[];
}
interface ExportStatus {
  status: 'PROCESSING' | 'READY';
  downloadUrl?: string;
  message?: string;
}

export function CompliancePage() {
  const { projectId, releaseId } = useParams<{ projectId: string; releaseId: string }>();
  const compliance = useQuery<ComplianceResponse>({
    queryKey: ['compliance', projectId, releaseId],
    queryFn: async () =>
      (await axiosClient.get(`/projects/${projectId}/releases/${releaseId}/compliance`)).data,
    enabled: !!projectId && !!releaseId,
  });

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportStatus | null>(null);

  const triggerExport = useMutation({
    mutationFn: async () =>
      (await axiosClient.post(`/projects/${projectId}/releases/${releaseId}/export`)).data,
    onSuccess: () => {
      setExporting(true);
      setExportResult({ status: 'PROCESSING' });
      pollExport();
    },
  });

  const pollExport = () => {
    const start = Date.now();
    const interval = window.setInterval(async () => {
      try {
        const res = await axiosClient.get<ExportStatus>(
          `/projects/${projectId}/releases/${releaseId}/export`,
        );
        if (res.data.status === 'READY' || Date.now() - start > 60000) {
          window.clearInterval(interval);
          setExporting(false);
          setExportResult(res.data);
        }
      } catch {
        window.clearInterval(interval);
        setExporting(false);
      }
    }, 1500);
  };

  if (compliance.isLoading) return <div className="text-gray-500">Đang tải checklist...</div>;
  if (compliance.error) return <div className="text-danger">Không tải được dữ liệu.</div>;
  if (!compliance.data) return null;

  const c = compliance.data;
  const compliant = c.status === 'VERIFIED';

  return (
    <div className="space-y-4">
      <Link
        to={`/projects/${projectId}/releases`}
        className="text-sm text-gray-600 hover:text-viettel-red"
      >
        ← Quay lại danh sách
      </Link>

      <div
        className={`rounded-lg p-5 text-white shadow ${
          compliant
            ? 'bg-gradient-to-r from-green-600 to-green-700'
            : 'bg-gradient-to-r from-danger to-red-700 animate-pulse'
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl">{compliant ? '✓' : '⚠️'}</span>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{c.releaseName}</h1>
            <div className="text-sm opacity-90 mt-1">
              Template: {c.templateApplied ?? '—'} · Trạng thái: <strong>{c.status}</strong> ·
              Tuân thủ {c.summary.passed}/{c.summary.totalRequired}
            </div>
          </div>
          {!compliant && (
            <span className="text-xs uppercase bg-white text-danger px-3 py-1 rounded font-bold">
              VIOLATED
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Checklist (60%) */}
        <section className="lg:col-span-3 bg-white rounded-lg shadow">
          <h2 className="font-semibold p-4 border-b">Checklist hạng mục bắt buộc</h2>
          {c.checklist.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              Không có template chuẩn → không chấm tuân thủ.
            </div>
          ) : (
            <ul className="divide-y">
              {c.checklist.map((item) => (
                <li key={item.requiredCategory} className="p-4 flex items-center gap-3">
                  <span className={`text-2xl ${item.compliant ? 'text-green-600' : 'text-danger'}`}>
                    {item.compliant ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{item.requiredCategory}</div>
                    <div className="text-xs text-gray-500">
                      {item.mappedDocument ?? 'Không tìm thấy tài liệu phù hợp'}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      item.docStatus === 'RELEASED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-danger'
                    }`}
                  >
                    {item.docStatus}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Summary + Export (40%) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold mb-3">Tổng hợp</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Bắt buộc" value={c.summary.totalRequired} />
              <Stat label="Pass" value={c.summary.passed} color="text-green-700" />
              <Stat label="Fail" value={c.summary.failed} color="text-danger" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold mb-3">Xuất hồ sơ quy chuẩn</h2>
            {!compliant ? (
              <div className="text-sm text-gray-500">
                Chỉ xuất được khi đạt VERIFIED (100% tuân thủ).
              </div>
            ) : exportResult?.status === 'READY' && exportResult.downloadUrl ? (
              <a
                href={exportResult.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-600 text-white text-center py-3 rounded font-bold"
              >
                ⬇ Tải gói .zip
              </a>
            ) : exporting ? (
              <div className="text-sm">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  ⏳ Worker BullMQ đang kéo file từ MinIO và nén ZIP...
                </div>
              </div>
            ) : (
              <button
                onClick={() => triggerExport.mutate()}
                disabled={triggerExport.isPending}
                className="w-full bg-viettel-red text-white py-3 rounded font-bold uppercase"
              >
                {triggerExport.isPending ? 'Đang gửi yêu cầu...' : 'Xuất Hồ Sơ Quy Chuẩn'}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-3xl font-bold ${color ?? 'text-viettel-red'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
