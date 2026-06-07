import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

interface PolicyRow {
  id: number;
  ptype: 'p' | 'g';
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
  locked: boolean;
}

interface SimulateResult {
  isAllowed: boolean;
  matchedRuleId: number | null;
  matchedRule: { p: string[] } | null;
  reason: string;
}

const ACTIONS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'DOWNLOAD', '*'];

export function PolicyBuilderPage() {
  const qc = useQueryClient();
  const policies = useQuery<PolicyRow[]>({
    queryKey: ['policies'],
    queryFn: async () => (await axiosClient.get('/admin/policies')).data,
  });

  // --- Builder state ---
  const [builderPtype, setBuilderPtype] = useState<'p' | 'g'>('p');
  const [subjectCondition, setSubjectCondition] = useState('role_pm_<projectId>');
  const [objectCondition, setObjectCondition] = useState('/api/v1/projects/<projectId>/*');
  const [action, setAction] = useState('*');
  const [contextCondition, setContextCondition] = useState('');
  const [effect, setEffect] = useState<'allow' | 'deny'>('allow');
  // grouping
  const [gSubject, setGSubject] = useState('');
  const [gRole, setGRole] = useState('');

  const builderJson = useMemo(
    () =>
      builderPtype === 'p'
        ? { ptype: 'p', subjectCondition, objectCondition, action, contextCondition, effect }
        : { ptype: 'g', v0: gSubject, v1: gRole },
    [builderPtype, subjectCondition, objectCondition, action, contextCondition, effect, gSubject, gRole],
  );

  const createPolicy = useMutation({
    mutationFn: async () => (await axiosClient.post('/admin/policies', builderJson)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });
  const deletePolicy = useMutation({
    mutationFn: async (id: number) => (await axiosClient.delete(`/admin/policies/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });

  // --- Simulator state ---
  const [simSub, setSimSub] = useState('');
  const [simObj, setSimObj] = useState('/api/v1/projects/some-id/folders');
  const [simAct, setSimAct] = useState('GET');
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const simulate = useMutation({
    mutationFn: async () => {
      const r = await axiosClient.post<SimulateResult>('/admin/policies/simulate', {
        sub: simSub,
        obj: simObj,
        act: simAct,
      });
      setSimResult(r.data);
      return r.data;
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">ABAC Policy Manager + Visual Rule Builder</h1>
          <p className="text-xs text-gray-500 mt-1">
            Casbin Engine · Default Deny (FR-4.1.3) · Hot-reload sau mỗi thay đổi
          </p>
        </div>
        <Link
          to="/admin/policies/guide"
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium flex items-center gap-2"
        >
          📖 Hướng dẫn chi tiết
        </Link>
      </div>

      {/* D6: Quick-help inline */}
      <details className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-sm">
        <summary className="font-semibold text-blue-800 cursor-pointer">
          ❓ Đọc nhanh trước khi tạo luật (5 dòng)
        </summary>
        <ul className="mt-3 space-y-1 list-disc ml-6 text-gray-700 text-xs">
          <li>
            <code className="bg-white px-1 rounded">ptype = p</code>: Policy — cấp/từ chối quyền (vd:
            "role_pm có thể POST /projects/X/*")
          </li>
          <li>
            <code className="bg-white px-1 rounded">ptype = g</code>: Grouping — gán user vào role (vd:
            "user UUID = role_pm_X")
          </li>
          <li>
            <b>Wildcard</b> <code className="bg-white px-1 rounded">*</code>: match 1 segment path
            hoặc mọi action
          </li>
          <li>
            <b>Quy ước role name</b>: <code>role_pm_&lt;projectId&gt;</code>,{' '}
            <code>role_contributor_&lt;projectId&gt;</code>, <code>role_admin</code> (global)
          </li>
          <li>
            <b>Test trước khi áp</b>: dùng Simulator panel bên phải để verify luật trước khi đẩy DB.
          </li>
        </ul>
        <Link
          to="/admin/policies/guide"
          className="inline-block mt-3 text-blue-700 hover:underline text-xs"
        >
          → Xem hướng dẫn đầy đủ với 5 ví dụ thực tế
        </Link>
      </details>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Policies list */}
        <div className="xl:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Policies ({policies.data?.length ?? 0})
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">ptype</th>
                  <th className="px-3 py-2">Subject (v0)</th>
                  <th className="px-3 py-2">Object/Role (v1)</th>
                  <th className="px-3 py-2">Action (v2)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {policies.data?.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50 ${
                      simResult?.matchedRuleId === p.id ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          p.ptype === 'p' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {p.ptype}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{truncate(p.v0)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{truncate(p.v1)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.v2 ?? '—'}</td>
                    <td className="px-3 py-2">
                      {p.locked ? (
                        <span className="text-xs text-gray-400" title="Luật lõi, không xóa được">
                          🔒
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`Xóa luật #${p.id}?`)) deletePolicy.mutate(p.id);
                          }}
                          className="text-xs text-danger hover:underline"
                        >
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Builder + Simulator */}
        <div className="xl:col-span-2 space-y-4">
          {/* Builder */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Tạo luật mới</h2>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setBuilderPtype('p')}
                className={`flex-1 py-1.5 rounded text-sm border ${
                  builderPtype === 'p' ? 'bg-viettel-red text-white border-viettel-red' : ''
                }`}
              >
                Policy (p)
              </button>
              <button
                onClick={() => setBuilderPtype('g')}
                className={`flex-1 py-1.5 rounded text-sm border ${
                  builderPtype === 'g' ? 'bg-viettel-red text-white border-viettel-red' : ''
                }`}
              >
                Grouping (g)
              </button>
            </div>

            {builderPtype === 'p' ? (
              <div className="space-y-2 text-sm">
                <Field label="Subject" hint="role hoặc r.sub.<thuộc tính>">
                  <input
                    value={subjectCondition}
                    onChange={(e) => setSubjectCondition(e.target.value)}
                    className="w-full border rounded px-2 py-1 font-mono text-xs"
                  />
                </Field>
                <Field label="Object / Path">
                  <input
                    value={objectCondition}
                    onChange={(e) => setObjectCondition(e.target.value)}
                    className="w-full border rounded px-2 py-1 font-mono text-xs"
                  />
                </Field>
                <Field label="Action">
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Context (tùy chọn)" hint="VD: r.ctx.hour >= 8 && r.ctx.hour <= 18">
                  <input
                    value={contextCondition}
                    onChange={(e) => setContextCondition(e.target.value)}
                    className="w-full border rounded px-2 py-1 font-mono text-xs"
                  />
                </Field>
                <Field label="Effect">
                  <select
                    value={effect}
                    onChange={(e) => setEffect(e.target.value as 'allow' | 'deny')}
                    className="w-full border rounded px-2 py-1"
                  >
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                  </select>
                </Field>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Field label="Subject (user ID hoặc role)">
                  <input
                    value={gSubject}
                    onChange={(e) => setGSubject(e.target.value)}
                    className="w-full border rounded px-2 py-1 font-mono text-xs"
                  />
                </Field>
                <Field label="Role">
                  <input
                    value={gRole}
                    onChange={(e) => setGRole(e.target.value)}
                    className="w-full border rounded px-2 py-1 font-mono text-xs"
                  />
                </Field>
              </div>
            )}

            <div className="mt-3 text-xs text-gray-500">Cấu trúc JSON sinh tự động:</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded overflow-auto mt-1">
              {JSON.stringify(builderJson, null, 2)}
            </pre>
            <button
              onClick={() => createPolicy.mutate()}
              disabled={createPolicy.isPending}
              className="w-full mt-3 bg-viettel-red text-white py-2 rounded font-medium disabled:opacity-50"
            >
              {createPolicy.isPending ? 'Đang áp dụng...' : 'Áp dụng luật lên hệ thống'}
            </button>
            {createPolicy.error && (
              <div className="text-xs text-danger mt-2">
                {(createPolicy.error as any)?.response?.data?.message ?? 'Lỗi'}
              </div>
            )}
            {createPolicy.isSuccess && (
              <div className="text-xs text-green-700 mt-2">✓ Đã đẩy luật vào Casbin Engine.</div>
            )}
          </div>

          {/* Simulator */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Policy Simulator (Dry-run)</h2>
            <Field label="Subject (userId hoặc role)">
              <input
                value={simSub}
                onChange={(e) => setSimSub(e.target.value)}
                placeholder="uuid"
                className="w-full border rounded px-2 py-1 font-mono text-xs"
              />
            </Field>
            <Field label="Object / Path">
              <input
                value={simObj}
                onChange={(e) => setSimObj(e.target.value)}
                className="w-full border rounded px-2 py-1 font-mono text-xs mt-2"
              />
            </Field>
            <Field label="Action">
              <select
                value={simAct}
                onChange={(e) => setSimAct(e.target.value)}
                className="w-full border rounded px-2 py-1 mt-2"
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <button
              onClick={() => simulate.mutate()}
              disabled={simulate.isPending || !simSub}
              className="w-full mt-3 bg-gray-800 text-white py-2 rounded text-sm disabled:opacity-50"
            >
              {simulate.isPending ? 'Đang kiểm tra...' : 'Kiểm tra quyền'}
            </button>

            {simResult && (
              <div
                className={`mt-3 rounded p-3 ${
                  simResult.isAllowed
                    ? 'bg-green-50 border border-green-300'
                    : 'bg-red-50 border border-red-300 animate-pulse'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {simResult.isAllowed ? (
                    <span className="text-green-700">✓ ALLOW</span>
                  ) : (
                    <span className="text-danger">✗ DENY</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">{simResult.reason}</div>
                {simResult.matchedRuleId && (
                  <div className="text-xs mt-2">
                    Khớp luật <span className="font-mono">#{simResult.matchedRuleId}</span> (đã highlight)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}
        {hint && <span className="ml-2 text-gray-400">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function truncate(s: string | null, len = 50): string {
  if (!s) return '—';
  return s.length > len ? s.slice(0, len) + '…' : s;
}
