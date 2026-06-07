# Luồng 13 — Quản trị nhân sự dự án (Resource Management)

- **Route:** `/projects/:projectId/team`
- **Component:** Resource Management
- **Actor:** PM
- **Yêu cầu nguồn:** FR-2.1.2

## 1. Layout
Single-Column Enterprise Layout:
- *Header:* chỉ số tổng số thành viên + nút "Thêm nhân sự vào dự án" (nút nổi xanh).
- *Team Grid:* danh sách nhân sự tham gia. Cột: Nhân sự (Avatar + Họ tên + Email), Phòng ban hệ thống, Vai trò nội bộ (`project_role` — Dropdown: PM, CONTRIBUTOR, REVIEWER, VIEWER), Ngày tham gia, nút Xóa khỏi dự án (icon thùng rác).

## 2. UX States
- **Inline Dropdown Mutation:** đổi vai trò trên bảng (VD: CONTRIBUTOR → REVIEWER) → spinner nhỏ trong ô Dropdown báo Backend đang đồng bộ policy, rồi Toast xanh: *"Đã cập nhật vai trò dự án thành công"*.
- **Smart Employee Search Modal:** nút "Thêm nhân sự" → Modal Async Select; nhập tên lọc nhân viên toàn tập đoàn nhưng **tự loại trừ** người đã có trong dự án (chống trùng bản ghi).
- **Self-Removal Protection:** nếu user hiện tại là PM Owner → nút "Xóa khỏi dự án" và Dropdown vai trò của chính họ bị khóa cứng (disabled), tránh dự án mồ côi quản trị.

## 3. Component Frontend
```
src/
├── pages/projects/ProjectTeamPage.tsx             # Trang quản trị nhân sự dự án
├── widgets/team-management/
│   ├── AddMemberModal.tsx                          # Modal tìm kiếm & chèn nhân viên mới
│   └── ProjectMemberTable.tsx                       # Bảng danh sách kèm menu phân vai trò trực tiếp
└── features/member-role-mutation/
    ├── ui/RoleSelectCell.tsx                       # Ô tùy chọn vai trò gọi API ngầm
    └── api/team.api.ts                              # API CRUD cấu hình nhân sự dự án
```

## 4. Backend API
- `POST /api/v1/projects/:projectId/members`
  - Payload: `{ "userId": "user-uuid-555", "projectRole": "CONTRIBUTOR" }`
  - Response (201): `{ "message": "Đã thêm nhân sự vào đội ngũ dự án." }`
- `PATCH /api/v1/projects/:projectId/members/:userId`
  - Payload: `{ "projectRole": "REVIEWER" }`
  - Response (200): `{ "message": "Cập nhật vai trò thành công." }`
- `DELETE /api/v1/projects/:projectId/members/:userId`
  - Response (200): `{ "message": "Đã xóa nhân sự khỏi dự án." }`

## 5. Under the Hood
- **Casbin Grouping Policy Synchronization:** không chỉ lưu vai trò vào `project_members`. Khi sửa vai trò thành công, đồng bộ sang Node-Casbin cập nhật Grouping Policy (`g` rule):
  - Cũ: `g, user-uuid-555, role_contributor_proj-001`
  - Mới: `g, user-uuid-555, role_reviewer_proj-001`
  - Đồng thời Evict cache quyền của user trên Redis → thao tác kế tiếp ép chạy lại Casbin tính lại ma trận ABAC theo vai trò mới.
- **Casbin Explicit Revocation:** trong API DELETE member, sau transaction xóa CSDL bắt buộc gọi:
```typescript
await this.casbinEnforcer.removeGroupingPolicy(userId, roleId)
```
  Nếu bỏ bước này, Casbin vẫn tưởng user còn role dự án. Sau khi gỡ luật, gọi Redis xóa Session Cache để tính lại quyền từ 0.
