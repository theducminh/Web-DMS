# Luồng 07 — Danh bạ người dùng (User Directory)

- **Route:** `/admin/users`
- **Component:** User Directory
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-1.3.1, FR-1.3.2

## 1. Layout
Data-Table chuẩn Enterprise toàn màn hình, 3 phần:
- *Top Bar:* ô tìm kiếm đa trường (Tên, Email, SĐT) hỗ trợ debounce; dropdown lọc theo Phòng ban, Chức vụ, Trạng thái (PENDING, ACTIVE, DISABLED).
- *Bulk Actions:* Floating Bar xuất hiện khi chọn nhiều bản ghi qua checkbox — "Kích hoạt hàng loạt", "Khóa hàng loạt", "Chuyển phòng ban".
- *Main Table:* cột thông tin nhân sự + Badge trạng thái (Xanh: Active, Vàng: Pending, Đỏ: Disabled). Cột cuối có menu hành động nhanh (...): Sửa thuộc tính ABAC, Khóa/Mở khóa.

## 2. UX States
- **Debounced Search:** `debounce(300ms)`, chỉ gọi API sau khi ngừng gõ 300ms. Bật `keepPreviousData: true` (hoặc `placeholderData: keepPreviousData` ở v5) để Zero UI Shift.
- **State Preservation Pagination:** chuyển trang/đổi bộ lọc → cập nhật Query Params trên URL (`?page=2&status=PENDING`), giữ nguyên trạng thái khi F5 / share link.
- **Destructive Confirmation:** hành động khóa tài khoản (Disable) bắt buộc Dialog cảnh báo nguy hiểm, nút xác nhận đỏ.

## 3. Component Frontend
```
src/
├── pages/admin/UserDirectoryPage.tsx
├── widgets/user-table/
│   ├── UserFilterBar.tsx
│   └── UserDataTable.tsx
└── features/
    ├── user-status-control/
    │   ├── ui/LockUserDialog.tsx
    │   └── api/user-admin.api.ts
    └── bulk-user-operations/ui/BulkActionBar.tsx
```

## 4. Backend API
### `GET /api/v1/admin/users`
- Query: `page=1&limit=10&search=ducnm&departmentId=uuid&status=ACTIVE`
- Response (200 OK):
```json
{
  "data": [
    { "id": "user-uuid-1", "fullName": "Ngô Minh Đức", "email": "ducnm@viettel.com.vn", "status": "ACTIVE", "department": "An ninh thông tin", "title": "Engineer" }
  ],
  "meta": { "totalItems": 150, "totalPages": 15, "currentPage": 1 }
}
```

### `PATCH /api/v1/admin/users/bulk-status`
- Payload: `{ "userIds": ["uuid-1", "uuid-2"], "status": "DISABLED", "reason": "Nghi ngờ lộ lọt dữ liệu" }`
- Response (200 OK): `{ "message": "Đã vô hiệu hóa thành công 2 tài khoản." }`

### `PATCH /api/v1/admin/users/bulk-attributes`
- Payload: `{ "userIds": ["uuid-1","uuid-2","uuid-3"], "departmentId": "dept-uuid", "title": "Developer" }`
- Response (200 OK): `{ "message": "Đã cập nhật thuộc tính cho 3 nhân sự." }`

## 5. Under the Hood
- **Mass Session Eviction Engine (Zero-Trust):** khi chuyển user sang `DISABLED`, không chỉ update `status` trong PostgreSQL — Backend gọi Redis quét xóa toàn bộ session keys của các user ID đó, đồng thời gửi event xóa cache thuộc tính ABAC (TTL 5 phút hủy ngay). Đối tượng bị khóa bị đá văng ngay giây tiếp theo, không tận dụng được Access Token cũ.
- **Server-Side Security Guard:** API bọc bởi `JwtAuthGuard` + `CasbinGuard` — chỉ user thỏa policy `(p, role_admin, /api/v1/admin/users, GET)` mới đọc được danh bạ.
- **Audit Logging:** mọi thay đổi trạng thái tài khoản đều băm xích (Hash Chaining) ghi vào `audit_logs`.
- Sau `updateMany` của Prisma, Backend lặp qua mảng `userIds` để gọi Redis xóa Session + cache phân quyền Casbin của **tất cả** user cùng lúc.
