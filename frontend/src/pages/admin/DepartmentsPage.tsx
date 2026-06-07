import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * Luồng 09 — Department MasterData.
 * Master-Detail Split:
 *  - Trái: bảng phòng ban (employeeCount, status). Bấm dòng → load drawer phải để Sửa.
 *  - Phải: Form Tạo/Sửa với Inline Uniqueness Validation (409 trả về từ Prisma P2002).
 * Safe Delete Guard: employeeCount > 0 → nút Xóa disabled + tooltip cảnh báo.
 */
interface Department {
  id: string;
  name: string;
  description: string | null;
  employeeCount: number;
  createdAt: string;
}

type DraftMode = 'create' | 'edit' | null;

export function DepartmentsPage() {
  const qc = useQueryClient();
  const list = useQuery<Department[]>({
    queryKey: ['admin-departments'],
    queryFn: async () => (await axiosClient.get('/admin/departments')).data,
  });

  const [mode, setMode] = useState<DraftMode>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = (m: DraftMode = null, dept: Department | null = null) => {
    setMode(m);
    setDraftId(dept?.id ?? null);
    setName(dept?.name ?? '');
    setDescription(dept?.description ?? '');
    setFieldError(null);
  };

  const create = useMutation({
    mutationFn: async () =>
      (await axiosClient.post('/admin/departments', { name, description })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-departments'] });
      reset();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 409) setFieldError('Tên phòng ban này đã tồn tại trong hệ thống.');
      else setFieldError(err?.response?.data?.message ?? 'Có lỗi xảy ra.');
    },
  });

  const update = useMutation({
    mutationFn: async () =>
      (await axiosClient.patch(`/admin/departments/${draftId}`, { name, description })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-departments'] });
      reset();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 409) setFieldError('Tên phòng ban này đã tồn tại trong hệ thống.');
      else setFieldError(err?.response?.data?.message ?? 'Có lỗi xảy ra.');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await axiosClient.delete(`/admin/departments/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-departments'] }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    if (mode === 'create') create.mutate();
    if (mode === 'edit') update.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phòng ban</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh mục phòng ban — gắn với Luồng 8 (Attribute Assignment).
          </p>
        </div>
        <button
          onClick={() => reset('create')}
          className="px-3 py-2 bg-viettel-red text-white rounded text-sm font-medium hover:bg-red-700"
        >
          + Thêm phòng ban
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bảng phòng ban */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          {list.isLoading && (
            <div className="p-6 text-gray-500 text-sm">Đang tải...</div>
          )}
          {list.data && list.data.length === 0 && (
            <div className="p-10 text-center">
              <div className="text-5xl text-gray-300 mb-3">🏢</div>
              <p className="text-gray-500 text-sm">Chưa có phòng ban nào.</p>
              <button
                onClick={() => reset('create')}
                className="mt-3 px-4 py-2 bg-viettel-red text-white rounded text-sm"
              >
                Tạo phòng ban đầu tiên
              </button>
            </div>
          )}
          {list.data && list.data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Tên phòng ban</th>
                  <th className="px-4 py-2">Mô tả</th>
                  <th className="px-4 py-2 text-center">Nhân sự</th>
                  <th className="px-4 py-2">Ngày tạo</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data.map((d) => {
                  const hasMembers = d.employeeCount > 0;
                  const isSelected = draftId === d.id;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => reset('edit', d)}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        isSelected ? 'bg-yellow-50 border-l-4 border-viettel-red' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-medium">{d.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {d.description ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            hasMembers ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {d.employeeCount}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          disabled={hasMembers}
                          title={
                            hasMembers
                              ? 'Không thể xóa phòng ban đang có nhân sự đang hoạt động. Vui lòng điều chuyển nhân sự sang phòng ban khác trước.'
                              : ''
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Xóa phòng ban "${d.name}"?`)) remove.mutate(d.id);
                          }}
                          className="text-xs text-danger hover:underline disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Drawer Tạo/Sửa */}
        <div className="lg:col-span-2">
          {mode === null && (
            <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-500">
              Chọn 1 phòng ban từ bảng để chỉnh sửa,
              <br /> hoặc bấm <span className="font-semibold">+ Thêm phòng ban</span> để tạo mới.
            </div>
          )}
          {mode !== null && (
            <form onSubmit={submit} className="bg-white rounded-lg shadow p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {mode === 'create' ? 'Tạo phòng ban mới' : 'Cập nhật phòng ban'}
                </h2>
                <button
                  type="button"
                  onClick={() => reset()}
                  className="text-xs text-gray-500 hover:text-danger"
                >
                  ✕ Đóng
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tên phòng ban *</label>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldError(null);
                  }}
                  required
                  minLength={2}
                  className={`w-full border rounded px-3 py-2 ${
                    fieldError ? 'border-danger ring-1 ring-danger' : ''
                  }`}
                />
                {fieldError && (
                  <p className="text-xs text-danger mt-1">{fieldError}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mô tả ngắn</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="w-full bg-viettel-red text-white py-2 rounded font-medium disabled:opacity-50"
              >
                {create.isPending || update.isPending
                  ? 'Đang lưu...'
                  : mode === 'create'
                    ? 'Tạo phòng ban'
                    : 'Cập nhật'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
