import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * Luồng 08 — Attribute Assignment (Admin).
 *  - Cột trái: hồ sơ tóm tắt (read-only).
 *  - Cột phải: form gán departmentId / title / clearanceLevel.
 *  - Clearance Escalation Warning khi chuyển sang CONFIDENTIAL.
 *  - Form Mutation State: nút "Lưu" chỉ sáng khi isDirty.
 *  - Sau khi PUT → backend force-evict toàn bộ phiên user → message confirm.
 *  - Audit Log lưu Before/After do interceptor backend ghi.
 */
interface AttributesResponse {
  userId: string;
  fullName: string;
  email: string;
  status?: string;
  currentAttributes: {
    departmentId: string | null;
    title: string | null;
    clearanceLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  };
}
interface Department {
  id: string;
  name: string;
}

const CLEARANCES: Array<AttributesResponse['currentAttributes']['clearanceLevel']> = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
];

export function AttributeAssignmentPage() {
  const { userId } = useParams<{ userId: string }>();
  const qc = useQueryClient();

  const attr = useQuery<AttributesResponse>({
    queryKey: ['user-attributes', userId],
    queryFn: async () =>
      (await axiosClient.get(`/admin/users/${userId}/attributes`)).data,
    enabled: !!userId,
  });

  const departments = useQuery<Department[]>({
    queryKey: ['admin-departments'],
    queryFn: async () => (await axiosClient.get('/admin/departments')).data,
  });

  // Local form state
  const [departmentId, setDepartmentId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [clearanceLevel, setClearanceLevel] =
    useState<AttributesResponse['currentAttributes']['clearanceLevel']>('INTERNAL');
  const [showEscalation, setShowEscalation] = useState(false);
  const [confirmedEscalation, setConfirmedEscalation] = useState(false);

  // Hydrate form khi data về
  useEffect(() => {
    if (attr.data) {
      setDepartmentId(attr.data.currentAttributes.departmentId ?? '');
      setTitle(attr.data.currentAttributes.title ?? '');
      setClearanceLevel(attr.data.currentAttributes.clearanceLevel);
      setConfirmedEscalation(attr.data.currentAttributes.clearanceLevel === 'CONFIDENTIAL');
    }
  }, [attr.data]);

  const isDirty = useMemo(() => {
    if (!attr.data) return false;
    const c = attr.data.currentAttributes;
    return (
      (c.departmentId ?? '') !== departmentId ||
      (c.title ?? '') !== title ||
      c.clearanceLevel !== clearanceLevel
    );
  }, [attr.data, departmentId, title, clearanceLevel]);

  // Cảnh báo nâng clearance
  useEffect(() => {
    const before = attr.data?.currentAttributes.clearanceLevel ?? 'INTERNAL';
    if (clearanceLevel === 'CONFIDENTIAL' && before !== 'CONFIDENTIAL') {
      setShowEscalation(true);
    }
  }, [clearanceLevel, attr.data]);

  const save = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.put(`/admin/users/${userId}/attributes`, {
          departmentId: departmentId || undefined,
          title: title || undefined,
          clearanceLevel,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-attributes', userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    if (clearanceLevel === 'CONFIDENTIAL' && !confirmedEscalation) {
      setShowEscalation(true);
      return;
    }
    save.mutate();
  };

  if (attr.isLoading) return <div className="text-gray-500">Đang tải hồ sơ...</div>;
  if (attr.error || !attr.data)
    return (
      <div className="text-danger text-sm">
        Không lấy được hồ sơ người dùng. <Link to="/admin/users" className="underline">Quay lại danh bạ</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/users" className="text-xs text-gray-500 hover:text-viettel-red">
            ‹ Danh bạ người dùng
          </Link>
          <h1 className="text-2xl font-bold mt-1">Gán thuộc tính ABAC</h1>
          <p className="text-sm text-gray-500 mt-1">
            Force Eviction & Guard Token Synchronization (FR-1.2.1) — mọi thay đổi sẽ làm user đăng xuất khỏi mọi thiết bị.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Cột trái: Static summary card */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-viettel-red text-white flex items-center justify-center text-xl font-bold">
              {attr.data.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{attr.data.fullName}</div>
              <div className="text-xs text-gray-500">{attr.data.email}</div>
            </div>
          </div>
          <hr />
          <Row label="User ID" value={attr.data.userId} mono />
          <Row label="Phòng ban hiện tại" value={
            departments.data?.find((d) => d.id === attr.data!.currentAttributes.departmentId)?.name ?? '—'
          } />
          <Row label="Chức danh hiện tại" value={attr.data.currentAttributes.title ?? '—'} />
          <Row
            label="Clearance hiện tại"
            value={
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  attr.data.currentAttributes.clearanceLevel === 'CONFIDENTIAL'
                    ? 'bg-red-100 text-red-700'
                    : attr.data.currentAttributes.clearanceLevel === 'INTERNAL'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {attr.data.currentAttributes.clearanceLevel}
              </span>
            }
          />
        </div>

        {/* Cột phải: Form gán */}
        <form onSubmit={submit} className="lg:col-span-3 bg-white rounded-lg shadow p-5 space-y-4">
          <div>
            <h2 className="font-semibold mb-1">Cơ cấu tổ chức</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phòng ban *</label>
                {departments.isLoading ? (
                  <div className="border rounded px-3 py-2 text-gray-400 text-sm">Đang tải...</div>
                ) : (
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">— Chọn phòng ban —</option>
                    {departments.data?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chức danh</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Project Manager, Developer, QA Lead"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          <hr />

          <div>
            <h2 className="font-semibold mb-1">An toàn thông tin (Clearance)</h2>
            <p className="text-xs text-gray-500 mb-2">
              Mức nào càng cao càng tiếp cận được tài liệu nhạy cảm hơn (CONFIDENTIAL = MẬT).
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CLEARANCES.map((c) => (
                <label
                  key={c}
                  className={`border rounded-lg p-3 cursor-pointer text-center ${
                    clearanceLevel === c
                      ? c === 'CONFIDENTIAL'
                        ? 'border-danger bg-red-50'
                        : 'border-viettel-red bg-yellow-50'
                      : 'hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="clearance"
                    checked={clearanceLevel === c}
                    onChange={() => {
                      setClearanceLevel(c);
                      if (c !== 'CONFIDENTIAL') setConfirmedEscalation(false);
                    }}
                    className="hidden"
                  />
                  <div className="font-semibold">{c}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {c === 'PUBLIC' && 'Tài liệu công khai'}
                    {c === 'INTERNAL' && 'Nội bộ Tập đoàn'}
                    {c === 'CONFIDENTIAL' && 'MẬT — giám sát chặt'}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Escalation warning modal-ish inline */}
          {showEscalation && clearanceLevel === 'CONFIDENTIAL' && !confirmedEscalation && (
            <div className="bg-red-50 border border-danger rounded p-4 space-y-2">
              <div className="font-semibold text-danger flex items-center gap-2">
                ⚠️ Cảnh báo nâng quyền tiếp cận tài liệu MẬT
              </div>
              <p className="text-sm text-gray-700">
                Bạn chuẩn bị cấp quyền tiếp cận tài liệu MẬT cho nhân sự này. Mọi hành vi truy cập sau đó sẽ
                bị giám sát chặt chẽ bởi Security Officer (audit hash-chained, không thể xóa).
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedEscalation(true);
                    setShowEscalation(false);
                  }}
                  className="px-3 py-1.5 bg-danger text-white rounded text-sm hover:bg-red-700"
                >
                  Tôi hiểu, tiếp tục
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClearanceLevel(attr.data!.currentAttributes.clearanceLevel);
                    setShowEscalation(false);
                  }}
                  className="px-3 py-1.5 border rounded text-sm"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              {save.isSuccess && (
                <span className="text-green-700">
                  ✓ Đã cập nhật thuộc tính + thu hồi phiên cũ. Lần đăng nhập kế tiếp sẽ nhận JWT chứa claims mới.
                </span>
              )}
              {save.error && (
                <span className="text-danger">
                  {(save.error as any)?.response?.data?.message ?? 'Lỗi cập nhật'}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!isDirty || save.isPending}
              className="px-5 py-2 bg-viettel-red text-white rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {save.isPending ? 'Đang cập nhật...' : isDirty ? 'Lưu thuộc tính' : 'Chưa có thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="text-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={mono ? 'font-mono text-xs break-all' : ''}>{value}</div>
    </div>
  );
}
