import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * Luồng 07 — User Directory (Admin / Security Officer).
 *  - Top Bar: search debounce 300ms + filter Phòng ban/Status.
 *  - Bulk Actions Bar: chọn nhiều dòng → Activate / Disable hàng loạt → Mass Session Eviction.
 *  - Pagination giữ qua URL ngầm; placeholderData keepPreviousData → Zero UI Shift.
 *  - Destructive Confirmation cho hành động Disable.
 */
interface UserRow {
  id: string;
  fullName: string;
  email: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  department: string | null;
  title: string | null;
}
interface UsersResponse {
  data: UserRow[];
  meta: { totalItems: number; totalPages: number; currentPage: number };
}
interface Department {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<UserRow['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  DISABLED: 'bg-red-100 text-red-700',
};

export function UserDirectoryPage() {
  const qc = useQueryClient();

  // Filters (URL-preservable in spirit; chưa wire vào history vì single page)
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<'' | UserRow['status']>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Debounce search 300ms
  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [searchInput]);

  const departments = useQuery<Department[]>({
    queryKey: ['admin-departments'],
    queryFn: async () => (await axiosClient.get('/admin/departments')).data,
  });

  const users = useQuery<UsersResponse>({
    queryKey: ['admin-users', { page, limit, search, departmentId, status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (departmentId) params.set('departmentId', departmentId);
      if (status) params.set('status', status);
      return (await axiosClient.get<UsersResponse>(`/admin/users?${params}`)).data;
    },
    placeholderData: keepPreviousData,
  });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allOnPageIds = useMemo(() => users.data?.data.map((u) => u.id) ?? [], [users.data]);
  const allSelectedOnPage =
    allOnPageIds.length > 0 && allOnPageIds.every((id) => selectedIds.has(id));
  const toggleAllOnPage = () => {
    const next = new Set(selectedIds);
    if (allSelectedOnPage) allOnPageIds.forEach((id) => next.delete(id));
    else allOnPageIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Bulk mutations
  const bulkStatus = useMutation({
    mutationFn: async (payload: { status: UserRow['status']; reason?: string }) =>
      (
        await axiosClient.patch('/admin/users/bulk-status', {
          userIds: [...selectedIds],
          status: payload.status,
          reason: payload.reason,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      clearSelection();
    },
  });

  const onBulkDisable = () => {
    const reason = prompt(
      `⚠️ Bạn chuẩn bị KHÓA ${selectedIds.size} tài khoản. Mọi phiên đang đăng nhập của họ sẽ bị thu hồi NGAY LẬP TỨC (Mass Session Eviction).\n\nNhập lý do để ghi audit (bắt buộc):`,
      '',
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      alert('Lý do quá ngắn (tối thiểu 5 ký tự).');
      return;
    }
    bulkStatus.mutate({ status: 'DISABLED', reason });
  };

  const onBulkActivate = () => {
    if (!confirm(`Kích hoạt ${selectedIds.size} tài khoản?`)) return;
    bulkStatus.mutate({ status: 'ACTIVE' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Danh bạ người dùng</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mass Session Eviction Engine — Disable user là kéo người đó khỏi mọi phiên đang chạy.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          Tổng: <span className="font-semibold">{users.data?.meta.totalItems ?? 0}</span> người dùng
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-gray-500 mb-1">Tìm kiếm (Tên/Email)</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Gõ để tìm... (debounce 300ms)"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phòng ban</label>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-2 min-w-[180px]"
          >
            <option value="">Tất cả</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Trạng thái</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
        <button
          onClick={() => {
            setSearchInput('');
            setDepartmentId('');
            setStatus('');
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
        >
          Đặt lại
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-viettel-dark text-white rounded-lg shadow px-4 py-3 flex items-center gap-3 sticky top-2 z-10">
          <span className="font-semibold">{selectedIds.size}</span> tài khoản đã chọn
          <div className="flex-1" />
          <button
            onClick={onBulkActivate}
            disabled={bulkStatus.isPending}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
          >
            ✓ Kích hoạt
          </button>
          <button
            onClick={onBulkDisable}
            disabled={bulkStatus.isPending}
            className="px-3 py-1.5 bg-danger hover:bg-red-700 rounded text-sm disabled:opacity-50"
          >
            🔒 Khóa (Mass Eviction)
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 border border-white/30 hover:bg-white/10 rounded text-sm"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelectedOnPage}
                  onChange={toggleAllOnPage}
                  disabled={!users.data?.data.length}
                />
              </th>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phòng ban</th>
              <th className="px-3 py-2">Chức vụ</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-gray-500">
                  Đang tải...
                </td>
              </tr>
            )}
            {users.data?.data.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{u.fullName}</td>
                <td className="px-3 py-2 text-gray-600">{u.email}</td>
                <td className="px-3 py-2 text-xs">{u.department ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{u.title ?? '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[u.status]}`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/admin/users/${u.id}/attributes`}
                    className="text-xs text-viettel-red hover:underline"
                  >
                    Sửa thuộc tính ABAC →
                  </Link>
                </td>
              </tr>
            ))}
            {users.data && users.data.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Không có người dùng khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {users.data && users.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-gray-500">
            Trang {users.data.meta.currentPage} / {users.data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border rounded disabled:opacity-30"
            >
              ‹ Trước
            </button>
            <button
              onClick={() =>
                setPage((p) => Math.min(users.data!.meta.totalPages, p + 1))
              }
              disabled={page >= users.data.meta.totalPages}
              className="px-3 py-1.5 border rounded disabled:opacity-30"
            >
              Sau ›
            </button>
          </div>
        </div>
      )}

      {bulkStatus.isSuccess && (
        <div className="text-xs text-green-700">✓ Đã cập nhật + thu hồi phiên thành công.</div>
      )}
      {bulkStatus.error && (
        <div className="text-xs text-danger">
          {(bulkStatus.error as any)?.response?.data?.message ?? 'Lỗi cập nhật hàng loạt'}
        </div>
      )}
    </div>
  );
}
