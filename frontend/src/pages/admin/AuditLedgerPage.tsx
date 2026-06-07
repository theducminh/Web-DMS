import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

interface LogRow {
  id: string;
  timestamp: string;
  userId: string | null;
  action: string;
  targetId: string | null;
  ipAddress: string | null;
  isSuccess: boolean;
  failReason: string | null;
  metadata: any;
  currentHash: string;
}
interface LogsResponse {
  logs: LogRow[];
  meta: { hasMore: boolean; nextCursor: string | null };
}

export function AuditLedgerPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery<LogsResponse>({
    queryKey: ['audit-logs', cursor, statusFilter, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (cursor) params.set('cursor', cursor);
      if (statusFilter) params.set('status', statusFilter);
      if (actionFilter) params.set('action', actionFilter);
      return (await axiosClient.get<LogsResponse>(`/admin/audit-logs?${params}`)).data;
    },
  });

  const onLoadMore = () => {
    if (query.data?.meta.nextCursor) setCursor(query.data.meta.nextCursor);
  };
  const onReset = () => {
    setCursor(null);
    setExpanded(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Ledger</h1>
        <Link
          to="/admin/audit-logs/export"
          className="px-3 py-2 bg-viettel-red text-white rounded text-sm font-medium hover:bg-red-700"
        >
          📤 Kết xuất tuân thủ →
        </Link>
      </div>

      <div className="bg-white rounded shadow p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              onReset();
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">Tất cả</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hành động</label>
          <input
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              onReset();
            }}
            placeholder="VD: LOGIN, ACCESS_DENIED"
            className="border rounded px-3 py-2"
          />
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Cursor: <span className="font-mono">{cursor ?? '(đầu trang)'}</span>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">OK</th>
              <th className="px-3 py-2">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {query.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-500">
                  Đang tải...
                </td>
              </tr>
            )}
            {query.data?.logs.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className={`cursor-pointer hover:bg-gray-50 ${!r.isSuccess ? 'bg-red-50' : ''}`}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="px-3 py-2 font-mono">{r.id}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{r.userId?.slice(0, 8) ?? '—'}…</td>
                  <td className="px-3 py-2 font-medium">{r.action}</td>
                  <td className="px-3 py-2 text-xs">{r.ipAddress ?? '—'}</td>
                  <td className="px-3 py-2">
                    {r.isSuccess ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-danger">✗</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.currentHash.slice(0, 12)}…</td>
                </tr>
                {expanded === r.id && (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 bg-gray-50">
                      <pre className="text-xs overflow-auto bg-white p-3 rounded border">
                        {JSON.stringify(
                          {
                            targetId: r.targetId,
                            failReason: r.failReason,
                            metadata: r.metadata,
                            currentHash: r.currentHash,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {query.data && query.data.logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-500">
                  Không có log khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {query.data?.logs.length ?? 0} dòng · hasMore: {String(query.data?.meta.hasMore ?? false)}
        </div>
        <div className="flex gap-2">
          <button onClick={onReset} className="px-3 py-1.5 border rounded text-sm">
            Quay về đầu
          </button>
          <button
            onClick={onLoadMore}
            disabled={!query.data?.meta.hasMore}
            className="px-3 py-1.5 bg-viettel-red text-white rounded text-sm disabled:opacity-50"
          >
            Tải thêm
          </button>
        </div>
      </div>
    </div>
  );
}
