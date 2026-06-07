# Luồng 08 — Gán thuộc tính ABAC (Attribute Assignment)

- **Route:** `/admin/users/:userId/attributes`
- **Component:** Attribute Assignment
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-1.2.1 (đồng bộ thuộc tính), FR-5.1.2 (log Before/After)

## 1. Layout
Focused Two-Column Layout:
- *Cột trái (Hồ sơ tóm tắt):* Static Card thông tin định danh không sửa được: Ảnh đại diện, Họ tên, Mã nhân viên, Email, trạng thái tài khoản.
- *Cột phải (Form gán thuộc tính ABAC):*
  - *Cơ cấu tổ chức:* Dropdown Phòng ban (`department_id`), ô nhập Chức danh (`title` — VD: Project Manager, Developer, QA).
  - *An toàn thông tin:* Radio chọn Cấp độ bảo mật (`clearance_level`: PUBLIC, INTERNAL, CONFIDENTIAL).

## 2. UX States
- **Dynamic Dropdown Loading:** danh sách phòng ban tải động từ Database, hiện spinner trong lúc tải.
- **Clearance Escalation Warning:** nâng lên `CONFIDENTIAL` → Popover/Modal cảnh báo: *"Chú ý: Cấp quyền tiếp cận tài liệu MẬT cho nhân sự này. Mọi hành vi truy cập sau đó sẽ bị giám sát chặt chẽ bởi Security Officer."*
- **Form Mutation State:** nút "Lưu thuộc tính" chỉ sáng khi `isDirty = true`; khi bấm lưu hiển thị "Đang cập nhật..." và khóa form chống double-submit.

## 3. Component Frontend
```
src/
├── pages/admin/AttributeAssignmentPage.tsx        # Trang phân phối thuộc tính nhân sự
├── widgets/attribute-editor/
│   ├── UserSummaryCard.tsx                         # Thông tin nhân viên tĩnh
│   └── AttributeForm.tsx                           # Form xử lý thay đổi thuộc tính ABAC
└── features/update-user-attributes/
    ├── model/attribute-validation.ts              # Schema kiểm tra đầu vào (Zod)
    └── api/attributes.api.ts                        # API cập nhật thuộc tính lên NestJS
```

## 4. Backend API
### `GET /api/v1/admin/users/:userId/attributes`
Response (200 OK):
```json
{
  "userId": "user-uuid-123",
  "fullName": "Ngô Minh Đức",
  "email": "ducnm@viettel.com.vn",
  "currentAttributes": { "departmentId": "dept-uuid-456", "title": "Developer", "clearanceLevel": "INTERNAL" }
}
```

### `PUT /api/v1/admin/users/:userId/attributes`
- Payload: `{ "departmentId": "dept-uuid-789", "title": "Project Manager", "clearanceLevel": "CONFIDENTIAL" }`
- Response (200 OK): `{ "message": "Cập nhật thuộc tính ABAC thành công. Đã vô hiệu hóa các phiên làm việc cũ." }`

## 5. Under the Hood
- **Force Eviction & Guard Token Synchronization (FR-1.2.1):** ngay khi `UPDATE profiles SET department_id=..., title=...` thành công:
  1. Gọi Redis xóa toàn bộ phiên đăng nhập hiện tại của user (Force Logout).
  2. Xóa cache phân quyền của user trên Redis (TTL 5 phút hủy ngay).
  - Request kế tiếp của user → `401 Unauthorized`, buộc đăng nhập lại để nhận JWT mới chứa claims mới → triệt tiêu lỗ hổng "giữ quyền cũ do token chưa hết hạn".
- **Audit Log Before/After Payload (FR-5.1.2):** interceptor ghi vào `audit_logs` trường metadata JSON chứa cả before/after, VD: `{"before": {"title": "Dev"}, "after": {"title": "PM"}}`.
