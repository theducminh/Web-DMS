# Luồng 09 — Danh mục phòng ban (Department MasterData)

- **Route:** `/admin/departments`
- **Component:** Department MasterData
- **Actor:** Admin / Security Officer

## 1. Layout
Master-Detail Split Screen:
- *Bên trái (Danh sách bảng):* danh mục phòng ban hiện có — cột: Tên, Mô tả ngắn, Số nhân sự (Employee Count), Ngày tạo.
- *Bên phải (Drawer/Card động):* bấm 1 dòng → Form "Cập nhật phòng ban"; bấm "Thêm phòng ban" → Form trống tạo mới.

## 2. UX States
- **Inline Uniqueness Validation:** nhập tên trùng → khi submit, ô input viền đỏ + text: *"Tên phòng ban này đã tồn tại trong hệ thống"*.
- **Safe Delete Guard:** phòng ban có `Employee Count > 0` → nút Xóa bị disabled. Hover hiện tooltip: *"Không thể xóa phòng ban đang có nhân sự đang hoạt động. Vui lòng điều chuyển nhân sự sang phòng ban khác trước."* (ngăn lỗi Foreign Key Constraint).
- **Empty State Handling:** chưa có phòng ban → illustration mờ + nút "Tạo phòng ban đầu tiên" giữa phân vùng.

## 3. Component Frontend
```
src/
├── pages/admin/DepartmentMasterPage.tsx           # Trang quản trị danh mục phòng ban
├── widgets/department-grid/
│   ├── DepartmentTable.tsx                         # Bảng danh sách phòng ban
│   └── DepartmentDetailDrawer.tsx                  # Form thêm/sửa (drawer phải)
└── features/manage-department/
    ├── model/dept-form.schema.ts                  # Validate form (Zod)
    └── api/department.api.ts                        # API CRUD (GET, POST, PATCH, DELETE)
```

## 4. Backend API
### `GET /api/v1/admin/departments`
Response (200 OK):
```json
[
  { "id": "dept-uuid-1", "name": "Khối Công nghệ Thông tin", "description": "Phát triển các sản phẩm phần mềm lõi", "employeeCount": 42, "createdAt": "2026-04-15T08:00:00Z" }
]
```

### `POST /api/v1/admin/departments`
- Payload: `{ "name": "Trung tâm An ninh mạng", "description": "Ứng cứu sự cố lộ lọt thông tin" }`
- Response (201 Created): `{ "id": "new-dept-uuid", "message": "Tạo phòng ban thành công" }`

### `DELETE /api/v1/admin/departments/:id`
- Response: 200 nếu thành công, hoặc 400 + *"Phòng ban có nhân sự, không thể xóa"* nếu vi phạm logic an toàn.

### `PATCH /api/v1/admin/departments/:id/status` (thay thế cho DELETE)
- Payload: `{ "isActive": false }`
- Response (200 OK): `{ "message": "Đã lưu trữ phòng ban. Phòng ban này sẽ bị ẩn trong các danh sách chọn." }`
- Guard: vẫn check `employeeCount == 0` trước khi cho `isActive = false`, còn nhân sự → 400.

## 5. Under the Hood
- **Relational Aggregation Query:** lấy `employeeCount` bằng Group By + Count, hoặc dùng `_count` quan hệ của Prisma:
```typescript
this.prisma.department.findMany({
  include: { _count: { select: { profiles: true } } }
});
```
- **Database Unique Index Protection:** trường `name` cấu hình UNIQUE ở PostgreSQL. Trùng tên → Prisma ném `P2002` → `GlobalExceptionFilter` bắt lại trả `409 Conflict`, không sập server.
- **Audit Trail:** lưu vết `DEPARTMENT_CREATE`, `DEPARTMENT_UPDATE`, `DEPARTMENT_DELETE`.
